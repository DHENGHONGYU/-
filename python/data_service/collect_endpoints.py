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
import re
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("v9-data-collector")

app = FastAPI(title="V9 Data Collector", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    从腾讯实时行情 API 获取 price / pe / pb / 总市值。

    API: https://qt.gtimg.cn/q=sh600519
    字段索引: [3]=price, [39]=PE, [47]=PB, [46]=总市值(亿)
    """
    import requests

    tc = _to_tencent_code(symbol)
    url = f"https://qt.gtimg.cn/q={tc}"
    try:
        r = requests.get(url, timeout=8, headers={"Referer": "https://gu.qq.com/"})
        parts = r.text.split('="')
        if len(parts) < 2:
            return None
        fields = parts[1].strip('";\n').split("~")
        if len(fields) < 50:
            return None
        market_cap_yi = _safe_float(fields[46])
        return {
            "price": _safe_float(fields[3]),
            "pe": _safe_float(fields[39]),
            "pb": _safe_float(fields[47]),
            "market_cap": market_cap_yi * 1e8 if market_cap_yi else None,  # 亿→元
        }
    except Exception as e:
        logger.warning("[tencent_quote] 获取失败: %s, %s", symbol, e)
        return None


def fetch_tencent_kline(symbol: str, count: int = 60) -> list[dict[str, Any]] | None:
    """
    从腾讯 K 线 API 获取前复权日线数据。

    API: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,60,qfq
    字段: [date, open, close, high, low, volume, amount?]
    """
    import requests

    tc = _to_tencent_code(symbol)
    url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={tc},day,,,{count},qfq"
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        kline_data = data.get("data", {}).get(tc, {})
        day_list = kline_data.get("day") or kline_data.get("qfqday")
        if not day_list:
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
        return bars if bars else None
    except Exception as e:
        logger.warning("[tencent_kline] 获取失败: %s, %s", symbol, e)
        return None


def fetch_individual_info(symbol: str) -> dict[str, Any] | None:
    """
    调用 AKShare stock_individual_info_em 获取个股基础信息。

    返回字段（来自接口的 item/value 两列结构）：
    - name: 股票简称
    - industry_name: 东财/证监会行业名称（原始值，用于日志与兜底）
    - industry_code: 申万二级代码（经映射表解析，精确代码匹配；无法解析时为 None）
    - market_cap: 总市值（元）

    AKShare 不可用或调用失败时返回 None，由调用方回退到占位数据。
    """
    try:
        import akshare as ak
    except ImportError:
        logger.warning("[basic] akshare 未安装，回退到占位数据: %s", symbol)
        return None

    # stock_individual_info_em 接收 6 位纯数字代码（去除 .SH/.SZ 后缀）
    clean_symbol = symbol.split(".")[0].upper()
    try:
        df = ak.stock_individual_info_em(symbol=clean_symbol)
    except Exception as e:
        logger.warning("[basic] stock_individual_info_em 调用失败: %s, %s", symbol, e)
        return None
    if df is None or df.empty or "item" not in df.columns or "value" not in df.columns:
        logger.warning("[basic] stock_individual_info_em 返回空: %s", symbol)
        return None

    info: dict[str, Any] = {}
    industry_name: str | None = None
    # item/value 两列，按行遍历取值
    for _, row in df.iterrows():
        item = str(row["item"]).strip()
        value = row["value"]
        if item == "股票简称":
            info["name"] = str(value).strip() if value is not None else None
        elif item == "行业":
            industry_name = str(value).strip() if value is not None else None
            info["industry_name"] = industry_name
        elif item == "总市值":
            try:
                info["market_cap"] = float(value)
            except (TypeError, ValueError):
                pass

    # 通过申万行业代码映射表解析为申万二级代码（精确代码匹配）
    sw_code = resolve_sw_industry_code(industry_name)
    info["industry_code"] = sw_code
    logger.info(
        "[basic] 行业代码解析: symbol=%s 行业=%s → 申万二级代码=%s",
        symbol,
        industry_name,
        sw_code if sw_code else "(未命中，回退名称匹配)",
    )
    return info or None


@app.post("/api/collect/basic", response_model=CollectResponse)
def collect_basic(request: BasicCollectRequest) -> CollectResponse:
    """
    拉取单只股票基础信息。

    数据源：
    - AKShare stock_individual_info_em：name / industry_code / market_cap
    - 腾讯实时行情 qt.gtimg.cn：price / pe / pb（替代东财被封接口）
    """
    info = fetch_individual_info(request.symbol)
    tq = fetch_tencent_quote(request.symbol)

    data = BasicCollectData(
        name=(info or {}).get("name"),
        industry_code=(info or {}).get("industry_code"),
        market_cap=(info or {}).get("market_cap") or (tq or {}).get("market_cap"),
        price=(tq or {}).get("price"),
        pe=(tq or {}).get("pe"),
        pb=(tq or {}).get("pb"),
    )

    return CollectResponse(
        success=True,
        symbol=request.symbol,
        dimension="basic",
        data=data.model_dump(),
        records=1,
        fetched_at=datetime.now().isoformat(),
    )


# ---------------------------------------------------------------------------
# K线数据采集
# ---------------------------------------------------------------------------


class KlineCollectRequest(BaseModel):
    symbol: str
    period: str = "daily"  # daily | weekly | monthly
    adjust: str = "qfq"  # qfq | hfq | ""
    start_date: Optional[str] = None
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
    拉取单只股票 K线数据（前复权日线）。

    数据源：腾讯 fqkline API（web.ifzq.gtimg.cn），返回最近 60 根日线。
    字段: [date, open, close, high, low, volume]
    替代被东财封禁的 akshare.stock_zh_a_hist。
    """
    bars = fetch_tencent_kline(request.symbol, count=60)
    if not bars:
        return CollectResponse(
            success=False,
            symbol=request.symbol,
            dimension="kline",
            error="腾讯K线API返回空或请求失败",
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
    return CollectResponse(
        success=True,
        symbol=request.symbol,
        dimension="kline",
        data=KlineCollectData(latest=latest, history=history).model_dump(),
        records=len(history),
        fetched_at=datetime.now().isoformat(),
    )


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

    clean = symbol.split(".")[0].upper()
    result: dict[str, Any] = {}

    # 1. 比率类指标（stock_financial_analysis_indicator）
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
            if total_assets and debt_ratio is not None:
                result["net_assets"] = total_assets * (1 - debt_ratio / 100)
                result["interest_bearing_debt"] = total_assets * debt_ratio / 100
    except Exception as e:
        logger.warning("[financial] stock_financial_analysis_indicator 失败: %s, %s", symbol, e)

    # 2. 绝对值指标（stock_financial_abstract）
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
    except Exception as e:
        logger.warning("[financial] stock_financial_abstract 失败: %s, %s", symbol, e)

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
    if request.use_llm:
        return _collect_financial_llm(request.symbol)

    real_data = fetch_real_financial_data(request.symbol)
    if real_data is None:
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
    return CollectResponse(
        success=True,
        symbol=request.symbol,
        dimension="financial",
        data=FinancialCollectData(**filtered).model_dump(),
        records=1,
        fetched_at=datetime.now().isoformat(),
    )


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


def fetch_sector_rotation_scores(topN: int = 20) -> list[SectorScoreItem]:
    """
    采集申万二级行业板块轮动评分（按 hot-momentum-strategy.md §2.5.2）。

    数据源：
    - ak.sw_index_second_info()：板块估值（PE/PB/股息率）+ 成份个数 + 上级行业
    - ak.index_hist_sw(symbol, 'day')：板块指数日线（涨幅/量能/成交额）

    五因子：
    - f1Jingqi：近5日涨幅（景气代理）
    - f2Zijin：近5日均成交额/前20日均成交额（资金代理，TODO: 接真实资金流接口）
    - f3Guzhi：PE 分位反向（低估值高分）
    - f4Beta：0（TODO: 板块 vs 大盘 β 回归）
    - f5Nengliang：近5日均成交量/前20日均成交量（量能放大）
    """
    import akshare as ak
    import pandas as pd
    from concurrent.futures import ThreadPoolExecutor

    score_date = datetime.now().strftime("%Y-%m-%d")
    created_at = datetime.now().isoformat()

    # 1. 获取申万二级板块估值列表，按成份个数降序取 TOP N
    spot_df = ak.sw_index_second_info()
    spot_df = spot_df.sort_values("成份个数", ascending=False).head(topN)

    def calc_sector(row):
        code = str(row["行业代码"])  # 如 801120.SI
        code_num = code.split(".")[0]  # index_hist_sw 用纯数字
        name = str(row["行业名称"])
        level1 = str(row["上级行业"]) if pd.notna(row.get("上级行业")) else None
        pe = float(row["静态市盈率"]) if pd.notna(row.get("静态市盈率")) else 0.0

        try:
            hist = ak.index_hist_sw(symbol=code_num, period="day")
            if hist is None or len(hist) < 25:
                return None
            closes = hist["收盘"].astype(float).tolist()
            volumes = hist["成交量"].astype(float).tolist()
            amounts = hist["成交额"].astype(float).tolist()

            change_5d = (closes[-1] - closes[-6]) / closes[-6] * 100 if len(closes) >= 6 and closes[-6] != 0 else 0.0
            recent_vol = sum(volumes[-5:]) / 5 if len(volumes) >= 5 else 0.0
            prior_vol = sum(volumes[-25:-5]) / 20 if len(volumes) >= 25 else recent_vol
            vol_ratio = recent_vol / prior_vol if prior_vol > 0 else 1.0
            recent_amt = sum(amounts[-5:]) / 5 if len(amounts) >= 5 else 0.0
            prior_amt = sum(amounts[-25:-5]) / 20 if len(amounts) >= 25 else recent_amt
            amt_ratio = recent_amt / prior_amt if prior_amt > 0 else 1.0
        except Exception:
            return None

        return {"code": code, "name": name, "level1": level1, "pe": pe,
                "change_5d": change_5d, "vol_ratio": vol_ratio, "amt_ratio": amt_ratio}

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(calc_sector, [row for _, row in spot_df.iterrows()]))
    sector_data = [r for r in results if r is not None]
    if not sector_data:
        return []

    # 2. 跨板块归一化五因子到 0-100
    change_ranks = _normalize_to_100({s["code"]: s["change_5d"] for s in sector_data})
    vol_ranks = _normalize_to_100({s["code"]: s["vol_ratio"] for s in sector_data})
    amt_ranks = _normalize_to_100({s["code"]: s["amt_ratio"] for s in sector_data})
    pe_ranks = _normalize_to_100({s["code"]: -s["pe"] for s in sector_data})  # 反向：低 PE 高分

    items: list[SectorScoreItem] = []
    for s in sector_data:
        code = s["code"]
        f1 = change_ranks.get(code, 0.0)
        f2 = amt_ranks.get(code, 0.0)
        f3 = pe_ranks.get(code, 0.0)
        f4 = 0.0  # TODO: 板块 vs 大盘 β 回归
        f5 = vol_ranks.get(code, 0.0)
        # total 加权：涨幅 40% + 资金 25% + 估值 15% + 量能 20%（f4 待实现，权重分给其他）
        total = f1 * 0.40 + f2 * 0.25 + f3 * 0.15 + f5 * 0.20
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


@app.get("/health", response_model=HealthCheckResponse)
def health_check() -> HealthCheckResponse:
    """服务健康检查"""
    return HealthCheckResponse(
        status="ok",
        service="v9-data-collector",
        version="0.1.0",
    )
