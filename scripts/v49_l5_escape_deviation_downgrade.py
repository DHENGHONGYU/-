"""
v4.9 L5a 自动降级 FSM（有限状态机）— P0 无信号改进版

状态机：NORMAL → COOLDOWN → DOWNGRADED → NORMAL
核心改进（P0）：支持 Optional[bool] 信号，None 表示"无数据（网络分区/信号丢失）"，
在 NORMAL/DOWNGRADED 态跳过检测器更新（保留计数），避免"误恢复→二次降级"震荡。

信号-延迟映射（由上游 deviation_detector 生成）：
  Δt < 30s            → is_deviated=False（正常）
  30s ≤ Δt < 90s      → is_deviated=True（陈旧/延迟，误偏离）
  Δt ≥ 90s            → is_deviated=True（严重延迟，误偏离）
  分区/信号丢失        → is_deviated=None（P0 改进信号）

FSM 容错矩阵：
  | 状态        | True            | False            | None                        |
  | NORMAL      | dev_count++     | dev_count=0      | 跳过（保留 dev_count）       |
  | COOLDOWN    | 忽略（no-op）   | 忽略（no-op）    | 仅时间驱动 cooldown_left--    |
  | DOWNGRADED  | 忽略（no-op）   | norm_count++     | 跳过（保留 norm_count）       |

运行（示例）：
  python -c "from v49_l5_escape_deviation_downgrade import DowngradeEngine, EngineState; e=DowngradeEngine(); print(e.step(0, True))"
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple

DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER = 3
RECOVER_CONSECUTIVE_NORMAL = 3
DOWNGRADE_COOLDOWN_BATCHES = 15

L5A_THEORETICAL_ESCAPE = 0.05
L5A_TOLERANCE_PCT = 2.0


def _init_logger(level: str = "INFO") -> logging.Logger:
    """初始化控制台 logger（时间 | 级别 | 名称 | 消息）。"""
    logger = logging.getLogger("v49_l5_fsm")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        ))
        logger.addHandler(handler)
    logger.setLevel(getattr(logging, level.upper()))
    logger.propagate = False
    return logger


class EngineState(Enum):
    NORMAL = "NORMAL"
    COOLDOWN = "COOLDOWN"
    DOWNGRADED = "DOWNGRADED"


@dataclass
class DowngradeEvent:
    event_type: str
    reason: str


class ConsecutiveDeviationDetector:
    """连续偏离检测器：True 累加，False 清零，None 跳过（P0 改进）。"""

    def __init__(self, threshold: int = DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER) -> None:
        self.threshold = threshold
        self.consecutive_count = 0

    def update(self, is_deviated: Optional[bool]) -> None:
        if is_deviated is None:
            return None
        if is_deviated:
            self.consecutive_count += 1
            return None
        self.consecutive_count = 0
        return None

    def reset(self) -> None:
        self.consecutive_count = 0
        return None


class ConsecutiveNormalDetector:
    """连续正常检测器：正常累加，偏离清零，None 跳过（P0 改进）。"""

    def __init__(self, threshold: int = RECOVER_CONSECUTIVE_NORMAL) -> None:
        self.threshold = threshold
        self.consecutive_count = 0

    def update(self, is_normal: Optional[bool]) -> None:
        if is_normal is None:
            return None
        if is_normal:
            self.consecutive_count += 1
            return None
        self.consecutive_count = 0
        return None

    def reset(self) -> None:
        self.consecutive_count = 0
        return None


class DowngradeEngine:
    """L5a 自动降级 FSM 引擎。step() 为唯一入口。"""

    def __init__(self) -> None:
        self.state = EngineState.NORMAL
        self.use_scheme_a = False
        self.cooldown_remaining = 0
        self.dev_detector = ConsecutiveDeviationDetector()
        self.norm_detector = ConsecutiveNormalDetector()
        self.logger = _init_logger("INFO")
        self.logger.name = "v49_l5_fsm"

    def step(self, batch_id: int, is_deviated: Optional[bool]) -> Tuple[str, Optional[DowngradeEvent]]:
        """处理一批数据信号，返回 (新状态字符串, 事件或 None)。"""
        event: Optional[DowngradeEvent] = None
        prev_state = self.state.value

        if self.state == EngineState.NORMAL:
            event = self._step_normal(batch_id, is_deviated)
        elif self.state == EngineState.COOLDOWN:
            self._step_cooldown(batch_id, is_deviated)
        elif self.state == EngineState.DOWNGRADED:
            event = self._step_downgraded(batch_id, is_deviated)

        self.use_scheme_a = self.state != EngineState.NORMAL
        return (self.state.value, event)

    def _step_normal(self, batch_id: int, is_deviated: Optional[bool]) -> Optional[DowngradeEvent]:
        if is_deviated is None:
            self.logger.info(
                "[FSM.step] batch=%s | STATE=NORMAL | is_deviated=None → 跳过偏离检测（无数据信号）",
                batch_id,
            )
            return None

        self.dev_detector.update(is_deviated)
        count = self.dev_detector.consecutive_count

        if is_deviated:
            self.logger.info(
                "[DevDetector] 更新 @ batch=%s | is_deviated=True | count=%s/%s",
                batch_id, count, self.dev_detector.threshold,
            )
        else:
            self.logger.info(
                "[DevDetector] 清零 @ batch=%s | is_deviated=False → count 重置为 0",
                batch_id,
            )

        if count >= self.dev_detector.threshold:
            event = DowngradeEvent("DOWNGRADE", "连续3次偏离触发降级")
            self.state = EngineState.COOLDOWN
            self.cooldown_remaining = DOWNGRADE_COOLDOWN_BATCHES
            self.dev_detector.reset()
            self.norm_detector.reset()
            self.logger.info(
                "★ TRIGGER ★ batch=%s | 连续 %s 次偏离 ≥ 阈值 %s",
                batch_id, count, self.dev_detector.threshold,
            )
            self.logger.info(
                "★ STATE TRANSITION ★ batch=%s | NORMAL → COOLDOWN | 原因=连续3次偏离触发降级 | dev_count=0 | norm_count=0",
                batch_id,
            )
            return event
        return None

    def _step_cooldown(self, batch_id: int, is_deviated: Optional[bool]) -> None:
        self.logger.info(
            "[FSM.step] batch=%s | STATE=COOLDOWN | cooldown_left=%s | is_deviated=%s | 忽略信号",
            batch_id, self.cooldown_remaining, is_deviated,
        )
        self.cooldown_remaining -= 1
        if self.cooldown_remaining <= 0:
            self.cooldown_remaining = 0
            self.state = EngineState.DOWNGRADED
            self.norm_detector.reset()
            self.logger.info(
                "[NormDetector] 重置 @ batch=%s | prev_count=0 | reason=COOLDOWN→DOWNGRADED，重置正常检测器待恢复判定",
                batch_id,
            )
            self.logger.info(
                "★ STATE TRANSITION ★ batch=%s | COOLDOWN → DOWNGRADED | 原因=(内部冷却结束) | dev_count=0 | norm_count=0",
                batch_id,
            )
        return None

    def _step_downgraded(self, batch_id: int, is_deviated: Optional[bool]) -> Optional[DowngradeEvent]:
        if is_deviated is None:
            self.logger.info(
                "[FSM.step] batch=%s | STATE=DOWNGRADED | is_deviated=None → 跳过恢复检测（无数据信号）",
                batch_id,
            )
            return None
        if is_deviated is True:
            self.logger.info(
                "[FSM.step] batch=%s | STATE=DOWNGRADED → 检查恢复 | is_deviated=True → 偏离忽略（no-op）",
                batch_id,
            )
            return None

        self.norm_detector.update(True)
        count = self.norm_detector.consecutive_count
        self.logger.info(
            "[NormDetector] 更新 @ batch=%s | is_normal=True | count=%s/%s",
            batch_id, count, self.norm_detector.threshold,
        )
        self.logger.info(
            "[FSM.step] batch=%s | STATE=DOWNGRADED → 检查恢复 | is_normal=True | norm_count=%s/%s",
            batch_id, count, self.norm_detector.threshold,
        )

        if count >= self.norm_detector.threshold:
            event = DowngradeEvent("RECOVER", "连续3次正常恢复方案C")
            self.state = EngineState.NORMAL
            self.dev_detector.reset()
            self.norm_detector.reset()
            self.logger.info(
                "★ RECOVER ★ batch=%s | 连续 3 次正常 ≥ 阈值 3",
                batch_id,
            )
            self.logger.info(
                "★ STATE TRANSITION ★ batch=%s | DOWNGRADED → NORMAL | 原因=连续3次正常恢复方案C | dev_count=0 | norm_count=0",
                batch_id,
            )
            return event
        return None


if __name__ == "__main__":
    eng = DowngradeEngine()
    for b, sig in ((0, False), (1, True), (2, True), (3, True)):
        st, ev = eng.step(b, sig)
        print(f"bid={b} sig={sig} -> {st} {ev.event_type if ev else ''}")
