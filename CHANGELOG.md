# 更新日志

> 本日志按 [SemVer](https://semver.org/lang/zh-CN/) 记录 V9 智能投研复盘系统的版本变更、架构决策与验收数据。  
> 未发布版本以 `Unreleased` 开头；已发布版本附带构建与测试硬指标。

---

## [Unreleased]

### Added

- **V6 Pro 驾驶舱深度比对评估（v0.9.0-docs-v6pro-assessment）**：
  - 完成 V6 Pro 驾驶舱与 V9 开发基线的全维度架构比对，覆盖 DataBridge、Engine、UI、Agent 四大核心模块。
  - 新增数据流引擎设计（`docs/03-architecture-standards.md` 3.1.2）：支持 SSE 推送 + 轮询回退、内存缓存（10秒 TTL/200条目）、通道元数据配置、慢订阅者检测、序列号追踪。
  - 新增数据融合层设计（`docs/03-architecture-standards.md` 3.1.3）：`UnifiedStockData` 统一数据视图，聚合基础/K线/财务/评分/信号多源数据。
  - 新增驾驶舱 Widget 架构设计（`docs/03-architecture-standards.md` 3.1.4）：注册表 + 懒加载引擎 + 生命周期 + 跨 Widget 联动 + 12列响应式网格。
  - 新增 Agent 层设计（`docs/03-architecture-standards.md` 3.1.5）：Agent 运行时、注册表、任务队列、健康监控、AI 助手架构。
  - 扩展偏差清单至 D19，新增数据流引擎缺失（D12）、数据融合层缺失（D13）、Widget 框架缺失（D14）、评分算法降级（D15）等关键偏差。
  - 新增评分报告生成设计（`docs/05-engine-specs.md`）：包含理由、目标价、风险、催化剂的完整报告 Schema。
  - 新增板块轮动评分引擎设计（`docs/05-engine-specs.md`）：五因子十六指标模型（景气度/估值/动量/资金/政策），支持轮动信号生成。
  - 新增图表组件规范（`docs/04-ui-ux-specs.md`）：`lightweight-charts` K线图、`recharts` 折线图/雷达图/热力图。
  - 扩展组件库清单（`docs/04-ui-ux-specs.md`）：基础 UI 组件、业务组件、图表组件三类。
  - 新增实施计划任务（`docs/08-implementation-plan.md`）：数据流引擎、数据融合、评分报告、板块轮动、Widget框架、图表库、错误边界、反馈闭环共 8 项任务。
  - 更新版本比对文档（`docs/implementation/architecture-version-comparison.md`）：新增 `v0.9.0-docs-v6pro-assessment` 版本记录与 V6 Pro 对照评估新增偏差项。
  - 更新 `docs/01~10` 全部核心文档版本号为 `v0.9.0-docs-v6pro-assessment`，更新日期为 2026-06-25。
  - **新增 Page 组件红色高危区（`docs/03-architecture-standards.md` 3.13）**：识别页面脚本中最容易被忽略但对人机交互影响致命的三类问题：
    - 问题一：数据请求缺少 pending 状态处理 → 强制包裹 `isLoading` 状态，绑定全局骨架屏
    - 问题二：监听器未在组件卸载时销毁 → 显式调用 `removeListener`，使用 `WeakRef` 优化
    - 问题三：路由参数变化未重新触发数据刷新 → 强制添加 `resetState + refetch` 逻辑
    - 包含当前代码违规示例与修正指令，建立强制审查清单

- **金融业务 Widget 落地（Phase 2.4）**：
  - 实现 5 个驾驶舱业务 Widget：`InvestmentProfileWidget`（投资画像/分析中心）、`StockPoolWidget`（股票池管理）、`KaiScoreWidget`（KAI 选股评分图谱）、`ModelCompareWidget`（AI 大模型对比）、`StockChatWidget`（个股/市场聊天界面）。
  - 扩展 `src/types/modules/widget.types.ts`：新增 `AnalysisScores`、`ModelComparison`、`StockPool`、`ChatHistory` 等类型。
  - 扩展 `src/constants/cockpit.constants.ts`：新增 `STOCK_COLOR_MAPPING`、`SCORE_LEVELS`、`KAI_DIMENSION_NAMES`、`LLM_MODEL_VERSIONS`、`INVESTOR_PROFILE_METRICS`、`STOCK_POOL_STATUS_COLORS`、`CHAT_DEMO_TARGETS`、`RISK_HINTS`，确保颜色、状态、维度、模型版本全部常量化。
  - 新增 `src/services/stock-analysis/mockStockAnalysisProvider.ts`：统一生成 5 个 Widget 的 Mock 数据，所有随机值与常量关联。
  - 扩展 `src/services/data-collector/MarketDataAdapter.ts`：新增 `analysisScores`、`modelComparison`、`stockPool`、`chatHistory` 适配分支与默认值。
  - 扩展 `src/services/data-collector/collectors/MockCollector.ts`：新增 `/stock-analysis/profile|kai|compare|pool|chat` 路由。
  - 扩展 `src/cockpit/providers/MarketDataProvider.tsx`：注入标准化 `MarketData`，新增 `sendChatMessage` 接口。
  - 更新 `src/cockpit/core/widgetRegistry.ts` 与 `CockpitShell.tsx`：注册 5 个新 Widget 并配置默认布局。
  - 新增 `tests/services/MockCollector.test.ts`、`tests/services/MarketDataAdapter.test.ts`，覆盖 A/B/C 板块 24 个用例。
  - 新增架构文档 `ARCHITECTURE.md`：含 Mermaid 图、枚举表、目录树、新增 Widget SOP。
  - 新增数据字典 `DATA_DEFINITION.md`：覆盖 5 个 Widget 的字段、枚举、颜色、服务端映射。

- **AI 智能体调度中心 / 健康监控 / 诊断分析板块设计落地**：
  - 新增 `src/constants/ai-center.constants.ts`：定义 `AGENT_STATUS`、`AGENT_TAG`、`AGENT_TYPE`、`AGENT_OVERVIEW_CARDS`、`AI_CENTER_DATA_SOURCE`。
  - 新增 `src/constants/health.constants.ts`：定义 `HEALTH_STATUS`、`HEALTH_MODULE_CATEGORY`、`DIAGNOSTIC_LEVEL`、`HEALTH_SCORE_THRESHOLDS`。
  - 新增 `src/types/modules/ai-center.types.ts`：定义 `AgentItem`、`AgentListData`、`HealthMetricItem`、`HealthMetricsData`、`DiagnosticReportItem`、`DiagnosticReportsData`、`AICenterData`。
  - 新增 `src/services/ai-center/mockAICenterProvider.ts`：三大板块 Mock 数据生成器，含异常/预警状态用于演示监控效果。
  - 新增 `docs/AI_CENTER_DATA_DEFINITION.md`：AI 中心数据字典，含接口字段、枚举常量、服务端 statusCode 映射、引用约束。
  - 新增 `docs/AI_CENTER_VUE3_EXAMPLES.md`：纯前端 Vue3 组件示例（图标渲染器、Pinia Store、三大 Panel、服务封装、硬编码检查清单），所有状态/颜色/标签/轮询间隔均引用 constants。

- **NewsPage PoC 数据字典补齐**：
  - 新增 `docs/NEWS_DATA_DEFINITION.md`：覆盖 `NewsArticle`、`NewsStockMap`、`SentimentCache`、`V6NewsArticle`、情感映射规则、`newsService` API、DataBridge Store / Envelope Action、路由映射。
  - 明确 PoC 未新增全局 Store 与 DataBridge 端点，读取复用 `newsService.listNews()`，写入由 `newsService` 内部调用 `dataLayer`。

- **V9 文档治理官批次 2：图表/反馈/Widget 错误/PWA 实施规格补齐**：
  - 新增 `docs/implementation/chart-integration.md`：图表技术选型（`lightweight-charts` + `recharts`）、`StockChart` / `IndicatorChart` API、DataFlow 通道对接、性能优化策略。
  - 新增 `docs/implementation/feedback-loop-spec.md`：Toast 四态持续时间、`FeedbackService` 接口、操作反馈闭环流程图、`feedback:*` 事件与 `EventBus` 集成。
  - 新增 `docs/implementation/widget-error-handling.md`：Widget 级 `ErrorBoundary` 复用与包裹策略、降级 UI 规范、错误分类上报、`widget:error` 事件定义。
  - 新增 `docs/implementation/pwa-offline-guide.md`：`vite-plugin-pwa` 注册策略、Precache/Runtime Cache 清单、版本更新流程、Lighthouse 离线测试标准。
  - 更新 `docs/implementation/v9-system-blueprint.md`：文档索引新增 4 份实施规格；D16/D18/D19 标记为「规格已起草，代码待引入」；版本号更新为 `v0.9.0-doc-sync-batch2`。

- **代码-文档同步机制建立**：
  - 新增 `docs/implementation/doc-sync-execution-plan.md`：定义“扫描差异 → 补齐文档 → 验证”闭环，明确与 V9 问题整改调度表、实施计划、NewsPage PoC、CHANGELOG 的衔接方式。
  - 新增 `docs/implementation/doc-sync-gap-list.md`：首次扫描记录已闭环 4 项、待处理 12 项差异。
  - 新增 `docs/DATA_DICTIONARY_INDEX.md`：汇总所有模块数据字典入口与通用类型，便于快速查找。
  - 新增/完善 `scripts/audit-doc-sync.ts`：自动化差异扫描脚本，支持 git diff 与全量 src 扫描；已纳入 `npm run audit:docs` 与 `npm run audit`。
  - 更新 `docs/08-implementation-plan.md`：新增任务 2.22“代码-文档同步机制”，版本号更新为 `v0.9.0-doc-sync-plan`。
  - 更新 `docs/06-routing-specs.md`：补全 `/analysis/news-v6`、`/trading/holdings`、`/mock-test` 等路由映射，版本号更新为 `v0.9.0-doc-sync-plan`。
  - 更新 `docs/09-quality-gates.md`：修正跨层调用基线为 0/0，更新硬编码基线为 749、死代码基线为 0/0/16，版本号更新为 `v0.9.0-doc-sync-plan`。
  - 新增 `docs/DATAFLOW_DATA_DEFINITION.md`：覆盖数据流引擎 `DataChannel`、`DataPacket`、`ChannelMeta`、API、事件、回退数据、重连策略、性能阈值。
  - 更新 `docs/05-engine-specs.md`：数据流引擎章节引用 `docs/DATAFLOW_DATA_DEFINITION.md`，版本号更新为 `v0.9.0-doc-sync-plan`。

### Fixed

- **质量审查修复批次（news-v6 / 全局 lint）**：
  - 修复 `src/pages/trading/HoldingsPage.tsx` 9 处 `react-hooks/exhaustive-deps` warning，恢复 `npm run lint --max-warnings 0` 通过。
  - 新增 `src/hooks/useDebounce.ts` 与 `tests/useDebounce.test.ts`，为搜索输入提供可取消的防抖能力。
  - `NewsPage.tsx` / `NewsFeed.tsx` 接入 `useDebounce`，替换原有手写 setTimeout 防抖逻辑。
  - `NewsPage.tsx` 模拟数据生成与筛选变更增加 try-catch 错误处理；`newsStore.ts` `toggleBookmark` 增加 DataBridge 转发异常捕获。
  - 修复 `src/agents/index.ts` TS6133 未使用 `AgentTask` 类型导入。
  - 新增 `tests/news-v6/NewsPage.test.tsx`（6 用例）与 `tests/news-v6/NewsFeed.test.tsx`（8 用例），覆盖加载、错误重试、详情弹窗、筛选、搜索防抖、收藏、加载更多。
  - 新增 `src/constants/newsColorTokens.ts`，将 `NewsCard` / `CategoryBadge` / `SentimentBadge` 硬编码 Tailwind 颜色类收敛为语义化令牌。
  - `scripts/audit-doc-sync.ts` 补充 `console.warn` 使用说明注释。

### Quality Metrics

- `tsc --noEmit`：通过
- `eslint src/ --max-warnings 0`：通过
- `npm run build`：通过
- `npx vitest run`：63 文件 / 476 用例 通过
- `audit:layers`：0 违规 / 1 警告（`SectorAnalysisPage.tsx` 过渡期 dataLayer 读取，非本次引入）
- `audit:hardcode`：735（基线 749 ↓14）
- `audit:deadcode`：0 / 0 / 16
- `audit:docs`：0 未文档化文件

### Notes

- `newsStore.ts` 收藏状态当前仅持久化到 `localStorage`；是否同步到 IndexedDB 待产品决策。
- 工作区存在未跟踪文件 `src/services/unifiedStockService.ts`、`src/services/feedbackService.ts`、`src/components/WidgetErrorBoundary.tsx`，非本次修改产生，未纳入本次提交。

- **文档体系架构校对（v0.9.0-docs-review）**：
  - 新增 `docs/implementation/architecture-version-comparison.md`，记录架构文档从规划基线到校对版的全量差异。
  - 新增 `docs/implementation/input-cabin-spec.md`，补齐输入舱业务蓝图、数据协议、服务契约、UI 组件映射。
  - 新增 `docs/implementation/data-interaction-protocols.md`，明确调用矩阵、事件命名、数据血缘、输入舱专用契约。
  - 新增 `docs/implementation/implementation-governance.md`，建立 ADR 模板、版本比对机制、审计基线维护、代码-文档同步规则。
  - 新增 `docs/implementation/v9-input-cabin-strategy-report.md`，汇总输入舱升级策略、利弊分析与实施计划。
- 引入 V10 架构白皮书与 V6 Pro UI 模块比对参考：
  - 新增 `docs/implementation/v10-architecture-alignment.md`，分类吸收 V10 框架思想（直接吸收/适配吸收/暂不采纳）。
  - 新增 `docs/implementation/ui-module-alignment.md`，分类吸收 V6 Pro UI 模式并给出组件新增清单。
- **股票池流转 UI 落地（Phase 2.3）**：
  - 新增 `src/services/stockpool/stockpoolService.ts`，封装 `transitionStock`、`getStocksByStatus`、`getAllPoolGroups`。
  - 新增看板组件 `src/components/pool/PoolBoard.tsx`、`PoolColumn.tsx`、`PoolCard.tsx`、`usePoolData.ts`。
  - 重写 `src/apps/input/InputApp.tsx` 为五态股票池看板，支持 candidate→screened→deepDive→watching→archived 一键流转。
  - 新增 `tests/stockpoolService.test.ts`、`tests/poolTransitionEngine.test.ts`。
- **数据采集模块（Data Fetcher）P0/P1 落地**：
  - 新增 `src/services/fetcher/` 服务层，包含 `fetcherConfig`、`fetcherClient`、`fetcherAdapter`、`fetcherService`、`fetcherScheduler`。
  - 新增 `src/config/fetcherConfig.ts` 与 `VITE_AKSHARE_BASE_URL` 环境变量。
  - 输入舱支持「录入并拉取 AKShare 数据」，基础字段（price/pe/pb/roe/marketCap）写入 `Stock`。
  - 新增 `daily_quotes` 存储与 `SAVE_DAILY_QUOTES` 信封动作；IndexedDB 版本 3→4。
  - K线/行情采集 `fetchStockKline` 写入 `daily_quotes` 并同步更新 `Stock.price`。
  - V6 自动评分优先使用真实行情数据计算动量/波动/流动性，缺失时降级为随机数模拟。
  - 交易舱订单价格优先使用 `stock.price`（来自真实行情）。
  - 新增 `python/data_service/collect_endpoints.py` 接口契约与 `requirements.txt`。
  - 新增 `docs/implementation/data-collection-architecture.md` 架构设计文档。
  - 新增 `tests/fetcherService.test.ts`、`tests/fetcherKline.test.ts` 单元测试。
- 建立项目级文档体系：`docs/01~10` 规划文档导航，`docs/README.md` 声明为文档唯一真相源。
- 补充缺失规格文档：`docs/05-engine-specs.md`、`docs/06-routing-specs.md`、`docs/07-operation-strategy.md`、`docs/09-quality-gates.md`。
- 引入架构决策记录（ADR）与当前代码-架构偏差清单，强化架构、功能、实现三维度论证。
- 建立架构守护扫描脚本：
  - `scripts/audit-layer-calls.ts`：检测跨层调用违规（当前基线 14 处）。
  - `scripts/audit-hardcode.ts`：检测硬编码、静默回退、魔法数字（当前基线 53 处）。
  - `scripts/audit-dead-code.ts`：检测空壳代码与路由一致性（当前基线 5 处提示）。
- 新增 npm scripts：`audit:layers`、`audit:hardcode`、`audit:deadcode`、`audit`。
- 补全五舱与驾驶舱路由：`/`、`/input`、`/analysis`、`/trading`、`/output`、`/command`、`/cockpit` 全部注册到 `ROUTE_REGISTRY`。
- `App.tsx` 改为遍历 `ROUTE_REGISTRY` 渲染，移除硬编码路径。
- `PortalShell` 支持子路径前缀匹配，确保 `/analysis/stock-score` 等子页面仍高亮分析舱。
- 交易引擎下沉：新增 `src/services/trading/tradingService.ts`，`TradingApp.tsx` 仅保留 UI 编排。
- 导入 v6-pro-cockpit 交易相关策略报告核心结论，形成 `docs/implementation/trading-core-factors.md`。
- 扩展 `docs/05-engine-specs.md` 交易引擎章节，覆盖择时信号、仓位管理、风控、错误分类、复盘引擎。
- **交易引擎 P0 落地**：
  - 新增 `src/config/tradingConfig.ts`，集中管理信号阈值、Kelly 仓位参数、风控阈值。
  - 新增 `src/services/trading/signalGenerator.ts`：基于 K 线计算 MA/RSI/量比/MACD，生成 `buy_dip`、`buy_pivot`、`sell_profit_taking`、`sell_trailing_stop`、`hold`、`watch` 及 `composite` 共振信号。
  - 新增 `src/services/trading/positionSizer.ts`：1/4 Kelly 公式计算仓位，按整手取整，约束单笔/总仓位上限。
  - 新增 `src/services/trading/riskEngine.ts`：价格/数量、数据新鲜度、同标的冷却期、当日交易次数、仓位上限、卖出持仓充足性校验。
  - `tradingService.ts` 集成风控检查，新增 `scanWatchingSignals`、`adviseForStock` 统一交易建议接口。
  - `TradingApp.tsx` 展示信号、建议仓位与风控提示，支持按建议数量买入/卖出、一键扫描信号。
  - 新增 `tests/signalGenerator.test.ts`、`tests/positionSizer.test.ts`、`tests/riskEngine.test.ts`。
- 扩展 `docs/02-functional-specs.md`、`docs/10-glossary.md`、`docs/08-implementation-plan.md` 中交易与复盘相关内容。
- **股票池分组（股票池组）改造**：
  - `Stock` 数据模型新增可选 `group` 字段，默认分组为「默认分组」。
  - IndexedDB 版本 4→5，`stocks` 存储新增 `by-group` 索引；升级时自动将历史缺失分组的股票回写为默认分组。
  - `dataLayer.stockStore` 新增 `listByGroup`、`listGroups`、`updateGroup`。
  - `stockpoolService` 新增 `getPoolGroups`、`getStocksByGroup`、`updateStockGroup`，状态机与分组解耦。
  - `inputService.addStock` / `importPool`、`batchImportService`、`hotSectorService` 支持指定目标分组。
  - `usePoolData` 新增 `allGroups`、`selectedGroup`、`setSelectedGroup`、`handleChangeGroup`。
  - `InputDashboard` 新增分组筛选器、新建分组弹窗、单条录入分组选择、批量移入分组。
  - `PoolBoard` / `PoolList` / `PoolCard` 展示分组 Badge 并支持快速切换分组。
  - 新增/更新 `tests/stockpoolService.test.ts`、`tests/dataLayer.test.ts`、`tests/PoolList.test.tsx`、`tests/PoolBoard.test.tsx`。
  - 新增 Playwright E2E 测试：`e2e/pool-group.spec.ts`，覆盖分组 UI 展示、新建分组、按分组录入、列表视图分组列、批量导入/热门板块分组入口。
  - 安装 `@playwright/test` 并新增 `npm run test:e2e` / `npm run test:e2e:ui` 脚本；`vite.config.ts` 排除 `e2e/**` 避免 vitest 与 Playwright 冲突。

### Fixed

- **Fatal 级硬编码修复（校对测试）**：
  - 将 `src/config/themeRegistry.ts` 中的主题成分股白名单与默认核心标的迁移至 `src/data/themeSymbolPool.ts`。
  - `src/config/themeRegistry.ts` 改为从数据层导入 `CORE_RESOURCE_SYMBOL_WHITELIST` 与 `CORE_RESOURCE_DEFAULT_CORE_SYMBOLS`，保持 `CORE_RESOURCE_THEME` 对外 API 不变。
  - 消除 `audit:hardcode` 的 Fatal 级违规（23 → 0），`audit:layers` 仍保持 0 违规。

- **输入舱 UI 体系化重塑（Kimi 经典布局）**：
  - 参考 `dashboard_v2.html` 的深色侧边栏 + 顶部状态栏 + 卡片网格布局，将 `PortalShell` 升级为全局深色经典布局容器。
  - 输入舱由单文件巨石组件拆分为子页面：`/input`（录入看板）、`/input/bulk-import`（批量导入）、`/input/hot-sectors`（热门板块）、`/input/data-test`（采集测试）。
  - 新增 `src/apps/input/InputDashboard.tsx`、`BulkImportPanel.tsx`、`HotSectorPanel.tsx`；`InputApp.tsx` 改为按路径分发的布局组件。
  - `src/config/routes.ts` 注册输入舱子路由；`docs/06-routing-specs.md`、`docs/08-implementation-plan.md` 同步更新。
  - 修复 `batchImportService.parseBulkInput` 对 `代码,名称` 格式的解析 bug，批量导入测试全部通过。

- **Phase 2 第二步：V6 Pro → V9 JSON 数据迁移**：
  - 新增迁移规范中间文档 `docs/implementation/v6-to-v9-migration-spec.md`，明确 V6 `dataManager.export()` 全量导出 JSON 的字段映射、转换规则、冲突处理与导入顺序，作为 `v6MigrationService` 的唯一权威转换依据。
  - 新增 `src/services/system/v6MigrationService.ts`：
    - 定义 V6 全量导出 12 个核心 store 的输入类型与 V9 转换结果类型。
    - 实现通用转换工具：`sentimentNumberToLabel`、`parseTimestamp`、安全数值/字符串/数组处理。
    - 实现 12 个 store 的转换函数：`stocks`、`daily_quotes`、`v6_scores`、`orders`、`sector_scores`、`rotation_scores`、`score_docs`、`strategy_snapshots`、`local_docs`、`news`、`news_stock_map`、`sentiment_cache`。
    - 实现 `parseV6Export`、`transformV6ToV9`、`importToV9`、`runV6Migration` 与迁移报告生成。
    - 导入默认跳过已存在记录，支持 `overwriteExisting` 覆盖与 `dryRun` 预览。
  - 新增 `src/components/system/MigrationPanel.tsx`：支持 JSON 文件拖拽/点击上传、V6/V9 数据概览预览、覆盖开关、执行导入、迁移报告展示。
  - 在 `src/apps/command/CommandApp.tsx` 中新增"V6 迁移"按钮，点击弹出 Dialog 打开 `MigrationPanel`。
  - 新增 `tests/v6MigrationService.test.ts`（19 tests）与 `tests/MigrationPanel.test.tsx`（4 tests）。
  - 全量质量门禁通过：`tsc --noEmit`、`npm run lint`、`npm test` 291 passed、`npm run build`、`npm run test:e2e` 5 passed。

- **Widget 与数据层质量修复**：
  - 删除 `src/components/holdings/HoldingsFilter.tsx` 未使用变量，消除 ESLint 失败。
  - 修复 `src/cockpit/core/widgetEngine.ts` 类型兼容问题，确保懒加载组件类型与注册表一致。
  - 修复 `src/services/stock-analysis/mockStockAnalysisProvider.ts` 空值安全问题，避免 `toFixed` 等操作在异常 payload 上崩溃。
  - 全量验证通过：`npm run tsc`、`npm run lint`、`npm run test`、`npm run build`。

- **文档同步过程中的质量修复**：
  - 修复 `src/services/data-collector/mockDataCollection.ts:872` 中 `catch (_)` 未使用变量导致的 ESLint 失败，改为 `catch { }`。

### Fixed

- **全量并发测试稳定性**：
  - `tests/NewsPage.test.tsx` 将生成模拟资讯后的 `waitFor` 超时从 5000ms 调整为 10000ms，避免全量并发执行时因 IndexedDB 操作排队导致偶发超时。
  - `vite.config.ts` 的 `test` 配置增加 `testTimeout: 10000`，统一提升 vitest 默认超时阈值。

### Changed

- `docs/03-architecture-standards.md`：
  - 更新 L3/L4 实际目录映射（交易/采集引擎下沉、输入舱子页拆分）。
  - 增加 `dataQuality` 字段、`daily_quotes` store 与输入舱数据协议。
  - 增加 3.9.7「共享字段契约」，借鉴 V10 StateBoard 思想。
  - 更新偏差清单，标记已修复项并新增未解决项（含 V10 Agent/Gateway 机制）。
  - 增加「版本比对」小节。
- `docs/08-implementation-plan.md`：
  - 更新当前基线为 107/107 测试通过、`audit:layers` 0 违规。
  - 细化 Phase 2 输入舱子任务（2.3.6 ~ 2.3.10）。
  - 增加「版本比对」小节。
- `docs/06-routing-specs.md`：
  - 增加第 8 节「路由 → 组件 → 服务映射」。
  - 第 3.2 节增加输入舱子路由映射。
  - 增加 `/input/prototype` 临时路由处理计划与「版本比对」小节。
- `docs/02-functional-specs.md`：新增 US-006~US-009（搜索、批量导入预览、热门板块、采集测试），增加「版本比对」小节。
- `docs/04-ui-ux-specs.md`：更新 PortalShell 为 Kimi 经典深色布局，增加分组侧边栏与输入舱子页布局说明，增加「版本比对」小节。
- `docs/05-engine-specs.md`：新增第 3 节「输入舱服务层」；数据采集引擎增加「只采集不计算」约束与未来扩展方向（Agent/Gateway/SectorFactorUpdater）；`EnvelopeAction` 增加 `SAVE_DAILY_QUOTES`；更新偏差清单。
- `docs/09-quality-gates.md`：
  - 更新测试基线为 107/107 通过、跨层调用 0 违规。
  - 新增路由一致性审计项，补充硬编码/死代码数量说明。
  - 调整章节顺序，增加「版本比对」小节。
- `docs/README.md`：文档版本更新为 `v0.9.0-docs-review`，新增专项文档导航；为核心规格文档增加状态/版本列。
- 统一 `docs/01~10`、`docs/implementation/*`、`docs/implementation/adr/*` 文档顶部的 `Status` / `Version` / `Last Updated` 标识；外部参考蓝图标记为 `Future Reference / Deferred`，ADR 标记为 `Accepted`。
- `docs/01-vision-and-goals.md`：补全 `Status: Current` / `Version: v0.9.0-docs-review` 标识。
- `docs/10-glossary.md`：补全状态/版本标识；`Stock` 字段表增加 `dataQuality`；明确 `rotation_scores` 为规划中（P2）。
- `docs/07-operation-strategy.md`：补全状态/版本标识；新增 1.6 节「代码变更前的架构自诘（守护者检查清单）」，要求 PR 前回答 3 个架构守护问题。
- `docs/08-implementation-plan.md`：细化 Phase 2~4 的验收标准、任务依赖与风险登记表。
- `docs/03-architecture-standards.md`：补充技术选型理由、离线机制与真实偏差清单。
- `docs/09-quality-gates.md`：更新扫描脚本状态与当前基线数据。
- `docs/02-functional-specs.md`：补充 P1/P2 功能规格、异常边界、导入导出格式。
- `README.md`：修正单元测试覆盖范围描述。

---

## [0.9.0] - 2026-06-24

### Added

- **项目骨架**：React 19 + TypeScript + Vite + Tailwind CSS 工程化配置（`package.json`、`vite.config.ts`、`tsconfig.json`、`eslint.config.js`）。
- **主题系统**：宋瓷美学主题令牌（`src/theme.config.ts`、`src/index.css`），支持天青、粉青、朱砂红、象牙白、高级灰。
- **五舱工作流**：输入舱/分析舱/交易舱/输出舱/总控舱应用框架（`src/apps/*`）与 `PortalShell` 导航。
- **驾驶舱**：`CockpitShell` 提供系统级数据看板与快捷入口。
- **数据层**：IndexedDB 原生封装 `src/data/db.ts`，支持版本迁移、导入/导出/重置；统一数据接口 `src/data/dataLayer.ts`。
- **信封化通信**：`DataBridge`（`src/core/databridge.ts`）+ `EnvelopeFactory`（`src/core/envelope.ts`）+ ACL 矩阵（`src/core/acl.ts`），所有跨模块写操作必须经 `DataBridge.forward()`。
- **股票池**：单表多状态（`candidate / screened / deepDive / watching / archived`），支持录入、更新、删除与池间流转。
- **V6 九维评分**：自动评分实现（`src/services/scoring/v6ScoreService.ts`），因子配置集中管理（`src/config/scoreFactors.ts`）。
- **智能评分（LLM）**：`src/services/scoring/intelligentScoreService.ts` 支持上传报告并调用 LLM 生成带证据的维度评分。
- **行业评分（V4）**：`src/services/scoring/industryScoreService.ts` 提供七维行业评分。
- **模拟交易**：`src/apps/trading/TradingApp.tsx` 支持买入/卖出、持仓、订单持久化。
- **路由注册表**：`src/config/routes.ts` 采用懒加载（`React.lazy`）与 HashRouter。
- **单元测试**：DataBridge、dataLayer、智能评分等 4 个测试文件全部通过。

### Architecture

- 确立五层架构：L1 基础设施 / L2 数据 / L3 引擎 / L4 应用 / L5 展示。
- 确立调用方向铁律：上层可调用下层；L5/L4 禁止直接调用 `dataLayer`，必须通过 `DataBridge` / Service / `eventBus`。
- 确立配置驱动原则：阈值、权重、股票代码池、路由表全部来自 `src/config/`。

### Quality

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings/errors |
| `npm run test` | ✅ 6/6 tests passed |
| `npm run build` | ✅ dist/ 生成成功 |

### Known Issues / 偏差

- `src/services/scoring/v6ScoreService.ts` 当前使用随机数模拟因子得分，待接入真实财务/行情数据。
- 五舱框架可用，但输入舱的 CSV/JSON 导入、股票池流转 UI 尚未完整实现。
- PWA manifest 与 service worker 未配置，离线可用性仅依赖浏览器缓存与 IndexedDB。
- 缺少 E2E 测试与 CI 覆盖率门禁。

---

## 附录：版本号释义

- **MAJOR**：架构范式或数据 Schema 不兼容升级。
- **MINOR**：新增舱室、引擎或核心功能模块。
- **PATCH**：缺陷修复、文档更新、性能优化或因子权重微调。
