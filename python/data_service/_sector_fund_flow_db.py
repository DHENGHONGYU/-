"""
@module _sector_fund_flow_db
@lifecycle @Global
@description 板块资金流 SQLite 持久化（f2Zijin L3 缓存兜底层）

@remarks
## 背景
f2Zijin 三层降级架构中，L1(AKShare) 和 L2(hexin-v) 都是盘中实时数据源，
易受反爬影响。L3 层从 SQLite 读取最近 N 日的历史净流入均值，作为兜底。

## 数据库设计
- 文件：{project_root}/outputs/sector_fund_flow.db
- 表：sector_fund_flow
  - date TEXT (YYYY-MM-DD)
  - sector_code TEXT (同花顺板块代码，如 881273.TI)
  - sector_name TEXT (行业名称，如 "白酒")
  - net_amount REAL (净额，亿元)
  - source TEXT (L1_AKShare / L2_hexinv)
  - fetched_at TEXT (ISO 时间戳)
  - PRIMARY KEY (date, sector_code)

## 数据生命周期
- 写入：L1/L2 每次成功都调用 upsert_batch 写入当天记录
- 读取：L1/L2 全失败时调用 get_recent_avg_net_amount 读取最近 5 日均值
- 清理：可选，保留近 30 日数据（清理任务由调用方触发）

@see hot-momentum-strategy.md §2.5.2 f2Zijin L3 缓存兜底
"""

import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 数据库文件位置：项目根目录 outputs/ 下，符合 Electron 文件写入约束
# project_root = python/data_service 的上级上级
_DB_DIR = Path(__file__).resolve().parent.parent.parent / "outputs"
_DB_PATH = _DB_DIR / "sector_fund_flow.db"

# 保留天数（超过此天数的数据可在 cleanup 时删除）
_RETENTION_DAYS = 30


def _get_conn() -> sqlite3.Connection:
    """获取 SQLite 连接（每次调用新建，避免线程安全问题）。

    自动创建父目录和表结构。
    """
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH, timeout=5.0)
    conn.execute("PRAGMA journal_mode=WAL")  # 写入不阻塞读取
    conn.execute("PRAGMA synchronous=NORMAL")  # 平衡性能与安全
    _init_schema(conn)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    """初始化表结构（幂等）。"""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sector_fund_flow (
            date        TEXT    NOT NULL,
            sector_code TEXT    NOT NULL,
            sector_name TEXT,
            net_amount  REAL,
            source      TEXT,
            fetched_at  TEXT,
            PRIMARY KEY (date, sector_code)
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sector_fund_flow_date ON sector_fund_flow(date)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sector_fund_flow_sector ON sector_fund_flow(sector_code)"
    )
    conn.commit()


def upsert_batch(rows: list[dict]) -> int:
    """批量写入/更新板块资金流数据。

    Args:
        rows: 每行包含 date/sector_code/sector_name/net_amount/source/fetched_at

    Returns:
        实际写入行数

    Example:
        >>> upsert_batch([{
        ...     "date": "2026-08-09",
        ...     "sector_code": "881273.TI",
        ...     "sector_name": "白酒",
        ...     "net_amount": 10.5,
        ...     "source": "L2_hexinv",
        ...     "fetched_at": "2026-08-09T14:30:00",
        ... }])
        1
    """
    if not rows:
        return 0

    conn = _get_conn()
    try:
        conn.executemany(
            """
            INSERT INTO sector_fund_flow
                (date, sector_code, sector_name, net_amount, source, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, sector_code) DO UPDATE SET
                sector_name = excluded.sector_name,
                net_amount  = excluded.net_amount,
                source      = excluded.source,
                fetched_at  = excluded.fetched_at
            """,
            [
                (
                    r["date"],
                    r["sector_code"],
                    r.get("sector_name"),
                    r.get("net_amount"),
                    r.get("source"),
                    r.get("fetched_at") or datetime.now().isoformat(),
                )
                for r in rows
            ],
        )
        conn.commit()
        logger.info(
            "[fund_flow_db] upsert_batch 写入 %d 行 date=%s",
            len(rows),
            rows[0].get("date") if rows else "?",
        )
        return len(rows)
    except Exception as e:
        logger.error("[fund_flow_db] upsert_batch 失败: %s", e, exc_info=True)
        conn.rollback()
        return 0
    finally:
        conn.close()


def get_recent_avg_net_amount(sector_code: str, days: int = 5) -> Optional[float]:
    """读取某板块最近 N 日的净流入均值（L3 兜底核心查询）。

    Args:
        sector_code: 板块代码（同花顺代码，如 881273.TI）
        days: 回看天数，默认 5

    Returns:
        净流入均值（亿元），无数据返回 None

    Note:
        使用 AVG(net_amount) 聚合，自动跳过 NULL。
        日期范围：[today - days, today]，左闭右闭。
    """
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days - 1)).strftime("%Y-%m-%d")

    conn = _get_conn()
    try:
        cursor = conn.execute(
            """
            SELECT AVG(net_amount), COUNT(*)
            FROM sector_fund_flow
            WHERE sector_code = ? AND date >= ? AND date <= ?
            """,
            (sector_code, start_date, end_date),
        )
        row = cursor.fetchone()
        if row and row[0] is not None and row[1] > 0:
            avg_val = float(row[0])
            logger.info(
                "[fund_flow_db] L3 缓存命中 sector=%s avg=%.2f亿元 days=%d count=%d",
                sector_code, avg_val, days, row[1],
            )
            return avg_val
        logger.warning(
            "[fund_flow_db] L3 缓存未命中 sector=%s date_range=[%s,%s]",
            sector_code, start_date, end_date,
        )
        return None
    except Exception as e:
        logger.error("[fund_flow_db] get_recent_avg_net_amount 失败: %s", e, exc_info=True)
        return None
    finally:
        conn.close()


def get_latest_date() -> Optional[str]:
    """查询数据库中最新一笔数据的日期（监控/诊断用）。"""
    conn = _get_conn()
    try:
        cursor = conn.execute(
            "SELECT MAX(date) FROM sector_fund_flow"
        )
        row = cursor.fetchone()
        return row[0] if row and row[0] else None
    finally:
        conn.close()


def cleanup_old_data(keep_days: int = _RETENTION_DAYS) -> int:
    """清理超过保留期的旧数据。

    Args:
        keep_days: 保留天数，默认 30

    Returns:
        删除行数
    """
    cutoff = (datetime.now() - timedelta(days=keep_days)).strftime("%Y-%m-%d")
    conn = _get_conn()
    try:
        cursor = conn.execute(
            "DELETE FROM sector_fund_flow WHERE date < ?",
            (cutoff,),
        )
        conn.commit()
        deleted = cursor.rowcount
        if deleted > 0:
            logger.info("[fund_flow_db] cleanup 删除 %d 行旧数据 cutoff=%s", deleted, cutoff)
        return deleted
    except Exception as e:
        logger.error("[fund_flow_db] cleanup 失败: %s", e, exc_info=True)
        conn.rollback()
        return 0
    finally:
        conn.close()


def get_db_path() -> Path:
    """返回数据库文件路径（诊断/测试用）。"""
    return _DB_PATH


__all__ = [
    "upsert_batch",
    "get_recent_avg_net_amount",
    "get_latest_date",
    "cleanup_old_data",
    "get_db_path",
]
