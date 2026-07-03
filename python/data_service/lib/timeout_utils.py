"""
@module lib/timeout_utils
@lifecycle @Global
@description 超时控制工具 — 线程+Queue 模式，用于不支持 timeout 参数的第三方库

@remarks
## 背景
AKShare 等第三方库不支持 timeout 参数，网络阻塞时无限等待。
使用 threading.Thread + queue.Queue 实现外部超时控制。

## 核心功能
- call_with_timeout: 带超时的函数调用
- TimeoutError: 自定义超时异常

## 风险提示
- daemon=True 的线程无法被强制终止，超时后仍在后台运行
- 适用于"放弃等待"场景，不适用于"必须终止"场景
- 长时间运行的僵尸线程会占用资源，建议配合进程级超时

@see 技术复盘_v2.1回归测试修复_2026-07-03.md 第三章
"""

import queue
import threading
import logging
from typing import Callable, TypeVar, ParamSpec

logger = logging.getLogger(__name__)

T = TypeVar("T")
P = ParamSpec("P")


class TimeoutError(Exception):
    """函数调用超时异常"""

    def __init__(self, timeout: float, func_name: str = ""):
        self.timeout = timeout
        self.func_name = func_name
        super().__init__(
            f"Function {func_name or '<anonymous>'} timeout after {timeout}s"
        )


def call_with_timeout(
    func: Callable[P, T],
    *args: P.args,
    timeout: float = 8.0,
    **kwargs: P.kwargs,
) -> T:
    """
    带超时控制的函数调用（线程+Queue 模式）

    适用于不支持 timeout 参数的第三方库（如 AKShare）。

    Args:
        func: 待调用的函数
        timeout: 超时秒数（默认 8 秒）
        *args: 传给 func 的位置参数
        **kwargs: 传给 func 的关键字参数

    Returns:
        func 的返回值

    Raises:
        TimeoutError: 超时
        Exception: func 抛出的原始异常

    Example:
        >>> import akshare as ak
        >>> df = call_with_timeout(
        ...     ak.stock_zh_a_spot_em,
        ...     timeout=8.0,
        ... )
        >>> # 超时场景
        >>> try:
        ...     df = call_with_timeout(ak.slow_func, timeout=2.0)
        ... except TimeoutError as e:
        ...     print(f"调用超时: {e}")
    """
    result_queue: queue.Queue = queue.Queue()
    func_name = getattr(func, "__name__", "<anonymous>")

    def _worker():
        try:
            result = func(*args, **kwargs)
            result_queue.put(("ok", result))
        except Exception as e:
            result_queue.put(("err", e))

    t = threading.Thread(target=_worker, daemon=True, name=f"timeout-{func_name}")
    t.start()
    t.join(timeout=timeout)

    if t.is_alive():
        # 超时（worker 仍在运行）
        logger.warning(
            "[timeout_utils] 函数超时 func=%s timeout=%ss",
            func_name, timeout,
        )
        raise TimeoutError(timeout, func_name)

    status, payload = result_queue.get_nowait()
    if status == "ok":
        return payload
    else:
        raise payload


def call_with_timeout_and_retry(
    func: Callable[P, T],
    *args: P.args,
    timeout: float = 8.0,
    max_retries: int = 1,
    backoff_base: float = 0.5,
    retryable_checker: Callable[[Exception], bool] = None,
    **kwargs: P.kwargs,
) -> T:
    """
    带超时 + 重试的函数调用

    Args:
        func: 待调用的函数
        timeout: 单次调用超时秒数
        max_retries: 最大重试次数（默认 1）
        backoff_base: 指数退避基数（默认 0.5s）
        retryable_checker: 判断异常是否可重试的函数
        *args, **kwargs: 传给 func 的参数

    Returns:
        func 的返回值

    Raises:
        最后一次异常（超时或 func 异常）

    Example:
        >>> df = call_with_timeout_and_retry(
        ...     ak.stock_zh_a_daily,
        ...     symbol="sh600519",
        ...     timeout=8.0,
        ...     max_retries=1,
        ... )
    """
    import time

    func_name = getattr(func, "__name__", "<anonymous>")
    last_exception: Exception = None  # type: ignore

    def _default_retryable(e: Exception) -> bool:
        """默认：网络异常 + 超时可重试"""
        if isinstance(e, TimeoutError):
            return True
        error_type = type(e).__name__
        return error_type in (
            "ConnectionError", "TimeoutError", "RemoteDisconnected",
            "ConnectionResetError", "OSError",
        )

    checker = retryable_checker or _default_retryable

    for attempt in range(1, max_retries + 2):
        try:
            result = call_with_timeout(func, *args, timeout=timeout, **kwargs)
            if attempt > 1:
                logger.info(
                    "[timeout_utils] 重试成功 func=%s attempt=%d/%d",
                    func_name, attempt, max_retries + 1,
                )
            return result
        except Exception as e:
            last_exception = e
            retryable = checker(e)
            logger.warning(
                "[timeout_utils] 调用失败 func=%s attempt=%d/%d error=%s: %s retryable=%s",
                func_name, attempt, max_retries + 1,
                type(e).__name__, str(e)[:100], retryable,
            )
            if not retryable or attempt > max_retries:
                break
            # 指数退避：0.5s, 1s, 2s...
            backoff = backoff_base * (2 ** (attempt - 1))
            logger.info("[timeout_utils] 指数退避 %.1fs 后重试...", backoff)
            time.sleep(backoff)

    raise last_exception


__all__ = ["TimeoutError", "call_with_timeout", "call_with_timeout_and_retry"]
