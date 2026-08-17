"""
采集流水线主控 (collectionPipeline)
===================================
对应 TypeScript: src/services/data-collector/collectionPipeline.ts

核心职责：
1. 接收策略模板 → 解析启用的维度 → 按维度并发执行采集
2. runBatchTrace: 批量采集（每批 5 只股票，避免 API 限流）
3. runSingleTrace: 单次采集 → 维度路由 → MCP/多源/直连
4. 采集进度事件上报 + SSE 实时推送
5. KIMI AI 增强（Dim 05 新闻摘要, Dim 08 研报解读）
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict, Set
from enum import Enum

from dimension_mapping import (
    DimensionCode, DIMENSION_TO_MODE, CollectionMode,
    MCP_PRIORITY_DIMENSIONS, MULTI_SOURCE_DIMENSIONS,
    KIMI_ENHANCE_DIMENSIONS, MCP_FALLBACK_CHAINS,
)
from mcp_client import McpClient
from mcp_collector import (
    McpCollector, CollectionContext, CollectionEvent, CollectionEventType,
    McpCollectResult, collect_dimension,
)
from multi_source_fetcher import (
    MultiSourceFetcher, FetchMode, MultiSourceResult, create_default_fetcher,
)
from adaptive_source_orchestrator import AdaptiveSourceOrchestrator
from data_bridge import DataBridge, EnvelopeAction


# ============================================================
# 数据类型
# ============================================================

class PipelineEventType(Enum):
    """流水线事件类型"""
    BATCH_START    = "batch_start"
    BATCH_COMPLETE = "batch_complete"
    BATCH_FAILED   = "batch_failed"
    DIM_PROGRESS   = "dim_progress"
    DIM_COMPLETE   = "dim_complete"
    DIM_FAILED     = "dim_failed"
    ALL_COMPLETE   = "all_complete"


@dataclass
class PipelineEvent:
    """流水线事件"""
    event_type: PipelineEventType
    symbol: str = ""
    dim_code: Optional[DimensionCode] = None
    message: str = ""
    completed: int = 0
    total: int = 0
    data: Any = None


@dataclass
class RunTraceResult:
    """单次采集追踪结果"""
    symbol: str
    dim_code: DimensionCode
    success: bool
    source: str = ""          # "mcp" / "multi_source" / "direct_api"
    data: Any = None
    error: Optional[str] = None
    latency_ms: float = 0.0


@dataclass
class BatchTraceResult:
    """批量采集结果"""
    symbol: str
    results: List[RunTraceResult]
    success_count: int = 0
    total_count: int = 0
    total_latency_ms: float = 0.0


# 事件回调
PipelineCallback = Any


# ============================================================
# 采集流水线
# ============================================================

class CollectionPipeline:
    """
    采集流水线主控

    对应 TypeScript collectionPipeline 完整实现
    新增：DataFlowEngine SSE 实时推送 + 真实 API 客户端集成
    """

    def __init__(
        self,
        mcp_client: Optional[McpClient] = None,
        multi_fetcher: Optional[MultiSourceFetcher] = None,
        orchestrator: Optional[AdaptiveSourceOrchestrator] = None,
        data_bridge: Optional[DataBridge] = None,
        on_event: Optional[PipelineCallback] = None,
        # === 新增：真实 API 依赖 ===
        data_flow_engine: Optional[Any] = None,   # DataFlowEngine 实例
        kimi_service: Optional[Any] = None,       # KimiAIService 实例
        use_real_api: bool = False,               # 是否使用真实 API
    ):
        self._mcp_client = mcp_client or McpClient(mode="mock")
        self._multi_fetcher = multi_fetcher or create_default_fetcher()
        self._orchestrator = orchestrator or AdaptiveSourceOrchestrator()
        self._data_bridge = data_bridge or DataBridge()
        self._on_event = on_event

        # === 新增：SSE 推送引擎 ===
        self._data_flow_engine = data_flow_engine

        # === 新增：KIMI AI 服务 ===
        self._kimi_service = kimi_service

        # === 新增：真实 API 开关 ===
        self._use_real_api = use_real_api
        if use_real_api:
            from multi_source_fetcher import create_real_fetcher
            self._multi_fetcher = create_real_fetcher()

        # MCP 采集器
        self._mcp_collector = McpCollector(
            mcp_client=self._mcp_client,
            on_event=self._on_mcp_event,
        )

        # 进度统计
        self._batch_size = 5  # 每批 5 只股票

    # ----------------------------------------------------------
    # 对外接口
    # ----------------------------------------------------------

    async def run_collection(
        self,
        symbols: List[str],
        dimension_codes: List[DimensionCode],
        strategy_template: str = "default",
    ) -> List[BatchTraceResult]:
        """
        执行完整采集流程

        对应 TypeScript: sevenDimConfigStore.runCollection()

        Args:
            symbols: 标的列表
            dimension_codes: 启用的维度列表
            strategy_template: 策略模板名称
        """
        all_results = []

        # === SSE 推送：采集开始 ===
        self._publish_sse("collection:progress", {
            "phase": "started",
            "symbols": symbols,
            "dimensions": [d.name for d in dimension_codes],
            "total": len(symbols),
            "completed": 0,
            "timestamp": time.time(),
        })

        # 按每批 5 只股票拆分
        for batch_idx, i in enumerate(range(0, len(symbols), self._batch_size)):
            batch_symbols = symbols[i:i + self._batch_size]
            batch_tasks = [
                self.run_batch_trace(sym, dimension_codes, strategy_template)
                for sym in batch_symbols
            ]
            batch_results = await asyncio.gather(*batch_tasks)
            all_results.extend(batch_results)

            # === SSE 推送：批次进度 ===
            completed_count = min(i + self._batch_size, len(symbols))
            self._publish_sse("collection:progress", {
                "phase": "in_progress",
                "batch": batch_idx + 1,
                "completed": completed_count,
                "total": len(symbols),
                "timestamp": time.time(),
            })

        # 采集完成 → KIMI AI 增强
        await self._enhance_with_kimi(all_results, dimension_codes)

        self._emit_event(PipelineEvent(
            event_type=PipelineEventType.ALL_COMPLETE,
            message=f"采集完成: {len(symbols)} 只股票, {len(dimension_codes)} 维度",
            completed=len(symbols),
            total=len(symbols),
        ))

        # === SSE 推送：采集完成 ===
        summary = []
        for batch in all_results:
            for trace in batch.results:
                summary.append({
                    "symbol": trace.symbol,
                    "dimension": trace.dim_code.name,
                    "success": trace.success,
                    "source": trace.source,
                    "latency_ms": round(trace.latency_ms, 1),
                })
        self._publish_sse("collection:result", {
            "phase": "completed",
            "total": len(symbols),
            "results": summary,
            "timestamp": time.time(),
        })

        return all_results

    async def run_batch_trace(
        self,
        symbol: str,
        dimension_codes: List[DimensionCode],
        strategy_template: str = "default",
    ) -> BatchTraceResult:
        """
        批量采集：按维度并发执行采集

        对应 TypeScript: collectionPipeline.runBatchTrace(symbols, dimCode, config)
        """
        start = time.perf_counter()

        self._emit_event(PipelineEvent(
            event_type=PipelineEventType.BATCH_START,
            symbol=symbol,
            message=f"开始采集 {symbol}",
            total=len(dimension_codes),
        ))

        # 按维度并发执行
        tasks = [
            self.run_single_trace(symbol, dim, strategy_template)
            for dim in dimension_codes
        ]
        results = await asyncio.gather(*tasks)

        success_count = sum(1 for r in results if r.success)
        return BatchTraceResult(
            symbol=symbol,
            results=list(results),
            success_count=success_count,
            total_count=len(dimension_codes),
            total_latency_ms=(time.perf_counter() - start) * 1000,
        )

    async def run_single_trace(
        self,
        symbol: str,
        dim_code: DimensionCode,
        strategy_template: str = "default",
    ) -> RunTraceResult:
        """
        单次采集追踪：维度路由 → MCP/多源/直连

        对应 TypeScript: collectionPipeline.runSingleTrace

        路由逻辑（对应 1.3.3 节）：
        - dim 01-02: dataSourceOrchestrator → 腾讯/新浪（真实 API 或模拟）
        - dim 04-05, 08-14: mcpCollector → iFinD MCP
        - dim 03, 06-07, 15-16: multiSourceFetcher → Tushare → 东财 → 新浪
        - dim 09: 财务数据可走 fetcherService
        """
        start = time.perf_counter()
        mode = DIMENSION_TO_MODE.get(dim_code, CollectionMode.DIRECT_API)

        try:
            if mode == CollectionMode.MCP_PRIORITY:
                result = await self._trace_mcp_priority(symbol, dim_code)
            elif mode == CollectionMode.MULTI_SOURCE:
                result = await self._trace_multi_source(symbol, dim_code)
            else:
                result = await self._trace_direct_api(symbol, dim_code)

            result.latency_ms = (time.perf_counter() - start) * 1000

            # 写入 DataBridge
            if result.success and result.data:
                self._write_to_databridge(symbol, dim_code, result.data)

            # === SSE 推送：维度采集结果 ===
            self._publish_sse("collection:result", {
                "symbol": symbol,
                "dimension": dim_code.name,
                "success": result.success,
                "source": result.source,
                "latency_ms": round(result.latency_ms, 1),
                "error": result.error,
                "timestamp": time.time(),
            })

            # 事件通知
            if result.success:
                self._emit_event(PipelineEvent(
                    event_type=PipelineEventType.DIM_COMPLETE,
                    symbol=symbol,
                    dim_code=dim_code,
                    message=f"{dim_code.name} 采集成功 ({result.source})",
                    data=result.data,
                ))
            else:
                self._emit_event(PipelineEvent(
                    event_type=PipelineEventType.DIM_FAILED,
                    symbol=symbol,
                    dim_code=dim_code,
                    message=f"{dim_code.name} 采集失败: {result.error}",
                ))
                # === SSE 推送：采集错误 ===
                self._publish_sse("collection:error", {
                    "symbol": symbol,
                    "dimension": dim_code.name,
                    "error": result.error,
                    "timestamp": time.time(),
                })

            return result

        except Exception as e:
            error_result = RunTraceResult(
                symbol=symbol,
                dim_code=dim_code,
                success=False,
                source="error",
                error=str(e),
                latency_ms=(time.perf_counter() - start) * 1000,
            )
            self._publish_sse("collection:error", {
                "symbol": symbol,
                "dimension": dim_code.name,
                "error": str(e),
                "timestamp": time.time(),
            })
            return error_result

    # ----------------------------------------------------------
    # 维度路由
    # ----------------------------------------------------------

    async def _trace_mcp_priority(
        self, symbol: str, dim_code: DimensionCode
    ) -> RunTraceResult:
        """
        MCP 优先维度采集

        先尝试 iFinD MCP，失败则降级到传统数据源
        """
        ctx = CollectionContext(symbol=symbol, dimension_code=dim_code)
        mcp_result = await self._mcp_collector.collect(ctx)

        if mcp_result.success:
            return RunTraceResult(
                symbol=symbol,
                dim_code=dim_code,
                success=True,
                source="mcp",
                data=mcp_result.data,
            )

        # MCP 失败 → 降级到传统数据源
        fallback_chain = MCP_FALLBACK_CHAINS.get(dim_code, [])
        if not fallback_chain:
            return RunTraceResult(
                symbol=symbol,
                dim_code=dim_code,
                success=False,
                source="mcp",
                error=f"MCP 失败且无降级链: {mcp_result.errors}",
            )

        # 过滤已熔断的源
        available = self._orchestrator.get_available_sources(fallback_chain)
        if not available:
            return RunTraceResult(
                symbol=symbol,
                dim_code=dim_code,
                success=False,
                source="mcp_fallback",
                error="所有降级源均已熔断",
            )

        multi_result = await self._multi_fetcher.fetch(
            symbol=symbol,
            dim_code=dim_code,
            mode=FetchMode.RACE,
            fallback_chain=available,
        )

        return RunTraceResult(
            symbol=symbol,
            dim_code=dim_code,
            success=multi_result.success,
            source=f"fallback:{multi_result.primary_source}",
            data=multi_result.data,
            error=None if multi_result.success else "所有降级源均失败",
        )

    async def _trace_multi_source(
        self, symbol: str, dim_code: DimensionCode
    ) -> RunTraceResult:
        """
        多源降级维度采集

        使用降级链：Tushare → 东财 → 新浪
        """
        # 过滤已熔断的源
        from dimension_mapping import FALLBACK_CHAINS
        chain = FALLBACK_CHAINS.get(dim_code, [])
        available = self._orchestrator.get_available_sources(chain)

        # Dim 15/16 使用 MERGE 模式
        mode = FetchMode.MERGE if dim_code in (
            DimensionCode.DIVIDEND_SHARES, DimensionCode.CONSENSUS_EST
        ) else FetchMode.RACE

        result = await self._multi_fetcher.fetch(
            symbol=symbol,
            dim_code=dim_code,
            mode=mode,
            fallback_chain=available,
        )

        # 更新熔断器状态
        for sr in result.source_results:
            if sr.success:
                self._orchestrator.record_success(sr.source_name)
            else:
                self._orchestrator.record_failure(sr.source_name)

        return RunTraceResult(
            symbol=symbol,
            dim_code=dim_code,
            success=result.success,
            source=result.primary_source,
            data=result.data,
            error=None if result.success else "所有数据源均失败",
        )

    async def _trace_direct_api(
        self, symbol: str, dim_code: DimensionCode
    ) -> RunTraceResult:
        """
        行情API直连维度采集（Dim 01-02）

        使用真实 API 客户端（TencentQuoteAPI / SinaQuoteAPI）或模拟返回
        """
        if self._use_real_api:
            return await self._trace_direct_api_real(symbol, dim_code)

        # 模拟模式：返回模拟数据
        return RunTraceResult(
            symbol=symbol,
            dim_code=dim_code,
            success=True,
            source="direct_api",
            data={"symbol": symbol, "source": "tencent", "price": 11.25},
        )

    async def _trace_direct_api_real(
        self, symbol: str, dim_code: DimensionCode
    ) -> RunTraceResult:
        """
        真实 API 直连采集

        使用腾讯行情 API 作为主源，新浪作为降级
        """
        from real_api_clients import TencentQuoteAPI, SinaQuoteAPI

        # 尝试腾讯行情
        try:
            data = await TencentQuoteAPI.quote(symbol)
            if data:
                return RunTraceResult(
                    symbol=symbol,
                    dim_code=dim_code,
                    success=True,
                    source="tencent",
                    data=data,
                )
        except Exception as e:
            # 腾讯失败 → 降级到新浪
            try:
                data = await SinaQuoteAPI.quote(symbol)
                if data:
                    return RunTraceResult(
                        symbol=symbol,
                        dim_code=dim_code,
                        success=True,
                        source="sina",
                        data=data,
                    )
            except Exception as e2:
                return RunTraceResult(
                    symbol=symbol,
                    dim_code=dim_code,
                    success=False,
                    source="direct_api",
                    error=f"腾讯: {e}, 新浪: {e2}",
                )

        return RunTraceResult(
            symbol=symbol,
            dim_code=dim_code,
            success=False,
            source="direct_api",
            error="行情 API 全部返回空",
        )

    # ----------------------------------------------------------
    # DataBridge 写入
    # ----------------------------------------------------------

    def _write_to_databridge(
        self, symbol: str, dim_code: DimensionCode, data: Any
    ) -> None:
        """
        将采集结果写入 DataBridge

        对应 TypeScript: DataBridge.forward(ENVELOPE_ACTION, payload)
        """
        action = _dim_to_envelope_action(dim_code)
        if action is None:
            return

        payload = {
            "symbol": symbol,
            "dimension": dim_code.value,
            "dimension_name": dim_code.name,
            "data": data,
            "collected_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }

        result = self._data_bridge.forward(
            action=action,
            payload=payload,
            module="collector",
        )

        if not result["ok"]:
            print(f"  [DataBridge] 写入失败: {result['error']}")

    # ----------------------------------------------------------
    # KIMI AI 增强
    # ----------------------------------------------------------

    async def _enhance_with_kimi(
        self,
        results: List[BatchTraceResult],
        dimension_codes: List[DimensionCode],
    ) -> None:
        """
        KIMI AI 增强（非阻塞）

        对应 1.3.3 节：
        - Dim 05 热点新闻 → KIMI 摘要
        - Dim 08 研报中心 → KIMI 解读

        支持真实 KIMI API 和模拟模式
        """
        enhance_dims = [d for d in dimension_codes if d in KIMI_ENHANCE_DIMENSIONS]
        if not enhance_dims:
            return

        for dim in enhance_dims:
            for batch in results:
                for trace in batch.results:
                    if trace.dim_code == dim and trace.success:
                        if self._kimi_service:
                            # === 真实 KIMI API 调用 ===
                            summary = await self._real_kimi_enhance(
                                trace.symbol, dim, trace.data
                            )
                        else:
                            # 模拟 KIMI AI 增强
                            summary = await self._mock_kimi_enhance(trace.symbol, dim)
                        trace.data["_kimi_enhanced"] = summary

    async def _real_kimi_enhance(
        self, symbol: str, dim: DimensionCode, data: Any
    ) -> str:
        """
        真实 KIMI API 增强

        调用 KimiAIService 进行新闻摘要或研报解读
        """
        from real_api_clients import KimiAIService

        name = data.get("name", symbol) if isinstance(data, dict) else symbol

        if dim == DimensionCode.HOT_NEWS:
            news_list = data.get("news", []) if isinstance(data, dict) else []
            return await self._kimi_service.summarize_news(symbol, name, news_list)
        elif dim == DimensionCode.RESEARCH_REPORT:
            reports = data.get("reports", []) if isinstance(data, dict) else []
            return await self._kimi_service.digest_research(symbol, name, reports)
        return ""

    async def _mock_kimi_enhance(self, symbol: str, dim: DimensionCode) -> str:
        """模拟 KIMI AI 增强"""
        await asyncio.sleep(0.05)
        if dim == DimensionCode.HOT_NEWS:
            return f"[KIMI 摘要] {symbol} 近期基本面稳健，行业景气度回升，机构关注度提升。"
        elif dim == DimensionCode.RESEARCH_REPORT:
            return f"[KIMI 解读] {symbol} 近180天共12份研报，平均评级「增持」，目标价中枢13.5元。"
        return ""

    # ----------------------------------------------------------
    # SSE 推送
    # ----------------------------------------------------------

    def _publish_sse(self, channel: str, data: Any) -> None:
        """
        通过 DataFlowEngine 发布 SSE 推送

        对应 TS: dataFlowEngine.publish(channel, data)
        """
        if self._data_flow_engine:
            try:
                self._data_flow_engine.publish(channel, data)
            except Exception:
                pass  # SSE 推送失败不影响主流程

    # ----------------------------------------------------------
    # 事件 & 回调
    # ----------------------------------------------------------

    def _on_mcp_event(self, event: CollectionEvent) -> None:
        """MCP 采集事件 → 流水线事件"""
        self._emit_event(PipelineEvent(
            event_type=PipelineEventType.DIM_PROGRESS,
            symbol=event.symbol,
            dim_code=event.dimension_code,
            message=event.message,
        ))

    def _emit_event(self, event: PipelineEvent) -> None:
        if self._on_event:
            self._on_event(event)


# ============================================================
# 辅助函数
# ============================================================

def _dim_to_envelope_action(dim_code: DimensionCode) -> Optional[EnvelopeAction]:
    """维度编码 → 信封操作"""
    mapping = {
        DimensionCode.BASIC_INFO:      EnvelopeAction.INSERT_STOCK,
        DimensionCode.KLINE:           EnvelopeAction.SAVE_DAILY_QUOTES,
        DimensionCode.HOT_NEWS:        EnvelopeAction.SAVE_NEWS,
        DimensionCode.RESEARCH_REPORT: EnvelopeAction.SAVE_LOCAL_DOCS,
        DimensionCode.FINANCIAL:       EnvelopeAction.SAVE_V6_SCORE,
        DimensionCode.HOT_SECTORS:     EnvelopeAction.SAVE_SECTOR_SCORES,
        DimensionCode.INST_HOLDINGS:   EnvelopeAction.SAVE_COLLECTION_RESULT,
        DimensionCode.VALUATION:       EnvelopeAction.SAVE_V6_SCORE,
    }
    return mapping.get(dim_code, EnvelopeAction.SAVE_COLLECTION_RESULT)


# ============================================================
# 便捷函数
# ============================================================

async def quick_collect(symbol: str) -> List[BatchTraceResult]:
    """
    快速采集：对单个股票采集全部 14 个 MCP 维度

    使用示例:
        results = await quick_collect("000001.SZ")
    """
    pipeline = CollectionPipeline()
    mcp_dims = list(MCP_PRIORITY_DIMENSIONS)
    return await pipeline.run_collection(
        symbols=[symbol],
        dimension_codes=mcp_dims,
    )