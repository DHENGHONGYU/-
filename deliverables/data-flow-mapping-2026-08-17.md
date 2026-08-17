# FinSightV9 数据传递 / 数据跟踪 流程映射与缺口分析

> 日期：2026-08-17
> 目的：把用户定义的「数据传递 7 步」与「数据跟踪池生命周期」逐条锚定到 FinSightV9 现有模块，标注"已实现"与"语义缺口"，并给出落地建议。

## 一、数据传递（采集→评分→策略选股→复盘）

| # | 用户 spec | 现有模块 | 位置 | 状态 |
|---|-----------|----------|------|------|
| 1 | 数据采集 | `collectionPipeline.runSingleTrace` + `getQuoteWithConfig/getKlineWithConfig` | `src/services/data-collector/collectionPipeline.ts` | ✅ 已实现（前几轮已用 20 只剩跑通真实腾讯行情） |
| 2 | 采集数据存放 | `dataLayer` → IndexedDB `stocks` / `dailyQuotes` / `v6Scores` | `src/data/dataLayer*.ts`、`src/config/dbConfig.ts` | ✅ 已实现 |
| 3 | 存放数据调用评价分析 | `v6ScoreService.runV6Score`（11 层 layerDetails） | `src/services/scoring/v6ScoreService.ts` | ✅ 已实现 |
| 4 | **评分过低→启动校对程序，回溯相关处理方案** | `feedbackOrchestrator`（`detectIssues`→`triggerReCollection`→`triggerReScore`→`broadcastIssues`） | `src/core/feedbackOrchestrator.ts:95-417` | ⚠️ **语义缺口①**：现触发条件是「数据质量」（完整度<80% / 证据缺失 / 新鲜度违规 / 质量告警），**不是"评分值过低"**。spec 要求"评分过低"触发校对+回溯，需要显式接入 V6 score 阈值。 |
| 5 | 分析分数按交易策略筛选调整 | `strategyEngine.runStrategy` + `runDualStrategyUseCase` | `src/services/trading/strategyEngine.ts:43`、`src/services/useCase/runDualStrategy.useCase.ts:42` | ✅ 已实现 |
| 6 | 根据策略选股：核心 / 低价值洼地 / 热门 | `classify()` 产出 `core-scarce` / `value-bargain` / `hot-momentum` / `excluded`；`valuePitThresholds` 提供价值洼地五维阈值 | `src/services/trading/strategyEngine.ts:126-167`、`src/config/valuePitThresholds.ts` | ✅ 已实现（三分类与 spec 完全对应） |
| 7 | 股票复盘和跟踪 + 所有相关内容输出 | `AITradeReviewWidget`、`ChipStrategyReviewPage`、output cabin | `src/cockpit/widgets/AITradeReviewWidget.tsx`、`src/pages/output/ChipStrategyReviewPage.tsx` | ✅ 已实现（组件级，缺统一"全链路报告"编排） |

## 二、数据跟踪（池生命周期）

| # | 用户 spec | 现有模块 | 位置 | 状态 |
|---|-----------|----------|------|------|
| A | 意向股票采集池 | `IntentionPool`（`POOL_TYPE.intention`, `status:screening`） | `src/types/modules/pool.types.ts:24-44`、`src/constants/pool.constants.ts` | ✅ 已实现 |
| B | 经过股票筛选 | `poolTransitionEngine`（`screening→watchlist→research`） | `src/core/poolTransitionEngine.ts:27-111` | ✅ 已实现（合法流转受 `isValidTransition` 约束） |
| C | 纳入股票池 | `ResearchPool` / `PositionPool`（`POOL_TYPE.research/position`） | `src/types/modules/pool.types.ts:106-120` | ✅ 已实现 |
| D | 纳入长期观察池 | `dataLayerWatchlistStore` + `WatchlistWidget` | `src/data/dataLayerWatchlistStore.ts`、`src/cockpit/widgets/WatchlistWidget.tsx` | ✅ 已实现 |
| E | 股票池：复盘 + 分析校对 | `feedbackOrchestrator.checkAllStocks` + review widgets | `src/core/feedbackOrchestrator.ts:381`、`src/cockpit/widgets/*Review*.tsx` | ✅ 已实现（手动/事件触发） |
| F | 长期观察池：核心观察值 + 股票定期复盘校对分析 | 观察池数据容器存在，但**缺"定期自动化复盘调度"** | — | ⚠️ **语义缺口②**：没有把 `checkAllStocks` / 周期复盘挂到定时器/调度器（项目虽有 `cron`-类任务注册，但观察池的定期校对未接入） |

## 三、真实缺口（仅 2 处，其余已具备）

### 缺口①：评分过低 → 校对/回溯（step 4）
- 现状：`feedbackOrchestrator.detectIssues`（`src/core/feedbackOrchestrator.ts:146`）只检测 `incomplete_score / insufficient_evidence / stale_data / quality_warning`，**没有"score < 阈值"分支**。
- spec 要求："如果评分过低启动校对程序，回溯相关处理方案"。
- 落地做法：在 `detectIssues` 增加 `low_score` 类型（读取 `V6Score.score`，对照 `VALUE_PIT_THRESHOLDS.ACTION_WAIT_THRESHOLD` 或新增 `SCORE_CALIBRATION_THRESHOLD`），命中后同样走 `executeFeedbackLoop`（重采集→重评分→广播），并可额外记录"回溯处理方案"（哪一层分低、建议补哪类数据）。

### 缺口②：长期观察池定期自动化复盘（step F）
- 现状：`checkAllStocks`（`src/core/feedbackOrchestrator.ts:381`）可全量检查，但没有任何调度器周期性调用；观察池只有手动/事件驱动。
- spec 要求："对应数据的核心观察值及股票定期复盘校对分析"。
- 落地做法：新增一个轻量调度器（项目已有 rrule/定时任务注册机制，见 `AGENTS.md` L5 调度层），按日/周触发 `observationPoolReview`：对 watchlist 内标的跑 `feedbackOrchestrator.checkAndTrigger` + 生成"核心观察值快照"（最新价/估值分/技术层变化），落盘并推送。

## 四、可选增强（非缺口，提升闭环）
- **统一全链路报告编排**：现有模块各自独立，缺一个把"采集→评分→策略三分类→入池/观察池→定期复盘"串成单次可执行、产出整合报告（JSON+HTML）的 `ResearchPipelineOrchestrator`。前几轮的 `walkthrough-20stocks-real.integration.test.ts` 已验证前半段，可扩展后半段（入池+三分类+输出）。
- **真实估值层**：评分里的 pe/pb/marketCap 仍是 `MOCK_STOCK_LIBRARY` 参考值，接 Tushare/东财可让估值分真实。

## 五、结论
用户定义的完整投研闭环在 FinSightV9 中**约 90% 已实现**：采集、存放、V6 评分、策略三分类（核心/价值洼地/热门）、三分池生命周期、复盘/校对组件全部到位。仅 2 处语义缺口需补：
1. 显式"评分过低触发校对回溯"（step 4）
2. 长期观察池定期自动化复盘调度（step F）

下一步建议二选一或全做：补缺口①、补缺口②、或构建统一 `ResearchPipelineOrchestrator` 把全链路跑通并产出整合报告。
