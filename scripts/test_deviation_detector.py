"""
v4.9 数据源信号适配器 — 单元测试

聚焦 deviation_detector.py 的信号映射边界：
  - 正常(<30s) → raw / NORMAL
  - 一般延迟(30s≤Δt<90s) → True / LATENCY
  - 严重延迟(90s≤Δt<150s) → True / SEVERE_LATENCY
  - 分区(无数据 或 Δt≥150s) → None / PARTITION
  - 配置不变量：partition_timeout > severe_latency_threshold

运行：
  python -m unittest scripts.test_deviation_detector -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from deviation_detector import (  # noqa: E402
    DeviationDetector,
    DeviationDetectorConfig,
    SignalType,
)


class TestDeviationDetectorConfig(unittest.TestCase):
    """配置不变量：分区阈值必须严格大于严重延迟阈值。"""

    def test_valid_config(self) -> None:
        d = DeviationDetector()
        self.assertGreater(d.config.partition_timeout_seconds, d.config.severe_latency_threshold)

    def test_invalid_config_raises(self) -> None:
        """120s 延迟不得被误判为分区 → 分区阈值必须 > 严重延迟阈值。"""
        bad = DeviationDetectorConfig(
            latency_threshold_seconds=30.0,
            severe_latency_threshold=150.0,   # 违反约束
            partition_timeout_seconds=90.0,   # 分区 < 严重延迟
        )
        with self.assertRaises(AssertionError):
            DeviationDetector(bad)


class TestDeviationDetectorNormal(unittest.TestCase):
    """网络正常（Δt<30s 或耗时未知）：直接返回真实偏离结果。"""

    def setUp(self) -> None:
        self.d = DeviationDetector()

    def test_normal_returns_raw_true(self) -> None:
        out = self.d.get_latest_data(0, 0.5, True, True)
        self.assertIs(out, True)
        self.assertEqual(self.d.signal_type, SignalType.NORMAL)

    def test_normal_returns_raw_false(self) -> None:
        out = self.d.get_latest_data(0, 0.5, True, False)
        self.assertIs(out, False)
        self.assertEqual(self.d.signal_type, SignalType.NORMAL)

    def test_normal_raw_none_falls_back_false(self) -> None:
        out = self.d.get_latest_data(0, 0.5, True, None)
        self.assertIs(out, False)

    def test_normal_unknown_duration_uses_raw(self) -> None:
        """scrape_duration=None 且数据可用 → 直接采用 raw_deviation。"""
        out = self.d.get_latest_data(0, None, True, True)
        self.assertIs(out, True)


class TestDeviationDetectorLatency(unittest.TestCase):
    """一般延迟（30s ≤ Δt < 90s）：输出 True / LATENCY。"""

    def setUp(self) -> None:
        self.d = DeviationDetector()

    def test_latency_just_at_30s(self) -> None:
        out = self.d.get_latest_data(0, 30.0, True, False)
        self.assertIs(out, True)
        self.assertEqual(self.d.signal_type, SignalType.LATENCY)

    def test_latency_mid_range(self) -> None:
        out = self.d.get_latest_data(0, 60.0, True, False)
        self.assertIs(out, True)
        self.assertEqual(self.d.signal_type, SignalType.LATENCY)

    def test_below_30s_is_normal(self) -> None:
        out = self.d.get_latest_data(0, 29.999, True, True)
        self.assertIs(out, True)  # 未达延迟阈值，返回真实偏离
        self.assertEqual(self.d.signal_type, SignalType.NORMAL)


class TestDeviationDetectorSevereLatency(unittest.TestCase):
    """严重延迟（90s ≤ Δt < 150s）：输出 True / SEVERE_LATENCY。"""

    def setUp(self) -> None:
        self.d = DeviationDetector()

    def test_severe_at_90s(self) -> None:
        out = self.d.get_latest_data(0, 90.0, True, False)
        self.assertIs(out, True)
        self.assertEqual(self.d.signal_type, SignalType.SEVERE_LATENCY)

    def test_severe_mid_range(self) -> None:
        out = self.d.get_latest_data(0, 120.0, True, False)
        self.assertIs(out, True)  # 120s 应判为严重延迟而非分区
        self.assertEqual(self.d.signal_type, SignalType.SEVERE_LATENCY)

    def test_severe_before_partition(self) -> None:
        out = self.d.get_latest_data(0, 149.999, True, False)
        self.assertIs(out, True)
        self.assertEqual(self.d.signal_type, SignalType.SEVERE_LATENCY)


class TestDeviationDetectorPartition(unittest.TestCase):
    """分区（无数据 或 Δt ≥ 150s）：输出 None / PARTITION。"""

    def setUp(self) -> None:
        self.d = DeviationDetector()

    def test_no_data_available(self) -> None:
        out = self.d.get_latest_data(0, 0.5, False, True)
        self.assertIsNone(out)
        self.assertEqual(self.d.signal_type, SignalType.PARTITION)

    def test_partition_at_150s(self) -> None:
        out = self.d.get_latest_data(0, 150.0, True, False)
        self.assertIsNone(out)
        self.assertEqual(self.d.signal_type, SignalType.PARTITION)

    def test_partition_beyond_150s(self) -> None:
        out = self.d.get_latest_data(0, 300.0, True, False)
        self.assertIsNone(out)
        self.assertEqual(self.d.signal_type, SignalType.PARTITION)


class TestDeviationDetectorStateTransition(unittest.TestCase):
    """signal_type 随最近一次调用更新。"""

    def test_state_tracks_latest_call(self) -> None:
        self.d = DeviationDetector()
        self.d.get_latest_data(0, 0.5, True, False)
        self.assertEqual(self.d.signal_type, SignalType.NORMAL)
        self.d.get_latest_data(0, 60.0, True, False)
        self.assertEqual(self.d.signal_type, SignalType.LATENCY)
        self.d.get_latest_data(0, False, False, False)
        self.assertEqual(self.d.signal_type, SignalType.PARTITION)


if __name__ == "__main__":
    unittest.main()
