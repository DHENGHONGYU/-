"""
Prometheus 指标暴露模块 — 缓存命中率与性能监控

提供以下核心指标：
- v9_cache_hit_rate: 缓存命中率 (Gauge)
- v9_cache_request_total: 缓存请求总数 (Counter)
- v9_cache_latency_seconds: 缓存读取延迟 (Histogram)
- v9_sector_score_duration_seconds: 板块评分耗时 (Histogram)
- v9_akshare_fallback_total: AKShare 降级调用次数 (Counter)
- v9_data_collector_up: 服务存活状态 (Gauge)

用法：
    from lib.prometheus_exporter import init_metrics, record_cache_access
    
    init_metrics(app)  # 在 FastAPI app 初始化时调用
    record_cache_access("sector_info", hit=True)  # 记录缓存访问
"""

import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Prometheus 客户端（可选依赖，未安装时静默降级）
try:
    from prometheus_client import (
        Counter,
        Gauge,
        Histogram,
        generate_latest,
        REGISTRY,
        CONTENT_TYPE_LATEST,
    )
    from prometheus_client.core import GaugeMetricFamily

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("[prometheus] prometheus_client 未安装，监控指标将使用内存日志降级")

# ---------------------------------------------------------------------------
# 指标定义
# ---------------------------------------------------------------------------

if PROMETHEUS_AVAILABLE:
    # 缓存命中率（按类型分组）
    cache_hit_gauge = Gauge(
        "v9_cache_hit_rate",
        "Cache hit rate by type (0-100)",
        ["cache_type"],
    )

    # 缓存请求总数
    cache_request_counter = Counter(
        "v9_cache_request_total",
        "Total cache requests by type and result",
        ["cache_type", "result"],
    )

    # 缓存读取延迟（秒）
    cache_latency_histogram = Histogram(
        "v9_cache_latency_seconds",
        "Cache read latency in seconds",
        ["cache_type"],
        buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1.0],
    )

    # 板块评分耗时（秒）
    sector_score_histogram = Histogram(
        "v9_sector_score_duration_seconds",
        "Sector score computation duration in seconds",
        ["data_source"],  # cache / akshare
        buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
    )

    # AKShare 降级调用次数
    akshare_fallback_counter = Counter(
        "v9_akshare_fallback_total",
        "Total AKShare fallback calls when cache miss",
        ["endpoint"],
    )

    # 服务存活状态
    service_up_gauge = Gauge(
        "v9_data_collector_up",
        "Service health status (1=up, 0=down)",
    )

    # 缓存条目数
    cache_entries_gauge = Gauge(
        "v9_cache_entries",
        "Number of cached entries by type",
        ["cache_type"],
    )

else:
    # 降级占位符（日志模式）
    class _DummyMetric:
        def inc(self, *args, **kwargs):
            pass

        def set(self, *args, **kwargs):
            pass

        def observe(self, *args, **kwargs):
            pass

        cache_hit_gauge = _DummyMetric()
        cache_request_counter = _DummyMetric()
        cache_latency_histogram = _DummyMetric()
        sector_score_histogram = _DummyMetric()
        akshare_fallback_counter = _DummyMetric()
        service_up_gauge = _DummyMetric()
        cache_entries_gauge = _DummyMetric()


# ---------------------------------------------------------------------------
# 内存统计（降级模式下使用，同时作为 Prometheus 模式的补充）
# ---------------------------------------------------------------------------

_memory_stats = {
    "sector_info_hits": 0,
    "sector_info_misses": 0,
    "hist_data_hits": 0,
    "hist_data_misses": 0,
    "score_hits": 0,
    "score_misses": 0,
    "total_requests": 0,
    "total_latency_ms": 0.0,
}

# 独立追踪每种缓存类型的命中/未命中计数（用于计算命中率，避免 MutexValue 问题）
_tracking_stats = {
    "sector_info": {"hit": 0, "miss": 0},
    "hist_data": {"hit": 0, "miss": 0},
    "score": {"hit": 0, "miss": 0},
}


# ---------------------------------------------------------------------------
# 公共 API
# ---------------------------------------------------------------------------

def init_metrics(app=None):
    """初始化 Prometheus 指标，注册 /metrics 端点。

    Args:
        app: FastAPI 应用实例（可选，用于注册路由）
    """
    if PROMETHEUS_AVAILABLE and app is not None:
        from fastapi import Response

        @app.get("/metrics")
        async def metrics_endpoint():
            service_up_gauge.set(1)
            return Response(
                content=generate_latest(),
                media_type=CONTENT_TYPE_LATEST,
            )

        logger.info("[prometheus] /metrics 端点已注册")
    elif not PROMETHEUS_AVAILABLE:
        logger.info("[prometheus] 降级模式：指标将记录到内存日志")


def record_cache_access(cache_type: str, hit: bool, latency_ms: float = 0.0):
    """记录一次缓存访问。

    Args:
        cache_type: 缓存类型 (sector_info / hist_data / score)
        hit: 是否命中
        latency_ms: 访问延迟（毫秒）
    """
    result = "hit" if hit else "miss"

    # 更新追踪统计
    if cache_type in _tracking_stats:
        _tracking_stats[cache_type][result] += 1

    if PROMETHEUS_AVAILABLE:
        cache_request_counter.labels(cache_type=cache_type, result=result).inc()
        cache_latency_histogram.labels(cache_type=cache_type).observe(latency_ms / 1000.0)

        # 使用追踪统计计算命中率（避免 MutexValue 直接访问问题）
        if cache_type in _tracking_stats:
            hits = _tracking_stats[cache_type]["hit"]
            misses = _tracking_stats[cache_type]["miss"]
            total = hits + misses
            if total > 0:
                hit_rate = (hits / total) * 100
                cache_hit_gauge.labels(cache_type=cache_type).set(hit_rate)
    else:
        # 降级：内存统计
        _memory_stats["total_requests"] += 1
        _memory_stats["total_latency_ms"] += latency_ms

        if cache_type == "sector_info":
            if hit:
                _memory_stats["sector_info_hits"] += 1
            else:
                _memory_stats["sector_info_misses"] += 1
        elif cache_type == "hist_data":
            if hit:
                _memory_stats["hist_data_hits"] += 1
            else:
                _memory_stats["hist_data_misses"] += 1


def record_sector_score_duration(source: str, duration_ms: float):
    """记录板块评分耗时。

    Args:
        source: 数据来源 (cache / akshare)
        duration_ms: 耗时（毫秒）
    """
    if PROMETHEUS_AVAILABLE:
        sector_score_histogram.labels(data_source=source).observe(duration_ms / 1000.0)


def record_akshare_fallback(endpoint: str):
    """记录一次 AKShare 降级调用。

    Args:
        endpoint: 端点名称 (sw_index_second_info / index_hist_sw)
    """
    if PROMETHEUS_AVAILABLE:
        akshare_fallback_counter.labels(endpoint=endpoint).inc()
    else:
        logger.debug("[prometheus] akshare_fallback endpoint=%s", endpoint)


def update_cache_entries(cache_type: str, count: int):
    """更新缓存条目数。

    Args:
        cache_type: 缓存类型
        count: 条目数
    """
    if PROMETHEUS_AVAILABLE:
        cache_entries_gauge.labels(cache_type=cache_type).set(count)


def get_memory_stats() -> dict:
    """获取内存统计（降级模式下使用）。"""
    stats = _memory_stats.copy()
    total_si = stats["sector_info_hits"] + stats["sector_info_misses"]
    total_hd = stats["hist_data_hits"] + stats["hist_data_misses"]
    stats["sector_info_hit_rate"] = (
        (stats["sector_info_hits"] / total_si * 100) if total_si > 0 else 0.0
    )
    stats["hist_data_hit_rate"] = (
        (stats["hist_data_hits"] / total_hd * 100) if total_hd > 0 else 0.0
    )
    stats["avg_latency_ms"] = (
        stats["total_latency_ms"] / stats["total_requests"]
        if stats["total_requests"] > 0
        else 0.0
    )
    return stats


def get_metrics_summary() -> str:
    """获取指标摘要（日志模式）。"""
    if not PROMETHEUS_AVAILABLE:
        stats = get_memory_stats()
        return (
            f"[prometheus-memory] "
            f"sector_info_hit_rate={stats['sector_info_hit_rate']:.1f}% "
            f"hist_data_hit_rate={stats['hist_data_hit_rate']:.1f}% "
            f"total_requests={stats['total_requests']} "
            f"avg_latency={stats['avg_latency_ms']:.2f}ms"
        )
    return "[prometheus] 指标已暴露在 /metrics 端点"


# 导出所有公共函数
__all__ = [
    "init_metrics",
    "record_cache_access",
    "record_sector_score_duration",
    "record_akshare_fallback",
    "update_cache_entries",
    "get_memory_stats",
    "get_metrics_summary",
    "PROMETHEUS_AVAILABLE",
]
