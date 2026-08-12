"""
v4.9 L5a 集成测试基础设施 — 单元测试

聚焦 v49_l5_downgrade_integration_test.py 的 LifecycleRecorder：
  - capture()：生成 StepSnapshot 字段正确性
  - anchor_events：仅在产生事件时记录
  - internal_state_changes：COOLDOWN→DOWNGRADED 内部过渡记录
  - extra_note 优先级：显式注释优先于 event.reason
  - 打印方法（ASCII 时序 / 快照表）冒烟测试

运行：
  python -m unittest scripts.test_v49_l5_downgrade_integration_test -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from v49_l5_downgrade_integration_test import (  # noqa: E402
    DowngradeEngine,
    EngineState,
    LifecycleRecorder,
    StepSnapshot,
)
from v49_l5_escape_deviation_downgrade import (  # noqa: E402
    DOWNGRADE_COOLDOWN_BATCHES,
)


def run_engine_with_recorder(signals) -> "tuple[DowngradeEngine, LifecycleRecorder]":
    """按信号序列驱动引擎并记录快照，返回 (engine, recorder)。"""
    engine = DowngradeEngine()
    recorder = LifecycleRecorder()
    for bid, sig in enumerate(signals):
        prev = engine.state.value
        _, event = engine.step(bid, sig)
        recorder.capture(bid, sig, prev, engine, event)
    return engine, recorder


class TestStepSnapshot(unittest.TestCase):
    """StepSnapshot 字段正确性。"""

    def test_fields_present(self) -> None:
        snap = StepSnapshot(
            bid=0, is_deviated=True, prev_state="NORMAL", new_state="COOLDOWN",
            use_scheme_a=True, cooldown_left=15, dev_count=0, norm_count=0,
            event_type="DOWNGRADE", event_note="连续3次偏离触发降级",
        )
        self.assertEqual(snap.bid, 0)
        self.assertIs(snap.is_deviated, True)
        self.assertEqual(snap.prev_state, "NORMAL")
        self.assertEqual(snap.new_state, "COOLDOWN")
        self.assertTrue(snap.use_scheme_a)
        self.assertEqual(snap.cooldown_left, 15)
        self.assertEqual(snap.event_type, "DOWNGRADE")


class TestLifecycleRecorderCapture(unittest.TestCase):
    """capture() 生成正确快照并记录锚点事件。"""

    def test_capture_normal_snapshot(self) -> None:
        engine = DowngradeEngine()
        recorder = LifecycleRecorder()
        _, event = engine.step(0, True)
        recorder.capture(0, True, "NORMAL", engine, event)
        snap = recorder.snaps[0]
        self.assertEqual(snap.bid, 0)
        self.assertEqual(snap.new_state, EngineState.NORMAL.value)
        self.assertFalse(snap.use_scheme_a)
        self.assertIsNone(snap.event_type)

    def test_capture_downgrade_records_anchor(self) -> None:
        engine, recorder = run_engine_with_recorder([True, True, True])
        self.assertIn((2, "DOWNGRADE"), recorder.anchor_events)
        self.assertEqual(recorder.snaps[2].new_state, EngineState.COOLDOWN.value)
        self.assertEqual(recorder.snaps[2].cooldown_left, DOWNGRADE_COOLDOWN_BATCHES)

    def test_anchor_events_only_on_event(self) -> None:
        engine, recorder = run_engine_with_recorder([False, False, False])
        self.assertEqual(recorder.anchor_events, [], "无事件时不应记录锚点")

    def test_internal_state_change_on_cooldown_end(self) -> None:
        """COOLDOWN→DOWNGRADED 内部过渡被记录，且无外部事件。"""
        signals = [True, True, True] + [False] * DOWNGRADE_COOLDOWN_BATCHES
        engine, recorder = run_engine_with_recorder(signals)
        # 降级@2，冷却 15 步结束 @ 2+15=17
        self.assertIn((17, "COOLDOWN", "DOWNGRADED"), recorder.internal_state_changes)
        # 最后一步无外部事件（内部过渡）
        self.assertIsNone(recorder.snaps[17].event_type)


class TestLifecycleRecorderExtraNote(unittest.TestCase):
    """extra_note 显式注释优先于 event.reason。"""

    def test_extra_note_overrides_reason(self) -> None:
        engine, recorder = run_engine_with_recorder([True, True, True])
        # 重新 capture 并传入显式注释
        engine2 = DowngradeEngine()
        rec2 = LifecycleRecorder()
        for bid, sig in enumerate([True, True, True]):
            prev = engine2.state.value
            _, event = engine2.step(bid, sig)
            rec2.capture(bid, sig, prev, engine2, event, extra_note="自定义注释")
        self.assertEqual(rec2.snaps[2].event_note, "自定义注释")

    def test_event_reason_used_when_no_extra_note(self) -> None:
        engine, recorder = run_engine_with_recorder([True, True, True])
        self.assertEqual(recorder.snaps[2].event_note, "连续3次偏离触发降级")


class TestLifecycleRecorderSmoke(unittest.TestCase):
    """打印方法不抛异常（冒烟）。"""

    def test_print_ascii_timeline(self) -> None:
        _, recorder = run_engine_with_recorder([True, True, True] + [False] * 20)
        recorder.print_ascii_timeline(0, 22)  # 不应抛异常

    def test_print_state_snapshot_table(self) -> None:
        _, recorder = run_engine_with_recorder([True, True, True] + [False] * 20)
        recorder.print_state_snapshot_table(key_bids=[0, 2, 17, 22])  # 不应抛异常


if __name__ == "__main__":
    unittest.main()
