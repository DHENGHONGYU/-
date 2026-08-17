"""
自适应熔断器 (adaptiveSourceOrchestrator)
========================================
对应 TypeScript: src/services/data-collector/adaptiveSourceOrchestrator.ts

核心职责：
1. 熔断器模式：每个数据源维护独立的失败计数器和熔断状态
2. 半开探测：熔断后定期发送探测请求，成功则恢复
3. 自适应降级：熔断时自动跳过死源，使用备用链
"""

import time
import asyncio
from dataclasses import dataclass, field
from typing import Dict, Optional
from enum import Enum


# ============================================================
# 数据类型
# ============================================================

class CircuitState(Enum):
    """熔断器状态"""
    CLOSED        = "closed"         # 正常（闭合）
    OPEN          = "open"           # 熔断（断开）
    HALF_OPEN     = "half_open"      # 半开（探测中）


@dataclass
class CircuitBreaker:
    """单个数据源的熔断器"""
    source_name: str
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: float = 0.0
    last_success_time: float = 0.0
    open_at: float = 0.0
    total_failures: int = 0
    total_successes: int = 0

    # 可配置参数
    failure_threshold: int = 5          # 连续失败阈值
    recovery_timeout: float = 60.0      # 熔断恢复超时（秒）
    half_open_max_requests: int = 1     # 半开状态最大探测请求数


@dataclass
class CircuitConfig:
    """熔断器全局配置"""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    half_open_max_requests: int = 1
    enabled: bool = True


# ============================================================
# 自适应熔断编排器
# ============================================================

class AdaptiveSourceOrchestrator:
    """
    自适应熔断编排器

    对应 TypeScript adaptiveSourceOrchestrator:
    - canExecute(sourceName): 检查数据源是否可用
    - recordSuccess(sourceName): 记录成功，重置熔断器
    - recordFailure(sourceName): 记录失败，可能触发熔断
    - getAvailableSources(dimCode): 获取可用数据源列表（过滤已熔断的）
    """

    def __init__(self, config: Optional[CircuitConfig] = None):
        self._config = config or CircuitConfig()
        self._breakers: Dict[str, CircuitBreaker] = {}

    def _ensure_breaker(self, source_name: str) -> CircuitBreaker:
        """确保熔断器存在"""
        if source_name not in self._breakers:
            self._breakers[source_name] = CircuitBreaker(
                source_name=source_name,
                failure_threshold=self._config.failure_threshold,
                recovery_timeout=self._config.recovery_timeout,
                half_open_max_requests=self._config.half_open_max_requests,
            )
        return self._breakers[source_name]

    def can_execute(self, source_name: str) -> bool:
        """
        检查数据源是否可以执行

        对应 TypeScript: adaptiveSourceOrchestrator.canExecute(sourceName)

        逻辑：
        - CLOSED: 可以执行
        - OPEN: 检查是否超过恢复超时，超过则转为 HALF_OPEN
        - HALF_OPEN: 允许有限探测请求
        """
        if not self._config.enabled:
            return True

        breaker = self._ensure_breaker(source_name)

        if breaker.state == CircuitState.CLOSED:
            return True

        if breaker.state == CircuitState.OPEN:
            elapsed = time.time() - breaker.open_at
            if elapsed >= breaker.recovery_timeout:
                breaker.state = CircuitState.HALF_OPEN
                return True
            return False

        # HALF_OPEN: 允许探测
        return True

    def record_success(self, source_name: str) -> None:
        """记录成功，重置熔断器"""
        breaker = self._ensure_breaker(source_name)
        breaker.failure_count = 0
        breaker.last_success_time = time.time()
        breaker.total_successes += 1

        if breaker.state != CircuitState.CLOSED:
            breaker.state = CircuitState.CLOSED

    def record_failure(self, source_name: str) -> None:
        """
        记录失败，可能触发熔断

        对应 TypeScript: adaptiveSourceOrchestrator.recordFailure(sourceName)
        """
        breaker = self._ensure_breaker(source_name)
        breaker.failure_count += 1
        breaker.last_failure_time = time.time()
        breaker.total_failures += 1

        if breaker.state == CircuitState.HALF_OPEN:
            # 半开状态探测失败 → 立即熔断
            breaker.state = CircuitState.OPEN
            breaker.open_at = time.time()
        elif breaker.state == CircuitState.CLOSED:
            if breaker.failure_count >= breaker.failure_threshold:
                breaker.state = CircuitState.OPEN
                breaker.open_at = time.time()

    def get_available_sources(self, fallback_chain: list[str]) -> list[str]:
        """
        获取可用数据源列表（过滤已熔断的源）

        对应 TypeScript: 熔断器介入降级链选择
        """
        return [s for s in fallback_chain if self.can_execute(s)]

    def get_breaker_status(self) -> dict:
        """获取所有熔断器状态（用于监控）"""
        return {
            name: {
                "state": b.state.value,
                "failure_count": b.failure_count,
                "total_failures": b.total_failures,
                "total_successes": b.total_successes,
                "open_at": b.open_at if b.state == CircuitState.OPEN else None,
            }
            for name, b in self._breakers.items()
        }

    def reset_all(self) -> None:
        """重置所有熔断器"""
        for breaker in self._breakers.values():
            breaker.state = CircuitState.CLOSED
            breaker.failure_count = 0


# ============================================================
# 装饰器：自动熔断保护
# ============================================================

def with_circuit_breaker(orchestrator: AdaptiveSourceOrchestrator, source_name: str):
    """
    熔断保护装饰器

    用法:
        @with_circuit_breaker(orchestrator, "tushare")
        async def fetch_from_tushare(symbol: str):
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            if not orchestrator.can_execute(source_name):
                raise RuntimeError(f"数据源 {source_name} 已熔断")

            try:
                result = await func(*args, **kwargs)
                orchestrator.record_success(source_name)
                return result
            except Exception as e:
                orchestrator.record_failure(source_name)
                raise e
        return wrapper
    return decorator