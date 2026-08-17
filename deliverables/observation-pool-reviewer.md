# 观察池定期自动复盘调度器（投研编排器 spec 缺口②）闭环

> 日期：2026-08-17 ｜ 关联模块：`src/services/orchestration/researchPipelineOrchestrator.ts` 缺口②
> 前置：五段链路存储兜底已全覆盖；统一全链路编排器已完成策略三分类（核心/价值洼地/热门），但「观察池」在 `intention.watchlist` 落地后即沦为死列表——无人跟踪评分变化、无人判断是否达到研究池门槛。

## 1. 交付内容

新增 `src/services/orchestration/observationPoolReviewer.ts`：

- **`reviewObservationPool` 能力（`ObservationPoolReviewer.run(deps)`）**
  - 注入 `getWatchlist()`（默认读 `getWatchlistStocks` → `status=watching` 的观察池标的）与 `PipelineScorer`（默认 `runV6Score`）。
  - 对每只观察池标的重新执行 V6 评分，与**上次复盘内存快照**比较，计算 `scoreDelta`（评分漂移）。
  - 判定 `meetsResearchThreshold`（`currentScore >= promotionThreshold`，V6 0-5 尺度，默认 3.0）与 `promotionEligible`（达门槛 且 当前不在研究池，由可选 `isInResearchPool` 排除）。
  - 产出 `recommendation`：`promote` / `hold` / `watch`。
- **`ObservationPoolReviewScheduler` 类**（`start`/`stop`/`configure`/`manualTrigger`）
  - 对齐 `WeeklyReviewScheduler` 模式：快照存内存、结果经 `eventBus` 广播 `OBSERVATION_REVIEW_COMPLETED`、支持手动触发与定时调度（`intervalMs` 默认 24h，`enabled` 默认 false）。

## 2. 生产接线（消除孤儿引擎）

- `src/constants/store-channels.constants.ts`：新增事件 `OBSERVATION_REVIEW_COMPLETED: 'observation:review:completed'`。
- `src/services/orchestration/index.ts`：导出新模块；在 `buildOrchestratorList` / `stopOrchestration` 注册，默认 `enabled:false` 并注入真实依赖（`getWatchlistStocks` + `runV6Score`），与 `WeeklyReviewScheduler` 保持一致的启动清单治理。

## 3. 验证

- 单元测试 `src/services/orchestration/observationPoolReviewer.test.ts`（4 例全绿）：
  1. 晋升候选判定 + 首次无历史快照；
  2. 二次复盘评分漂移计算 + 事件广播；
  3. 已入研究池的标的即使达门槛也不标记晋升；
  4. 定时调度：启用后按间隔自动复盘，`start` 不立即执行。
- **mandatory 门禁**（本任务相关）：
  - `audit:layers` = 0 违规
  - `audit:acl-consistency` = 0/0
  - `validate:dataConsistency` = 0 警告/0 错误
  - `validate:blueprint` = ✅（store 数量未受影响）
  - `tsc:prod`：**本任务代码零类型错误**（`index.ts` / `observationPoolReviewer.ts` 不在错误清单）。

## 4. 已知边界 / 非本任务范围

- **快照内存态**：上次复盘快照存于调度器实例内存，重启即清（与 `WeeklyReviewScheduler` 一致）；若需跨重启保留，后续可落 `screening_results` 或新增 `observation_reviews` store（遵循既有存储兜底范式）。
- **`tsc:prod` 当前红线来源**：仓库当前存在**并发 Agent 正在修改的未提交文件**（`src/components/chart/shared.config.ts` 颜色令牌 SoT、`src/apps/command/ConfigApp.tsx` 与 `OutputApp.tsx` 的 `LogContext` 日志签名等 10 处），与本次缺口②无关，且错误集在多次运行间浮动（15→10），属他人在途产物。按项目约定未擅改他人未提交代码；本次交付本身类型干净。

## 5. 使用方式

- 生产启用定时：在 `startObservationPoolReviewer({ enabled: true, intervalMs, promotionThreshold })` 时传入 `enabled:true`（默认 false）。
- 手动触发一次：`getObservationPoolReviewer().manualTrigger()`（依赖已随 `initOrchestration` 配置）。
- 订阅复盘结果：`eventBus.on(EVENT_NAMES.OBSERVATION_REVIEW_COMPLETED, result => …)`，消费 `result.promotionCandidates` 决定观察池→研究池晋升动作。
