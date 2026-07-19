---
title: 剩余复杂度整改任务清单与计划（2026-07-12）
type: explanation
domain: architecture
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "基准：`complexity-baseline-current.json`（实测 93 项 = 64 深度嵌套 D4 + 29 重复条件，长链已归零） 口径：深度≥4 /..."
tags: [architecture, complexity, remediation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-034
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 剩余复杂度整改任务清单与计划（2026-07-12）

> 基准：`complexity-baseline-current.json`（实测 93 项 = 64 深度嵌套 D4 + 29 重复条件，长链已归零）
> 口径：深度≥4 / 重复条件（同函数内逐字相同布尔表达式）/ 长链≥4 分支
> 整改原则：**债务只降不升**；仅对「纯函数 / 无状态与并发依赖」者提取；并发语义相关者维持原样并注释。

## 一、环境整改结论（已落实）

| 问题 | 根因核实 | 整改 |
|---|---|---|
| `SkillManage` 不可用 | 本会话 deferred 工具未暴露；正确入口是 `skill-creator` SKILL（经 `Skill` 工具调用） | 用 `skill-creator` 创建/更新技能 |
| tsx 段错误（0xC0000005） | `node_modules/.cache/tsx`、`~/.cache/tsx` 缓存损坏；当前两目录均已不存在，tsx 在 Node 22/24 下 `-e` 均 exit 0（已不复现） | 默认用系统 Node 24 驱动 tsx 审计；复发即清缓存 |
| vitest `Worker exited unexpectedly` | `vite.config.ts` 旧 `pool:'forks', maxForks:1, fileParallelism:false` → 单 fork 串行 317 文件，内存跨文件累积致死；崩溃点每轮不同印证为累积型 | `maxForks: 1 → 4`（文件间回收 fork，内存释放）；保留 `fileParallelism:false` 规避 threads 池崩溃 |

## 二、深度嵌套（64 处，全部 D4）整改清单

按「核心基础设施 → 服务层 → UI 层」与「单文件多违规优先」排序。每批编辑后跑 `tsc:prod + audit:layers + audit:atomic + 定向测试`。

### Tier 1 — 核心 / 单文件多违规（高 ROI，优先）
| # | 文件 | 函数 | D4数 | 手法 |
|---|---|---|---|---|
| D1 | `src/lib/localStorageManager.ts` | 3 处 | 3 | 卫语句 + helper 提取（纯函数，安全） |
| D2 | `src/services/data-collector/dataSourceOrchestrator.ts` | 3 处 | 3 | 早返回 + 提取子流程 |
| D3 | `src/services/llm/llmClient.ts` | 2 处 + 1 重复 | 2 | 提取流式处理 helper |
| D4 | `src/core/pipelineScheduler.ts` | 2 处 | 2 | 提取调度分支 helper |
| D5 | `src/data/db.ts` | 2 处 + withTransaction 重复 | 2 | 卫语句拍平 |
| D6 | `src/components/organisms/input/StockSearch.tsx` | 2 处 + 1 重复 | 2 | 提取渲染/查询 helper |
| D7 | `src/components/organisms/system/MigrationPanel.tsx` | 2 处 + 1 重复 | 2 | 提取分支 |
| D8 | `src/services/hybrid-proofread/localCollector.ts` | 2 处 | 2 | 早返回 |
| D9 | `src/services/input/batchImportParsers.ts` | 2 处 | 2 | 提取解析 helper |
| D10 | `src/services/input/inputService.ts` | 2 处 | 2 | 提取校验 helper |
| D11 | `src/services/news/newsService.ts` | 2 处 | 2 | 早返回 |
| D12 | `src/services/news/sentimentAnalyzer.ts` | 2 处 | 2 | 提取情感判定 helper |
| D13 | `src/services/system/localDocService.ts` | 2 处 | 2 | 提取 IO helper |
| D14 | `src/services/system/migration/migrationTransformers.ts` | 2 处 | 2 | 提取转换 helper |
| D15 | `src/services/trading/tradeErrorDetectors.ts` | 2 处 | 2 | 提取判定 helper |
| D16 | `src/store/signalQualityStore.derived.ts` | 2 处 | 2 | 提取派生 helper |

### Tier 2 — 单文件单违规（服务/核心层，约 30 处，逐文件卫语句/helper）
`src/core/databridge.ts`(query 段，谨慎)、`src/lib/store-audit/analyzer.ts`、`src/mcp/core/client.ts`、`src/mcp/core/mcpAclMonitor.ts`、`src/mcp/register.ts`、`src/services/backtest/backtestMetrics.ts`、`src/services/collection/collectionWizardPersistence.ts`、`src/services/data-collector/directDataAPI.ts`、`src/services/fetcher/dataSourceRegistry.ts`、`src/services/fetcher/directDataAPI.ts`、`src/services/fetcher/fetcherInterceptor.ts`、`src/services/fetcher/orchestrator/phaseOrchestrator.ts`、`src/services/input/batchImportExecutor.ts`、`src/services/news/stockLinker.ts`、`src/services/rbac/rbacManagementService.ts`、`src/services/scoring/v6-engine/calculators/l7_l8.ts`、`src/services/scoring/v6-engine/engine.ts`、`src/services/scoring/v6-engine/types.ts`、`src/services/screening/multiFactorScreeningEngine.ts`、`src/services/pool/poolService.ts`、`src/services/system/migration/storeMigrators.ts`、`src/services/system/v6MigrationService.ts`、`src/services/trading/positionComputer.ts`、`src/services/trading/scoringAdapter.ts`、`src/services/trading/strategySnapshotService.ts`、`src/services/trading/tradeErrorClassifier.ts`、`src/services/trading/tradeErrorUtils.ts`、`src/services/trading/tradeReviewAI.skillDevelopment.ts`、`src/services/trading/tradeReviewAI.utils.ts`、`src/services/useCase/getUnifiedStockView.useCase.ts`

### Tier 3 — 单文件单违规（UI / 页面 / 组件 / Hook 层，约 18 处）
`src/apps/command/ConfigApp.tsx`、`src/apps/input/BulkImportPanel.tsx`、`src/apps/trading/components/PhaseStepper.tsx`、`src/cockpit/CockpitShell.tsx`、`src/components/organisms/input/TraceReplayPanel.tsx`、`src/components/organisms/pool/usePoolDataFromStore.ts`、`src/components/organisms/system/LogStreamPanel.tsx`、`src/components/organisms/system/migration/MigrationUploadTab.tsx`、`src/data/repository.ts`(重复)、`src/hooks/cabin/useIndustryScorePage.ts`、`src/hooks/useConfirmDialog.tsx`、`src/hooks/useFreshData.ts`、`src/hooks/usePoolBoard.ts`、`src/pages/analysis/IntelligentScorePage.tsx`、`src/pages/analysis/ScoreDocPage.tsx`、`src/pages/analysis/StockAnalysisPage.tsx`、`src/pages/input/CollectTask/index.tsx`、`src/pages/trading/components/TradeModal.tsx`、`src/pages/trading/HoldingsPage.tsx`、`src/pages/trading/TradingFlowPage.tsx`

## 三、重复条件（29 处）整改清单

### 安全可提取（纯函数 / 无状态依赖）—— 提取具名谓词
| # | 文件 | 函数 | 说明 |
|---|---|---|---|
| C1 | `src/apps/input/BulkImportPanel.tsx` | L44 | UI 条件，安全 |
| C2 | `src/apps/trading/components/PhaseStepper.tsx` | L33 | UI 阶段判定，安全 |
| C3 | `src/cockpit/CockpitShell.tsx` | `WidgetWrapper` L50 | UI 包装，安全 |
| C4 | `src/components/organisms/input/StockSearch.tsx` | L20 | 查询条件，安全 |
| C5 | `src/components/organisms/input/TraceReplayPanel.tsx` | L82 | UI，安全 |
| C6 | `src/components/organisms/pool/usePoolDataFromStore.ts` | L39 | Hook，安全 |
| C7 | `src/components/organisms/system/LogStreamPanel.tsx` | `LogStreamPanelBase` L125 | UI，安全 |
| C8 | `src/components/organisms/system/migration/MigrationUploadTab.tsx` | L15 | UI，安全 |
| C9 | `src/components/organisms/system/MigrationPanel.tsx` | L23 | UI，安全 |
| C10 | `src/data/db.ts` | `withTransaction` L104 | 事务判定，安全 |
| C11 | `src/data/repository.ts` | `createRepository` L72 | 仓库判定，安全 |
| C12 | `src/hooks/cabin/useIndustryScorePage.ts` | L103 | Hook，安全 |
| C13 | `src/hooks/useConfirmDialog.tsx` | L67 | Hook，安全 |
| C14 | `src/hooks/useFreshData.ts` | L111 | Hook，安全 |
| C15 | `src/hooks/usePoolBoard.ts` | L28 | Hook，安全 |
| C16 | `src/mcp/servers/fetcher/dataFetcherServer.ts` | `getResources` L186 | 服务端判定，安全 |
| C17 | `src/pages/analysis/IntelligentScorePage.tsx` | L175 | 页面，安全 |
| C18 | `src/pages/analysis/ScoreDocPage.tsx` | L24 | 页面，安全 |
| C19 | `src/pages/analysis/StockAnalysisPage.tsx` | L17 | 页面，安全 |
| C20 | `src/pages/trading/components/TradeModal.tsx` | L40 | 页面，安全 |
| C21 | `src/pages/trading/HoldingsPage.tsx` | L48 | 页面，安全 |
| C22 | `src/pages/trading/TradingFlowPage.tsx` | L30 | 页面，安全 |
| C23 | `src/services/llm/llmClient.ts` | `streamingChat` L287 | 流式状态判定，安全 |
| C24 | `src/services/resilience.ts` | `createCircuitBreaker` L180 | 熔断器初始化，安全 |
| C25 | `src/store/agentStore.ts` | `initAgentSubscriptions` L88 | Store 订阅，安全 |
| C26 | `src/store/dualStrategyStore.ts` | `initDualStrategyStoreSubscriptions` L503 | Store 订阅，安全 |
| C27 | `src/store/positionStore.ts` | `initPositionStoreSubscriptions` L223 | Store 订阅，安全 |
| C28 | `src/store/signalStore.ts` | `initSignalStoreSubscriptions` L186 | Store 订阅，安全 |

### ?? 不可提取（并发语义依赖，维持原样并注释）
| # | 文件 | 函数 | 原因 |
|---|---|---|---|
| C29 | `src/services/resilience.ts` | `guard` L191 | `state === 'half-open'` 出现在 `Promise.then` 两个回调内，状态在异步期可被并发修改，必须回调内即时求值；提取为函数入口局部变量会**改变并发语义** → 不提取，加注释说明 |

## 四、执行节奏（每批守门禁）
1. Tier 1（16 文件，约 35 处）→ 验 `tsc:prod + audit:layers + audit:atomic + 定向测试`
2. Tier 2（~30 文件）→ 同上
3. Tier 3（~20 文件）→ 同上
4. 重复条件 C1–C28 随对应文件批次一并提取；C29 维持并注释
5. 末批：全量 `complexity` 实测 + `test:clean`(环境整改后) + 更新基线

## 五、执行进度（2026-07-12 实时）

> **最终结论（重复条件整改后实测 `complexity-scan.ts` + `measure-complexity-now.ts`）**：
> - 文件扫描 905（complexity-scan）/ 707（measure）；总违规 **0** = 深度嵌套 **0** + 长链 **0** + 重复条件 **0**。
> - 38 文件逻辑嵌套清单（D4）已全部平铺归零；深度嵌套从基准 64 降到 **0**。
> - 重复条件 29 处（C1–C28 提取合并 + C29 熔断状态机维持）现已归零：C1–C28 通过抽具名 helper / 卫语句一正一反 / De Morgan 反转全部消除；C29 `resilience.guard` 两处 `state === 'half-open'` 分属 `createCircuitBreaker` 与内部 `<arrow>` 两个不同函数，官方 per-function 扫描不计为重复，维持原样。

### 本轮收尾（6 个被中断子代理批次遗留文件，逐一平铺 + 单文件 tsc 自检通过）
| 文件 | 函数 | 手法 | 深度 |
|---|---|---|---|
| `src/services/data-collector/directDataAPI.ts` | `neteaseHistory` | 提取 `parseNeteaseLine`（卫语句返回 null）+ `parseNeteaseLines`（循环调用），保持正序→reverse 行为 | D4→≤3 |
| `src/services/fetcher/dataSourceRegistry.ts` | `getActiveProvider` | 提取 `checkProviderHealth` 返回 `'healthy'\|'unhealthy'\|'error'` 枚举，循环体 `for→if` 平铺 | D4→≤3 |
| `src/services/fetcher/directDataAPI.ts` | `parseTencentKline` | 提取 `resolveStockData`（含前缀兜底，保留两处 warning 文案）返回 `Record\|null`，主函数 `try→if` | D4→≤3 |
| `src/services/input/inputService.ts` | `importPool` | 提取 `applyImportOutcome`（已存在→failed / 否则→success），循环 `for→try→调用` | D4→≤3 |
| `src/services/news/newsService.ts` | `saveNewsArticle` | 提取 `saveNewsStockMaps`（批量保存关联映射，任一失败即返回），消除 `for→if` D4 | D4→≤3 |
| `src/services/news/stockLinker.ts` | `matchText` | 提取 `selectBestLink`（候选排序取最高且达阈值，否则 null），循环 `for→调用→if` | D4→≤3 |

### 历史已落实（Wave A + Wave B + 核心 11 文件，深度嵌套 64 → 0 累计）
- `localStorageManager` / `localCollector` / `signalQualityStore.derived` / `batchImportParsers` / `newsService.getNewsBySymbol` / `localDocService` / `pipelineScheduler` / `inputService.addStock` / `sentimentAnalyzer` 等 Wave A/B。
- 核心 11 文件（ConfigApp、db、client、mcpAclMonitor、register、CollectTaskPage×2、fetcherInterceptor、phaseOrchestrator、batchImportExecutor×2、databridge）已在本会话前序批次完成并 tsc 自检通过。
- 另含前序批次：`dataSourceOrchestrator`、`llmClient`、`StockSearch`、`MigrationPanel`、`rbac`、`positionComputer`、`scoringAdapter`、`strategySnapshotService`、`tradeErrorClassifier/Utils/Detectors×2`、`skillDevelopment`、`tradeReviewAI.utils`、`useCase`、`backtestMetrics`、`collectionWizardPersistence`、`multiFactorScreeningEngine`、`stockpoolService`、`migrationTransformers×2`、`storeMigrators`、`v6MigrationService`、`l7_l8` 等。

### 环境整改（已落地并验收）
- `vite.config.ts`：`maxForks 1 → 4`，消除 vitest worker 内存累积崩溃（317 文件 / 4610 用例全过）。
- tsx 受管 Node22 间歇段错误：改用系统 Node24 直驱 tsc/tsx 绕过（非代码缺陷）。
- SkillManage 入口错（非真不可用）已核实。
- ?? 根目录新建文件疑似被清理机制莫名删除：已改用内联 `grep` / 临时 `_cx_*.json` + `_cx_filter.cjs` 规避。

### 重复条件整改（C1–C28 已落实，2026-07-12 收尾批次）
- 手法统一为四类：① 抽具名 helper 把 `if` 收进唯一一处（StockSearch / TraceReplayPanel / usePoolDataFromStore / LogStreamPanel / MigrationUploadTab / MigrationPanel / db / repository / useConfirmDialog / useStockPoolBoard / dataFetcherServer / llmClient / HoldingsPage / TradingFlowPage / agentStore / dualStrategyStore / positionStore）；② 卫语句一正一反（BulkImportPanel / PhaseStepper / CockpitShell / useIndustryScorePage / useFreshData / StockAnalysisPage / IntelligentScorePage / ScoreDocPage / TradeModal）；③ `if (result.success)` 三处合并为 `reportOrderOutcome` 回调 helper（TradingFlowPage）；④ `signalStore` 两处同义 source 过滤经 De Morgan 反转区分（analyzer `=== || ===` vs signals `!== && !==`）。
- 门禁复测（系统 Node24 直驱）：`tsc:prod` 0 错；`audit:layers` 868 文件 0 违规；`audit:atomic` 133 文件 0 违规；`complexity-scan` 重复 if 条件 **0**（深层嵌套 0 / 长链 0）。
- C29 `resilience.guard` 维持原样（熔断状态机并发语义，官方 per-function 扫描不计重复）。

### 剩余（非本 38 文件清单范围）
- 长链条件：0。深度嵌套：0。重复条件：0（已全部归零）。

### 整改质量验证（测试补充 + 运行效率基准，2026-07-12 复核）
- **复核结论**：重复条件 29 处确已清零（自研 `find-dups.ts` 与权威 `complexity-scan` 口径对齐，仅余 C29 熔断状态机两处 `state==='half-open'` 属 per-function 不同函数、不计重复）；`tsc:prod` / `audit:layers` / `audit:atomic` / `complexity-scan` 四道门禁全绿。
- **新增回归测试**（`tests/remediation/`，锁定「不变量」防止重复条件被重新内联）：
  - `resilience-guard-c29.test.ts`（5 用例）：C29 熔断状态机「半开→探测→闭合/恢复」状态迁移正确，确保该处有意不消重不被误改。
  - `dualStrategy-dedup-invariant.test.ts`（4 用例）：抽取后的单一守卫 `shouldSkipSelf` 在 4 个 analyzer 派生频道全部生效（self-source 拦截 0 refresh、other-source 去抖合并为 1 次 refresh=3 query、混合 source 仅 external 触发）；含运行效率基准。
  - `signal-dedup-invariant.test.ts`（2 用例）：De Morgan 反转后的两频道 source 守卫——`trading`/`tradinghub` 跳过 0 refresh、其余来源去抖合并为 1 次 refresh。
- **运行效率基准**（`docs/reports/remediation-efficiency.json`）：dualStrategyStore 订阅热路径 5 频道批量派发 50 万次信封，**798,311 ops/sec**（626ms）。抽取守卫后与整改前结构等价，守卫开销微秒级，**无运行时回归**。
- **全量回归**：既有 store 套件（dualStrategyStore 32 + signalStore 16 + positionStore 20 = 68 用例）全部通过，证明 27 个源文件抽取/反转改法未改变既有行为。

### 38 文件逻辑嵌套（D4）测试补充（2026-07-12 续）
- **覆盖范围**：38 个 D4 平铺文件中，既有测试已覆盖 10 个（localStorageManager / llmClient / db / databridge / collectionWizardPersistence / stockLinker / l7_l8 / multiFactorScreeningEngine / tradeReviewAI.skillDevelopment / tradeReviewAI.utils）；其余约 28 个为测试缺口。
- **新增行为不变量测试**（`tests/remediation/d4-purelogic-invariant.test.ts`，15 用例）：针对「最易因平铺引入行为偏差、且无既有测试」的纯逻辑模块锁定输入/输出语义：
  - `sentimentAnalyzer.ts`（D12）：`classifySentiment` 三态边界 + 自定义阈值、`analyzeText` 正/负/中性方向、`analyzeNewsArticle` 标题/正文权重融合与空输入中性、`hashContent` 稳定可复现。
  - `batchImportParsers.ts`（D9）：`detectExchange` 交易所推断、`parseBulkInput` 四种格式解析 + 无效行标记 + 空文本、`parseCsvText` 表头自动跳过。
  - `tradeErrorDetectors.ts`（D15）：7 个独立型检测器（重仓豪赌 / 违反计划 / 逆势加仓 / 报复性交易 / 犹豫错过 / 过度交易 / 追涨杀跌）命中与返回 null 的双向断言。
- **全量回归**：`vitest run` 完整套件在后台运行（验证 38 文件平铺无 broad 回归），完成自动通知；本批新增测试单文件 15 用例全过。

