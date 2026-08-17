"""
V9 数据采集服务接口契约

本文件定义 FastAPI 路由、Pydantic 请求/响应模型与接口签名。
真实 AKShare 调用逻辑由服务端自行补齐，下面给出每个端点的推荐实现。

启动示例（需自行安装依赖）：
    pip install -r requirements.txt
    uvicorn collect_endpoints:app --host 0.0.0.0 --port 8000 --reload
"""

from datetime import datetime, timedelta
from typing import Any, Optional
import logging
import os
import re
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 日志级别通过环境变量控制，默认 INFO，调试可设 LOG_LEVEL=DEBUG
_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("v9-data-collector")


# ---------------------------------------------------------------------------
# 性能计时与结构化日志工具
# ---------------------------------------------------------------------------

import contextlib
from contextlib import contextmanager


@contextmanager
def _timed_operation(label: str, **kwargs: Any):
    """上下文管理器：为任意代码块添加耗时日志（debug 级别）。

    用法:
        with _timed_operation("fetch_tencent_kline", symbol="600519", period="daily"):
            do_work()

    输出:
        [timing] fetch_tencent_kline start symbol=600519 period=daily
        [timing] fetch_tencent_kline done elapsed=0.234ms
    """
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
    logger.debug("[timing] %s start %s", label, extra)
    t0 = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info("[timing] %s done elapsed=%.1fms %s", label, elapsed_ms, extra)


def _summarize_data(data: Any, max_fields: int = 8) -> str:
    """将任意数据对象序列化为简短摘要日志字符串，避免日志膨胀。"""
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
    if hasattr(data, "model_dump"):
        return _summarize_data(data.model_dump(), max_fields)
    return str(data)[:200]

app = FastAPI(title="V9 Data Collector", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Prometheus 监控指标初始化
# ---------------------------------------------------------------------------
try:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from lib.prometheus_exporter import init_metrics, record_cache_access, record_sector_score_duration, record_akshare_fallback, update_cache_entries, get_metrics_summary
    init_metrics(app)
    logger.info("[prometheus] 监控指标已初始化，/metrics 端点已注册")
except Exception as _prom_err:
    logger.warning("[prometheus] 监控指标初始化失败（降级为日志模式）: %s", _prom_err)
    # 创建空的占位符函数
    def init_metrics(app=None): pass
    def record_cache_access(cache_type, hit, latency_ms=0.0): pass
    def record_sector_score_duration(source, duration_ms): pass
    def record_akshare_fallback(endpoint): pass
    def update_cache_entries(cache_type, count): pass
    def get_metrics_summary(): return "[prometheus] 降级模式"

# ---------------------------------------------------------------------------
# 全局 HTTP 请求日志中间件（记录每个请求的 method/path/status/耗时）
# ---------------------------------------------------------------------------
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class _RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件：记录 method / path / status_code / duration_ms / client_ip。

    日志格式: [http] POST /api/collect/basic status=200 duration=123.4ms client=127.0.0.1
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 跳过健康检查的详细日志（高频且无调试价值）
        is_health = request.url.path == "/health"

        t0 = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = (time.perf_counter() - t0) * 1000
            logger.error(
                "[http] %s %s status=500 duration=%.1fms client=%s error=%s",
                request.method, request.url.path, duration_ms,
                request.client.host if request.client else "unknown", exc,
            )
            raise

        duration_ms = (time.perf_counter() - t0) * 1000
        status = response.status_code
        client_ip = request.client.host if request.client else "unknown"

        if is_health:
            # 健康检查仅 debug 级别，避免日志刷屏
            logger.debug(
                "[http] %s %s status=%d duration=%.1fms client=%s",
                request.method, request.url.path, status, duration_ms, client_ip,
            )
        elif status >= 400:
            logger.warning(
                "[http] %s %s status=%d duration=%.1fms client=%s",
                request.method, request.url.path, status, duration_ms, client_ip,
            )
        else:
            logger.info(
                "[http] %s %s status=%d duration=%.1fms client=%s",
                request.method, request.url.path, status, duration_ms, client_ip,
            )

        return response


app.add_middleware(_RequestLoggingMiddleware)


# ---------------------------------------------------------------------------
# 通用模型
# ---------------------------------------------------------------------------


class CollectResponse(BaseModel):
    """通用采集响应"""

    success: bool
    symbol: str
    dimension: str
    data: Optional[dict[str, Any]] = None
    records: int = 0
    error: Optional[str] = None
    fetched_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class HealthCheckResponse(BaseModel):
    """健康检查响应"""

    status: str
    service: str
    version: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# 基本信息采集
# ---------------------------------------------------------------------------


class BasicCollectRequest(BaseModel):
    symbol: str


class BasicCollectData(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    pe: Optional[float] = None
    pb: Optional[float] = None
    roe: Optional[float] = None
    market_cap: Optional[float] = None
    industry_code: Optional[str] = None


# ---------------------------------------------------------------------------
# 申万行业代码映射表（name → code，24h 缓存）
# ---------------------------------------------------------------------------

_SW_MAP_CACHE: dict[str, Any] = {"data": None, "ts": 0.0}
_SW_MAP_TTL = 86400  # 申万行业分类调整频率低，缓存 24 小时


def _normalize_sw_name(name: str) -> str:
    """归一化申万行业名称：去除尾部罗马数字后缀(II/Ⅰ/Ⅱ/Ⅲ/Ⅳ)及首尾空白。

    申万二级名称常带 "II" 后缀（如 "白酒II"），而 stock_individual_info_em
    返回的行业名通常无此后缀（如 "白酒"），归一化后可精确匹配。
    """
    return re.sub(r"[\sⅠⅡⅢⅣIV]+$", "", str(name)).strip()


def _get_sw_industry_map() -> dict[str, dict[str, str]] | None:
    """获取申万行业名称→代码映射（二级 + 一级），带 24h 缓存。

    数据源：
    - ak.sw_index_second_info()：申万二级行业（行业代码 / 行业名称）
    - ak.sw_index_first_info()：申万一级行业（行业代码 / 行业名称）

    返回 {"second": {name: code}, "first": {name: code}}，失败返回 None。
    """
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

    second_map: dict[str, str] = {}
    for _, row in second_df.iterrows():
        name = str(row["行业名称"]).strip()
        code = str(row["行业代码"]).strip()
        second_map[name] = code
        second_map[_normalize_sw_name(name)] = code  # 归一化键，兼容无后缀名

    first_map: dict[str, str] = {}
    for _, row in first_df.iterrows():
        first_map[str(row["行业名称"]).strip()] = str(row["行业代码"]).strip()

    data = {"second": second_map, "first": first_map}
    _SW_MAP_CACHE["data"] = data
    _SW_MAP_CACHE["ts"] = now
    logger.info("[SW映射] 申万行业映射表已加载: 二级 %d 条, 一级 %d 条", len(second_map), len(first_map))
    return data


def resolve_sw_industry_code(industry_name: str | None) -> str | None:
    """将行业名称解析为申万二级代码，实现精确代码匹配。

    匹配顺序：
    1. 申万二级名称精确匹配（如 "白酒II"）
    2. 申万二级名称归一化匹配（如 "白酒" → 匹配 "白酒II" 的代码）

    注意：stock_individual_info_em 的"行业"字段为东财/证监会行业分类，
    部分个股对应申万一级名称（如 "银行"），无法精确映射到申万二级代码。
    此时返回 None，前端 isHotSector 会回退到 sectorName 名称匹配兜底，
    避免 industryCode 填入非二级代码而阻断匹配链路。

    @see hot-momentum-strategy.md §2.5.4 申万二级代码精确匹配
    """
    if not industry_name:
        return None
    mapping = _get_sw_industry_map()
    if not mapping:
        return None
    name = industry_name.strip()
    norm = _normalize_sw_name(name)
    second = mapping["second"]
    if name in second:
        return second[name]
    if norm and norm != name and norm in second:
        return second[norm]
    return None


# ---------------------------------------------------------------------------
# 腾讯行情直连（price/pe/pb/kline 真实数据源，替代被东财封禁的 akshare 接口）
# ---------------------------------------------------------------------------


def _safe_float(val: Any) -> float | None:
    """安全转 float，空值/非数字返回 None"""
    if val is None or str(val).strip() == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _to_tencent_code(symbol: str) -> str:
    """将 6 位代码转为腾讯格式（sh600519 / sz000001 / bj832000）"""
    clean = symbol.split(".")[0].upper()
    if clean.startswith("6"):
        return f"sh{clean}"
    elif clean.startswith(("0", "3", "2")):
        return f"sz{clean}"
    elif clean.startswith(("8", "4", "9")):
        return f"bj{clean}"
    return f"sh{clean}"


def fetch_tencent_quote(symbol: str) -> dict[str, Any] | None:
    """
    从腾讯实时行情 API 获取 price / pe / pb / 总市值 / 股票简称。

    API: https://qt.gtimg.cn/q=sh600519
    字段索引: [1]=股票简称, [3]=price, [39]=PE, [47]=PB, [46]=总市值(亿)
    """
    import requests

    tc = _to_tencent_code(symbol)
    url = f"https://qt.gtimg.cn/q={tc}"
    with _timed_operation("tencent_quote", symbol=symbol, tencent_code=tc):
        try:
            logger.info("[tencent_quote] 请求腾讯行情API: symbol=%s url=%s timeout=8s", symbol, url)
            t0 = time.perf_counter()
            r = requests.get(url, timeout=8, headers={"Referer": "https://gu.qq.com/"})
            http_ms = (time.perf_counter() - t0) * 1000
            logger.info(
                "[tencent_quote] HTTP响应: symbol=%s status=%d elapsed=%.1fms body_len=%d encoding=%s",
                symbol, r.status_code, http_ms, len(r.content), r.encoding,
            )
            # 腾讯行情接口历史上返回 GBK/GB18030，但近期部分节点返回 UTF-8
            # 采用 UTF-8 优先 + GBK 回退策略
            raw_text = r.content.decode("utf-8", errors="replace")
            if "\ufffd" in raw_text:
                # 存在替换字符，说明不是 UTF-8，改用 GBK
                raw_text = r.content.decode("gbk", errors="replace")
                logger.debug("[tencent_quote] 编码检测: symbol=%s 回退到 GBK 解码", symbol)
            parts = raw_text.split('="')
            if len(parts) < 2:
                logger.warning("[tencent_quote] 响应解析失败: symbol=%s parts_len=%d (期望>=2)", symbol, len(parts))
                return None
            fields = parts[1].strip('";\n').split("~")
            if len(fields) < 50:
                logger.warning("[tencent_quote] 字段数不足: symbol=%s fields_len=%d (期望>=50)", symbol, len(fields))
                return None
            market_cap_yi = _safe_float(fields[46])
            result = {
                "name": fields[1] if len(fields) > 1 and fields[1] else None,
                "price": _safe_float(fields[3]),
                "pe": _safe_float(fields[39]),
                "pb": _safe_float(fields[47]),
                "market_cap": market_cap_yi * 1e8 if market_cap_yi else None,
            }
            logger.info("[tencent_quote] 行情获取成功: symbol=%s name=%s price=%.2f pe=%.1f pb=%.1f market_cap=%.0f亿",
                        symbol, result["name"], result["price"] or 0, result["pe"] or 0, result["pb"] or 0,
                        market_cap_yi or 0)
            return result
        except requests.exceptions.Timeout as e:
            logger.error("[tencent_quote] 网络超时（timeout=8s，疑似网络波动）: symbol=%s error=%s", symbol, e)
            return None
        except Exception as e:
            logger.error("[tencent_quote] 获取失败: symbol=%s error=%s", symbol, e, exc_info=True)
            return None


# ---------------------------------------------------------------------------
# 行业信息回退源（当 AKShare stock_individual_info_em 被封时使用）
# ---------------------------------------------------------------------------


def fetch_industry_fallback(symbol: str) -> dict[str, Any] | None:
    """
    回退获取行业信息，依次尝试：
    1. AKShare stock_individual_spot_xq（雪球源，使用不同域名不易被封）
    2. Tencent 股票扩展行情中的行业分类字段
    3. 返回 None，前端 sectorName 名称匹配兜底
    """
    with _timed_operation("industry_fallback", symbol=symbol):
        clean = symbol.split(".")[0].upper()

        # ---- 方案 1: stock_individual_spot_xq（雪球）----
        try:
            import akshare as ak
            xq_symbol = f"SZ{clean}" if clean.startswith(("0", "3")) else f"SH{clean}"
            df = ak.stock_individual_spot_xq(symbol=xq_symbol)
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    col_name = str(row.get("item", ""))
                    col_val = row.get("value")
                    if "行业" in col_name or "所属" in col_name or "公司" in col_name:
                        industry_name = str(col_val).strip() if col_val else None
                        if industry_name and len(industry_name) < 20:
                            sw_code = resolve_sw_industry_code(industry_name)
                            logger.info("[industry_fallback] 雪球源成功: symbol=%s industry=%s sw_code=%s",
                                        symbol, industry_name, sw_code)
                            return {"industry_name": industry_name, "industry_code": sw_code}
        except Exception as e:
            logger.info("[industry_fallback] 雪球源 stock_individual_spot_xq 失败（将尝试腾讯源）: symbol=%s error=%s", symbol, e)

        # ---- 方案 2: Tencent 行业接口 + 深度查找 ----
        try:
            import requests
            tc = _to_tencent_code(symbol)
            url = (
                f"https://proxy.finance.qq.com/ifzqgtimg/appstock/app/"
                f"newflvcode/getStockIndustry?stockCode={tc}"
            )
            logger.info("[industry_fallback] 请求腾讯行业接口: symbol=%s url=%s timeout=6s", symbol, url)
            t0 = time.perf_counter()
            r = requests.get(url, timeout=6, headers={"Referer": "https://gu.qq.com/"})
            body = r.text.strip() if r.text else ""
            logger.info(
                "[industry_fallback] 腾讯行业响应: symbol=%s status=%d elapsed=%.1fms body_len=%d body=%s",
                symbol, r.status_code, (time.perf_counter() - t0) * 1000, len(body), repr(body[:200]),
            )
            if r.status_code == 200 and body:
                try:
                    data = r.json()
                    if data:
                        industry_name = _deep_find_first(
                            data, {"industryName", "industry", "swIndustry", "name", "stockIndustry"}
                        )
                        if industry_name:
                            sw_code = resolve_sw_industry_code(industry_name)
                            logger.info("[industry_fallback] 腾讯源成功: symbol=%s industry=%s sw_code=%s",
                                        symbol, industry_name, sw_code)
                            return {"industry_name": industry_name, "industry_code": sw_code}
                except (ValueError, TypeError):
                    logger.info("[industry_fallback] 腾讯行业响应 JSON 解析失败: symbol=%s", symbol)
        except requests.exceptions.Timeout as e:
            logger.error("[industry_fallback] 腾讯行业接口网络超时（timeout=6s，疑似网络波动）: symbol=%s error=%s", symbol, e)
        except Exception as e:
            logger.info("[industry_fallback] 腾讯行业接口失败: symbol=%s error=%s", symbol, e)

        logger.warning("[industry_fallback] 所有回退源均失败: symbol=%s", symbol)
        return None


def _deep_find_first(obj: Any, keys: set[str]) -> str | None:
    """在任意嵌套 dict/list 结构中递归查找第一个匹配 key 的字符串值。"""
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


# 周期映射：前端标准 period → 腾讯 API period 参数
_TENCENT_PERIOD_MAP: dict[str, str] = {
    "1min": "1min",
    "5min": "5min",
    "15min": "15min",
    "30min": "30min",
    "60min": "60min",
    "daily": "day",
    "weekly": "week",
    "monthly": "month",
}

# 日级周期集合（支持前复权/后复权）
_DAILY_PERIODS = {"daily", "weekly", "monthly"}

# 分钟级周期集合（不支持复权）
_INTRADAY_PERIODS = {"1min", "5min", "15min", "30min", "60min"}


def fetch_tencent_kline(
    symbol: str,
    count: int = 60,
    period: str = "daily",
    adjust: str = "qfq",
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict[str, Any]] | None:
    """
    从腾讯 K 线 API 获取多周期K线数据。

    支持周期:
      - 日级: daily(日线), weekly(周线), monthly(月线) — 支持前复权(qfq)/后复权(hfq)/不复权("")
      - 分钟级: 1min, 5min, 15min, 30min, 60min — 不支持复权

    API:
      - 日级: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,60,qfq
      - 分钟级: https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh600519,5min,,,320

    字段: [datetime, open, close, high, low, volume, amount?]
    """
    import requests

    tc = _to_tencent_code(symbol)
    tencent_period = _TENCENT_PERIOD_MAP.get(period, "day")

    if period in _INTRADAY_PERIODS:
        url = (
            f"https://web.ifzq.gtimg.cn/appstock/app/kline/kline"
            f"?param={tc},{tencent_period},,,{count}"
        )
        logger.info("[tencent_kline] 请求分钟级K线: symbol=%s period=%s count=%d url=%s timeout=10s", symbol, period, count, url)
    else:
        adj = adjust if adjust else ""
        url = (
            f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
            f"?param={tc},{tencent_period},{start_date or ''},{end_date or ''},{count},{adj}"
        )
        logger.info("[tencent_kline] 请求日级K线: symbol=%s period=%s adjust=%s count=%d url=%s timeout=10s", symbol, period, adj, count, url)

    with _timed_operation("tencent_kline", symbol=symbol, period=period, count=count, adjust=adjust):
        try:
            t0 = time.perf_counter()
            r = requests.get(url, timeout=10)
            http_ms = (time.perf_counter() - t0) * 1000
            data = r.json()
            kline_data = data.get("data", {}).get(tc, {})
            logger.info("[tencent_kline] HTTP响应: symbol=%s status=%d elapsed=%.1fms body_keys=%s",
                        symbol, r.status_code, http_ms, list(kline_data.keys()))

            # 日级数据可能存在 day/qfqday/hfqday/week/month 等多个 key
            if period in _DAILY_PERIODS:
                key_candidates = [tencent_period]
                if adjust == "qfq":
                    key_candidates = [f"qfq{tencent_period}", tencent_period]
                elif adjust == "hfq":
                    key_candidates = [f"hfq{tencent_period}", tencent_period]
                day_list = None
                matched_key = None
                for key in key_candidates:
                    day_list = kline_data.get(key)
                    if day_list:
                        matched_key = key
                        break
                if matched_key:
                    logger.debug("[tencent_kline] 匹配到数据源key: symbol=%s key=%s (候选=%s)",
                                symbol, matched_key, key_candidates)
            else:
                day_list = kline_data.get(tencent_period)

            if not day_list:
                logger.warning("[tencent_kline] K线数据为空: symbol=%s period=%s tencent_code=%s data_keys=%s",
                               symbol, period, tc, list(kline_data.keys()))
                return None

            bars: list[dict[str, Any]] = []
            for item in day_list:
                if len(item) >= 6:
                    bars.append({
                        "date": item[0],
                        "open": _safe_float(item[1]),
                        "close": _safe_float(item[2]),
                        "high": _safe_float(item[3]),
                        "low": _safe_float(item[4]),
                        "volume": _safe_float(item[5]),
                        "amount": _safe_float(item[6]) if len(item) > 6 else 0.0,
                    })

            if not bars:
                logger.warning("[tencent_kline] K线列表为空: symbol=%s period=%s", symbol, period)
                return None

            first = bars[0]
            last = bars[-1]
            logger.info(
                "[tencent_kline] K线获取成功: symbol=%s period=%s adjust=%s bars=%d range=%s~%s latest_close=%.2f latest_vol=%.0f",
                symbol, period, adjust, len(bars),
                first["date"], last["date"],
                last["close"] or 0, last["volume"] or 0,
            )
            return bars
        except requests.exceptions.Timeout as e:
            logger.error("[tencent_kline] 网络超时（timeout=10s，疑似网络波动）: symbol=%s period=%s error=%s", symbol, period, e)
            return None
        except Exception as e:
            logger.error("[tencent_kline] 获取失败: symbol=%s period=%s error=%s", symbol, period, e, exc_info=True)
            return None


def fetch_individual_info(symbol: str) -> dict[str, Any] | None:
    """
    调用 AKShare stock_individual_info_em 获取个股基础信息，失败时回退 adata。

    返回字段：
    - name: 股票简称（adata 回退时不提供，为 None）
    - industry_name: 行业名称（AKShare 路径=东财/证监会原始值；adata 路径=申万二级名）
    - industry_code: 申万二级代码（经映射表解析，精确代码匹配；无法解析时为 None）
    - market_cap: 总市值（元，adata 回退时不提供，为 None）

    回退策略（按 hot-momentum-strategy.md §2.5.4 申万二级代码精确匹配）：
    1. AKShare 主路径：stock_individual_info_em → 东财行业名 → resolve_sw_industry_code
    2. AKShare 不可用 / 调用失败 / 返回空 → 直接走 adata 回退
    3. AKShare 成功但行业名无法映射到申万二级（如东财返回申万一级 "银行"）→ 走 adata 回退
    4. adata 回退成功且能解析申万二级代码 → 用 adata 结果覆盖 industry_name/industry_code
       （name/market_cap 仍保留 AKShare 的值，因为 adata 不提供这两个字段）
    """
    with _timed_operation("fetch_individual_info", symbol=symbol):
        logger.info("[basic] 开始获取个股基础信息: symbol=%s", symbol)
        # ------------------------------------------------------------------
        # 1. AKShare 主路径
        # ------------------------------------------------------------------
        clean_symbol = symbol.split(".")[0].upper()
        ak_info: dict[str, Any] | None = None
        ak_industry_name: str | None = None

        try:
            import akshare as ak
        except ImportError:
            logger.warning("[basic] akshare 未安装，跳过主路径，直接走 adata 回退: %s", symbol)
        else:
            try:
                t_ak = time.perf_counter()
                logger.info("[basic] 请求 AKShare stock_individual_info_em: symbol=%s", clean_symbol)
                df = ak.stock_individual_info_em(symbol=clean_symbol)
                ak_ms = (time.perf_counter() - t_ak) * 1000
                logger.info("[basic] AKShare stock_individual_info_em 返回: symbol=%s rows=%d elapsed=%.1fms",
                            symbol, 0 if df is None else len(df), ak_ms)
            except Exception as e:
                logger.warning("[basic] stock_individual_info_em 调用失败，回退 adata: %s, %s", symbol, e)
            else:
                if df is None or df.empty or "item" not in df.columns or "value" not in df.columns:
                    logger.warning("[basic] stock_individual_info_em 返回空，回退 adata: %s", symbol)
                else:
                    ak_info = {}
                    # item/value 两列，按行遍历取值
                    for _, row in df.iterrows():
                        item = str(row["item"]).strip()
                        value = row["value"]
                        if item == "股票简称":
                            ak_info["name"] = str(value).strip() if value is not None else None
                        elif item == "行业":
                            ak_industry_name = str(value).strip() if value is not None else None
                            ak_info["industry_name"] = ak_industry_name
                        elif item == "总市值":
                            try:
                                ak_info["market_cap"] = float(value)
                            except (TypeError, ValueError):
                                pass

                    # 通过申万行业代码映射表解析为申万二级代码（精确代码匹配）
                    sw_code = resolve_sw_industry_code(ak_industry_name)
                    ak_info["industry_code"] = sw_code
                    if sw_code:
                        logger.info(
                            "[basic] AKShare 解析成功: symbol=%s name=%s 行业=%s → 申万二级代码=%s",
                            symbol, ak_info.get("name"), ak_industry_name, sw_code,
                        )
                        return ak_info
                    logger.info(
                        "[basic] AKShare 行业未命中映射，尝试 adata 回退: symbol=%s 东财行业=%s",
                        symbol, ak_industry_name,
                    )

        # ------------------------------------------------------------------
        # 2. adata 回退路径
        # ------------------------------------------------------------------
        adata_info = _fetch_individual_info_adata(symbol)

        # 2a. adata 成功且解析到申万二级代码：优先用 adata 的行业信息，
        #     但保留 AKShare 的 name/market_cap（adata 不提供这两个字段）
        if adata_info and adata_info.get("industry_code"):
            merged: dict[str, Any] = {
                "name": (ak_info or {}).get("name"),
                "industry_name": adata_info.get("industry_name"),
                "industry_code": adata_info.get("industry_code"),
                "market_cap": (ak_info or {}).get("market_cap"),
            }
            logger.info(
                "[basic] adata 回退成功: symbol=%s 申万二级=%s → 代码=%s name=%s market_cap=%s",
                symbol, adata_info.get("industry_name"), adata_info.get("industry_code"),
                merged.get("name"), merged.get("market_cap"),
            )
            return merged

        # 2b. adata 也失败：回退到 AKShare 的原始 info（保留 industry_code=None，
        #     前端 isHotSector 会回退到 sectorName 名称匹配兜底）
        if ak_info:
            logger.warning(
                "[basic] adata 回退失败，沿用 AKShare 原始结果（industry_code=None，前端走名称匹配）: symbol=%s",
                symbol,
            )
            return ak_info

        logger.warning("[basic] AKShare 与 adata 均不可用，返回 None: %s", symbol)
        return None


def _fetch_individual_info_adata(symbol: str) -> dict[str, Any] | None:
    """adata 回退路径：获取申万二级行业名称并解析为官方代码。

    adata 通过百度股市通获取申万一级/二级行业，可补足 AKShare
    stock_individual_info_em 仅返回东财一级名称（如 "银行"）无法映射到
    申万二级代码的问题。

    注意：adata 默认请求头携带过期 Cookie，会被百度以 403 拒绝，
    需要预先 patch `baidu_headers.json_headers` 为现代浏览器请求头。

    返回 {"industry_name": str, "industry_code": str}，失败返回 None。
    name/market_cap 由调用方从 AKShare 结果中保留，此处不提供。
    """
    try:
        import adata
        from adata.common.headers import baidu_headers
    except ImportError:
        logger.warning("[basic] adata 未安装，无法回退: %s", symbol)
        return None

    # Patch 百度请求头（去除过期 Cookie，添加浏览器 UA/Referer，规避 403）
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
        logger.warning("[basic] adata get_industry_sw 调用失败: %s, %s", symbol, e)
        return None
    if df is None or df.empty:
        logger.warning("[basic] adata 返回空: %s", symbol)
        return None

    # 提取申万二级行业名称
    level2_name: str | None = None
    for _, row in df.iterrows():
        if str(row.get("industry_type", "")).strip() == "申万二级":
            level2_name = str(row.get("industry_name", "")).strip()
            break
    if not level2_name:
        logger.warning("[basic] adata 未找到申万二级行业: %s", symbol)
        return None

    # 解析为官方申万二级代码
    sw_code = resolve_sw_industry_code(level2_name)
    if not sw_code:
        logger.warning("[basic] adata 行业未映射: %s, 申万二级名=%s", symbol, level2_name)
        return None

    return {"industry_name": level2_name, "industry_code": sw_code}


@app.post("/api/collect/basic", response_model=CollectResponse)
def collect_basic(request: BasicCollectRequest) -> CollectResponse:
    """
    拉取单只股票基础信息。

    数据源优先级（多路回退）：
    - name: 腾讯行情 → AKShare → 其他
    - industry_code: AKShare stock_individual_info_em → 雪球源 → 腾讯源
    - price/pe/pb: 腾讯行情 qt.gtimg.cn
    - market_cap: AKShare → 腾讯行情
    """
    with _timed_operation("route.collect_basic", symbol=request.symbol):
        logger.info("[route] POST /api/collect/basic: symbol=%s", request.symbol)
        try:
            info = fetch_individual_info(request.symbol)
            tq = fetch_tencent_quote(request.symbol)

            # ---- name 回退链 ----
            # 1) 腾讯行情返回的 name（最可靠，已验证稳定）
            stock_name = (tq or {}).get("name")
            # 2) AKShare 返回的 name
            if not stock_name:
                stock_name = (info or {}).get("name")
            if not stock_name:
                logger.warning("[route] collect_basic name 缺失: symbol=%s", request.symbol)

            # ---- industry_code 回退链 ----
            industry_code = (info or {}).get("industry_code")
            industry_name = (info or {}).get("industry_name")
            # 1) AKShare 主路径未命中申万二级 → 启动回退源
            if not industry_code:
                fallback = fetch_industry_fallback(request.symbol)
                if fallback:
                    industry_code = fallback.get("industry_code")
                    industry_name = fallback.get("industry_name")
                    logger.info(
                        "[route] collect_basic 行业回退命中: symbol=%s source=fallback industry=%s code=%s",
                        request.symbol, industry_name, industry_code,
                    )

            data = BasicCollectData(
                name=stock_name,
                industry_code=industry_code,
                market_cap=(info or {}).get("market_cap") or (tq or {}).get("market_cap"),
                price=(tq or {}).get("price"),
                pe=(tq or {}).get("pe"),
                pb=(tq or {}).get("pb"),
            )

            # 检查数据源完整性
            missing = []
            if not data.name:
                missing.append("name")
            if not data.price:
                missing.append("price")
            if not data.industry_code:
                missing.append("industry_code")
            if not data.pe:
                missing.append("pe")

            if missing:
                logger.warning(
                    "[route] collect_basic 部分字段缺失: symbol=%s missing=%s data=%s",
                    request.symbol, missing, _summarize_data(data.model_dump()),
                )

            logger.info(
                "[route] collect_basic 完成: symbol=%s name=%s price=%.2f pe=%s pb=%s industry_code=%s missing=%d",
                request.symbol, data.name, data.price or 0, data.pe, data.pb,
                data.industry_code, len(missing),
            )
            return CollectResponse(
                success=True,
                symbol=request.symbol,
                dimension="basic",
                data=data.model_dump(),
                records=1,
                fetched_at=datetime.now().isoformat(),
            )
        except Exception as e:
            logger.error("[route] collect_basic 异常: symbol=%s error=%s", request.symbol, e, exc_info=True)
            raise


# ---------------------------------------------------------------------------
# K线数据采集
# ---------------------------------------------------------------------------


class KlineCollectRequest(BaseModel):
    symbol: str
    period: str = "daily"  # 1min|5min|15min|30min|60min|daily|weekly|monthly
    adjust: str = "qfq"  # qfq|hfq|""（仅日级周期有效）
    count: int = 320  # 返回K线数量，日级默认320根，分钟级默认320根
    start_date: Optional[str] = None  # 仅日级周期有效，格式 YYYY-MM-DD
    end_date: Optional[str] = None


class KlineBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


class KlineCollectData(BaseModel):
    latest: Optional[KlineBar] = None
    history: list[KlineBar] = []


@app.post("/api/collect/kline", response_model=CollectResponse)
def collect_kline(request: KlineCollectRequest) -> CollectResponse:
    """
    拉取单只股票多周期K线数据。

    支持周期:
      - 日级: daily/weekly/monthly（支持前复权qfq/后复权hfq/不复权""）
      - 分钟级: 1min/5min/15min/30min/60min（不支持复权，adjust参数忽略）

    数据源：腾讯 fqkline API（日级）/ kline API（分钟级）
    """
    with _timed_operation("route.collect_kline", symbol=request.symbol, period=request.period, count=request.count):
        logger.info(
            "[route] POST /api/collect/kline: symbol=%s period=%s adjust=%s count=%d",
            request.symbol, request.period, request.adjust, request.count,
        )
        # 分钟级周期忽略 adjust
        effective_adjust = request.adjust if request.period in _DAILY_PERIODS else ""

        try:
            bars = fetch_tencent_kline(
                request.symbol,
                count=request.count,
                period=request.period,
                adjust=effective_adjust,
                start_date=request.start_date,
                end_date=request.end_date,
            )
            if not bars:
                logger.warning(
                    "[route] collect_kline 返回空: symbol=%s period=%s adjust=%s count=%d",
                    request.symbol, request.period, effective_adjust, request.count,
                )
                return CollectResponse(
                    success=False,
                    symbol=request.symbol,
                    dimension="kline",
                    error=f"腾讯K线API返回空或请求失败(period={request.period})",
                    fetched_at=datetime.now().isoformat(),
                )

            history: list[KlineBar] = [
                KlineBar(
                    date=b["date"],
                    open=b["open"] or 0.0,
                    high=b["high"] or 0.0,
                    low=b["low"] or 0.0,
                    close=b["close"] or 0.0,
                    volume=b["volume"] or 0.0,
                    amount=b.get("amount") or 0.0,
                )
                for b in bars
            ]
            latest = history[-1] if history else None
            logger.info(
                "[route] collect_kline 完成: symbol=%s period=%s bars=%d latest=%s close=%.2f",
                request.symbol, request.period, len(history),
                latest.date if latest else "N/A",
                latest.close if latest else 0,
            )
            return CollectResponse(
                success=True,
                symbol=request.symbol,
                dimension="kline",
                data=KlineCollectData(latest=latest, history=history).model_dump(),
                records=len(history),
                fetched_at=datetime.now().isoformat(),
            )
        except Exception as e:
            logger.error("[route] collect_kline 异常: symbol=%s period=%s error=%s", request.symbol, request.period, e, exc_info=True)
            raise


# ---------------------------------------------------------------------------
# 财务数据采集
# ---------------------------------------------------------------------------


class FinancialCollectRequest(BaseModel):
    symbol: str
    use_llm: bool = False  # True 时走 LLM 解析路径（PDF文本提取 + LLM JSON抽取）


class FinancialCollectData(BaseModel):
    report_date: Optional[str] = None
    revenue: Optional[float] = None
    revenue_yoy: Optional[float] = None
    net_profit: Optional[float] = None
    net_profit_yoy: Optional[float] = None
    gross_margin: Optional[float] = None
    net_margin: Optional[float] = None
    operating_cf: Optional[float] = None
    rd_ratio: Optional[float] = None
    receivables: Optional[float] = None
    inventory_turnover_days: Optional[float] = None
    interest_bearing_debt: Optional[float] = None
    goodwill: Optional[float] = None
    net_assets: Optional[float] = None
    shareholder_pledge: Optional[float] = None


def fetch_real_financial_data(symbol: str) -> dict[str, Any] | None:
    """
    从 AKShare 获取真实财务数据。

    数据源：
    - stock_financial_analysis_indicator：比率类指标（毛利率/净利率/ROE/增长率/周转天数）
    - stock_financial_abstract：绝对值指标（营收/净利润/现金流/净资产/应收/负债/商誉）
    """
    import akshare as ak

    with _timed_operation("financial_data", symbol=symbol):
        logger.info("[financial] 开始获取财务数据: symbol=%s", symbol)
        clean = symbol.split(".")[0].upper()
        result: dict[str, Any] = {}

        # 1. 比率类指标（stock_financial_analysis_indicator）
        try:
            t0 = time.perf_counter()
            df = ak.stock_financial_analysis_indicator(symbol=clean, start_year="2023")
            elapsed_ms = (time.perf_counter() - t0) * 1000
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
                if total_assets and debt_ratio is not None:
                    result["net_assets"] = total_assets * (1 - debt_ratio / 100)
                    result["interest_bearing_debt"] = total_assets * debt_ratio / 100
                logger.debug(
                    "[financial] stock_financial_analysis_indicator 成功: symbol=%s rows=%d elapsed=%.1fms report_date=%s net_margin=%.2f revenue_yoy=%.2f",
                    symbol, len(df), elapsed_ms, result.get("report_date"), result.get("net_margin") or 0, result.get("revenue_yoy") or 0,
                )
            else:
                logger.warning("[financial] stock_financial_analysis_indicator 返回空: symbol=%s elapsed=%.1fms", symbol, elapsed_ms)
        except Exception as e:
            logger.error("[financial] stock_financial_analysis_indicator 失败: symbol=%s error=%s", symbol, e, exc_info=True)

        # 2. 绝对值指标（stock_financial_abstract）
        try:
            t1 = time.perf_counter()
            df2 = ak.stock_financial_abstract(symbol=clean)
            elapsed2_ms = (time.perf_counter() - t1) * 1000
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
                        elif "经营活动产生的现金流量净额" in metric or metric == "经营活动现金流量净额":
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
                logger.debug(
                    "[financial] stock_financial_abstract 成功: symbol=%s rows=%d elapsed=%.1fms revenue=%s net_profit=%s rd_ratio=%s",
                    symbol, len(df2), elapsed2_ms,
                    f"{result.get('revenue', 0):.0f}" if result.get("revenue") else "N/A",
                    f"{result.get('net_profit', 0):.0f}" if result.get("net_profit") else "N/A",
                    result.get("rd_ratio"),
                )
            else:
                logger.warning("[financial] stock_financial_abstract 返回空: symbol=%s", symbol)
        except Exception as e:
            logger.error("[financial] stock_financial_abstract 失败: symbol=%s error=%s", symbol, e, exc_info=True)

        if result:
            logger.info(
                "[financial] 财务数据获取成功: symbol=%s revenue=%s net_profit=%s net_margin=%s report_date=%s",
                symbol,
                f"{result.get('revenue', 0):.0f}" if result.get("revenue") else "N/A",
                f"{result.get('net_profit', 0):.0f}" if result.get("net_profit") else "N/A",
                f"{result.get('net_margin', 0):.2f}%" if result.get("net_margin") else "N/A",
                result.get("report_date", "N/A"),
            )
        else:
            logger.warning("[financial] 财务数据全部为空: symbol=%s", symbol)
        return result if result else None


def _collect_financial_llm(symbol: str) -> CollectResponse:
    """LLM 财务解析路径：从年报 PDF 提取文本，LLM 抽取结构化 JSON。

    异常处理：extract_one 可能因网络超时、PDF 下载失败、LLM API 错误等抛异常，
    必须捕获并返回结构化错误响应，避免 FastAPI 返回 500。
    """
    try:
        from llm_financial_extractor import extract_one

        result = extract_one(symbol)
    except Exception as e:
        logger.error("[financial] LLM 解析异常: %s, %s", symbol, e)
        return CollectResponse(
            success=False,
            symbol=symbol,
            dimension="financial",
            error=f"LLM 解析异常: {e}",
            fetched_at=datetime.now().isoformat(),
        )

    fin_data = result.get("financial_data") or {}

    valid_fields = {
        "report_date", "revenue", "revenue_yoy", "net_profit", "net_profit_yoy",
        "gross_margin", "net_margin", "operating_cf", "rd_ratio",
        "receivables", "inventory_turnover_days", "interest_bearing_debt",
        "goodwill", "net_assets", "shareholder_pledge",
    }
    filtered = {k: v for k, v in fin_data.items() if k in valid_fields}
    success = result.get("source") != "failed" and not fin_data.get("_error")

    return CollectResponse(
        success=success,
        symbol=symbol,
        dimension="financial",
        data=FinancialCollectData(**filtered).model_dump() if filtered else None,
        records=1 if success else 0,
        error=fin_data.get("_error") or result.get("error"),
        fetched_at=datetime.now().isoformat(),
    )


@app.post("/api/collect/financial", response_model=CollectResponse)
def collect_financial(request: FinancialCollectRequest) -> CollectResponse:
    """
    拉取单只股票财务分析指标。

    数据源：
    - use_llm=True：巨潮年报 PDF 文本提取 + LLM JSON 抽取（llm_financial_extractor）
    - AKShare stock_financial_analysis_indicator：比率类指标（毛利率/净利率/ROE/增长率）
    - AKShare stock_financial_abstract：绝对值指标（营收/净利润/现金流/净资产）
    """
    with _timed_operation("route.collect_financial", symbol=request.symbol, use_llm=request.use_llm):
        logger.info("[route] POST /api/collect/financial: symbol=%s use_llm=%s", request.symbol, request.use_llm)
        try:
            if request.use_llm:
                logger.info("[route] collect_financial 走 LLM 路径: symbol=%s", request.symbol)
                return _collect_financial_llm(request.symbol)

            real_data = fetch_real_financial_data(request.symbol)
            if real_data is None:
                logger.warning("[route] collect_financial 数据为空: symbol=%s", request.symbol)
                return CollectResponse(
                    success=False,
                    symbol=request.symbol,
                    dimension="financial",
                    error="AKShare 财务数据获取失败",
                    fetched_at=datetime.now().isoformat(),
                )

            valid_fields = {
                "report_date", "revenue", "revenue_yoy", "net_profit", "net_profit_yoy",
                "gross_margin", "net_margin", "operating_cf", "rd_ratio",
                "receivables", "inventory_turnover_days", "interest_bearing_debt",
                "goodwill", "net_assets", "shareholder_pledge",
            }
            filtered = {k: v for k, v in real_data.items() if k in valid_fields}

            # 检查关键字段完整性
            key_fields = ["revenue", "net_profit", "net_margin", "report_date"]
            missing = [f for f in key_fields if not filtered.get(f)]
            if missing:
                logger.warning(
                    "[route] collect_financial 关键字段缺失: symbol=%s missing=%s data=%s",
                    request.symbol, missing, _summarize_data(filtered),
                )

            logger.info(
                "[route] collect_financial 完成: symbol=%s revenue=%s net_profit=%s net_margin=%s report_date=%s",
                request.symbol,
                f"{filtered.get('revenue', 0):.0f}" if filtered.get("revenue") else "N/A",
                f"{filtered.get('net_profit', 0):.0f}" if filtered.get("net_profit") else "N/A",
                f"{filtered.get('net_margin', 0):.2f}%" if filtered.get("net_margin") else "N/A",
                filtered.get("report_date", "N/A"),
            )
            return CollectResponse(
                success=True,
                symbol=request.symbol,
                dimension="financial",
                data=FinancialCollectData(**filtered).model_dump(),
                records=1,
                fetched_at=datetime.now().isoformat(),
            )
        except Exception as e:
            logger.error("[route] collect_financial 异常: symbol=%s error=%s", request.symbol, e, exc_info=True)
            raise


# ---------------------------------------------------------------------------
# 健康检查
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 板块轮动评分采集（申万二级，2026-08-09 新增，按 hot-momentum-strategy.md §2.5）
# ---------------------------------------------------------------------------


class SectorScoreItem(BaseModel):
    """板块轮动评分记录（对应前端 RotationSectorScore）"""

    id: str
    sectorCode: str
    sectorName: str
    swLevel1: Optional[str] = None
    swLevel2: Optional[str] = None
    swLevel3: Optional[str] = None
    scoreDate: str
    f1Jingqi: float
    f2Zijin: float
    f3Guzhi: float
    f4Beta: float
    f5Nengliang: float
    total: float
    resonance: float
    signal: str
    alertLevel: str
    declineType: str
    poolStocks: list[dict[str, Any]] = []
    modelUsed: str
    createdAt: str


class SectorCollectRequest(BaseModel):
    topN: int = 20


def _normalize_to_100(values: dict[str, float]) -> dict[str, float]:
    """将一组数值按排名分位归一化到 0-100（最高值=100）。"""
    if not values:
        return {}
    sorted_items = sorted(values.items(), key=lambda x: x[1])
    n = len(sorted_items)
    return {k: (i / max(n - 1, 1)) * 100 for i, (k, _v) in enumerate(sorted_items)}


def _fetch_market_benchmark_return(window: int = 20) -> float | None:
    """拉取大盘基准（沪深300 sh000300）近 N 日涨幅（%），用于 f4 Beta RS 计算。

    数据源：腾讯指数日线接口 web.ifzq.gtimg.cn/appstock/app/kline/kline，
    规避 AKShare 东财接口反爬，且避免 _to_tencent_code 对指数代码（000300）
    误判为深市（sz000300）导致拉取为空的问题。

    窗口对齐板块 return_20d：closes[-window-1] → closes[-1]（严格 N 个交易日）。
    失败时返回 None，调用方将 f4 回退为 0（保持原 TODO 行为，不阻塞主流程）。

    @see hot-momentum-strategy.md §2.5.2 f4Beta=相对大盘β
    """
    import requests

    url = f"https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh000300,day,,,{window + 5}"
    try:
        logger.info("[sectors] 请求大盘基准（沪深300）: url=%s timeout=8s window=%d", url, window)
        t0 = time.perf_counter()
        r = requests.get(url, timeout=8)
        logger.info("[sectors] 大盘基准响应: status=%d elapsed=%.1fms", r.status_code, (time.perf_counter() - t0) * 1000)
        data = r.json()
        day_list = data.get("data", {}).get("sh000300", {}).get("day")
        if not day_list or len(day_list) < window + 1:
            logger.warning(
                "[sectors] 大盘基准数据不足: days=%s, need>=%s",
                len(day_list) if day_list else 0, window + 1,
            )
            return None
        # 腾讯日级格式: [date, open, close, high, low, volume, amount?]
        closes = [float(item[2]) for item in day_list if len(item) > 2]
        if len(closes) < window + 1 or closes[-window - 1] == 0:
            return None
        return (closes[-1] - closes[-window - 1]) / closes[-window - 1] * 100
    except requests.exceptions.Timeout as e:
        logger.error("[sectors] 大盘基准网络超时（timeout=8s，疑似网络波动），f4 将回退为 0: %s", e)
        return None
    except Exception as e:
        logger.warning("[sectors] 大盘基准拉取失败，f4 将回退为 0: %s", e)
        return None


def fetch_sector_rotation_scores(topN: int = 20) -> list[SectorScoreItem]:
    """
    采集申万二级行业板块轮动评分（按 hot-momentum-strategy.md §2.5.2）。

    数据源：
    - ak.sw_index_second_info()：板块估值（PE/PB）+ 成份个数 + 上级行业
    - ak.index_hist_sw(symbol, 'day')：板块指数日线（涨幅/量能/成交额）
    - 腾讯日线 fetch_tencent_kline('000300')：大盘基准（沪深300，用于 f4 RS）
    - SQLite 缓存：避免重复调用 AKShare 接口，提升响应速度

    缓存命中率监控日志：
    - [cache_monitor] sector_info_hit/miss：板块基本信息缓存命中情况
    - [cache_monitor] hist_data_hit/miss：板块日线数据缓存命中情况
    - [cache_monitor] overall_hit_rate：整体缓存命中率统计
    """
    import akshare as ak
    import pandas as pd
    from concurrent.futures import ThreadPoolExecutor

    # 缓存命中率监控计数器
    cache_stats = {
        "sector_info_hit": 0,
        "sector_info_miss": 0,
        "hist_data_hit": 0,
        "hist_data_miss": 0,
        "total_sectors": 0,
        "cache_elapsed_ms": 0.0,
        "akshare_elapsed_ms": 0.0,
    }

    score_date = datetime.now().strftime("%Y-%m-%d")
    created_at = datetime.now().isoformat()

    # 1. 获取申万二级板块估值列表，按成份个数降序取 TOP N
    # 优先尝试从 SQLite 缓存读取
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from _sector_cache_db import get_sector_info as get_cached_sector_info
        t_cache_start = time.perf_counter()
        cached_sectors = get_cached_sector_info()
        t_cache_elapsed = (time.perf_counter() - t_cache_start) * 1000

        if cached_sectors and len(cached_sectors) >= topN:
            # 缓存命中
            cache_stats["sector_info_hit"] = len(cached_sectors)
            cache_stats["cache_elapsed_ms"] += t_cache_elapsed
            record_cache_access("sector_info", hit=True, latency_ms=t_cache_elapsed)
            update_cache_entries("sector_info", len(cached_sectors))
            logger.info(
                "[cache_monitor] sector_info_hit: 命中 %d 条板块信息缓存, latency=%.1fms",
                len(cached_sectors), t_cache_elapsed
            )
            # 将缓存数据转换为 DataFrame 格式
            spot_df = pd.DataFrame([{
                "行业代码": s["sector_code"],
                "行业名称": s["sector_name"],
                "成份个数": s.get("constituent_count", 0),
                "静态市盈率": s.get("pe_static", 0),
                "市净率": s.get("pb", 0),
                "上级行业": s.get("level1_name", ""),
            } for s in cached_sectors[:topN]])
        else:
            # 缓存未命中或数据不足，走 AKShare
            cache_stats["sector_info_miss"] = 1
            record_cache_access("sector_info", hit=False)
            record_akshare_fallback("sw_index_second_info")
            logger.info("[cache_monitor] sector_info_miss: 缓存数据不足，走 AKShare 实时拉取")
            t_ak_start = time.perf_counter()
            spot_df = ak.sw_index_second_info()
            cache_stats["akshare_elapsed_ms"] += (time.perf_counter() - t_ak_start) * 1000
    except Exception as cache_err:
        cache_stats["sector_info_miss"] = 1
        record_cache_access("sector_info", hit=False)
        record_akshare_fallback("sw_index_second_info")
        logger.warning("[cache_monitor] sector_info_miss: 缓存读取异常，走 AKShare: %s", cache_err)
        t_ak_start = time.perf_counter()
        spot_df = ak.sw_index_second_info()
        cache_stats["akshare_elapsed_ms"] += (time.perf_counter() - t_ak_start) * 1000

    if spot_df is None or spot_df.empty:
        logger.warning("[sectors] sw_index_second_info 返回空，无法采集板块轮动评分")
        return []
    spot_df = spot_df.sort_values("成份个数", ascending=False).head(topN)
    logger.info("[sectors] 申万二级板块列表获取成功: 候选=%d, topN=%d", len(spot_df), topN)

    def calc_sector(row):
        code = str(row["行业代码"])  # 如 801120.SI
        code_num = code.split(".")[0]  # index_hist_sw 用纯数字
        name = str(row["行业名称"])
        level1 = str(row["上级行业"]) if pd.notna(row.get("上级行业")) else None
        pe = float(row["静态市盈率"]) if pd.notna(row.get("静态市盈率")) else 0.0
        pb = float(row["市净率"]) if pd.notna(row.get("市净率")) else 0.0

        # 尝试从缓存获取日线数据
        try:
            from _sector_cache_db import get_hist_for_sector, compute_technical_indicators
            t_hist_start = time.perf_counter()
            cached_hist = get_hist_for_sector(code, days=60)
            t_hist_elapsed = (time.perf_counter() - t_hist_start) * 1000

            if cached_hist and len(cached_hist) >= 25:
                # 缓存命中：直接从缓存数据计算指标
                cache_stats["hist_data_hit"] += 1
                cache_stats["cache_elapsed_ms"] += t_hist_elapsed
                record_cache_access("hist_data", hit=True, latency_ms=t_hist_elapsed)
                closes = [r["close_price"] for r in cached_hist]
                volumes = [r["volume"] for r in cached_hist]
                amounts = [r["amount"] for r in cached_hist]
            else:
                # 缓存未命中：走 AKShare
                cache_stats["hist_data_miss"] += 1
                record_cache_access("hist_data", hit=False)
                record_akshare_fallback("index_hist_sw")
                t_ak_hist_start = time.perf_counter()
                hist = ak.index_hist_sw(symbol=code_num, period="day")
                cache_stats["akshare_elapsed_ms"] += (time.perf_counter() - t_ak_hist_start) * 1000
                if hist is None or len(hist) < 25:
                    logger.warning(
                        "[sectors] index_hist_sw 返回数据不足: code=%s name=%s rows=%s",
                        code, name, 0 if hist is None else len(hist),
                    )
                    return None
                closes = hist["收盘"].astype(float).tolist()
                volumes = hist["成交量"].astype(float).tolist()
                amounts = hist["成交额"].astype(float).tolist()
        except Exception as cache_err:
            # 缓存异常：降级到 AKShare
            cache_stats["hist_data_miss"] += 1
            record_cache_access("hist_data", hit=False)
            record_akshare_fallback("index_hist_sw")
            logger.debug("[cache_monitor] hist_data_miss: 缓存读取异常 code=%s: %s", code, cache_err)
            try:
                t_ak_hist_start = time.perf_counter()
                hist = ak.index_hist_sw(symbol=code_num, period="day")
                cache_stats["akshare_elapsed_ms"] += (time.perf_counter() - t_ak_hist_start) * 1000
                if hist is None or len(hist) < 25:
                    logger.warning(
                        "[sectors] index_hist_sw 返回数据不足: code=%s name=%s rows=%s",
                        code, name, 0 if hist is None else len(hist),
                    )
                    return None
                closes = hist["收盘"].astype(float).tolist()
                volumes = hist["成交量"].astype(float).tolist()
                amounts = hist["成交额"].astype(float).tolist()
            except Exception as e:
                logger.warning(
                    "[sectors] calc_sector 异常: code=%s name=%s error=%s",
                    code, name, e, exc_info=True,
                )
                return None

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

        return {"code": code, "name": name, "level1": level1, "pe": pe, "pb": pb,
                "change_5d": change_5d, "return_20d": return_20d,
                "vol_ratio": vol_ratio, "amt_ratio": amt_ratio}

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(calc_sector, [row for _, row in spot_df.iterrows()]))
    sector_data = [r for r in results if r is not None]
    if not sector_data:
        logger.warning(
            "[sectors] 全部 %d 个板块 calc_sector 均失败，返回空列表（请检查 index_hist_sw 上游可用性）",
            len(results),
        )
        return []
    if len(sector_data) < len(results):
        logger.warning(
            "[sectors] 部分板块采集失败: 成功=%d, 失败=%d",
            len(sector_data), len(results) - len(sector_data),
        )

    # 2. 跨板块归一化五因子到 0-100（阶段一：f3 补 PB / f4 补 RS / f5 复合额比）
    change_ranks = _normalize_to_100({s["code"]: s["change_5d"] for s in sector_data})
    vol_ranks = _normalize_to_100({s["code"]: s["vol_ratio"] for s in sector_data})

    # f2 资金因子：优先用真实主力净流入（L1→L2→L3 降级），全失败时降级 L4 量价代理
    # @see _sector_fund_flow.py 三层降级架构
    # @see hot-momentum-strategy.md §2.5.2 f2Zijin
    from _sector_fund_flow import fetch_sector_fund_flow
    sector_names_for_fund = [_normalize_sw_name(s["name"]) for s in sector_data]
    fund_flow_map = fetch_sector_fund_flow(sector_names=sector_names_for_fund)
    if fund_flow_map:
        # 同花顺名称归一化后匹配申万二级名称（如 "白酒II" → "白酒"）
        norm_fund_map = {_normalize_sw_name(k): v for k, v in fund_flow_map.items()}
        f2_raw: dict[str, float] = {}
        match_count = 0
        for s in sector_data:
            norm_name = _normalize_sw_name(s["name"])
            if norm_name in norm_fund_map:
                f2_raw[s["code"]] = norm_fund_map[norm_name]
                match_count += 1
            else:
                f2_raw[s["code"]] = 0.0  # 未匹配填 0（中性净流入）
        match_rate = match_count / len(sector_data) if sector_data else 0.0
        if match_rate >= 0.5:
            f2_source = f"fund_flow(match={match_count}/{len(sector_data)})"
            logger.info("[sectors] f2 使用真实主力净流入: %s", f2_source)
        else:
            # 匹配率过低，降级 L4 避免量纲混合失真（净流入-100~100亿 vs amt_ratio 0.5~2.0）
            f2_raw = {s["code"]: s["amt_ratio"] for s in sector_data}
            f2_source = f"amt_ratio_proxy(match_rate={match_rate:.0%})"
            logger.warning("[sectors] f2 匹配率过低，降级 L4 量价代理: %s", f2_source)
    else:
        # L1/L2/L3 全失败，降级 L4 量价代理（amt_ratio）
        f2_raw = {s["code"]: s["amt_ratio"] for s in sector_data}
        f2_source = "amt_ratio_proxy(L1L2L3全失败)"
        logger.warning("[sectors] f2 降级 L4 量价代理: %s", f2_source)
    f2_ranks = _normalize_to_100(f2_raw)

    pe_ranks = _normalize_to_100({s["code"]: -s["pe"] for s in sector_data})  # 反向：低 PE 高分
    pb_ranks = _normalize_to_100({s["code"]: -s["pb"] for s in sector_data})  # 反向：低 PB 高分

    # f4 RS：板块20日涨幅 - 大盘20日涨幅（相对强度），大盘基准失败则全 0 回退
    market_return_20d = _fetch_market_benchmark_return(window=20)
    if market_return_20d is not None:
        rs_ranks = _normalize_to_100({s["code"]: s["return_20d"] - market_return_20d for s in sector_data})
        logger.info("[sectors] f4 RS 已计算: 大盘20日涨幅=%.2f%%", market_return_20d)
    else:
        rs_ranks = {s["code"]: 0.0 for s in sector_data}
        logger.warning("[sectors] f4 RS 回退为 0（大盘基准不可用）")

    items: list[SectorScoreItem] = []
    for s in sector_data:
        code = s["code"]
        f1 = change_ranks.get(code, 0.0)
        f2 = f2_ranks.get(code, 0.0)
        # f3 估值复合：PE + PB 分位均值（对齐文档 §2.5.2 "PE/PB历史分位"）
        f3 = (pe_ranks.get(code, 0.0) + pb_ranks.get(code, 0.0)) / 2.0
        f4 = rs_ranks.get(code, 0.0)
        # f5 量能：保持量比（阶段一不复合额比，避免与 f2 资金代理重复计算；
        #        换手率需成份股数据，留阶段二）
        f5 = vol_ranks.get(code, 0.0)
        # total 加权（阶段一）：景气30% + 资金25% + 估值20% + Beta10% + 量能15%
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

        items.append(SectorScoreItem(
            id=f"{code}__{score_date}", sectorCode=code, sectorName=s["name"],
            swLevel1=s["level1"], swLevel2=s["name"], swLevel3=None,
            scoreDate=score_date,
            f1Jingqi=round(f1, 2), f2Zijin=round(f2, 2), f3Guzhi=round(f3, 2),
            f4Beta=round(f4, 2), f5Nengliang=round(f5, 2),
            total=round(total, 2), resonance=round(resonance, 2),
            signal=signal, alertLevel=alert, declineType="",
            poolStocks=[], modelUsed="akshare-sw-v1", createdAt=created_at,
        ))

    # 缓存命中率汇总日志 + Prometheus 指标
    total_sectors = len(sector_data)
    total_info_requests = cache_stats["sector_info_hit"] + cache_stats["sector_info_miss"]
    total_hist_requests = cache_stats["hist_data_hit"] + cache_stats["hist_data_miss"]

    info_hit_rate = (cache_stats["sector_info_hit"] / max(total_info_requests, 1)) * 100
    hist_hit_rate = (cache_stats["hist_data_hit"] / max(total_hist_requests, 1)) * 100

    # 计算数据来源（主要使用缓存还是 AKShare）
    cache_source = "cache" if hist_hit_rate >= 50 else "akshare"
    total_duration_ms = cache_stats["cache_elapsed_ms"] + cache_stats["akshare_elapsed_ms"]

    # 记录 Prometheus 指标
    record_sector_score_duration(cache_source, total_duration_ms)
    if total_sectors > 0:
        avg_duration_per_sector = total_duration_ms / total_sectors
        logger.info(
            "[cache_monitor] perf_summary: total=%.1fms, cache=%.1fms, akshare=%.1fms, "
            "avg_per_sector=%.1fms, source=%s",
            total_duration_ms, cache_stats["cache_elapsed_ms"],
            cache_stats["akshare_elapsed_ms"], avg_duration_per_sector, cache_source
        )

    logger.info(
        "[cache_monitor] overall_hit_rate: 板块信息命中率=%.1f%% (%d/%d), "
        "日线数据命中率=%.1f%% (%d/%d), 总板块数=%d",
        info_hit_rate, cache_stats["sector_info_hit"], total_info_requests,
        hist_hit_rate, cache_stats["hist_data_hit"], total_hist_requests,
        total_sectors,
    )
    logger.info(
        "[cache_monitor] detail: sectors_info[hit=%d,miss=%d], "
        "hist_data[hit=%d,miss=%d], score_date=%s",
        cache_stats["sector_info_hit"], cache_stats["sector_info_miss"],
        cache_stats["hist_data_hit"], cache_stats["hist_data_miss"],
        score_date,
    )
    logger.info("[prometheus] %s", get_metrics_summary())

    return items


@app.post("/api/collect/sectors", response_model=CollectResponse)
def collect_sectors(request: SectorCollectRequest) -> CollectResponse:
    """
    采集申万二级行业板块轮动评分（按 hot-momentum-strategy.md §2.5）。

    数据源：AKShare sw_index_second_info（估值）+ index_hist_sw（涨幅/量能）。
    返回 RotationSectorScore 列表，供前端 rotationScoreStore 持久化。
    """
    logger.info("[sectors] 收到板块轮动评分采集请求: topN=%s", request.topN)
    try:
        items = fetch_sector_rotation_scores(topN=request.topN)
        score_date = items[0].scoreDate if items else datetime.now().strftime("%Y-%m-%d")
        logger.info(
            "[sectors] 板块轮动评分采集成功: count=%d, scoreDate=%s, top3=%s",
            len(items),
            score_date,
            [(i.sectorCode, i.sectorName, i.total) for i in items[:3]],
        )
        return CollectResponse(
            success=True, symbol="*", dimension="sectors",
            data={"sectors": [item.model_dump() for item in items], "scoreDate": score_date},
            records=len(items), fetched_at=datetime.now().isoformat(),
        )
    except Exception as e:
        logger.error("[sectors] 板块轮动评分采集失败: %s", e, exc_info=True)
        return CollectResponse(
            success=False, symbol="*", dimension="sectors", error=str(e),
            fetched_at=datetime.now().isoformat(),
        )


# ---------------------------------------------------------------------------
# 市场宽度采集（MAS Breadth，RLES D3 时机成熟度因子真实源，2026-08-17 新增）
# ---------------------------------------------------------------------------


class BreadthData(BaseModel):
    """全市场涨跌广度（对应前端 MarketBreadthInput）"""

    up: int
    down: int
    flat: int
    totalStocks: int
    limitUp: int
    limitDown: int
    asOf: str


# 市场宽度缓存：东财 push2 拉全市场约 1-2 秒，60s 内复用避免高频打满
_BREADTH_CACHE: dict[str, Any] = {"data": None, "ts": 0.0}
_BREADTH_TTL = 60


def fetch_market_breadth() -> BreadthData | None:
    """拉取全市场涨跌家数/涨跌停（东财 push2 qt/clist）。

    数据源：push2.eastmoney.com/api/qt/clist/get（fs 覆盖沪深京 A 股），
    取 f3 涨跌幅，统计 上涨/下跌/平盘/涨停/跌停。60s 缓存，失败返回 None
    （前端 resilient 入口回退 cockpit mock）。

    涨停/跌停判定兼容 10%（主板）与 20%（双创/北交所）：
    f3>=9.9 或 >=19.9 视为涨停；f3<=-9.9 或 <=-19.9 视为跌停。
    """
    now = time.time()
    if _BREADTH_CACHE["data"] is not None and now - _BREADTH_CACHE["ts"] < _BREADTH_TTL:
        return _BREADTH_CACHE["data"]

    import requests

    url = (
        "https://push2.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=6000&po=1&np=1&fltt=2&invt=2"
        "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
        "&fields=f3,f12,f14"
    )
    try:
        logger.info("[breadth] 请求东财全市场涨跌家数: url=%s timeout=12s", url)
        t0 = time.perf_counter()
        r = requests.get(
            url, timeout=12,
            headers={"Referer": "https://quote.eastmoney.com/", "User-Agent": "Mozilla/5.0"},
        )
        http_ms = (time.perf_counter() - t0) * 1000
        payload = r.json()
        items = (payload.get("data") or {}).get("diff") or {}
        logger.info("[breadth] 东财响应: status=%d elapsed=%.1fms items=%d", r.status_code, http_ms, len(items))
        if not items:
            logger.warning("[breadth] 东财返回空，宽度源降级为 None")
            return None

        up = down = flat = limit_up = limit_down = 0
        for it in items.values():
            chg = _safe_float(it.get("f3"))
            if chg is None:
                continue
            if chg > 0:
                up += 1
            elif chg < 0:
                down += 1
            else:
                flat += 1
            if chg >= 9.9 or chg >= 19.9:
                limit_up += 1
            elif chg <= -9.9 or chg <= -19.9:
                limit_down += 1

        data = BreadthData(
            up=up, down=down, flat=flat,
            totalStocks=up + down + flat,
            limitUp=limit_up, limitDown=limit_down,
            asOf=datetime.now().isoformat(),
        )
        _BREADTH_CACHE["data"] = data
        _BREADTH_CACHE["ts"] = now
        logger.info(
            "[breadth] 市场宽度统计完成: up=%d down=%d flat=%d limitUp=%d limitDown=%d",
            up, down, flat, limit_up, limit_down,
        )
        return data
    except requests.exceptions.Timeout as e:
        logger.error("[breadth] 东财超时（12s），宽度源降级为 None: %s", e)
        return None
    except Exception as e:
        logger.error("[breadth] 拉取失败，宽度源降级为 None: %s", e, exc_info=True)
        return None


@app.post("/api/collect/breadth", response_model=CollectResponse)
def collect_breadth() -> CollectResponse:
    """拉取全市场涨跌广度（RLES 市场宽度因子真实源）。

    数据源：东财 push2 qt/clist（覆盖沪深京 A 股）。失败降级为 success=False，
    前端 resilient 入口回退 cockpit mock。
    """
    logger.info("[breadth] 收到市场宽度采集请求")
    try:
        data = fetch_market_breadth()
        if data is None:
            return CollectResponse(
                success=False, symbol="*", dimension="breadth",
                error="东财全市场涨跌家数获取失败（已回退 mock）",
                fetched_at=datetime.now().isoformat(),
            )
        return CollectResponse(
            success=True, symbol="*", dimension="breadth",
            data=data.model_dump(), records=1,
            fetched_at=datetime.now().isoformat(),
        )
    except Exception as e:
        logger.error("[breadth] 采集异常: %s", e, exc_info=True)
        return CollectResponse(
            success=False, symbol="*", dimension="breadth", error=str(e),
            fetched_at=datetime.now().isoformat(),
        )


# ---------------------------------------------------------------------------
# 风险黑名单采集（ST/退市/违规，hardRisks 真实源，2026-08-17 新增）
# ---------------------------------------------------------------------------


class RiskCollectRequest(BaseModel):
    symbol: str


class RiskCollectData(BaseModel):
    symbol: str
    name: Optional[str] = None
    flags: list[str] = []
    asOf: str


# 后端权威黑名单（symbol → (category, reason)）。生产环境应从交易所退市预警/
# ST 特别处理列表/监管处罚公告/立案调查公告每日同步维护。当前为空占位。
BACKEND_FORBIDDEN_STOCKS: dict[str, tuple[str, str]] = {}


def _derive_risk_flags_from_name(name: str | None) -> list[str]:
    """由官方证券名称推导风险标签（交易所强制 ST/*ST/退市 前缀，权威度高）。"""
    flags: list[str] = []
    if not name:
        return flags
    upper = name.upper()
    if "退" in name:
        flags.append("delisting:名称含退市")
    if "*ST" in upper:
        flags.append("st:名称含*ST风险警示")
    elif upper.startswith("ST"):
        flags.append("st:名称含ST风险警示")
    return flags


def fetch_stock_risk_flags(symbol: str) -> RiskCollectData:
    """获取单股风险标签：后端黑名单 + 名称推导（东财/腾讯名称含 ST/退市前缀）。"""
    flags: list[str] = []
    name: str | None = None

    forbidden = BACKEND_FORBIDDEN_STOCKS.get(symbol)
    if forbidden:
        flags.append(f"{forbidden[0]}:{forbidden[1]}")

    try:
        tq = fetch_tencent_quote(symbol)
        if tq:
            name = tq.get("name")
    except Exception as e:
        logger.warning("[risk] 腾讯名称查询失败（不影响黑名单判定）: symbol=%s error=%s", symbol, e)

    flags.extend(_derive_risk_flags_from_name(name))
    return RiskCollectData(
        symbol=symbol, name=name, flags=flags,
        asOf=datetime.now().isoformat(),
    )


@app.post("/api/collect/risk", response_model=CollectResponse)
def collect_risk(request: RiskCollectRequest) -> CollectResponse:
    """拉取单股风险标签（ST/退市/违规/处罚/立案）。

    数据源：后端 BACKEND_FORBIDDEN_STOCKS + 腾讯名称（ST/退市前缀权威推导）。
    命中任一条即触发 RLES 风险降级 ×0.73。
    """
    logger.info("[risk] 收到风险标签采集请求: symbol=%s", request.symbol)
    try:
        data = fetch_stock_risk_flags(request.symbol)
        return CollectResponse(
            success=True, symbol=request.symbol, dimension="risk",
            data=data.model_dump(), records=len(data.flags),
            fetched_at=datetime.now().isoformat(),
        )
    except Exception as e:
        logger.error("[risk] 采集异常: %s", e, exc_info=True)
        return CollectResponse(
            success=False, symbol=request.symbol, dimension="risk", error=str(e),
            fetched_at=datetime.now().isoformat(),
        )


@app.get("/health", response_model=HealthCheckResponse)
def health_check() -> HealthCheckResponse:
    """服务健康检查"""
    return HealthCheckResponse(
        status="ok",
        service="v9-data-collector",
        version="0.1.0",
    )
