"""
@module lib/redis_circuit_breaker
@description Redis 连接熔断器 + 自动重试策略。

## 设计模式
采用经典的 Circuit Breaker 模式，三态切换：
- CLOSED(关闭)：正常状态，请求直接透传到 Redis
- OPEN(打开)：Redis 连续失败达阈值，熔断一段时间直接降级
- HALF_OPEN(半开)：冷却期后允许少量请求试探 Redis 是否恢复

## 自动恢复
- 指数退避：重试间隔 = base * 2^attempt（上限 max_delay）
- 周期性探活：后台线程定时 ping Redis，成功则自动关闭熔断器
- 渐进恢复：半开状态下成功次数达阈值才完全关闭

## 监控指标
- 失败计数、成功率、熔断器状态
- 最近一次失败时间、最近一次成功时间
- 降级次数统计

## 配置项（环境变量）
- REDIS_CB_FAILURE_THRESHOLD: 连续失败阈值（默认 5）
- REDIS_CB_RECOVERY_TIMEOUT: 冷却时间（秒，默认 30）
- REDIS_CB_HALF_OPEN_MAX_REQUESTS: 半开试探请求数（默认 3）
- REDIS_CB_SUCCESS_THRESHOLD: 连续成功恢复阈值（默认 3）
- REDIS_CB_MAX_RETRY_DELAY: 最大重试间隔（秒，默认 60）

@see lib/redis_cache.py (使用方)
"""

import os
import time
import threading
import logging
from typing import Callable, Optional
from enum import Enum

logger = logging.getLogger("v9-redis-cb")


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpenError(Exception):
    """熔断器打开时抛出的异常。"""
    pass


class RedisCircuitBreaker:
    """
    Redis 连接熔断器。

    用法:
        cb = RedisCircuitBreaker()
        with cb.protect("sector_scores"):
            redis_client.set(key, value)

    或带重试:
        result = cb.execute_with_retry(
            "sector_scores",
            lambda: redis_client.get(key),
            fallback=lambda: memory_cache.get(key),
        )
    """

    def __init__(
        self,
        failure_threshold: int = None,
        recovery_timeout: float = None,
        half_open_max_requests: int = None,
        success_threshold: int = None,
        max_retry_delay: float = None,
    ):
        self._failure_threshold = failure_threshold or int(
            os.environ.get("REDIS_CB_FAILURE_THRESHOLD", "5")
        )
        self._recovery_timeout = recovery_timeout or float(
            os.environ.get("REDIS_CB_RECOVERY_TIMEOUT", "30")
        )
        self._half_open_max_requests = half_open_max_requests or int(
            os.environ.get("REDIS_CB_HALF_OPEN_MAX_REQUESTS", "3")
        )
        self._success_threshold = success_threshold or int(
            os.environ.get("REDIS_CB_SUCCESS_THRESHOLD", "3")
        )
        self._max_retry_delay = max_retry_delay or float(
            os.environ.get("REDIS_CB_MAX_RETRY_DELAY", "60")
        )

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._last_success_time: Optional[float] = None
        self._opened_at: Optional[float] = None
        self._half_open_requests = 0
        self._degrade_count = 0
        self._total_calls = 0
        self._total_failures = 0

        self._lock = threading.Lock()
        self._probe_thread: Optional[threading.Thread] = None
        self._probe_stop_event = threading.Event()

    # ------------------------------------------------------------------
    # 状态管理
    # ------------------------------------------------------------------

    @property
    def state(self) -> CircuitState:
        return self._state

    @property
    def is_open(self) -> bool:
        return self._state == CircuitState.OPEN

    @property
    def is_half_open(self) -> bool:
        return self._state == CircuitState.HALF_OPEN

    @property
    def is_closed(self) -> bool:
        return self._state == CircuitState.CLOSED

    def _check_state(self) -> None:
        """检查并更新熔断器状态（线程安全）。"""
        if self._state == CircuitState.OPEN:
            now = time.time()
            if self._opened_at and (now - self._opened_at) >= self._recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_requests = 0
                self._success_count = 0
                logger.info(
                    "[cb] 熔断器 OPEN -> HALF_OPEN，冷却结束，允许试探请求"
                )

    def _record_success(self, operation: str) -> None:
        """记录成功。"""
        with self._lock:
            self._total_calls += 1
            self._last_success_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self._success_threshold:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    self._opened_at = None
                    logger.info(
                        "[cb] 熔断器 HALF_OPEN -> CLOSED，连续 %d 次成功，恢复 Redis",
                        self._success_threshold,
                    )
            elif self._state == CircuitState.OPEN:
                pass  # OPEN 状态下的成功不应发生（会被拦截）

    def _record_failure(self, operation: str, error: Exception) -> None:
        """记录失败。"""
        with self._lock:
            self._total_calls += 1
            self._total_failures += 1
            self._last_failure_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                self._opened_at = time.time()
                self._failure_count = self._failure_threshold
                logger.warning(
                    "[cb] 熔断器 HALF_OPEN -> OPEN，试探失败，重新熔断: op=%s err=%s",
                    operation, error,
                )
            elif self._state == CircuitState.CLOSED:
                self._failure_count += 1
                if self._failure_count >= self._failure_threshold:
                    self._state = CircuitState.OPEN
                    self._opened_at = time.time()
                    self._degrade_count += 1
                    logger.warning(
                        "[cb] 熔断器 CLOSED -> OPEN，连续 %d 次失败: op=%s err=%s",
                        self._failure_count, operation, error,
                    )

    def _allow_request(self) -> bool:
        """判断当前是否允许请求透传。"""
        with self._lock:
            self._check_state()
            if self._state == CircuitState.CLOSED:
                return True
            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_requests < self._half_open_max_requests:
                    self._half_open_requests += 1
                    return True
                return False
            return False

    # ------------------------------------------------------------------
    # 核心 API
    # ------------------------------------------------------------------

    def protect(self, operation: str = "redis") -> "CircuitBreakerContext":
        """
        返回一个上下文管理器，用于 with 语句。

        Usage:
            with cb.protect("set_scores"):
                redis.set(key, value)

        Raises:
            CircuitBreakerOpenError: 熔断器打开时
        """
        return CircuitBreakerContext(self, operation)

    def execute(
        self,
        operation: str,
        action: Callable,
        fallback: Optional[Callable] = None,
        *args,
        **kwargs,
    ):
        """
        执行操作，熔断器打开时走 fallback。

        Args:
            operation: 操作名称（用于日志）
            action: 主要操作（Redis 调用）
            fallback: 降级操作（内存缓存等）

        Returns:
            操作结果

        Raises:
            CircuitBreakerOpenError: 熔断器打开且无 fallback 时
        """
        if not self._allow_request():
            logger.debug("[cb] 熔断器 OPEN，跳过请求: op=%s", operation)
            if fallback is not None:
                logger.info("[cb] 执行降级: op=%s", operation)
                return fallback(*args, **kwargs)
            raise CircuitBreakerOpenError(
                f"Redis circuit breaker is OPEN for '{operation}'"
            )

        try:
            result = action(*args, **kwargs)
            self._record_success(operation)
            return result
        except Exception as e:
            self._record_failure(operation, e)
            if fallback is not None:
                logger.info("[cb] 执行降级: op=%s err=%s", operation, e)
                return fallback(*args, **kwargs)
            raise

    def execute_with_retry(
        self,
        operation: str,
        action: Callable,
        fallback: Optional[Callable] = None,
        max_retries: int = 3,
        base_delay: float = 1.0,
        *args,
        **kwargs,
    ):
        """
        带自动重试的执行（指数退避）。

        Args:
            operation: 操作名称
            action: 主要操作
            fallback: 降级操作
            max_retries: 最大重试次数
            base_delay: 基础重试间隔（秒）

        Returns:
            操作结果
        """
        last_error = None

        for attempt in range(max_retries + 1):
            if attempt > 0:
                delay = min(base_delay * (2 ** (attempt - 1)), self._max_retry_delay)
                logger.info(
                    "[cb] 重试 %d/%d: op=%s delay=%.1fs",
                    attempt, max_retries, operation, delay,
                )
                time.sleep(delay)

            try:
                if not self._allow_request():
                    logger.info(
                        "[cb] 熔断打开，走降级: op=%s attempt=%d",
                        operation, attempt,
                    )
                    if fallback is not None:
                        return fallback(*args, **kwargs)
                    raise CircuitBreakerOpenError(
                        f"Redis circuit breaker OPEN for '{operation}'"
                    )

                result = action(*args, **kwargs)
                self._record_success(operation)
                if attempt > 0:
                    logger.info(
                        "[cb] 重试成功: op=%s attempt=%d", operation, attempt,
                    )
                return result

            except CircuitBreakerOpenError:
                if fallback is not None:
                    return fallback(*args, **kwargs)
                raise

            except Exception as e:
                last_error = e
                self._record_failure(operation, e)
                logger.warning(
                    "[cb] 尝试 %d/%d 失败: op=%s err=%s",
                    attempt + 1, max_retries + 1, operation, e,
                )

        if fallback is not None:
            logger.info(
                "[cb] 重试耗尽，走最终降级: op=%s", operation,
            )
            return fallback(*args, **kwargs)

        if last_error:
            raise last_error
        return None

    # ------------------------------------------------------------------
    # 后台探活
    # ------------------------------------------------------------------

    def start_probe(self, ping_fn: Callable, interval: float = 10.0) -> None:
        """
        启动后台探活线程。

        Args:
            ping_fn: Redis ping 函数
            interval: 探活间隔（秒）
        """
        if self._probe_thread and self._probe_thread.is_alive():
            return

        self._probe_stop_event.clear()

        def _probe_loop():
            logger.info("[cb] 后台探活线程启动: interval=%.1fs", interval)
            while not self._probe_stop_event.is_set():
                try:
                    ok = ping_fn()
                    if ok:
                        with self._lock:
                            if self._state in (CircuitState.OPEN, CircuitState.HALF_OPEN):
                                self._state = CircuitState.CLOSED
                                self._failure_count = 0
                                self._success_count = 0
                                self._opened_at = None
                                logger.info(
                                    "[cb] 探活成功，熔断器恢复 CLOSED"
                                )
                except Exception as e:
                    pass

                self._probe_stop_event.wait(interval)

        self._probe_thread = threading.Thread(target=_probe_loop, daemon=True)
        self._probe_thread.start()

    def stop_probe(self) -> None:
        """停止后台探活线程。"""
        self._probe_stop_event.set()
        if self._probe_thread:
            self._probe_thread.join(timeout=5)
            self._probe_thread = None
            logger.info("[cb] 后台探活线程已停止")

    # ------------------------------------------------------------------
    # 监控
    # ------------------------------------------------------------------

    def get_stats(self) -> dict:
        """获取熔断器状态快照。"""
        with self._lock:
            now = time.time()
            recovery_remaining = 0.0
            if self._state == CircuitState.OPEN and self._opened_at:
                recovery_remaining = max(
                    0, self._recovery_timeout - (now - self._opened_at)
                )

            success_rate = (
                ((self._total_calls - self._total_failures) / self._total_calls * 100)
                if self._total_calls > 0 else 0.0
            )

            return {
                "state": self._state.value,
                "failure_count": self._failure_count,
                "success_count": self._success_count,
                "failure_threshold": self._failure_threshold,
                "success_threshold": self._success_threshold,
                "recovery_timeout": self._recovery_timeout,
                "recovery_remaining": round(recovery_remaining, 1),
                "half_open_requests": self._half_open_requests,
                "half_open_max": self._half_open_max_requests,
                "degrade_count": self._degrade_count,
                "total_calls": self._total_calls,
                "total_failures": self._total_failures,
                "success_rate": round(success_rate, 1),
                "last_failure_time": (
                    time.strftime("%H:%M:%S", time.localtime(self._last_failure_time))
                    if self._last_failure_time else None
                ),
                "last_success_time": (
                    time.strftime("%H:%M:%S", time.localtime(self._last_success_time))
                    if self._last_success_time else None
                ),
                "opened_at": (
                    time.strftime("%H:%M:%S", time.localtime(self._opened_at))
                    if self._opened_at else None
                ),
            }

    def reset(self) -> None:
        """手动重置熔断器。"""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._half_open_requests = 0
            self._opened_at = None
            logger.info("[cb] 熔断器已手动重置为 CLOSED")


class CircuitBreakerContext:
    """上下文管理器，供 with cb.protect() 使用。"""

    def __init__(self, cb: RedisCircuitBreaker, operation: str):
        self._cb = cb
        self._operation = operation
        self._allowed = False

    def __enter__(self):
        if not self._cb._allow_request():
            logger.debug(
                "[cb] 熔断器 OPEN，阻断请求: op=%s", self._operation
            )
            raise CircuitBreakerOpenError(
                f"Redis circuit breaker OPEN for '{self._operation}'"
            )
        self._allowed = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_val is None:
            self._cb._record_success(self._operation)
        elif isinstance(exc_val, CircuitBreakerOpenError):
            pass
        else:
            self._cb._record_failure(self._operation, exc_val)
        return False


# ------------------------------------------------------------------
# 全局单例
# ------------------------------------------------------------------

_default_cb: Optional[RedisCircuitBreaker] = None
_cb_lock = threading.Lock()


def get_circuit_breaker() -> RedisCircuitBreaker:
    """获取全局熔断器单例。"""
    global _default_cb
    if _default_cb is None:
        with _cb_lock:
            if _default_cb is None:
                _default_cb = RedisCircuitBreaker()
    return _default_cb


__all__ = [
    "RedisCircuitBreaker",
    "CircuitBreakerContext",
    "CircuitBreakerOpenError",
    "CircuitState",
    "get_circuit_breaker",
]