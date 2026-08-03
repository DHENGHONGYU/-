---
title: data-dictionary-index
type: reference
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "所有 DATA_DEFINITION* 文档的唯一索引（Single Source of Truth），消除「10 份 DATA_DEFINITION 重复」的双向一致性落差。"
tags: [data, data-definition, registry, reference, store]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-017
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-122, V9-DOC-PROJ-176, V9-DOC-PROJ-182]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 数据字典索引（DATA_DICTIONARY_INDEX）

> **定位**：所有 `DATA_DEFINITION*` 文档的**唯一索引**（Single Source of Truth），消除「10 份 DATA_DEFINITION 重复」的双向一致性落差。
> **状态**：? P0 新增索引；? 2026-07-12 **同名 3 份已合并为 1 份主字典**（整合版 v2.0.0）。
> **实测（2026-07-12）**：共 10 个匹配文件 = **1 个整合主字典** + **7 个独立域定义**（另 2 份同名源文件合并后已移除）。

---

## 1. 核心定义（整合主字典）

> 三份同名 `data-definition.md`（交易持仓管理 / 数据采集 / Cockpit Widget 框架）已于 2026-07-12 整合为**单一主数据字典**，按模块分区保留全部内容，共享采集类型在 §B 统一定义、§C 引用去重。

| 文件 | 字节 | 角色 | 状态 |
|------|------|------|------|
| `./data-definition.md` | 整合版 v2.0.0 | **唯一主字典（SSOT）** | ? 现行 |
| `./data-definition.md`（根，交易持仓） | 13337 | 源文件（mtime 2026-07-08） | ?? 已并入主字典后 `git rm` |
| `./data-definition.md`（数据采集） | 13827 | 源文件（mtime 2026-07-08） | ?? 已并入主字典后移除（untracked） |
| `./data-definition.md`（Cockpit Widget） | 26654 | 源文件（mtime 2026-07-06） | ?? 已并入主字典后移除（untracked） |

> **整合基线**：以最新更新时间（mtime 2026-07-08）的采集类型版本为准（数据采集 v1.2.0 与 Cockpit v1.2.0 内容一致，无字段冲突）；Cockpit 专有内容（v1.2.0 / 2026-07-06）作为补充并入。详见主字典「§0 整合来源对照表」。

## 2. 独立域定义（命名规范 `*-data-definition.md`，合法，保留）

| 文件 | 归属子域 | 内容 |
|------|----------|------|
| `docs/explanation/ai-center-data-definition.md` | ai-center | AI 中心数据结构 |
| `docs/explanation/dataflow-data-definition.md` | dataflow | 数据流定义 |
| `docs/explanation/multi-factor-screening-data-definition.md` | screening | 多因子筛选 |
| `docs/explanation/news-data-definition.md` | news | 新闻资讯 |
| `docs/explanation/seven-dim-config-data-definition.md` | seven-dim-config | 七维配置 |
| `docs/reference/backtest-data-definition.md` | backtest | 回测数据 |
| `docs/reference/risk-derived-data-definition.md` | risk | 衍生风险 |

> **整合状态**：7 份独立域定义已全部登记，保持独立存在以避免过度合并导致维护困难。
> **引用规范**：新增域定义统一 `kebab-case` + `./data-definition.md` 后缀，并必须在此索引登记。

## 3. 统一数据模型锚点

- **`UnifiedStockData`**：数据融合统一契约，由 `unifiedStockService` 产出，被 `store/*` 与各页面消费。
- 字段级定义一律先查本索引 → 再进入对应文件，**禁止在别处新建副本**。

## 4. 命名约定（GOVERNANCE 对齐）

- 新增域定义统一 `kebab-case` + `./data-definition.md` 后缀，并**必须**在此索引登记。
- 禁止再创建裸名 `data-definition.md`（避免同名冲突复发）。

## 5. 验收

- ? 唯一索引已建立，所有 `DATA_DEFINITION*` 均被引用。
- ? **同名 3 份已合并为 1 份主字典**（目标达成：裸名 `data-definition.md` 仅 `docs/guides/standards/` 一处）。
- ? 整合主字典已纳入 `docs/README.md` D 类 / `../00-meta/GOVERNANCE.md` 引用。
- ? 新增按域拆分数据字典仍须带域前缀命名并登记于此索引（见 §4）。


<!-- merge-source: docs/explanation/design/data-dictionary-index.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `docs/explanation/design/data-dictionary-index.md`）

# V9 数据字典索引
> 本文档汇总 V9 项目所有模块级数据字典入口，便于快速查找字段定义、枚举值、服务 API 与 DataBridge 映射。
| 模块 | 数据字典 | 源码入口 | 覆盖范围 |
| 交易持仓管理 | `data-definition.md`（根目录）、`./api-contract.md` | `src/pages/trading/`、`src/types/modules/trade.types.ts`、`src/constants/trade.constants.ts`、`src/store/holdingsStore.ts` | 持仓明细、查询参数、交易操作、分页/筛选状态、Store 状态管理（Zustand） |
| 智能资讯中心（NewsPage） | `./news-contract.md`、`./data-definition.md` | `src/pages/analysis/`、`src/services/news/`、`src/data/types.ts`、`src/store/analysisNewsStore.ts` | `NewsArticle`、`NewsStockMap`、`SentimentCache`、V6/V9 适配、路由、Store 状态管理（Zustand） |
| AI 智能体调度中心 / 健康监控 / 诊断分析 | `./ai-center-data-definition.md` | `src/constants/ai-center.constants.ts`、`src/constants/health.constants.ts`、`src/types/modules/ai-center.types.ts`、`src/services/ai-center/` | Agent、健康指标、诊断报告、统一 `AICenterData` |
| 金融业务驾驶舱 Widget | `data-definition.md`（根目录，§2~§5）、`./data-definition.md` | `src/cockpit/widgets/`、`src/services/stock-analysis/`、`src/services/data-collector/`、`src/types/modules/widget.types.ts`、`src/store/widgetStore.ts` | 投资画像、股票池、KAI 评分、模型对比、聊天界面、Widget 实例管理 |
| 三层模块注册体系 | `./registry-index.md` | ~~`src/store/derived.index.ts`~~（已删除，待重建）、`src/components/componentRegistry.ts`、`src/cockpit/core/widgetRegistry.ts` | ~~Store 注册表（29 条目）~~（已删除，待重建）、Component 注册表（10+ 条目）、Widget 注册表（21 条目），按域/状态查询，统计函数 |
| UseCase 用例层 | 内联类型定义 | `src/services/useCase/createExecutionPlan.useCase.ts`、`src/services/useCase/createExecutionPlan.useCase.ts`、`src/services/useCase/fetchSectorAnalysis.useCase.ts`、`src/services/useCase/fetcherOrchestrator.useCase.ts`、`src/services/useCase/generateTradeReview.useCase.ts`、`src/services/useCase/getUnifiedStockView.useCase.ts`、`src/services/useCase/hotSectorQuery.useCase.ts`、`src/services/useCase/rebalancePortfolio.useCase.ts`、`src/services/useCase/runDualStrategy.useCase.ts`、`src/services/trading/strategySnapshotService.ts`、`src/services/trading/tradingService.ts` | `CreateExecutionPlanInput`/`CreateExecutionPlanResult`、`ExecutePlanContext`/`ExecutePlanResult`、`FetchSectorAnalysisInput`/`FetchSectorAnalysisResult`、`FetchBasicDataInput`/`FetchKlineDataInput`、`TradeReviewReport`（引用自 `tradeReviewAI.types.ts`）、`UnifiedStockView`/`FusionOptions`、`HotSectorQueryInput`/`HotSectorQueryResult`、`RebalanceOptions`、`RunDualStrategyInput`、`SaveStrategySnapshotInput`/`SaveStrategySnapshotResult`、`SubmitOrderInput`/`SubmitOrderResult` |
| 交易计算纯函数 | 内联类型定义 | `src/services/trading/positionComputer.ts`、`src/services/trading/pnlComputer.ts`、`src/services/trading/riskComputer.ts` | `MatchedTradePair`、`TradePair`、`PositionItem`、`PnLSummary`、`RiskMetrics` |
| 交易引擎（信号/仓位/风控） | 内联类型定义 | `src/services/trading/signalGenerator.ts`、`src/services/trading/positionSizer.ts`、`src/services/trading/riskEngine.ts` | `TradingSignal`（= `Signal`）、`SignalSnapshot`、`SignalDirection`、`PositionSizingInput`/`PositionSizingResult`、`OrderRiskInput`/`RiskCheckResult` |
| 股票池分组 | 内联类型定义 | `src/data/types.ts`（`PoolGroupMeta`）、`src/config/dbConfig.ts`（`DEFAULT_POOL_GROUP`）、`src/store/poolStore.test.ts`（`PoolState`） | `PoolGroupMeta`、`DEFAULT_POOL_GROUP`、`PoolState`（含 `stocks`/`loading`/`error`/`isRefreshing`/`lastUpdated`）、`Stock.group` 字段 |
| 混合校对模块（Hybrid Proofread） | `src/data/types/types.hybridProofread.ts` | `src/services/hybrid-proofread/`（cloudSyncClient/hashService/localCollector/reportGenerator/ruleEngine/index）、`src/config/hybridProofreadConfig.ts`、`src/store/hybridProofreadStore.ts` | `FileHash`、`RuleConfig`、`RuleMatchResult`、`LocalScanResult`、`CloudRiskResult`、`ProofreadReport`、`RiskDetail`、`RulesSyncResult`、`HashVerifyRequest/Response`、`HashBatchVerifyRequest/Response`、`RiskDetailsRequest/Response`、`PerformanceMetric` |
| Store 派生计算 | `src/store/*.derived.ts` | `src/store/analysisStore.derived.ts`（22函数）、`src/store/chatStore.derived.ts`（23函数）、`src/store/riskStore.derived.ts`（22函数）、`src/store/signalQualityStore.derived.ts`（30函数） | 派生查询函数、类型定义（ScoreLevelDistribution/SymbolRiskStats等）、缓存策略（memoizeByRef）、React Hooks |
| Store 事件订阅 | `src/store/executionStoreSubscriptions.ts` | initExecutionStoreSubscriptions、_handleSignalEnvelope、_handleOrderEnvelope、_debouncedRefresh | DataBridge 订阅管理、事件驱动架构、100ms 防抖机制 |
| 全局错误处理 | `src/components/organisms/shared/installGlobalErrorHandler.ts` | installGlobalErrorHandler | window.error 事件、unhandledrejection 事件、错误总线集成 |
| UI 基础组件 | `src/components/ui/` | `src/components/templates/PageContainer.tsx`（页面容器）、`src/components/templates/PageHeader.tsx`（页面页头） | 页面布局一致性、排版阶梯、操作区布局 |
| 派生缓存工具 | `src/lib/derivedCache.ts` | memoizeByRef、memoizeByKey、buildIndex、safeLength、safeDivide、average | 派生查询记忆化缓存、性能优化、VERBOSE 日志埋点 |
| 本地存储加密 | `src/lib/localStorageCrypto.ts` | getOrCreateCryptoKey、generateIv、arrayBufferToBase64、base64ToArrayBuffer | AES-GCM 256 加密、CryptoKey 派生、安全策略 STOR-001 |
| 错误总线 | `src/services/errorBus.ts` | captureError、onErrorCaptured、ERROR_CAPTURED_EVENT | 统一错误捕获、V9Error 收敛、全局错误总线 |
| 韧性工具 | `src/services/resilience.ts` | withRetry、createCircuitBreaker、withFallback、withResilience | 指数退避重试、熔断保护器、失败降级、一站式封装 |
| 确认对话框 Hook | `src/hooks/useConfirmDialog.tsx` | useConfirmDialog（confirm、ConfirmDialog） | 命令式确认对话框、替代 window.confirm、Promise 式 API |
| 板块常量 | `src/constants/sectorConstants.ts` | HOT_TRACKS（15 条热门赛道） | 板块分类、热门赛道标签、热力等级 |
| 类型/常量文件 | 说明 | 被哪些字典引用 |
| `src/data/types.ts` | 全局数据类型：`Stock`、`Order`、`Portfolio`、`NewsArticle`、`NewsStockMap`、`SentimentCache` 等 | News、Trade、Widget 字典 |
| `src/config/dbConfig.ts` | IndexedDB store 配置、`EnvelopeAction`、`EnvelopeTarget` | News、Trade、AI Center 字典 |
| `src/constants/cockpit.constants.ts` | 驾驶舱常量：颜色映射、评分等级、维度名称、模型版本、轮询间隔 | Widget 字典 |
| `src/constants/ai-center.constants.ts` | AI 中心常量：Agent 状态/标签/类型、数据源配置 | AI Center 字典 |
| `src/constants/health.constants.ts` | 健康监控常量：健康状态、模块分类、诊断等级、评分阈值 | AI Center 字典 |
| ~~`src/store/derived.index.ts`~~（已删除，待重建） | ~~Store 注册表：`StoreRegistryEntry`、`StoreDomain`、`StoreStatus` 类型，29 条目~~（已删除，待重建） | Registry 字典 |
| `src/components/componentRegistry.ts` | Component 注册表：`ComponentRegistryEntry` 类型，10+ 条目 | Registry 字典 |
| `src/config/apiPaths.ts` | 内部 API 路径集中配置（13 条路径）：系统监控 4 条（`API_SYSTEM_AGENT_HEALTH`/`API_SYSTEM_ENGINE_STATUS`/`API_SYSTEM_ARCHITECTURE`/`API_SYSTEM_RISK_MONITOR`）、交易 6 条（`API_TRADE_PNL_ANALYSIS`/`API_TRADE_POSITIONS`/`API_TRADE_SIGNALS`/`API_TRADE_HOLDINGS`/`API_TRADE_ADD_POSITION`/`API_TRADE_CLOSE_POSITION`/`API_TRADE_HOLDINGS_EXPORT`）、数据采集 2 条（`API_COLLECT_BASIC`/`API_COLLECT_KLINE`） | UseCase、Service 层 |
| `src/config/timeouts.ts` | 超时值集中配置（4 项）：`ANALYSIS_ENGINE_TIMEOUT_MS`（30s）、`DATA_COLLECTION_TIMEOUT_MS`（10s）、`DEFAULT_REQUEST_TIMEOUT_MS`（5s）、`LLM_CALL_TIMEOUT_MS`（60s） | Service 层 |
| `src/config/mathConstants.ts` | 数学/金融常量（10 项）：`MS_PER_DAY`、`TRADING_DAYS_PER_YEAR`、`VAR_95_Z_SCORE`、`WAN_TO_YUAN_MULTIPLIER`、`DJB2_HASH_INIT`、`DJB2_HASH_MULTIPLIER`、`LOG_SNIPPET_MAX_CHARS`、`LLM_PROMPT_INPUT_MAX_CHARS`、`MCP_CALL_HISTORY_MAX_SIZE`、`HTTP_OK`/`HTTP_INTERNAL_ERROR` | 交易计算纯函数、Service 层 |
| `src/config/dataSourceUrls.ts` | 外部数据源 URL 集中配置（9 项）：`TENCENT_QUOTE_API`、`TENCENT_KLINE_API`、`SINA_QUOTE_API`、`NETEASE_HISTORY_API`、`MOCK_NEWS_URL_PREFIX`、`MOCK_TENCENT_BASE_URL`、`MOCK_SINA_BASE_URL`、`MOCK_NETEASE_BASE_URL`、`MOCK_AKSHARE_BASE_URL` | Fetcher 层、Service 层 |
| `src/config/tradingConfig.ts` | 交易引擎配置：`SignalDirection`（`'buy' \| 'sell' \| 'hold' \| 'watch'`）、`SignalThresholds`、Kelly/风控参数 | 交易引擎（信号/仓位/风控）字典 |
| `src/data/types.ts` → `Signal` | 交易信号类型：`id`、`symbol`、`direction`、`type`、`strategy`、`confidence`、`rationale`、`snapshot`、`createdAt` | 交易引擎字典 |
| `src/data/types.ts` → `SignalSnapshot` | 信号快照：`pePercentile`、`pbPercentile`、`priceToMA20`、`priceToMA60`、`volumeRatio`、`rsi14`、`macdDirection` | 交易引擎字典 |
| `src/data/types.ts` → `PoolGroupMeta` | 股票池分组元数据：`name`（分组名称） | 股票池分组字典 |
| `src/constants/healthStatusStyles.ts` | 健康度仪表盘状态样式（带透明度 Tailwind 组合） | 健康度仪表盘 |
| `src/store/collectionWizardStore.ts` | 采集向导状态管理：`CollectionWizardState`、`WizardStep`、模板加载/保存/步骤推进 | 数据采集向导 |
| `src/showcase/UIComponentShowcase.tsx` | 原子组件展示库（Button/Input/Checkbox/Switch/Select/Toast 等） | 设计系统/组件展示 |
| `src/showcase/ColorTokenShowcase.tsx` | 颜色令牌展示库 | 设计系统/组件展示 |
| `src/showcase/StockDataShowcase.tsx` | 股票数据可视化展示库 | 设计系统/组件展示 |
| `src/showcase/WidgetStateShowcase.tsx` | Widget 状态展示库 | 设计系统/组件展示 |
| `src/showcase/ShowcaseSection.tsx` | 展示区块通用容器 | 设计系统/组件展示 |
新增模块如需补充数据字典，请按以下步骤执行：
1. 在 `src/constants/` 中定义颜色、状态、枚举、模型版本、轮询间隔等常量；
2. 在 `src/types/modules/` 中定义 TypeScript 接口；
3. 在 `src/services/` 中实现服务层 API；
4. 在 `docs/` 下新增 `MODULE_NAME_data-definition.md`；
5. 更新本文档索引表；
6. 更新 `CHANGELOG.md`；
7. 执行 `tsc → lint → test → build` 验证。
| 数据流引擎（DataFlow Engine） | ? 已补充 | 已新增 `./dataflow-data-definition.md`，覆盖 `DataChannel`、`DataPacket`、`ChannelMeta`、API、事件、回退数据、重连策略 |
| 数据融合引擎（Data Fusion） | ? 已实现 | `src/services/unifiedStockService.ts` 已落地，`UnifiedStockView` 统一视图整合 7 种数据源 |
| 股票池分组 | ? 已补充 | `PoolGroupMeta`（`src/data/types.ts`）、`DEFAULT_POOL_GROUP`（`src/config/dbConfig.ts`）、`PoolState`（`src/store/poolStore.test.ts`）、`Stock.group` 字段已纳入索引 |
| 交易引擎（信号/仓位/风控） | ? 已补充 | `signalGenerator.ts`（`TradingSignal`/`SignalSnapshot`/`SignalDirection`）、`positionSizer.ts`（`PositionSizingInput`/`PositionSizingResult`）、`riskEngine.ts`（`OrderRiskInput`/`RiskCheckResult`）已纳入索引 |
| 风控派生计算 | ? 已补充 | 已新增 `docs/RISK_DERIVED_data-definition.md`，覆盖 `riskStore.derived.ts` 的 22 个函数、4 个类型定义、风控三态规则、熔断状态机、趋势分析规则 |
| V6 评分引擎 L3 辅助函数 | ? 已补充 | `src/services/scoring/v6-engine/calculators/l3/helpers.ts` 包含 `scoreMoat()`（护城河评分）和 `scoreCompetition()`（竞争格局评分），1-5 分制，基于毛利率/营收增速/ROE 量化计算 |
- `../reports/retrospectives/doc-sync-execution-plan.md`：代码-文档同步整体方案
- `../explanation/design/deprecated-doc-sync-gap-list.md`：差异清单与闭环追踪
- `./03-architecture-standards.md`：架构标准与分层约定
- `./09-quality-gates.md`：质量门禁与审计基线
