---
title: 02 - 模块职责地图
type: reference
domain: architecture
status: frozen
version: 2.0.1
last_updated: 2026-08-22
code_version: "2.0.0-rc.2"
tag: FINAL
change_log:
  - version: 2.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4 frontmatter.version 裸值=2.0.0) → R2 PATCH++(2.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 02 - 模块职责地图 🏁

> 文档体系版本: **v2.0.0 · FINAL** | 本文档修订: rev.4（最终版 · 两轮交叉核对 · 修正 src=21/services=38/Store=66/audit=66 等 7 项）| 基于 AGENTS.md v1.6.0 §一目录定义 + 实际文件系统二次扫描编写

## 1. 顶层目录总览

| 目录 | 性质 | 职责 |
|------|------|------|
| `src/` | 前端源码 | 全部业务代码（21 子目录，详见 §2） |
| `electron/` | 桌面端源码 | Electron 主进程/preload/代理/侧车管理（`tsc -p electron/tsconfig.json` 编译到 dist-electron/） |
| `backend/` | Python 侧车 | FastAPI 采集服务 + Embedding 服务 + PyInstaller v9_sidecar.spec |
| `python/` | Python 脚本 | `eastmoney_fetcher.py`、`etl_bridge.py` 等辅助脚本 |
| `scripts/` | 工程化脚本 | 66 audit* + 大量 fix/docs-tool/quality/monitor/gen-* 脚本 |
| `tests/` | 测试 | 集成测试、契约测试、fixtures、测试工具 setup |
| `e2e/` | E2E 测试 | Playwright 用例（用户旅程/视觉回归/XSS/无障碍等） |
| `docs/` | 文档中心 | 十目录架构（meta/reference/specs/guides/how-to/explanation 等）|
| `plugins/` | 外部插件 | TRAE CN 插件技能（ifind/imf/scholar/sec_edgar/tianyancha 等数据源技能） |
| `.agents/skills/` | 项目技能 | 18 项 L1 物理 AI 技能（SKILL.md） |
| `.trae/skills/` | 技能索引 | skill-registry.json（单一真相源）+ INDEX.md，无技能本体 |
| `prompts/` | 提示词模板 | AI 辅助开发系统提示词 |
| `public/` | 静态资源 | PWA manifest、图标、`themeBootstrap.js` 主题引导脚本 |
| `monitoring/` | 监控 | Prometheus 配置 + 告警规则 + docker-compose |
| `archive/` | 归档 | 已退役脚本与文档 |
| `deliverables/` | 交付物 | 阶段性校对报告 |
| `outputs/` | 运行时输出 | 审计报告、归档产物 |
| `temp/` | 临时文件 | 运行时临时产物（被 .gitignore 排除） |

## 2. src/ 分层目录职责（21 个目录；已核对磁盘目录统计）

### 2.1 基础设施层（L1）

| 目录 | 职责 | 关键内容 |
|------|------|---------|
| `src/config/` | 配置层（零硬编码锚点） | `dbConfig.ts`（DB_VERSION=36 / 54 STORE_NAME / **99 ENVELOPE_ACTION** / **14 ENVELOPE_TARGET**）、`routes.ts`（路由注册表 ROUTE_REGISTRY）、`mcpAclMatrix.ts`、`mcpServerRegistry.ts`（15 条目 MCP 注册表）、各业务配置 |
| `src/constants/` | 常量层（零依赖） | `theme.tokens.ts`（V5 Apple Business Design Tokens）、`stockList.ts`、`uiText.ts`、`cockpit.constants.ts` 等；**禁止依赖任何运行时模块** |
| `src/types/` | 零依赖纯类型 | `base.types.ts`、`role.types.ts`、`widget.ts`、`guards.ts`、`modules/`（mcp/databridge/collector 子域类型） |
| `src/lib/` | 库函数（30+ 模块） | `logger.ts`、`eventBus.ts`、`errors.ts`、`xssSanitizer.ts`、`validation.ts`、`precision.ts`、`localStorageManager.ts`、`withBroadcast.ts`、`safeRegex.ts`、`perf.ts`、`format.ts`、`date.ts`、`designTokenVerifier.ts` 等；只有**白名单子集**可被 core/domain 层依赖 |
| `src/schema/` | Schema 校验 | JSON Schema 定义（stock/score/order/signal/config） |
| `src/i18n/` | 国际化 | `zh-CN.ts` 翻译资源 |
| `src/fixtures/` | 测试夹具 | 业务数据 fixture（mock 真实形态） |
| `src/showcase/` | 展示样例 | 组件/功能展示页 |

### 2.2 数据层（L2）

| 目录 | 职责 | 关键内容 |
|------|------|---------|
| `src/data/` | IndexedDB 数据层 | `db.ts`（V6Database）、`db-schema.ts`、`db-migrations.ts`、`dataLayer.ts`（统一访问入口）+ 按域拆分的 `dataLayer*Stores.ts` 子模块（Stock/Score/Trading/Profile/News/Watchlist/Order）、`repository.ts`（Repository<T> + createRepository）、`queryBuilder.ts`（多维度查询）、`types/`（23 个领域类型文件）、`schemas/`、`audit.ts` |
| `src/core/` | 核心工具与守卫 | `databridge.ts`（读写桥 + handlerRegistry + fallbackQueue + readCache + broadcast）、`envelope.ts`（StandardEnvelope + EnvelopeFactory）、`acl.ts`（ACL 引擎 + inferOperation）、`databridgeRouter.ts`（routeToQuery/routeToEvent/routeToManager）、`databridgeAdapter.ts`（DataBridgeAdapter 类 + create/get/destroy 工厂）、`databridgeStrategyRouter.ts`、`feedbackOrchestrator.ts`、`pipelineScheduler.ts`、`memoryCache.ts`（LRU + TTL + 统计）、`result.ts`（Result<T>）、`widgetEventBus.ts`、`routeGuard.tsx`、`ThemeProvider.tsx`、`transaction.ts` |
| `src/store/` | Zustand 状态层 | **磁盘 78 文件**（Store + derived/utility/index/subscriptions）；**注册表 66 条**（storeRegistry.ts：51 active + 15 deprecated，每份 deprecated 含 `deprecationMeta`）；`derived.index.ts` 集中导出派生函数；跨 Tab 同步用 `withBroadcast` 中间件 |
| `src/domain/` | 共享业务纯函数层 | 无 IO/无副作用；`chip/`（筹码分析）、`scoring/energy.ts`、`trading/markers.ts`、纯函数校验/映射工具 |

### 2.3 引擎层（L3）

| 目录 | 职责 | 关键内容 |
|------|------|---------|
| `src/services/` | 业务服务层（**38 子域目录**；已核对磁盘目录清单见 §3） | 按数据采集、评分引擎、交易组合、输入输出、系统横切分组 |
| `src/agents/` | AI 行为运行时 | `agentRegistry.ts`、`agentRuntime.ts`、`taskQueue.ts`（core 层扩展；仅依赖 core/data，不依赖 services/store/pages） |
| `src/mcp/` | MCP 服务器层 | `core/`（registry/client/server/transport/mcpAclMonitor/sampling/elicitation）、`bridge/`（mcpBridge）、`servers/`（fetcher/scoring/trading/news/llm/screening/backtest/pool/system/data-collector/marketdata(westock/tencentnews)/execution(×)/workflow(×)/analysis(×)/portfolio(×)/knowledge(×)）、`register.ts`；Registry 15 条目（10 enabled + 5 disabled） |
| `src/hooks/` | 横切自定义 Hooks | `useKline`（K 线获取/周期切换/自动刷新/加载错误态）、`usePoolBoard`（股票池看板加载+筛选）、`useRealtimeQuote`（实时行情订阅）、`useToast`、`usePageGuard`、`useTheme`、`useBroadcast`、业务场景 Hook（useBacktest/useSignal/useIndustryDash 等） |

### 2.4 应用层（L4）

| 目录 | 职责 | 关键内容 |
|------|------|---------|
| `src/apps/` | 五舱 App 分发器 | `cabinDispatcher.ts`（CABIN_APPS 懒加载映射 + CABIN_ADJACENCY 相邻舱预加载 + getActiveApp 特殊路由处理 + PRELOADERS 工厂）+ input/analysis/trading/output/command 五个子 App（各自内部子路由表） |

### 2.5 展示层（L5）

| 目录 | 职责 | 关键内容 |
|------|------|---------|
| `src/pages/` | 页面组件 | `HomePage.tsx`、`MockTestPage.tsx`、`command/MCPServerDashboardPage.tsx`（业务页面主要在各舱 App 内懒加载） |
| `src/components/` | UI 组件库 | `atoms/`（34 个基础件：Button/Card/Input/Tooltip/Modal/Badge/Skeleton/Progress/Tabs 等）、`molecules/`（Dialog/MetricCard/状态组件/表单件）、`organisms/`（agent/analysis/collection/input/news/output/pool/trading/system 等业务组件族）、`templates/`（PageContainer/PageHeader）、`widgets/`（WidgetShell + widgetRegistry 契约）、`chart/`（K线/雷达/热力图/散点/柱状 + indicators 指标库）、`cabin/`、`cockpit/`、`registry/`（组件注册表契约 + registryContract.test.ts） |
| `src/portal/` | 舱室壳层 | `PortalShell.tsx`（顶部五舱导航 + URL→CABINS 匹配激活舱 + preloadCabinApps 触发 + 驾驶舱入口） |
| `src/cockpit/` | 驾驶舱独立布局域 | `CockpitShell.tsx` + `shared/score.ts`（结果优先 USER_SCENES 视图） |

## 3. services/ 子域速查表（38 子域，按职能分组；已核对磁盘目录）

### 数据采集与接入

| 子域 | 核心文件 | 职责 |
|------|---------|------|
| `fetcher/` | `fetcherClient.ts`、`directDataAPI.ts`、`fetcherService.ts`、`types.ts`、`orchestrator/`（ports/adapters/phaseOrchestrator/resilienceChain 端口适配器架构）、`providers/`（tencentQuote/tencentKline/sinaQuote/akshare/neteaseHistory/mock）、`dataSourceRegistry.ts`、`fetcherAdapter.ts` | 数据源接入客户端：带超时/重试/健康检查的 HTTP 封装；腾讯/新浪/AKShare/网易 Provider；数据源注册表与编排器（端口适配器架构） |
| `data-collector/` | `collectionPipeline.ts`、`dataSourceOrchestrator.ts`、`adaptiveSourceOrchestrator.ts`、`TaskScheduler.ts`、`DataIntegrityGuard.ts`、`crossValidator.ts`、`collectors/`（BaseCollector→Live/Mock/Rest/WebSocket/NewsCrawler）、`adapters/`（tushareAdapter/westockMcpSource/tencentNewsMcpSource/ifindMcpCollector/llmSearchAgent + llmSearchCache） | 采集流水线：按维度配置生成数据源优先级 → 编排调用 → 写入 IndexedDB；真实源失败降级 mock；含多种外部适配器 |
| `fetcher` 根级 `collect.ts` | `fetchBasicData` / `fetchKlineData` | 前端侧 `/api/collect/*` 调用封装（遗留顶层服务文件） |
| `data-sync/` | `conflictResolver.ts`、`updateExecutor.ts`、`stalenessDetector.ts` | 双通道数据同步：冲突解析、字段合并（字段级合并+人工冲突）、过期检测、全局调度 |
| `data-sync-search/` | `searchEngine.ts`、`semanticSearcher.ts`、`historySearcher.ts` | 数据同步检索：代码/文档/历史/语义四向搜索 |
| `stock/` | `stockService.ts` | 个股基础服务 |
| `collection/` | `*.ts`（非 data-collector，是 collectionConfig/调度子域） | 采集配置与调度 |

### 评分与分析引擎

| 子域 | 核心文件 | 职责 |
|------|---------|------|
| `scoring/v6-engine/` | `engine.ts`（V6ScoreEngine：calculateLayer / calculateAll + 审计追踪 + 降级）、`config.ts`（零硬编码阈值/权重/行业基准/风险预警/置信度/RAG）、`calculators/`（lMinus1 / l0_l1_l2 / l3 + l3/(ddm.ts + l3a + l3v) / l4_l5_l6 / l7_l8 / chipDistribution / formulaVerifier）、`ragRetriever.ts`、`hallucinationDetector.ts`、`enhancer.ts`（LLM 增强）、`factorContributions.ts`、`crossModelValidator.ts` | V6 分层递进评分引擎（11 层计算器注册制）+ RAG + 幻觉检测 + 跨模型校验 |
| `scoring/`（根级服务） | `v6ScoreService.ts`（runV6Score / getV6ScoreQuality；注入到 feedbackOrchestrator/pipelineScheduler）、`intelligentScoreService.ts`、`industryScoreService.ts`、`hotSectorOrchestrator.ts`、`hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`、`rotationSignalDetector.ts`、`scoreAutoTrigger.ts` | 评分服务门面：V6 评分、智能评分、行业评分（SKILL-C/N）、热门板块、价值洼地、轮动信号三大策略编排 + 自动触发 |
| `scoring/rles-engine/` | `hardRiskDetector.ts`、`secondWaveDetector.ts`、`rlesBacktest.ts` | RLES 复盘引擎：硬风险检测、二波检测、校准与回测 |
| `analysis/` | `analysisOrchestrator.ts`、`screeningEngine.ts`、`industryAnalysisService.ts`、`sectorAnalysisEngine.ts` | 分析编排器、多因子筛选引擎、行业 V4 分析、板块分析 |
| `screening/` | `multiFactorScreeningEngine.ts` | 多因子筛选引擎 |
| `skills/` | `skillRegistry.ts` + 15 个 Skill（bullBearDebate/entrySignal/exitSignal/factorRegression 等） | 可插拔分析技能注册表 |
| `stock-analysis/` | `*.ts` | 个股分析子域 |

### 交易与组合

| 子域 | 核心文件 | 职责 |
|------|---------|------|
| `trading/` | `tradingService.ts`、`dualStrategyEngine.ts`、`riskEngine.ts`、`signalGenerator.ts`、`positionSizer.ts`、`tradeReviewAI.ts`（维度分析/LLM 增强/报告生成）、`use-cases/placeOrder.ts` | 交易核心：双策略引擎、信号生成、仓位计算、风险引擎、交易复盘 AI |
| `portfolio/` | `portfolioService.ts` | 投资组合管理 |
| `execution/` | `executionPlanService.ts`、`executionLogService.ts` | 执行计划与执行日志 |
| `backtest/` | `BacktestEngine.ts`、`backtestMetrics.ts` | 回测引擎与指标计算 |

### 输入与输出

| 子域 | 核心文件 | 职责 |
|------|---------|------|
| `input/` | `inputService.ts`、`batchImportService.ts`、`hotSectorService.ts`、`intentionPoolService.ts` | 股票录入、批量导入、热门板块、意向池 |
| `pool/` | `poolService.ts`、`collectionProgressService.ts` | 股票池服务与采集进度 |
| `output/` | `cycleRetrospective.ts`、`factorDashboard.ts`、`predictionVerifier.ts` | 周期复盘、因子看板、预测验证 |
| `export/` | `backtestExportService.ts` | 回测导出 |
| `file-import/` | `parsers/`（csv/excel/pdf/docx/markdown/json 六种解析器） | 统一文件导入与校对 |
| `profile/` | `profileService.ts`、`scoreEvidenceService.ts` | 八域资料体系与评分证据链 |
| `hybrid-proofread/` | `proofreadService.ts` | 混合校对逻辑（校对专用） |

### 系统、质量与横切

| 子域 | 核心文件 | 职责 |
|------|---------|------|
| `system/` | `bootstrapService.ts`（启动引导：DataBridge.init + PWA + RBAC + 密钥健康检查 + seedService + 编排器；关闭清理后台任务）、`seedService.ts`（幂等种子写入：默认股票池 → IndexedDB，返回 inserted/skipped/failed）、`systemService.ts`、`migration/` | 系统生命周期管理 |
| `llm/` | `llmClient.ts`（chat<T> 多 API 风格请求/配置校验/结构化输出解析/错误处理）、`llmGateway.ts`、`jsonParser.ts` | LLM 集成：AES-GCM 加密 Key（localStorage） |
| `news/` | `newsService.ts`、`sentimentAnalyzer.ts`、`stockLinker.ts` | 资讯服务、情感分析、个股关联 |
| `validation/` | `APISchemaValidator.ts`、`CrossSourceValidation.ts`、`DataFreshnessMonitor.ts` | 数据校验横切（Schema/跨源/新鲜度） |
| `storage/` | `storageFactory.ts`、`indexedDBProvider.ts`、`duckDBProvider.ts`、`vectorProvider.ts`、`hnswIndex.ts` | 存储抽象工厂（IDB/DuckDB/Vector/HNSW） |
| `evaluators/` | `rubricEvaluator.ts`、`consistencyEvaluator.ts` | AI 输出评估器（rubric 评分 + 一致性） |
| `useCase/` | 12 个 `*.useCase.ts`（getUnifiedStockView / generateTradeReview / rebalancePortfolio 等） | 用例层（Services → UI 的业务用例 Facade） |
| `shared/` | `shared utilities` | 跨子域共享工具 |
| `perf/` | `perfMonitor*.ts` | 性能监控与指标 |
| `lifecycle/` | `lifecycleHooks.ts` | 应用生命周期钩子 |
| `quality/` | `qualityGate*.ts` | 质量门禁辅助（非 scripts/ 审计，是运行时质量） |
| `rbac/` | `rbacService.ts` | 基于 RBAC 角色的权限（MCP UI 角色等） |
| `pwa/` | `pwaRegistry.ts` | PWA Service Worker 注册 |
| `orchestration/` | `*.ts` | 跨子域编排 |
| `ai-center/` | `*.ts` | AI 能力中心（智能体统一入口） |
| **根级横切** | `contracts.ts`（Result<T> + IService + BaseService + tryResult/tryResultSync）、`resilience.ts`（withRetry 指数退避 / createCircuitBreaker / withFallback + errorBus 上报）、`errorBus.ts`（captureError → 收敛 V9Error → 发布 ERROR_CAPTURED_EVENT）、`serviceRegistry.ts` | 服务层横切基础设施（契约/韧性/错误总线/注册表） |
| `workers/` | `v6ScoreWorker.ts`、`v6ScoreTaskScheduler.ts` | Web Worker：评分并行计算 + 调度（Worker 纯计算，禁 store/pages/components） |

## 4. Store 层重要 Store 一览（66 条注册表中挑核心；15 条 deprecated 已标记迁移目标）

| Store | 状态 | 职责 |
|-------|------|------|
| `tradingStore.ts` | active | 交易门面（向后兼容 Facade，委托 watchlistStore + signalAdviceStore） |
| `outputStore.ts` | active | 导出数据与导出状态（handleExport → exportAll） |
| `holdingsStore.ts` / `positionStore.ts` / `watchlistStore.ts` / `orderStore.ts` / `portfolioStore.ts` / `positionPoolStore.ts` | active | 持仓 / 仓位 / 自选 / 订单 / 组合 / 仓位池 |
| `marketDataStore.ts` / `searchStore.ts` | active | 行情与搜索 |
| `themeStore.ts` | active | 主题持久化（首屏前 getState() 应用） |
| `agentStore.ts` / `customAgentStore.ts` / `mcpServerStore.ts` / `chatStore.ts` | active | 智能体、自定义 Agent、MCP 管理、聊天 |
| `researchPoolStore.ts` / `intentionPoolStore.ts` | active | 研究池 / 意向池 |
| `collectionRuntimeStore.ts` / `collectionWizardStore.ts` | active | 采集运行时 / 采集向导 |
| `hotSectorStore.ts` / `rotationSignalStore.ts` / `valuePitStore.ts` | active | 三大策略状态 |
| `sevenDimConfigStore.ts` | active | 采集维度配置（历史沿用“七维”命名，实际已扩至十六维；data-collector Pipeline 触发源） |
| `riskStore.ts` / `dualStrategyStore.ts` / `signalStore.ts` / `signalAdviceStore.ts` / `signalQualityStore.ts` | active | 风险 / 双策略 / 信号 / 信号建议 / 信号质量 |
| `backtestStore.ts` / `strategySnapshotStore.ts` / `executionStore.ts` / `reviewLaunchStore.ts` | active | 回测 / 策略快照 / 执行 / 复盘启动 |
| `industryScoreStore.ts` / `industryDashboardStore.ts` / `sectorAnalysisStore.ts` | active | 行业评分 / 行业仪表盘 / 板块分析 |
| `intelligentScoreStore.ts` / `scoreDocStore.ts` | active | 智能评分 / 评分文档 |
| `multiFactorScreeningStore.ts` | active | 多因子筛选 |
| `pageStore.ts` / `workflowStore.ts` / `commandStore.ts` | active | 页面 / 工作流 / 总控舱 |
| `systemMonitorStore.ts` / `mechanismHealthStore.ts` / `perfMetricsStore.ts` | active | 系统监控 / 机制健康 / 性能指标 |
| `localKnowledgeStore.ts` | active | 本地知识库 |
| `dataflowStore.ts` / `databridgeStore.ts` / `dataSyncStore.ts` / `analysisHubStore.ts` / `analysisOrchestratorStore.ts` / `fileImportStore.ts` / `hybridProofreadStore.ts` / `tradingHubStore.ts` / `widgetStore.ts` | **deprecated**（15 条） | 已标记 supersededBy + deprecatedSince + removalTarget + reason（迁移中，V9.1.0 删除） |
| `storeRegistry.ts` | 注册表本身 | Store 层单一真相源（由 `node scripts/gen-store-service-registries.mjs` 生成，正向+反向门禁校验） |

## 5. 相似目录辨析（易混淆点）

| 目录对 | 区别 |
|--------|------|
| `src/agents/` vs `.agents/skills/` | 前者是**运行时代码**（智能体注册/调度，仅依赖 core/data）；后者是 **AI 技能定义文件**（SKILL.md，供 AI 工具加载，无运行时代码） |
| `src/lib/` vs `src/utils/` | `lib/` 是唯一有效库函数目录；`utils/` 已废弃 |
| `src/data/` vs `src/core/` | `data/` 持有 IndexedDB 连接（V6Database）、Schema/Migrations、仓储封装、dataLayer 子模块聚合；`core/` 持有 **DataBridge 桥 + ACL + 缓存 + handlerRegistry + fallbackQueue**（写操作最终委托 db 执行；读操作经 Cache+ACL 后调 db.get/getAll/getAllByIndex） |
| `src/config/` vs `src/constants/` | `config/` 含运行时可读取的**配置对象**（可带条件分支、可依赖 lib 白名单）；`constants/` 仅导出**纯静态常量**（零依赖，可参与类型推断） |
| `src/pages/` vs `src/apps/` | `pages/` 是**页面组件**（单个路由的 React 组件）；`apps/` 是五舱**分发器**（路由匹配后懒加载 pages/ 或自身内部 pages） |
| `src/store/` vs `src/services/` | Store 只管**状态 + 订阅 + selector + 跨 Tab 广播**；业务逻辑、外部 IO、数据写入一律下沉 Services |
| `src/services/fetcher/` vs `src/services/data-collector/` | `fetcher/` 是**底层 HTTP 客户端**（单请求超时/重试/健康检查 + Provider 家族）；`data-collector/` 是**七层采集流水线**（按维度配置多源优先级、编排多请求、写入 IDB、失败降级、调度器） |
| `src/data/` vs `src/data/gateway/` | `data/` 持有 IndexedDB 连接（V6Database）、Schema/Migrations、仓储、dataLayer 子模块聚合；`data/gateway/`（`index.ts`+`gateway.types.ts`）是**唯一允许直接操作 `dataLayer`/`db` 的门面**（`IGateway`/`DataGatewayImpl` 单例，含生命周期/事务/CRUD/批量/级联/数据管理/仓储工厂 8 类 API）。core 层统一 `import { gateway } from '@/data/gateway'`；services/store/pages 经 dataLayerStore → DataBridge → gateway 链路。直接 `import { db }` / 直接使用 IDBTransaction 属架构违规（audit:db-references 拦截） |

## 6. 下一站

- 这些模块内部的关键类/函数签名 → [03 关键类与函数](03-core-classes-functions.md)

---

## 🏁 修订记录摘要（v2.0.0 FINAL · 两轮共 24 项事实漂移）

**本文档涉及的 7 项修正：**

| # | 漂移项 | 旧值 | 新值（最终）| 核实真相源 |
|---|-------|------|-----------|----------|
| 1 | src/ 顶层目录数 | 24 | **21** | `Get-ChildItem -Directory src` |
| 2 | services 子域数 | 30+（粗略）| **38**（逐一列全目录）| `src/services/` 磁盘实查 |
| 3 | Store 注册表条目数 | 63 | **66**（51 active + 15 deprecated）| `storeRegistry.ts` 逐行 status 计数 |
| 4 | Store 磁盘文件数 | 63（与注册表混淆）| **78**（排除 \*.test.ts）| `Get-ChildItem src/store/*.ts -Exclude *.test.ts` |
| 5 | data/ 与 gateway/ 职责混淆 | 写为"数据网关" | **data/：DAO & 查询 DSL + gateway 门面**；`data/gateway/` 物理目录已存在（v1.7.0 闭环，`index.ts`+`gateway.types.ts`，`DataGatewayImpl` 单例），是唯一允许直写 `dataLayer`/`db` 的入口；core 层统一 `import { gateway }` | `src/data/gateway/` 文件实查 + AGENTS.md v1.7.0 契约 |
| 6 | scripts/ 目录 audit:\* 数 | 67 audit\* | **66 audit\*** | `package.json` 脚本前缀计数 |
| 7 | STORE_NAME 枚举数 | 50 左右 | **54**（与 DB_VERSION=36 对应）| `dbConfig.ts` L323-L388 逐行 |

> 完整 24 项漂移清单、两轮轮次归属、验证方法声明 → 见 [README.md §修订记录](README.md#🏁-修订记录--24-项事实漂移全清单v200-final)
