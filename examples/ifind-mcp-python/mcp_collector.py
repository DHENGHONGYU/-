"""
MCP 适配层 (mcpCollector)
=========================
对应 TypeScript: src/services/data-collector/mcpCollector.ts

核心职责：
1. buildMcpRequests(ctx) — 根据维度上下文构建 MCP 子查询列表
2. aggregateMcpResults() — 聚合并行子查询结果
3. 统计采集成功/失败数，上报进度事件
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict
from enum import Enum

from dimension_mapping import (
    DimensionCode, McpSubQuery, DIMENSION_MCP_MAPPING,
    MCP_PRIORITY_DIMENSIONS,
)
from mcp_client import McpClient, McpCallRequest, McpToolResult, McpToolErrorCode


# ============================================================
# 数据类型
# ============================================================

class CollectionEventType(Enum):
    """采集事件类型"""
    PROGRESS = "progress"      # 进度更新
    COMPLETE = "complete"      # 维度完成
    FAILED   = "failed"        # 维度失败
    SKIPPED  = "skipped"       # 维度跳过（熔断）


@dataclass
class CollectionEvent:
    """采集事件"""
    event_type: CollectionEventType
    dimension_code: DimensionCode
    symbol: str
    message: str = ""
    completed_count: int = 0
    total_count: int = 0
    data: Any = None


@dataclass
class CollectionContext:
    """采集上下文"""
    symbol: str
    dimension_code: DimensionCode
    strategy_template: str = "default"
    extra_params: dict = field(default_factory=dict)


@dataclass
class McpCollectResult:
    """MCP 采集聚合结果"""
    dimension_code: DimensionCode
    symbol: str
    success: bool
    data: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    query_count: int = 0
    success_count: int = 0
    total_latency_ms: float = 0.0
    timestamp: str = ""


# ============================================================
# 事件回调类型
# ============================================================

EventCallback = Any  # Callable[[CollectionEvent], None] 的简化


# ============================================================
# MCP 采集器
# ============================================================

class McpCollector:
    """
    MCP 适配层采集器

    对应 TypeScript mcpCollector 的完整实现：
    - buildMcpRequests: 将维度上下文转为 MCP 子查询
    - runParallelQueries: 并行执行所有子查询
    - aggregateMcpResults: 聚合结果并统计
    """

    def __init__(self, mcp_client: McpClient, on_event: Optional[EventCallback] = None):
        self._client = mcp_client
        self._on_event = on_event
        self._stats = {
            "total_dimensions": 0,
            "success_dimensions": 0,
            "failed_dimensions": 0,
            "total_queries": 0,
        }

    @property
    def stats(self) -> dict:
        return dict(self._stats)

    async def collect(self, ctx: CollectionContext) -> McpCollectResult:
        """
        执行单个维度的 MCP 采集

        流程（对应 1.3.3 节 MCP 维度分支）：
        1. 解析维度 → 获取子查询列表
        2. 并行执行所有子查询
        3. 聚合结果
        4. 触发事件
        """
        self._stats["total_dimensions"] += 1
        start = time.perf_counter()

        # Step 1: 构建 MCP 请求
        sub_queries = self.build_mcp_requests(ctx)
        if not sub_queries:
            return McpCollectResult(
                dimension_code=ctx.dimension_code,
                symbol=ctx.symbol,
                success=False,
                errors=["维度无 MCP 映射"],
            )

        # Step 2: 并行执行所有子查询
        results = await self._run_parallel(sub_queries, ctx)

        # Step 3: 聚合结果
        result = self.aggregate_mcp_results(
            dimension_code=ctx.dimension_code,
            symbol=ctx.symbol,
            sub_results=results,
        )
        result.total_latency_ms = (time.perf_counter() - start) * 1000

        # Step 4: 统计 & 事件
        if result.success:
            self._stats["success_dimensions"] += 1
            self._emit_event(CollectionEvent(
                event_type=CollectionEventType.COMPLETE,
                dimension_code=ctx.dimension_code,
                symbol=ctx.symbol,
                message=f"维度 {ctx.dimension_code.name} 采集完成: {result.success_count}/{result.query_count}",
                data=result.data,
            ))
        else:
            self._stats["failed_dimensions"] += 1
            self._emit_event(CollectionEvent(
                event_type=CollectionEventType.FAILED,
                dimension_code=ctx.dimension_code,
                symbol=ctx.symbol,
                message=f"维度 {ctx.dimension_code.name} 采集失败: {result.errors}",
            ))

        return result

    def build_mcp_requests(self, ctx: CollectionContext) -> List[McpSubQuery]:
        """
        根据维度上下文构建 MCP 子查询列表

        对应 TypeScript: mcpCollector.buildMcpRequests(ctx)
        """
        return DIMENSION_MCP_MAPPING.get(ctx.dimension_code, [])

    async def _run_parallel(
        self, sub_queries: List[McpSubQuery], ctx: CollectionContext
    ) -> List[McpToolResult]:
        """
        并行执行所有子查询

        对应 TypeScript: Promise.all([...]) 并行模式
        """
        tasks = []
        for sq in sub_queries:
            args = sq.build_args(ctx.symbol)
            request = McpCallRequest(
                server_name=sq.server_name,
                tool_name=sq.tool_name,
                args=args,
            )
            tasks.append(self._client.call_tool(request))

        self._stats["total_queries"] += len(tasks)
        return await asyncio.gather(*tasks, return_exceptions=False)

    def aggregate_mcp_results(
        self,
        dimension_code: DimensionCode,
        symbol: str,
        sub_results: List[McpToolResult],
    ) -> McpCollectResult:
        """
        聚合并行子查询结果

        对应 TypeScript: mcpCollector.aggregateMcpResults()

        逻辑：
        - 只要有一个子查询成功，维度采集即视为成功
        - 失败的子查询记录错误但不断言整个维度失败
        """
        aggregated = {}
        errors = []
        success_count = 0

        for r in sub_results:
            if isinstance(r, Exception):
                errors.append(str(r))
                continue

            if r.success:
                success_count += 1
                if r.tool_name == "get_stock_info":
                    aggregated["basic_info"] = r.data
                elif r.tool_name == "get_stock_summary":
                    aggregated["valuation_summary"] = r.data
                elif r.tool_name == "get_stock_performance":
                    aggregated["performance"] = r.data
                elif r.tool_name == "stock_highfreq_quotes":
                    aggregated["highfreq"] = r.data
                elif r.tool_name == "get_stock_financials":
                    aggregated["financials"] = r.data
                elif r.tool_name == "get_stock_shareholders":
                    aggregated["shareholders"] = r.data
                elif r.tool_name == "get_stock_events":
                    aggregated["events"] = r.data
                elif r.tool_name == "search_notice":
                    aggregated["notices"] = r.data
                elif r.tool_name == "search_news":
                    aggregated["news"] = r.data
                elif r.tool_name == "search_stocks":
                    aggregated["peers"] = r.data
                elif r.tool_name == "sector_data":
                    aggregated["sector"] = r.data
                elif r.tool_name == "index_data":
                    aggregated["indices"] = r.data
                elif r.tool_name == "get_risk_indicators":
                    aggregated["risk"] = r.data
                elif r.tool_name == "get_esg_data":
                    aggregated["esg"] = r.data
                else:
                    aggregated[r.tool_name] = r.data
            else:
                errors.append(f"[{r.tool_name}] {r.error}")

        return McpCollectResult(
            dimension_code=dimension_code,
            symbol=symbol,
            success=success_count > 0,
            data=aggregated,
            errors=errors,
            query_count=len(sub_results),
            success_count=success_count,
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%S"),
        )

    def _emit_event(self, event: CollectionEvent) -> None:
        """触发采集事件回调"""
        if self._on_event:
            self._on_event(event)


# ============================================================
# 便捷函数：直接采集单个维度
# ============================================================

async def collect_dimension(
    symbol: str,
    dim_code: DimensionCode,
    on_event: Optional[EventCallback] = None,
) -> McpCollectResult:
    """
    便捷函数：直接采集单个维度的 iFinD MCP 数据

    使用示例:
        result = await collect_dimension("000001.SZ", DimensionCode.BASIC_INFO)
        print(result.data)
    """
    client = McpClient(mode="mock")
    collector = McpCollector(mcp_client=client, on_event=on_event)
    ctx = CollectionContext(symbol=symbol, dimension_code=dim_code)
    return await collector.collect(ctx)