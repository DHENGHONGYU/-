---
title: 代码多层嵌套评审报告
type: explanation
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "评审范围：`src/` 目录下全部非测试 TypeScript/TSX 文件 扫描文件数：674 个 生成时间：2026/7/10 08:42:12"
tags: [project, report, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-282
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 代码多层嵌套评审报告

> 评审范围：`src/` 目录下全部非测试 TypeScript/TSX 文件  
> 扫描文件数：674 个  
> 生成时间：2026/7/10 08:42:12

## 一、总体概览

| 维度 | 数量 | 说明 |
|------|------|------|
| 深层嵌套结构（≥4 层） | 66 处 | 排除 if-else-if 链后的真实嵌套 |
| 过长 if-else-if 链 | 32 处 | 分支数 ≥4 的链式条件 |
| 卫语句/提前返回优化机会 | 0 处 | 当前代码中可被直接优化的模式 |
| 冗余 break 语句 | 0 处 | 循环末尾无意义的 break |
| 重复条件判断 | 194 处 | 已排除链式条件和简单路径匹配 |

---

## 二、深层嵌套结构（≥4 层）

以下列出真实嵌套深度达到或超过 4 层的控制结构，按文件聚合展示前 20 个典型位置。

### src/core/databridge.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| forward | 330 | 371:9 | 4 | IfStatement | if (this.isMarketEnvelope(meta.action)) { |

### src/core/databridgeHandlers.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| handle | 198 | 235:11 | 4 | IfStatement | if (rec.id) { |
| handle | 198 | 254:11 | 4 | IfStatement | if (rec.id) { |

### src/data/db-migrations.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| runMigrations | 49 | 80:7 | 4 | IfStatement | if (!m) continue |
| runMigrations | 49 | 81:7 | 4 | IfStatement | if (m.down) { |
| runMigrations | 49 | 82:9 | 5 | TryStatement | try { |
| runMigrations | 49 | 85:11 | 6 | CatchClause | catch (downErr) { |

### src/data/sectorDefinitions.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| matchStocksToSectors | 514 | 533:9 | 4 | IfStatement | if (!mapping.stockSymbols.includes(stock.symbol)) { |
| matchStocksToSectors | 514 | 544:9 | 4 | IfStatement | if (!mapping.stockSymbols.includes(stock.symbol)) { |

### src/lib/localStorageManager.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| byteLength | 96 | 105:7 | 4 | IfStatement | if (code < 0x80) len += 1 |
| getNamespaceInfo | 414 | 429:11 | 4 | IfStatement | if (entry.createdAt < oldestTime) { |
| getNamespaceInfo | 414 | 433:11 | 4 | IfStatement | if (entry.createdAt > newestTime) { |
| getNamespaceInfo | 414 | 437:11 | 4 | CatchClause | catch { |

### src/mcp/core/client.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| readResource | 133 | 150:11 | 4 | IfStatement | if (!aclResult.allowed) { |

### src/mcp/core/notification.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| emit | 49 | 57:11 | 4 | CatchClause | catch (error) { |

### src/mcp/core/server.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| readResource | 217 | 227:11 | 4 | CatchClause | catch (err) { |
| readResource | 217 | 228:11 | 5 | IfStatement | if (err instanceof McpAclError) { |
| readResource | 217 | 244:11 | 4 | CatchClause | catch (error) { |

### src/services/analysis/scoreTrendService.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| aggregateScoresByPeriod | 81 | 112:9 | 4 | IfStatement | if (!dim \|\| !dim.name) continue |
| aggregateScoresByPeriod | 81 | 114:9 | 4 | IfStatement | if (typeof s !== 'number' \|\| !Number.isFinite(s)) continue |
| aggregateScoresByPeriod | 81 | 116:9 | 4 | IfStatement | if (!entry) { |

### src/services/backtest/BacktestEngine.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| run | 103 | 154:11 | 4 | IfStatement | if (remaining <= 0) { |

### src/services/data-collector/collectors/BaseCollector.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| collectWithRetry | 39 | 56:9 | 4 | IfStatement | if (attempt < this.config.retryCount) { |

### src/services/data-collector/mockDataCollection.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| mockCollectorFetchWithRetry | 790 | 802:7 | 4 | IfStatement | if (attempt < maxRetries) { |

### src/services/feedbackService.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| wrapOperation | 308 | 352:7 | 4 | IfStatement | if (attempt < maxRetries) { |

### src/services/fetcher/fetcherClient.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| request | 53 | 85:7 | 4 | IfStatement | if (!isNetworkError \|\| attempt === maxRetries) { |

### src/services/fetcher/fetcherInterceptor.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| interceptedFetch | 67 | 98:9 | 4 | IfStatement | if (errorType === HttpErrorType.UNAUTHORIZED && config.onUnauthorized) { |
| interceptedFetch | 67 | 101:9 | 4 | IfStatement | if (errorType === HttpErrorType.FORBIDDEN && config.onForbidden) { |
| interceptedFetch | 67 | 106:9 | 4 | IfStatement | if (shouldRetry(error, config, attempt)) { |
| interceptedFetch | 67 | 119:7 | 4 | IfStatement | if (err instanceof HttpError) { |
| interceptedFetch | 67 | 133:7 | 4 | IfStatement | if (shouldRetry(error, config, attempt)) { |

### src/services/fetcher/orchestrator/resilienceChain.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| fetchQuote | 48 | 83:9 | 4 | IfStatement | if (next) { |
| fetchKline | 110 | 145:9 | 4 | IfStatement | if (next) { |

### src/services/hybrid-proofread/index.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| runFullProofread | 11 | 70:9 | 4 | TryStatement | try { |
| runFullProofread | 11 | 74:11 | 5 | CatchClause | catch (error) { |

### src/services/input/batchImportParsers.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| parseCsvLine | 169 | 179:9 | 4 | IfStatement | if (line[i + 1] === '"') { |
| parseJsonFile | 323 | 350:9 | 4 | IfStatement | if (STOCK_CODE_PATTERN.test(code)) { |

### src/services/llm/llmClient.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| chat | 123 | 166:9 | 4 | IfStatement | if (raw.error?.message) { |
| chat | 123 | 169:9 | 4 | CatchClause | catch { |
| streamingChat | 241 | 293:9 | 4 | IfStatement | if (errRaw.error?.message) { |
| streamingChat | 241 | 296:9 | 4 | CatchClause | catch { |
| streamingChat | 241 | 328:9 | 4 | IfStatement | if (line.trim().length === 0) continue |

### src/services/news/stockLinker.ts

| 方法 | 函数行 | 嵌套行 | 嵌套深度 | 结构类型 | 代码片段 |
|------|--------|--------|----------|----------|----------|
| matchText | 122 | 140:9 | 4 | IfStatement | if (!code) continue |
| matchText | 122 | 142:9 | 4 | IfStatement | if (matchedStock && matchedStock.symbol === stock.symbol) { |
| matchText | 122 | 169:9 | 4 | IfStatement | if (text.includes(prefix)) { |
| matchText | 122 | 186:9 | 4 | IfStatement | if (text.includes(keyword)) { |

> 完整列表见 JSON 报告 `nested-code-review-report.json` → `deeplyNestedBlocks`。

---

## 三、过长 if-else-if 链

以下链式条件结构建议改用 `switch` 或 `Map<condition, handler>` 模式，以降低维护成本。

### src/apps/analysis/AnalysisApp.tsx

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| <arrow> | 52 | 62 | 95 | 12 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/apps/input/InputApp.tsx

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| <arrow> | 47 | 58 | 76 | 7 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| InputApp | 41 | 95 | 115 | 7 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/apps/output/OutputApp.tsx

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| <arrow> | 181 | 192 | 207 | 6 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| OutputApp | 175 | 230 | 240 | 6 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/apps/trading/TradingApp.tsx

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| <arrow> | 60 | 71 | 86 | 6 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| TradingApp | 36 | 130 | 166 | 7 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/core/entityValidators.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| validateOrder | 46 | 64 | 70 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| validateOrder | 46 | 75 | 81 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/analysis/rotation/rotationCalculator.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| calculateResonance | 71 | 74 | 80 | 7 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/input/batchImportParsers.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| parseBulkInput | 88 | 109 | 128 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/hotSectorDimensions.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| calculateSentiment | 177 | 185 | 191 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| calculateValuationRisk | 277 | 281 | 291 | 6 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/v6-engine/calculators/l0_l1_l2.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| scoreLongTermTrend | 263 | 270 | 273 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/v6-engine/calculators/l3/helpers.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| scoreMoat | 58 | 64 | 68 | 5 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| scoreFinancialDimensions | 27 | 33 | 36 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| scoreFinancialDimensions | 27 | 43 | 46 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| scoreFinancialDimensions | 27 | 53 | 56 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| scoreFinancialDimensions | 27 | 65 | 68 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| scoreFinancialDimensions | 27 | 75 | 78 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| evaluateIPC | 190 | 199 | 202 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| evaluateIPC | 190 | 233 | 239 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| evaluateIPC | 190 | 262 | 274 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/v6-engine/calculators/l3/l3v-valuation.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| scoreValuation | 24 | 32 | 35 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/v6-engine/calculators/l4_l5_l6.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| scoreScenario | 74 | 103 | 113 | 6 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| evaluateTMMatrix | 186 | 231 | 237 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| evaluateHypeCycle | 317 | 334 | 352 | 6 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/services/scoring/valuePitAnalyzer.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| calculateValuationMargin | 156 | 160 | 166 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| calculateRotationPosition | 249 | 253 | 259 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |
| calculateLiquidity | 284 | 290 | 296 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/store/analysisStore.derived.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| <arrow> | 105 | 114 | 117 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

### src/store/rotationSignalStore.derived.ts

| 方法 | 函数行 | 链起始行 | 链结束行 | 分支数 | 优化建议 |
|------|--------|----------|----------|--------|----------|
| <arrow> | 143 | 151 | 157 | 4 | Consider replacing the long if-else-if chain with a switch statement or a route→component map |

---

## 四、重复条件判断

以下条件在多个位置重复出现，建议提取为布尔变量或辅助谓词函数。

### src/agents/agentHealthMonitor.ts

**重复条件：** `monitorInstance`

| 出现位置 | 代码片段 |
|----------|----------|
| 173:3 | if (monitorInstance) return monitorInstance |
| 184:3 | if (monitorInstance) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/apps/input/BulkImportPanel.tsx

**重复条件：** `importPhase === 'importing'`

| 出现位置 | 代码片段 |
|----------|----------|
| 208:5 | if (importPhase === 'importing') return `导入中 ${importProgress}%` |
| 218:5 | if (importPhase === 'importing') return 'secondary' |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/apps/trading/components/PhaseStepper.tsx

**重复条件：** `cancelled`

| 出现位置 | 代码片段 |
|----------|----------|
| 38:5 | if (cancelled) { |
| 47:5 | if (cancelled) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/cockpit/core/widgetRegistry.ts

**重复条件：** `!template`

| 出现位置 | 代码片段 |
|----------|----------|
| 340:5 | if (!template) { |
| 387:5 | if (!template) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/cockpit/providers/MarketDataProvider.tsx

**重复条件：** `instanceId`

| 出现位置 | 代码片段 |
|----------|----------|
| 50:7 | if (instanceId) { |
| 59:7 | if (instanceId) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/cockpit/widgets/SignalMonitorWidget.tsx

**重复条件：** `direction === 'buy'`

| 出现位置 | 代码片段 |
|----------|----------|
| 68:5 | if (direction === 'buy') return <ArrowUpCircle className={`h-5 w-5 ${COLOR_TOKENS.success.tailwind}` |
| 74:5 | if (direction === 'buy') return <Badge className="text-xs" style={{ backgroundColor: THEME_TOKENS.co |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

**重复条件：** `direction === 'sell'`

| 出现位置 | 代码片段 |
|----------|----------|
| 69:5 | if (direction === 'sell') return <ArrowDownCircle className={`h-5 w-5 ${COLOR_TOKENS.danger.tailwind |
| 75:5 | if (direction === 'sell') return <Badge className="text-xs" style={{ backgroundColor: THEME_TOKENS.c |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/cockpit/widgets/SignalQualityDashboardWidget.tsx

**重复条件：** `value === undefined || value === null`

| 出现位置 | 代码片段 |
|----------|----------|
| 134:3 | if (value === undefined \|\| value === null) return '—' |
| 140:3 | if (value === undefined \|\| value === null) return '—' |
| 146:3 | if (value === undefined \|\| value === null) return '—' |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/analysis/score/ScoreFactorWaterfall.tsx

**重复条件：** `row.isTotal`

| 出现位置 | 代码片段 |
|----------|----------|
| 149:3 | if (row.isTotal) { |
| 257:15 | if (row.isTotal) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/analysis/sector/SectorRotationHeatmap.tsx

**重复条件：** `value === null`

| 出现位置 | 代码片段 |
|----------|----------|
| 66:3 | if (value === null) { |
| 88:3 | if (value === null) return 'N/A' |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/collection/CollectionReportPanel.tsx

**重复条件：** `rate >= 80`

| 出现位置 | 代码片段 |
|----------|----------|
| 25:3 | if (rate >= 80) return COLOR_TOKENS.success.tailwind |
| 31:3 | if (rate >= 80) return 'default' |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

**重复条件：** `rate >= 50`

| 出现位置 | 代码片段 |
|----------|----------|
| 26:3 | if (rate >= 50) return COLOR_TOKENS.warning.tailwind |
| 32:3 | if (rate >= 50) return 'secondary' |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/input/StockSearch.tsx

**重复条件：** `debounceRef.current`

| 出现位置 | 代码片段 |
|----------|----------|
| 37:5 | if (debounceRef.current) { |
| 57:7 | if (debounceRef.current) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/input/TraceReplayPanel.tsx

**重复条件：** `index >= stages.length - 1`

| 出现位置 | 代码片段 |
|----------|----------|
| 106:5 | if (index >= stages.length - 1) return 100 |
| 131:5 | if (index >= stages.length - 1) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/output/reviewArtifact.ts

**重复条件：** `items.length === 0`

| 出现位置 | 代码片段 |
|----------|----------|
| 42:3 | if (items.length === 0) return '' |
| 63:3 | if (items.length === 0) return '' |
| 71:3 | if (items.length === 0) return '' |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/pool/usePoolDataFromStore.ts

**重复条件：** `!success`

| 出现位置 | 代码片段 |
|----------|----------|
| 108:7 | if (!success) { |
| 122:7 | if (!success) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/system/LogStreamPanel.tsx

**重复条件：** `!isPaused`

| 出现位置 | 代码片段 |
|----------|----------|
| 160:7 | if (!isPaused) { |
| 167:5 | if (!isPaused) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/system/migration/useMcpMigration.ts

**重复条件：** `result.isError`

| 出现位置 | 代码片段 |
|----------|----------|
| 27:5 | if (result.isError) { |
| 72:5 | if (result.isError) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/ui/DataState.tsx

**重复条件：** `isLoading`

| 出现位置 | 代码片段 |
|----------|----------|
| 59:3 | if (isLoading) { |
| 127:3 | if (isLoading) { |
| 171:3 | if (isLoading) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

**重复条件：** `showEmpty`

| 出现位置 | 代码片段 |
|----------|----------|
| 88:3 | if (showEmpty) { |
| 181:3 | if (showEmpty) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/components/ui/Popover.tsx

**重复条件：** `trigger === 'hover'`

| 出现位置 | 代码片段 |
|----------|----------|
| 63:7 | if (trigger === 'hover') setIsOpen(true) |
| 67:7 | if (trigger === 'hover') setIsOpen(false) |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

**重复条件：** `trigger === 'focus'`

| 出现位置 | 代码片段 |
|----------|----------|
| 71:7 | if (trigger === 'focus') setIsOpen(true) |
| 75:7 | if (trigger === 'focus') setIsOpen(false) |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/config/dataSourceRegistry.ts

**重复条件：** `dimensionSourcePriority && dimensionSourcePriority.length > 0`

| 出现位置 | 代码片段 |
|----------|----------|
| 139:3 | if (dimensionSourcePriority && dimensionSourcePriority.length > 0) { |
| 151:3 | if (dimensionSourcePriority && dimensionSourcePriority.length > 0) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

### src/constants/theme/theme.tokens.shades.ts

**重复条件：** `shade === undefined`

| 出现位置 | 代码片段 |
|----------|----------|
| 203:3 | if (shade === undefined) { |
| 225:3 | if (shade === undefined) { |
| 247:3 | if (shade === undefined) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

**重复条件：** `color in SEMANTIC_COLORS`

| 出现位置 | 代码片段 |
|----------|----------|
| 205:5 | if (color in SEMANTIC_COLORS) { |
| 227:5 | if (color in SEMANTIC_COLORS) { |
| 249:5 | if (color in SEMANTIC_COLORS) { |

> 建议：Consider extracting the shared condition into a boolean variable or a helper predicate

---

## 五、冗余 break 语句

未在循环末尾发现冗余的 `break` 语句。现有 `break` 均位于 `switch` 分支或条件判断内，属于合法用法。

---

## 六、优化建议汇总

### 6.1 深层嵌套优化方向

1. **卫语句/提前返回**：对于 `if (condition) { return; } else { ... }` 模式，将条件取反后直接返回，把 else 块提升为主流程。
2. **循环内守卫**：对于 `for (...) { if (skip) continue; ... }`，确保 `continue` 尽早出现，避免在跳过条件后继续多层缩进。
3. **异常处理抽离**：`try/catch` 嵌套多层时，将内部逻辑抽取为独立函数，减少外层 catch 的嵌套深度。
4. **策略表/映射**：将分支条件映射到处理函数（如 `const handlers = { '/a': A, '/b': B }`），消除 if-else-if 链。

### 6.2 重复逻辑处理方向

1. **提取布尔变量**：对多次出现的复杂条件，赋予语义化变量名。
2. **提取谓词函数**：将业务条件封装为 `isXxx(...)` 辅助函数。
3. **统一配置/常量**：路径前缀、阈值、状态码等应进入 `src/constants` 或 `src/config`，避免字符串硬编码。

### 6.3 break 使用方向

当前未发现循环末尾冗余 `break`。保持现状即可，但新增循环时应注意：
- 循环正常结束不要手动 `break`；
- `break` 仅用于提前退出或 `switch` 分支。

---

## 七、附录：复现方法

```bash
node /tmp/nest-review/nested-review-v2.cjs
```

工具依赖项目本地 `typescript` 包，通过 `NODE_PATH` 指向项目 `node_modules`。

---

*注：本报告为静态扫描结果，具体重构前请在目标代码处补全单元测试。*
