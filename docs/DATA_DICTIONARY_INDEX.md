# V9 数据字典索引

> **Status**: Current  
> **Version**: v1.5.0  
> **Last Updated**: 2026-07-05  
> 本文档汇总 V9 项目所有模块级数据字典入口，便于快速查找字段定义、枚举值、服务 API 与 DataBridge 映射。

---

## 按模块索引

| 模块 | 数据字典 | 源码入口 | 覆盖范围 |
|------|----------|----------|----------|
| 交易持仓管理 | `DATA_DEFINITION.md`（根目录）、`docs/trade/API_CONTRACT.md` | `src/pages/trading/`、`src/types/modules/trade.types.ts`、`src/constants/trade.constants.ts`、`src/store/holdingsStore.ts` | 持仓明细、查询参数、交易操作、分页/筛选状态、Store 状态管理（Zustand） |
| 智能资讯中心（NewsPage） | `docs/NEWS_DATA_DEFINITION.md`、`docs/news/DATA_DEFINITION.md` | `src/pages/news-v6/`、`src/services/news/`、`src/data/types.ts`、`src/store/newsStore.ts` | `NewsArticle`、`NewsStockMap`、`SentimentCache`、V6/V9 适配、路由、Store 状态管理（Zustand） |
| AI 智能体调度中心 / 健康监控 / 诊断分析 | `docs/AI_CENTER_DATA_DEFINITION.md` | `src/constants/ai-center.constants.ts`、`src/constants/health.constants.ts`、`src/types/modules/ai-center.types.ts`、`src/services/ai-center/` | Agent、健康指标、诊断报告、统一 `AICenterData` |
| 金融业务驾驶舱 Widget | `DATA_DEFINITION.md`（根目录，§2~§5）、`docs/cockpit/DATA_DEFINITION.md` | `src/cockpit/widgets/`、`src/services/stock-analysis/`、`src/services/data-collector/`、`src/types/modules/widget.types.ts`、`src/store/widgetStore.ts` | 投资画像、股票池、KAI 评分、模型对比、聊天界面、Widget 实例管理 |
| 三层模块注册体系 | `docs/REGISTRY_INDEX.md` | ~~`src/store/storeRegistry.ts`~~（已删除，待重建）、`src/components/componentRegistry.ts`、`src/cockpit/core/widgetRegistry.ts` | ~~Store 注册表（29 条目）~~（已删除，待重建）、Component 注册表（10+ 条目）、Widget 注册表（21 条目），按域/状态查询，统计函数 |
| UseCase 用例层 | 内联类型定义 | `src/services/useCase/createExecutionPlan.useCase.ts`、`src/services/useCase/executePlan.useCase.ts`、`src/services/useCase/fetchSectorAnalysis.useCase.ts`、`src/services/useCase/fetcherOrchestrator.useCase.ts`、`src/services/useCase/generateTradeReview.useCase.ts`、`src/services/useCase/getUnifiedStockView.useCase.ts`、`src/services/useCase/hotSectorQuery.useCase.ts`、`src/services/useCase/rebalancePortfolio.useCase.ts`、`src/services/useCase/runDualStrategy.useCase.ts`、`src/services/useCase/strategySnapshotSave.useCase.ts`、`src/services/useCase/submitOrder.useCase.ts` | `CreateExecutionPlanInput`/`CreateExecutionPlanResult`、`ExecutePlanContext`/`ExecutePlanResult`、`FetchSectorAnalysisInput`/`FetchSectorAnalysisResult`、`FetchBasicDataInput`/`FetchKlineDataInput`、`TradeReviewReport`（引用自 `tradeReviewAI.types.ts`）、`UnifiedStockView`/`FusionOptions`、`HotSectorQueryInput`/`HotSectorQueryResult`、`RebalanceOptions`、`RunDualStrategyInput`、`SaveStrategySnapshotInput`/`SaveStrategySnapshotResult`、`SubmitOrderInput`/`SubmitOrderResult` |
| 交易计算纯函数 | 内联类型定义 | `src/services/trading/positionComputer.ts`、`src/services/trading/pnlComputer.ts`、`src/services/trading/riskComputer.ts` | `MatchedTradePair`、`TradePair`、`PositionItem`、`PnLSummary`、`RiskMetrics` |
| 交易引擎（信号/仓位/风控） | 内联类型定义 | `src/services/trading/signalGenerator.ts`、`src/services/trading/positionSizer.ts`、`src/services/trading/riskEngine.ts` | `TradingSignal`（= `Signal`）、`SignalSnapshot`、`SignalDirection`、`PositionSizingInput`/`PositionSizingResult`、`OrderRiskInput`/`RiskCheckResult` |
| 股票池分组 | 内联类型定义 | `src/data/types.ts`（`PoolGroupMeta`）、`src/config/dbConfig.ts`（`DEFAULT_POOL_GROUP`）、`src/store/poolStore.ts`（`PoolState`） | `PoolGroupMeta`、`DEFAULT_POOL_GROUP`、`PoolState`（含 `stocks`/`loading`/`error`/`isRefreshing`/`lastUpdated`）、`Stock.group` 字段 |

---

## 通用类型与常量

| 类型/常量文件 | 说明 | 被哪些字典引用 |
|---------------|------|----------------|
| `src/data/types.ts` | 全局数据类型：`Stock`、`Order`、`Portfolio`、`NewsArticle`、`NewsStockMap`、`SentimentCache` 等 | News、Trade、Widget 字典 |
| `src/config/dbConfig.ts` | IndexedDB store 配置、`EnvelopeAction`、`EnvelopeTarget` | News、Trade、AI Center 字典 |
| `src/constants/cockpit.constants.ts` | 驾驶舱常量：颜色映射、评分等级、维度名称、模型版本、轮询间隔 | Widget 字典 |
| `src/constants/ai-center.constants.ts` | AI 中心常量：Agent 状态/标签/类型、数据源配置 | AI Center 字典 |
| `src/constants/health.constants.ts` | 健康监控常量：健康状态、模块分类、诊断等级、评分阈值 | AI Center 字典 |
| ~~`src/store/storeRegistry.ts`~~（已删除，待重建） | ~~Store 注册表：`StoreRegistryEntry`、`StoreDomain`、`StoreStatus` 类型，29 条目~~（已删除，待重建） | Registry 字典 |
| `src/components/componentRegistry.ts` | Component 注册表：`ComponentRegistryEntry` 类型，10+ 条目 | Registry 字典 |
| `src/config/apiPaths.ts` | 内部 API 路径集中配置（13 条路径）：系统监控 4 条（`API_SYSTEM_AGENT_HEALTH`/`API_SYSTEM_ENGINE_STATUS`/`API_SYSTEM_ARCHITECTURE`/`API_SYSTEM_RISK_MONITOR`）、交易 6 条（`API_TRADE_PNL_ANALYSIS`/`API_TRADE_POSITIONS`/`API_TRADE_SIGNALS`/`API_TRADE_HOLDINGS`/`API_TRADE_ADD_POSITION`/`API_TRADE_CLOSE_POSITION`/`API_TRADE_HOLDINGS_EXPORT`）、数据采集 2 条（`API_COLLECT_BASIC`/`API_COLLECT_KLINE`） | UseCase、Service 层 |
| `src/config/timeouts.ts` | 超时值集中配置（4 项）：`ANALYSIS_ENGINE_TIMEOUT_MS`（30s）、`DATA_COLLECTION_TIMEOUT_MS`（10s）、`DEFAULT_REQUEST_TIMEOUT_MS`（5s）、`LLM_CALL_TIMEOUT_MS`（60s） | Service 层 |
| `src/config/mathConstants.ts` | 数学/金融常量（10 项）：`MS_PER_DAY`、`TRADING_DAYS_PER_YEAR`、`VAR_95_Z_SCORE`、`WAN_TO_YUAN_MULTIPLIER`、`DJB2_HASH_INIT`、`DJB2_HASH_MULTIPLIER`、`LOG_SNIPPET_MAX_CHARS`、`LLM_PROMPT_INPUT_MAX_CHARS`、`MCP_CALL_HISTORY_MAX_SIZE`、`HTTP_OK`/`HTTP_INTERNAL_ERROR` | 交易计算纯函数、Service 层 |
| `src/config/dataSourceUrls.ts` | 外部数据源 URL 集中配置（9 项）：`TENCENT_QUOTE_API`、`TENCENT_KLINE_API`、`SINA_QUOTE_API`、`NETEASE_HISTORY_API`、`MOCK_NEWS_URL_PREFIX`、`MOCK_TENCENT_BASE_URL`、`MOCK_SINA_BASE_URL`、`MOCK_NETEASE_BASE_URL`、`MOCK_AKSHARE_BASE_URL` | Fetcher 层、Service 层 |
| `src/config/tradingConfig.ts` | 交易引擎配置：`SignalDirection`（`'buy' \| 'sell' \| 'hold' \| 'watch'`）、`SignalThresholds`、Kelly/风控参数 | 交易引擎（信号/仓位/风控）字典 |
| `src/data/types.ts` → `Signal` | 交易信号类型：`id`、`symbol`、`direction`、`type`、`strategy`、`confidence`、`rationale`、`snapshot`、`createdAt` | 交易引擎字典 |
| `src/data/types.ts` → `SignalSnapshot` | 信号快照：`pePercentile`、`pbPercentile`、`priceToMA20`、`priceToMA60`、`volumeRatio`、`rsi14`、`macdDirection` | 交易引擎字典 |
| `src/data/types.ts` → `PoolGroupMeta` | 股票池分组元数据：`name`（分组名称） | 股票池分组字典 |

---

## 新增模块 SOP

新增模块如需补充数据字典，请按以下步骤执行：

1. 在 `src/constants/` 中定义颜色、状态、枚举、模型版本、轮询间隔等常量；
2. 在 `src/types/modules/` 中定义 TypeScript 接口；
3. 在 `src/services/` 中实现服务层 API；
4. 在 `docs/` 下新增 `MODULE_NAME_DATA_DEFINITION.md`；
5. 更新本文档索引表；
6. 更新 `CHANGELOG.md`；
7. 执行 `tsc → lint → test → build` 验证。

---

## 待补充字典

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据流引擎（DataFlow Engine） | ✅ 已补充 | 已新增 `docs/DATAFLOW_DATA_DEFINITION.md`，覆盖 `DataChannel`、`DataPacket`、`ChannelMeta`、API、事件、回退数据、重连策略 |
| 数据融合引擎（Data Fusion） | ✅ 已实现 | `src/services/unifiedStockService.ts` 已落地，`UnifiedStockView` 统一视图整合 7 种数据源 |
| 股票池分组 | ✅ 已补充 | `PoolGroupMeta`（`src/data/types.ts`）、`DEFAULT_POOL_GROUP`（`src/config/dbConfig.ts`）、`PoolState`（`src/store/poolStore.ts`）、`Stock.group` 字段已纳入索引 |
| 交易引擎（信号/仓位/风控） | ✅ 已补充 | `signalGenerator.ts`（`TradingSignal`/`SignalSnapshot`/`SignalDirection`）、`positionSizer.ts`（`PositionSizingInput`/`PositionSizingResult`）、`riskEngine.ts`（`OrderRiskInput`/`RiskCheckResult`）已纳入索引 |

---

## 相关文档

- `docs/implementation/doc-sync-execution-plan.md`：代码-文档同步整体方案
- `docs/implementation/doc-sync-gap-list.md`：差异清单与闭环追踪
- `docs/03-architecture-standards.md`：架构标准与分层约定
- `docs/09-quality-gates.md`：质量门禁与审计基线
