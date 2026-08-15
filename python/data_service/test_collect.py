#!/usr/bin/env python3
"""
V9 数据采集独立测试脚本
============================

直接调用真实数据采集逻辑（腾讯行情 / AKShare），无需启动 FastAPI 服务。
支持单维度或全维度采集，方便本地调试与数据验证。

用法:
    # 采集单只股票基础信息
    python test_collect.py 600519
    python test_collect.py 600519 --dim basic

    # 采集 K 线数据
    python test_collect.py 600519 --dim kline
    python test_collect.py 600519 --dim kline --period daily --count 60 --adjust qfq
    python test_collect.py 600519 --dim kline --period 5min --count 320

    # 采集财务数据
    python test_collect.py 600519 --dim financial

    # 采集板块轮动评分
    python test_collect.py --dim sectors --top-n 10

    # 全维度采集（基础 + K线 + 财务 + 板块）
    python test_collect.py 600519 --dim all

    # 指定输出格式
    python test_collect.py 600519 --format json
    python test_collect.py 600519 --format table

    # 启用 DEBUG 日志 + 写日志文件
    python test_collect.py 600519 -v --log-file collect_debug.log

依赖:
    pip install akshare requests pydantic pandas
    可选: adata（行业回退）
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
from collections import OrderedDict
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Optional

# ---------------------------------------------------------------------------
# 日志配置（增强版：控制台 + 可选文件 + 结构化字段）
# ---------------------------------------------------------------------------
import logging
from logging.handlers import RotatingFileHandler

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
_LOG_FORMAT = "%(asctime)s [%(levelname)-7s] [%(threadName)s] %(message)s"
_LOG_DATEFMT = "%Y-%m-%d %H:%M:%S"

logger = logging.getLogger("collect_test")
logger.setLevel(getattr(logging, _LOG_LEVEL, logging.INFO))
logger.propagate = False

_console_handler = logging.StreamHandler(sys.stderr)
_console_handler.setFormatter(logging.Formatter(_LOG_FORMAT, _LOG_DATEFMT))
logger.addHandler(_console_handler)

_log_file_handler: RotatingFileHandler | None = None


def _enable_file_logging(log_path: str) -> None:
    global _log_file_handler
    if _log_file_handler is not None:
        return
    log_dir = os.path.dirname(os.path.abspath(log_path))
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
    _log_file_handler = RotatingFileHandler(
        log_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    _log_file_handler.setFormatter(logging.Formatter(_LOG_FORMAT, _LOG_DATEFMT))
    logger.addHandler(_log_file_handler)
    logger.info("[log] 文件日志已启用: %s", os.path.abspath(log_path))


def _log_request_start(request_id: str, symbol: str, dim: str, **kwargs: Any) -> None:
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
    logger.info(
        "[REQUEST ▶] id=%s symbol=%s dim=%s %s",
        request_id, symbol, dim, extra,
    )


def _log_request_end(request_id: str, success: bool, elapsed_ms: float, **kwargs: Any) -> None:
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
    status = "✓ OK" if success else "✗ FAIL"
    logger.info(
        "[REQUEST ■] id=%s %s elapsed=%.1fms %s",
        request_id, status, elapsed_ms, extra,
    )


def _log_data_summary(request_id: str, data: Any, label: str) -> None:
    logger.info("[DATA] id=%s %s %s", request_id, label, _summarize_data(data))


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

@contextmanager
def _timed(label: str, **kwargs: Any):
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
    logger.debug("[timing] %s start %s", label, extra)
    t0 = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info("[timing] %s done %.1fms %s", label, elapsed_ms, extra)


def _safe_float(val: Any) -> float | None:
    """安全转换为 float，失败返回 None。不将 0 视为空值。"""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s == "" or s in ("--", "-", "N/A", "NA", "nan", "None"):
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _safe_float_or_zero(val: Any) -> float:
    """安全转换为 float，失败或 None 返回 0.0。"""
    f = _safe_float(val)
    return f if f is not None else 0.0


def _to_tencent_code(symbol: str) -> str:
    clean = symbol.split(".")[0].upper()
    if clean.startswith("6"):
        return f"sh{clean}"
    elif clean.startswith(("0", "3", "2")):
        return f"sz{clean}"
    elif clean.startswith(("8", "4", "9")):
        return f"bj{clean}"
    return f"sh{clean}"


def _deep_find_first(obj: Any, keys: set[str]) -> str | None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys and v is not None and str(v).strip():
                val = str(v).strip()
                if len(val) >= 2:
                    return val
        for v in obj.values():
            result = _deep_find_first(v, keys)
            if result:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _deep_find_first(item, keys)
            if result:
                return result
    return None


def _normalize_sw_name(name: str) -> str:
    return re.sub(r"[\sⅠⅡⅢⅣIV]+$", "", str(name)).strip()


def _summarize_data(data: Any, max_fields: int = 8) -> str:
    if data is None:
        return "None"
    if isinstance(data, dict):
        keys = list(data.keys())[:max_fields]
        parts = [f"{k}={data[k]}" for k in keys]
        if len(data) > max_fields:
            parts.append(f"...(+{len(data) - max_fields} more)")
        return "{" + ", ".join(parts) + "}"
    if isinstance(data, list):
        return f"list[{len(data)}]"
    return str(data)[:200]


def _gen_request_id() -> str:
    return uuid.uuid4().hex[:8]


# ---------------------------------------------------------------------------
# TTL 内存缓存
# ---------------------------------------------------------------------------
import threading

_TTL_CACHE: OrderedDict[str, tuple[float, Any]] = OrderedDict()
_TTL_CACHE_LOCK = threading.Lock()
_CACHE_NULL_SENTINEL = object()


def _cached_get(key: str, ttl_seconds: int) -> Any | None:
    with _TTL_CACHE_LOCK:
        entry = _TTL_CACHE.get(key)
        if entry is None:
            return None
        ts, value = entry
        if (time.time() - ts) > ttl_seconds:
            _TTL_CACHE.pop(key, None)
            return None
        _TTL_CACHE.move_to_end(key)
        if value is _CACHE_NULL_SENTINEL:
            return None
        return value


def _cached_set(key: str, value: Any, max_entries: int = 500) -> None:
    with _TTL_CACHE_LOCK:
        _TTL_CACHE[key] = (time.time(), value)
        _TTL_CACHE.move_to_end(key)
        while len(_TTL_CACHE) > max_entries:
            _TTL_CACHE.popitem(last=False)


def _cache_null(key: str, max_entries: int = 500) -> None:
    """缓存空结果（使用哨兵对象，避免 None 值歧义）。"""
    _cached_set(key, _CACHE_NULL_SENTINEL, max_entries)


# ---------------------------------------------------------------------------
# 申万行业代码映射
# ---------------------------------------------------------------------------
_SW_MAP_CACHE: dict[str, Any] = {"data": None, "ts": 0.0}
_SW_MAP_TTL = 86400


def _get_sw_industry_map() -> dict[str, dict[str, str]] | None:
    now = time.time()
    if _SW_MAP_CACHE["data"] is not None and now - _SW_MAP_CACHE["ts"] < _SW_MAP_TTL:
        return _SW_MAP_CACHE["data"]
    try:
        import akshare as ak
        second_df = ak.sw_index_second_info()
        first_df = ak.sw_index_first_info()
    except Exception as e:
        logger.warning("[SW映射] 获取申万行业映射失败: %s", e)
        return None

    if second_df is None or first_df is None:
        logger.warning("[SW映射] 申万行业数据为空")
        return None

    second_map: dict[str, str] = {}
    for _, row in second_df.iterrows():
        name = str(row.get("行业_name", row.get("行业名称", ""))).strip()
        code = str(row.get("行业代码", "")).strip()
        if name and code:
            second_map[name] = code
            second_map[_normalize_sw_name(name)] = code

    first_map: dict[str, str] = {}
    for _, row in first_df.iterrows():
        name = str(row.get("行业名称", "")).strip()
        code = str(row.get("行业代码", "")).strip()
        if name and code:
            first_map[name] = code

    data = {"second": second_map, "first": first_map}
    _SW_MAP_CACHE["data"] = data
    _SW_MAP_CACHE["ts"] = now
    logger.info("[SW映射] 申万行业映射表已加载: 二级 %d 条, 一级 %d 条", len(second_map), len(first_map))
    return data


def resolve_sw_industry_code(industry_name: str | None) -> str | None:
    if not industry_name:
        return None
    mapping = _get_sw_industry_map()
    if not mapping:
        return None
    name = industry_name.strip()
    norm = _normalize_sw_name(name)
    second = mapping.get("second", {})
    if name in second:
        return second[name]
    if norm and norm != name and norm in second:
        return second[norm]
    return None


# ---------------------------------------------------------------------------
# 腾讯行情直连
# ---------------------------------------------------------------------------

def fetch_tencent_quote(symbol: str) -> dict[str, Any] | None:
    import requests
    tc = _to_tencent_code(symbol)
    url = f"https://qt.gtimg.cn/q={tc}"
    with _timed("tencent_quote", symbol=symbol, tencent_code=tc):
        try:
            r = requests.get(url, timeout=8, headers={"Referer": "https://gu.qq.com/"})
            raw_text = r.content.decode("utf-8", errors="replace")
            if "\ufffd" in raw_text:
                raw_text = r.content.decode("gbk", errors="replace")
            parts = raw_text.split('="')
            if len(parts) < 2:
                logger.warning("[tencent_quote] 响应解析失败: symbol=%s parts_len=%d", symbol, len(parts))
                return None
            fields = parts[1].strip('";\n').split("~")
            if len(fields) < 50:
                logger.warning("[tencent_quote] 字段数不足: symbol=%s fields=%d", symbol, len(fields))
                return None

            price = _safe_float(fields[3]) if len(fields) > 3 else None
            pe = _safe_float(fields[39]) if len(fields) > 39 else None
            pb = _safe_float(fields[47]) if len(fields) > 47 else None
            market_cap_yi = _safe_float(fields[46]) if len(fields) > 46 else None

            result = {
                "name": fields[1] if len(fields) > 1 and fields[1] else None,
                "price": price,
                "pe": pe,
                "pb": pb,
                "market_cap": market_cap_yi * 1e8 if market_cap_yi is not None else None,
            }
            logger.info(
                "[tencent_quote] 成功: %s price=%s pe=%s pb=%s mc=%s亿",
                symbol,
                f"{price:.2f}" if price is not None else "N/A",
                f"{pe:.2f}" if pe is not None else "N/A",
                f"{pb:.2f}" if pb is not None else "N/A",
                f"{market_cap_yi:.2f}" if market_cap_yi is not None else "N/A",
            )
            return result
        except Exception as e:
            logger.error("[tencent_quote] 失败: symbol=%s error=%s", symbol, e, exc_info=True)
            return None


# ---------------------------------------------------------------------------
# 行业信息回退
# ---------------------------------------------------------------------------

def fetch_industry_fallback(symbol: str) -> dict[str, Any] | None:
    with _timed("industry_fallback", symbol=symbol):
        clean = symbol.split(".")[0].upper()

        # 方案 1: stock_individual_spot_xq（雪球）
        try:
            import akshare as ak
            xq_symbol = f"SZ{clean}" if clean.startswith(("0", "3")) else f"SH{clean}"
            df = ak.stock_individual_spot_xq(symbol=xq_symbol)
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    col_name = str(row.get("item", "")).strip()
                    col_val = row.get("value")
                    if "行业" in col_name or "所属" in col_name or "公司" in col_name:
                        industry_name = str(col_val).strip() if col_val else None
                        if industry_name and len(industry_name) < 20:
                            sw_code = resolve_sw_industry_code(industry_name)
                            logger.info("[industry_fallback] 雪球源成功: symbol=%s industry=%s sw_code=%s",
                                        symbol, industry_name, sw_code)
                            return {"industry_name": industry_name, "industry_code": sw_code}
        except Exception as e:
            logger.debug("[industry_fallback] 雪球源失败: %s", e)

        # 方案 2: 腾讯行业接口
        try:
            import requests
            tc = _to_tencent_code(symbol)
            url = (
                f"https://proxy.finance.qq.com/ifzqgtimg/appstock/app/"
                f"newflvcode/getStockIndustry?stockCode={tc}"
            )
            r = requests.get(url, timeout=2, headers={"Referer": "https://gu.qq.com/"})
            if r.status_code == 200 and r.text:
                try:
                    data = r.json()
                    industry_name = _deep_find_first(
                        data, {"industryName", "industry", "swIndustry", "name", "stockIndustry"}
                    )
                    if industry_name:
                        sw_code = resolve_sw_industry_code(industry_name)
                        logger.info("[industry_fallback] 腾讯源成功: symbol=%s industry=%s sw_code=%s",
                                    symbol, industry_name, sw_code)
                        return {"industry_name": industry_name, "industry_code": sw_code}
                except (ValueError, TypeError):
                    logger.debug("[industry_fallback] 腾讯行业接口 JSON 解析失败")
        except Exception as e:
            logger.debug("[industry_fallback] 腾讯行业接口失败: %s", e)

        # 方案 3: adata 百度股市通
        try:
            import adata
            from adata.common.headers import baidu_headers
            baidu_headers.json_headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://gushitong.baidu.com/",
            }
            df = adata.stock.info.get_industry_sw(stock_code=clean)
            if df is not None and not df.empty:
                level2_name = None
                for _, row in df.iterrows():
                    if str(row.get("industry_type", "")).strip() == "申万二级":
                        level2_name = str(row.get("industry_name", "")).strip()
                        break
                if level2_name:
                    sw_code = resolve_sw_industry_code(level2_name)
                    logger.info("[industry_fallback] adata源成功: symbol=%s industry=%s sw_code=%s",
                                symbol, level2_name, sw_code)
                    return {"industry_name": level2_name, "industry_code": sw_code}
        except ImportError:
            logger.debug("[industry_fallback] adata 未安装，跳过")
        except Exception as e:
            logger.debug("[industry_fallback] adata 失败: %s", e)

        logger.warning("[industry_fallback] 所有回退源均失败: symbol=%s", symbol)
        return None


# ---------------------------------------------------------------------------
# K 线采集
# ---------------------------------------------------------------------------

_TENCENT_PERIOD_MAP = {
    "1min": "1min", "5min": "5min", "15min": "15min",
    "30min": "30min", "60min": "60min",
    "daily": "day", "weekly": "week", "monthly": "month",
}
_DAILY_PERIODS = {"daily", "weekly", "monthly"}
_INTRADAY_PERIODS = {"1min", "5min", "15min", "30min", "60min"}


def fetch_tencent_kline(
    symbol: str,
    count: int = 60,
    period: str = "daily",
    adjust: str = "qfq",
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict[str, Any]] | None:
    import requests
    tc = _to_tencent_code(symbol)
    tencent_period = _TENCENT_PERIOD_MAP.get(period, "day")

    if period in _INTRADAY_PERIODS:
        url = (
            f"https://web.ifzq.gtimg.cn/appstock/app/kline/kline"
            f"?param={tc},{tencent_period},,,{count}"
        )
    else:
        adj = adjust if adjust else ""
        url = (
            f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
            f"?param={tc},{tencent_period},{start_date or ''},{end_date or ''},{count},{adj}"
        )

    with _timed("tencent_kline", symbol=symbol, period=period, count=count):
        try:
            r = requests.get(url, timeout=10)
            data = r.json()
            kline_data = (data or {}).get("data", {}).get(tc, {})
            if not kline_data:
                logger.warning("[tencent_kline] 响应中无股票数据: symbol=%s tc=%s", symbol, tc)
                return None

            if period in _DAILY_PERIODS:
                key_candidates = [tencent_period]
                if adjust == "qfq":
                    key_candidates = [f"qfq{tencent_period}", tencent_period]
                elif adjust == "hfq":
                    key_candidates = [f"hfq{tencent_period}", tencent_period]
                day_list = None
                for key in key_candidates:
                    day_list = kline_data.get(key)
                    if day_list:
                        logger.debug("[tencent_kline] 使用 key=%s 获得数据", key)
                        break
            else:
                day_list = kline_data.get(tencent_period)

            if not day_list:
                logger.warning("[tencent_kline] K线数据为空: symbol=%s period=%s keys_available=%s",
                               symbol, period, list(kline_data.keys()))
                return None

            bars: list[dict[str, Any]] = []
            skipped = 0
            for item in day_list:
                if not isinstance(item, (list, tuple)) or len(item) < 6:
                    skipped += 1
                    continue
                bars.append({
                    "date": str(item[0]),
                    "open": _safe_float(item[1]),
                    "close": _safe_float(item[2]),
                    "high": _safe_float(item[3]),
                    "low": _safe_float(item[4]),
                    "volume": _safe_float(item[5]),
                    "amount": _safe_float(item[6]) if len(item) > 6 else 0.0,
                })

            if skipped > 0:
                logger.warning("[tencent_kline] 跳过 %d 根异常 K 线", skipped)

            if not bars:
                logger.warning("[tencent_kline] 解析后无有效 K 线: symbol=%s period=%s", symbol, period)
                return None

            first = bars[0]
            last = bars[-1]
            logger.info(
                "[tencent_kline] 成功: symbol=%s period=%s bars=%d range=%s~%s close=%s",
                symbol, period, len(bars), first["date"], last["date"],
                f"{last['close']:.2f}" if last["close"] is not None else "N/A",
            )
            return bars
        except Exception as e:
            logger.error("[tencent_kline] 失败: symbol=%s period=%s error=%s", symbol, period, e, exc_info=True)
            return None


# ---------------------------------------------------------------------------
# 个股基础信息采集
# ---------------------------------------------------------------------------

def _fetch_individual_info_adata(symbol: str) -> dict[str, Any] | None:
    try:
        import adata
        from adata.common.headers import baidu_headers
    except ImportError:
        logger.warning("[basic] adata 未安装")
        return None

    baidu_headers.json_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://gushitong.baidu.com/",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    clean_symbol = symbol.split(".")[0].upper()
    try:
        df = adata.stock.info.get_industry_sw(stock_code=clean_symbol)
    except Exception as e:
        logger.warning("[basic] adata get_industry_sw 失败: %s", e)
        return None
    if df is None or df.empty:
        return None

    level2_name = None
    for _, row in df.iterrows():
        if str(row.get("industry_type", "")).strip() == "申万二级":
            level2_name = str(row.get("industry_name", "")).strip()
            break
    if not level2_name:
        return None

    sw_code = resolve_sw_industry_code(level2_name)
    if not sw_code:
        return None
    return {"industry_name": level2_name, "industry_code": sw_code}


def fetch_individual_info(symbol: str) -> dict[str, Any] | None:
    cache_key = f"basic:{symbol}"
    cached_val = _cached_get(cache_key, ttl_seconds=300)
    if cached_val is not None:
        logger.info("[basic] 命中缓存: symbol=%s data=%s", symbol, _summarize_data(cached_val))
        return cached_val

    with _timed("fetch_individual_info", symbol=symbol):
        logger.info("[basic] 开始获取: symbol=%s", symbol)
        clean_symbol = symbol.split(".")[0].upper()
        ak_info: dict[str, Any] | None = None
        ak_industry_name: str | None = None

        # 1. AKShare 主路径
        try:
            import akshare as ak
        except ImportError:
            logger.warning("[basic] akshare 未安装，走 adata 回退")
        else:
            try:
                df = ak.stock_individual_info_em(symbol=clean_symbol)
            except Exception as e:
                logger.warning("[basic] stock_individual_info_em 失败，回退: %s", e)
            else:
                if df is not None and not df.empty and "item" in df.columns:
                    ak_info = {}
                    for _, row in df.iterrows():
                        item = str(row["item"]).strip()
                        value = row["value"]
                        if item == "股票简称":
                            ak_info["name"] = str(value).strip() if value else None
                        elif item == "行业":
                            ak_industry_name = str(value).strip() if value else None
                            ak_info["industry_name"] = ak_industry_name
                        elif item == "总市值":
                            try:
                                ak_info["market_cap"] = float(value)
                            except (TypeError, ValueError):
                                pass

                    sw_code = resolve_sw_industry_code(ak_industry_name)
                    ak_info["industry_code"] = sw_code
                    if sw_code:
                        logger.info("[basic] AKShare 成功: %s name=%s industry_code=%s",
                                    symbol, ak_info.get("name"), sw_code)
                        _cached_set(cache_key, ak_info)
                        return ak_info

        # 2. adata 回退
        adata_info = _fetch_individual_info_adata(symbol)
        if adata_info and adata_info.get("industry_code"):
            merged = {
                "name": (ak_info or {}).get("name"),
                "industry_name": adata_info.get("industry_name"),
                "industry_code": adata_info.get("industry_code"),
                "market_cap": (ak_info or {}).get("market_cap"),
            }
            logger.info("[basic] adata 回退成功: symbol=%s code=%s",
                        symbol, adata_info.get("industry_code"))
            _cached_set(cache_key, merged)
            return merged

        if ak_info:
            _cached_set(cache_key, ak_info)
            return ak_info

        logger.warning("[basic] 所有源均失败: symbol=%s", symbol)
        _cache_null(cache_key)
        return None


# ---------------------------------------------------------------------------
# 基础信息采集（整合路由）
# ---------------------------------------------------------------------------

def collect_basic(symbol: str) -> dict[str, Any]:
    """采集单只股票基础信息（多路回退）"""
    req_id = _gen_request_id()
    _log_request_start(req_id, symbol, "basic")
    t0 = time.perf_counter()

    info = fetch_individual_info(symbol)
    tq = fetch_tencent_quote(symbol)

    stock_name = (tq or {}).get("name")
    if not stock_name:
        stock_name = (info or {}).get("name")

    industry_code = (info or {}).get("industry_code")
    industry_name = (info or {}).get("industry_name")
    if not industry_code:
        fallback = fetch_industry_fallback(symbol)
        if fallback:
            industry_code = fallback.get("industry_code")
            industry_name = fallback.get("industry_name")

    data = {
        "name": stock_name,
        "industry_code": industry_code,
        "industry_name": industry_name,
        "market_cap": (info or {}).get("market_cap") or (tq or {}).get("market_cap"),
        "price": (tq or {}).get("price"),
        "pe": (tq or {}).get("pe"),
        "pb": (tq or {}).get("pb"),
    }

    missing = [k for k in ("name", "price", "industry_code", "pe") if not data.get(k)]
    if missing:
        logger.warning("[collect_basic] 部分字段缺失: %s symbol=%s", missing, symbol)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    result = {
        "success": True,
        "symbol": symbol,
        "dimension": "basic",
        "data": data,
        "records": 1,
        "missing": missing,
        "fetched_at": datetime.now().isoformat(),
    }

    _log_data_summary(req_id, data, "基础信息")
    _log_request_end(req_id, True, elapsed_ms, records=1, missing=len(missing))
    return result


# ---------------------------------------------------------------------------
# K 线采集（整合路由）
# ---------------------------------------------------------------------------

def collect_kline(
    symbol: str,
    period: str = "daily",
    count: int = 60,
    adjust: str = "qfq",
) -> dict[str, Any]:
    """采集单只股票 K 线数据"""
    req_id = _gen_request_id()
    _log_request_start(req_id, symbol, "kline", period=period, count=count)
    t0 = time.perf_counter()

    effective_adjust = adjust if period in _DAILY_PERIODS else ""
    bars = fetch_tencent_kline(symbol, count=count, period=period, adjust=effective_adjust)
    if not bars:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        _log_request_end(req_id, False, elapsed_ms, reason="empty_bars")
        return {
            "success": False,
            "symbol": symbol,
            "dimension": "kline",
            "data": None,
            "error": f"K线数据为空 (period={period})",
            "fetched_at": datetime.now().isoformat(),
        }

    latest = bars[-1] if bars else None
    elapsed_ms = (time.perf_counter() - t0) * 1000
    result = {
        "success": True,
        "symbol": symbol,
        "dimension": "kline",
        "data": {
            "latest": latest,
            "history": bars,
            "bar_count": len(bars),
            "range": {"start": bars[0]["date"], "end": bars[-1]["date"]},
        },
        "records": len(bars),
        "fetched_at": datetime.now().isoformat(),
    }

    logger.info(
        "[collect_kline] id=%s bars=%d range=%s~%s close=%s",
        req_id, len(bars), bars[0]["date"], bars[-1]["date"],
        f"{bars[-1]['close']:.2f}" if bars[-1]["close"] is not None else "N/A",
    )
    _log_request_end(req_id, True, elapsed_ms, bars=len(bars))
    return result


# ---------------------------------------------------------------------------
# 财务数据采集
# ---------------------------------------------------------------------------

def fetch_real_financial_data(symbol: str) -> dict[str, Any] | None:
    import akshare as ak
    cache_key = f"financial:{symbol}"
    cached_val = _cached_get(cache_key, ttl_seconds=3600)
    if cached_val is not None:
        logger.info("[financial] 命中缓存: symbol=%s data=%s", symbol, _summarize_data(cached_val))
        return cached_val

    with _timed("financial_data", symbol=symbol):
        clean = symbol.split(".")[0].upper()
        result: dict[str, Any] = {}

        # 1. 比率类指标
        try:
            df = ak.stock_financial_analysis_indicator(symbol=clean, start_year="2023")
            if df is not None and not df.empty:
                latest = df.iloc[-1]
                result["report_date"] = str(latest.get("日期", ""))
                result["gross_margin"] = _safe_float(latest.get("销售毛利率(%)"))
                result["net_margin"] = _safe_float(latest.get("销售净利率(%)"))
                result["revenue_yoy"] = _safe_float(latest.get("主营业务收入增长率(%)"))
                result["net_profit_yoy"] = _safe_float(latest.get("净利润增长率(%)"))
                result["inventory_turnover_days"] = _safe_float(latest.get("存货周转天数(天)"))
                total_assets = _safe_float(latest.get("总资产(元)"))
                debt_ratio = _safe_float(latest.get("资产负债率(%)"))
                if total_assets is not None and debt_ratio is not None:
                    result["net_assets"] = total_assets * (1 - debt_ratio / 100)
                    result["interest_bearing_debt"] = total_assets * debt_ratio / 100
        except Exception as e:
            logger.error("[financial] analysis_indicator 失败: %s", e, exc_info=True)

        # 2. 绝对值指标
        try:
            df2 = ak.stock_financial_abstract(symbol=clean)
            if df2 is not None and not df2.empty:
                date_cols = [c for c in df2.columns if c not in ("选项", "指标")]
                if date_cols:
                    latest_col = date_cols[0]
                    for _, row in df2.iterrows():
                        metric = str(row["指标"]).strip()
                        val = _safe_float(row[latest_col])
                        if val is None:
                            continue
                        if metric == "营业总收入":
                            result.setdefault("revenue", val)
                        elif metric == "归母净利润":
                            result.setdefault("net_profit", val)
                        elif metric == "净利润" and "net_profit" not in result:
                            result.setdefault("net_profit", val)
                        elif "经营活动产生的现金流量净额" in metric:
                            result.setdefault("operating_cf", val)
                        elif metric == "应收账款":
                            result.setdefault("receivables", val)
                        elif metric in ("股东权益合计", "归属于母公司股东权益合计"):
                            result.setdefault("net_assets", val)
                        elif metric == "商誉":
                            result.setdefault("goodwill", val)
                        elif metric == "负债合计":
                            result.setdefault("interest_bearing_debt", val)
                        elif metric == "研发费用":
                            result["_rd_expense"] = val
                    if "_rd_expense" in result and result.get("revenue"):
                        result["rd_ratio"] = round(result["_rd_expense"] / result["revenue"] * 100, 2)
                        result.pop("_rd_expense", None)
        except Exception as e:
            logger.error("[financial] financial_abstract 失败: %s", e, exc_info=True)

        if result:
            revenue_str = f"{result.get('revenue', 0):.0f}" if result.get("revenue") is not None else "N/A"
            profit_str = f"{result.get('net_profit', 0):.0f}" if result.get("net_profit") is not None else "N/A"
            logger.info("[financial] 成功: %s revenue=%s net_profit=%s fields=%d",
                        symbol, revenue_str, profit_str, len(result))
        final_result = result if result else None
        if final_result is not None:
            _cached_set(cache_key, final_result)
        else:
            _cache_null(cache_key)
        return final_result


def collect_financial(symbol: str) -> dict[str, Any]:
    """采集单只股票财务数据"""
    req_id = _gen_request_id()
    _log_request_start(req_id, symbol, "financial")
    t0 = time.perf_counter()

    real_data = fetch_real_financial_data(symbol)
    if real_data is None:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        _log_request_end(req_id, False, elapsed_ms, reason="no_data")
        return {
            "success": False,
            "symbol": symbol,
            "dimension": "financial",
            "data": None,
            "error": "AKShare 财务数据获取失败",
            "fetched_at": datetime.now().isoformat(),
        }

    valid_fields = {
        "report_date", "revenue", "revenue_yoy", "net_profit", "net_profit_yoy",
        "gross_margin", "net_margin", "operating_cf", "rd_ratio",
        "receivables", "inventory_turnover_days", "interest_bearing_debt",
        "goodwill", "net_assets", "shareholder_pledge",
    }
    filtered = {k: v for k, v in real_data.items() if k in valid_fields}
    elapsed_ms = (time.perf_counter() - t0) * 1000
    _log_data_summary(req_id, filtered, "财务数据")
    _log_request_end(req_id, True, elapsed_ms, fields=len(filtered))
    return {
        "success": True,
        "symbol": symbol,
        "dimension": "financial",
        "data": filtered,
        "records": 1,
        "fetched_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 板块轮动评分采集
# ---------------------------------------------------------------------------

def _normalize_to_100(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    sorted_items = sorted(values.items(), key=lambda x: x[1])
    n = len(sorted_items)
    return {k: (i / max(n - 1, 1)) * 100 for i, (k, _v) in enumerate(sorted_items)}


def _fetch_market_benchmark_return(window: int = 20) -> float | None:
    import requests
    url = f"https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh000300,day,,,{window + 5}"
    try:
        r = requests.get(url, timeout=8)
        data = r.json()
        day_list = (data or {}).get("data", {}).get("sh000300", {}).get("day")
        if not day_list or len(day_list) < window + 1:
            return None
        closes = [float(item[2]) for item in day_list if isinstance(item, (list, tuple)) and len(item) > 2]
        if len(closes) < window + 1 or closes[-window - 1] == 0:
            return None
        return (closes[-1] - closes[-window - 1]) / closes[-window - 1] * 100
    except Exception as e:
        logger.warning("[sectors] 大盘基准拉取失败: %s", e)
        return None


def fetch_sector_rotation_scores(topN: int = 20) -> list[dict[str, Any]]:
    import akshare as ak
    import pandas as pd
    from concurrent.futures import ThreadPoolExecutor

    score_date = datetime.now().strftime("%Y-%m-%d")
    created_at = datetime.now().isoformat()

    spot_df = ak.sw_index_second_info()
    if spot_df is None or spot_df.empty:
        logger.warning("[sectors] sw_index_second_info 返回空")
        return []
    spot_df = spot_df.sort_values("成份个数", ascending=False).head(topN)
    logger.info("[sectors] 申万二级板块: 候选=%d, topN=%d", len(spot_df), topN)

    def calc_sector(row):
        code = str(row.get("行业代码", ""))
        if not code:
            return None
        code_num = code.split(".")[0]
        name = str(row.get("行业名称", ""))
        level1 = str(row.get("上级行业", "")) if pd.notna(row.get("上级行业")) else None
        pe = _safe_float_or_zero(row.get("静态市盈率"))
        pb = _safe_float_or_zero(row.get("市净率"))

        try:
            hist = ak.index_hist_sw(symbol=code_num, period="day")
            if hist is None or len(hist) < 25:
                logger.debug("[sectors] code=%s hist 数据不足 len=%d", code, len(hist) if hist is not None else 0)
                return None
            closes = hist["收盘"].astype(float).tolist()
            volumes = hist["成交量"].astype(float).tolist()
            amounts = hist["成交额"].astype(float).tolist()

            change_5d = (closes[-1] - closes[-6]) / closes[-6] * 100 if len(closes) >= 6 and closes[-6] != 0 else 0.0
            return_20d = (
                (closes[-1] - closes[-21]) / closes[-21] * 100
                if len(closes) >= 21 and closes[-21] != 0 else 0.0
            )
            recent_vol = sum(volumes[-5:]) / 5 if len(volumes) >= 5 else 0.0
            prior_vol = sum(volumes[-25:-5]) / 20 if len(volumes) >= 25 else recent_vol
            vol_ratio = recent_vol / prior_vol if prior_vol > 0 else 1.0
            recent_amt = sum(amounts[-5:]) / 5 if len(amounts) >= 5 else 0.0
            prior_amt = sum(amounts[-25:-5]) / 20 if len(amounts) >= 25 else recent_amt
            amt_ratio = recent_amt / prior_amt if prior_amt > 0 else 1.0
        except Exception as e:
            logger.warning("[sectors] calc_sector 异常: code=%s error=%s", code, e)
            return None

        return {"code": code, "name": name, "level1": level1, "pe": pe, "pb": pb,
                "change_5d": change_5d, "return_20d": return_20d,
                "vol_ratio": vol_ratio, "amt_ratio": amt_ratio}

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(calc_sector, [row for _, row in spot_df.iterrows()]))
    sector_data = [r for r in results if r is not None]
    if not sector_data:
        logger.warning("[sectors] 所有板块计算均失败")
        return []

    logger.info("[sectors] 成功计算 %d/%d 个板块", len(sector_data), len(results))

    # 归一化五因子
    change_ranks = _normalize_to_100({s["code"]: s["change_5d"] for s in sector_data})
    vol_ranks = _normalize_to_100({s["code"]: s["vol_ratio"] for s in sector_data})

    # f2 资金因子（尝试从 _sector_fund_flow 导入）
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from _sector_fund_flow import fetch_sector_fund_flow
        sector_names = [_normalize_sw_name(s["name"]) for s in sector_data]
        fund_flow_map = fetch_sector_fund_flow(sector_names=sector_names)
        if fund_flow_map:
            norm_fund_map = {_normalize_sw_name(k): v for k, v in fund_flow_map.items()}
            f2_raw = {}
            for s in sector_data:
                norm_name = _normalize_sw_name(s["name"])
                f2_raw[s["code"]] = norm_fund_map.get(norm_name, 0.0)
        else:
            f2_raw = {s["code"]: s["amt_ratio"] for s in sector_data}
    except ImportError:
        f2_raw = {s["code"]: s["amt_ratio"] for s in sector_data}
    f2_ranks = _normalize_to_100(f2_raw)

    pe_ranks = _normalize_to_100({s["code"]: -s["pe"] for s in sector_data})
    pb_ranks = _normalize_to_100({s["code"]: -s["pb"] for s in sector_data})

    market_return_20d = _fetch_market_benchmark_return(window=20)
    if market_return_20d is not None:
        rs_ranks = _normalize_to_100({s["code"]: s["return_20d"] - market_return_20d for s in sector_data})
    else:
        rs_ranks = {s["code"]: 0.0 for s in sector_data}

    items: list[dict[str, Any]] = []
    for s in sector_data:
        code = s["code"]
        f1 = change_ranks.get(code, 0.0)
        f2 = f2_ranks.get(code, 0.0)
        f3 = (pe_ranks.get(code, 0.0) + pb_ranks.get(code, 0.0)) / 2.0
        f4 = rs_ranks.get(code, 0.0)
        f5 = vol_ranks.get(code, 0.0)
        total = f1 * 0.30 + f2 * 0.25 + f3 * 0.20 + f4 * 0.10 + f5 * 0.15
        resonance = total / 10.0
        if total >= 70:
            signal, alert = "强势上攻", "正常"
        elif total >= 50:
            signal, alert = "震荡上行", "关注"
        elif total >= 30:
            signal, alert = "观望", "关注"
        else:
            signal, alert = "弱势", "预警"

        items.append({
            "id": f"{code}__{score_date}", "sectorCode": code, "sectorName": s["name"],
            "swLevel1": s["level1"], "swLevel2": s["name"], "scoreDate": score_date,
            "f1Jingqi": round(f1, 2), "f2Zijin": round(f2, 2), "f3Guzhi": round(f3, 2),
            "f4Beta": round(f4, 2), "f5Nengliang": round(f5, 2),
            "total": round(total, 2), "resonance": round(resonance, 2),
            "signal": signal, "alertLevel": alert, "modelUsed": "akshare-sw-v1",
            "createdAt": created_at,
        })
    return items


def collect_sectors(topN: int = 20) -> dict[str, Any]:
    """采集板块轮动评分"""
    req_id = _gen_request_id()
    _log_request_start(req_id, "*", "sectors", topN=topN)
    t0 = time.perf_counter()

    items = fetch_sector_rotation_scores(topN=topN)
    score_date = items[0]["scoreDate"] if items else datetime.now().strftime("%Y-%m-%d")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    _log_data_summary(req_id, items, f"板块轮动 TOP{topN}")
    _log_request_end(req_id, len(items) > 0, elapsed_ms, sectors=len(items))

    return {
        "success": len(items) > 0,
        "symbol": "*",
        "dimension": "sectors",
        "data": {"sectors": items, "scoreDate": score_date},
        "records": len(items),
        "fetched_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 格式化输出
# ---------------------------------------------------------------------------

def _print_basic(data: dict[str, Any]):
    d = data.get("data") or {}
    print(f"\n  {'字段':<16} {'值'}")
    print(f"  {'─' * 40}")
    print(f"  {'股票名称':<14} {d.get('name', 'N/A')}")
    price = d.get("price")
    if price is not None:
        print(f"  {'最新价':<14} {price:.2f}")
    else:
        print(f"  {'最新价':<14} N/A")
    pe = d.get("pe")
    if pe is not None:
        print(f"  {'市盈率 PE':<14} {pe:.2f}")
    else:
        print(f"  {'市盈率 PE':<14} N/A")
    pb = d.get("pb")
    if pb is not None:
        print(f"  {'市净率 PB':<14} {pb:.2f}")
    else:
        print(f"  {'市净率 PB':<14} N/A")
    mc = d.get('market_cap')
    if mc is not None:
        print(f"  {'总市值':<14} {mc/1e8:.2f} 亿")
    else:
        print(f"  {'总市值':<14} N/A")
    print(f"  {'行业代码':<14} {d.get('industry_code', 'N/A')}")
    print(f"  {'行业名称':<14} {d.get('industry_name', 'N/A')}")
    missing = data.get("missing", [])
    if missing:
        print(f"  ⚠️  缺失字段: {', '.join(missing)}")


def _print_kline(data: dict[str, Any]):
    d = data.get("data") or {}
    bars = d.get("history", [])
    latest = d.get("latest") or {}
    if not bars:
        print("  无 K 线数据")
        return

    range_info = d.get("range", {})
    start = range_info.get("start", "?") if range_info else "?"
    end = range_info.get("end", "?") if range_info else "?"
    print(f"\n  周期: {data.get('dimension', 'kline')}  |  根数: {len(bars)}  |  区间: {start} ~ {end}")
    if latest:
        l_date = latest.get("date", "?")
        l_open = f"{latest.get('open', 0):.2f}" if latest.get('open') is not None else "N/A"
        l_close = f"{latest.get('close', 0):.2f}" if latest.get('close') is not None else "N/A"
        l_high = f"{latest.get('high', 0):.2f}" if latest.get('high') is not None else "N/A"
        l_low = f"{latest.get('low', 0):.2f}" if latest.get('low') is not None else "N/A"
        l_vol = f"{latest.get('volume', 0):.0f}" if latest.get('volume') is not None else "N/A"
        print(f"  最新: {l_date}  开:{l_open}  收:{l_close}  高:{l_high}  低:{l_low}  量:{l_vol}")

    print(f"\n  最近 5 根 K 线:")
    print(f"  {'日期':<14} {'开':>8} {'收':>8} {'高':>8} {'低':>8} {'量':>12}")
    print(f"  {'─' * 62}")
    for bar in bars[-5:]:
        o_str = f"{bar['open']:.2f}" if bar['open'] is not None else "N/A"
        c_str = f"{bar['close']:.2f}" if bar['close'] is not None else "N/A"
        h_str = f"{bar['high']:.2f}" if bar['high'] is not None else "N/A"
        l_str = f"{bar['low']:.2f}" if bar['low'] is not None else "N/A"
        v_str = f"{bar['volume']:.0f}" if bar['volume'] is not None else "N/A"
        print(f"  {bar['date']:<14} {o_str:>8} {c_str:>8} {h_str:>8} {l_str:>8} {v_str:>12}")


def _print_financial(data: dict[str, Any]):
    d = data.get("data") or {}
    if not d:
        print("  无财务数据")
        return
    print(f"\n  {'指标':<20} {'值'}")
    print(f"  {'─' * 40}")
    for key, label in [
        ("report_date", "报告期"),
        ("revenue", "营业总收入(元)"),
        ("net_profit", "归母净利润(元)"),
        ("net_margin", "净利率(%)"),
        ("gross_margin", "毛利率(%)"),
        ("revenue_yoy", "营收同比(%)"),
        ("net_profit_yoy", "净利同比(%)"),
        ("operating_cf", "经营现金流(元)"),
        ("rd_ratio", "研发占比(%)"),
        ("net_assets", "净资产(元)"),
        ("goodwill", "商誉(元)"),
    ]:
        val = d.get(key)
        if val is not None:
            if isinstance(val, float) and abs(val) >= 1e8:
                print(f"  {label:<18} {val/1e8:.2f} 亿")
            elif isinstance(val, float) and abs(val) >= 1e4:
                print(f"  {label:<18} {val/1e4:.2f} 万")
            else:
                print(f"  {label:<18} {val}")


def _print_sectors(data: dict[str, Any]):
    d = data.get("data") or {}
    sectors = d.get("sectors", [])
    score_date = d.get("scoreDate", "?")
    if not sectors:
        print("  无板块数据")
        return
    print(f"\n  板块轮动评分  |  评分日期: {score_date}  |  共 {len(sectors)} 个板块")
    print(f"\n  {'排名':<4} {'板块':<16} {'代码':<12} {'总分':>6} {'景气':>6} {'资金':>6} {'估值':>6} {'Beta':>6} {'量能':>6} {'信号':<8}")
    print(f"  {'─' * 92}")
    for i, s in enumerate(sectors, 1):
        print(f"  {i:<4} {s['sectorName']:<16} {s['sectorCode']:<12} {s['total']:>6.1f} {s['f1Jingqi']:>6.1f} {s['f2Zijin']:>6.1f} {s['f3Guzhi']:>6.1f} {s['f4Beta']:>6.1f} {s['f5Nengliang']:>6.1f} {s['signal']:<8}")


def _format_result(result: dict[str, Any], fmt: str):
    if fmt == "json":
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    elif fmt == "table":
        dim = result.get("dimension", "")
        if dim == "basic":
            _print_basic(result)
        elif dim == "kline":
            _print_kline(result)
        elif dim == "financial":
            _print_financial(result)
        elif dim == "sectors":
            _print_sectors(result)
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="V9 数据采集独立测试脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python test_collect.py 600519
  python test_collect.py 600519 --dim kline
  python test_collect.py 600519 --dim kline --period 5min --count 320
  python test_collect.py 600519 --dim financial
  python test_collect.py --dim sectors --top-n 10
  python test_collect.py 600519 --dim all
  python test_collect.py 600519 --format json
  python test_collect.py 600519 -v --log-file debug.log
        """,
    )
    parser.add_argument("symbol", nargs="?", help="股票代码（如 600519）")
    parser.add_argument(
        "--dim", choices=["basic", "kline", "financial", "sectors", "all"],
        default="basic", help="采集维度 (默认: basic)",
    )
    parser.add_argument("--period", default="daily",
                        help="K线周期: 1min/5min/15min/30min/60min/daily/weekly/monthly (默认: daily)")
    parser.add_argument("--count", type=int, default=60,
                        help="K线数量 (默认: 60)")
    parser.add_argument("--adjust", default="qfq",
                        help="复权方式: qfq/hfq/空 (默认: qfq，仅日级有效)")
    parser.add_argument("--top-n", type=int, default=20,
                        help="板块轮动 TOP N (默认: 20)")
    parser.add_argument("--format", choices=["table", "json"], default="table",
                        help="输出格式 (默认: table)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="启用 DEBUG 日志")
    parser.add_argument("--log-file", type=str, default=None,
                        help="日志文件路径（启用文件日志，自动轮转 5MB×3）")

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)
        for h in logger.handlers:
            h.setLevel(logging.DEBUG)

    if args.log_file:
        _enable_file_logging(args.log_file)

    run_id = _gen_request_id()
    logger.info("=" * 60)
    logger.info("[RUN ▶] id=%s dim=%s symbol=%s", run_id, args.dim, args.symbol or "N/A")
    logger.info("=" * 60)

    print("=" * 60)
    print("  V9 数据采集测试")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Run ID: {run_id}")
    print("=" * 60)

    t0 = time.perf_counter()
    results = []

    try:
        if args.dim == "basic":
            if not args.symbol:
                parser.error("basic 维度需要提供股票代码，如: python test_collect.py 600519 --dim basic")
            result = collect_basic(args.symbol)
            _format_result(result, args.format)
            results.append(result)

        elif args.dim == "kline":
            if not args.symbol:
                parser.error("kline 维度需要提供股票代码")
            result = collect_kline(args.symbol, period=args.period, count=args.count, adjust=args.adjust)
            _format_result(result, args.format)
            results.append(result)

        elif args.dim == "financial":
            if not args.symbol:
                parser.error("financial 维度需要提供股票代码")
            result = collect_financial(args.symbol)
            _format_result(result, args.format)
            results.append(result)

        elif args.dim == "sectors":
            result = collect_sectors(topN=args.top_n)
            _format_result(result, args.format)
            results.append(result)

        elif args.dim == "all":
            if not args.symbol:
                parser.error("all 维度需要提供股票代码")
            print(f"\n{'─' * 60}")
            print(f"  开始全维度采集: {args.symbol}")
            print(f"{'─' * 60}")

            for label, fn in [
                ("基础信息", lambda: collect_basic(args.symbol)),
                ("K线数据", lambda: collect_kline(args.symbol, period="daily", count=60)),
                ("财务数据", lambda: collect_financial(args.symbol)),
            ]:
                print(f"\n▶ 采集 {label} ...")
                try:
                    r = fn()
                    _format_result(r, args.format)
                    results.append(r)
                except Exception as e:
                    logger.error("[ALL] %s 采集异常: %s", label, e, exc_info=True)
                    print(f"  ✗ {label} 采集异常: {e}")
                    results.append({"success": False, "dimension": label, "error": str(e)})

            print(f"\n▶ 采集板块轮动 TOP {args.top_n} ...")
            try:
                r = collect_sectors(topN=args.top_n)
                _format_result(r, args.format)
                results.append(r)
            except Exception as e:
                logger.error("[ALL] 板块轮动采集异常: %s", e, exc_info=True)
                print(f"  ✗ 板块轮动采集异常: {e}")
                results.append({"success": False, "dimension": "sectors", "error": str(e)})

    except Exception as e:
        logger.error("[RUN ✗] 采集异常: %s", e, exc_info=True)
        print(f"\n✗ 采集失败: {e}")
        sys.exit(1)

    elapsed = (time.perf_counter() - t0) * 1000
    success_count = sum(1 for r in results if r.get("success"))
    total_count = len(results)

    print(f"\n{'─' * 60}")
    print(f"  完成: {success_count}/{total_count} 成功  |  耗时: {elapsed:.0f}ms")
    print(f"{'─' * 60}")

    logger.info("[RUN ■] id=%s success=%d/%d elapsed=%.0fms",
                run_id, success_count, total_count, elapsed)

    # 输出失败详情
    failed = [r for r in results if not r.get("success")]
    if failed:
        for r in failed:
            logger.warning("[FAIL] dimension=%s error=%s",
                           r.get("dimension", "?"), r.get("error", "unknown"))

    if success_count < total_count:
        sys.exit(1)


if __name__ == "__main__":
    main()