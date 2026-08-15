"""
@module lib/redis_config
@description Redis 连接配置，支持环境变量覆盖。

## 环境变量
- REDIS_HOST: Redis 主机（默认 127.0.0.1）
- REDIS_PORT: Redis 端口（默认 6379）
- REDIS_DB: 数据库索引（默认 0）
- REDIS_PASSWORD: 密码（可选）
- REDIS_ENABLED: 是否启用（默认 true，设为 false 强制内存模式）

## Docker 快速启动
    docker run -d --name v9-redis \
        -p 6379:6379 \
        -v v9-redis-data:/data \
        redis:7-alpine \
        redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

## 缓存键命名规范
- 板块评分: v9:sector_scores:{topN}:{date}
- 板块行情: v9:sector_hist:{code_num}:{period}
- 个股K线: v9:kline:{symbol}:{adjust}
- 财务数据: v9:financial:{symbol}
- 行业评分: v9:industry_score:{symbol}
"""

import os
import logging

logger = logging.getLogger("v9-redis-config")


class RedisConfig:
    """Redis 连接配置类。"""

    def __init__(self):
        self.host = os.environ.get("REDIS_HOST", "127.0.0.1")
        self.port = int(os.environ.get("REDIS_PORT", "6379"))
        self.db = int(os.environ.get("REDIS_DB", "0"))
        self.password = os.environ.get("REDIS_PASSWORD", None)
        self.enabled = os.environ.get("REDIS_ENABLED", "true").lower() == "true"
        self.socket_timeout = float(os.environ.get("REDIS_SOCKET_TIMEOUT", "2.0"))
        self.socket_connect_timeout = float(
            os.environ.get("REDIS_SOCKET_CONNECT_TIMEOUT", "2.0")
        )
        self.max_connections = int(os.environ.get("REDIS_MAX_CONNECTIONS", "10"))
        self.memory_fallback = (
            os.environ.get("REDIS_MEMORY_FALLBACK", "true").lower() == "true"
        )

    def to_dict(self) -> dict:
        return {
            "host": self.host,
            "port": self.port,
            "db": self.db,
            "enabled": self.enabled,
            "memory_fallback": self.memory_fallback,
            "socket_timeout": self.socket_timeout,
            "max_connections": self.max_connections,
        }

    def __repr__(self) -> str:
        return f"RedisConfig({self.host}:{self.port}/{self.db}, enabled={self.enabled})"


REDIS_CONFIG = RedisConfig()

# 缓存 TTL 规范（秒）
TTL_SECTOR_SCORES = 30        # 板块评分结果（短 TTL，需实时性）
TTL_SECTOR_HIST = 60          # 板块日线行情
TTL_KLINE = 600               # 个股K线（10分钟）
TTL_FINANCIAL = 1800          # 财务数据（30分钟）
TTL_INDUSTRY_SCORE = 300      # 行业评分（5分钟）
TTL_ROTATION_SCORE = 300      # 轮动评分（5分钟）
TTL_HOLDING = 30              # 持仓数据（30秒，需实时）
TTL_REALTIME_QUOTE = 5        # 实时行情（5秒）


CACHE_KEY_PATTERNS = {
    "sector_scores": "v9:sector_scores:{topN}:{date}",
    "sector_hist": "v9:sector_hist:{code_num}:{period}",
    "kline": "v9:kline:{symbol}:{adjust}",
    "financial": "v9:financial:{symbol}",
    "industry_score": "v9:industry_score:{symbol}",
    "rotation_score": "v9:rotation_score:{symbol}",
    "holding": "v9:holding:{symbol}",
    "realtime_quote": "v9:quote:{symbol}",
}


def get_cache_key(pattern_name: str, **kwargs) -> str:
    """
    根据模板名称构造缓存键。

    Args:
        pattern_name: CACHE_KEY_PATTERNS 中的键名
        **kwargs: 模板变量

    Returns:
        完整缓存键字符串
    """
    pattern = CACHE_KEY_PATTERNS.get(pattern_name)
    if not pattern:
        raise ValueError(
            f"Unknown cache key pattern: {pattern_name}. "
            f"Available: {list(CACHE_KEY_PATTERNS.keys())}"
        )
    return pattern.format(**kwargs)


__all__ = [
    "RedisConfig",
    "REDIS_CONFIG",
    "TTL_SECTOR_SCORES",
    "TTL_SECTOR_HIST",
    "TTL_KLINE",
    "TTL_FINANCIAL",
    "TTL_INDUSTRY_SCORE",
    "TTL_ROTATION_SCORE",
    "TTL_HOLDING",
    "TTL_REALTIME_QUOTE",
    "CACHE_KEY_PATTERNS",
    "get_cache_key",
]