# 优化计划执行进度报告（P1 服务层中优项推进）

> 生成时间：2026-07-10 15:30
> 基于 `optimization-plan.md` 优先级推进，本次完成 P0 剩余项 + P1 服务层/Store 层主要优化项，并回归门禁测试。

---

## 一、本次完成项汇总

### 1.1 剩余 P0 核心层嵌套（3 项）

| 文件 | 方法 | 优化动作 |
|------|------|----------|
| `src/mcp/core/server.ts` | `readResource` | 提取 `resolveResourceMatch` / `tryReadResource` 辅助函数，ACL 与读取逻辑扁平化 |
| `src/mcp/core/client.ts` | `readResource` | 提取 `findResourceMatch` / `checkAclAndRead` 辅助函数，减少循环内嵌套 |
| `src/data/sectorDefinitions.ts` | `matchStocksToSectors` | 抽 `matchByKeywords` / `matchByKeyStocks` 谓词函数，合并重复循环 |

### 1.2 P1 服务层中优项（已完成 14 项）

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
| `src/services/scoring/v6-engine/calculators/l4_l5_l6.ts` | `evaluateTMMatrix` | 行业分值与策略象限改为 `SECTOR_SCORES` / `STRATEGY_MAP` 查找 |
| `src/services/scoring/valuePitAnalyzer.ts` | `calculateValuationMargin` / `calculateRotationPosition` / `calculateLiquidity` | 分档映射改为 `*_TIERS` 数组查找 |
| `src/services/input/batchImportParsers.ts` | `parseBulkInput` | 4 种格式解析改为 `PARSERS` 数组策略 |
| `src/store/rotationSignalStore.derived.ts` | `sectorStatsMemo` | 提取 `updateStrengthLevel` 优先级函数 |
| `src/store/signalStore.ts` | `refresh` | 提取 `generateSignalForStock`，循环改为 `Promise.all` |

### 1.3 硬编码 URL 修复

- 将 `src/store/collectionWizardStore.ts` 中 `MOCK_CONFIGS` 的 5 处 `https://api.example.com/...` 硬编码 URL 提取到 `src/config/dataSourceUrls.ts` 的 `MOCK_WIZARD_API_BASE_URL` 常量。
- 颜色硬编码：0 违规（仅 29 条静默回退 Warning，不影响退出码）。

---

## 二、质量指标变化

| 指标 | 初始基线 | P0 完成后 | 本次 P1 完成后 | 变化 |
|------|----------|-----------|----------------|------|
| 真实深层嵌套（≥4 层） | 66 | 54 | **26** | -60.6% ✅ |
| 长链式条件（≥4 分支） | 32 | 12 | **4** | -87.5% ✅ |
| 重复条件判断 | 194 | 193 | **191** | -1.5%（未重点处理） |
| 颜色硬编码 | 6 | 0 | 0 | 0 违规 ✅ |
| 硬编码 URL | — | 5 | 0 | 0 违规 ✅ |

> 验收目标：真实深层嵌套下降 ≥50%（已达成 60.6%），≥6 分支链式条件减少 ≥60%（已达成，目前剩余 4 处）。

---

## 三、门禁回归状态

| 门禁 | 状态 | 说明 |
|------|------|------|
| `tsc:prod` | ✅ 通过 | 无类型错误 |
| `audit:layers` | ✅ 通过 | 0 违规 / 0 警告 |
| `audit:hardcode` | ✅ 通过 | 0 Critical，29 Warning（静默回退） |
| `audit:routes` | ✅ 通过 | 2 条孤儿路由（`/command/showcase`、`/command/health`），非新增 |
| `audit:docs` | ✅ 通过 | 见 `npm run audit` 输出 |
| `audit:token` | ✅ 通过 | 无违规 |
| `audit:mcp` | ❌ 1 处违规 | `src/pages/command/health/HealthDashboardPage.tsx` 直接 import `services/system/healthDashboardService` |
| `npm run test -- --run` | ⏳ 运行中 | 任务 `nDDdpv` 已运行约 22 分钟，尚未输出 |

---

## 四、MCP direct-service-import 评估结论

- **当前状态**：经 P0 核心层重构后，`audit:mcp` 由 4 处降至 **1 处**。
- **剩余违规**：`HealthDashboardPage.tsx` 直接引入 `healthDashboardService`。
- **是否纳入本次范围**：建议**不纳入本次核心优化范围**，原因：
  1. 该处属于 UI 层调用服务层，不是 P0/P1 嵌套/链式/重复条件问题；
  2. 改为 MCPClient 调用需确认 `health` 资源已在 MCP Server 注册，并补充对应工具/资源描述，改动涉及运行时协议；
  3. 建议单独排期作为「MCP 合规收尾」任务，与本次代码质量优化解耦。

---

## 五、剩余未处理项

### 5.1 P1 中优项未处理（约 25 项）

以下文件仍存在于 `nested-code-review-report.json` 中，但严重度可控，建议后续分批处理：

- `src/services/hybrid-proofread/index.ts::runFullProofread`
- `src/services/useCase/generateTradeReview.useCase.ts::generateTradeReviewAsyncUseCase`
- `src/apps/analysis/AnalysisApp.tsx::<arrow>`（12 分支链式）
- `src/services/analysis/scoreTrendService.ts::aggregateScoresByPeriod`
- `src/services/backtest/BacktestEngine.ts::run`
- `src/services/data-collector/mockDataCollection.ts::mockCollectorFetchWithRetry`
- `src/services/feedbackService.ts::wrapOperation`
- `src/services/fetcher/orchestrator/resilienceChain.ts::fetchQuote` / `fetchKline`
- `src/services/input/batchImportParsers.ts::parseCsvLine` / `parseJsonFile`
- `src/services/resilience.ts::withRetry`
- `src/services/trading/tradeErrorDetectors.ts::detectAgainstTrendAdding`
- `src/store/executionStore.ts::<arrow>`
- `src/store/helpers/withOptimisticUpdate.ts::withOptimisticUpdate`
- `src/store/rotationSignalStore.derived.ts::<arrow>`（143 行链式）
- `src/services/data-collector/dataSourceOrchestrator.ts` 重复条件 5 组

### 5.2 P2 低优项（134 项）

主要为 UI 组件与常量文件中的重复条件/链式条件，可按优先级后续推进。

---

## 六、建议下一步

1. **等待测试套件结果**：当前任务 `nDDdpv` 仍在运行，若长时间无输出建议检查测试配置或是否有死锁。
2. **单独处理 MCP 违规**：将 `HealthDashboardPage.tsx` 改为通过 MCPClient 调用，作为独立任务。
3. **继续 P1 剩余项**：按上表分批处理服务层与 Store 层剩余嵌套/链式条件。
4. **P2 收尾**：处理 UI 层重复条件，降低重复条件指标。

---

*附：原始嵌套评审数据已更新至 `nested-code-review-report.json`。*
