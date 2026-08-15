"""
@module scheduler
@description V9 后台定时任务调度器 - 板块评分预计算 + 缓存刷新。

## 任务列表
1. sector_scores_precompute: 每30分钟预计算板块轮动评分
2. cache_health_check: 每5分钟检查 Redis 健康状态
3. hist_cache_cleanup: 每小时清理过期 hist 缓存

## 启动方式
    # 方式1：独立进程
    python scheduler.py

    # 方式2：集成到 FastAPI（推荐）
    # 在 collect_endpoints.py 的 lifespan 中调用 start_scheduler()

## 配置
    环境变量:
    - V9_SCHEDULER_ENABLED: "true" (默认) / "false"
    - V9_SECTOR_PRECOMPUTE_INTERVAL: 预计算间隔（分钟，默认30）
    - V9_CACHE_CHECK_INTERVAL: 健康检查间隔（分钟，默认5）
    - V9_PRECOMPUTE_TOPN: 预计算板块数量（默认10）
"""

import os
import sys
import time
import signal
import logging
import threading
from datetime import datetime
from typing import Optional

logger = logging.getLogger("v9-scheduler")

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    APSCHEDULER_AVAILABLE = True
except ImportError:
    BackgroundScheduler = None
    IntervalTrigger = None
    APSCHEDULER_AVAILABLE = False
    logger.warning("[scheduler] APScheduler 未安装，将使用简单定时器")

_running = False
_scheduler: Optional["BackgroundScheduler"] = None
_thread: Optional[threading.Thread] = None
_shutdown_event = threading.Event()


def _ensure_path() -> None:
    """确保模块路径正确。"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)


def precompute_sector_scores(topN: int = None) -> dict:
    """
    预计算板块轮动评分并写入缓存。

    Args:
        topN: 板块数量（默认从环境变量读取）

    Returns:
        {"success": bool, "count": int, "elapsed_ms": float, "error": str | None}
    """
    _ensure_path()
    if topN is None:
        topN = int(os.environ.get("V9_PRECOMPUTE_TOPN", "10"))

    logger.info("[scheduler] 开始预计算板块评分: topN=%d", topN)
    t0 = time.perf_counter()

    try:
        from collect_endpoints import fetch_sector_rotation_scores

        items = fetch_sector_rotation_scores(topN=topN)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        result = {
            "success": len(items) > 0,
            "count": len(items),
            "elapsed_ms": elapsed_ms,
            "error": None,
            "top3": [
                {"code": i.sectorCode, "name": i.sectorName, "total": i.total}
                for i in items[:3]
            ],
        }

        if items:
            logger.info(
                "[scheduler] 板块评分预计算完成: count=%d elapsed=%.1fms top3=%s",
                len(items), elapsed_ms,
                [(i.sectorCode, i.total) for i in items[:3]],
            )
        else:
            logger.warning("[scheduler] 板块评分预计算返回空结果")

        return result

    except Exception as e:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        logger.error(
            "[scheduler] 板块评分预计算异常: error=%s elapsed=%.1fms",
            e, elapsed_ms, exc_info=True,
        )
        return {
            "success": False,
            "count": 0,
            "elapsed_ms": elapsed_ms,
            "error": str(e),
        }


def check_cache_health() -> dict:
    """
    检查 Redis 和内存缓存健康状态。

    Returns:
        健康状态字典
    """
    _ensure_path()
    result = {
        "timestamp": datetime.now().isoformat(),
        "redis": None,
        "memory": None,
    }

    try:
        from lib.redis_cache import get_redis_cache
        cache = get_redis_cache()
        result["redis"] = cache.health_check()
    except Exception as e:
        result["redis"] = {"error": str(e)}

    try:
        from collect_endpoints import _cache_stats
        result["memory"] = _cache_stats()
    except Exception as e:
        result["memory"] = {"error": str(e)}

    redis_ok = result.get("redis", {}).get("redis_connected", False)
    logger.info(
        "[scheduler] 缓存健康检查: redis=%s memory=%s",
        "OK" if redis_ok else "FALLBACK",
        result.get("memory", "N/A"),
    )
    return result


def cleanup_expired_cache() -> dict:
    """清理过期缓存条目。"""
    _ensure_path()
    cleaned = 0

    # Redis 端清理
    try:
        from lib.redis_cache import get_redis_cache
        cache = get_redis_cache()
        if cache._redis_connected:
            # Redis 自动过期由 TTL 机制处理，这里只需扫描确认
            result = cache.health_check()
            logger.debug(
                "[scheduler] Redis 状态: connected=%s entries=%d",
                result.get("redis_connected"),
                result.get("memory_entries", 0),
            )
    except Exception as e:
        logger.warning("[scheduler] Redis 清理异常: %s", e)

    logger.info("[scheduler] 缓存清理完成: cleaned=%d", cleaned)
    return {"cleaned": cleaned}


def _run_precompute_loop(interval_minutes: int) -> None:
    """简单定时器模式：使用 threading.Timer 循环执行。"""
    while not _shutdown_event.is_set():
        try:
            precompute_sector_scores()
        except Exception as e:
            logger.error("[scheduler] 预计算循环异常: %s", e)
        # 等待下一个周期（可被 shutdown 中断）
        _shutdown_event.wait(interval_minutes * 60)


def start_scheduler() -> bool:
    """
    启动后台定时任务调度器。

    Returns:
        是否启动成功
    """
    global _running, _scheduler, _thread

    if _running:
        logger.info("[scheduler] 调度器已在运行中")
        return True

    if not os.environ.get("V9_SCHEDULER_ENABLED", "true").lower() == "true":
        logger.info("[scheduler] 调度器已禁用 (V9_SCHEDULER_ENABLED=false)")
        return False

    _ensure_path()
    interval = int(os.environ.get("V9_SECTOR_PRECOMPUTE_INTERVAL", "30"))

    if APSCHEDULER_AVAILABLE:
        try:
            _scheduler = BackgroundScheduler(
                timezone="Asia/Shanghai",
                job_defaults={
                    "coalesce": True,
                    "max_instances": 1,
                    "misfire_grace_time": 60,
                },
            )

            # 任务1: 板块评分预计算
            _scheduler.add_job(
                precompute_sector_scores,
                trigger=IntervalTrigger(minutes=interval),
                id="sector_scores_precompute",
                name="板块评分预计算",
                next_run_time=datetime.now(),  # 立即执行一次
                kwargs={"topN": int(os.environ.get("V9_PRECOMPUTE_TOPN", "10"))},
            )

            # 任务2: 缓存健康检查
            _scheduler.add_job(
                check_cache_health,
                trigger=IntervalTrigger(
                    minutes=int(os.environ.get("V9_CACHE_CHECK_INTERVAL", "5"))
                ),
                id="cache_health_check",
                name="缓存健康检查",
            )

            # 任务3: 缓存清理
            _scheduler.add_job(
                cleanup_expired_cache,
                trigger=IntervalTrigger(minutes=60),
                id="cache_cleanup",
                name="缓存清理",
            )

            _scheduler.start()
            _running = True

            jobs = _scheduler.get_jobs()
            logger.info(
                "[scheduler] APScheduler 启动成功: jobs=%d interval=%dmin",
                len(jobs), interval,
            )
            for job in jobs:
                logger.info(
                    "[scheduler] 已注册任务: id=%s name=%s next_run=%s",
                    job.id, job.name, job.next_run_time,
                )
            return True

        except Exception as e:
            logger.error("[scheduler] APScheduler 启动失败: %s，降级为简单定时器", e)

    # 降级：使用简单线程定时器
    logger.info("[scheduler] 使用简单定时器模式: interval=%dmin", interval)
    _thread = threading.Thread(
        target=_run_precompute_loop,
        args=(interval,),
        daemon=True,
        name="v9-precompute",
    )
    _thread.start()
    _running = True
    logger.info("[scheduler] 简单定时器已启动")

    # 立即执行一次预计算
    threading.Thread(
        target=precompute_sector_scores,
        daemon=True,
        name="v9-precompute-initial",
    ).start()

    return True


def stop_scheduler() -> None:
    """停止调度器。"""
    global _running, _scheduler

    if not _running:
        return

    _shutdown_event.set()

    if _scheduler and APSCHEDULER_AVAILABLE:
        try:
            _scheduler.shutdown(wait=False)
            logger.info("[scheduler] APScheduler 已停止")
        except Exception as e:
            logger.warning("[scheduler] APScheduler 停止异常: %s", e)

    _running = False
    logger.info("[scheduler] 调度器已停止")


def get_scheduler_status() -> dict:
    """获取调度器状态。"""
    jobs = []
    if _scheduler and APSCHEDULER_AVAILABLE:
        jobs = [
            {
                "id": j.id,
                "name": j.name,
                "next_run": str(j.next_run_time),
            }
            for j in _scheduler.get_jobs()
        ]

    return {
        "running": _running,
        "apscheduler_available": APSCHEDULER_AVAILABLE,
        "mode": "apscheduler" if _scheduler else "simple_timer",
        "jobs": jobs,
    }


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    logger.info("[scheduler] 独立模式启动")
    start_scheduler()

    def _signal_handler(signum, frame):
        logger.info("[scheduler] 收到信号 %s，正在停止...", signum)
        stop_scheduler()
        sys.exit(0)

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    try:
        while True:
            time.sleep(60)
            status = get_scheduler_status()
            logger.debug("[scheduler] 状态: %s", status)
    except KeyboardInterrupt:
        stop_scheduler()


__all__ = [
    "start_scheduler",
    "stop_scheduler",
    "get_scheduler_status",
    "precompute_sector_scores",
    "check_cache_health",
    "cleanup_expired_cache",
]