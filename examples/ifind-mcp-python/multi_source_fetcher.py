"""
多源拉取器 (multiSourceFetcher)
==============================
对应 TypeScript: src/services/data-collector/multiSourceFetcher.ts

核心职责：
1. 按降级链顺序尝试拉取数据（Tushare → 东财 → 新浪）
2. 支持并行拉取 + 首个成功返回（race 模式）
3. 支持全量拉取 + 字段合并（merge 模式，用于 Dim 15/16）
"""

import asyncio
import time
import random
from dataclasses import dataclass, field
from typing import List, Optional, Any, Callable, Awaitable
from enum import Enum

from dimension_mapping import (
    DimensionCode, FALLBACK_CHAINS, MCP_FALLBACK_CHAINS,
    MULTI_SOURCE_DIMENSIONS,
)


# ============================================================
# 数据类型
# ============================================================

class FetchMode(Enum):
    """拉取模式"""
    RACE  = "race"   # 竞速模式：按降级链顺序，首个成功即返回
    MERGE = "merge"  # 合并模式：拉取全部源，合并字段


@dataclass
class SourceResult:
    """单个数据源拉取结果"""
    source_name: str
    success: bool
    data: Any = None
    error: Optional[str] = None
    latency_ms: float = 0.0


@dataclass
class MultiSourceResult:
    """多源拉取聚合结果"""
    dimension_code: DimensionCode
    symbol: str
    success: bool
    data: Any = None
    primary_source: str = ""
    fallback_used: bool = False
    source_results: List[SourceResult] = field(default_factory=list)
    total_latency_ms: float = 0.0


# 数据源拉取函数类型
SourceFetcher = Callable[[str], Awaitable[Any]]


# ============================================================
# 多源拉取器
# ============================================================

class MultiSourceFetcher:
    """
    多源拉取器

    两种策略：
    1. RACE 模式（默认）：按降级链顺序尝试，首个成功即返回
       - 适用：Dim 03 (筹码), Dim 06 (行业竞品), Dim 07 (关联指数)
    2. MERGE 模式：并行拉取全部源，合并字段
       - 适用：Dim 15 (分红股本, 三 API 并行), Dim 16 (一致预期, 并行预期+评级)
    """

    def __init__(self, source_fetchers: dict[str, SourceFetcher]):
        """
        Args:
            source_fetchers: 数据源名称 → 拉取函数映射
                例如: {"tushare": tushare_fetch, "eastmoney": eastmoney_fetch, "sina": sina_fetch}
        """
        self._fetchers = source_fetchers

    async def fetch(
        self,
        symbol: str,
        dim_code: DimensionCode,
        mode: FetchMode = FetchMode.RACE,
        fallback_chain: Optional[List[str]] = None,
    ) -> MultiSourceResult:
        """
        执行多源拉取

        Args:
            symbol: 股票代码
            dim_code: 维度编码
            mode: 拉取模式（RACE 或 MERGE）
            fallback_chain: 自定义降级链，默认使用 FALLBACK_CHAINS 配置
        """
        start = time.perf_counter()

        if fallback_chain is None:
            fallback_chain = FALLBACK_CHAINS.get(dim_code, [])

        if not fallback_chain:
            return MultiSourceResult(
                dimension_code=dim_code,
                symbol=symbol,
                success=False,
                data=None,
                primary_source="",
                source_results=[],
                total_latency_ms=(time.perf_counter() - start) * 1000,
            )

        if mode == FetchMode.RACE:
            result = await self._fetch_race(symbol, dim_code, fallback_chain)
        else:
            result = await self._fetch_merge(symbol, dim_code, fallback_chain)

        result.total_latency_ms = (time.perf_counter() - start) * 1000
        return result

    async def _fetch_race(
        self,
        symbol: str,
        dim_code: DimensionCode,
        fallback_chain: List[str],
    ) -> MultiSourceResult:
        """
        RACE 模式：按降级链顺序尝试，首个成功即返回

        对应 1.3.2 节降级链：Tushare → 东财 → 新浪
        """
        source_results = []

        for source_name in fallback_chain:
            fetcher = self._fetchers.get(source_name)
            if fetcher is None:
                source_results.append(SourceResult(
                    source_name=source_name,
                    success=False,
                    error=f"数据源 {source_name} 未注册",
                ))
                continue

            t0 = time.perf_counter()
            try:
                data = await fetcher(symbol)
                latency = (time.perf_counter() - t0) * 1000
                source_results.append(SourceResult(
                    source_name=source_name,
                    success=True,
                    data=data,
                    latency_ms=latency,
                ))
                # 首个成功即返回
                return MultiSourceResult(
                    dimension_code=dim_code,
                    symbol=symbol,
                    success=True,
                    data=data,
                    primary_source=source_name,
                    fallback_used=(source_name != fallback_chain[0]),
                    source_results=source_results,
                )
            except Exception as e:
                latency = (time.perf_counter() - t0) * 1000
                source_results.append(SourceResult(
                    source_name=source_name,
                    success=False,
                    error=str(e),
                    latency_ms=latency,
                ))

        # 全部失败
        return MultiSourceResult(
            dimension_code=dim_code,
            symbol=symbol,
            success=False,
            source_results=source_results,
        )

    async def _fetch_merge(
        self,
        symbol: str,
        dim_code: DimensionCode,
        fallback_chain: List[str],
    ) -> MultiSourceResult:
        """
        MERGE 模式：并行拉取全部源，合并字段

        对应 Dim 15 (分红股本) 三 API 并行、Dim 16 (一致预期) 并行预期+评级
        """
        tasks = {}
        for source_name in fallback_chain:
            fetcher = self._fetchers.get(source_name)
            if fetcher is None:
                continue
            tasks[source_name] = asyncio.create_task(
                self._fetch_single(symbol, source_name, fetcher)
            )

        # 等待所有任务完成
        source_results = []
        for source_name, task in tasks.items():
            try:
                result = await task
                source_results.append(result)
            except Exception as e:
                source_results.append(SourceResult(
                    source_name=source_name,
                    success=False,
                    error=str(e),
                ))

        # 合并所有成功的数据
        merged_data = {}
        for sr in source_results:
            if sr.success and isinstance(sr.data, dict):
                merged_data.update(sr.data)

        success = len(merged_data) > 0
        return MultiSourceResult(
            dimension_code=dim_code,
            symbol=symbol,
            success=success,
            data=merged_data if success else None,
            primary_source="+".join(sr.source_name for sr in source_results if sr.success),
            fallback_used=False,
            source_results=source_results,
        )

    async def _fetch_single(
        self, symbol: str, source_name: str, fetcher: SourceFetcher
    ) -> SourceResult:
        """拉取单个数据源"""
        t0 = time.perf_counter()
        try:
            data = await fetcher(symbol)
            return SourceResult(
                source_name=source_name,
                success=True,
                data=data,
                latency_ms=(time.perf_counter() - t0) * 1000,
            )
        except Exception as e:
            return SourceResult(
                source_name=source_name,
                success=False,
                error=str(e),
                latency_ms=(time.perf_counter() - t0) * 1000,
            )


# ============================================================
# 模拟数据源拉取函数（用于测试）
# ============================================================

async def _mock_tushare_fetch(symbol: str) -> dict:
    """模拟 Tushare 数据拉取"""
    await asyncio.sleep(random.uniform(0.05, 0.15))
    if random.random() > 0.9:
        raise RuntimeError("Tushare API 不可用")
    return {"tushare_data": f"Tushare 数据 for {symbol}"}

async def _mock_eastmoney_fetch(symbol: str) -> dict:
    """模拟东财爬虫数据拉取"""
    await asyncio.sleep(random.uniform(0.1, 0.3))
    if random.random() > 0.95:
        raise RuntimeError("东财爬虫解析失败")
    return {"eastmoney_data": f"东财数据 for {symbol}"}

async def _mock_sina_fetch(symbol: str) -> dict:
    """模拟新浪代理数据拉取"""
    await asyncio.sleep(random.uniform(0.05, 0.1))
    return {"sina_data": f"新浪数据 for {symbol}"}

async def _mock_tencent_fetch(symbol: str) -> dict:
    """模拟腾讯代理数据拉取"""
    await asyncio.sleep(random.uniform(0.05, 0.12))
    return {"tencent_data": f"腾讯数据 for {symbol}"}

async def _mock_westock_fetch(symbol: str) -> dict:
    """模拟微证券数据拉取"""
    await asyncio.sleep(random.uniform(0.08, 0.2))
    return {"westock_data": f"微证券数据 for {symbol}"}


# 默认模拟数据源注册表
MOCK_SOURCE_FETCHERS: dict[str, SourceFetcher] = {
    "tushare":   _mock_tushare_fetch,
    "eastmoney": _mock_eastmoney_fetch,
    "sina":      _mock_sina_fetch,
    "tencent":   _mock_tencent_fetch,
    "westock":   _mock_westock_fetch,
}


# ============================================================
# 真实 API 数据源拉取函数
# 对应 real_api_clients.py — Tencent / Sina / Tushare / EastMoney
# ============================================================

async def _real_tencent_fetch(symbol: str) -> dict:
    """
    腾讯行情 API 拉取
    对应 TS: directDataAPI.ts tencentQuote
    """
    from real_api_clients import TencentQuoteAPI
    result = await TencentQuoteAPI.quote(symbol)
    if result is None:
        raise RuntimeError(f"腾讯行情 API 返回空: {symbol}")
    return result

async def _real_sina_fetch(symbol: str) -> dict:
    """
    新浪行情 API 拉取
    对应 TS: directDataAPI.ts sinaQuote
    """
    from real_api_clients import SinaQuoteAPI
    result = await SinaQuoteAPI.quote(symbol)
    if result is None:
        raise RuntimeError(f"新浪行情 API 返回空: {symbol}")
    return result

async def _real_tushare_fetch(symbol: str) -> dict:
    """
    Tushare Pro API 拉取
    对应 TS: tushareProvider.ts
    获取股票基础信息 + 最新日线 + 股东户数
    """
    from real_api_clients import create_tushare_api
    api = create_tushare_api()
    if not api.has_token:
        raise RuntimeError("Tushare Token 未配置（设置环境变量 TUSHARE_TOKEN）")

    ts_code = symbol.replace(".SH", ".SH").replace(".SZ", ".SZ")
    # 并行获取多类数据
    results = {}
    try:
        basic = await api.stock_basic()
        results["basic"] = [r for r in basic if r.get("ts_code") == ts_code]
    except Exception:
        pass

    try:
        daily = await api.daily(ts_code)
        results["daily"] = daily[:5]
    except Exception:
        pass

    try:
        holders = await api.stk_holdernumber(ts_code)
        results["holders"] = holders[:5]
    except Exception:
        pass

    if not results:
        raise RuntimeError(f"Tushare 数据拉取失败: {symbol}")
    return results

async def _real_eastmoney_fetch(symbol: str) -> dict:
    """
    东财爬虫 API 拉取
    对应 TS: crawlerProvider.ts
    获取股东数据 + 分红历史 + 一致预期
    """
    from real_api_clients import EastMoneyAPI
    results = {}

    try:
        holders = await EastMoneyAPI.shareholder_data(symbol)
        if holders: results["shareholders"] = holders
    except Exception:
        pass

    try:
        dividends = await EastMoneyAPI.dividend_history(symbol)
        if dividends: results["dividends"] = dividends[:5]
    except Exception:
        pass

    try:
        consensus = await EastMoneyAPI.consensus_estimate(symbol)
        if consensus: results["consensus"] = consensus
    except Exception:
        pass

    try:
        lockup = await EastMoneyAPI.lockup_expiry(symbol)
        if lockup: results["lockup"] = lockup[:5]
    except Exception:
        pass

    if not results:
        raise RuntimeError(f"东财爬虫数据拉取失败: {symbol}")
    return results

async def _real_kimi_fetch(symbol: str) -> dict:
    """
    KIMI AI 增强拉取（占位）
    实际调用由 collection_pipeline 的 KimiAIService 处理
    """
    return {"kimi": "请通过 KimiAIService 调用"}


# 真实 API 数据源注册表
REAL_SOURCE_FETCHERS: dict[str, SourceFetcher] = {
    "tencent":   _real_tencent_fetch,
    "sina":      _real_sina_fetch,
    "tushare":   _real_tushare_fetch,
    "eastmoney": _real_eastmoney_fetch,
    "kimi":      _real_kimi_fetch,
}


def create_default_fetcher() -> MultiSourceFetcher:
    """创建带默认模拟数据源的多源拉取器"""
    return MultiSourceFetcher(source_fetchers=MOCK_SOURCE_FETCHERS)

def create_real_fetcher() -> MultiSourceFetcher:
    """
    创建带真实 API 客户端的拉取器

    使用真实 HTTP API (Tencent/Sina/Tushare/EastMoney)，
    Tushare 需要设置 TUSHARE_TOKEN 环境变量。
    """
    return MultiSourceFetcher(source_fetchers=REAL_SOURCE_FETCHERS)