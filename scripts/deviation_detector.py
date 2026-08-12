"""
FSM 数据源信号适配器（DeviationDetector）

对应 docs/explanation/strategy/breakout-trading-strategy.md 附录 B.5 以及
deviation_detector.py §get_latest_data 方法的信号映射表：

  状态                                   | scrape_duration       | 输出  | signal_type
  ---------------------------------------|-----------------------|-------|------------
  正常（<30s 延迟）                      | < 30s                 | raw   | NORMAL
  F1 延迟误偏离（30s≤Δt<90s）             | 30s ≤ Δt < 90s        | True  | LATENCY
  F1 严重延迟误偏离（90s≤Δt<150s）        | 90s ≤ Δt < 150s       | True  | SEVERE_LATENCY
  P0 网络分区/无数据（≥150s 或 数据不可用）| data_available=False | None  | PARTITION
                                       或 Δt≥150s

注意：分区阈值（150s）必须**严格大于**严重延迟阈值（90s），避免 120s 延迟被误判为分区。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SignalType(Enum):
    NORMAL = "normal"
    LATENCY = "latency"
    SEVERE_LATENCY = "severe_latency"
    PARTITION = "partition"


@dataclass
class DeviationDetectorConfig:
    latency_threshold_seconds: float = 30.0
    severe_latency_threshold: float = 90.0
    partition_timeout_seconds: float = 150.0


class DeviationDetector:
    """数据源端信号适配器：网络状态 → Optional[bool]。"""

    def __init__(self, config: Optional[DeviationDetectorConfig] = None) -> None:
        self.config = config or DeviationDetectorConfig()
        self._signal_type: SignalType = SignalType.NORMAL
        assert self.config.partition_timeout_seconds > self.config.severe_latency_threshold, (
            f"配置错误：partition_timeout_seconds({self.config.partition_timeout_seconds}) "
            f"必须 > severe_latency_threshold({self.config.severe_latency_threshold})，"
            f"以确保 90s≤Δt<150s 的延迟被识别为 SEVERE_LATENCY 而非 PARTITION"
        )

    @property
    def signal_type(self) -> SignalType:
        return self._signal_type

    def get_latest_data(self, batch_id: int, scrape_duration: Optional[float],
                        data_available: bool, raw_deviation: Optional[bool]) -> Optional[bool]:
        """将网络/抓取状态映射为 FSM 输入信号（None/True/False）。

        :param batch_id: 批次 ID（仅用于日志）
        :param scrape_duration: 抓取耗时（秒）。None 表示未知（走 data_available 分支）
        :param data_available: 是否成功获得数据（False 直接映射为 P0 分区）
        :param raw_deviation: 真实的技术偏离结果（当网络正常时直接返回此值）
        """
        # P0 分区判定：无数据 或 抓取耗时超过分区超时
        is_partition = (not data_available) or (
            scrape_duration is not None
            and scrape_duration >= self.config.partition_timeout_seconds
        )
        if is_partition:
            self._signal_type = SignalType.PARTITION
            return None

        # 严重延迟误偏离（90s ≤ Δt < 150s）
        if scrape_duration is not None and scrape_duration >= self.config.severe_latency_threshold:
            self._signal_type = SignalType.SEVERE_LATENCY
            return True

        # 一般延迟误偏离（30s ≤ Δt < 90s）
        if scrape_duration is not None and scrape_duration >= self.config.latency_threshold_seconds:
            self._signal_type = SignalType.LATENCY
            return True

        # 网络正常：直接返回真实技术偏离结果（无偏离则 False）
        self._signal_type = SignalType.NORMAL
        if raw_deviation is not None:
            return raw_deviation
        return False
