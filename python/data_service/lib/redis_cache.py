"""
@module lib/redis_cache
@description Redis 持久化缓存封装，支持自动降级到内存缓存 + 熔断器保护。

## 设计要点
- Redis 优先：连接正常时使用 Redis 做分布式持久化缓存
- 自动降级：Redis 不可用时自动 fallback 到 TTL_LRUCache（单机内存）
- 熔断器保护：通过 RedisCircuitBreaker 实现三态切换(CLOSED/OPEN/HALF_OPEN)
- 自动恢复：后台探活线程 + 指数退避重试 + 半开试探
- 健康检查：提供 ping() 和 health_check() 端点供监控
- 命名空间：所有 key 自动添加 "v9:" 前缀，避免多实例冲突
- 序列化：使用 pickle 进行 Python 对象序列化，支持 list/dict/DataFrame

## 使用示例
    >>> from lib.redis_cache import get_redis_cache
    >>> cache = get_redis_cache()
    >>> cache.set("sector_scores:10", items, ttl=30)
    >>> items = cache.get("sector_scores:10")

@see lib/redis_circuit_breaker.py (熔断器实现)
@see lib/cache_utils.py (TTL_LRUCache 内存降级实现)
"""

import os
import time
import pickle
import logging
import threading
from typing import Any, Optional, Callable
from collections import OrderedDict

from lib.redis_circuit_breaker import (
    RedisCircuitBreaker,
    CircuitBreakerOpenError,
    get_circuit_breaker,
)

logger = logging.getLogger("v9-redis-cache")

REDIS_AVAILABLE = False
try:
    import redis
    from redis.connection import ConnectionPool
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    ConnectionPool = None
    logger.info("[redis-cache] redis-py 未安装，将使用内存缓存降级模式")

_NAMESPACE_PREFIX = "v9:"
_stats_lock = threading.Lock()
_stats = {
    "redis_hits": 0,
    "redis_misses": 0,
    "memory_hits": 0,
    "memory_misses": 0,
    "redis_errors": 0,
    "degrade_count": 0,
}


class RedisCache:
    """Redis 持久化缓存管理器，带熔断器自动降级。"""

    def __init__(
        self,
        host: str = None,
        port: int = None,
        db: int = None,
        password: str = None,
        socket_timeout: float = 2.0,
        socket_connect_timeout: float = 2.0,
        circuit_breaker: RedisCircuitBreaker = None,
    ):
        self._host = host or os.environ.get("REDIS_HOST", "127.0.0.1")
        self._port = int(port or os.environ.get("REDIS_PORT", "6379"))
        self._db = int(db or os.environ.get("REDIS_DB", "0"))
        self._password = password or os.environ.get("REDIS_PASSWORD", None)
        self._socket_timeout = socket_timeout
        self._socket_connect_timeout = socket_connect_timeout

        self._redis_client: Optional["redis.Redis"] = None
        self._redis_connected = False
        self._memory_cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._memory_lock = threading.Lock()
        self._max_memory_entries = 2000
        self._circuit_breaker = circuit_breaker or get_circuit_breaker()

        self._init_connection()
        self._start_probe()

    def _init_connection(self) -> None:
        """初始化 Redis 连接，失败则降级到内存。"""
        if not REDIS_AVAILABLE:
            logger.warning("[redis-cache] redis 库不可用，降级为内存缓存")
            self._redis_connected = False
            return

        try:
            pool = ConnectionPool(
                host=self._host,
                port=self._port,
                db=self._db,
                password=self._password,
                socket_timeout=self._socket_timeout,
                socket_connect_timeout=self._socket_connect_timeout,
                max_connections=10,
                decode_responses=False,
            )
            self._redis_client = redis.Redis(connection_pool=pool)
            self._redis_client.ping()
            self._redis_connected = True
            self._circuit_breaker.reset()
            logger.info(
                "[redis-cache] Redis 连接成功: %s:%s db=%s",
                self._host, self._port, self._db,
            )
        except Exception as e:
            logger.warning(
                "[redis-cache] Redis 连接失败: %s，降级为内存缓存", e,
            )
            self._redis_connected = False
            with _stats_lock:
                _stats["degrade_count"] += 1

    def _start_probe(self) -> None:
        """启动后台探活线程。"""
        if self._redis_connected and self._redis_client:
            self._circuit_breaker.start_probe(
                ping_fn=self.ping, interval=10.0,
            )

    def _redis_get(self, full_key: str) -> Optional[Any]:
        """Redis 读取（带熔断器保护）。"""
        if not self._redis_connected or not self._redis_client:
            return None

        try:
            data = self._redis_client.get(full_key)
            if data is not None:
                with _stats_lock:
                    _stats["redis_hits"] += 1
                logger.debug("[redis-cache] Redis 命中 key=%s", full_key)
                return pickle.loads(data)
            with _stats_lock:
                _stats["redis_misses"] += 1
            logger.debug("[redis-cache] Redis 未命中 key=%s", full_key)
            return None
        except Exception as e:
            logger.warning("[redis-cache] Redis 读取异常 key=%s: %s", full_key, e)
            with _stats_lock:
                _stats["redis_errors"] += 1
                _stats["degrade_count"] += 1
            self._redis_connected = False
            return None

    def _redis_set(self, full_key: str, data: bytes, ttl: float) -> bool:
        """Redis 写入（带熔断器保护）。"""
        if not self._redis_connected or not self._redis_client:
            return False

        try:
            self._redis_client.setex(full_key, int(ttl), data)
            logger.debug(
                "[redis-cache] Redis 写入 key=%s ttl=%.0f bytes=%d",
                full_key, ttl, len(data),
            )
            return True
        except Exception as e:
            logger.warning("[redis-cache] Redis 写入异常 key=%s: %s", full_key, e)
            with _stats_lock:
                _stats["redis_errors"] += 1
                _stats["degrade_count"] += 1
            self._redis_connected = False
            return False

    def _full_key(self, key: str) -> str:
        """添加命名空间前缀。"""
        return f"{_NAMESPACE_PREFIX}{key}"

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值。

        优先 Redis → 降级内存缓存（熔断器保护）。

        Args:
            key: 缓存键（不含命名空间前缀）

        Returns:
            缓存值，未命中返回 None
        """
        full_key = self._full_key(key)

        if self._redis_connected and self._circuit_breaker.is_closed:
            try:
                result = self._circuit_breaker.execute_with_retry(
                    operation=f"get:{key[:30]}",
                    action=lambda: self._redis_get(full_key),
                    fallback=lambda: None,
                    max_retries=2,
                    base_delay=0.5,
                )
                if result is not None:
                    return result
            except Exception:
                logger.debug("[redis-cache] CB 放行但 Redis 读取失败，降级内存")

        # 降级到内存缓存
        with self._memory_lock:
            entry = self._memory_cache.get(key)
            if entry is not None:
                ts, value = entry
                if (time.time() - ts) < getattr(self, "_last_ttl", 300):
                    with _stats_lock:
                        _stats["memory_hits"] += 1
                    logger.debug("[redis-cache] 内存命中 key=%s", key)
                    return value
                else:
                    self._memory_cache.pop(key, None)
            with _stats_lock:
                _stats["memory_misses"] += 1
            logger.debug("[redis-cache] 内存未命中 key=%s", key)
            return None

    def set(self, key: str, value: Any, ttl: float = 300) -> None:
        """
        写入缓存。

        同时写入 Redis（若可用，带熔断器保护）和内存缓存。

        Args:
            key: 缓存键
            value: 缓存值（自动 pickle 序列化）
            ttl: 生存时间（秒）
        """
        full_key = self._full_key(key)
        self._last_ttl = ttl

        data = pickle.dumps(value)

        if self._redis_connected and self._circuit_breaker.is_closed:
            try:
                self._circuit_breaker.execute_with_retry(
                    operation=f"set:{key[:30]}",
                    action=lambda: self._redis_set(full_key, data, ttl),
                    fallback=lambda: False,
                    max_retries=2,
                    base_delay=0.5,
                )
            except Exception:
                logger.debug("[redis-cache] Redis 写入熔断，降级内存")

        # 内存缓存写入（始终作为降级）
        with self._memory_lock:
            self._memory_cache[key] = (time.time(), value)
            # LRU 淘汰
            while len(self._memory_cache) > self._max_memory_entries:
                self._memory_cache.popitem(last=False)

    def delete(self, key: str) -> None:
        """删除指定缓存键。"""
        full_key = self._full_key(key)
        if self._redis_connected:
            try:
                self._redis_client.delete(full_key)
            except Exception as e:
                logger.warning("[redis-cache] Redis 删除异常 key=%s: %s", key, e)
        with self._memory_lock:
            self._memory_cache.pop(key, None)

    def clear_namespace(self) -> None:
        """清空当前命名空间下的所有缓存。"""
        if self._redis_connected:
            try:
                cursor = 0
                while True:
                    cursor, keys = self._redis_client.scan(
                        cursor, match=f"{_NAMESPACE_PREFIX}*", count=200,
                    )
                    if keys:
                        self._redis_client.delete(*keys)
                    if cursor == 0:
                        break
                logger.info("[redis-cache] 已清空 Redis 命名空间 %s", _NAMESPACE_PREFIX)
            except Exception as e:
                logger.warning("[redis-cache] Redis 清空异常: %s", e)

        with self._memory_lock:
            self._memory_cache.clear()
        logger.info("[redis-cache] 已清空内存缓存")

    def ping(self) -> bool:
        """检测 Redis 连接状态。"""
        if self._redis_connected and self._redis_client:
            try:
                return bool(self._redis_client.ping())
            except Exception:
                self._redis_connected = False
                return False
        return False

    def health_check(self) -> dict:
        """
        健康检查，返回完整状态。

        Returns:
            {"redis_connected": bool, "redis_ping": bool, "memory_entries": int,
             "circuit_breaker": dict, "stats": dict}
        """
        redis_ping = self.ping()
        with self._memory_lock:
            mem_size = len(self._memory_cache)
        with _stats_lock:
            snap = dict(_stats)
        total = snap["redis_hits"] + snap["redis_misses"] + snap["memory_hits"] + snap["memory_misses"]
        snap["hit_rate"] = (
            (snap["redis_hits"] + snap["memory_hits"]) / total if total > 0 else 0.0
        )

        cb_stats = self._circuit_breaker.get_stats()

        return {
            "redis_connected": self._redis_connected,
            "redis_ping": redis_ping,
            "redis_address": f"{self._host}:{self._port}",
            "memory_entries": mem_size,
            "memory_max": self._max_memory_entries,
            "circuit_breaker": cb_stats,
            **snap,
        }

    def get_stats(self) -> dict:
        """获取缓存统计快照。"""
        return self.health_check()


_default_instance: Optional[RedisCache] = None
_instance_lock = threading.Lock()


def get_redis_cache() -> RedisCache:
    """
    获取全局单例 RedisCache 实例。

    Returns:
        RedisCache 实例
    """
    global _default_instance
    if _default_instance is None:
        with _instance_lock:
            if _default_instance is None:
                _default_instance = RedisCache()
    return _default_instance


__all__ = ["RedisCache", "get_redis_cache"]