"""
iFinD MCP 数据采集 — 完整使用示例
================================
对应 V9 数据血缘追踪文档 1.3 节 iFinD MCP 数据采集架构

运行方式:
    python main.py

架构层次（对应文档 1.1 节五层架构）:
    1. UI 层: 用户触发采集策略
    2. 编排层: CollectionPipeline 流水线主控
    3. 适配层: McpCollector / MultiSourceFetcher
    4. 数据源层: iFinD MCP Servers / 传统数据源
    5. 持久化层: DataBridge → 模拟 IndexedDB

新增示例（v1.5.0）:
    - 示例 9: SSE 推送服务器 + 实时订阅
    - 示例 10: 真实 API 客户端调用 (腾讯/新浪/东财)
    - 示例 11: DataBridge + SSE 联动
    - 示例 12: 采集流水线 + SSE 实时推送
"""

import asyncio
import time
import json
from typing import List

from dimension_mapping import (
    DimensionCode, McpServerId, DIMENSION_MCP_MAPPING,
    MCP_PRIORITY_DIMENSIONS, MULTI_SOURCE_DIMENSIONS,
    CollectionMode, DIMENSION_TO_MODE,
)
from mcp_client import McpClient, McpCallRequest, run_mcp
from mcp_collector import (
    McpCollector, CollectionContext, McpCollectResult, collect_dimension,
)
from multi_source_fetcher import (
    MultiSourceFetcher, FetchMode, create_default_fetcher, create_real_fetcher,
)
from adaptive_source_orchestrator import (
    AdaptiveSourceOrchestrator, CircuitState, with_circuit_breaker,
)
from data_bridge import DataBridge, EnvelopeAction, Envelope
from data_flow_engine import DataFlowEngine, DataPacket, data_flow_engine
from collection_pipeline import (
    CollectionPipeline, RunTraceResult, BatchTraceResult, PipelineEvent,
    PipelineEventType, quick_collect,
)


# ============================================================
# 示例 1: 底层 MCP 调用 — 直接调用单个 Tool
# ============================================================

async def example_1_raw_mcp_call():
    """
    示例 1: 底层 MCP 调用

    对应文档 5.5 节 MCP 调用方式，模拟 TypeScript 侧 run_mcp() 工具调用。
    """
    print("=" * 60)
    print("示例 1: 底层 MCP 调用 — run_mcp()")
    print("=" * 60)

    # 自然语言查询模式
    result = await run_mcp(
        server_name=McpServerId.STOCK,
        tool_name="get_stock_info",
        args={"query": "000001.SZ 平安银行 的上市时间、所属申万行业、主营业务"},
    )

    print(f"  Server: {result.server_name}")
    print(f"  Tool:   {result.tool_name}")
    print(f"  成功:   {result.success}")
    print(f"  延迟:   {result.latency_ms:.1f}ms")
    if result.success:
        print(f"  数据:   {json.dumps(result.data, ensure_ascii=False, indent=2)}")
    else:
        print(f"  错误:   {result.error}")
    print()


# ============================================================
# 示例 2: MCP 适配层 — 采集单个维度（并行子查询）
# ============================================================

async def example_2_mcp_collector():
    """
    示例 2: MCP 适配层采集

    对应文档 2.22 节和 3.7 节序列图：
    mcpCollector.buildMcpRequests → 并行子查询 → aggregateMcpResults
    """
    print("=" * 60)
    print("示例 2: MCP 适配层 — 采集单个维度")
    print("=" * 60)

    # 采集 Dim 04 (重大事项) — 3 个子查询跨 2 个 Server 并行
    result = await collect_dimension("000001.SZ", DimensionCode.MAJOR_EVENTS)
    print(f"  维度: {result.dimension_code.name}")
    print(f"  成功: {result.success}")
    print(f"  子查询: {result.success_count}/{result.query_count} 成功")
    print(f"  延迟: {result.total_latency_ms:.1f}ms")
    if result.errors:
        print(f"  错误: {result.errors}")
    print(f"  数据键: {list(result.data.keys())}")
    print()

    # 采集 Dim 01 (基本信息) — 2 个子查询并行
    result = await collect_dimension("600036.SH", DimensionCode.BASIC_INFO)
    print(f"  维度: {result.dimension_code.name}")
    print(f"  成功: {result.success}")
    print(f"  数据: {json.dumps(result.data, ensure_ascii=False, indent=2)}")
    print()


# ============================================================
# 示例 3: 多源拉取器 — 降级链
# ============================================================

async def example_3_multi_source_fetcher():
    """
    示例 3: 多源拉取器

    对应文档 1.3.2 节降级链：Tushare → 东财 → 新浪
    演示 RACE 模式和 MERGE 模式
    """
    print("=" * 60)
    print("示例 3: 多源拉取器 — 降级链")
    print("=" * 60)

    fetcher = create_default_fetcher()

    # RACE 模式：按降级链顺序，首个成功即返回
    result = await fetcher.fetch(
        symbol="000001.SZ",
        dim_code=DimensionCode.CHIP,
        mode=FetchMode.RACE,
    )
    print(f"  [RACE] 筹码分布:")
    print(f"    成功: {result.success}")
    print(f"    主源: {result.primary_source}")
    print(f"    降级: {result.fallback_used}")
    print(f"    延迟: {result.total_latency_ms:.1f}ms")
    for sr in result.source_results:
        print(f"      {sr.source_name}: {'OK' if sr.success else f'FAIL ({sr.error})'} ({sr.latency_ms:.1f}ms)")
    print()

    # MERGE 模式：并行拉取全部源，合并字段
    result = await fetcher.fetch(
        symbol="000001.SZ",
        dim_code=DimensionCode.DIVIDEND_SHARES,
        mode=FetchMode.MERGE,
    )
    print(f"  [MERGE] 分红股本:")
    print(f"    成功: {result.success}")
    print(f"    合并源: {result.primary_source}")
    for sr in result.source_results:
        print(f"      {sr.source_name}: {'OK' if sr.success else f'FAIL ({sr.error})'}")
    print()


# ============================================================
# 示例 4: 自适应熔断器
# ============================================================

async def example_4_circuit_breaker():
    """
    示例 4: 自适应熔断器

    演示熔断器状态转换：CLOSED → OPEN → HALF_OPEN → CLOSED
    """
    print("=" * 60)
    print("示例 4: 自适应熔断器")
    print("=" * 60)

    orchestrator = AdaptiveSourceOrchestrator()

    # 模拟连续失败触发熔断
    print("  模拟连续失败...")
    for i in range(6):
        orchestrator.record_failure("tushare")
        status = orchestrator.get_breaker_status()["tushare"]
        print(f"    第{i+1}次失败: state={status['state']}, failures={status['failure_count']}")

    print(f"\n  熔断后 can_execute: {orchestrator.can_execute('tushare')}")
    print()

    # 模拟恢复
    print("  等待恢复超时...")
    import time
    orchestrator._breakers["tushare"].open_at = time.time() - 61
    can_exec = orchestrator.can_execute("tushare")
    status = orchestrator.get_breaker_status()["tushare"]
    print(f"  恢复超时后: can_execute={can_exec}, state={status['state']}")
    print()


# ============================================================
# 示例 5: DataBridge — ACL + 持久化 + 审计
# ============================================================

async def example_5_data_bridge():
    """
    示例 5: DataBridge 数据桥接层

    演示 ACL 权限校验、审计日志、Store 订阅
    """
    print("=" * 60)
    print("示例 5: DataBridge — ACL 权限 + 审计")
    print("=" * 60)

    db = DataBridge()

    # 写入股票数据
    result = db.forward(
        action=EnvelopeAction.INSERT_STOCK,
        payload={"symbol": "000001.SZ", "name": "平安银行", "pe": 5.2, "pb": 0.55},
        module="stockpool",
    )
    print(f"  写入 stocks: {result}")

    # 写入采集结果
    result = db.forward(
        action=EnvelopeAction.SAVE_COLLECTION_RESULT,
        payload={"symbol": "000001.SZ", "dimension": 4, "data": {"events": []}},
        module="collector",
    )
    print(f"  写入 collection_results: {result}")

    # ACL 拒绝测试：collector 模块无 orders 写入权限
    result = db.forward(
        action=EnvelopeAction.INSERT_ORDER,
        payload={"symbol": "000001.SZ", "quantity": 1000},
        module="collector",
    )
    print(f"  ACL 拒绝 (collector → orders): {result}")

    # 审计日志
    logs = db.get_audit_logs()
    print(f"\n  审计日志 ({len(logs)} 条):")
    for log in logs:
        print(f"    [{log['module']}] {log['action']} → {log['store']} ({log['key']})")

    # Store 统计
    print(f"\n  Store 统计: {db.store_stats}")
    print()


# ============================================================
# 示例 6: 采集流水线 — 完整流程
# ============================================================

def pipeline_event_handler(event: PipelineEvent):
    """流水线事件回调"""
    if event.event_type == PipelineEventType.DIM_COMPLETE:
        dim_name = event.dim_code.name if event.dim_code else "?"
        print(f"  [{event.symbol}] {dim_name}: OK")
    elif event.event_type == PipelineEventType.DIM_FAILED:
        dim_name = event.dim_code.name if event.dim_code else "?"
        print(f"  [{event.symbol}] {dim_name}: FAILED — {event.message}")


async def example_6_full_pipeline():
    """
    示例 6: 采集流水线完整流程

    对应文档 1.3.3 节采集流水线核心流程：
    触发采集 → 维度路由 → MCP/多源/直连 → DataBridge 写入 → KIMI 增强
    """
    print("=" * 60)
    print("示例 6: 采集流水线 — 完整流程")
    print("=" * 60)

    pipeline = CollectionPipeline(on_event=pipeline_event_handler)

    mcp_dims = sorted(MCP_PRIORITY_DIMENSIONS, key=lambda d: d.value)
    print(f"  采集维度: {[d.name for d in mcp_dims]}")
    print(f"  标的列表: ['000001.SZ', '600036.SH']")
    print()

    start = time.perf_counter()
    results = await pipeline.run_collection(
        symbols=["000001.SZ", "600036.SH"],
        dimension_codes=mcp_dims,
    )
    elapsed = time.perf_counter() - start

    print(f"\n  采集汇总 ({elapsed:.1f}s):")
    for batch in results:
        print(f"    {batch.symbol}: {batch.success_count}/{batch.total_count} 维度成功")
        for trace in batch.results:
            status = "✓" if trace.success else "✗"
            source = trace.source.ljust(20)
            latency = f"{trace.latency_ms:.0f}ms"
            print(f"      {status} {trace.dim_code.name:20s} | {source} | {latency}")

    print(f"\n  DataBridge Store 统计: {pipeline._data_bridge.store_stats}")
    print(f"  DataBridge 审计日志: {pipeline._data_bridge.audit_count} 条")
    print()


# ============================================================
# 示例 7: 14维度 → MCP Tool 映射表
# ============================================================

async def example_7_dimension_mapping():
    """
    示例 7: 14维度 → MCP Tool 映射表

    打印完整的维度映射配置，对应文档 2.22 节映射表
    """
    print("=" * 60)
    print("示例 7: 14维度 → MCP Tool 映射表")
    print("=" * 60)

    print(f"  {'维度':<4} {'名称':<12} {'模式':<14} {'MCP Server':<12} {'Tool':<24} {'子查询数'}")
    print(f"  {'-'*4} {'-'*12} {'-'*14} {'-'*12} {'-'*24} {'-'*8}")

    for dim in DimensionCode:
        mode = DIMENSION_TO_MODE.get(dim, "?")
        queries = DIMENSION_MCP_MAPPING.get(dim, [])

        if queries:
            servers = set(q.server_name.split(".")[-1] for q in queries)
            tools = ", ".join(q.tool_name for q in queries)
            server_str = "+".join(sorted(servers))
            print(f"  {dim.value:02d}  {dim.name:<12} {mode:<14} {server_str:<12} {tools:<24} {len(queries)}")
        else:
            print(f"  {dim.value:02d}  {dim.name:<12} {mode:<14} {'(非MCP)'}")

    print()
    print(f"  MCP 优先维度: {len(MCP_PRIORITY_DIMENSIONS)} 个")
    print(f"  多源降级维度: {len(MULTI_SOURCE_DIMENSIONS)} 个")
    print()


# ============================================================
# 示例 8: 熔断器 + 降级链联合演示
# ============================================================

async def example_8_circuit_with_fallback():
    """
    示例 8: 熔断器 + 降级链联合演示

    模拟 Tushare 熔断后自动跳过，使用东财爬虫作为降级源
    """
    print("=" * 60)
    print("示例 8: 熔断器 + 降级链联合")
    print("=" * 60)

    orchestrator = AdaptiveSourceOrchestrator()
    fetcher = create_default_fetcher()

    for _ in range(6):
        orchestrator.record_failure("tushare")

    print(f"  Tushare 熔断: can_execute=False")
    print(f"  原始降级链: ['tushare', 'eastmoney', 'sina']")
    available = orchestrator.get_available_sources(["tushare", "eastmoney", "sina"])
    print(f"  过滤后链:   {available}")
    print()

    result = await fetcher.fetch(
        symbol="000001.SZ",
        dim_code=DimensionCode.CHIP,
        mode=FetchMode.RACE,
        fallback_chain=available,
    )
    print(f"  拉取结果: success={result.success}, source={result.primary_source}")
    for sr in result.source_results:
        print(f"    {sr.source_name}: {'OK' if sr.success else f'FAIL'}")
    print()


# ============================================================
# === 新增示例 v1.5.0 ===
# 示例 9: SSE 推送服务器 + 实时订阅
# ============================================================

def on_sse_packet(packet: DataPacket):
    """SSE 订阅回调 — 打印收到的数据包"""
    print(f"  [SSE 收到] 通道: {packet.channel}, 序列号: {packet.seq}")
    if isinstance(packet.data, dict):
        summary = {k: v for k, v in packet.data.items() if k != "results"}
        print(f"    数据: {json.dumps(summary, ensure_ascii=False)}")


async def example_9_sse_server():
    """
    示例 9: SSE 推送服务器 + 实时订阅

    演示：
    1. 启动 SSE 推送服务器
    2. 订阅通道
    3. 发布数据 → SSE 实时推送
    4. 查看通道列表和缓存统计
    """
    print("=" * 60)
    print("示例 9: SSE 推送服务器 + 实时订阅")
    print("=" * 60)

    # 创建独立的 DataFlowEngine 实例
    engine = DataFlowEngine()

    # 启动 SSE 服务器（后台线程）
    engine.start_sse_server(host="0.0.0.0", port=8080)
    print(f"  SSE 服务器已启动: {engine.sse_url}")
    print(f"  SSE 流端点:  {engine.sse_url}/sse/stream?channels=market:index,collection:progress")
    print(f"  SSE 轮询端点: {engine.sse_url}/sse/poll?channel=market:index")
    print(f"  通道列表:    {engine.sse_url}/sse/channels")
    print(f"  缓存统计:    {engine.sse_url}/sse/stats")
    print()

    # 等待服务器就绪
    await asyncio.sleep(0.3)

    # 订阅通道
    unsub1 = engine.subscribe("market:index", on_sse_packet)
    unsub2 = engine.subscribe("collection:progress", on_sse_packet)
    print("  已订阅通道: market:index, collection:progress")
    print()

    # 发布模拟数据
    print("  发布模拟数据...")
    engine.publish("market:index", {
        "index": "000300.SH",
        "name": "沪深300",
        "price": 3850.25,
        "change_pct": 0.85,
    })
    await asyncio.sleep(0.1)

    engine.publish("collection:progress", {
        "phase": "in_progress",
        "symbol": "000001.SZ",
        "completed": 1,
        "total": 10,
        "timestamp": time.time(),
    })
    await asyncio.sleep(0.1)

    engine.publish("market:index", {
        "index": "000001.SH",
        "name": "上证指数",
        "price": 3250.68,
        "change_pct": -0.32,
    })
    await asyncio.sleep(0.1)

    # 查看缓存
    cached = engine.get_cache("market:index")
    if cached:
        print(f"\n  缓存最新数据 (market:index): {json.dumps(cached.data, ensure_ascii=False)}")

    # 缓存统计
    stats = engine.get_cache_stats()
    print(f"  缓存统计: hits={stats.hits}, misses={stats.misses}, hit_rate={stats.hit_rate:.1%}")

    # 通道列表
    channels = engine.get_channels()
    print(f"  总通道数: {len(channels)}")
    print(f"  采集通道: {[c.channel for c in channels if 'collection' in c.channel]}")

    # 取消订阅
    unsub1()
    unsub2()

    # 停止 SSE 服务器
    engine.stop_sse_server()
    print(f"\n  SSE 服务器已停止")
    print()


# ============================================================
# 示例 10: 真实 API 客户端调用
# ============================================================

async def example_10_real_api():
    """
    示例 10: 真实 API 客户端调用

    演示腾讯行情、新浪行情、东财爬虫的真实 HTTP API 调用。
    注意：需要网络连接，部分 API 可能因网络环境限制不可用。
    """
    print("=" * 60)
    print("示例 10: 真实 API 客户端调用")
    print("=" * 60)

    from real_api_clients import (
        TencentQuoteAPI, SinaQuoteAPI, EastMoneyAPI,
        create_tushare_api, create_kimi_service,
    )

    # --- 腾讯行情 API ---
    print("  [腾讯行情 API]")
    quote = await TencentQuoteAPI.quote("000001.SZ")
    if quote:
        print(f"    平安银行: 价格={quote.get('price')}, 涨跌幅={quote.get('change_pct')}%")
        print(f"    名称={quote.get('name')}, PE={quote.get('pe')}, 换手率={quote.get('turnover_rate')}%")
    else:
        print(f"    腾讯行情 API 不可用（可能需要网络环境支持）")

    # --- 批量行情 ---
    print(f"\n  [腾讯批量行情]")
    batch = await TencentQuoteAPI.batch_quotes(["000001.SZ", "600036.SH"])
    for q in batch:
        print(f"    {q.get('symbol')} {q.get('name')}: {q.get('price')} ({q.get('change_pct')}%)")
    if not batch:
        print(f"    批量行情不可用")

    # --- 新浪行情 API ---
    print(f"\n  [新浪行情 API]")
    sina_quote = await SinaQuoteAPI.quote("000001.SZ")
    if sina_quote:
        print(f"    平安银行: 价格={sina_quote.get('price')}, 开盘={sina_quote.get('open')}, 成交量={sina_quote.get('volume')}")
    else:
        print(f"    新浪行情 API 不可用")

    # --- 东财爬虫 ---
    print(f"\n  [东财爬虫 API]")
    holders = await EastMoneyAPI.shareholder_data("000001.SZ")
    if holders:
        print(f"    股东户数: {holders.get('total_shareholders')}, 前十大占比: {holders.get('top10_pct')}%")
    else:
        print(f"    股东数据不可用")

    dividends = await EastMoneyAPI.dividend_history("000001.SZ")
    if dividends:
        print(f"    分红记录: {len(dividends)} 条")
        for d in dividends[:3]:
            print(f"      {d.get('ex_date')}: 现金分红 {d.get('cash_div')} 元/股")
    else:
        print(f"    分红数据不可用")

    # --- Tushare ---
    print(f"\n  [Tushare API]")
    tushare = create_tushare_api()
    if tushare.has_token:
        print(f"    Token 已配置，尝试获取数据...")
        try:
            basic = await tushare.stock_basic()
            print(f"    股票基础信息: {len(basic)} 条")
        except Exception as e:
            print(f"    Tushare 调用失败: {e}")
    else:
        print(f"    Tushare Token 未配置（设置 TUSHARE_TOKEN 环境变量）")

    # --- KIMI AI ---
    print(f"\n  [KIMI AI 服务]")
    kimi = create_kimi_service()
    if kimi._api_key:
        print(f"    KIMI API Key 已配置，剩余配额: {kimi.remaining_quota}")
    else:
        print(f"    KIMI API Key 未配置（设置 KIMI_API_KEY 环境变量）")
    print()


# ============================================================
# 示例 11: DataBridge + SSE 联动
# ============================================================

async def example_11_databridge_sse():
    """
    示例 11: DataBridge + SSE 联动

    演示 DataBridge 写入后自动通过 SSE 推送事件。
    任何 DataBridge.forward() 写入成功都会广播到 SSE 通道。
    """
    print("=" * 60)
    print("示例 11: DataBridge + SSE 联动")
    print("=" * 60)

    # 创建 DataFlowEngine 并绑定到 DataBridge
    engine = DataFlowEngine()
    db = DataBridge(data_flow_engine=engine)

    # 订阅 data:write 通道
    write_events = []
    def on_write(packet: DataPacket):
        write_events.append(packet.data)
        print(f"  [SSE] data:write → Store={packet.data['store']}, Action={packet.data['action']}")

    unsub = engine.subscribe("data:write", on_write)

    # 执行写入操作
    print("  执行 DataBridge 写入操作...")
    db.forward(
        action=EnvelopeAction.INSERT_STOCK,
        payload={"symbol": "000001.SZ", "name": "平安银行", "pe": 5.2},
        module="stockpool",
    )
    db.forward(
        action=EnvelopeAction.SAVE_DAILY_QUOTES,
        payload={"symbol": "000001.SZ", "date": "2026-08-17", "close": 11.25},
        module="collector",
    )
    db.forward(
        action=EnvelopeAction.SAVE_V6_SCORE,
        payload={"symbol": "000001.SZ", "score": 78.5},
        module="analyzer",
    )

    print(f"\n  共收到 {len(write_events)} 条 SSE 推送事件")
    print(f"  DataBridge 审计日志: {db.audit_count} 条")

    unsub()
    print()


# ============================================================
# 示例 12: 采集流水线 + SSE 实时推送
# ============================================================

async def example_12_pipeline_with_sse():
    """
    示例 12: 采集流水线 + SSE 实时推送

    演示完整的采集流水线，集成 DataFlowEngine 进行 SSE 实时推送。
    采集进度和结果会实时推送到 collection:progress / collection:result / collection:error 通道。
    """
    print("=" * 60)
    print("示例 12: 采集流水线 + SSE 实时推送")
    print("=" * 60)

    # 创建 DataFlowEngine
    engine = DataFlowEngine()

    # 启动 SSE 服务器
    engine.start_sse_server(host="0.0.0.0", port=8080)
    print(f"  SSE 服务器: {engine.sse_url}")
    print(f"  订阅地址: {engine.sse_url}/sse/stream?channels=collection:progress,collection:result,collection:error")
    print()

    # 收集 SSE 事件用于验证
    sse_events = []
    def on_collection_event(packet: DataPacket):
        ch = packet.channel
        data = packet.data
        if isinstance(data, dict):
            phase = data.get("phase", "")
            symbol = data.get("symbol", "")
            if ch == "collection:progress":
                sse_events.append(f"进度: {phase} - {data.get('completed', 0)}/{data.get('total', 0)}")
            elif ch == "collection:result":
                if "results" in data:
                    sse_events.append(f"结果: 完成 {len(data['results'])} 条")
                else:
                    sse_events.append(f"结果: {symbol} {data.get('dimension')} {'OK' if data.get('success') else 'FAIL'}")
            elif ch == "collection:error":
                sse_events.append(f"错误: {symbol} {data.get('dimension')} - {data.get('error')}")

    # 订阅采集相关通道
    engine.subscribe("collection:progress", on_collection_event)
    engine.subscribe("collection:result", on_collection_event)
    engine.subscribe("collection:error", on_collection_event)

    # 创建集成 SSE 的采集流水线
    pipeline = CollectionPipeline(
        data_flow_engine=engine,
        on_event=pipeline_event_handler,
    )

    # 执行快速采集
    print("  执行采集...")
    results = await pipeline.run_collection(
        symbols=["000001.SZ"],
        dimension_codes=list(MCP_PRIORITY_DIMENSIONS)[:4],  # 只取前 4 个维度加速
    )

    # 打印 SSE 事件汇总
    print(f"\n  SSE 事件汇总 ({len(sse_events)} 条):")
    for evt in sse_events:
        print(f"    {evt}")

    print(f"\n  采集结果: {results[0].success_count}/{results[0].total_count} 维度成功")
    print(f"  DataBridge Store 统计: {pipeline._data_bridge.store_stats}")

    # 停止 SSE 服务器
    engine.stop_sse_server()
    print(f"\n  SSE 服务器已停止")
    print()


# ============================================================
# 主函数
# ============================================================

async def main():
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║   iFinD MCP 数据采集 — Python 实现示例                  ║")
    print("║   对应 V9 数据血缘追踪文档 v1.5.0                        ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    await example_1_raw_mcp_call()
    await example_2_mcp_collector()
    await example_3_multi_source_fetcher()
    await example_4_circuit_breaker()
    await example_5_data_bridge()
    await example_6_full_pipeline()
    await example_7_dimension_mapping()
    await example_8_circuit_with_fallback()

    # === 新增示例 v1.5.0 ===
    await example_9_sse_server()
    await example_10_real_api()
    await example_11_databridge_sse()
    await example_12_pipeline_with_sse()

    print("=" * 60)
    print("所有示例执行完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())