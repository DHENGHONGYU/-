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
