"""
v4.9 L5a 自动降级 FSM — 集成测试基础设施（StepSnapshot + LifecycleRecorder）

与 test_c5_mixed_f1_p0_scenario.py、test_c7_complex_fault_combination.py 和
export_c5_csv.py 共享使用。
"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent))

from v49_l5_escape_deviation_downgrade import (  # noqa: E402
    DowngradeEngine,
    EngineState,
    L5A_THEORETICAL_ESCAPE,
    L5A_TOLERANCE_PCT,
    DOWNGRADE_COOLDOWN_BATCHES,
    DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER,
    RECOVER_CONSECUTIVE_NORMAL,
    _init_logger,
)

LOGGER = _init_logger("INFO")
LOGGER.name = "v49_l5_integration"


@dataclass
class StepSnapshot:
    bid: int
    is_deviated: Optional[bool]
    prev_state: str
    new_state: str
    use_scheme_a: bool
    cooldown_left: int
    dev_count: int
    norm_count: int
    event_type: Optional[str]
    event_note: Optional[str]


class LifecycleRecorder:
    """记录 FSM 全生命周期：逐步快照 + 锚点事件 + 内部状态迁移。"""

    def __init__(self) -> None:
        self.snaps: List[StepSnapshot] = []
        self.anchor_events: List[Tuple[int, str]] = []
        self.internal_state_changes: List[Tuple[int, str, str]] = []

    def capture(self, bid: int, is_deviated: Optional[bool], prev_state: str,
                engine: DowngradeEngine, event, extra_note: Optional[str] = None) -> None:
        new_state_val = engine.state.value
        snap = StepSnapshot(
            bid,
            is_deviated,
            prev_state,
            new_state_val,
            engine.use_scheme_a,
            engine.cooldown_remaining,
            engine.dev_detector.consecutive_count,
            engine.norm_detector.consecutive_count,
            event.event_type if event else None,
            extra_note if extra_note else (event.reason if event else None),
        )
        self.snaps.append(snap)

        if event:
            self.anchor_events.append((bid, event.event_type))

        if prev_state == EngineState.COOLDOWN.value and new_state_val == EngineState.DOWNGRADED.value:
            self.internal_state_changes.append((bid, "COOLDOWN", "DOWNGRADED"))

        if prev_state != new_state_val:
            LOGGER.info(
                "[Integration] ★ state change bid=%s | %s → %s | event=%s | note=%s",
                bid, prev_state, new_state_val, snap.event_type, snap.event_note,
            )

    def print_ascii_timeline(self, window_start: int, window_end: int) -> None:
        LOGGER.info("=" * 92)
        LOGGER.info(
            "ASCII TIME-LINE（bid %s ~ %s）：D=偏离 · C=冷却 · G=降级 · N=正常 · ⬇=降级 · ⬆=恢复 · ⇲=COOL→DG",
            window_start, min(window_end, self.snaps[-1].bid),
        )
        LOGGER.info("=" * 92)

        end = min(window_end, self.snaps[-1].bid)
        header = "     " + "".join(str(b)[-1] for b in range(window_start, end + 1))
        LOGGER.info(header)

        markers: List[str] = []
        for s in self.snaps:
            if s.bid < window_start or s.bid > window_end:
                continue
            ch = "."
            if s.is_deviated is True:
                ch = "D"
            elif s.new_state == EngineState.COOLDOWN.value:
                ch = "C"
            elif s.new_state == EngineState.DOWNGRADED.value:
                ch = "G"
            elif s.new_state == EngineState.NORMAL.value:
                ch = "N"
            if s.event_type == "DOWNGRADE":
                ch = "⬇"
            elif s.event_type == "RECOVER":
                ch = "⬆"
            if s.prev_state == EngineState.COOLDOWN.value and s.new_state == EngineState.DOWNGRADED.value:
                ch = "⇲"
            markers.append(ch)

        LOGGER.info("     " + "".join(markers))
        LOGGER.info("  图例：D=偏离(DEV)  C=COOLDOWN  G=DOWNGRADED  N=NORMAL  ⬇=DOWNGRADE  ⬆=RECOVER  ⇲=COOL→DG 内部过渡")

    def print_state_snapshot_table(self, key_bids: List[int]) -> None:
        header = (
            f"{'BID':>4} {'STATE':>12} {'USE_A':>6} {'COOL_L':>7} "
            f"{'DEV_CNT':>8} {'NORM_CNT':>9} {'DEV?':>6} {'EVENT':>10} NOTE"
        )
        LOGGER.info("-" * len(header))
        LOGGER.info(header)
        LOGGER.info("-" * len(header))
        for s in self.snaps:
            if s.bid not in key_bids:
                continue
            dev_str = "NONE" if s.is_deviated is None else str(s.is_deviated).upper()
            LOGGER.info(
                f"{s.bid:>4} {s.new_state:>12} {str(s.use_scheme_a):>6} {s.cooldown_left:>7} "
                f"{s.dev_count:>8} {s.norm_count:>9} {dev_str:>6} {(s.event_type or '-'):>10} {s.event_note or ''}"
            )
        LOGGER.info("-" * len(header))
