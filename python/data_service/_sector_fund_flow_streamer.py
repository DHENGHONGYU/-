"""
@module _sector_fund_flow_streamer
@lifecycle @Global
@description 板块资金流分钟级流式采集器（阶段一）

@remarks
## 背景
基于 f2Zijin 三层降级架构，扩展到分钟级实时数据采集。
每 60s 轮询 fetch_sector_fund_flow，内存环形缓冲 4 小时数据，
每 5 分钟批量写入 SQLite（降低 I/O 压力 5x）。

## 架构
```
  Timer(60s) → fetch_sector_fund_flow(L1→L2→L3 降级复用)
                      ↓
             内存环形缓冲 deque(maxlen=240)  ← 4小时分钟级数据
                      ↓
             ┌────────┴────────┐
             ↓                 ↓
        SQLite批量写入      get_latest/get_history
        (5分钟1次)          (供 SSE/前端读取)
```

## 数据生命周期
- 内存缓冲：240 条快照（4 小时 × 60 分钟），满后丢弃最旧
- SQLite：5 分钟批量 upsert，保持日级粒度（PK: date+sector_code）
- 待写队列：_pending_writes，5 次轮询后触发批量写入（去重后写入）

## 线程安全
- threading.Lock 保护 _buffer 和 _pending_writes
- daemon 线程，主进程退出时自动终止
- stop() 用 threading.Event 通知线程退出

@see hot-momentum-strategy.md §2.5.2 f2Zijin 三层降级架构
@see _sector_fund_flow.py L1→L2→L3 降级编排
"""

import logging
import threading
import time
from collections import deque
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class SectorFundFlowStreamer:
    """板块资金流分钟级流式采集器。

    特性：
    - 每 60s 调用 fetch_sector_fund_flow（复用 L1→L2→L3 降级）
    - 内存环形缓冲 deque(maxlen=240) 保存最近 4 小时
    - 每 5 分钟批量写入 SQLite（降低 I/O 压力 5x）
    - 线程安全（threading.Lock 保护共享数据）
    - daemon 线程，主进程退出时自动终止

    使用示例：
        streamer = SectorFundFlowStreamer()
        streamer.start()  # 启动后台轮询

        # 获取最新数据
        latest = streamer.get_latest()
        # {"白酒": 12.5, "银行": -8.3, ...}

        # 获取最近 60 分钟历史
        history = streamer.get_history(minutes=60)
        # [{"timestamp": "...", "sectors": {"白酒": 12.5, ...}}, ...]

        streamer.stop()  # 停止轮询
    """

    # 轮询间隔（秒）
    POLL_INTERVAL_SEC = 60
    # 环形缓冲容量（4 小时 × 60 分钟 = 240 条快照）
    BUFFER_MAXLEN = 240
    # 批量写入阈值（5 次轮询 = 5 分钟）
    BATCH_WRITE_THRESHOLD = 5

    def __init__(self) -> None:
        self._buffer: deque[dict[str, Any]] = deque(maxlen=self.BUFFER_MAXLEN)
        self._pending_writes: list[dict[str, Any]] = []
        self._poll_count = 0
        self._last_poll_time: float | None = None
        self._last_write_time: float | None = None
        self._last_error: str | None = None
        self._running = False
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """启动后台轮询线程（daemon，主进程退出时自动终止）。"""
        if self._running:
            logger.warning("[streamer] 已在运行，忽略重复 start")
            return
        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop, name="SectorFundFlowStreamer", daemon=True
        )
        self._thread.start()
        logger.info(
            "[streamer] 启动: 轮询间隔=%ds, 缓冲=%d, 批量写入=%d次",
            self.POLL_INTERVAL_SEC, self.BUFFER_MAXLEN, self.BATCH_WRITE_THRESHOLD,
        )

    def stop(self) -> None:
        """停止轮询线程，并刷新剩余待写数据到 SQLite。"""
        if not self._running:
            return
        self._stop_event.set()
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        # 刷新剩余待写数据
        self._flush_pending_writes()
        logger.info("[streamer] 已停止, 总轮询 %d 次", self._poll_count)

    def _run_loop(self) -> None:
        """后台轮询主循环。"""
        while not self._stop_event.is_set():
            try:
                self._poll_once()
            except Exception as e:
                logger.error("[streamer] 轮询异常: %s", e, exc_info=True)
                with self._lock:
                    self._last_error = str(e)
            # 等待下次轮询（可被 stop_event 中断）
            self._stop_event.wait(self.POLL_INTERVAL_SEC)

    def _poll_once(self) -> None:
        """执行一次轮询：fetch_sector_fund_flow → 缓冲 → 批量写入判断。

        数据源失败时不清空缓冲区，仅记录错误并跳过本次。
        """
        from _sector_fund_flow import fetch_sector_fund_flow

        timestamp = datetime.now()
        result = fetch_sector_fund_flow()  # 全量获取（不传 sector_names）

        if result is None:
            logger.warning(
                "[streamer] 轮询 #%d 失败: fetch_sector_fund_flow 返回 None（L1/L2/L3 全失败）",
                self._poll_count + 1,
            )
            with self._lock:
                self._poll_count += 1
                self._last_poll_time = time.time()
                self._last_error = "L1/L2/L3 全失败"
            return

        # 构建缓冲快照
        snapshot = {
            "timestamp": timestamp.isoformat(),
            "timestamp_epoch": timestamp.timestamp(),
            "sectors": dict(result),  # {行业名: 净流入}
            "count": len(result),
        }

        with self._lock:
            self._buffer.append(snapshot)
            self._poll_count += 1
            self._last_poll_time = time.time()
            self._last_error = None

            # 追加到待写队列（SQLite 日级粒度，sector_name 作 sector_code）
            today = timestamp.strftime("%Y-%m-%d")
            for sector_name, net_amount in result.items():
                self._pending_writes.append({
                    "date": today,
                    "sector_code": sector_name,
                    "sector_name": sector_name,
                    "net_amount": float(net_amount),
                    "source": "streamer",
                    "fetched_at": timestamp.isoformat(),
                })

            # 判断是否触发批量写入（每 BATCH_WRITE_THRESHOLD 次轮询）
            should_write = self._poll_count % self.BATCH_WRITE_THRESHOLD == 0

        logger.info(
            "[streamer] 轮询 #%d 成功: %d 个行业, 待写队列 %d 条",
            self._poll_count, len(result), len(self._pending_writes),
        )

        if should_write:
            self._flush_pending_writes()

    def _flush_pending_writes(self) -> None:
        """将待写队列批量写入 SQLite（去重：每个 sector_code 只保留最新一条）。"""
        with self._lock:
            if not self._pending_writes:
                return
            # 去重：同一个 (date, sector_code) 只保留最新一条
            # 因为 _pending_writes 按时间追加，后面的覆盖前面的
            deduped: dict[tuple[str, str], dict] = {}
            for row in self._pending_writes:
                key = (row["date"], row["sector_code"])
                deduped[key] = row
            rows = list(deduped.values())
            self._pending_writes.clear()

        try:
            import _sector_fund_flow_db as db
            written = db.upsert_batch(rows)
            self._last_write_time = time.time()
            logger.info(
                "[streamer] 批量写入 SQLite: %d 条 (去重后 %d 条源数据)",
                written, len(rows),
            )
        except Exception as e:
            logger.error("[streamer] 批量写入失败: %s", e)
            with self._lock:
                self._last_error = f"SQLite 写入失败: {e}"

    def get_latest(self, sector_names: list[str] | None = None) -> dict[str, float]:
        """获取最新一次轮询的资金流数据。

        Args:
            sector_names: 可选，只返回指定行业的数据

        Returns:
            {行业名: 净流入} 字典，无数据时返回空字典
        """
        with self._lock:
            if not self._buffer:
                return {}
            latest = self._buffer[-1]
            sectors = latest["sectors"]
            if sector_names:
                return {k: v for k, v in sectors.items() if k in sector_names}
            return dict(sectors)

    def get_history(self, minutes: int = 60) -> list[dict[str, Any]]:
        """获取最近 N 分钟的历史快照。

        Args:
            minutes: 回溯分钟数（最大 240 = 4 小时）

        Returns:
            快照列表，按时间升序排列
        """
        count = min(minutes, self.BUFFER_MAXLEN)
        with self._lock:
            if not self._buffer:
                return []
            items = list(self._buffer)
            return items[-count:] if count < len(items) else items

    def get_stats(self) -> dict[str, Any]:
        """获取采集器运行状态。"""
        with self._lock:
            return {
                "running": self._running,
                "poll_count": self._poll_count,
                "buffer_size": len(self._buffer),
                "buffer_capacity": self.BUFFER_MAXLEN,
                "pending_writes": len(self._pending_writes),
                "last_poll_time": self._last_poll_time,
                "last_write_time": self._last_write_time,
                "last_error": self._last_error,
                "poll_interval_sec": self.POLL_INTERVAL_SEC,
                "batch_write_threshold": self.BATCH_WRITE_THRESHOLD,
            }


# 全局单例（延迟初始化，避免 import 时启动线程）
_streamer: SectorFundFlowStreamer | None = None


def get_streamer() -> SectorFundFlowStreamer:
    """获取全局 SectorFundFlowStreamer 单例（延迟初始化，不自动启动）。"""
    global _streamer
    if _streamer is None:
        _streamer = SectorFundFlowStreamer()
    return _streamer
