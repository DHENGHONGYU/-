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
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="V9 Data Collector", version="0.1.0")


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
    fetched_at: str = datetime.now().isoformat()


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


@app.post("/api/collect/basic", response_model=CollectResponse)
def collect_basic(request: BasicCollectRequest) -> CollectResponse:
    """
    拉取单只股票基础信息。

    真实实现应调用 AKShare 的 stock_individual_info_em、stock_zh_a_gdhs、
    stock_comment_em 等接口，并将结果映射到 BasicCollectData 字段。
    """
    # TODO: 接入 AKShare 真实接口
    return CollectResponse(
        success=True,
        symbol=request.symbol,
        dimension="basic",
        data=BasicCollectData(
            name=f"{request.symbol}（示例）",
            price=100.0,
            pe=20.0,
            pb=3.0,
            roe=15.0,
            market_cap=1e11,
        ).model_dump(),
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
    拉取单只股票 K线数据。

    真实实现应调用 AKShare 的 stock_zh_a_hist 接口：
        akshare.stock_zh_a_hist(
            symbol=request.symbol,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date,
            adjust=request.adjust,
        )
    返回字段通常包含：日期、开盘、收盘、最高、最低、成交量、成交额、
    振幅、涨跌幅、涨跌额、换手率。本接口只保留 OHLCV + 成交额。
    """
    # TODO: 接入 AKShare 真实接口
    # 示例：生成最近 30 个交易日的模拟 K线
    today = datetime.now()
    history: list[KlineBar] = []
    base_price = 100.0
    for i in range(30, 0, -1):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        close = base_price + (30 - i) * 0.5 + (i % 5) * 0.2
        history.append(
            KlineBar(
                date=date,
                open=close - 0.5,
                high=close + 0.8,
                low=close - 0.8,
                close=close,
                volume=12345.0 + i * 100,
                amount=(12345.0 + i * 100) * close,
            )
        )

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


# 模拟财务数据字典（用于本地测试）
MOCK_FINANCIAL_DATA: dict[str, dict[str, Any]] = {
    # 贵州茅台 - 白酒龙头，高毛利、高净利率、低负债
    "600519": {
        "report_date": "2024-12-31",
        "revenue": 1505.6,
        "revenue_yoy": 16.3,
        "net_profit": 862.3,
        "net_profit_yoy": 19.2,
        "gross_margin": 91.5,
        "net_margin": 57.3,
        "operating_cf": 920.5,
        "rd_ratio": 2.1,
        "receivables": 12.8,
        "inventory_turnover_days": 480,
        "interest_bearing_debt": 0,
        "goodwill": 0,
        "net_assets": 1520.3,
        "shareholder_pledge": 0,
    },
    # 宁德时代 - 新能源龙头，高增长、中等毛利
    "300750": {
        "report_date": "2024-12-31",
        "revenue": 4009.2,
        "revenue_yoy": 22.8,
        "net_profit": 467.5,
        "net_profit_yoy": 28.5,
        "gross_margin": 22.8,
        "net_margin": 11.7,
        "operating_cf": 580.3,
        "rd_ratio": 6.5,
        "receivables": 450.2,
        "inventory_turnover_days": 95,
        "interest_bearing_debt": 320.5,
        "goodwill": 45.8,
        "net_assets": 1850.6,
        "shareholder_pledge": 8.5,
    },
    # 招商银行 - 银行龙头，稳定分红、高ROE
    "600036": {
        "report_date": "2024-12-31",
        "revenue": 3391.5,
        "revenue_yoy": 5.2,
        "net_profit": 1466.8,
        "net_profit_yoy": 6.8,
        "gross_margin": None,  # 银行无毛利率概念
        "net_margin": 43.2,
        "operating_cf": 1250.3,
        "rd_ratio": 3.8,
        "receivables": None,  # 银行应收类科目不同
        "inventory_turnover_days": None,
        "interest_bearing_debt": 8500.0,
        "goodwill": 0,
        "net_assets": 9200.5,
        "shareholder_pledge": 0,
    },
    # 比亚迪 - 新能源车龙头，高增长、低净利率
    "002594": {
        "report_date": "2024-12-31",
        "revenue": 6023.2,
        "revenue_yoy": 42.0,
        "net_profit": 300.4,
        "net_profit_yoy": 80.7,
        "gross_margin": 20.2,
        "net_margin": 5.0,
        "operating_cf": 450.8,
        "rd_ratio": 7.2,
        "receivables": 380.5,
        "inventory_turnover_days": 65,
        "interest_bearing_debt": 520.3,
        "goodwill": 12.5,
        "net_assets": 2150.8,
        "shareholder_pledge": 3.2,
    },
    # 海康威视 - 安防龙头，稳定增长、中等毛利
    "002415": {
        "report_date": "2024-12-31",
        "revenue": 893.5,
        "revenue_yoy": 8.5,
        "net_profit": 141.2,
        "net_profit_yoy": 10.3,
        "gross_margin": 44.5,
        "net_margin": 15.8,
        "operating_cf": 180.5,
        "rd_ratio": 10.2,
        "receivables": 280.3,
        "inventory_turnover_days": 120,
        "interest_bearing_debt": 85.0,
        "goodwill": 28.5,
        "net_assets": 520.8,
        "shareholder_pledge": 5.8,
    },
    # 腾讯控股 - 互联网龙头（港股，用于测试非A股场景）
    "00700": {
        "report_date": "2024-12-31",
        "revenue": 6190.5,
        "revenue_yoy": 9.8,
        "net_profit": 1940.2,
        "net_profit_yoy": 15.5,
        "gross_margin": 52.3,
        "net_margin": 31.3,
        "operating_cf": 2150.8,
        "rd_ratio": 12.5,
        "receivables": 450.2,
        "inventory_turnover_days": None,
        "interest_bearing_debt": 2800.0,
        "goodwill": 1850.5,
        "net_assets": 6500.3,
        "shareholder_pledge": 0,
    },
    # 中芯国际 - 半导体龙头，高研发、周期性
    "688981": {
        "report_date": "2024-12-31",
        "revenue": 527.3,
        "revenue_yoy": 18.5,
        "net_profit": 48.5,
        "net_profit_yoy": -35.2,
        "gross_margin": 19.8,
        "net_margin": 9.2,
        "operating_cf": 185.3,
        "rd_ratio": 15.8,
        "receivables": 85.2,
        "inventory_turnover_days": 145,
        "interest_bearing_debt": 420.5,
        "goodwill": 0,
        "net_assets": 1680.5,
        "shareholder_pledge": 0,
    },
    # 隆基绿能 - 光伏龙头，周期下行、利润下滑
    "601012": {
        "report_date": "2024-12-31",
        "revenue": 856.2,
        "revenue_yoy": -38.5,
        "net_profit": -85.3,
        "net_profit_yoy": -180.5,
        "gross_margin": 12.5,
        "net_margin": -9.9,
        "operating_cf": 45.8,
        "rd_ratio": 5.8,
        "receivables": 180.5,
        "inventory_turnover_days": 110,
        "interest_bearing_debt": 280.3,
        "goodwill": 15.2,
        "net_assets": 680.5,
        "shareholder_pledge": 12.5,
    },
}


def get_mock_financial_data(symbol: str) -> dict[str, Any] | None:
    """获取模拟财务数据"""
    # 去除后缀（如 600519.SH → 600519）
    clean_symbol = symbol.split(".")[0].upper()
    return MOCK_FINANCIAL_DATA.get(clean_symbol)


@app.post("/api/collect/financial", response_model=CollectResponse)
def collect_financial(request: FinancialCollectRequest) -> CollectResponse:
    """
    拉取单只股票财务分析指标。

    真实实现应调用 AKShare 的 stock_financial_analysis_indicator 接口，
    并将结果映射到 FinancialCollectData 字段。

    当前为模拟实现，返回预置的测试数据。
    """
    # TODO: 接入 AKShare 真实接口
    mock_data = get_mock_financial_data(request.symbol)

    if mock_data is None:
        # 对于未预置的股票，返回默认模拟数据
        mock_data = {
            "report_date": "2024-12-31",
            "revenue": 100.0,
            "revenue_yoy": 10.0,
            "net_profit": 15.0,
            "net_profit_yoy": 12.0,
            "gross_margin": 30.0,
            "net_margin": 15.0,
            "operating_cf": 20.0,
            "rd_ratio": 5.0,
            "receivables": 25.0,
            "inventory_turnover_days": 60.0,
            "interest_bearing_debt": 50.0,
            "goodwill": 5.0,
            "net_assets": 120.0,
            "shareholder_pledge": 8.0,
        }

    return CollectResponse(
        success=True,
        symbol=request.symbol,
        dimension="financial",
        data=FinancialCollectData(**mock_data).model_dump(),
        records=1,
        fetched_at=datetime.now().isoformat(),
    )


# ---------------------------------------------------------------------------
# 健康检查
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthCheckResponse)
def health_check() -> HealthCheckResponse:
    """服务健康检查"""
    return HealthCheckResponse(
        status="ok",
        service="v9-data-collector",
        version="0.1.0",
    )
