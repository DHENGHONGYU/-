# 优化计划执行进度报告（P1 服务层中优项推进）

> 生成时间：2026-07-11 00:25
> 基于 `optimization-plan.md` 优先级推进，本次完成 P0 剩余项 + P1 服务层/Store 层主要优化项，并回归门禁测试。
> 
> 2026-07-10 追加：完成测试失败诊断与修复、MCP 违规收尾、门禁回归。

---

## 一、本次完成项汇总

### 1.1 第二批 P1 服务层/Store 层/UI 层中优项（新增 18 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/services/resilience.ts` | `withRetry` | 提取 `computeRetryDelay` / `handleRetryAttempt` 辅助函数 |
| `src/services/execution/executionPlanService.ts` | `updatePhase` | 提取 `applyPhaseTimestamp` 阶段时间戳函数 |
| `src/services/fetcher/orchestrator/phaseOrchestrator.ts` | `collectDimension` | 提取 `isParallelDimension` / `resolveDimensionType` / `collectStub` / `writeCollectedItem` |
| `src/services/input/batchImportParsers.ts` | `parseCsvLine` | 提取 `handleQuotedChar` 处理 CSV 引号转义 |
| `src/services/input/batchImportParsers.ts` | `parseJsonFile` | 提取 `parseJsonRow` 单条 JSON 行解析 |
| `src/services/trading/positionComputer.ts` | `buildTradePairs` | 提取 `matchSellWithBuys` FIFO 配对辅助函数；使用 `continue` 扁平化主循环 |
| `src/services/trading/tradeErrorUtils.ts` | `buildTradePairs` | 提取 `createTradePair` 辅助函数 |
| `src/services/trading/tradeReviewAI.utils.ts` | `buildTradePairs` | 提取 `createTradePair` 辅助函数 |
| `src/services/useCase/fetchSectorAnalysis.useCase.ts` | `fetchSectorAnalysisUseCase` | 提取 `loadOrCalculate` 通用加载/降级逻辑；`compareIndustryByScoredAt` 比较器 |
| `src/services/useCase/rebalancePortfolio.useCase.ts` | `<arrow>` | 提取 `updateHoldingForOrder` 持仓更新辅助函数 |
| `src/services/hybrid-proofread/localCollector.ts` | `collectFiles` / `traverse` | 提取模块级 `isPathExcluded` / `isPathIncluded` / `collectFileIfIncluded` |
| `src/services/hybrid-proofread/reportGenerator.ts` | `generateRecommendations` | 提取 `appendRecommendation` 去重辅助函数 |
| `src/utils/dataValidation.ts` | `sanitizeObject` | 提取 `sanitizeValue` 单字段脱敏函数 |
| `src/store/analysisStore.derived.ts` | `scoreLevelDistribution` | 提取 `classifyScoreLevel` 分档函数 |
| `src/store/rotationSignalStore.derived.ts` | `strengthDistribution` | 提取 `classifyStrength` 强度分类函数 |
| `src/store/chatStore.derived.ts` | `messageStatsMemo` | 使用 `ROLE_STAT_KEY` 查找表替代 if-else 链 |
| `src/apps/command/CommandApp.tsx` | `useEffect` / render | 使用 `BRANCH_INFO` 查找表 + `renderCommandContent` switch 替代链式条件 |
| `src/cockpit/widgets/StockChatWidget.tsx` | `renderInline` | 提取 `renderInlineToken` 辅助函数 |
| `src/lib/localStorageManager.ts` | `byteLength` / `getNamespaceInfo` | 提取 `utf8ByteCount` / `computeOldestNewest` |
| `src/data/queryBuilder.ts` | 新闻任务 | 提取 `collectSuccessfulNews` 辅助函数 |
| `src/services/system/localDocService.ts` | `searchLocalDocs` | 提取 `calculateMatchScore` 评分辅助函数 |
| `src/services/trade/holdingsService.ts` | `requestWithRetry` | 改为递归重试，消除循环内嵌套 |
| `src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts` | `scoreFinancialDimensions` | 提取 `scoreCashFlow` / `scoreOrders` 阈值函数 |

### 1.2 类型/测试修复

- 补充 `src/utils/dataValidation.test.ts` 缺失的 `validateConfigName` 导入。

### 1.3 2026-07-10 测试失败与 MCP 违规收尾（新增 3 项）

| 文件 | 问题 | 修复动作 |
|------|------|----------|
| `tests/__tests__/scripts/verify-all-routes.test.ts` | 测试用预期路径与 `scripts/verify-all-routes.ts` 的 `EXPECTED_PATHS` 不同步，导致 `missing-route` 误报 32 条 | 同步全部 62 条预期路径 |
| `tests/__tests__/integration/llmEnhancer.integration.test.ts` | M2 依据追溯闸上线后，mock 响应未带 `citations`，LLM 评分调整被回退 | `buildLlmEnhanceResponse` 默认补 citation；手动为代码块/动态响应用例补充 citations |
| `src/pages/command/__tests__/MCPServerDashboardPage.test.tsx` | `vi.mock('@/mcp/bridge')` 路径与实际组件导入 `@/mcp/bridge/mcpBridge` 不匹配，导致真实桥接实现被调用 | 修正 mock 路径为 `@/mcp/bridge/mcpBridge` 并复用 `mockCallTool` |
| `src/pages/command/health/HealthDashboardPage.tsx` | MCP 审计违规：直接 import `services/system/healthDashboardService` | 改为通过 `mcpBridge.callTool('system', 'fetch_health_report', {})` 调用；类型从 `@/types/modules/health.types` 引入 |

---
### 1.1 剩余 P0 核心层嵌套（3 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/mcp/core/server.ts` | `readResource` | 提取 `resolveResourceMatch` / `tryReadResource` 辅助函数，ACL 与读取逻辑扁平化 |
| `src/mcp/core/client.ts` | `readResource` | 提取 `findResourceMatch` / `checkAclAndRead` 辅助函数，减少循环内嵌套 |
| `src/data/sectorDefinitions.ts` | `matchStocksToSectors` | 抽 `matchByKeywords` / `matchByKeyStocks` 谓词函数，合并重复循环 |

### 1.2 P1 服务层中优项（已完成 24 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/services/llm/llmClient.ts` | `streamingChat` | 提取 `parseErrorMessageFromResponse` / `processStreamLines` |
| `src/services/llm/llmClient.ts` | `chat` | 复用 `parseErrorMessageFromResponse` 消除重复错误解析逻辑 |
| `src/services/fetcher/fetcherInterceptor.ts` | `interceptedFetch` | 提取 `tryOnce` / `createHttpErrorFromResponse` / `createNetworkError` / `triggerAuthCallbacks` |
| `src/services/fetcher/fetcherClient.ts` | `request` | 提取 `tryRequest` 单次尝试函数，循环体外处理错误分类 |
| `src/services/news/stockLinker.ts` | `matchText` | 拆分 `matchExactCode` / `matchExactName` / `matchFuzzyName` / `matchIndustry` 四个策略函数 |
| `src/services/scoring/rotationSignalDetector.ts` | `detectBySector` | 提取 `aggregateSectorBars` 聚合函数 |
| `src/services/system/localDocService.ts` | `scanFolder` | 提取 `processFileEntry` 文件处理函数 |
| `src/services/trade/holdingsService.ts` | `requestWithRetry` | 提取 `sleep` 辅助函数，循环体提前退出 |
| `src/services/data-collector/collectors/BaseCollector.ts` | `collectWithRetry` | 提取 `tryCollectOnce` 单次尝试函数 |
| `src/services/scoring/hotSectorDimensions.ts` | `calculateSentiment` | 排名映射改为 `RANK_TIERS` 数组查找 |
| `src/services/scoring/v6-engine/calculators/l0_l1_l2.ts` | `scoreLongTermTrend` | 趋势评分改为 `TREND_SCORES` 映射表 |
| `src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts` | `scoreValuation` | PEG/PE 分档提取为 `scorePeg` / `scorePeRelative` 函数 |
| `src/services/scoring/v6-engine/calculators/l4_l5_l6.ts` | `evaluateTMMatrix` | 行业分值与策略象限改为 `SECTOR_SCORES` / `STRATEGY_MAP` 查找；修复 `STRATEGY_MAP` 中科技行业映射，回归 v6-engine 测试 |
| `src/services/scoring/valuePitAnalyzer.ts` | `calculateValuationMargin` / `calculateRotationPosition` / `calculateLiquidity` | 分档映射改为 `*_TIERS` 数组查找 |
| `src/services/input/batchImportParsers.ts` | `parseBulkInput` | 4 种格式解析改为 `PARSERS` 数组策略 |
| `src/services/hybrid-proofread/index.ts` | `runFullProofread` | 提取 `evaluateFileForMatches` 文件评估辅助函数 |
| `src/services/useCase/generateTradeReview.useCase.ts` | `generateTradeReviewAsyncUseCase` | 提取 `generateLlmInsight` 统一 LLM 洞察/降级逻辑 |
| `src/services/analysis/scoreTrendService.ts` | `aggregateScoresByPeriod` | 提取 `getOrCreateBucket` / `addCompositeScore` / `addDimensionScores` / `bucketToPoint` |
| `src/services/backtest/BacktestEngine.ts` | `run` | 提取 `_updatePositionAfterSell` / `_updatePositionAfterBuy` 持仓更新辅助函数 |
| `src/services/data-collector/mockDataCollection.ts` | `mockCollectorFetchWithRetry` | 提取 `attemptMockCollectorFetch` 单次尝试函数 |
| `src/services/feedbackService.ts` | `wrapOperation` | 提取 `attemptOperation` 单次尝试函数，主循环扁平化 |
| `src/services/fetcher/orchestrator/resilienceChain.ts` | `fetchQuote` / `fetchKline` | 提取 `runFallbackChain` / `trySource` 通用降级链辅助函数 |
| `src/services/trading/tradeErrorDetectors.ts` | `detectAgainstTrendAdding` | 提取 `groupBuyOrdersBySymbol` / `detectAgainstTrendForSymbol` |
| `src/services/data-collector/dataSourceOrchestrator.ts` | `getQuoteWithConfig` / `getKlineWithConfig` | 提取 `resolveSourcePriority` / `createTraceId` 消除重复条件 |
| `src/store/executionStore.ts` | `executePlan` | 提取 `finalizeExecution` / `transitionToCancelledOnError` |
| `src/store/helpers/withOptimisticUpdate.ts` | `withOptimisticUpdate` | 提取 `rollbackToSnapshot` 回滚辅助函数 |
| `src/store/rotationSignalStore.derived.ts` | `sectorStatsMemo` | 提取 `updateStrengthLevel` 优先级函数 |
| `src/store/signalStore.ts` | `refresh` | 提取 `generateSignalForStock`，循环改为 `Promise.all` |

### 1.3 硬编码 URL 与类型修复

- 将 `src/store/collectionWizardStore.ts` 中 `MOCK_CONFIGS` 的 5 处 `https://api.example.com/...` 硬编码 URL 提取到 `src/config/dataSourceUrls.ts` 的 `MOCK_WIZARD_API_BASE_URL` 常量。
- 修复 `src/pages/trading/TradingFlowPage.tsx` 中 `direction` 类型推导导致的 `tsc:prod` 错误。
- 清理 `src/services/system/migration/storeMigrators.ts` 未使用的类型导入。
- 颜色硬编码：0 违规（仅 29 条静默回退 Warning，不影响退出码）。

---

## 二、质量指标变化

| 指标 | 初始基线 | 07-10 进度 | 本次 07-11 进度 | 累计变化 |
|------|----------|------------|-----------------|----------|
| 真实深层嵌套（≥4 层） | 66 | **43** | **7** | -89.4% ✅ |
| 长链式条件（≥6 分支） | 32 | **0** | **0** | -100% ✅ |
| 重复条件判断 | 194 | **30** | **26** | -86.6% ✅ |
| 颜色硬编码 | 6 | 0 | 0 | 0 违规 ✅ |
| 硬编码 URL | — | 0 | 0 | 0 违规 ✅ |

> 验收目标：真实深层嵌套下降 ≥50%（已大幅达成 89.4%），≥6 分支链式条件减少 ≥60%（已达成 100%）。

---

## 三、门禁回归状态

| 门禁 | 状态 | 说明 |
|------|------|------|
| `tsc:prod` | ✅ 通过 | 无类型错误 |
| `audit:layers` | ✅ 通过 | 0 违规 / 0 警告 |
| `audit:hardcode` | ✅ 通过 | 0 Critical，29 Warning（静默回退） |
| `audit:routes` | ✅ 通过 | 2 条孤儿路由（`/command/showcase`、`/command/health`），非新增 |
| `audit:docs` | ✅ 通过 | 0 违规 |
| `audit:deadcode` | ✅ 通过 | 0 违规，若干条件返回 null 提示 |
| `audit:token` | ✅ 通过 | 无违规 |
| `audit:tests` | ✅ 通过 | 所有测试文件通过审计 |
| `audit:reserved-stores` | ✅ 通过 | 无违规 |
| `audit:tokens` | ✅ 通过 | 颜色/令牌 0 违规 |
| `audit:mcp` | ✅ 通过 | 0 违规；`HealthDashboardPage.tsx` 已改为通过 `mcpBridge` 调用 |
| `complexity-scan` | ✅ 通过 | 当前 7 嵌套 / 0 长链 / 26 重复 ≤ 基线 104/0/39 |
| `npm run test -- --run` | ⏳ 回归中 | 已修复 3 组主要失败：`verify-all-routes`（16/16）、`llmEnhancer`（46/46）、`MCPServerDashboardPage`（17/17）；全量测试仍在运行验证 |

---

## 四、MCP direct-service-import 收尾

- **当前状态**：`audit:mcp` 已归零。`HealthDashboardPage.tsx` 改为通过 `mcpBridge.callTool('system', 'fetch_health_report', {}, { caller: 'ui', callerId: 'HealthDashboardPage' })` 调用，类型从 `@/types/modules/health.types` 引入，不再直接依赖 `services/system/healthDashboardService`。
- **system server 侧**：`fetch_health_report` 工具已注册，返回 `public/health-report.json` 内容。
- **后续注意**：新增 UI 页调用服务时，优先通过 `mcpBridge` / `MCPClient` 而非直接 import services，避免重新引入 MCP 违规。

---

## 五、剩余未处理项

### 5.1 P1 中优项剩余（7 项深层嵌套）

以下文件仍存在于 `complexity-scan` 报告中，均为 core/lib 基础设施或难以再扁平化的控制流：

- `src/core/databridgeHandlers.ts::deleteIndexedRecords` / `deleteScannedRecords`（循环内 `if (!rec.id) continue`）
- `src/core/dataflow/dataflowEngine.ts`（SSE 消息解析 try/catch）
- `src/data/db-schema.ts`（迁移 backfill `group` 字段）
- `src/services/data-collector/TaskScheduler.ts`（错误监听器 try/catch）
- `src/services/resilience.ts::withRetry`（重试循环 break 判断）

### 5.2 重复 if 条件剩余（26 项）

主要集中在 core/MCP、V6 引擎、Store/组件的条件守卫，建议作为 P2 低优项逐步收敛。

---

## 六、建议下一步

1. **确认全量测试回归**：等待当前 `npm run test -- --run` 结果；如仍有失败，按失败模块继续收敛。
2. **继续 P2 收尾**：处理剩余 26 项重复条件，进一步降低代码重复度。
3. **保持门禁**：后续新增代码继续通过 `tsc:prod` + `npm run audit` + `complexity-scan` 回归。

---

*附：原始嵌套评审数据已更新至 `nested-code-review-report.json`。*
