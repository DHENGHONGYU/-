---
title: V9 智能投研复盘系统 - 审计警告报告
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计范围: 全量 `npm run audit` 执行结果 总警告数: 192 个（mapping-integrity: 100 + split-quality:..."
tags: [qa, audit, system, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 智能投研复盘系统 - 审计警告报告

> **Date**: 2026-07-12  
> **审计范围**: 全量 `npm run audit` 执行结果  
> **总警告数**: 192 个（mapping-integrity: 100 + split-quality: 92），typography 已修�?
---

## 目录

1. [概述](#概述)
2. [mapping-integrity 审计警告�?00 个）](#mapping-integrity-审计警告-100-�?
   - [路由注册完整性](#路由注册完整�?
   - [App分发器路由覆盖](#app分发器路由覆�?55�?
   - [Action→Store映射唯一性](#actionstore映射唯一�?5�?
   - [冗余Store检测](#冗余store检�?8�?
   - [EventBus事件订阅完整性](#eventbus事件订阅完整�?32�?
3. [split-quality 审计警告�?2 个）](#split-quality-审计警告-92-�?
   - [文件行数超限（AP-001）](#文件行数超限-ap-001)
   - [圈复杂度超限（AP-002）](#圈复杂度超限-ap-002)
   - [Core层依赖违规（AP-005）](#core层依赖违�?ap-005)
   - [函数重复定义（AP-007）](#函数重复定义-ap-007)
4. [typography 审计警告�? 个）](#typography-审计警告-2�?
5. [修复优先级建议](#修复优先级建�?
6. [趋势监控](#趋势监控)

---

## 概述

| 审计脚本 | 警告�?| 严重级别 | 状�?|
|---------|--------|---------|------|
| mapping-integrity | 100 | �?�?| 待修�?|
| split-quality | 92 | �?�?| 待修�?|
| typography | 0 | �?| �?已修�?|
| **合计** | **192** | - | - |

---

## mapping-integrity 审计警告�?00 个）

### 路由注册完整�?
�?**检查通过**  
- 发现 64 条路由注�?- 无重复路�?- 5 个舱室入口路由齐�?
### App分发器路由覆盖（55个）

> **问题描述**: 路由已在 `routes.ts` 中注册，但未在对应的 App 分发器中添加处理分支

| # | 路由路径 | 描述 | 所属舱�?|
|---|---------|------|---------|
| 1 | `/` | 首页 | PortalShell |
| 2 | `/cockpit` | 驾驶�?Dashboard | PortalShell |
| 3 | `/input/bulk-import` | 输入�?- 批量导入 | Input |
| 4 | `/input/hot-sectors` | 输入�?- 热门板块 | Input |
| 5 | `/input/data-test` | 输入�?- 采集测试 | Input |
| 6 | `/trading/flow` | 交易�?- 交易流程 | Trading |
| 7 | `/output/research` | 输出�?- 研究报告 | Output |
| 8 | `/output/review` | 输出�?- 交易复盘 | Output |
| 9 | `/output/export` | 输出�?- 数据导出 | Output |
| 10 | `/output/dashboard` | 输出�?- 仪表�?| Output |
| 11 | `/command/agents` | 智能体总控�?| Command |
| 12 | `/command/agents/registry` | 智能体注册表 | Command |
| 13 | `/command/agents/registry/:agentId` | 智能体详�?| Command |
| 14 | `/command/agents/trigger` | 智能体任务触�?| Command |
| 15 | `/command/agents/tasks` | 智能体任务列�?| Command |
| 16 | `/command/agents/custom` | 自定义智能体 | Command |
| 17 | `/command/agents/llm` | LLM 管理 | Command |
| 18 | `/command/agents/capability-graph` | 能力图谱 | Command |
| 19 | `/command/agents/dag-scheduler` | DAG 调度�?| Command |
| 20 | `/command/agents/feedback` | 反馈控制�?| Command |
| 21 | `/command/agents/model-upgrade` | 模型升级 | Command |
| 22 | `/command/agents/data-labels` | 数据标签管理 | Command |
| 23 | `/command/agents/api-config` | API 配置 | Command |
| 24 | `/command/agents/skill-audit` | Skill 核查 | Command |
| 25 | `/command/agents/optimization` | 优化建议 | Command |
| 26 | `/command/agents/changelog` | 更新日志 | Command |
| 27 | `/command/mcp-servers` | MCP Server 管理 | Command |
| 28 | `/command/showcase` | 组件示例�?| Command |
| 29 | `/command/health` | 架构健康度仪表盘 | Command |
| 30 | `/command/monitor` | 系统监控 | Command |
| 31 | `/command/config` | 配置管理 | Command |
| 32 | `/analysis/stock-score` | 个股九维评分分析 | Analysis |
| 33 | `/analysis/stock-score/:symbol` | 个股九维评分分析（带代码�?| Analysis |
| 34 | `/analysis/sector` | 行业与板块分�?| Analysis |
| 35 | `/analysis/backtest` | 策略回测 | Analysis |
| 36 | `/analysis/industry-score` | V4 行业评分 | Analysis |
| 37 | `/analysis/intelligent-score` | V6 个股智能评分 | Analysis |
| 38 | `/analysis/score-docs` | 评分文档版本�?| Analysis |
| 39 | `/analysis/news` | 智能资讯 | Analysis |
| 40 | `/analysis/score-comparison` | 历史评分比对看板 | Analysis |
| 41 | `/analysis/hot-sector` | 热门板块策略选股（五维评分） | Analysis |
| 42 | `/analysis/value-pit` | 价值洼地策略选股（五维评�?+ 轮动信号�?| Analysis |
| 43 | `/analysis/multi-factor` | 多因子筛选（条件组增�?/ 因子编辑 / 模板持久化） | Analysis |
| 44 | `/analysis/stock-pool` | 股票池看�?| Analysis |
| 45 | `/trading/strategy-snapshots` | 策略快照 | Trading |
| 46 | `/trading/holdings` | 交易持仓管理 | Trading |
| 47 | `/trading/execution-plans` | 执行计划管理 | Trading |
| 48 | `/trading/execution` | 执行管理（别�?�?execution-plans�?| Trading |
| 49 | `/trading/portfolio` | 投资组合管理 | Trading |
| 50 | `/trading/risk` | 风险控制管理 | Trading |
| 51 | `/input/local-knowledge` | 本地知识�?| Input |
| 52 | `/input/seven-dim` | 七维采集策略配置 | Input |
| 53 | `/input/fetcher-config` | 抓取引擎配置 | Input |
| 54 | `/input/collect-tasks` | 采集任务监控 | Input |
| 55 | `/mock-test` | V9 模块 Mock 验证�?| Mock |

**修复建议**: 在对应的 `src/apps/{cabin}/{Cabin}App.tsx` 文件中添加路由匹配分�?
### Action→Store映射唯一性（5个）

> **问题描述**: ENVELOPE_ACTION 中定义的 Action 未在 ACTION_TO_STORE_MAP 中映射到 Store

| # | Action名称 | 修复建议 |
|---|-----------|---------|
| 1 | `feedbackIssuesDetected` | �?`src/core/databridge.ts` �?ACTION_TO_STORE_MAP 中添加映�?|
| 2 | `deleteRbacAuditLog` | �?`src/core/databridge.ts` �?ACTION_TO_STORE_MAP 中添加映�?|
| 3 | `queryGet` | �?`src/core/databridge.ts` �?ACTION_TO_STORE_MAP 中添加映�?|
| 4 | `queryList` | �?`src/core/databridge.ts` �?ACTION_TO_STORE_MAP 中添加映�?|
| 5 | `queryByIndex` | �?`src/core/databridge.ts` �?ACTION_TO_STORE_MAP 中添加映�?|

### 冗余Store检测（8个）

> **问题描述**: 以下 Store 未被任何 UI 层代码直接引用，也未通过传递可达性被标记�?used

| # | Store名称 | Hook名称 | 状�?|
|---|-----------|---------|------|
| 1 | `analysisHubStore` | - | 未使�?|
| 2 | `chatStore` | - | 未使�?|
| 3 | `databridgeStore` | `useDataBridgeStore` | 未使�?|
| 4 | `dataflowStore` | - | 未使�?|
| 5 | `hybridProofreadStore` | - | 未使�?|
| 6 | `rotationSignalStore` | - | 未使�?|
| 7 | `tradingHubStore` | - | 未使�?|
| 8 | `widgetStore` | - | 未使�?|

**需人工复核�?Store�?个）**:

| Store名称 | 依赖来源 | 说明 |
|-----------|---------|------|
| `signalAdviceStore` | `tradingStore` | 仅通过 Facade 传递可�?|
| `watchlistStore` | `tradingStore` | 仅通过 Facade 传递可�?|

**修复建议**: 
- 确认这些 Store 是否仍有业务价�?- 若无价值，考虑删除或标记为 `@deprecated`
- 若有价值，检查为何没�?UI 层直接消费�?
### EventBus事件订阅完整性（32个）

#### 事件发布但从未订阅（13个）

| # | 事件名称 | 发布位置 | 修复建议 |
|---|---------|---------|---------|
| 1 | `DATABRIDGE_PENDING_CHANGED` | DataBridge | 添加订阅者或移除发布 |
| 2 | `DATABRIDGE_QUERY_FAILED` | DataBridge | 添加订阅者或移除发布 |
| 3 | `FEEDBACK_MESSAGE` | Feedback | 添加订阅者或移除发布 |
| 4 | `rbac:permission-revoked` | RBAC | 添加订阅者或移除发布 |
| 5 | `rbac:user-status-changed` | RBAC | 添加订阅者或移除发布 |
| 6 | `rbac:user-created` | RBAC | 添加订阅者或移除发布 |
| 7 | `rbac:user-updated` | RBAC | 添加订阅者或移除发布 |
| 8 | `rbac:user-deleted` | RBAC | 添加订阅者或移除发布 |
| 9 | `rbac:role-granted` | RBAC | 添加订阅者或移除发布 |
| 10 | `rbac:role-revoked` | RBAC | 添加订阅者或移除发布 |
| 11 | `HOT_SECTOR_CHANGED` | Hot Sector | 添加订阅者或移除发布 |
| 12 | `VALUE_PIT_CHANGED` | Value Pit | 添加订阅者或移除发布 |
| 13 | `ROTATION_SIGNAL_TRIGGERED` | Rotation | 添加订阅者或移除发布 |

#### 事件订阅但从未发布（19个）

| # | 事件名称 | 订阅位置 | 修复建议 |
|---|---------|---------|---------|
| 1 | `AGENT_REGISTERED` | Agent | 添加发布者或移除订阅 |
| 2 | `AGENT_TASK_STARTED` | Agent | 添加发布者或移除订阅 |
| 3 | `AGENT_TASK_COMPLETED` | Agent | 添加发布者或移除订阅 |
| 4 | `AGENT_TASK_FAILED` | Agent | 添加发布者或移除订阅 |
| 5 | `AGENT_TASK_TIMEOUT` | Agent | 添加发布者或移除订阅 |
| 6 | `AGENT_TASK_CANCELLED` | Agent | 添加发布者或移除订阅 |
| 7 | `PAGE_DATA_LOADED` | Page | 添加发布者或移除订阅 |
| 8 | `PAGE_ERROR` | Page | 添加发布者或移除订阅 |
| 9 | `PAGE_RESET` | Page | 添加发布者或移除订阅 |
| 10 | `ORDERS_CHANGED` | Trading | 添加发布者或移除订阅 |
| 11 | `V6_SCORES_CHANGED` | Scoring | 添加发布者或移除订阅 |
| 12 | `SYSTEM_MONITOR_SNAPSHOT` | Monitor | 添加发布者或移除订阅 |
| 13 | `AGENT_HEALTH_CRITICAL` | Agent | 添加发布者或移除订阅 |
| 14 | `AGENT_HEALTH_WARNING` | Agent | 添加发布者或移除订阅 |
| 15 | `WIDGET_MOUNT_SUCCESS` | Widget | 添加发布者或移除订阅 |
| 16 | `WIDGET_UNMOUNT` | Widget | 添加发布者或移除订阅 |
| 17 | `WIDGET_REFRESH_SUCCESS` | Widget | 添加发布者或移除订阅 |
| 18 | `WIDGET_MOUNT_ERROR` | Widget | 添加发布者或移除订阅 |
| 19 | `ENGINE_STORE_STARTED_CHANGED` | Engine | 添加发布者或移除订阅 |

---

## split-quality 审计警告�?2个）

### 文件行数超限（AP-001�?
> **阈�?*: services �?500 行，其他�?800 �?
| # | 文件路径 | 行数 | 阈�?| 严重级别 |
|---|---------|------|------|---------|
| 1 | `src/data/dataLayer.test.ts` | 1684 | 800 | Major |
| 2 | `src/data/sectorSkillData.ts` | 879 | 800 | Major |
| 3 | `src/pages/command/agent/LlmManagement/index.tsx` | 1044 | 800 | Major |
| 4 | `src/pages/input/CollectTask/index.tsx` | 896 | 800 | Major |
| 5 | `src/services/analysis/scoreDocService.ts` | 571 | 500 | Major |
| 6 | `src/services/backtest/BacktestEngine.test.ts` | 1045 | 500 | Major |
| 7 | `src/services/collection/collectionWizardPersistence.test.ts` | 524 | 500 | Major |
| 8 | `src/services/data-collector/collectionPipeline.ts` | 612 | 500 | Major |
| 9 | `src/services/data-collector/dataSourceOrchestrator.ts` | 730 | 500 | Major |
| 10 | `src/services/data-collector/MarketDataAdapter.ts` | 558 | 500 | Major |
| 11 | `src/services/data-collector/mockDataCollection.ts` | 1040 | 500 | Major |
| 12 | `src/services/fetcher/directDataAPI.ts` | 635 | 500 | Major |
| 13 | `src/services/fetcher/strategyDataAdapter.normalize.test.ts` | 631 | 500 | Major |
| 14 | `src/services/input/batchImportParsers.ts` | 572 | 500 | Major |
| 15 | `src/services/llm/llmClient.multimodel.test.ts` | 564 | 500 | Major |
| 16 | `src/services/rbac/permissionRevocationService.ts` | 978 | 500 | Major |
| 17 | `src/services/rbac/rbacManagementService.ts` | 676 | 500 | Major |
| 18 | `src/services/scoring/v6-engine/v6-engine.test.ts` | 542 | 500 | Major |
| 19 | `src/services/scoring/valuePitAnalyzer.ts` | 508 | 500 | Major |
| 20 | `src/services/system/migration/migrationTransformers.ts` | 615 | 500 | Major |
| 21 | `src/services/unifiedStockService.test.ts` | 577 | 500 | Major |
| 22 | `src/services/useCase/createExecutionPlan.useCase.test.ts` | 793 | 500 | Major |
| 23 | `src/store/dualStrategyStore.test.ts` | 814 | 800 | Major |
| 24 | `src/store/orderStore.test.ts` | 1040 | 800 | Major |

### 圈复杂度超限（AP-002�?
> **阈�?*: 40

| # | 文件路径 | CC�?| 严重级别 |
|---|---------|------|---------|
| 1 | `src/components/cabin/IntelligentScoreBasisCard.tsx` | 54 | Major |
| 2 | `src/components/organisms/input/CollectionSwimlane.tsx` | 44 | Major |
| 3 | `src/core/databridge.ts` | 83 | Major |
| 4 | `src/core/dataflow/dataflowEngine.ts` | 57 | Major |
| 5 | `src/core/entityValidators.ts` | 46 | Major |
| 6 | `src/core/pipelineScheduler.ts` | 45 | Major |
| 7 | `src/data/db.ts` | 48 | Major |
| 8 | `src/lib/localStorageManager.ts` | 53 | Major |
| 9 | `src/pages/analysis/IntelligentScorePage.tsx` | 41 | Major |
| 10 | `src/pages/command/agent/CustomAgentPage.tsx` | 44 | Major |
| 11 | `src/pages/command/agent/LlmManagement/index.tsx` | 89 | Major |
| 12 | `src/pages/input/CollectTask/index.tsx` | 62 | Major |
| 13 | `src/pages/trading/TradingFlowPage.tsx` | 43 | Major |
| 14 | `src/services/analysis/rotationScoreService.ts` | 44 | Major |
| 15 | `src/services/analysis/scoreDocService.ts` | 114 | Major |
| 16 | `src/services/data-collector/dataSourceOrchestrator.ts` | 58 | Major |
| 17 | `src/services/data-collector/directDataAPI.ts` | 42 | Major |
| 18 | `src/services/data-collector/MarketDataAdapter.ts` | 353 | Major |
| 19 | `src/services/data-collector/mockDataCollection.ts` | 76 | Major |
| 20 | `src/services/export/backtestExportService.ts` | 53 | Major |
| 21 | `src/services/feedbackService.ts` | 45 | Major |
| 22 | `src/services/fetcher/directDataAPI.ts` | 109 | Major |
| 23 | `src/services/fetcher/fetcherService.ts` | 73 | Major |
| 24 | `src/services/hybrid-proofread/reportGenerator.ts` | 44 | Major |
| 25 | `src/services/input/batchImportParsers.ts` | 88 | Major |
| 26 | `src/services/llm/llmClient.ts` | 85 | Major |
| 27 | `src/services/news/newsService.ts` | 45 | Major |
| 28 | `src/services/news/stockLinker.ts` | 58 | Major |
| 29 | `src/services/rbac/permissionRevocationService.ts` | 48 | Major |
| 30 | `src/services/rbac/rbacManagementService.ts` | 62 | Major |
| 31 | `src/services/resilience.ts` | 48 | Major |
| 32 | `src/services/scoring/hotSectorDimensions.ts` | 57 | Major |
| 33 | `src/services/scoring/hotSectorOrchestrator.ts` | 47 | Major |
| 34 | `src/services/scoring/intelligentScoreService.ts` | 48 | Major |
| 35 | `src/services/scoring/rotationSignalDetector.ts` | 52 | Major |
| 36 | `src/services/scoring/v6-engine/calculators/l0_l1_l2.ts` | 114 | Major |
| 37 | `src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts` | 57 | Major |
| 38 | `src/services/scoring/v6-engine/calculators/l4_l5_l6.ts` | 64 | Major |
| 39 | `src/services/scoring/v6-engine/calculators/l7_l8.ts` | 76 | Major |
| 40 | `src/services/scoring/v6-engine/enhancer.ts` | 51 | Major |
| 41 | `src/services/scoring/valuePitAnalyzer.ts` | 102 | Major |
| 42 | `src/services/screening/multiFactorScreeningEngine.ts` | 52 | Major |
| 43 | `src/services/system/localDocService.ts` | 48 | Major |
| 44 | `src/services/system/migration/migrationTransformers.ts` | 212 | Major |
| 45 | `src/services/system/monitorLogService.ts` | 42 | Major |
| 46 | `src/services/trading/portfolioBuilder.ts` | 47 | Major |
| 47 | `src/services/trading/scoringAdapter.ts` | 60 | Major |
| 48 | `src/services/trading/strategyEngine.ts` | 48 | Major |
| 49 | `src/services/trading/strategySnapshotService.ts` | 61 | Major |
| 50 | `src/services/trading/tradeErrorDetectors.ts` | 48 | Major |
| 51 | `src/services/useCase/createExecutionPlan.useCase.test.ts` | 88 | Major |
| 52 | `src/store/collectionRuntimeStore.ts` | 43 | Major |
| 53 | `src/store/dualStrategyStore.ts` | 42 | Major |
| 54 | `src/store/executionStore.ts` | 59 | Major |
| 55 | `src/store/intelligentScoreStore.ts` | 42 | Major |
| 56 | `src/store/poolStore.test.ts` | 45 | Major |
| 57 | `src/store/scoreDocStore.ts` | 61 | Major |
| 58 | `src/store/sevenDimConfigStore.ts` | 41 | Major |
| 59 | `src/store/strategySnapshotStore.ts` | 49 | Major |
| 60 | `src/lib/validation.ts` | 46 | Major |

**最严重的文件（CC > 100�?*:

| 文件 | CC�?| 修复优先�?|
|------|------|-----------|
| `src/services/scoring/v6-engine/calculators/l0_l1_l2.ts` | 114 | P0 |
| `src/services/analysis/scoreDocService.ts` | 114 | P0 |
| `src/services/fetcher/directDataAPI.ts` | 109 | P0 |
| `src/services/scoring/valuePitAnalyzer.ts` | 102 | P0 |
| `src/services/data-collector/MarketDataAdapter.ts` | 353 | P0（极高） |
| `src/services/system/migration/migrationTransformers.ts` | 212 | P0（极高） |

### Core层依赖违规（AP-005�?
> **问题描述**: core 层禁止直�?import services 层，违反依赖注入解耦原�?
| # | 文件路径 | 行号 | 违规导入 |
|---|---------|------|---------|
| 1 | `src/core/databridgeStrategyRouter.ts` | 16 | `@/services/scoring/hotSectorAnalyzer` |
| 2 | `src/core/databridgeStrategyRouter.ts` | 17 | `@/services/scoring/rotationSignalDetector` |
| 3 | `src/core/databridgeStrategyRouter.ts` | 18 | `@/services/scoring/valuePitAnalyzer` |
| 4 | `src/core/feedbackOrchestrator.test.ts` | 4 | `@/services/scoring/v6ScoreService` |
| 5 | `src/core/feedbackOrchestrator.test.ts` | 5 | `@/services/fetcher/fetcherService` |
| 6 | `src/core/feedbackOrchestrator.ts` | 25 | `@/services/scoring/v6ScoreService` |
| 7 | `src/core/feedbackOrchestrator.ts` | 26 | `@/services/fetcher/fetcherService` |
| 8 | `src/core/pipelineScheduler.ts` | 20 | `@/services/scoring/v6ScoreService` |

**修复建议**: 通过接口注入方式解耦，�?services 层在 `main.tsx` 启动时注册实�?
### 函数重复定义（AP-007�?
> **问题描述**: 相同函数在多个文件中重复定义，建议合并为单一来源

| # | 函数�?| 重复位置 | 修复建议 |
|---|-------|---------|---------|
| 1 | `generateId` | `src/data/db-utils.ts`, `src/lib/validation.ts` | 合并到单一位置 |
| 2 | `now` | `src/data/db-utils.ts`, `src/lib/format.ts` | 合并到单一位置 |
| 3 | `formatIndustryDelta` | `src/hooks/cabin/useIndustryScorePage.ts`, `src/store/industryScoreStore.ts` | 合并到单一位置 |
| 4 | `formatIntelligentDelta` | `src/hooks/cabin/useIntelligentScorePage.ts`, `src/store/intelligentScoreStore.ts` | 合并到单一位置 |
| 5 | `toSafeNumber` | `src/lib/safeCoerce.ts`, `src/services/fetcher/strategyDataAdapter.ts` | 合并到单一位置 |
| 6 | `toSafeBoolean` | `src/lib/safeCoerce.ts`, `src/services/fetcher/strategyDataAdapter.ts` | 合并到单一位置 |
| 7 | `bySector` | `src/store/hotSectorStore.ts`, `src/store/rotationSignalStore.derived.ts` | 合并到单一位置 |

---

## typography 审计警告（已修复�?
�?**检查通过** - 所有硬编码字体值已修复

**修复详情**:
| # | 文件路径 | 行号 | 修复�?| 修复�?|
|---|---------|------|--------|--------|
| 1 | `src/services/hybrid-proofread/reportGenerator.ts` | 335 | `font-size: 2rem; font-weight: bold;` | `font-size: 24px; font-weight: 700;` |
| 2 | `src/services/hybrid-proofread/reportGenerator.ts` | 336 | `font-size: 0.875rem;` | `font-size: 13px;` |
| 3 | `src/services/hybrid-proofread/reportGenerator.ts` | 2 | - | 新增 `TYPOGRAPHY_SCALE` 导入 |

**修复脚本**: `scripts/fix-typography-violations.ts`  
**验证**: `npx tsx scripts/audit-typography.ts` �?�?通过

---

## 修复优先级建�?
### P0 - 立即修复（架构风险）

| 类别 | 数量 | 说明 |
|------|------|------|
| Core层依赖违�?| 8 | 违反分层架构原则，阻断解�?|
| 超高圈复杂度（CC > 200�?| 2 | `MarketDataAdapter.ts`(353), `migrationTransformers.ts`(212) |

### P1 - 近期修复（代码质量）

| 类别 | 数量 | 说明 | 状�?|
|------|------|------|------|
| 高圈复杂度（CC > 100�?| 4 | 影响可维护性和测试 | 待修�?|
| 函数重复定义 | 7 | 违反 DRY 原则 | 待修�?|
| 硬编码字�?| 0 | 违反设计系统规范 | �?已修�?|

### P2 - 持续改进（技术债务�?
| 类别 | 数量 | 说明 |
|------|------|------|
| 文件行数超限 | 24 | 影响代码可读�?|
| 中等圈复杂度（CC 40-100�?| 54 | 渐进式重�?|
| 冗余Store | 8 | 需确认业务价�?|
| EventBus事件不匹�?| 32 | 需确认架构设计 |
| App分发器路由覆�?| 55 | 需确认路由设计 |

---

## 趋势监控

后续将通过自动化脚�?`scripts/audit-trend-monitor.ts` 定期扫描并记录这些警告项的变化趋势。监控指标包括：

- 总警告数变化
- 各审计脚本警告数变化
- 按严重级别统�?- 按规则类型统�?
趋势数据将存储在 `docs/reports/audit/trends/` 目录，支持：
- 每日定时扫描
- 手动触发扫描
- 趋势报告生成
- 历史数据对比

---

**生成工具**: V9 审计系统  
**最后更�?*: 2026-07-12