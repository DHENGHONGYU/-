"""
v4.9 C5 混合场景 + C6 极端网络抖动混沌工程自动化集成测试

C5 场景：F1 延迟(Δt=120s) → P0 分区(无数据) → F1' 残留(Δt=60s) → OK 恢复
   - 7 个验证点（V1~V6 + 完整演练报告打印）

C6 场景：500ms 基础延迟 + 10% 丢包(bid%10==0→None) + Δt=90s 抖动(bid%5==0→True)
   - 7 个验证点（CV6.1~CV6.7）

运行：
  python scripts/test_c5_mixed_f1_p0_scenario.py -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Dict, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent))

from v49_l5_downgrade_integration_test import (  # noqa: E402
    DowngradeEngine,
    EngineState,
    LifecycleRecorder,
    LOGGER,
    DOWNGRADE_COOLDOWN_BATCHES,
)

# ===============================================================
# C5 混合故障场景（F1 延迟 → P0 分区 → F1' 残留 → OK 恢复）
# ===============================================================

C5_END_BID = 32

# 故障注入计划（bid → is_deviated）：
#   F1 延迟(bid 3~5, True) → 冷却期(bid 6~19, False) → 冷却结束(bid 20, False)
#   → P0 分区(bid 21~23, None) → F1' 残留(bid 24~26, True) → 完全恢复(bid 27~29, False)
#   → 稳定(bid 30~32, False)
C5_DEV_MAP_BASE: Dict[int, Optional[bool]] = {
    **{b: False for b in range(0, 3)},    # 0,1,2 初始 OK
    **{b: True for b in range(3, 6)},     # 3,4,5 F1 延迟误偏离
    **{b: False for b in range(6, 20)},   # 6..19 冷却期
    20: False,                             # 冷却结束 → DOWNGRADED
    21: None, 22: None, 23: None,          # P0 分区（信号丢失，跳过恢复）
    24: True, 25: True, 26: True,          # F1' 残留误偏离（DOWNGRADED 态忽略）
    27: False, 28: False, 29: False,       # 完全恢复 → RECOVER@29
    30: False, 31: False, 32: False,       # 稳定运行
}


def build_c5_deviation_map() -> Dict[int, Optional[bool]]:
    """C5 场景 is_deviated 映射（返回独立副本，避免测试间污染）。"""
    return dict(C5_DEV_MAP_BASE)


# ===============================================================
# C6 极端网络抖动场景（500ms 基础延迟 + 10% 丢包 + 90s 抖动 + 双真实偏离窗口）
# ===============================================================

C6_BASE_LATENCY_MS = 0.5
C6_PACKET_LOSS_RATE = 0.1
C6_JITTER_EVERY_N = 5
C6_JITTER_LATENCY_SECONDS = 90.0
C6_SIMULATION_END_BID = 45
C6_TRUE_DEV_WINDOWS: Tuple[Tuple[int, int], ...] = ((10, 12), (30, 32))


def _c6_is_packet_loss(bid: int) -> bool:
    return bid % 10 == 0


def _c6_has_jitter(bid: int) -> bool:
    return bid % C6_JITTER_EVERY_N == 0


def build_c6_deviation_map() -> Dict[int, Optional[bool]]:
    """C6 场景 is_deviated 映射。优先级：丢包 > 真实偏离 > 抖动 > 正常。"""
    m: Dict[int, Optional[bool]] = {}
    for bid in range(C6_SIMULATION_END_BID + 1):
        if _c6_is_packet_loss(bid):
            m[bid] = None  # 丢包 → None（不中断计数）
        elif any(s <= bid <= e for s, e in C6_TRUE_DEV_WINDOWS):
            m[bid] = True  # 真实偏离
        elif _c6_has_jitter(bid):
            m[bid] = True  # 抖动 → 误偏离
        else:
            m[bid] = False
    return m


def _build_c6_strong_deviation_map() -> Dict[int, Optional[bool]]:
    """C6 强化版：在基础 C6 上强制 bid 13 为真实偏离，构成 11,12,13 三连真实偏离触发降级。"""
    m = build_c6_deviation_map()
    m[13] = True
    return m


# ===============================================================
# TestC5MixedScenario：C5 混合故障 7 个验证点
# ===============================================================

class TestC5MixedScenario(unittest.TestCase):
    """C5 混合故障（F1 延迟 + P0 分区 + F1' 残留 + OK 恢复）7 个验证点。"""

    def _run_scenario(self, dev_map: Dict[int, Optional[bool]]):
        self.engine = DowngradeEngine()
        self.recorder = LifecycleRecorder()
        for bid in sorted(dev_map):
            is_dev = dev_map[bid]
            prev = self.engine.state.value
            _, event = self.engine.step(bid, is_dev)
            extra = None
            if prev == EngineState.COOLDOWN.value and self.engine.state == EngineState.DOWNGRADED:
                extra = "冷却期结束（混合故障背景下仍按时过渡）"
            self.recorder.capture(bid, is_dev, prev, self.engine, event, extra)
        return dev_map, self.recorder

    @property
    def snaps_by_bid(self):
        return {s.bid: s for s in self.recorder.snaps}

    # ---- V1 ----
    def test_c5_v1_f1_downgrade_anchor(self):
        """V1: F1 延迟误降级 — bid 3,4,5 三连偏离 → bid 5 DOWNGRADE → COOLDOWN"""
        self._run_scenario(build_c5_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[3].dev_count, 1, "V1: bid 3 dev=1")
        self.assertEqual(snaps[4].dev_count, 2, "V1: bid 4 dev=2")
        self.assertEqual(snaps[5].event_type, "DOWNGRADE", "V1: bid 5 必须 DOWNGRADE")
        self.assertEqual(snaps[5].new_state, EngineState.COOLDOWN.value,
                         "V1: bid 5 后进入 COOLDOWN")
        self.assertEqual(snaps[6].cooldown_left, DOWNGRADE_COOLDOWN_BATCHES - 1,
                         "V1: 降级后首批 cooldown_left=14")

    # ---- V2 ----
    def test_c5_v2_cooldown_ends(self):
        """V2: 冷却结束 — bid 20（5+15）进入 DOWNGRADED"""
        self._run_scenario(build_c5_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[20].new_state, EngineState.DOWNGRADED.value,
                         f"V2: bid 20 必须 DOWNGRADED，实际={snaps[20].new_state}")
        self.assertEqual(snaps[20].cooldown_left, 0, "V2: 冷却结束 cooldown_left=0")

    # ---- V3 ----
    def test_c5_v3_p0_partition_skips_recovery(self):
        """V3: P0 分区跳过恢复 — bid 21,22,23 norm 恒 0，保持 DOWNGRADED 不误恢复"""
        self._run_scenario(build_c5_deviation_map())
        snaps = self.snaps_by_bid
        for bid in (21, 22, 23):
            self.assertEqual(snaps[bid].norm_count, 0,
                             f"V3: bid={bid} P0 分区 norm_count 必须为 0（不误恢复）")
            self.assertEqual(snaps[bid].new_state, EngineState.DOWNGRADED.value,
                             f"V3: bid={bid} P0 分区必须保持 DOWNGRADED")
            self.assertIsNone(snaps[bid].event_type,
                              f"V3: bid={bid} 分区不得产生 RECOVER（实际={snaps[bid].event_type}）")

    # ---- V4 ----
    def test_c5_v4_f1_prime_no_second_downgrade(self):
        """V4: F1' 残留不二次降级 — bid 24,25,26 误偏离在 DOWNGRADED 态被忽略"""
        self._run_scenario(build_c5_deviation_map())
        snaps = self.snaps_by_bid
        for bid in (24, 25, 26):
            self.assertEqual(snaps[bid].new_state, EngineState.DOWNGRADED.value,
                             f"V4: bid={bid} F1' 残留不得二次降级（实际={snaps[bid].new_state}）")

    # ---- V5 ----
    def test_c5_v5_recover_anchor(self):
        """V5: 完全恢复 — bid 27,28,29 三连正常 → bid 29 RECOVER → NORMAL"""
        self._run_scenario(build_c5_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[27].norm_count, 1, "V5: bid 27 norm=1")
        self.assertEqual(snaps[28].norm_count, 2, "V5: bid 28 norm=2")
        recover_bid = next((b for b, e in self.recorder.anchor_events if e == "RECOVER"), None)
        self.assertEqual(recover_bid, 29,
                         f"V5: RECOVER 必须发生在 bid 29，实际 @ {recover_bid}")
        self.assertEqual(snaps[29].new_state, EngineState.NORMAL.value,
                         "V5: bid 29 RECOVER 后回到 NORMAL")

    # ---- V6 ----
    def test_c5_v6_no_oscillation(self):
        """V6: 无震荡 — 全程仅 1 次 DOWNGRADE + 1 次 RECOVER"""
        self._run_scenario(build_c5_deviation_map())
        events = [e for _, e in self.recorder.anchor_events]
        downgrade_count = events.count("DOWNGRADE")
        recover_count = events.count("RECOVER")
        self.assertEqual(downgrade_count, 1, f"V6: 全程仅 1 次 DOWNGRADE（实际 {downgrade_count}）")
        self.assertEqual(recover_count, 1, f"V6: 全程仅 1 次 RECOVER（实际 {recover_count}）")

    # ---- 演练报告 ----
    def test_c5_report_output(self):
        """C5-Report: 运行 C5 并输出 ASCII 时序 + 状态快照（供文档对齐）"""
        dev_map = self._run_scenario(build_c5_deviation_map())

        events = [(b, e) for b, e in self.recorder.anchor_events]
        assert events == [(5, "DOWNGRADE"), (29, "RECOVER")], events

        print()
        LOGGER.info("=" * 92)
        LOGGER.info("C5 混合故障演练报告：F1 延迟 → P0 分区 → F1' 残留 → OK 恢复")
        LOGGER.info("=" * 92)
        self.recorder.print_ascii_timeline(0, C5_END_BID)
        print()
        LOGGER.info("C5 关键状态快照：")
        self.recorder.print_state_snapshot_table(
            key_bids=[0, 3, 4, 5, 6, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32],
        )
        LOGGER.info("[C5 Summary] 事件序列: DOWNGRADE@5 → RECOVER@29 | "
                    "P0 分区@21,22,23 跳过恢复（无震荡）| F1' 残留@24,25,26 不二次降级")


# ===============================================================
# TestC6ExtremeNetworkJitter：C6 极端网络抖动 7 个验证点
# ===============================================================

class TestC6ExtremeNetworkJitter(unittest.TestCase):
    """C6 极端网络抖动（500ms 延迟 + 10% 丢包 + 90s 抖动 + 双真实偏离窗口）7 个验证点。"""

    def _run_scenario(self, dev_map: Dict[int, Optional[bool]]):
        self.engine = DowngradeEngine()
        self.recorder = LifecycleRecorder()
        for bid in sorted(dev_map):
            is_dev = dev_map[bid]
            prev = self.engine.state.value
            _, event = self.engine.step(bid, is_dev)
            extra = None
            if prev == EngineState.COOLDOWN.value and self.engine.state == EngineState.DOWNGRADED:
                extra = "冷却期结束（极端抖动背景下仍按时过渡）"
            self.recorder.capture(bid, is_dev, prev, self.engine, event, extra)
        return dev_map, self.recorder

    @property
    def snaps_by_bid(self):
        return {s.bid: s for s in self.recorder.snaps}

    # ---- CV6.1 ----
    def test_c6_v1_packet_loss_no_reset(self):
        """CV6.1: 丢包(None)不中断计数 — bid 10 丢包后 bid 11 真实偏离仍 dev=1"""
        self._run_scenario(_build_c6_strong_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[11].dev_count, 1,
                         "CV6.1: bid 11 真实偏离 dev_count=1（不被 bid 10 丢包清零）")

    # ---- CV6.2 ----
    def test_c6_v2_real_deviation_through_jitter(self):
        """CV6.2: 真实偏离穿透抖动 — bid 11,12,13 三连 → bid 13 DOWNGRADE"""
        self._run_scenario(_build_c6_strong_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[11].dev_count, 1, "CV6.2: bid 11 dev=1")
        self.assertEqual(snaps[12].dev_count, 2, "CV6.2: bid 12 dev=2")
        self.assertEqual(snaps[13].event_type, "DOWNGRADE",
                         "CV6.2: bid 13 真实偏离 3 连必须触发 DOWNGRADE")
        self.assertEqual(snaps[13].new_state, EngineState.COOLDOWN.value,
                         "CV6.2: bid 13 后进入 COOLDOWN")

    # ---- CV6.3 ----
    def test_c6_v3_first_downgrade_anchor(self):
        """CV6.3: 首次降级锚点 — bid 13 DOWNGRADE → COOLDOWN（cooldown_left=14）"""
        self._run_scenario(_build_c6_strong_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[13].event_type, "DOWNGRADE",
                         f"CV6.3: bid 13 event=DOWNGRADE，实际={snaps[13].event_type}")
        self.assertEqual(snaps[14].cooldown_left, DOWNGRADE_COOLDOWN_BATCHES - 1,
                         "CV6.3: 降级后首批 cooldown_left=14")

    # ---- CV6.4 ----
    def test_c6_v4_cooldown_jitter_no_effect(self):
        """CV6.4: 冷却期抖动(15,25)+丢包(20)全忽略，保持 COOLDOWN 无事件"""
        self._run_scenario(_build_c6_strong_deviation_map())
        snaps = self.snaps_by_bid
        for bid in (14, 15, 20, 25):
            s = snaps[bid]
            self.assertEqual(s.new_state, EngineState.COOLDOWN.value,
                             f"CV6.4: bid {bid} 冷却期状态={s.new_state}（应为 COOLDOWN）")
            self.assertIsNone(s.event_type,
                              f"CV6.4: bid {bid} 冷却期内无事件（实际={s.event_type}）")

    # ---- CV6.5 ----
    def test_c6_v5_cooldown_to_downgraded_boundary(self):
        """CV6.5: 冷却结束正确过渡 — bid 28（13+15）进入 DOWNGRADED"""
        self._run_scenario(_build_c6_strong_deviation_map())
        snaps = self.snaps_by_bid
        self.assertEqual(snaps[28].new_state, EngineState.DOWNGRADED.value,
                         f"CV6.5: bid 28 必须为 DOWNGRADED，实际={snaps[28].new_state}")
        self.assertEqual(snaps[28].cooldown_left, 0, "CV6.5: 冷却结束 cooldown_left=0")

    # ---- CV6.6 ----
    def test_c6_v6_recover_through_jitter(self):
        """CV6.6: 抖动背景下恢复 — 真实偏离窗口(30-32)在 DOWNGRADED 态被忽略、丢包(30)被跳过，
        故 norm=29→1/33→2/34→3，bid 34 RECOVER（而非误判 38）"""
        dev_map = _build_c6_strong_deviation_map()
        _, recorder = self._run_scenario(dev_map)
        snaps_by_bid = {s.bid: s for s in recorder.snaps}
        self.assertEqual(snaps_by_bid[29].norm_count, 1, "CV6.6: bid 29 norm=1")
        self.assertEqual(snaps_by_bid[30].norm_count, 1, "CV6.6: bid 30 丢包跳过，norm 保持 1")
        self.assertEqual(snaps_by_bid[31].norm_count, 1,
                         "CV6.6: bid 31 真实偏离在 DOWNGRADED 态被忽略，norm 保持 1")
        self.assertEqual(snaps_by_bid[33].norm_count, 2, "CV6.6: bid 33 norm=2")
        # bid 34 达到 3 连正常触发 RECOVER；快照在迁移后捕获，故 norm 归 0、状态回 NORMAL
        self.assertEqual(snaps_by_bid[34].event_type, "RECOVER",
                         "CV6.6: bid 34 必须触发 RECOVER")
        self.assertEqual(snaps_by_bid[34].new_state, EngineState.NORMAL.value,
                         "CV6.6: bid 34 RECOVER 后回到 NORMAL")
        recover_bid = next((b for b, e in recorder.anchor_events if e == "RECOVER"), None)
        self.assertEqual(recover_bid, 34,
                         f"CV6.6: RECOVER 必须发生在 bid 34（抖动/偏离/丢包叠加下仍正确恢复），实际 @ {recover_bid}")

    # ---- CV6.7 ----
    def test_c6_v7_no_extra_oscillation(self):
        """CV6.7: 无额外震荡 — 全程仅 1 次 DOWNGRADE + 1 次 RECOVER"""
        self._run_scenario(_build_c6_strong_deviation_map())
        events = [e for _, e in self.recorder.anchor_events]
        downgrade_count = events.count("DOWNGRADE")
        recover_count = events.count("RECOVER")
        self.assertEqual(downgrade_count, 1,
                         f"CV6.7: 全程仅 1 次 DOWNGRADE（实际 {downgrade_count}）")
        self.assertEqual(recover_count, 1,
                         f"CV6.7: 全程仅 1 次 RECOVER（实际 {recover_count}）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
