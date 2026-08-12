"""
v4.9 C7 复杂故障组合混沌工程自动化集成测试

C7 场景：在 C6（500ms 基础延迟 + 10% 丢包 + 90s 抖动延迟）基础上，
叠加「信号丢失」故障维度，构成更复杂的多故障叠加：

故障模型（叠加优先级从高到低）：
  1. 信号丢失（Signal Loss）：bid 30~32 连续 None —— 数据源整体无数据（区别于 C6 稀疏丢包，
     是持续的总信号丢失窗口），输出 None 触发 FSM「跳过恢复」
  2. 真实偏离（True Deviation）：bid 12~14 / 44~46 两个窗口，3 连真实偏离
  3. 丢包（Packet Loss）：bid%10==0 → None（10% 丢包率）
  4. 抖动（Jitter Latency）：bid%6==0 → True（Δt=90s 严重延迟误偏离）
  5. 正常：False

500ms 基础延迟（<30s 阈值）不触发任何信号，作为常驻背景。

目标：验证在多故障叠加（信号丢失 + 丢包 + 抖动）的极端环境下：
  - 真实偏离仍能穿透全部噪声触发降级（穿透性）
  - 信号丢失窗口在 DOWNGRADED 态跳过恢复（不误恢复 → 不产生"误恢复→二次降级"震荡）
  - 冷却期对所有噪声免疫（状态稳定性）
  - 恢复与再降级都是真实因果，事件序列正确（可判定性）

日志埋点：本脚本内置 FaultInjectionLogger，可输出每个故障注入阶段的
时序（相对启动耗时）+ 状态迁移 + 事件汇总，便于排查潜在问题。
运行 `-v` 时 `test_c7_fault_stage_trace` 会输出完整故障阶段日志。

运行：
  python scripts/test_c7_complex_fault_combination.py -v
"""

from __future__ import annotations

import sys
import time
import unittest
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent))

from v49_l5_downgrade_integration_test import (  # noqa: E402
    DowngradeEngine,
    EngineState,
    LifecycleRecorder,
    LOGGER,
    DOWNGRADE_COOLDOWN_BATCHES,
)

# ===============================================================
# C7 场景参数定义
# ===============================================================

C7_END_BID = 55

C7_BASE_LATENCY_MS = 0.5        # 500ms 基础延迟（<30s 阈值，常驻背景，不触发信号）
C7_PACKET_LOSS_RATE = 0.10      # 10% 丢包率（bid%10==0 → None）
C7_JITTER_EVERY_N = 6           # 每 6 批一次抖动（bid%6==0 → True, Δt=90s 严重延迟）
C7_JITTER_LATENCY_SECONDS = 90.0

C7_SIGNAL_LOSS_WINDOW: Tuple[int, int] = (30, 32)  # 信号丢失：DOWNGRADED 态持续 None
C7_TRUE_DEV_WINDOWS: Tuple[Tuple[int, int], ...] = (
    (12, 14),
    (44, 46),
)


def _c7_is_signal_loss(bid: int) -> bool:
    s, e = C7_SIGNAL_LOSS_WINDOW
    return s <= bid <= e


def _c7_is_real_deviation(bid: int) -> bool:
    return any(s <= bid <= e for s, e in C7_TRUE_DEV_WINDOWS)


def _c7_is_packet_loss(bid: int) -> bool:
    return bid % 10 == 0


def _c7_has_jitter(bid: int) -> bool:
    return bid % C7_JITTER_EVERY_N == 0


def build_c7_deviation_map() -> Dict[int, Optional[bool]]:
    """C7 场景 is_deviated 映射。优先级：信号丢失 > 真实偏离 > 丢包 > 抖动 > 正常。"""
    m: Dict[int, Optional[bool]] = {}
    for bid in range(C7_END_BID + 1):
        if _c7_is_signal_loss(bid):
            m[bid] = None  # 信号丢失 → None（跳过恢复）
        elif _c7_is_real_deviation(bid):
            m[bid] = True  # 真实偏离
        elif _c7_is_packet_loss(bid):
            m[bid] = None  # 丢包 → None（不中断计数）
        elif _c7_has_jitter(bid):
            m[bid] = True  # 抖动 → 误偏离
        else:
            m[bid] = False
    return m


# ===============================================================
# 故障注入阶段模型 + 详细日志埋点
# ===============================================================

@dataclass
class FaultStage:
    """单个故障注入阶段：记录进入/离开批次、耗时与期间状态/事件变化。"""
    name: str
    start: int
    end: int
    bid_first: Optional[int] = None      # 阶段内首个被处理的 bid
    bid_last: Optional[int] = None       # 阶段内最后被处理的 bid
    elapsed_ms: float = 0.0              # 阶段首步的累计耗时（相对场景启动）
    state_entries: List[str] = field(default_factory=list)   # 期间的状态迁移
    events: List[str] = field(default_factory=list)          # 期间的锚点事件

    def contains(self, bid: int) -> bool:
        return self.start <= bid <= self.end


# C7 场景按 bid 划分的故障阶段（与 C7 场景定义 1:1 对齐）
C7_STAGES: List[FaultStage] = [
    FaultStage("OK_1 噪声底噪", 0, 11),
    FaultStage("真实偏离窗口1", 12, 14),
    FaultStage("冷却期(噪声免疫)", 15, 28),
    FaultStage("冷却结束→降级", 29, 29),
    FaultStage("信号丢失(跳过恢复)", 30, 32),
    FaultStage("正常恢复→RECOVER", 33, 35),
    FaultStage("OK_2 稳定", 36, 43),
    FaultStage("真实偏离窗口2(二次降级)", 44, 46),
    FaultStage("二次冷却", 47, C7_END_BID),
]


def c7_fault_label(bid: int, is_dev: Optional[bool]) -> str:
    """返回该 bid 命中的故障类型标签（含优先级语义）。"""
    if _c7_is_signal_loss(bid):
        return "SIGNAL_LOSS"
    if _c7_is_real_deviation(bid):
        return "REAL_DEV"
    if _c7_is_packet_loss(bid):
        return "PACKET_LOSS"
    if _c7_has_jitter(bid):
        return "JITTER"
    return "NORMAL"


class FaultInjectionLogger:
    """故障注入阶段日志埋点：记录每个阶段的时序与状态变化。

    - step(): 逐步记录时间戳、故障类型、信号、状态迁移、计数与事件
    - 阶段边界：首次进入某阶段时打印阶段入口标记
    - summary(): 场景结束后输出各阶段时序/状态汇总
    """

    def __init__(self, stages: List[FaultStage]) -> None:
        self.stages = stages
        self._t0 = time.perf_counter()
        self._entered = set()  # 已打印入口标记的阶段名

    def _find_stage(self, bid: int) -> Optional[FaultStage]:
        for st in self.stages:
            if st.contains(bid):
                return st
        return None

    def step(self, bid: int, is_dev: Optional[bool], prev: str,
             engine: "DowngradeEngine", event) -> None:
        ts_ms = (time.perf_counter() - self._t0) * 1000.0
        fault = c7_fault_label(bid, is_dev)

        st = self._find_stage(bid)
        if st is not None:
            if st.name not in self._entered:
                self._entered.add(st.name)
                LOGGER.info(
                    "[C7.stage] ══ 进入阶段「%s」 @ bid=%d（首故障信号=%s） ══",
                    st.name, bid, fault,
                )
            if st.bid_first is None:
                st.bid_first = bid
                st.elapsed_ms = ts_ms
            st.bid_last = bid
            if prev != engine.state.value:
                st.state_entries.append(f"{bid}:{prev}→{engine.state.value}")
            if event is not None:
                st.events.append(f"{bid}:{event.event_type}")

        sig = "NONE" if is_dev is None else str(is_dev)
        evt = event.event_type if event is not None else "-"
        LOGGER.info(
            "[C7.step] t=%8.2fms bid=%3d fault=%-10s sig=%-5s state=%-11s→%-11s "
            "cool=%2d dev=%d norm=%d event=%s",
            ts_ms, bid, fault, sig, prev, engine.state.value,
            engine.cooldown_remaining,
            engine.dev_detector.consecutive_count,
            engine.norm_detector.consecutive_count,
            evt,
        )

    def summary(self) -> None:
        LOGGER.info("-" * 96)
        LOGGER.info("[C7.stage-summary] 各故障注入阶段时序/状态汇总（相对启动耗时）：")
        LOGGER.info(
            f"{'故障阶段':<26}{'bid范围':<12}{'首@':<5}{'末@':<5}{'耗时ms':<10}"
            f"{'状态迁移':<24}{'事件'}"
        )
        LOGGER.info("-" * 96)
        for st in self.stages:
            if st.bid_first is None:
                continue  # 未命中（不会发生，C7_STAGES 覆盖全部 bid）
            state_str = "|".join(st.state_entries) or "-"
            evt_str = "|".join(st.events) or "-"
            LOGGER.info(
                f"{st.name:<26}[{st.start:>2},{st.end:>2}]{st.bid_first:<5}"
                f"{st.bid_last:<5}{st.elapsed_ms:<10.2f}{state_str:<24}{evt_str}",
            )
        LOGGER.info("-" * 96)


# ===============================================================
# TestC7ComplexFaultCombination：8 个验证点（CV7.1~CV7.8）+ 日志埋点 trace
# ===============================================================

class TestC7ComplexFaultCombination(unittest.TestCase):
    """复杂故障组合（信号丢失 + 丢包 + 抖动 + 真实偏离）的 8 个验证点 + 阶段日志。"""

    def _run_scenario(self, end_bid: int = C7_END_BID, trace: bool = False,
                      fault_logger: Optional[FaultInjectionLogger] = None):
        self.engine = DowngradeEngine()
        self.recorder = LifecycleRecorder()
        dev_map = build_c7_deviation_map()
        for bid in range(end_bid + 1):
            is_dev = dev_map[bid]
            prev = self.engine.state.value
            _, event = self.engine.step(bid, is_dev)
            extra = None
            if prev == EngineState.COOLDOWN.value and self.engine.state == EngineState.DOWNGRADED:
                extra = "冷却期结束（复杂故障叠加背景下仍按时过渡）"
            self.recorder.capture(bid, is_dev, prev, self.engine, event, extra)
            if trace and fault_logger is not None:
                fault_logger.step(bid, is_dev, prev, self.engine, event)
        return dev_map

    @property
    def snaps_by_bid(self):
        return {s.bid: s for s in self.recorder.snaps}

    # ---- CV7.1 ----
    def test_c7_v1_deviation_penetrates_noise(self):
        """CV7.1: 丢包(None)不中断计数 — bid 10 丢包后 bid 12,13,14 真实偏离仍 3 连触发降级"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[12].dev_count, 1,
                         "CV7.1: bid 12 真实偏离 dev_count=1（不被 bid 10 丢包清零）")
        self.assertEqual(snaps[13].dev_count, 2, "CV7.1: bid 13 dev_count=2")
        self.assertEqual(snaps[14].event_type, "DOWNGRADE",
                         "CV7.1: bid 14 真实偏离 3 连必须触发 DOWNGRADE")
        self.assertEqual(snaps[14].new_state, EngineState.COOLDOWN.value,
                         "CV7.1: bid 14 后进入 COOLDOWN")

    # ---- CV7.2 ----
    def test_c7_v2_first_downgrade_anchor(self):
        """CV7.2: 首次降级锚点 — bid 14 DOWNGRADE → COOLDOWN（cooldown_left=14）"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[14].event_type, "DOWNGRADE",
                         f"CV7.2: bid 14 event=DOWNGRADE，实际={snaps[14].event_type}")
        self.assertEqual(snaps[15].cooldown_left, DOWNGRADE_COOLDOWN_BATCHES - 1,
                         "CV7.2: 降级后首批 cooldown_left=14")

    # ---- CV7.3 ----
    def test_c7_v3_cooldown_immune_to_all_noise(self):
        """CV7.3: 冷却期内抖动(18,24) + 丢包(20) 全忽略，状态保持 COOLDOWN，无事件"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        for bid in (15, 18, 20, 21, 24, 25, 28):
            s = snaps[bid]
            self.assertEqual(s.new_state, EngineState.COOLDOWN.value,
                             f"CV7.3: bid {bid} 冷却期状态={s.new_state}（应为 COOLDOWN）")
            self.assertIsNone(s.event_type,
                              f"CV7.3: bid {bid} 冷却期内无事件（实际={s.event_type}）")

    # ---- CV7.4 ----
    def test_c7_v4_cooldown_to_downgraded_boundary(self):
        """CV7.4: 冷却结束正确过渡 — bid 29（14+15）进入 DOWNGRADED"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[29].new_state, EngineState.DOWNGRADED.value,
                         f"CV7.4: bid 29 必须为 DOWNGRADED，实际={snaps[29].new_state}")
        self.assertEqual(snaps[29].cooldown_left, 0, "CV7.4: 冷却结束 cooldown_left=0")

    # ---- CV7.5（新维度：信号丢失跳过恢复） ----
    def test_c7_v5_signal_loss_skips_recovery(self):
        """CV7.5: 信号丢失(30,31,32)跳过恢复 — norm_count 恒 0，保持 DOWNGRADED 不误恢复"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        for bid in (30, 31, 32):
            s = snaps[bid]
            self.assertEqual(s.norm_count, 0,
                             f"CV7.5: bid={bid} 信号丢失 norm_count 必须为 0（不误恢复）")
            self.assertEqual(s.new_state, EngineState.DOWNGRADED.value,
                             f"CV7.5: bid={bid} 信号丢失必须保持 DOWNGRADED")
            self.assertIsNone(s.event_type,
                              f"CV7.5: bid={bid} 信号丢失不得产生 RECOVER（实际={s.event_type}）")

    # ---- CV7.6 ----
    def test_c7_v6_recover_after_signal_loss(self):
        """CV7.6: 信号丢失后正常恢复 — 33,34,35 三连正常 → bid 35 RECOVER"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[33].norm_count, 1, "CV7.6: bid 33 norm=1")
        self.assertEqual(snaps[34].norm_count, 2, "CV7.6: bid 34 norm=2")
        recover_bid = next((b for b, e in self.recorder.anchor_events if e == "RECOVER"), None)
        self.assertEqual(recover_bid, 35,
                         f"CV7.6: RECOVER 必须发生在 bid 35（信号丢失后的 3 连正常），实际 @ {recover_bid}")

    # ---- CV7.7（新维度：真实偏离穿透噪声二次降级） ----
    def test_c7_v7_second_real_downgrade(self):
        """CV7.7: 真实偏离穿透混合噪声 — 44,45,46 三连 → bid 46 二次 DOWNGRADE（正确再降级）"""
        self._run_scenario()
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[44].dev_count, 1, "CV7.7: bid 44 真实偏离 dev=1")
        self.assertEqual(snaps[45].dev_count, 2, "CV7.7: bid 45 真实偏离 dev=2")
        self.assertEqual(snaps[46].event_type, "DOWNGRADE",
                         "CV7.7: bid 46 真实偏离 3 连必须二次 DOWNGRADE")

    # ---- CV7.8（震荡判定：事件序列正确性） ----
    def test_c7_v8_event_sequence_no_oscillation(self):
        """CV7.8: 事件序列正确 — [DOWNGRADE@14, RECOVER@35, DOWNGRADE@46]，信号丢失窗口内无事件"""
        self._run_scenario()
        events = [(b, e) for b, e in self.recorder.anchor_events]
        self.assertEqual(
            events,
            [(14, "DOWNGRADE"), (35, "RECOVER"), (46, "DOWNGRADE")],
            f"CV7.8: 事件序列必须为 [@14⬇, @35⬆, @46⬇]，实际 {events}",
        )
        # 信号丢失窗口（30~32）内不得有任何 anchor 事件（无"误恢复→二次降级"震荡）
        signal_loss_events = [e for b, e in events if 30 <= b <= 32]
        self.assertEqual(signal_loss_events, [],
                         f"CV7.8: 信号丢失窗口(30-32)内不得有事件，实际 {signal_loss_events}")

    # ---- 演练报告输出 ----
    def test_c7_report_output(self):
        """C7-Report: 运行 C7 并输出 ASCII 时序 + 状态快照（供文档对齐）"""
        dev_map = self._run_scenario()

        # 数据质量快速自检
        events = [(b, e) for b, e in self.recorder.anchor_events]
        assert events == [(14, "DOWNGRADE"), (35, "RECOVER"), (46, "DOWNGRADE")], events
        snaps = self.snaps_by_bid
        for bid in (30, 31, 32):
            assert snaps[bid].norm_count == 0, f"bid={bid} 信号丢失 norm 必须为 0"
            assert snaps[bid].new_state == EngineState.DOWNGRADED.value, f"bid={bid} 必须 DOWNGRADED"

        print()
        LOGGER.info("=" * 92)
        LOGGER.info("C7 复杂故障组合演练报告：500ms延迟 + 10%丢包 + 90s抖动 + 信号丢失(30-32)")
        LOGGER.info("=" * 92)
        self.recorder.print_ascii_timeline(0, C7_END_BID)
        print()
        LOGGER.info("C7 关键状态快照：")
        self.recorder.print_state_snapshot_table(
            key_bids=[0, 6, 10, 12, 13, 14, 15, 20, 24, 28, 29, 30, 31, 32, 33, 34, 35, 36, 42, 44, 45, 46, 50],
        )
        LOGGER.info(
            "[C7 Summary] 事件序列: DOWNGRADE@14 → RECOVER@35 → DOWNGRADE@46 | "
            "信号丢失@30,31,32 跳过恢复（无震荡）| 真实偏离穿透全部噪声",
        )

    # ---- 日志埋点：完整故障阶段时序 + 状态汇总 ----
    def test_c7_fault_stage_trace(self):
        """C7-Trace: 输出详细故障阶段日志（逐步 + 阶段汇总），供排查潜在问题"""
        fault_logger = FaultInjectionLogger([FaultStage(st.name, st.start, st.end)
                                             for st in C7_STAGES])
        self._run_scenario(trace=True, fault_logger=fault_logger)

        # 阶段日志自检：8 个可命中阶段 + 二次冷却，全部进入
        entered = set(fault_logger._entered)
        expected = {s.name for s in C7_STAGES}
        self.assertSetEqual(entered, expected,
                            f"C7-Trace: 应进入全部 {len(expected)} 个阶段，实际 {entered}")

        # 信号丢失阶段必须记录"进入"，且无事件、无状态迁移
        sig_stage = next(s for s in fault_logger.stages if "信号丢失" in s.name)
        self.assertEqual(sig_stage.events, [],
                         f"C7-Trace: 信号丢失阶段不得有事件（实际 {sig_stage.events}）")

        # 输出阶段汇总
        print()
        fault_logger.summary()
        LOGGER.info("[C7-Trace] 事件序列锚点: %s", [(b, e) for b, e in self.recorder.anchor_events])


if __name__ == "__main__":
    unittest.main(verbosity=2)
