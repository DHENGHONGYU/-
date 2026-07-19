---
title: optimization-progress-report
type: explanation
domain: project
phase: planning
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Date�?026-07-11 00:25 基于 `optimization-plan.md` 优先级推进，本次完成 P0 剩余�?+ P1 服务�?Store..."
tags: [project, optimization, report, plan, governance, documentation, strategy, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 优化计划执行进度报告（P1 服务层中优项推进�?
> **Date**�?026-07-11 00:25
> 基于 `optimization-plan.md` 优先级推进，本次完成 P0 剩余�?+ P1 服务�?Store 层主要优化项，并回归门禁测试�?> 
> 2026-07-10 追加：完成测试失败诊断与修复、MCP 违规收尾、门禁回归�?
---

## 一、本次完成项汇�?
### 1.1 第二�?P1 服务�?Store �?UI 层中优项（新�?18 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/services/resilience.ts` | `withRetry` | 提取 `computeRetryDelay` / `handleRetryAttempt` 辅助函数 |
| `src/services/execution/executionPlanService.ts` | `updatePhase` | 提取 `applyPhaseTimestamp` 阶段时间戳函�?|
| `src/services/fetcher/orchestrator/phaseOrchestrator.ts` | `collectDimension` | 提取 `isParallelDimension` / `resolveDimensionType` / `collectStub` / `writeCollectedItem` |
| `src/services/input/batchImportParsers.ts` | `parseCsvLine` | 提取 `handleQuotedChar` 处理 CSV 引号转义 |
| `src/services/input/batchImportParsers.ts` | `parseJsonFile` | 提取 `parseJsonRow` 单条 JSON 行解�?|
| `src/services/trading/positionComputer.ts` | `buildTradePairs` | 提取 `matchSellWithBuys` FIFO 配对辅助函数；使�?`continue` 扁平化主循环 |
| `src/services/trading/tradeErrorUtils.ts` | `buildTradePairs` | 提取 `createTradePair` 辅助函数 |
| `src/services/trading/tradeReviewAI.utils.ts` | `buildTradePairs` | 提取 `createTradePair` 辅助函数 |
| `src/services/useCase/fetchSectorAnalysis.useCase.ts` | `fetchSectorAnalysisUseCase` | 提取 `loadOrCalculate` 通用加载/降级逻辑；`compareIndustryByScoredAt` 比较�?|
| `src/services/useCase/rebalancePortfolio.useCase.ts` | `<arrow>` | 提取 `updateHoldingForOrder` 持仓更新辅助函数 |
| `src/services/hybrid-proofread/localCollector.ts` | `collectFiles` / `traverse` | 提取模块�?`isPathExcluded` / `isPathIncluded` / `collectFileIfIncluded` |
| `src/services/hybrid-proofread/reportGenerator.ts` | `generateRecommendations` | 提取 `appendRecommendation` 去重辅助函数 |
| `src/lib/validation.ts` | `sanitizeObject` | 提取 `sanitizeValue` 单字段脱敏函�?|
| `src/store/analysisStore.derived.ts` | `scoreLevelDistribution` | 提取 `classifyScoreLevel` 分档函数 |
| `src/store/rotationSignalStore.derived.ts` | `strengthDistribution` | 提取 `classifyStrength` 强度分类函数 |
| `src/store/chatStore.derived.ts` | `messageStatsMemo` | 使用 `ROLE_STAT_KEY` 查找表替�?if-else �?|
| `src/apps/command/CommandApp.tsx` | `useEffect` / render | 使用 `BRANCH_INFO` 查找�?+ `renderCommandContent` switch 替代链式条件 |
| `src/cockpit/widgets/StockChatWidget.tsx` | `renderInline` | 提取 `renderInlineToken` 辅助函数 |
| `src/lib/localStorageManager.ts` | `byteLength` / `getNamespaceInfo` | 提取 `utf8ByteCount` / `computeOldestNewest` |
| `src/data/queryBuilder.ts` | 新闻任务 | 提取 `collectSuccessfulNews` 辅助函数 |
| `src/services/system/localDocService.ts` | `searchLocalDocs` | 提取 `calculateMatchScore` 评分辅助函数 |
| `src/services/trading/portfolioService.ts` | `requestWithRetry` | 改为递归重试，消除循环内嵌套 |
| `src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts` | `scoreFinancialDimensions` | 提取 `scoreCashFlow` / `scoreOrders` 阈值函�?|

### 1.2 类型/测试修复

- 补充 `src/lib/validation.test.ts` 缺失�?`validateConfigName` 导入�?
### 1.3 2026-07-10 测试失败�?MCP 违规收尾（新�?3 项）

| 文件 | 问题 | 修复动作 |
|------|------|----------|
| `tests/__tests__/scripts/verify-all-routes.test.ts` | 测试用预期路径与 `scripts/verify-all-routes.ts` �?`EXPECTED_PATHS` 不同步，导致 `missing-route` 误报 32 �?| 同步全部 62 条预期路�?|
| `tests/__tests__/integration/llmEnhancer.integration.test.ts` | M2 依据追溯闸上线后，mock 响应未带 `citations`，LLM 评分调整被回退 | `buildLlmEnhanceResponse` 默认�?citation；手动为代码�?动态响应用例补�?citations |
| `src/pages/command/__tests__/MCPServerDashboardPage.test.tsx` | `vi.mock('@/mcp/bridge')` 路径与实际组件导�?`@/mcp/bridge/mcpBridge` 不匹配，导致真实桥接实现被调�?| 修正 mock 路径�?`@/mcp/bridge/mcpBridge` 并复�?`mockCallTool` |
| `src/pages/command/health/HealthDashboardPage.tsx` | MCP 审计违规：直�?import `services/system/healthDashboardService` | 改为通过 `mcpBridge.callTool('system', 'fetch_health_report', {})` 调用；类型从 `@/types/modules/health.types` 引入 |

### 1.4 2026-07-11/12 测试失败继续收敛（新�?6 项）

| 文件 | 问题 | 修复动作 |
|------|------|----------|
| `tests/InputApp.test.tsx` | poolStore �?DataBridge.query 读取，mock �?`dataLayer.stocks.list` 未生效；子路由测试用 `MemoryRouter` �?`HashRouter` 行为不一�?| mock `dataBridge.query` 返回股票列表；`renderApp` 改用 `HashRouter` 并设�?`window.location.hash`；批量导�?mock 对齐 `importStocksWithProgress`/`detectDuplicates`；skip 已移除的列表视图切换用例 |
| `tests/TradingApp.test.tsx` | `loadPortfolio` 先调�?`portfolioService.loadPortfolioInput` �?DataBridge，未 mock 导致挂起 | �?`vi.hoisted` + `vi.mock` 拦截 `loadPortfolioInput`，使其直接返�?`{ stocks: [], orders: [] }` |
| `src/cockpit/widgets/HotSectorWidget.test.tsx` | 空态断言写死旧文本「暂无热门板块策略」，与组件当�?`UI_TEXT.analysis.hotSector.noData` 不一�?| 更新为「暂无热门板块策略数据�?|
| `src/cockpit/widgets/ValuePitWidget.test.tsx` | 空态断言写死旧文本「暂无价值洼地策略」，与组件当�?`UI_TEXT.analysis.valuePit.noData` 不一�?| 更新为「暂无价值洼地策略数据�?|
| `src/store/tradingStore.ts` | `loadPortfolio` �?`portfolio` 可能�?`undefined` 导致 `portfolio.holdings.length` 报错 | 增加可选链 `portfolio?.holdings.length ?? 0` |
| `src/cockpit/CockpitShell.tsx` | `SafeWrapper` 在组件内部定�?`useMemo` 后仍出现条件返回前的 hooks 问题 | 调整 `SafeWrapper` 定义位置，确�?hooks 顺序稳定 |

> 以上修复后，29 个历史失败测试文件已全部独立通过�?### 1.1 剩余 P0 核心层嵌套（3 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/mcp/core/server.ts` | `readResource` | 提取 `resolveResourceMatch` / `tryReadResource` 辅助函数，ACL 与读取逻辑扁平�?|
| `src/mcp/core/client.ts` | `readResource` | 提取 `findResourceMatch` / `checkAclAndRead` 辅助函数，减少循环内嵌套 |
| `src/data/sectorDefinitions.ts` | `matchStocksToSectors` | �?`matchByKeywords` / `matchByKeyStocks` 谓词函数，合并重复循�?|

### 1.2 P1 服务层中优项（已完成 24 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/services/llm/llmClient.ts` | `streamingChat` | 提取 `parseErrorMessageFromResponse` / `processStreamLines` |
| `src/services/llm/llmClient.ts` | `chat` | 复用 `parseErrorMessageFromResponse` 消除重复错误解析逻辑 |
| `src/services/fetcher/fetcherInterceptor.ts` | `interceptedFetch` | 提取 `tryOnce` / `createHttpErrorFromResponse` / `createNetworkError` / `triggerAuthCallbacks` |
| `src/services/fetcher/fetcherClient.ts` | `request` | 提取 `tryRequest` 单次尝试函数，循环体外处理错误分�?|
| `src/services/news/stockLinker.ts` | `matchText` | 拆分 `matchExactCode` / `matchExactName` / `matchFuzzyName` / `matchIndustry` 四个策略函数 |
| `src/services/scoring/rotationSignalDetector.ts` | `detectBySector` | 提取 `aggregateSectorBars` 聚合函数 |
| `src/services/system/localDocService.ts` | `scanFolder` | 提取 `processFileEntry` 文件处理函数 |
| `src/services/trading/portfolioService.ts` | `requestWithRetry` | 提取 `sleep` 辅助函数，循环体提前退�?|
| `src/services/data-collector/collectors/BaseCollector.ts` | `collectWithRetry` | 提取 `tryCollectOnce` 单次尝试函数 |
| `src/services/scoring/hotSectorDimensions.ts` | `calculateSentiment` | 排名映射改为 `RANK_TIERS` 数组查找 |
| `src/services/scoring/v6-engine/calculators/l0_l1_l2.ts` | `scoreLongTermTrend` | 趋势评分改为 `TREND_SCORES` 映射�?|
| `src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts` | `scoreValuation` | PEG/PE 分档提取�?`scorePeg` / `scorePeRelative` 函数 |
| `src/services/scoring/v6-engine/calculators/l4_l5_l6.ts` | `evaluateTMMatrix` | 行业分值与策略象限改为 `SECTOR_SCORES` / `STRATEGY_MAP` 查找；修�?`STRATEGY_MAP` 中科技行业映射，回�?v6-engine 测试 |
| `src/services/scoring/valuePitAnalyzer.ts` | `calculateValuationMargin` / `calculateRotationPosition` / `calculateLiquidity` | 分档映射改为 `*_TIERS` 数组查找 |
| `src/services/input/batchImportParsers.ts` | `parseBulkInput` | 4 种格式解析改�?`PARSERS` 数组策略 |
| `src/services/hybrid-proofread/index.ts` | `runFullProofread` | 提取 `evaluateFileForMatches` 文件评估辅助函数 |
| `src/services/useCase/generateTradeReview.useCase.ts` | `generateTradeReviewAsyncUseCase` | 提取 `generateLlmInsight` 统一 LLM 洞察/降级逻辑 |
| `src/services/analysis/scoreTrendService.ts` | `aggregateScoresByPeriod` | 提取 `getOrCreateBucket` / `addCompositeScore` / `addDimensionScores` / `bucketToPoint` |
| `src/services/backtest/BacktestEngine.ts` | `run` | 提取 `_updatePositionAfterSell` / `_updatePositionAfterBuy` 持仓更新辅助函数 |
| `src/services/data-collector/mockDataCollection.ts` | `mockCollectorFetchWithRetry` | 提取 `attemptMockCollectorFetch` 单次尝试函数 |
| `src/services/feedbackService.ts` | `wrapOperation` | 提取 `attemptOperation` 单次尝试函数，主循环扁平�?|
| `src/services/fetcher/orchestrator/resilienceChain.ts` | `fetchQuote` / `fetchKline` | 提取 `runFallbackChain` / `trySource` 通用降级链辅助函�?|
| `src/services/trading/tradeErrorDetectors.ts` | `detectAgainstTrendAdding` | 提取 `groupBuyOrdersBySymbol` / `detectAgainstTrendForSymbol` |
| `src/services/data-collector/dataSourceOrchestrator.ts` | `getQuoteWithConfig` / `getKlineWithConfig` | 提取 `resolveSourcePriority` / `createTraceId` 消除重复条件 |
| `src/store/executionStore.ts` | `executePlan` | 提取 `finalizeExecution` / `transitionToCancelledOnError` |
| `src/store/helpers/withOptimisticUpdate.ts` | `withOptimisticUpdate` | 提取 `rollbackToSnapshot` 回滚辅助函数 |
| `src/store/rotationSignalStore.derived.ts` | `sectorStatsMemo` | 提取 `updateStrengthLevel` 优先级函�?|
| `src/store/signalStore.ts` | `refresh` | 提取 `generateSignalForStock`，循环改�?`Promise.all` |

### 1.3 硬编�?URL 与类型修�?
- �?`src/store/collectionWizardStore.ts` �?`MOCK_CONFIGS` �?5 �?`https://api.example.com/...` 硬编�?URL 提取�?`src/config/dataSourceUrls.ts` �?`MOCK_WIZARD_API_BASE_URL` 常量�?- 修复 `src/pages/trading/TradingFlowPage.tsx` �?`direction` 类型推导导致�?`tsc:prod` 错误�?- 清理 `src/services/system/migration/storeMigrators.ts` 未使用的类型导入�?- 颜色硬编码：0 违规（仅 29 条静默回退 Warning，不影响退出码）�?
---

## 二、质量指标变�?
| 指标 | 初始基线 | 07-10 进度 | 本次 07-11 进度 | 累计变化 |
|------|----------|------------|-----------------|----------|
| 真实深层嵌套（≥4 层） | 66 | **43** | **7** | -89.4% �?|
| 长链式条件（�? 分支�?| 32 | **0** | **0** | -100% �?|
| 重复条件判断 | 194 | **30** | **0** | -100% �?|
| 颜色硬编�?| 6 | 0 | 0 | 0 违规 �?|
| 硬编�?URL | �?| 0 | 0 | 0 违规 �?|

> 验收目标：真实深层嵌套下�?�?0%（已大幅达成 89.4%），�? 分支链式条件减少 �?0%（已达成 100%）�?
---

## 三、门禁回归状�?
| 门禁 | 状�?| 说明 |
|------|------|------|
| `tsc:prod` | �?通过 | 无类型错�?|
| `audit:layers` | �?通过 | 0 违规 / 0 警告 |
| `audit:hardcode` | �?通过 | 0 Critical�?9 Warning（静默回退�?|
| `audit:routes` | �?通过 | 2 条孤儿路由（`/command/showcase`、`/command/health`），非新�?|
| `audit:docs` | �?通过 | 0 违规 |
| `audit:deadcode` | �?通过 | 0 违规，若干条件返�?null 提示 |
| `audit:token` | �?通过 | 无违�?|
| `audit:tests` | �?通过 | 所有测试文件通过审计 |
| `audit:reserved-stores` | �?通过 | 无违�?|
| `audit:tokens` | �?通过 | 颜色/令牌 0 违规 |
| `audit:mcp` | �?通过 | 0 违规；`HealthDashboardPage.tsx` 已改为通过 `mcpBridge` 调用 |
| `complexity-scan` | �?通过 | 当前 7 嵌套 / 0 长链 / 0 重复 �?基线 7/0/0 |
| `npm run test -- --run` | �?已通过 | 29 个历史失败测试文件已修复；`test:clean` 后台最终确�?**317 files / 4610 tests passed / 15 skipped / exit 0** |

---

## 1.4 2026-07-10 重复 `if` 条件清零（P2 低优项收尾）

本轮�?`complexity-scan` 报告的重�?`if` 条件�?**26 项降�?0 �?*，并同步更新 `.complexity-baseline.json` �?`{ deeplyNestedBlocks: 7, longElseIfChains: 0, duplicateIfConditions: 0 }`。主要收敛点如下�?
| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/core/databridge.ts` | `forward` | 提取 `routeToAction` 私有方法，统一策略/查询/事件/管理/DB 路由分支 |
| `src/core/databridgeHandlers.ts` | `handle` | 合并 `db.put` 与两段日志到单一 `if/else` �?|
| `src/mcp/core/mcpAclMonitor.ts` | `getStats` | �?caller �?server 统计合并到单循环 |
| `src/mcp/core/transport.ts` | `sendRequest` | 提取断言函数 `assertNameParam` |
| `src/mcp/register.ts` | `syncWithConfig` | 重排逻辑，先 `!entry.enabled` 跳过，再�?`!isRegistered` 注册 |
| `src/services/backtest/BacktestEngine.ts` | `run` | 提取 `_processSellEvents` / `_processBuyEvents` 私有方法 |
| `src/services/backtest/backtestEventLoader.ts` | `mergeBacktestEvents` | 合并 `[...signals, ...orders]` 单循�?|
| `src/services/data-collector/dataSourceOrchestrator.ts` | `getBatchQuotes` | 提取 `tryBatchSource` 辅助函数 |
| `src/services/feedbackService.ts` | `attemptOperation` | 提取 `handleFailure` 统一失败/重试处理 |
| `src/services/llm/llmClient.ts` | `chat` | 使用 `finally` 统一清理定时�?|
| `src/services/resilience.ts` | `withResilience` | 提取 `applyFallback` 辅助函数 |
| `src/services/scoring/v6-engine/calculators/l3/helpers.ts` | `scoreCompetition` | 提取 `scoreGrowthByTrend(growth, trend)` |
| `src/services/scoring/v6-engine/calculators/l7_l8.ts` | `diagnoseLifeStage` | 嵌套 `isLossMaking` 改为三元表达�?|
| `src/services/scoring/v6-engine/engine.ts` | `calculateLayer` | 提取 `recordAudit` 私有方法 |
| `src/services/scoring/v6-engine/types.ts` | `quotesToQuoteData` | 提取 `safeReturn(past, latestClose)` |
| `src/services/trading/tradeReviewAI.profileGenerator.ts` | `generateRiskProfile` | 合并 `hasHeavyGambling` 双分�?|
| `src/store/marketDataStore.ts` | `handleCollectionResult` | 提取 `updateDataSourceByKey` / `updateLoadingMapByInstanceId` |
| `src/store/stockAnalysisStore.ts` | `<async>` | 反转 `signal?.aborted` 条件，消除重复守�?|
| `src/cockpit/providers/MarketDataProvider.tsx` | `<callback>` | 提取 `updateInstanceStatus` 辅助函数 |
| `src/components/organisms/output/ReviewWizard.tsx` | `<async IIFE>` | 提取 `setIfActive` 辅助函数 |
| `src/components/organisms/system/SystemArchitectureDiagram.tsx` | `<effect>` | 提取 `updateIfMounted` 辅助函数 |
| `src/pages/output/ResearchReportPage.tsx` | `<async>` | 收集 error 与结果，�?`finally` 中统一判断 `signal?.aborted` |
| `src/pages/trading/HoldingsPage.tsx` | `<async>` | 收集 error 与响应码，在 `finally` 中统一判断 `!isMountedRef.current` |

> 复杂度门禁：`complexity-scan` 当前 7 嵌套 / 0 长链 / 0 重复 �?基线 7/0/0，通过�?
---

## 四、MCP direct-service-import 收尾

- **当前状�?*：`audit:mcp` 已归零。`HealthDashboardPage.tsx` 改为通过 `mcpBridge.callTool('system', 'fetch_health_report', {}, { caller: 'ui', callerId: 'HealthDashboardPage' })` 调用，类型从 `@/types/modules/health.types` 引入，不再直接依�?`services/system/healthDashboardService`�?- **system server �?*：`fetch_health_report` 工具已注册，返回 `public/health-report.json` 内容�?- **后续注意**：新�?UI 页调用服务时，优先通过 `mcpBridge` / `MCPClient` 而非直接 import services，避免重新引�?MCP 违规�?
---

## 五、剩余未处理�?
### 5.1 P1 中优项剩余（7 项深层嵌套）

以下文件仍存在于 `complexity-scan` 报告中，均为 core/lib 基础设施或难以再扁平化的控制流：

- `src/core/databridgeHandlers.ts` / `deleteScannedRecords`（循环内 `if (!rec.id) continue`�?- `src/core/dataflow/dataflowEngine.ts`（SSE 消息解析 try/catch�?- `src/data/db-schema.ts`（迁�?backfill `group` 字段�?- `src/services/data-collector/TaskScheduler.ts`（错误监听器 try/catch�?- `src/services/resilience.ts`（重试循�?break 判断�?
### 5.2 重复 if 条件剩余

**0 �?*。本�?P2 低优项已全部收敛�?
---

## 六、建议下一�?
1. **全量测试已最终确�?*：后�?`npm run test:clean -- --run` 已完成，结果 **317 test files passed / 4610 tests passed / 15 skipped / Duration 1011.16s / exit 0**。日志见 `test-clean-output.log`�?2. **保持门禁**：后续新增代码继续通过 `tsc:prod` + `npm run audit` + `complexity-scan` + `test:clean` 回归�?
---

## 七、下一步建议执行（2026-07-12�?
> 对应 `./design/optimization-summary-report.md` 第七章「下一步建议」四项，本次全部落地�?
### 7.1 按优先级推进优化计划（P0 �?P1�?
- **P0 核心层复�?*：`src/mcp/core/server.ts`、`src/mcp/core/client.ts` 经此前轮次已抽取 `checkResourcePermission`/`resolveResource`/`findResourceMatch` 辅助函数，本次复核确�?0 深层嵌套�?- **P0/P1 深层嵌套清零**：对剩余 7 处深层嵌套（�? 层）全部抽取辅助函数扁平化：
  - `src/core/databridgeHandlers.ts`：`deleteIndexedRecords`/`deleteScannedRecords` �?抽取 `deleteBySymbolIndex`/`deleteBySymbolScan`（嵌�?4→≤3）�?  - `src/core/dataflow/dataflowEngine.ts`：`connect` �?SSE 消息解析 �?抽取 `_handleSseMessage`（消�?2 �?depth=4）�?  - `src/data/db-schema.ts`：`createSchema` �?group 字段 backfill 游标 �?抽取模块�?`backfillGroupField`（消�?depth=4）�?  - `src/services/resilience.ts`：`withRetry` 重试循环 try/catch �?抽取 `safeCall`（嵌�?4→≤2）�?  - `src/services/data-collector/TaskScheduler.ts`：错误监听器广播 �?抽取 `notifyErrorListeners`（消�?depth=4）�?- **结果**：`complexity-scan` 深层嵌套 **7 �?0**，长链条�?0、重复条�?0；基�?`.complexity-baseline.json` 已刷新为�?0�?
### 7.2 颜色硬编码收尾（基线刷新�?
- 复核 `eslint --config eslint.colors.config.js`（lint:colors）全局 **0 违规**；`audit:hardcode` �?32 条「静默回退」Warning（非颜色硬编码）�? Critical�?- 原清�?`docs/reports/hardcoded-colors-inventory.json` 记录�?6 处（FundFlowWidget/InputDashboard/MarketIndicesWidget/PortfolioOverviewWidget）经历史轮次已迁移完毕，本次将清单刷新为 `totalViolations: 0`、remediationPlan �?`completed`、`lastUpdated: 2026-07-12`，并补充 `baseline` 字段说明 lint:colors �?audit:hardcode 的真实状态�?
### 7.3 性能监控（关键路径耗时日志�?
新增性能监控基础设施，建立真实性能数据�?- `src/lib/perf.ts`：`measureAsync` / `measureSync` / `recordPerf` / `getPerfStats`（count/avg/p50/p95/max 聚合�? `clearPerf`，标签常�?`PERF.DATA_FETCH_REQUEST`、`PERF.SCORING_CALCULATE_ALL`�?- `src/hooks/usePerfTrace.ts`：组件渲染耗时 Hook（`render:<Name>` 标签）�?- 埋点三关键路径：
  - 数据获取：`src/services/fetcher/fetcherClient.ts`（标�?`data-fetch:request`）�?  - 评分计算：`src/services/scoring/v6-engine/engine.ts`（标�?`scoring:calculateAll`）�?  - 图表渲染：`src/components/chart/{LineChart,AreaChart,BarChart,ScoreRadar}.tsx` 接入 `usePerfTrace`（标�?`render:LineChart` 等）�?- 所�?`[PERF]` 日志�?`getLogger()` 输出，运行时可经 `getPerfStats()` 实时聚合热点�?
### 7.4 回归机制（每次优化后无新增违规）

- 新增 npm script `optimize:verify`：`tsc:prod && complexity-scan && audit && test:clean`（覆�?10 �?audit 门禁 + 类型 + 复杂�?+ 测试子集）�?- 同步�?`perf` 加入 `scripts/audit-layer-calls.ts` �?`lib` 基础设施白名单与 `AGENTS.md §一`，使性能工具可被 `services`/`core` 合法依赖（与 `logger` 同级）�?- 本轮门禁回归：`tsc:prod` ✅、`audit:layers` 0、`audit:atomic` 0、`audit:tokens` 0、`audit:hardcode` 0 Critical、`complexity-scan` 0/0/0、`lint:colors` 0�?*`test:clean` 最终确认：317 files / 4610 tests passed / 15 skipped / exit 0**�?
---

## 八、`test:clean` 全量最终确�?
后台命令 `npm run test:clean -- --run > test-clean-output.log 2>&1` 已完成：

- **Test Files**�?17 passed (317)
- **Tests**�?610 passed | 15 skipped (4625)
- **Duration**�?011.16s（约 16m 51s�?- **Exit Code**�?

全部门禁（类�?审计/复杂�?颜色/测试子集）均已绿，本轮优化无新增回归�?
---

*附：原始嵌套评审数据已更新至 `nested-code-review-report.json`；复杂度基线�?`.complexity-baseline.json`�?

---

## 九、优化继续（2026-07-12 续）：计划失准核�?+ 真实债务清理

> 用户指令「按任务继续优化」。本轮先�?`optimization-plan.md`�?85 项）�?*当前代码实测核对**，发现计划快照严重过时，遂以真实债务为准推进�?
### 9.1 关键发现：计划已失准�?85 �?95 真实项）

- 计划生成�?**2026-07-10 08:47**，但两个旗舰项在 **7/11** 已被重构�?  - `rotationCalculator.calculateResonance`（计�?#14 �?7 分支链）�?实际已改�?`tiers` 数组 + `.find()` 查表�?*无任何链**�?  - `AnalysisApp.tsx`（计�?#13 �?12 分支链）�?实际 `matchAnalysisRoute` �?2 分支 `if/else-if`�?*无长�?*�?- 项目权威门禁 `npm run complexity-scan` 报告 **0/0/0**，但因其口径过保守（深层嵌套强制要求含循�?`loopDepth>=1`、长链阈�?`>=6`、重复条件要求同函数逐字�?*漏报**真实债务�?- 为此新建独立实测工具 `scripts/quality/measure-complexity-now.ts`（口径对齐计划：嵌套深度�?、链�?、同函数逐字重复），扫描 **707 文件**，得真实债务 **95 �?*：深层嵌�?65、重复条�?29、长�?1�?
### 9.2 真实基线固化

- 实测结果固化�?`complexity-baseline-current.json`�?3 项，�?9.3 修复后），作为后续「债务只降不升」对照锚点�?- 说明：项�?canonical `.complexity-baseline.json`�?/0/0）未动；其阈值偏保守是治理层面的独立议题，本轮不改其策略�?
### 9.3 本轮已修复的真实项（2 项）

| 文件 | 函数 | 问题 | 修复方式 |
|------|------|------|----------|
| `src/services/scoring/valuePitAnalyzer.ts` | `analyze` | 唯一真实长链�? 分支 `if-else-if` �?`action`�?| 提取 `resolveAction()` 早返回守卫，行为等价 |
| `src/core/databridge.ts` | `extractSymbolFromPayload` | D4（数组项 symbol 判断�?| 卫语句（早返回）拍平至深�?2，行为不�?|

- 修复后实测：长链 **1�?**、深度嵌�?**65�?4**，合�?**95�?3**�?
### 9.4 重要风险发现：重复条件多不可安全提取

- 计划与实测均列出大量「重复条件」项�?9 处）。逐条甄别后发现：多数重复�?*状态相关判�?*，提取为函数入口局部变量会**改变并发/时序语义**�?- 例：`src/services/resilience.ts` �?`state === 'half-open'` �?`Promise.then` 的两个回调各出现一次——该状态在异步执行期可能被并发修改，必须在回调内即时求值，不可提前提取�?- 结论：重复条件项**不盲目批量提�?*，仅对纯函数式、无副作用、无状态依赖的判定做提取。本轮未做此类提取（避免引入回归）�?
### 9.5 既存门禁阻断项修�?
- `tsc:prod` �?`src/store/marketDataStore.ts` 类型比较无重叠（`key: MarketDataSourceKey | undefined` �?`''` 无重叠）。该文件在本轮优化前即被修改未提交，�?*既存问题、非本次引入**�?- `key !== ''` 为死判断（`key` 类型本就排除 `''`），修复�?`key ?? 'unknown'`，行为等价，解除 `tsc:prod` 阻断�?
### 9.6 回归门禁（全绿）

| 门禁 | 结果 |
|------|------|
| `tsc:prod` | �?exit 0 |
| `audit:layers` | �?0 违规 / 0 警告�?68 文件�?|
| `audit:atomic` | �?0 违规�?33 文件�?|
| `lint:colors` | �?0 违规 |
| 定向单测 | �?49 passed（valuePitAnalyzer ×2 + databridge�?|

### 9.7 剩余真实债务与建�?
- 真实剩余�?*深度嵌套 64**（多�?D4，最低严重度档，结构来自 try/switch/case/if）�?*重复条件 29**（多数不可安全提取）�?*长链 0**�?- 建议下步�?  1. �?`complexity-baseline-current.json` 为锚，逐文件安全提�?D4（优先核�?基础设施文件，如 `databridge.query`、`localStorageManager` 三处）；
  2. 重复条件项维持「逐条甄别、仅安全者提取」原则；
  3. 是否收紧 canonical `complexity-scan` 阈值（使其反映真实债务）作为独立治理议题待你裁决�?