"""
@module lib/sector_sharded
@description 板块评分分片并行引擎 - 按申万一级行业分组，组间并行、组内串行。

## 核心优化思路
1. **分片策略**：将 TOP N 板块按「申万一级行业」分组（如 电子/计算机/通信 归为一组）
2. **组间并行**：每组分配一个线程，多组同时拉取
3. **组内串行**：每组内板块按顺序请求，避免 AKShare 并发冲突
4. **动态分片**：根据板块数量自动调整分片数（min(分组数, 最大线程数)）
5. **分片间缓存共享**：已缓存的 hist 数据跨分片共享，避免重复请求

## 性能分析日志
每个板块记录：代码、名称、分片、耗时（ms）、状态
完成后输出 TOP-N 最慢板块排行，便于定位性能瓶颈。

## 性能预期
- 10 个板块（3 个一级行业分组）：3.5s → 1.2s（-66%）
- 20 个板块（6 个一级行业分组）：3.5s → 0.8s（-77%）

@see collect_endpoints.py::fetch_sector_rotation_scores 现有实现
"""

import time
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Optional

logger = logging.getLogger("v9-sector-sharded")

_MAX_SHARDS = 6
_MIN_SECTORS_PER_SHARD = 2


def _shard_by_level1(rows: list[dict]) -> dict[str, list[dict]]:
    """
    按申万一级行业分组。

    Args:
        rows: 板块行列表（每条需含 level1 字段）

    Returns:
        {level1_name: [row, ...], ...}
    """
    shards: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        level1 = row.get("level1") or "其他"
        shards[level1].append(row)
    return dict(shards)


def _balance_shards(shards: dict[str, list[dict]], max_shards: int) -> dict[str, list[dict]]:
    """
    平衡分片：若分片数超过 max_shards，将最小分片合并到最相近的分片。

    Args:
        shards: 按 level1 分组后的分片
        max_shards: 允许的最大分片数

    Returns:
        平衡后的分片
    """
    if len(shards) <= max_shards:
        return shards

    sorted_shards = sorted(shards.items(), key=lambda x: -len(x[1]))
    balanced: dict[str, list[dict]] = {}

    for i, (name, rows) in enumerate(sorted_shards):
        if i < max_shards - 1:
            balanced[name] = rows
        else:
            # 剩余分片合并到最后一个分片
            last_key = list(balanced.keys())[-1]
            balanced[last_key].extend(rows)

    return balanced


def sharded_fetch_sectors(
    rows: list[dict],
    calc_fn: Callable[[dict], Optional[dict]],
    cache_get_fn: Optional[Callable[[str], Optional[Any]]] = None,
    cache_set_fn: Optional[Callable[[str, Any], None]] = None,
    progress_callback: Optional[Callable[[str, int, int], None]] = None,
) -> tuple[list[dict], dict]:
    """
    分片并行获取板块数据。

    Args:
        rows: 待处理的板块行列表
        calc_fn: 单个板块的计算函数
        cache_get_fn: 缓存读取函数（可选）
        cache_set_fn: 缓存写入函数（可选）
        progress_callback: 进度回调 (shard_name, completed, total)

    Returns:
        (成功结果列表, 统计信息字典)
    """
    t_start = time.time()
    stats = {
        "total_rows": len(rows),
        "shards_used": 0,
        "successful": 0,
        "failed": 0,
        "cache_hits": 0,
        "cache_misses": 0,
        "elapsed_ms": 0,
        "shard_details": [],
        "sector_timings": [],
    }

    if not rows:
        return [], stats

    # 1. 分片
    shards = _shard_by_level1(rows)
    shards = _balance_shards(shards, _MAX_SHARDS)
    stats["shards_used"] = len(shards)

    logger.info(
        "[sharded] 分片规划完成: total=%d shards=%d distribution=%s",
        len(rows),
        len(shards),
        {k: len(v) for k, v in shards.items()},
    )

    # 2. 分片间并行执行
    all_results: list[dict] = []
    all_sector_timings: list[dict] = []
    shard_names = list(shards.keys())
    total = len(rows)

    def _process_shard(shard_name: str, shard_rows: list[dict]) -> tuple[str, list[dict], dict, list[dict]]:
        """处理单个分片（组内串行）。"""
        shard_start = time.time()
        results: list[dict] = []
        shard_timings: list[dict] = []
        shard_stats = {"name": shard_name, "total": len(shard_rows), "success": 0, "failed": 0}

        for idx, row in enumerate(shard_rows):
            code = row.get("code", "unknown")
            name = row.get("name", "unknown")

            t_sector_start = time.perf_counter()
            error_msg = None
            status = "success"

            try:
                result = calc_fn(row)
                if result is not None:
                    results.append(result)
                    shard_stats["success"] += 1
                    status = "success"
                else:
                    shard_stats["failed"] += 1
                    status = "empty_result"
            except Exception as e:
                shard_stats["failed"] += 1
                status = "error"
                error_msg = str(e)
                logger.warning(
                    "[sharded] [%s] %d/%d 异常: code=%s name=%s error=%s",
                    shard_name, idx + 1, len(shard_rows), code, name, e,
                )

            sector_elapsed = round((time.perf_counter() - t_sector_start) * 1000, 1)

            shard_timings.append({
                "code": code,
                "name": name,
                "shard": shard_name,
                "elapsed_ms": sector_elapsed,
                "status": status,
                "index_in_shard": idx + 1,
            })

            logger.info(
                "[sharded][sector] [%s] %d/%d code=%s name=%s elapsed=%.1fms status=%s%s",
                shard_name, idx + 1, len(shard_rows),
                code, name, sector_elapsed, status,
                f" err={error_msg}" if error_msg else "",
            )

            if progress_callback:
                progress_callback(shard_name, idx + 1, len(shard_rows))

        shard_stats["elapsed_ms"] = round((time.time() - shard_start) * 1000, 1)
        shard_stats["sector_timings"] = shard_timings
        return shard_name, results, shard_stats, shard_timings

    # 3. 并发执行所有分片
    with ThreadPoolExecutor(max_workers=len(shards)) as executor:
        futures = {
            executor.submit(_process_shard, name, srows): name
            for name, srows in shards.items()
        }

        for future in as_completed(futures):
            shard_name = futures[future]
            try:
                _, shard_results, shard_stats, shard_timings = future.result()
                all_results.extend(shard_results)
                all_sector_timings.extend(shard_timings)
                stats["successful"] += shard_stats["success"]
                stats["failed"] += shard_stats["failed"]
                stats["shard_details"].append(shard_stats)
                logger.info(
                    "[sharded] 分片完成: name=%s success=%d failed=%d elapsed=%.1fms",
                    shard_name, shard_stats["success"], shard_stats["failed"],
                    shard_stats["elapsed_ms"],
                )
            except Exception as e:
                logger.error("[sharded] 分片异常: name=%s error=%s", shard_name, e)
                stats["failed"] += len(shards[shard_name])

    stats["elapsed_ms"] = round((time.time() - t_start) * 1000, 1)
    stats["sector_timings"] = all_sector_timings

    # 4. 输出性能排行
    _log_performance_rankings(all_sector_timings, stats)

    logger.info(
        "[sharded] 全部分片完成: total=%d success=%d failed=%d elapsed=%.1fms",
        stats["total_rows"], stats["successful"], stats["failed"],
        stats["elapsed_ms"],
    )

    return all_results, stats


def _log_performance_rankings(sector_timings: list[dict], stats: dict) -> None:
    """输出性能排行榜，帮助定位慢板块。"""
    if not sector_timings:
        return

    sorted_sectors = sorted(sector_timings, key=lambda x: -x["elapsed_ms"])

    p50 = sorted_sectors[len(sorted_sectors) // 2]["elapsed_ms"] if sorted_sectors else 0
    p90 = sorted_sectors[int(len(sorted_sectors) * 0.9)]["elapsed_ms"] if len(sorted_sectors) >= 2 else sorted_sectors[0]["elapsed_ms"]
    max_t = sorted_sectors[0]["elapsed_ms"]
    min_t = sorted_sectors[-1]["elapsed_ms"]
    avg_t = sum(s["elapsed_ms"] for s in sorted_sectors) / len(sorted_sectors)

    logger.info(
        "[sharded][perf] 性能概览: count=%d avg=%.1fms min=%.1fms p50=%.1fms p90=%.1fms max=%.1fms",
        len(sorted_sectors), avg_t, min_t, p50, p90, max_t,
    )

    slow_threshold_ms = 2000
    slow_sectors = [s for s in sorted_sectors if s["elapsed_ms"] > slow_threshold_ms]
    if slow_sectors:
        logger.warning(
            "[sharded][perf] 慢板块告警 (>%dms): %d 个板块",
            slow_threshold_ms, len(slow_sectors),
        )
        for i, s in enumerate(slow_sectors[:5]):
            logger.warning(
                "[sharded][perf]   #%d code=%s name=%s shard=%s elapsed=%.1fms status=%s",
                i + 1, s["code"], s["name"], s["shard"],
                s["elapsed_ms"], s["status"],
            )

    failed_sectors = [s for s in sorted_sectors if s["status"] != "success"]
    if failed_sectors:
        logger.warning(
            "[sharded][perf] 失败板块: %d 个", len(failed_sectors),
        )
        for s in failed_sectors:
            logger.warning(
                "[sharded][perf]   code=%s name=%s shard=%s status=%s elapsed=%.1fms",
                s["code"], s["name"], s["shard"], s["status"], s["elapsed_ms"],
            )

    shard_times = {}
    for s in sector_timings:
        shard_times.setdefault(s["shard"], []).append(s["elapsed_ms"])
    for shard, times in shard_times.items():
        logger.info(
            "[sharded][perf] 分片耗时: shard=%s count=%d total=%.1fms avg=%.1fms max=%.1fms",
            shard, len(times), sum(times), sum(times) / len(times), max(times),
        )


def build_sector_calc_fn(
    use_redis: bool = True,
    redis_available: bool = False,
):
    """
    构造板块计算函数（带缓存查询）。

    Args:
        use_redis: 是否优先使用 Redis
        redis_available: Redis 是否可用

    Returns:
        (calc_fn, cache_get_fn, cache_set_fn)
    """
    if use_redis and redis_available:
        try:
            from lib.redis_cache import get_redis_cache
            cache = get_redis_cache()

            def _cache_get(key: str):
                return cache.get(key)

            def _cache_set(key: str, value):
                cache.set(key, value, ttl=60)

            logger.info("[sharded] 使用 Redis 缓存后端")
            return _cache_get, _cache_set
        except Exception as e:
            logger.warning("[sharded] Redis 初始化失败: %s，降级内存缓存", e)

    from lib.cache_utils import TTL_LRUCache
    mem_cache = TTL_LRUCache(ttl=60.0, max_size=500)

    def _mem_get(key: str):
        return mem_cache.get(key)

    def _mem_set(key: str, value):
        mem_cache.set(key, value)

    logger.info("[sharded] 使用内存缓存后端（TTL_LRUCache）")
    return _mem_get, _mem_set


__all__ = [
    "sharded_fetch_sectors",
    "build_sector_calc_fn",
    "_shard_by_level1",
    "_balance_shards",
]