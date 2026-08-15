---
doc_id: V9-DOC-EXP-947
title: optimization-plan
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# 代码质量优化处理计划

> 基于 `nested-code-review-report.json` 的静态评审结果整理
> 生成时间：2026/7/10 08:47:42

## 一、优化总览

| 优先级 | 条目数 | 处理建议 |
|--------|--------|----------|
| P0-高优 | 9 | 深层嵌套、链式条件、重复条件 |
| P1-中优 | 42 | 深层嵌套、链式条件、重复条件 |
| P2-低优 | 134 | 链式条件、重复条件、深层嵌套 |

## 二、按优先级排序的优化项

每条记录包含：位置、问题类型、影响分层、风险点、建议方案。

### P0-高优

| 序号 | 文件 | 方法 | 函数行 | 问题 | 严重度指标 | 建议方案 |
|------|------|------|--------|------|------------|----------|
| 1 | src/data/db-migrations.ts | runMigrations | 49 | 真实嵌套深度 6，共 4 处 | 分层：core / 分：58 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 2 | src/mcp/core/server.ts | readResource | 217 | 真实嵌套深度 5，共 3 处 | 分层：core / 分：55 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 3 | src/core/databridge.ts | forward | 330 | 真实嵌套深度 4，共 1 处 | 分层：core / 分：52 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 4 | src/core/databridgeHandlers.ts | handle | 198 | 真实嵌套深度 4，共 2 处 | 分层：core / 分：52 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 5 | src/data/sectorDefinitions.ts | matchStocksToSectors | 514 | 真实嵌套深度 4，共 2 处 | 分层：core / 分：52 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 6 | src/mcp/core/client.ts | readResource | 133 | 真实嵌套深度 4，共 1 处 | 分层：core / 分：52 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 7 | src/mcp/core/notification.ts | emit | 49 | 真实嵌套深度 4，共 1 处 | 分层：core / 分：52 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 8 | src/core/entityValidators.ts | validateOrder | 46 | if-else-if 链最长 4 分支，共 2 处 | 分层：core / 分：48 | Replace chain with switch statement or Map<condition, handler> lookup |
| 9 | src/services/llm/llmClient.ts | - | - | 重复条件 9 组 | 分层：service / 分：45 | Extract repeated conditions into boolean variables or predicate functions |

### P1-中优

| 序号 | 文件 | 方法 | 函数行 | 问题 | 严重度指标 | 建议方案 |
|------|------|------|--------|------|------------|----------|
| 10 | src/services/llm/llmClient.ts | streamingChat | 241 | 真实嵌套深度 6，共 10 处 | 分层：service / 分：38 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 11 | src/services/hybrid-proofread/index.ts | runFullProofread | 11 | 真实嵌套深度 5，共 2 处 | 分层：service / 分：35 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 12 | src/services/useCase/generateTradeReview.useCase.ts | generateTradeReviewAsyncUseCase | 77 | 真实嵌套深度 5，共 3 处 | 分层：service / 分：35 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 13 | src/apps/analysis/AnalysisApp.tsx | <arrow> | 52 | if-else-if 链最长 12 分支，共 1 处 | 分层：ui / 分：34 | Replace chain with switch statement or Map<condition, handler> lookup |
| 14 | src/services/analysis/rotation/rotationCalculator.ts | calculateResonance | 71 | if-else-if 链最长 7 分支，共 1 处 | 分层：service / 分：34 | Replace chain with switch statement or Map<condition, handler> lookup |
| 15 | src/services/analysis/scoreTrendService.ts | aggregateScoresByPeriod | 81 | 真实嵌套深度 4，共 3 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 16 | src/services/backtest/BacktestEngine.ts | run | 103 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 17 | src/services/data-collector/collectors/BaseCollector.ts | collectWithRetry | 39 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 18 | src/services/data-collector/mockDataCollection.ts | mockCollectorFetchWithRetry | 790 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 19 | src/services/feedbackService.ts | wrapOperation | 308 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 20 | src/services/fetcher/fetcherClient.ts | request | 53 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 21 | src/services/fetcher/fetcherInterceptor.ts | interceptedFetch | 67 | 真实嵌套深度 4，共 5 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 22 | src/services/fetcher/orchestrator/resilienceChain.ts | fetchQuote | 48 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 23 | src/services/fetcher/orchestrator/resilienceChain.ts | fetchKline | 110 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 24 | src/services/input/batchImportParsers.ts | parseCsvLine | 169 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 25 | src/services/input/batchImportParsers.ts | parseJsonFile | 323 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 26 | src/services/llm/llmClient.ts | chat | 123 | 真实嵌套深度 4，共 2 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 27 | src/services/news/stockLinker.ts | matchText | 122 | 真实嵌套深度 4，共 4 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 28 | src/services/resilience.ts | withRetry | 52 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 29 | src/services/scoring/rotationSignalDetector.ts | detectBySector | 248 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 30 | src/services/system/localDocService.ts | scanDirectory | 152 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 31 | src/services/trade/holdingsService.ts | requestWithRetry | 52 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 32 | src/services/trading/tradeErrorDetectors.ts | detectAgainstTrendAdding | 138 | 真实嵌套深度 4，共 1 处 | 分层：service / 分：32 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 33 | src/services/scoring/hotSectorDimensions.ts | calculateValuationRisk | 277 | if-else-if 链最长 6 分支，共 1 处 | 分层：service / 分：32 | Replace chain with switch statement or Map<condition, handler> lookup |
| 34 | src/services/scoring/v6-engine/calculators/l4_l5_l6.ts | scoreScenario | 74 | if-else-if 链最长 6 分支，共 1 处 | 分层：service / 分：32 | Replace chain with switch statement or Map<condition, handler> lookup |
| 35 | src/services/scoring/v6-engine/calculators/l4_l5_l6.ts | evaluateHypeCycle | 317 | if-else-if 链最长 6 分支，共 1 处 | 分层：service / 分：32 | Replace chain with switch statement or Map<condition, handler> lookup |
| 36 | src/services/scoring/v6-engine/calculators/l3/helpers.ts | scoreMoat | 58 | if-else-if 链最长 5 分支，共 1 处 | 分层：service / 分：30 | Replace chain with switch statement or Map<condition, handler> lookup |
| 37 | src/services/input/batchImportParsers.ts | parseBulkInput | 88 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 38 | src/services/scoring/hotSectorDimensions.ts | calculateSentiment | 177 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 39 | src/services/scoring/v6-engine/calculators/l0_l1_l2.ts | scoreLongTermTrend | 263 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 40 | src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts | scoreFinancialDimensions | 27 | if-else-if 链最长 4 分支，共 5 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 41 | src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts | evaluateIPC | 190 | if-else-if 链最长 4 分支，共 3 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 42 | src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts | scoreValuation | 24 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 43 | src/services/scoring/v6-engine/calculators/l4_l5_l6.ts | evaluateTMMatrix | 186 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 44 | src/services/scoring/valuePitAnalyzer.ts | calculateValuationMargin | 156 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 45 | src/services/scoring/valuePitAnalyzer.ts | calculateRotationPosition | 249 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 46 | src/services/scoring/valuePitAnalyzer.ts | calculateLiquidity | 284 | if-else-if 链最长 4 分支，共 1 处 | 分层：service / 分：28 | Replace chain with switch statement or Map<condition, handler> lookup |
| 47 | src/store/executionStore.ts | <arrow> | 363 | 真实嵌套深度 4，共 1 处 | 分层：store / 分：27 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 48 | src/store/helpers/withOptimisticUpdate.ts | withOptimisticUpdate | 49 | 真实嵌套深度 4，共 1 处 | 分层：store / 分：27 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 49 | src/store/rotationSignalStore.derived.ts | <arrow> | 228 | 真实嵌套深度 4，共 1 处 | 分层：store / 分：27 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 50 | src/store/signalStore.ts | <arrow> | 56 | 真实嵌套深度 4，共 2 处 | 分层：store / 分：27 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 51 | src/services/data-collector/dataSourceOrchestrator.ts | - | - | 重复条件 5 组 | 分层：service / 分：25 | Extract repeated conditions into boolean variables or predicate functions |

### P2-低优

| 序号 | 文件 | 方法 | 函数行 | 问题 | 严重度指标 | 建议方案 |
|------|------|------|--------|------|------------|----------|
| 52 | src/apps/input/InputApp.tsx | <arrow> | 47 | if-else-if 链最长 7 分支，共 1 处 | 分层：ui / 分：24 | Replace chain with switch statement or Map<condition, handler> lookup |
| 53 | src/apps/input/InputApp.tsx | InputApp | 41 | if-else-if 链最长 7 分支，共 1 处 | 分层：ui / 分：24 | Replace chain with switch statement or Map<condition, handler> lookup |
| 54 | src/apps/trading/TradingApp.tsx | TradingApp | 36 | if-else-if 链最长 7 分支，共 1 处 | 分层：ui / 分：24 | Replace chain with switch statement or Map<condition, handler> lookup |
| 55 | src/store/analysisStore.derived.ts | <arrow> | 105 | if-else-if 链最长 4 分支，共 1 处 | 分层：store / 分：23 | Replace chain with switch statement or Map<condition, handler> lookup |
| 56 | src/store/rotationSignalStore.derived.ts | <arrow> | 143 | if-else-if 链最长 4 分支，共 1 处 | 分层：store / 分：23 | Replace chain with switch statement or Map<condition, handler> lookup |
| 57 | src/apps/output/OutputApp.tsx | <arrow> | 181 | if-else-if 链最长 6 分支，共 1 处 | 分层：ui / 分：22 | Replace chain with switch statement or Map<condition, handler> lookup |
| 58 | src/apps/output/OutputApp.tsx | OutputApp | 175 | if-else-if 链最长 6 分支，共 1 处 | 分层：ui / 分：22 | Replace chain with switch statement or Map<condition, handler> lookup |
| 59 | src/apps/trading/TradingApp.tsx | <arrow> | 60 | if-else-if 链最长 6 分支，共 1 处 | 分层：ui / 分：22 | Replace chain with switch statement or Map<condition, handler> lookup |
| 60 | src/core/dataflow/dataflowEngine.ts | - | - | 重复条件 2 组 | 分层：core / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 61 | src/core/entityValidators.ts | - | - | 重复条件 2 组 | 分层：core / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 62 | src/core/memoryCache.ts | - | - | 重复条件 2 组 | 分层：core / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 63 | src/data/dataLayerStockStores.ts | - | - | 重复条件 2 组 | 分层：core / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 64 | src/data/db.ts | - | - | 重复条件 2 组 | 分层：core / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 65 | src/mcp/core/client.ts | - | - | 重复条件 2 组 | 分层：core / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 66 | src/services/fetcher/directDataAPI.ts | - | - | 重复条件 4 组 | 分层：service / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 67 | src/store/signalQualityStore.derived.ts | - | - | 重复条件 4 组 | 分层：store / 分：20 | Extract repeated conditions into boolean variables or predicate functions |
| 68 | src/core/databridge.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 69 | src/core/databridgeHandlers.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 70 | src/core/databridgeStrategyRouter.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 71 | src/core/pipelineScheduler.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 72 | src/core/ThemeProvider.tsx | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 73 | src/core/widgetEventBus.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 74 | src/data/dataLayerHelpers.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 75 | src/data/dataLayerTradingStores.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 76 | src/data/db-migrations.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 77 | src/data/repository.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 78 | src/data/sectorDefinitions.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 79 | src/mcp/core/mcpAclMonitor.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 80 | src/mcp/core/server.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 81 | src/mcp/core/transport.ts | - | - | 重复条件 1 组 | 分层：core / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 82 | src/services/analysis/scoreDocService.ts | - | - | 重复条件 3 组 | 分层：service / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 83 | src/services/data-collector/directDataAPI.ts | - | - | 重复条件 3 组 | 分层：service / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 84 | src/services/fetcher/fetcherService.ts | - | - | 重复条件 3 组 | 分层：service / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 85 | src/services/rbac/rbacManagementService.ts | - | - | 重复条件 3 组 | 分层：service / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 86 | src/services/stock-analysis/mockStockAnalysisProvider.ts | - | - | 重复条件 3 组 | 分层：service / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 87 | src/store/dualStrategyStore.ts | - | - | 重复条件 3 组 | 分层：store / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 88 | src/store/sevenDimConfigStore.ts | - | - | 重复条件 3 组 | 分层：store / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 89 | src/store/signalStore.ts | - | - | 重复条件 3 组 | 分层：store / 分：15 | Extract repeated conditions into boolean variables or predicate functions |
| 90 | src/lib/localStorageManager.ts | byteLength | 96 | 真实嵌套深度 4，共 1 处 | 分层：other / 分：12 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 91 | src/lib/localStorageManager.ts | getNamespaceInfo | 414 | 真实嵌套深度 4，共 3 处 | 分层：other / 分：12 | Extract inner logic into helper functions or apply guard clauses/early returns to reduce nesting |
| 92 | src/cockpit/widgets/SignalMonitorWidget.tsx | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 93 | src/components/collection/CollectionReportPanel.tsx | - | - | 重复条件 2 组 | 分层：ui / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 94 | src/components/ui/DataState.tsx | - | - | 重复条件 2 组 | 分层：ui / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 95 | src/components/ui/Popover.tsx | - | - | 重复条件 2 组 | 分层：ui / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 96 | src/constants/theme/theme.tokens.shades.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 97 | src/constants/trade.constants.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 98 | src/hooks/useFreshData.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 99 | src/hooks/useStockPoolBoard.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 100 | src/lib/localStorageManager.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 101 | src/mcp/register.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 102 | src/pages/trading/HoldingsPage.tsx | - | - | 重复条件 2 组 | 分层：ui / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 103 | src/services/backtest/BacktestEngine.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 104 | src/services/data-collector/MarketDataAdapter.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 105 | src/services/fetcher/fetcherScheduler.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 106 | src/services/hybrid-proofread/reportGenerator.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 107 | src/services/input/batchImportExecutor.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 108 | src/services/llm/llmGateway.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 109 | src/services/portfolio/portfolioService.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 110 | src/services/resilience.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 111 | src/services/scoring/v6-engine/calculators/l3/helpers.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 112 | src/services/trading/tradingService.ts | - | - | 重复条件 2 组 | 分层：service / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 113 | src/store/analysisStore.derived.ts | - | - | 重复条件 2 组 | 分层：store / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 114 | src/store/disciplineStore.ts | - | - | 重复条件 2 组 | 分层：store / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 115 | src/store/executionStoreSubscriptions.ts | - | - | 重复条件 2 组 | 分层：store / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 116 | src/store/signalAdviceStore.ts | - | - | 重复条件 2 组 | 分层：store / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 117 | src/store/tradingStore.ts | - | - | 重复条件 2 组 | 分层：store / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 118 | src/utils/a11y.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 119 | src/utils/precision.ts | - | - | 重复条件 2 组 | 分层：other / 分：10 | Extract repeated conditions into boolean variables or predicate functions |
| 120 | src/agents/agentHealthMonitor.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 121 | src/apps/input/BulkImportPanel.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 122 | src/apps/trading/components/PhaseStepper.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 123 | src/cockpit/core/widgetRegistry.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 124 | src/cockpit/providers/MarketDataProvider.tsx | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 125 | src/cockpit/widgets/SignalQualityDashboardWidget.tsx | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 126 | src/components/analysis/score/ScoreFactorWaterfall.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 127 | src/components/analysis/sector/SectorRotationHeatmap.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 128 | src/components/input/StockSearch.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 129 | src/components/input/TraceReplayPanel.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 130 | src/components/output/reviewArtifact.ts | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 131 | src/components/pool/usePoolDataFromStore.ts | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 132 | src/components/system/LogStreamPanel.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 133 | src/components/system/migration/useMcpMigration.ts | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 134 | src/config/dataSourceRegistry.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 135 | src/databridge/index.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 136 | src/hooks/cabin/useIndustryScorePage.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 137 | src/hooks/useConfirmDialog.tsx | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 138 | src/lib/eventBus.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 139 | src/lib/safeCoerce.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 140 | src/pages/analysis/StockAnalysisPage.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 141 | src/pages/output/ResearchReportPage.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 142 | src/pages/trading/components/TradeModal.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 143 | src/pages/trading/TradingFlowPage.tsx | - | - | 重复条件 1 组 | 分层：ui / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 144 | src/services/analysis/screeningEngine.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 145 | src/services/backtest/backtestEventLoader.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 146 | src/services/data-collector/collectors/RestCollector.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 147 | src/services/data-collector/missingReportDetector.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 148 | src/services/execution/executionPlanService.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 149 | src/services/feedbackService.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 150 | src/services/fetcher/fetcherInterceptor.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 151 | src/services/fetcher/orchestrator/adapters/marketDataFetcher.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 152 | src/services/fetcher/strategyDataAdapter.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 153 | src/services/input/batchImportParsers.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 154 | src/services/news/sentimentTrendEngine.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 155 | src/services/pwa/registerServiceWorker.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 156 | src/services/scoring/v6-engine/calculators/l0_l1_l2.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 157 | src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 158 | src/services/scoring/v6-engine/calculators/l7_l8.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 159 | src/services/scoring/v6-engine/engine.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 160 | src/services/scoring/v6-engine/types.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 161 | src/services/stockpool/stockpoolService.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 162 | src/services/system/migration/migrationTransformers.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 163 | src/services/trade/holdingsService.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 164 | src/services/trading/signalGenerator.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 165 | src/services/trading/tradeErrorDetectors.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 166 | src/services/useCase/fetcherOrchestrator.useCase.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 167 | src/services/useCase/getUnifiedStockView.useCase.ts | - | - | 重复条件 1 组 | 分层：service / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 168 | src/store/analysisStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 169 | src/store/backtestStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 170 | src/store/chatStore.derived.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 171 | src/store/customAgentStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 172 | src/store/intelligentScoreStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 173 | src/store/localKnowledgeStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 174 | src/store/marketDataStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 175 | src/store/orderStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 176 | src/store/poolStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 177 | src/store/positionStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 178 | src/store/riskStore.derived.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 179 | src/store/scoreDocStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 180 | src/store/stockAnalysisStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 181 | src/store/strategySnapshotStore.ts | - | - | 重复条件 1 组 | 分层：store / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 182 | src/types/guards.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 183 | src/utils/dataValidation.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 184 | src/utils/timeUtils.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |
| 185 | src/utils/xssSanitizer.ts | - | - | 重复条件 1 组 | 分层：other / 分：5 | Extract repeated conditions into boolean variables or predicate functions |

## 三、分模块处理策略

### 3.1 核心层（core / data / mcp）

- **原则**：核心层改动风险最高，先补单元测试再重构。
- **重点文件**：`src/core/databridge.ts`、`src/core/databridgeHandlers.ts`、`src/data/db-migrations.ts`、`src/mcp/core/server.ts`、`src/mcp/core/client.ts`。
- **策略**：将嵌套的 try/catch 和权限检查抽取为独立函数；保持公共接口不变。

### 3.2 服务层（services）

- **原则**：按子域拆分，避免一次改动多个业务域。
- **重点文件**：`src/services/fetcher/fetcherInterceptor.ts`、`src/services/llm/llmClient.ts`、`src/services/scoring/v6-engine/calculators/*`。
- **策略**：将链式条件改为配置表或策略函数；循环内守卫再前置。

### 3.3 状态层（store）与 UI 层（apps/components/pages）

- **原则**：低风险、可快速推进。
- **策略**：提取重复条件为派生状态或局部变量；路由分发链改为对象映射。

## 四、推荐执行顺序

1. **第 1 周**：P0 高优核心层 + 服务层高优项，补充测试。
2. **第 2 周**：P1 中优服务层 + 状态层，统一谓词函数。
3. **第 3 周**：P2 低优 UI 层，清理重复条件。
4. **第 4 周**：回归跑 `npm run audit`、`tsc:prod`、测试套件，确保无新增跨层违规。

## 五、验收标准

- 重新运行嵌套评审脚本后，真实深层嵌套数量下降 ≥50%。
- 链式条件分支数 ≥6 的项减少 ≥60%。
- 重复条件判断数量下降 ≥40%。
- 所有改动通过 `npm run audit` 与 `tsc:prod` 质量门禁。

---

*附：原始数据与脚本见 `nested-code-review-report.json` 与 `/tmp/nest-review/nested-review-v2.cjs`。*
