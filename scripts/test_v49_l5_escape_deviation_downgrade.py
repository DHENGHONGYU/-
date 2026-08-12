"""
v4.9 L5a 自动降级 FSM — 核心单元测试

聚焦 v49_l5_escape_deviation_downgrade.py 的纯逻辑边界：
  - ConsecutiveDeviationDetector / ConsecutiveNormalDetector：True 累加 / False 清零 / None 跳过
  - DowngradeEngine：NORMAL → COOLDOWN → DOWNGRADED → NORMAL 状态迁移 + P0 None 信号语义

运行：
  python -m unittest scripts.test_v49_l5_escape_deviation_downgrade -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from v49_l5_escape_deviation_downgrade import (  # noqa: E402
    DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER,
    DOWNGRADE_COOLDOWN_BATCHES,
    RECOVER_CONSECUTIVE_NORMAL,
    ConsecutiveDeviationDetector,
    ConsecutiveNormalDetector,
    DowngradeEngine,
    EngineState,
)


class TestConsecutiveDeviationDetector(unittest.TestCase):
    """连续偏离检测器：True 累加，False 清零，None 跳过（P0 改进）。"""

    def setUp(self) -> None:
        self.d = ConsecutiveDeviationDetector()

    def test_true_accumulates(self) -> None:
        for sig in (True, True):
            self.d.update(sig)
        self.assertEqual(self.d.consecutive_count, 2)

    def test_false_resets(self) -> None:
        self.d.update(True)
        self.d.update(True)
        self.d.update(False)
        self.assertEqual(self.d.consecutive_count, 0)

    def test_none_skips_preserving_count(self) -> None:
        """P0 核心：None（分区/信号丢失）不中断计数。"""
        self.d.update(True)
        self.d.update(None)
        self.assertEqual(self.d.consecutive_count, 1, "None 不得清零也不得累加")
        self.d.update(True)
        self.assertEqual(self.d.consecutive_count, 2)

    def test_threshold_default(self) -> None:
        self.assertEqual(self.d.threshold, DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER)

    def test_reset(self) -> None:
        self.d.update(True)
        self.d.update(True)
        self.d.reset()
        self.assertEqual(self.d.consecutive_count, 0)


class TestConsecutiveNormalDetector(unittest.TestCase):
    """连续正常检测器：正常累加，偏离清零，None 跳过。"""

    def setUp(self) -> None:
        self.d = ConsecutiveNormalDetector()

    def test_normal_accumulates(self) -> None:
        self.d.update(True)
        self.d.update(True)
        self.assertEqual(self.d.consecutive_count, 2)

    def test_deviation_resets(self) -> None:
        self.d.update(True)
        self.d.update(False)
        self.assertEqual(self.d.consecutive_count, 0)

    def test_none_skips(self) -> None:
        self.d.update(True)
        self.d.update(None)
        self.assertEqual(self.d.consecutive_count, 1, "None 不得清零")

    def test_threshold_default(self) -> None:
        self.assertEqual(self.d.threshold, RECOVER_CONSECUTIVE_NORMAL)


class TestDowngradeEngineNormal(unittest.TestCase):
    """NORMAL 态：三连偏离触发降级；False 清零；None 跳过。"""

    def setUp(self) -> None:
        self.e = DowngradeEngine()

    def test_initial_state(self) -> None:
        self.assertEqual(self.e.state, EngineState.NORMAL)
        self.assertFalse(self.e.use_scheme_a)
        self.assertEqual(self.e.cooldown_remaining, 0)

    def test_normal_false_no_event(self) -> None:
        state, event = self.e.step(0, False)
        self.assertEqual(state, EngineState.NORMAL.value)
        self.assertIsNone(event)
        self.assertEqual(self.e.dev_detector.consecutive_count, 0)

    def test_normal_none_skips(self) -> None:
        """P0 核心：NORMAL 态 None 信号跳过偏离检测，保留计数。"""
        self.e.step(0, True)
        state, event = self.e.step(1, None)
        self.assertEqual(state, EngineState.NORMAL.value)
        self.assertIsNone(event)
        self.assertEqual(self.e.dev_detector.consecutive_count, 1, "None 不得清零 NORMAL 计数")

    def test_three_deviation_triggers_downgrade(self) -> None:
        self.e.step(0, True)
        self.e.step(1, True)
        state, event = self.e.step(2, True)
        self.assertEqual(event.event_type, "DOWNGRADE" if event else None)
        self.assertEqual(state, EngineState.COOLDOWN.value)
        self.assertEqual(self.e.cooldown_remaining, DOWNGRADE_COOLDOWN_BATCHES)
        self.assertEqual(self.e.dev_detector.consecutive_count, 0, "降级后偏离计数重置")

    def test_two_deviation_not_enough(self) -> None:
        self.e.step(0, True)
        self.e.step(1, True)
        state, _ = self.e.step(2, False)  # 中途清零
        self.assertEqual(state, EngineState.NORMAL.value)


class TestDowngradeEngineCooldown(unittest.TestCase):
    """COOLDOWN 态：所有信号忽略，仅时间驱动冷却递减，结束后进入 DOWNGRADED。"""

    def setUp(self) -> None:
        self.e = DowngradeEngine()
        for _ in range(DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER):
            self.e.step(0, True)  # 触发降级

    def test_enter_cooldown(self) -> None:
        self.assertEqual(self.e.state, EngineState.COOLDOWN)
        self.assertEqual(self.e.cooldown_remaining, DOWNGRADE_COOLDOWN_BATCHES)

    def test_cooldown_ignores_all_signals(self) -> None:
        """冷却期内 True/False/None 均不影响状态（仅消耗冷却批次）。"""
        bids = [(1, True), (2, False), (3, None)]
        for bid, sig in bids:
            state, event = self.e.step(bid, sig)
            self.assertEqual(state, EngineState.COOLDOWN.value)
            self.assertIsNone(event)

    def test_cooldown_decrements_then_downgraded(self) -> None:
        """冷却消耗 DOWNGRADE_COOLDOWN_BATCHES 步后进入 DOWNGRADED。"""
        for i in range(DOWNGRADE_COOLDOWN_BATCHES - 1):
            self.e.step(i, False)
            self.assertEqual(self.e.state, EngineState.COOLDOWN)
        state, event = self.e.step(99, False)  # 第 15 步 → 冷却结束
        self.assertEqual(state, EngineState.DOWNGRADED.value)
        self.assertEqual(self.e.cooldown_remaining, 0)
        self.assertIsNone(event)  # 内部过渡不产生外部事件


class TestDowngradeEngineDowngraded(unittest.TestCase):
    """DOWNGRADED 态：None 跳过恢复、True 忽略、False 累加恢复计数。"""

    def setUp(self) -> None:
        self.e = DowngradeEngine()
        for _ in range(DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER):
            self.e.step(0, True)
        for i in range(DOWNGRADE_COOLDOWN_BATCHES):
            self.e.step(i, False)
        self.assertEqual(self.e.state, EngineState.DOWNGRADED)

    def test_downgraded_none_skips_recovery(self) -> None:
        """P0 核心：DOWNGRADED 态 None（分区/信号丢失）跳过恢复，不误恢复。"""
        state, event = self.e.step(100, None)
        self.assertEqual(state, EngineState.DOWNGRADED.value)
        self.assertIsNone(event)
        self.assertEqual(self.e.norm_detector.consecutive_count, 0, "None 不得触发恢复计数")

    def test_downgraded_true_ignored(self) -> None:
        state, event = self.e.step(100, True)
        self.assertEqual(state, EngineState.DOWNGRADED.value)
        self.assertIsNone(event)

    def test_three_normal_recovers(self) -> None:
        self.e.step(100, False)
        self.e.step(101, False)
        state, event = self.e.step(102, False)
        self.assertEqual(event.event_type, "RECOVER" if event else None)
        self.assertEqual(state, EngineState.NORMAL.value)
        self.assertEqual(self.e.norm_detector.consecutive_count, 0, "恢复后正常计数重置")

    def test_deviation_during_downgraded_preserves_normal(self) -> None:
        """DOWNGRADED 态 True 为 no-op：不触发事件，且不清零恢复计数（容错矩阵）。"""
        self.e.step(100, False)
        self.assertEqual(self.e.norm_detector.consecutive_count, 1)
        state, event = self.e.step(101, True)
        self.assertEqual(state, EngineState.DOWNGRADED.value)
        self.assertIsNone(event)
        self.assertEqual(self.e.norm_detector.consecutive_count, 1, "DOWNGRADED 态偏离为 no-op，保留恢复计数")


class TestDowngradeEngineSchemeAFlag(unittest.TestCase):
    """use_scheme_a 标志：非 NORMAL 态为 True，回到 NORMAL 为 False。"""

    def test_flag_follows_state(self) -> None:
        e = DowngradeEngine()
        self.assertFalse(e.use_scheme_a)
        for _ in range(DEFAULT_CONSECUTIVE_DEVIATION_TRIGGER):
            e.step(0, True)
        self.assertTrue(e.use_scheme_a, "进入 COOLDOWN 应置 use_scheme_a=True")
        for i in range(DOWNGRADE_COOLDOWN_BATCHES):
            e.step(i, False)
        self.assertTrue(e.use_scheme_a, "DOWNGRADED 态 use_scheme_a 仍为 True")
        for _ in range(RECOVER_CONSECUTIVE_NORMAL):
            e.step(0, False)
        self.assertFalse(e.use_scheme_a, "恢复回 NORMAL 应置 use_scheme_a=False")


if __name__ == "__main__":
    unittest.main()
