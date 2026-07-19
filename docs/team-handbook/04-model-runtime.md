---
title: TODO-ADD-TITLE
type: reference
domain: ai
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文回答\"模型怎么跑、数据怎么�?*\"。权威基线：`src/services/scoring/`、`src/services/data-collector/`、`src/core..."
tags: [ai, guide, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 04 · 模型运行思路（Model Runtime & Data Flow�?
> 本文回答"**模型怎么跑、数据怎么�?*"。权威基线：`src/services/scoring/`、`src/services/data-collector/`、`src/core/`、`src/data/`、`src/agents/`、`src/services/llm/`、`src/mcp/`、`docs/reference/05-engine-specs.md`、`docs/reference/ai-memory-layer.md`、`docs/reference/ai-generate-audit-fix-loop.md`�?> ⚠️ 概念澄清�?*五因子（板块轮动，合成种子）�?V6 十一层引�?�?九维智能评分**，三者独立�?
---

## 1. 评分引擎总览（三个独立概念）

| 概念 | 文件 | 性质 | UI 标注 |
|------|------|------|---------|
| **V6 规则引擎**（个�?板块 11 层） | `src/services/scoring/v6-engine/` | 白盒�?00% 可解�?| 实时引擎结果 |
| **九维智能评分** | `src/services/scoring/intelligentScoreService.ts` | 数据驱动优先（V6→九维），LLM 仅增�?| 数据不足时标 `llm-synthetic` |
| **板块轮动五因�?* | `src/services/analysis/rotationScoreService.ts` | **合成种子**（静�?composite 派生�?| 必须�?示例 · LLM 合成" |

---

## 2. V6 规则引擎（白盒可解释�?
- `config.ts`�?*所有阈�?权重/公式参数集中注入**，支�?`V6ScoreConfigOverride` 运行时覆盖（Backtestable 接口）�?  - `DEFAULT_WEIGHTS`�?1 �?L-1 ~ L8（如 `l1:0.15, l7:0.15, l0:0.08…`）�?  - `DEFAULT_THRESHOLDS.rating`：`strongBuy:4.0, buy:3.0, hold:2.0, sell:1.0`；分数范�?`[0,5]`�?  - `INDUSTRY_BENCHMARKS`�? 行业基准库；`RISK_WARNINGS`/`IPC_CONFIG`/`CHIP_LEVELS`/`CONFIDENCE_CONFIG`�?  - `DEFAULT_ENGINE_CONFIG`：`{ offlineMode:true, auditEnabled:true, llmEnabled:false }`�?- `engine.ts`：`V6ScoreEngine` 类�?  - `calculateLayer()`：单�?+ `sanitizeScore()`（NaN�?、∞�?/-∞→0、越界截�?[0,5]）�?  - `calculateAll()`�?1 �?`Promise.all` 并行 �?`aggregate()` 加权平均 + 归一化，NaN 层跳过并记录 `skippedLayers`�?  - `crossValidate()` 交叉验证；`mapRating()` �?`strong_buy/buy/hold/sell/strong_sell`�?  - 引擎版本 `v6-engine-v1.0.0`�?
---

## 3. 九维智能评分（数据驱动优先）

`runIntelligentScore()` 编排：读基础数据 �?V6 实时引擎 �?读补充文�?报告 →（可选）LLM �?解析 �?校验 �?保存�?
- 九维因子来自 `src/config/scoreFactors.ts` �?`STOCK_SCORE_FACTORS`（估�?成长/盈利/质量/动量/波动/流动�?行业/情绪）�?- `v6CompositeToDimensionScores()` �?V6 �?11 �?`CompositeScore` 映射�?9 维（�?估值←l3v、成长←l7+l5、情绪←l6+l4）�?- **数据驱动优先策略**：有 V6 结果则取其维度与总分；LLM 仅做可选文本增强。V6 不可用时必须�?LLM，否则返回失败（禁止黑箱/崩溃）�?- **来源溯源**：`scoreProvenance: 'data-driven' | 'llm-synthetic'`；`validateScoreBeforeSave()`（V9-003 三道校验）拦�?`block` 级异常后再经 `sendWriteEnvelope('saveIntelligentScores')` 持久化�?
---

## 4. 板块轮动五因子（合成种子，标"示例"�?
- `rotationScoreService.ts` �?`saveDefaultRotationScores()` 注释明确�?使用板块综合分映射到五因子（兜底方案，真实场景应由外部数据填充）"。子分数由静�?`sector.composite` 经固定系数派生（�?`F1A = composite*3`）�?- 权重：`strategyConfig.ts` 景气 40% / 资金 25% / 估�?15% / β 12% / 量能 8%�?- **UI 强制标注**：`IntelligentScorePage.tsx` 渲染 `<Badge title="当前为合成示例数据，非真实引擎信�?>示例 · LLM 合成</Badge>`�?
---

## 5. 轮动信号检测（真实信号�?
`rotationSignalDetector.ts` �?`detectBySector(sectorId)` 基于 `dataBridge.query` 聚合板块内股票真�?K 线，检测三条件全满足则 `triggered=true`�?1. 成交量突�?20% 历史分位（`checkVolumeBreakthrough`）�?2. 资金连续 N 日净流入（`checkCapitalInflow`，默�?3）�?3. 技术金叉（`checkGoldenCross`：短均线上穿长均线且价在短均线之上）�?强度由量能突破幅度定（weak/medium/strong）�?
---

## 6. 数据采集流水�?
### 6.1 事件类型（生命周期）
`src/types/modules/collection.types.ts` 定义 `COLLECTION_EVENTS`：`collect:triggered` �?`collect:source:start/success/fail` �?`collect:fallback` �?`collect:transform` �?`collect:write:start/success/fail` �?`collect:complete` �?`collect:task:status`；另 `collectionPipeline.ts` 直接 `eventBus.emit('collect:trace', span)` 广播链路追踪�?
### 6.2 编排器（四层降级�?`dataSourceOrchestrator.ts`：按优先级链降级（腾�?�?新浪 �?AKShare �?Mock），关键节点 emit 生命周期事件，结果经 `dataBridge.forward()` 写入 IndexedDB。AKShare 在浏览器不可用，Mock 为最终兜底�?
### 6.3 配置化流水线
`collectionPipeline.ts`：按 `CollectionConfig` 执行单次/批量采集 �?orchestrator �?`dataBridge.forward()` 写入 �?每阶�?emit 事件。不依赖任何 store（配置由调用方传入）。`createDefaultCollectionConfig()` 默认 `historyDays:252, maxSymbols:40`�?
### 6.4 质量指标
`qualityMetricsCollector.ts`（单例）：采集成功率/完整�?延迟/写入成功�?降级计数；告警阈�?`successRate<80%`、`completeness<90%`、`writeRate<95%`�?
### 6.5 配置与端�?- `dataSourceRegistry.ts`：`DATA_SOURCE_ENDPOINTS`�? 端点）、`DEFAULT_QUOTE_PRIORITY`（腾�?→新�?→akshare3[disabled]→mock4）�?- `collectConfig.ts`：`DEFAULT_DIMENSIONS`�? 维）、`STRATEGY_TEMPLATES`�? 个）、`GLOBAL_LIMITS`�?- `marketDataEndpoints.ts`：URL 收敛�?Vite dev proxy（`/api/proxy/tencent/` 等）�?*严禁�?services 层硬编码外部 URL**�?
### 6.6 运行�?Store（消费事件）
- `collectionRuntimeStore.ts`：订�?`COLLECTION_EVENTS`，维�?`traceSpans/logs/taskStatuses/overallProgress/stats`�?- `sevenDimConfigStore.ts`：七维采集配置，�?`dataBridge.forward()` 持久化�?- `dataTestStore.ts`：采集测试面板（单接口链�?批量测试）�?
---

## 7. 核心基础设施（DataBridge 现状 vs 网关目标�?
| 模块 | 现状 | 目标 |
|------|------|------|
| 写入�?| `core/databridge.ts` 直接 `import { db }` + `db.put`（见�?16�?81 行） | 改为 `dataGateway.execute()`，仅 Gateway 能直�?`dataLayer` |
| 信封 | `envelope.ts` `StandardEnvelope{meta,payload}` | 同现�?|
| ACL | `acl.ts` `ACL_MATRIX` module→store→operation | 下沉�?Gateway "最后一公里"二次校验（纵深防御） |
| 缓存 | `memoryCache.ts` 读缓存（10s TTL/200 LRU�?| 同现�?|
| 事件 | `eventBus.ts` 写后广播 `${store}Changed` | 同现�?|

> ⚠️ 文档�?services 写仅�?DataBridge �?data/gateway/"目前**未完全落�?*；DataGateway 仅存在于 `docs/reference/gateway-write-permission-spec.md`。手册表述为"目标架构/待迁�?�?
### Web Worker 池（算力卸载�?- `src/services/workers/v6ScoreWorker.ts`：Vite 模块 Worker�?*纯计算、不触及 IndexedDB/DOM**�?- `v6ScoreTaskScheduler.ts`：`V6ScoreTaskScheduler` 管理 ≤`min(hardwareConcurrency,4)` �?Worker；主线程负责 I/O，Worker 只算；优雅降级（初始化失�?`forceMainThread` 回退主线�?`Promise.all`）；单任�?30s 超时；全局单例 `getGlobalScheduler()`�?
---

## 8. Agent / LLM / MCP 生�?
### 8.1 Agents
`src/agents/`：`agentRuntime`/`agentRegistry`/`agentHealthMonitor`/`agentConfigManager`/`taskQueue`；预定义 `AGENT_V6_SCORING`(mcp `'scoring:v6'`)、`AGENT_LLM_INTelligent`(mcp `'llm'`) 等�?
### 8.2 LLM
`src/services/llm/llmGateway.ts`：`chat()`/`streamingChat()` 封装，做配置校验、调用审计、错误降级（`allowFallback` 返空）、Token 统计；`caller/callerId` 用于 MCP ACL 合规�?
### 8.3 MCP�?5 �?Server�?`src/mcp/`：`register.ts` �?`import.meta.glob('./servers/**/*.ts')` 同步加载并按 `MCP_SERVER_REGISTRY` 实例化；`syncWithConfig()` 支持热更新。类别目录：`analysis, backtest, data-collector, execution, fetcher, knowledge, lllm, news, pool, portfolio, scoring, screening, system, trading, workflow`�?ACL：双端校验（Client `MCPClientImpl` 防君�?+ Server `MCPServerBase.assertServerPermission()` 防小人）�? 角色 `agent/ui/ci/system`，矩�?`MCP_ACL_MATRIX`（`src/config/mcpAclMatrix.ts`）�?
### 8.4 AI 记忆层（RAG�?`scripts/build-ai-memory-index.ts` 扫描 `AGENTS.md`/`docs/reference/*`/`prompts/*`，按标题切分建倒排索引 �?`public/ai-memory-index.json`；运行时 `aiMemoryService.queryMemory(query, topK=5)` 关键词检索�?
### 8.5 生成—审计—修正飞�?`docs/reference/ai-generate-audit-fix-loop.md`：AI 开发闭�?`生成 �?审计 �?修正 �?再审计`，审计须依次�?`tsc` �?`lint:colors` �?`audit:layers` �?`audit:docs` �?`audit:tokens` �?`audit:jsdoc` �?`audit:complexity`；修�?只改失败原因，不扩大改动范围"�?
---

## 9. 数据流到 UI 与性能

### 9.1 分析结果 �?UI
1. 采集：`orchestrator/pipeline �?dataBridge.forward(Envelope) �?IndexedDB` �?emit `WRITE_SUCCESS/COMPLETE` + `broadcast(store)`�?2. 评分：`intelligentScoreService` / `V6ScoreTaskScheduler` �?Worker �?`CompositeScore` �?`validateScoreBeforeSave` �?`sendWriteEnvelope('saveIntelligentScores')` �?IndexedDB�?3. UI 消费：Store 订阅 DataBridge/EventBus 频道刷新；`IntelligentScorePage` 对合成结果渲�?示例 · LLM 合成"Badge�?
### 9.2 性能考量
- **MemoryCache**：DataBridge 读缓�?10s TTL / 200 LRU，`performance.now()` 时间戳�?- **精确�?*：`sanitizeScore` 截断 [0,5]，处�?±�?NaN；`aggregate` �?`Math.round(score*100)/100`�?- **perf �?*：`src/lib/perf.ts` 提供 `measureAsync/measureSync`，`PERF.SCORING_CALCULATE_ALL` 已包 V6 `calculateAll`；`getPerfStats()` 返回 count/avg/p50/p95/max�?- **计算卸载**：V6 �?Web Worker 池（�?）避免主线程阻塞，失败自动回退主线程�?
### 9.3 IndexedDB 数据种类（节选）
行情/基础：`stocks`/`dailyQuotes`/`financialReports`；评分：`v6Scores`/`intelligentScores`/`industryScores`/`rotationScores`/`hotSectorScores`/`valuePitScores`/`sectorScores`/`scoreDocs`；信�?交易：`signals`/`orders`/`portfolio`/`tradeReviews`；内容：`researchLogs`/`news`/`localDocs`；内部：`collectConfig`/`traceRecords`/`workflow*`/`watchlists`/`rbac*`�?