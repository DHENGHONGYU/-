"""
@module lib/cache_utils
@lifecycle @Global
@description TTL + LRU 双重淘汰缓存工具

@remarks
## 背景
外部 API 频繁调用导致延迟累积，无缓存时 10 只股票 K线采集耗时 11.8s。
TTL + LRU 缓存使重复请求降至 17ms（-99.9%）。

## 核心功能
- TTL_LRUCache: TTL + LRU 双重淘汰缓存类
- cached: 方法/函数缓存装饰器
- CachedAPIClient: 带缓存的 API 客户端基类

## TTL 选择依据
- K线数据: 600s（10 分钟）
- 全市场行情: 300s（5 分钟）
- 财务指标: 1800s（30 分钟）
- 实时行情: 60s（1 分钟）

@see 技术复盘_v2.1回归测试修复_2026-07-03.md 第四章
"""

import time
import logging
from functools import wraps
from typing import Callable, TypeVar, Any, Optional

logger = logging.getLogger(__name__)

T = TypeVar("T")


class TTL_LRUCache:
    """
    TTL + LRU 双重淘汰缓存

    - TTL: 生存时间，过期自动失效
    - LRU: 最近最少使用，超容量时淘汰最旧

    Example:
        >>> cache = TTL_LRUCache(ttl=600.0, max_size=100)
        >>> cache.set("key1", value1)
        >>> cache.get("key1")  # 命中
        value1
        >>> # 600 秒后
        >>> cache.get("key1")  # 过期，返回 None
        None
    """

    def __init__(self, ttl: float, max_size: int = 100):
        """
        Args:
            ttl: 生存时间（秒）
            max_size: 最大缓存条目数
        """
        self.ttl = ttl
        self.max_size = max_size
        self._cache: dict[str, tuple[float, Any]] = {}
        self._hit_count = 0
        self._miss_count = 0

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存

        Args:
            key: 缓存键

        Returns:
            缓存值，未命中返回 None
        """
        if key in self._cache:
            ts, value = self._cache[key]
            age = time.time() - ts
            if age < self.ttl:
                self._hit_count += 1
                logger.debug(
                    "[cache] 命中 key=%s age=%.1fs ttl=%.1fs",
                    key, age, self.ttl,
                )
                return value
            else:
                # 过期，清除
                self._cache.pop(key, None)
                logger.debug("[cache] 过期清除 key=%s age=%.1fs", key, age)
        self._miss_count += 1
        return None

    def set(self, key: str, value: Any) -> None:
        """
        写入缓存，触发 LRU 淘汰

        Args:
            key: 缓存键
            value: 缓存值
        """
        self._cache[key] = (time.time(), value)

        # LRU 淘汰：超过 max_size 时清除最早的
        if len(self._cache) > self.max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][0])
            self._cache.pop(oldest_key, None)
            logger.debug(
                "[cache] LRU 淘汰 key=%s size=%d/%d",
                oldest_key, len(self._cache), self.max_size,
            )

    def invalidate(self, key: str) -> None:
        """手动失效单个缓存"""
        self._cache.pop(key, None)

    def clear(self) -> None:
        """清空所有缓存"""
        self._cache.clear()
        self._hit_count = 0
        self._miss_count = 0

    def stats(self) -> dict:
        """
        缓存统计

        Returns:
            包含 size/hit/miss/hit_rate 的字典
        """
        total = self._hit_count + self._miss_count
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "ttl": self.ttl,
            "hit_count": self._hit_count,
            "miss_count": self._miss_count,
            "hit_rate": (self._hit_count / total) if total > 0 else 0.0,
        }


def cached(
    ttl: float,
    max_size: int = 100,
    key_builder: Callable[..., str] = None,
):
    """
    函数缓存装饰器

    Args:
        ttl: 生存时间（秒）
        max_size: 最大缓存条目数
        key_builder: 自定义缓存键构造函数（默认用 args + kwargs）

    Returns:
        装饰器函数

    Example:
        >>> @cached(ttl=600.0, max_size=100)
        ... def fetch_kline(symbol, adjust):
        ...     return ak.stock_zh_a_daily(symbol=symbol, adjust=adjust)
        ...
        >>> df1 = fetch_kline("sh600519", "qfq")  # 未命中，调用 AKShare
        >>> df2 = fetch_kline("sh600519", "qfq")  # 命中，直接返回
    """
    cache = TTL_LRUCache(ttl=ttl, max_size=max_size)

    def _default_key_builder(*args, **kwargs) -> str:
        """默认缓存键：args + sorted(kwargs)"""
        kw_str = ",".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
        return f"{args}|{kw_str}"

    builder = key_builder or _default_key_builder

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = builder(*args, **kwargs)
            cached_value = cache.get(key)
            if cached_value is not None:
                return cached_value
            result = func(*args, **kwargs)
            if result is not None:
                cache.set(key, result)
            return result

        # 暴露 cache 供外部检查/清理
        wrapper._cache = cache  # type: ignore
        return wrapper

    return decorator


class CachedAPIClient:
    """
    带缓存的 API 客户端基类

    子类继承后，调用 _call_with_cache 方法自动缓存结果

    Example:
        >>> class AKShareClient(CachedAPIClient):
        ...     def get_kline(self, symbol, adjust):
        ...         return self._call_with_cache(
        ...             "kline", symbol, adjust,
        ...             ttl=600.0,
        ...             fetcher=lambda: ak.stock_zh_a_daily(symbol=symbol, adjust=adjust),
        ...         )
    """

    def __init__(self, default_ttl: float = 300.0, default_max_size: int = 100):
        self._caches: dict[str, TTL_LRUCache] = {}
        self._default_ttl = default_ttl
        self._default_max_size = default_max_size

    def _get_cache(self, namespace: str, ttl: float, max_size: int) -> TTL_LRUCache:
        """获取或创建命名空间缓存"""
        if namespace not in self._caches:
            self._caches[namespace] = TTL_LRUCache(ttl=ttl, max_size=max_size)
        return self._caches[namespace]

    def _call_with_cache(
        self,
        namespace: str,
        *key_args,
        fetcher: Callable[[], T],
        ttl: float = None,
        max_size: int = None,
    ) -> T:
        """
        带缓存的调用

        Args:
            namespace: 缓存命名空间
            key_args: 缓存键组成部分
            fetcher: 未命中时的数据获取函数
            ttl: TTL（默认用实例 default_ttl）
            max_size: 最大容量（默认用实例 default_max_size）

        Returns:
            缓存或新获取的值
        """
        cache = self._get_cache(
            namespace,
            ttl or self._default_ttl,
            max_size or self._default_max_size,
        )
        key = "|".join(str(a) for a in key_args)
        cached_value = cache.get(key)
        if cached_value is not None:
            return cached_value
        result = fetcher()
        if result is not None:
            cache.set(key, result)
        return result

    def cache_stats(self) -> dict[str, dict]:
        """获取所有命名空间的缓存统计"""
        return {ns: c.stats() for ns, c in self._caches.items()}

    def clear_cache(self, namespace: str = None) -> None:
        """
        清空缓存

        Args:
            namespace: 指定命名空间，None 则清空全部
        """
        if namespace:
            if namespace in self._caches:
                self._caches[namespace].clear()
        else:
            for c in self._caches.values():
                c.clear()


__all__ = ["TTL_LRUCache", "cached", "CachedAPIClient"]
