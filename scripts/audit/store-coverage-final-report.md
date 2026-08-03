# V9 Store 测试覆盖率最终汇总报告

> 生成时间：2026-08-03T16:02:34.598Z
> 数据来源：`scripts/audit/audit-store-coverage.ts`（正则已修复）
> 阈值定义：P1 错误 < 0.3 | P2 警告 < 0.5 | 达标 ≥ 0.5 | 优秀 ≥ 1.0

## 一、总体达标统计

| 指标 | 数值 |
|---|---:|
| 扫描 Store 文件数 | 66 |
| action 识别总数 | 459 |
| 测试用例总数 | 1682 |
| 整体测试比率 | 3.66 |

| 达标分层 | 数量 | 占比 | 说明 |
|---|---:|---:|---|
| 🟢 优秀（ratio ≥ 1.0） | 65 | 98.5% | 每个 action 至少 1 个测试 |
| 🟢 达标（0.5 ≤ ratio < 1.0） | 0 | 0.0% | 高于警告阈值 |
| 🟡 警告（0.3 ≤ ratio < 0.5） | 0 | 0.0% | 低于 0.5 警告线 |
| 🔴 错误（ratio < 0.3） | 0 | 0.0% | 低于 0.3 错误线 |
| 🔴 严重（无测试文件） | 1 | 1.5% | 完全无测试 |
| ⚪ 无 action（数据/配置 Store） | 0 | 0.0% | 无需 action 测试 |

**达标结论**：65 / 65 个有 action 的 Store 达标（ratio ≥ 0.5），其中 65 个达优秀（ratio ≥ 1.0）。0 个低于警告线，1 个无测试文件。

## 二、全量 Store 覆盖率明细（按比率升序）

> 状态：🟢优秀(ratio≥1.0) | 🟢达标(0.5≤ratio<1.0) | 🟡警告(0.3≤ratio<0.5) | 🔴错误(<0.3) | 🔴严重(无测试) | ⚪无action

| # | Store | actions | tests | 比率 | 状态 | 差距分析 |
|---:|---|---:|---:|---:|:---:|---|
| 1 | `perfMetricsStore` | 5 | 5 | 1.00 | 🟢优秀 | 超阈值 +0.00（已有 0 个富余测试） |
| 2 | `predictionStore` | 11 | 12 | 1.09 | 🟢优秀 | 超阈值 +0.09（已有 1 个富余测试） |
| 3 | `multiFactorScreeningStore` | 16 | 18 | 1.13 | 🟢优秀 | 超阈值 +0.13（已有 2 个富余测试） |
| 4 | `holdingsStore` | 11 | 17 | 1.55 | 🟢优秀 | 超阈值 +0.55（已有 6 个富余测试） |
| 5 | `agentFeedbackStore` | 5 | 8 | 1.60 | 🟢优秀 | 超阈值 +0.60（已有 3 个富余测试） |
| 6 | `chatStore` | 3 | 5 | 1.67 | 🟢优秀 | 超阈值 +0.67（已有 2 个富余测试） |
| 7 | `registrationContractStore` | 3 | 5 | 1.67 | 🟢优秀 | 超阈值 +0.67（已有 2 个富余测试） |
| 8 | `analysisNewsStore` | 8 | 14 | 1.75 | 🟢优秀 | 超阈值 +0.75（已有 6 个富余测试） |
| 9 | `runtimeTradingConfigStore` | 4 | 7 | 1.75 | 🟢优秀 | 超阈值 +0.75（已有 3 个富余测试） |
| 10 | `intelligentScoreStore` | 25 | 46 | 1.84 | 🟢优秀 | 超阈值 +0.84（已有 21 个富余测试） |
| 11 | `hotSectorStore` | 7 | 13 | 1.86 | 🟢优秀 | 超阈值 +0.86（已有 6 个富余测试） |
| 12 | `analysisHubStore` | 3 | 6 | 2.00 | 🟢优秀 | 超阈值 +1.00（已有 3 个富余测试） |
| 13 | `collectionWizardStore` | 19 | 38 | 2.00 | 🟢优秀 | 超阈值 +1.00（已有 19 个富余测试） |
| 14 | `databridgeStore` | 4 | 8 | 2.00 | 🟢优秀 | 超阈值 +1.00（已有 4 个富余测试） |
| 15 | `dataTestStore` | 14 | 28 | 2.00 | 🟢优秀 | 超阈值 +1.00（已有 14 个富余测试） |
| 16 | `outputStore` | 6 | 12 | 2.00 | 🟢优秀 | 超阈值 +1.00（已有 6 个富余测试） |
| 17 | `dataSyncStore` | 7 | 15 | 2.14 | 🟢优秀 | 超阈值 +1.14（已有 8 个富余测试） |
| 18 | `hybridProofreadStore` | 5 | 11 | 2.20 | 🟢优秀 | 超阈值 +1.20（已有 6 个富余测试） |
| 19 | `engineStore` | 4 | 9 | 2.25 | 🟢优秀 | 超阈值 +1.25（已有 5 个富余测试） |
| 20 | `industryScoreStore` | 20 | 45 | 2.25 | 🟢优秀 | 超阈值 +1.25（已有 25 个富余测试） |
| 21 | `tradingHubStore` | 3 | 7 | 2.33 | 🟢优秀 | 超阈值 +1.33（已有 4 个富余测试） |
| 22 | `mcpServerStore` | 2 | 5 | 2.50 | 🟢优秀 | 超阈值 +1.50（已有 3 个富余测试） |
| 23 | `pageStore` | 7 | 19 | 2.71 | 🟢优秀 | 超阈值 +1.71（已有 12 个富余测试） |
| 24 | `fileImportStore` | 8 | 22 | 2.75 | 🟢优秀 | 超阈值 +1.75（已有 14 个富余测试） |
| 25 | `themeStore` | 4 | 11 | 2.75 | 🟢优秀 | 超阈值 +1.75（已有 7 个富余测试） |
| 26 | `searchStore` | 13 | 37 | 2.85 | 🟢优秀 | 超阈值 +1.85（已有 24 个富余测试） |
| 27 | `watchlistStore` | 2 | 6 | 3.00 | 🟢优秀 | 超阈值 +2.00（已有 4 个富余测试） |
| 28 | `systemMonitorStore` | 5 | 16 | 3.20 | 🟢优秀 | 超阈值 +2.20（已有 11 个富余测试） |
| 29 | `commandStore` | 9 | 29 | 3.22 | 🟢优秀 | 超阈值 +2.22（已有 20 个富余测试） |
| 30 | `loopStatusStore` | 3 | 10 | 3.33 | 🟢优秀 | 超阈值 +2.33（已有 7 个富余测试） |
| 31 | `tradingStore` | 9 | 30 | 3.33 | 🟢优秀 | 超阈值 +2.33（已有 21 个富余测试） |
| 32 | `dataflowStore` | 5 | 17 | 3.40 | 🟢优秀 | 超阈值 +2.40（已有 12 个富余测试） |
| 33 | `inputHubStore` | 5 | 17 | 3.40 | 🟢优秀 | 超阈值 +2.40（已有 12 个富余测试） |
| 34 | `widgetStore` | 7 | 24 | 3.43 | 🟢优秀 | 超阈值 +2.43（已有 17 个富余测试） |
| 35 | `strategySnapshotStore` | 7 | 25 | 3.57 | 🟢优秀 | 超阈值 +2.57（已有 18 个富余测试） |
| 36 | `mechanismHealthStore` | 3 | 11 | 3.67 | 🟢优秀 | 超阈值 +2.67（已有 8 个富余测试） |
| 37 | `agentStore` | 7 | 26 | 3.71 | 🟢优秀 | 超阈值 +2.71（已有 19 个富余测试） |
| 38 | `customAgentStore` | 4 | 15 | 3.75 | 🟢优秀 | 超阈值 +2.75（已有 11 个富余测试） |
| 39 | `collectionRuntimeStore` | 10 | 38 | 3.80 | 🟢优秀 | 超阈值 +2.80（已有 28 个富余测试） |
| 40 | `sevenDimConfigStore` | 20 | 76 | 3.80 | 🟢优秀 | 超阈值 +2.80（已有 56 个富余测试） |
| 41 | `backtestStore` | 7 | 28 | 4.00 | 🟢优秀 | 超阈值 +3.00（已有 21 个富余测试） |
| 42 | `positionStore` | 5 | 20 | 4.00 | 🟢优秀 | 超阈值 +3.00（已有 15 个富余测试） |
| 43 | `rotationSignalStore` | 3 | 12 | 4.00 | 🟢优秀 | 超阈值 +3.00（已有 9 个富余测试） |
| 44 | `signalAdviceStore` | 4 | 16 | 4.00 | 🟢优秀 | 超阈值 +3.00（已有 12 个富余测试） |
| 45 | `marketDataStore` | 10 | 42 | 4.20 | 🟢优秀 | 超阈值 +3.20（已有 32 个富余测试） |
| 46 | `localKnowledgeStore` | 9 | 38 | 4.22 | 🟢优秀 | 超阈值 +3.22（已有 29 个富余测试） |
| 47 | `analysisStore` | 8 | 34 | 4.25 | 🟢优秀 | 超阈值 +3.25（已有 26 个富余测试） |
| 48 | `sectorAnalysisStore` | 4 | 18 | 4.50 | 🟢优秀 | 超阈值 +3.50（已有 14 个富余测试） |
| 49 | `industryDashboardStore` | 4 | 19 | 4.75 | 🟢优秀 | 超阈值 +3.75（已有 15 个富余测试） |
| 50 | `profileStore.minQuality.test-data` | 0 | 0 | 1.00 | 🔴严重 | 无测试文件，0 个 action 完全未测 |
| 51 | `scoreDocStore` | 15 | 75 | 5.00 | 🟢优秀 | 超阈值 +4.00（已有 60 个富余测试） |
| 52 | `valuePitStore` | 4 | 20 | 5.00 | 🟢优秀 | 超阈值 +4.00（已有 16 个富余测试） |
| 53 | `profileStore` | 14 | 76 | 5.43 | 🟢优秀 | 超阈值 +4.43（已有 62 个富余测试） |
| 54 | `intentionPoolStore` | 9 | 50 | 5.56 | 🟢优秀 | 超阈值 +4.56（已有 41 个富余测试） |
| 55 | `disciplineStore` | 5 | 31 | 6.20 | 🟢优秀 | 超阈值 +5.20（已有 26 个富余测试） |
| 56 | `riskStore` | 5 | 32 | 6.40 | 🟢优秀 | 超阈值 +5.40（已有 27 个富余测试） |
| 57 | `researchPoolStore` | 8 | 54 | 6.75 | 🟢优秀 | 超阈值 +5.75（已有 46 个富余测试） |
| 58 | `orderStore` | 7 | 50 | 7.14 | 🟢优秀 | 超阈值 +6.14（已有 43 个富余测试） |
| 59 | `signalQualityStore` | 2 | 16 | 8.00 | 🟢优秀 | 超阈值 +7.00（已有 14 个富余测试） |
| 60 | `executionStore` | 7 | 61 | 8.71 | 🟢优秀 | 超阈值 +7.71（已有 54 个富余测试） |
| 61 | `positionPoolStore` | 8 | 85 | 10.63 | 🟢优秀 | 超阈值 +9.63（已有 77 个富余测试） |
| 62 | `portfolioStore` | 1 | 13 | 13.00 | 🟢优秀 | 超阈值 +12.00（已有 12 个富余测试） |
| 63 | `dualStrategyStore` | 3 | 46 | 15.33 | 🟢优秀 | 超阈值 +14.33（已有 43 个富余测试） |
| 64 | `analysisOrchestratorStore` | 1 | 17 | 17.00 | 🟢优秀 | 超阈值 +16.00（已有 16 个富余测试） |
| 65 | `workflowStore` | 1 | 21 | 21.00 | 🟢优秀 | 超阈值 +20.00（已有 20 个富余测试） |
| 66 | `signalStore` | 2 | 45 | 22.50 | 🟢优秀 | 超阈值 +21.50（已有 43 个富余测试） |

## 三、audit-store-coverage.ts 正则修复回顾

本轮修复 `extractActionCount()` 四处缺陷（前 3 处为正则收紧，第 4 处为系统性校验后追加的 persist 中间件排除）：

| # | 根因 | 对策 |
|---|---|---|
| 1 | 箭头正则 `[^)]*` 匹配换行符，跨行贪婪吞咽后续 `name: ... =>` | 收紧为 `[^
)]*` 单行作用域 |
| 2 | 箭头正则 `(?` 可选，`set()` 内嵌套键 `.map((x)=>)` 被误判为 action | 改为 `\(` 必选 |
| 3 | 方法简写正则误匹配 `if/for/while/switch/catch` 控制流关键字 | 新增 `isControlKeyword()` 排除 |
| 4 | Zustand `persist` 中间件配置回调（`partialize/onRehydrateStorage/getItem/setItem/removeItem`）符合箭头形态被误判为 action（系统性校验 themeStore 时发现） | 将 persist 中间件选项名加入 `INTERNAL_FIELDS` 排除 |

修复 1-3 使全仓 action 识别数 597→464（移除 133 个误报），测试用例总数 1682 不变；另恢复 1 个此前被吞咽的真实 action（perfMetricsStore.`addMetric`）。修复 4 进一步清除 themeStore 等 persist Store 的 5 个残留误报。

## 四、系统性校验：interface 声明 vs 正则识别

**校验方法**：对每个目标 Store，独立提取 `interface XxxState {}` 块中含 `=>` 的属性声明作为 ground truth（真实 action 集合），与修复后正则在整文件识别的 action 集合做差集比对：
- **正则多识别**（regex − interface）= 潜在残留误报
- **正则漏识别**（interface − regex）= 潜在残留漏报

**校验目标**：6 个高降幅 Store（最可能残留误报）+ 3 个最低比率 Store（最接近门禁）+ chatStore（触发案例）+ perfMetricsStore（漏报恢复案例）。

| Store | interface声明 | 正则识别 | 残留误报 | 残留漏报 | 结论 |
|---|---:|---:|---:|---:|:---|
| `strategySnapshotStore` | 7 | 7 | 0 | 0 | ✅ 准确 |
| `sevenDimConfigStore` | 20 | 20 | 0 | 0 | ✅ 准确 |
| `searchStore` | 13 | 13 | 0 | 0 | ✅ 准确 |
| `collectionRuntimeStore` | 10 | 10 | 0 | 0 | ✅ 准确 |
| `profileStore` | 14 | 14 | 0 | 0 | ✅ 准确 |
| `backtestStore` | 7 | 7 | 0 | 0 | ✅ 准确 |
| `predictionStore` | 11 | 11 | 0 | 0 | ✅ 准确 |
| `multiFactorScreeningStore` | 16 | 16 | 0 | 0 | ✅ 准确 |
| `themeStore` | 4 | 4 | 0 | 0 | ✅ 准确 |
| `chatStore` | 3 | 3 | 0 | 0 | ✅ 准确 |
| `perfMetricsStore` | 5 | 5 | 0 | 0 | ✅ 准确 |

### 4.1 校验详情

**strategySnapshotStore**（src\store\strategySnapshotStore.ts）
- interface 声明 7 个：`clearError`, `loadCurrentStrategy`, `loadHistorySnapshots`, `reset`, `saveSnapshot`, `selectSnapshot`, `setActiveTab`
- 正则识别 7 个：`clearError`, `loadCurrentStrategy`, `loadHistorySnapshots`, `reset`, `saveSnapshot`, `selectSnapshot`, `setActiveTab`
- 结论：准确 — interface 声明 7 个 action 与正则识别完全一致

**sevenDimConfigStore**（src\store\sevenDimConfigStore.ts）
- interface 声明 20 个：`applyTemplate`, `clearError`, `enabledCount`, `getCollectionConfig`, `isClickable`, `loadConfig`, `monthlyCallEstimate`, `reset`, `runCollection`, `saveConfig`, `setDimensionFields`, `setDimensionFrequency`, `setDimensionPolicy`, `setDimensionSourcePriority`, `setDimensionSources`, `setGlobalPolicy`, `setHistoryDays`, `setSymbolCount`, `toggleDimension`, `tooltipText`
- 正则识别 20 个：`applyTemplate`, `clearError`, `enabledCount`, `getCollectionConfig`, `isClickable`, `loadConfig`, `monthlyCallEstimate`, `reset`, `runCollection`, `saveConfig`, `setDimensionFields`, `setDimensionFrequency`, `setDimensionPolicy`, `setDimensionSourcePriority`, `setDimensionSources`, `setGlobalPolicy`, `setHistoryDays`, `setSymbolCount`, `toggleDimension`, `tooltipText`
- 结论：准确 — interface 声明 20 个 action 与正则识别完全一致

**searchStore**（src\store\searchStore.ts）
- interface 声明 13 个：`buildCriteria`, `reset`, `setDatePreset`, `setDimensions`, `setKeyword`, `setLoading`, `setPage`, `setResult`, `setSymbols`, `setViewMode`, `toggleChannel`, `toggleFileType`, `toggleStatus`
- 正则识别 13 个：`buildCriteria`, `reset`, `setDatePreset`, `setDimensions`, `setKeyword`, `setLoading`, `setPage`, `setResult`, `setSymbols`, `setViewMode`, `toggleChannel`, `toggleFileType`, `toggleStatus`
- 结论：准确 — interface 声明 13 个 action 与正则识别完全一致

**collectionRuntimeStore**（src\store\collectionRuntimeStore.ts）
- interface 声明 10 个：`addOrUpdateSpan`, `appendLog`, `clearLogs`, `clearTraces`, `loadPersistedTraces`, `refreshStats`, `reset`, `setOverallProgress`, `setRunning`, `updateTaskStatus`
- 正则识别 10 个：`addOrUpdateSpan`, `appendLog`, `clearLogs`, `clearTraces`, `loadPersistedTraces`, `refreshStats`, `reset`, `setOverallProgress`, `setRunning`, `updateTaskStatus`
- 结论：准确 — interface 声明 10 个 action 与正则识别完全一致

**profileStore**（src\store\profileStore.ts）
- interface 声明 14 个：`deleteItem`, `deleteTag`, `loadEvidence`, `loadItemDetail`, `loadItems`, `loadProfile`, `loadStocks`, `refreshItems`, `reset`, `resetFilter`, `selectItem`, `setActiveDomain`, `setFilter`, `setSymbol`
- 正则识别 14 个：`deleteItem`, `deleteTag`, `loadEvidence`, `loadItemDetail`, `loadItems`, `loadProfile`, `loadStocks`, `refreshItems`, `reset`, `resetFilter`, `selectItem`, `setActiveDomain`, `setFilter`, `setSymbol`
- 结论：准确 — interface 声明 14 个 action 与正则识别完全一致

**backtestStore**（src\store\backtestStore.ts）
- interface 声明 7 个：`clearResults`, `exportReport`, `exportReportById`, `getBacktestById`, `listBacktestHistory`, `runBacktest`, `setConfig`
- 正则识别 7 个：`clearResults`, `exportReport`, `exportReportById`, `getBacktestById`, `listBacktestHistory`, `runBacktest`, `setConfig`
- 结论：准确 — interface 声明 7 个 action 与正则识别完全一致

**predictionStore**（src\store\predictionStore.ts）
- interface 声明 11 个：`addPrediction`, `expirePredictions`, `getAccuracyStats`, `getPendingPredictions`, `getVerifiedPredictions`, `reset`, `setCurrentCycle`, `setDashboardData`, `setLatestReport`, `setLoading`, `verifyPrediction`
- 正则识别 11 个：`addPrediction`, `expirePredictions`, `getAccuracyStats`, `getPendingPredictions`, `getVerifiedPredictions`, `reset`, `setCurrentCycle`, `setDashboardData`, `setLatestReport`, `setLoading`, `verifyPrediction`
- 结论：准确 — interface 声明 11 个 action 与正则识别完全一致

**multiFactorScreeningStore**（src\store\multiFactorScreeningStore.ts）
- interface 声明 16 个：`addCriterion`, `addGroup`, `clearResults`, `deleteTemplate`, `exportResults`, `loadSavedTemplates`, `loadTemplate`, `removeCriterion`, `removeGroup`, `reset`, `resetGroups`, `runScreening`, `saveTemplate`, `setGroupLogic`, `setGroups`, `updateCriterion`
- 正则识别 16 个：`addCriterion`, `addGroup`, `clearResults`, `deleteTemplate`, `exportResults`, `loadSavedTemplates`, `loadTemplate`, `removeCriterion`, `removeGroup`, `reset`, `resetGroups`, `runScreening`, `saveTemplate`, `setGroupLogic`, `setGroups`, `updateCriterion`
- 结论：准确 — interface 声明 16 个 action 与正则识别完全一致

**themeStore**（src\store\themeStore.ts）
- interface 声明 4 个：`cycleMode`, `markHydrated`, `setMode`, `toggleTheme`
- 正则识别 4 个：`cycleMode`, `markHydrated`, `setMode`, `toggleTheme`
- 结论：准确 — interface 声明 4 个 action 与正则识别完全一致

**chatStore**（src\store\chatStore.ts）
- interface 声明 3 个：`addSystemMessage`, `clearMessages`, `sendMessage`
- 正则识别 3 个：`addSystemMessage`, `clearMessages`, `sendMessage`
- 结论：准确 — interface 声明 3 个 action 与正则识别完全一致

**perfMetricsStore**（src\store\perfMetricsStore.ts）
- interface 声明 5 个：`addMetric`, `clearCurrent`, `reset`, `saveResult`, `setRunning`
- 正则识别 5 个：`addMetric`, `clearCurrent`, `reset`, `saveResult`, `setRunning`
- 结论：准确 — interface 声明 5 个 action 与正则识别完全一致

## 五、系统性校验发现的问题与处理

### 5.1 检查过程

1. 选取 6 个高降幅 Store（strategySnapshotStore/sevenDimConfigStore/searchStore/collectionRuntimeStore/profileStore/backtestStore，BEFORE→AFTER 各移除 3-5 个误报）+ 3 个最低比率 Store（predictionStore/multiFactorScreeningStore/themeStore）+ chatStore（触发案例）+ perfMetricsStore（漏报恢复案例），共 11 个目标。
2. 对每个目标，独立提取 `interface *State`/`interface *Actions` 块中含 `=>` 的属性声明作为 ground truth，与修复后正则识别结果做差集比对。
3. 第一轮校验发现：strategySnapshotStore/profileStore 因采用 `*State`+`*Actions` 拆分式接口，校验工具未提取 `*Actions` 块（工具局限，已修正为合并提取所有 `*State/*Actions/*Store` 块）；themeStore 残留 5 个误报（`getItem/onRehydrateStorage/partialize/removeItem/setItem`）。
4. 追加修复 audit-store-coverage.ts：将 Zustand `persist` 中间件配置回调加入 `INTERNAL_FIELDS`（第 4 项修复）。
5. 第二轮校验：11 / 11 目标全部 interface 声明 == 正则识别，无残留误报/漏报。

### 5.2 发现的问题

| Store | 问题类型 | 详情 | 处理 |
|---|---|---|---|
| themeStore | 残留误报 | Zustand `persist` 中间件的 `partialize/onRehydrateStorage/getItem/setItem/removeItem` 配置回调符合 `name: (...) =>` 形态，被误判为 action（多识别 5 个） | ✅ 已修复：加入 `INTERNAL_FIELDS` 排除；themeStore action 数 9→4，比率 1.22→2.75 |
| strategySnapshotStore / profileStore | 校验工具局限 | 采用 `*State`+`*Actions` 拆分式接口，初版校验工具未提取 `*Actions` 块 | ✅ 已修正校验工具（合并提取）；两 Store 正则识别均准确 |

### 5.3 处理建议

1. **persist 中间件模式**：本次发现的 `persist` 配置回调误报已通过 `INTERNAL_FIELDS` 修复；若后续新增使用自定义 `persist` 配置的 Store，需确认是否产生新的同类误报。
2. **拆分式接口模式**：strategySnapshotStore/profileStore 等采用 `*State`+`*Actions` 拆分接口的 Store，正则识别均准确，无需特殊处理；本报告校验工具已适配该模式。
3. **多行参数签名**：当前全仓 Grep 确认无 `name: x =>` 无括号单参箭头，且目标 Store 接口声明均与正则一致，暂无漏报风险；若未来出现多行参数签名的 action，需评估正则是否需扩展。
4. **覆盖率关注**：所有 Store 均达达标线（ratio ≥ 1.0），无紧急补测需求；最低比率 perfMetricsStore(1.00)/predictionStore(1.09) 建议持续关注，确保新增 action 时同步补测。

## 六、结论

- **审计脚本修复**：`audit-store-coverage.ts` 正则四处缺陷已修复（3 处正则收紧 + 1 处 persist 中间件排除），action 识别准确度显著提升（误报清除 + 漏报恢复）。
- **覆盖率达标**：65 / 65 个有 action 的 Store 达标且全部优秀（ratio ≥ 1.0）；0 警告 / 0 错误；1 严重（测试数据文件，与本次无关）。
- **chatStore**：真实比率 1.67（3 actions / 5 tests），**无需补测**。
- **系统性校验**：11 / 11 个目标 Store 正则识别与 interface 声明完全一致；校验中发现 themeStore persist 误报并已修复，未发现其他系统性残留误报/漏报。
- **遗留**：1 个严重项 `profileStore.minQuality.test-data`（测试数据文件，0 action 0 test，与本次修复无关，建议在审计扫描范围排除 `.test-data` 后缀或在 EXCLUDE_FILES 中加入）。
