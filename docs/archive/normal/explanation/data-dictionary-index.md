---
title: data-dictionary-index
type: explanation
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "本文档汇总 V9 项目所有模块级数据字典入口，便于快速查找字段定义、枚举值、服务 API 与 DataBridge 映射。"
tags: [data, data-definition, registry, plan, architecture, explanation]
version: v1.7.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-005
referenced_by: [V9-DOC-PROJ-174, V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-058, V9-DOC-PROJ-119, V9-DOC-PROJ-176, V9-DOC-DATA-003, V9-DOC-PROJ-193, V9-DOC-PROJ-149]
change_log:
  - version: v1.7.0
    changes: "2026-08-15 系统性核对：与代码权威源 src/config/dbConfig.ts 二次对齐（DB_VERSION v32、STORE_NAME 50、MODULE_ID 20）；标注本文件为 design 阶段视图，权威 SSOT 转向 docs/reference/data-dictionary-index.md v1.1.0。"
    date: 2026-08-15
  - version: v1.6.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# V9 数据字典索引（design 阶段视图）

> **Status**: Current  
> **Version**: v1.7.0  
> **Last Updated**: 2026-08-15  
> ⚠️ **权威 SSOT**：本文件为设计阶段视图，权威索引请以 [`docs/reference/data-dictionary-index.md`](../reference/data-dictionary-index.md)（v1.1.0，2026-08-15）为准。  
> 本文档汇总 V9 项目所有模块级数据字典入口，便于快速查找字段定义、枚举值、服务 API 与 DataBridge 映射。  
> **代码权威源**：`DB_VERSION=32` · `STORE_NAME=50` · `MODULE_ID=20` · `ENVELOPE_TARGET=11` · `ENVELOPE_ACTION=80+`（见 [`src/config/dbConfig.ts`](../../../src/config/dbConfig.ts)）。

---

## 按模块索引

| 模块 | 数据字典 | 源码入口 | 覆盖范围 |
|------|----------|----------|----------|
| 交易持仓管理 | `data-definition.md`（根目录）、`../../reference/api-contract.md` | `src/pages/trading/`、`src/types/modules/trade.types.ts`、`src/constants/trade.constants.ts`、`src/store/holdingsStore.ts` | 持仓明细、查询参数、交易操作、分页/筛选状态、Store 状态管理（Zustand） |
| 智能资讯中心（NewsPage） | `../../reference/news-contract.md`、`../../reference/data-definition.md` | `src/pages/analysis/`、`src/services/news/`、`src/data/types.ts`、`src/store/analysisNewsStore.ts` | `NewsArticle`、`NewsStockMap`、`SentimentCache`、V6/V9 适配、路由、Store 状态管理（Zustand） |
| AI 智能体调度中心 / 健康监控 / 诊断分析 | `../../reference/ai-center-data-definition.md` | `src/constants/ai-center.constants.ts`、`src/constants/health.constants.ts`、`src/types/modules/ai-center.types.ts`、`src/services/ai-center/` | Agent、健康指标、诊断报告、统一 `AICenterData` |
| 金融业务驾驶舱 Widget | `data-definition.md`（根目录，§2~§5）、`../../reference/data-definition.md` | `src/cockpit/widgets/`、`src/services/stock-analysis/`、`src/services/data-collector/`、`src/types/modules/widget.types.ts`、`src/store/widgetStore.ts` | 投资画像、股票池、KAI 评分、模型对比、聊天界面、Widget 实例管理 |
| 三层模块注册体系 | `../../reference/registry-index.md` | ~~`src/store/derived.index.ts`~~（已删除，待重建）、`src/components/componentRegistry.ts`、`src/cockpit/core/widgetRegistry.ts` | ~~Store 注册表（29 条目）~~（已删除，待重建）、Component 注册表（10+ 条目）、Widget 注册表（21 条目），按域/状态查询，统计函数 |
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

---

## 通用类型与常量

| 类型/常量文件 | 说明 | 被哪些字典引用 |
|---------------|------|----------------|
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

---

## 新增模块 SOP

新增模块如需补充数据字典，请按以下步骤执行：

1. 在 `src/constants/` 中定义颜色、状态、枚举、模型版本、轮询间隔等常量；
2. 在 `src/types/modules/` 中定义 TypeScript 接口；
3. 在 `src/services/` 中实现服务层 API；
4. 在 `docs/` 下新增 `MODULE_NAME_data-definition.md`；
5. 更新本文档索引表；
6. 更新 `../../../CHANGELOG.md`；
7. 执行 `tsc → lint → test → build` 验证。

---

## 待补充字典

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据流引擎（DataFlow Engine） | ? 已补充 | 已新增 `../../reference/dataflow-data-definition.md`，覆盖 `DataChannel`、`DataPacket`、`ChannelMeta`、API、事件、回退数据、重连策略 |
| 数据融合引擎（Data Fusion） | ? 已实现 | `src/services/unifiedStockService.ts` 已落地，`UnifiedStockView` 统一视图整合 7 种数据源 |
| 股票池分组 | ? 已补充 | `PoolGroupMeta`（`src/data/types.ts`）、`DEFAULT_POOL_GROUP`（`src/config/dbConfig.ts`）、`PoolState`（`src/store/poolStore.test.ts`）、`Stock.group` 字段已纳入索引 |
| 交易引擎（信号/仓位/风控） | ? 已补充 | `signalGenerator.ts`（`TradingSignal`/`SignalSnapshot`/`SignalDirection`）、`positionSizer.ts`（`PositionSizingInput`/`PositionSizingResult`）、`riskEngine.ts`（`OrderRiskInput`/`RiskCheckResult`）已纳入索引 |
| 风控派生计算 | ? 已补充 | 已新增 `docs/RISK_DERIVED_data-definition.md`，覆盖 `riskStore.derived.ts` 的 22 个函数、4 个类型定义、风控三态规则、熔断状态机、趋势分析规则 |
| V6 评分引擎 L3 辅助函数 | ? 已补充 | `src/services/scoring/v6-engine/calculators/l3/helpers.ts` 包含 `scoreMoat()`（护城河评分）和 `scoreCompetition()`（竞争格局评分），1-5 分制，基于毛利率/营收增速/ROE 量化计算 |

---

## 相关文档

- `../../reports/retrospectives/doc-sync-execution-plan.md`：代码-文档同步整体方案
- `./deprecated-doc-sync-gap-list.md`：差异清单与闭环追踪
- `../../reference/03-architecture-standards.md`：架构标准与分层约定
- `../../reference/09-quality-gates.md`：质量门禁与审计基线
