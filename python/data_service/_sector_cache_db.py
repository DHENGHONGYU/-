"""
@module _sector_cache_db
@description 板块缓存 SQLite 持久化 — 避免重复调用 sw_index_second_info (占 83% 耗时)

@lifecycle @Global

@remarks
## 性能瓶颈
fetch_sector_rotation_scores() 中 ak.sw_index_second_info() 占 83% 总耗时 (~14.5s)。
本模块将板块基本信息 + 日线数据 + 评分结果持久化到 SQLite，
使前端可以直接从数据库读取，避免实时拉取。

## 数据库设计
- 文件: {project_root}/outputs/sector_cache.db
- 表:
  - sector_info:     板块基本信息 (sw_index_second_info 结果)
  - sector_hist_daily: 板块日线行情 (index_hist_sw 结果)
  - sector_score:    板块轮动评分结果
  - sector_cache_meta: 缓存元信息与刷新状态

## 缓存策略
1. sector_info:     每日刷新 (TTL=86400s)
2. sector_hist_daily: 每小时增量更新 (TTL=3600s)
3. sector_score:    每次预计算后更新 (TTL=3600s)

@see hot-momentum-strategy.md §2.5.2 板块轮动评分
@see _sector_fund_flow_db.py 同为 SQLite 持久化模块
"""

import logging
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_DB_DIR = Path(__file__).resolve().parent.parent.parent / "outputs"
_DB_PATH = _DB_DIR / "sector_cache.db"

_RETENTION_DAYS = 90
_HIST_RETENTION_DAYS = 120


def _get_conn() -> sqlite3.Connection:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=5.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
    _init_schema(conn)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sector_info (
            sector_code        TEXT PRIMARY KEY,
            sector_code_num    TEXT NOT NULL,
            sector_name        TEXT NOT NULL,
            level1_name        TEXT,
            level2_name        TEXT,
            level3_name        TEXT,
            constituent_count  INTEGER DEFAULT 0,
            pe_static          REAL DEFAULT 0.0,
            pb                 REAL DEFAULT 0.0,
            total_market_cap   REAL DEFAULT 0.0,
            float_market_cap   REAL DEFAULT 0.0,
            turnover_rate      REAL DEFAULT 0.0,
            pe_percentile      REAL DEFAULT 0.0,
            pb_percentile      REAL DEFAULT 0.0,
            info_updated_at    TEXT NOT NULL,
            data_version       TEXT DEFAULT 'v1'
        );
        CREATE INDEX IF NOT EXISTS idx_si_level1 ON sector_info(level1_name);
        CREATE INDEX IF NOT EXISTS idx_si_name ON sector_info(sector_name);

        CREATE TABLE IF NOT EXISTS sector_hist_daily (
            sector_code    TEXT NOT NULL,
            trade_date     TEXT NOT NULL,
            open_price     REAL DEFAULT 0.0,
            close_price    REAL DEFAULT 0.0,
            high_price     REAL DEFAULT 0.0,
            low_price      REAL DEFAULT 0.0,
            volume         REAL DEFAULT 0.0,
            amount         REAL DEFAULT 0.0,
            amplitude      REAL DEFAULT 0.0,
            change_pct     REAL DEFAULT 0.0,
            turnover       REAL DEFAULT 0.0,
            data_source    TEXT DEFAULT 'akshare',
            fetched_at     TEXT NOT NULL,
            PRIMARY KEY (sector_code, trade_date)
        );
        CREATE INDEX IF NOT EXISTS idx_hd_date ON sector_hist_daily(trade_date);
        CREATE INDEX IF NOT EXISTS idx_hd_sector ON sector_hist_daily(sector_code);

        CREATE TABLE IF NOT EXISTS sector_score (
            score_date      TEXT NOT NULL,
            sector_code     TEXT NOT NULL,
            sector_name      TEXT,
            sw_level1        TEXT,
            f1_jingqi        REAL DEFAULT 0.0,
            f2_zijin         REAL DEFAULT 0.0,
            f3_guzhi         REAL DEFAULT 0.0,
            f4_beta          REAL DEFAULT 0.0,
            f5_nengliang      REAL DEFAULT 0.0,
            total_score      REAL DEFAULT 0.0,
            resonance_score  REAL DEFAULT 0.0,
            signal           TEXT DEFAULT 'neutral',
            alert_level      TEXT DEFAULT 'normal',
            decline_type     TEXT DEFAULT 'none',
            rank_position    INTEGER DEFAULT 0,
            score_version    TEXT DEFAULT 'v1',
            created_at       TEXT NOT NULL,
            PRIMARY KEY (score_date, sector_code)
        );
        CREATE INDEX IF NOT EXISTS idx_sc_date ON sector_score(score_date);
        CREATE INDEX IF NOT EXISTS idx_sc_rank ON sector_score(score_date, total_score DESC);

        CREATE TABLE IF NOT EXISTS sector_cache_meta (
            cache_key       TEXT PRIMARY KEY,
            cache_type      TEXT NOT NULL,
            entity_count    INTEGER DEFAULT 0,
            last_updated    TEXT NOT NULL,
            next_refresh    TEXT,
            refresh_interval INTEGER DEFAULT 3600,
            data_version    TEXT DEFAULT 'v1',
            is_valid        INTEGER DEFAULT 1,
            notes           TEXT
        );
    """)
    conn.commit()


def upsert_sector_info(rows: list[dict]) -> int:
    if not rows:
        return 0
    conn = _get_conn()
    try:
        now = datetime.now().isoformat()
        conn.executemany("""
            INSERT INTO sector_info
                (sector_code, sector_code_num, sector_name, level1_name,
                 level2_name, level3_name, constituent_count, pe_static, pb,
                 total_market_cap, float_market_cap, turnover_rate,
                 pe_percentile, pb_percentile, info_updated_at, data_version)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(sector_code) DO UPDATE SET
                sector_name=excluded.sector_name,
                level1_name=excluded.level1_name,
                constituent_count=excluded.constituent_count,
                pe_static=excluded.pe_static,
                pb=excluded.pb,
                info_updated_at=excluded.info_updated_at
        """, [
            (r["code"], r.get("code_num", r["code"].split(".")[0]), r["name"],
             r.get("level1", ""), r.get("level2", ""), r.get("level3", ""),
             r.get("constituent_count", 0), r.get("pe", 0), r.get("pb", 0),
             r.get("total_market_cap", 0), r.get("float_market_cap", 0),
             r.get("turnover_rate", 0), r.get("pe_percentile", 0),
             r.get("pb_percentile", 0), r.get("info_updated_at", now),
             r.get("data_version", "v1"))
            for r in rows
        ])
        conn.commit()
        _update_meta(conn, "sector_info:v1", "info", len(rows), now, 86400)
        logger.info("[sector_cache] upsert_sector_info %d 行", len(rows))
        return len(rows)
    except Exception as e:
        logger.error("[sector_cache] upsert_sector_info 失败: %s", e, exc_info=True)
        conn.rollback()
        return 0
    finally:
        conn.close()


def upsert_hist_daily(sector_code: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    conn = _get_conn()
    try:
        now = datetime.now().isoformat()
        conn.executemany("""
            INSERT INTO sector_hist_daily
                (sector_code, trade_date, open_price, close_price, high_price,
                 low_price, volume, amount, amplitude, change_pct, turnover,
                 data_source, fetched_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(sector_code, trade_date) DO UPDATE SET
                close_price=excluded.close_price,
                volume=excluded.volume,
                amount=excluded.amount,
                fetched_at=excluded.fetched_at
        """, [
            (sector_code, r["date"],
             r.get("open", 0), r.get("close", 0), r.get("high", 0),
             r.get("low", 0), r.get("volume", 0), r.get("amount", 0),
             r.get("amplitude", 0), r.get("change_pct", 0), r.get("turnover", 0),
             r.get("source", "akshare"), now)
            for r in rows
        ])
        conn.commit()
        cache_key = f"sector_hist_daily:{sector_code.split('.')[0]}"
        _update_meta(conn, cache_key, "hist", len(rows), now, 3600)
        logger.info("[sector_cache] upsert_hist_daily sector=%s rows=%d", sector_code, len(rows))
        return len(rows)
    except Exception as e:
        logger.error("[sector_cache] upsert_hist_daily 失败: %s", e, exc_info=True)
        conn.rollback()
        return 0
    finally:
        conn.close()


def upsert_scores(score_date: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    conn = _get_conn()
    try:
        now = datetime.now().isoformat()
        conn.executemany("""
            INSERT INTO sector_score
                (score_date, sector_code, sector_name, sw_level1,
                 f1_jingqi, f2_zijin, f3_guzhi, f4_beta, f5_nengliang,
                 total_score, resonance_score, signal, alert_level,
                 decline_type, rank_position, score_version, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(score_date, sector_code) DO UPDATE SET
                total_score=excluded.total_score,
                signal=excluded.signal,
                rank_position=excluded.rank_position,
                created_at=excluded.created_at
        """, [
            (score_date, r["sectorCode"], r.get("sectorName", ""),
             r.get("swLevel1", ""),
             r.get("f1Jingqi", 0), r.get("f2Zijin", 0), r.get("f3Guzhi", 0),
             r.get("f4Beta", 0), r.get("f5Nengliang", 0),
             r.get("total", 0), r.get("resonance", 0),
             r.get("signal", "neutral"), r.get("alertLevel", "normal"),
             r.get("declineType", "none"), r.get("rankPosition", 0),
             r.get("modelUsed", "v1"), now)
            for r in rows
        ])
        conn.commit()
        cache_key = f"sector_score:{score_date}"
        _update_meta(conn, cache_key, "score", len(rows), now, 3600)
        logger.info("[sector_cache] upsert_scores date=%s rows=%d", score_date, len(rows))
        return len(rows)
    except Exception as e:
        logger.error("[sector_cache] upsert_scores 失败: %s", e, exc_info=True)
        conn.rollback()
        return 0
    finally:
        conn.close()


def get_sector_info(level1: Optional[str] = None) -> list[dict]:
    conn = _get_conn()
    try:
        if level1:
            cur = conn.execute(
                "SELECT * FROM sector_info WHERE level1_name = ? ORDER BY constituent_count DESC",
                (level1,)
            )
        else:
            cur = conn.execute(
                "SELECT * FROM sector_info ORDER BY constituent_count DESC"
            )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in rows]
    finally:
        conn.close()


def get_sector_scores(score_date: Optional[str] = None, topN: int = 20) -> list[dict]:
    conn = _get_conn()
    try:
        if score_date is None:
            row = conn.execute("SELECT MAX(score_date) FROM sector_score").fetchone()
            score_date = row[0] if row and row[0] else datetime.now().strftime("%Y-%m-%d")
        cur = conn.execute(
            "SELECT * FROM sector_score WHERE score_date = ? ORDER BY total_score DESC LIMIT ?",
            (score_date, topN)
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in rows]
    finally:
        conn.close()


def get_hist_for_sector(sector_code: str, days: int = 60) -> list[dict]:
    conn = _get_conn()
    try:
        cur = conn.execute(
            """SELECT * FROM sector_hist_daily
               WHERE sector_code = ?
               ORDER BY trade_date DESC LIMIT ?""",
            (sector_code, days)
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in reversed(rows)]
    finally:
        conn.close()


def compute_technical_indicators(sector_code: str) -> Optional[dict]:
    """从日线数据计算技术指标 (替代实时 AKShare 调用)。"""
    conn = _get_conn()
    try:
        rows = conn.execute(
            """SELECT trade_date, close_price, volume, amount
               FROM sector_hist_daily
               WHERE sector_code = ?
               ORDER BY trade_date DESC LIMIT 25""",
            (sector_code,)
        ).fetchall()
        if len(rows) < 6:
            logger.warning("[sector_cache] 数据不足 sector=%s rows=%d", sector_code, len(rows))
            return None

        rows.reverse()
        closes = [r[1] for r in rows]
        volumes = [r[2] for r in rows]
        amounts = [r[3] for r in rows]

        change_5d = (closes[-1] - closes[-6]) / closes[-6] * 100 if closes[-6] else 0.0
        return_20d = (closes[-1] - closes[-min(21, len(closes)-1)]) / closes[-min(21, len(closes)-1)] * 100 if len(closes) >= 21 else 0.0

        recent_vol = sum(volumes[-5:]) / 5 if len(volumes) >= 5 else 0.0
        prior_vol = sum(volumes[-25:-5]) / 20 if len(volumes) >= 25 else recent_vol
        vol_ratio = recent_vol / prior_vol if prior_vol > 0 else 1.0

        recent_amt = sum(amounts[-5:]) / 5 if len(amounts) >= 5 else 0.0
        prior_amt = sum(amounts[-25:-5]) / 20 if len(amounts) >= 25 else recent_amt
        amt_ratio = recent_amt / prior_amt if prior_amt > 0 else 1.0

        return {
            "sector_code": sector_code,
            "trade_date": rows[-1][0],
            "close_latest": closes[-1],
            "change_5d": round(change_5d, 4),
            "return_20d": round(return_20d, 4),
            "vol_ratio": round(vol_ratio, 4),
            "amt_ratio": round(amt_ratio, 4),
            "avg_volume_5d": round(recent_vol, 2),
            "avg_amount_5d": round(recent_amt, 2),
        }
    finally:
        conn.close()


def is_cache_fresh(cache_key: str, max_age_seconds: int) -> bool:
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT last_updated, is_valid FROM sector_cache_meta WHERE cache_key = ?",
            (cache_key,)
        ).fetchone()
        if not row or not row[1]:
            return False
        last_updated = datetime.fromisoformat(row[0])
        age = (datetime.now() - last_updated).total_seconds()
        return age < max_age_seconds
    finally:
        conn.close()


def get_cache_stats() -> dict:
    conn = _get_conn()
    try:
        stats = {}
        tables = ["sector_info", "sector_hist_daily", "sector_score", "sector_cache_meta"]
        for t in tables:
            row = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()
            stats[t] = row[0] if row else 0

        latest_score = conn.execute(
            "SELECT MAX(score_date) FROM sector_score"
        ).fetchone()
        stats["latest_score_date"] = latest_score[0] if latest_score and latest_score[0] else None

        hist_by_sector = conn.execute(
            "SELECT sector_code, COUNT(*) FROM sector_hist_daily GROUP BY sector_code"
        ).fetchall()
        stats["hist_by_sector"] = {r[0]: r[1] for r in hist_by_sector}

        meta = conn.execute(
            "SELECT cache_key, cache_type, entity_count, last_updated, is_valid FROM sector_cache_meta"
        ).fetchall()
        stats["meta"] = [
            {"key": r[0], "type": r[1], "count": r[2], "updated": r[3], "valid": bool(r[4])}
            for r in meta
        ]
        return stats
    finally:
        conn.close()


def cleanup_old_data() -> int:
    """清理过期数据。"""
    conn = _get_conn()
    try:
        hist_cutoff = (datetime.now() - timedelta(days=_HIST_RETENTION_DAYS)).strftime("%Y-%m-%d")
        score_cutoff = (datetime.now() - timedelta(days=_RETENTION_DAYS)).strftime("%Y-%m-%d")

        deleted_hist = conn.execute(
            "DELETE FROM sector_hist_daily WHERE trade_date < ?",
            (hist_cutoff,)
        ).rowcount
        deleted_score = conn.execute(
            "DELETE FROM sector_score WHERE score_date < ?",
            (score_cutoff,)
        ).rowcount
        conn.commit()

        total = deleted_hist + deleted_score
        logger.info(
            "[sector_cache] cleanup 删除 hist=%d score=%d 行 "
            "(hist_cutoff=%s, score_cutoff=%s)",
            deleted_hist, deleted_score, hist_cutoff, score_cutoff,
        )
        return total
    except Exception as e:
        logger.error("[sector_cache] cleanup 失败: %s", e, exc_info=True)
        conn.rollback()
        return 0
    finally:
        conn.close()


def _update_meta(conn: sqlite3.Connection, cache_key: str, cache_type: str,
                 entity_count: int, last_updated: str, refresh_interval: int) -> None:
    conn.execute("""
        INSERT INTO sector_cache_meta
            (cache_key, cache_type, entity_count, last_updated, next_refresh,
             refresh_interval, data_version, is_valid)
        VALUES (?,?,?,?,?,?,?,1)
        ON CONFLICT(cache_key) DO UPDATE SET
            entity_count=excluded.entity_count,
            last_updated=excluded.last_updated,
            next_refresh=excluded.next_refresh,
            is_valid=1
    """, (
        cache_key, cache_type, entity_count, last_updated,
        (datetime.now() + timedelta(seconds=refresh_interval)).isoformat(),
        refresh_interval, "v1"
    ))


def get_db_path() -> Path:
    return _DB_PATH


__all__ = [
    "upsert_sector_info",
    "upsert_hist_daily",
    "upsert_scores",
    "get_sector_info",
    "get_sector_scores",
    "get_hist_for_sector",
    "compute_technical_indicators",
    "is_cache_fresh",
    "get_cache_stats",
    "cleanup_old_data",
    "get_db_path",
]
