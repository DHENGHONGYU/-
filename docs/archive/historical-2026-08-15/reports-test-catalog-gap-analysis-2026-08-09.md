---
title: "Test Catalog 覆盖率差距分析报告"
type: report
version: v1.0.0
last_updated: 2026-08-11
doc_id: V9-DOC-FM-DOCS-REPORTS-TEST-CATALOG-GAP-ANALYSIS-2-018
tier: T2
maintainer: V9 Architecture Team
summary: "（自动补齐 frontmatter，待人工完善摘要）"
change_log:
  - version: v1.0.0
    changes: "补齐 frontmatter 元数据（baseline 2026-08-11，自动推断 type=report）"
    date: 2026-08-11
code_version: 2.0.0-rc.1
---
# Test Catalog 覆盖率差距分析报告

> 生成时间: 2026-08-09
> 生成脚本: `scripts/audit/analyze-test-catalog-gaps.mjs`

## 一、总体统计

| 指标 | 数量 | 占比 |
|---|---|---|
| 测试文件总数 | 534 | 100% |
| 已收录 | 160 | 30.0% |
| **未收录** | **374** | **70.0%** |

## 二、未收录文件子域分布

| # | 子域 | 标签 | 未收录数 | 有 @test_id | 无 @test_id |
|---|---|---|---|---|---|
| 1 | `other` | 其他 | 178 | 106 | 72 |
| 2 | `services-other` | 其他服务 | 49 | 31 | 18 |
| 3 | `store` | 状态管理 | 36 | 19 | 17 |
| 4 | `tests-integration` | 集成测试 | 36 | 25 | 11 |
| 5 | `components` | UI 组件 | 24 | 1 | 23 |
| 6 | `lib` | 工具库 | 19 | 5 | 14 |
| 7 | `scoring` | 评分引擎 | 9 | 9 | 0 |
| 8 | `skills` | 技能系统 | 8 | 8 | 0 |
| 9 | `hooks` | React Hooks | 5 | 0 | 5 |
| 10 | `pages` | 页面 | 4 | 1 | 3 |
| 11 | `config` | 配置 | 2 | 1 | 1 |
| 12 | `unit-tests` | 单元测试 | 2 | 2 | 0 |
| 13 | `analysis` | 分析服务 | 1 | 1 | 0 |
| 14 | `llm` | LLM 服务 | 1 | 1 | 0 |

## 三、分批处理建议

按子域未收录数量降序排列，建议按以下优先级分批补录：

### 优先级 P0（>20 个未收录，影响面大）

#### `other` — 其他（178 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/agents/__tests__/agentMcpDependency.test.ts` | V9-TEST-ST-001 | Agent MCP dependency invariant (F5) |
| 2 | `src/agents/__tests__/agentMcpReachability.test.ts` | V9-TEST-ST-002 | Agent → MCP Server 运行时可达性 |
| 3 | `src/agents/__tests__/agentRuntime.concurrency.test.ts` | V9-TEST-ST-003 | AgentRuntime concurrency via TaskQueue (F1) |
| 4 | `src/apps/cabinDispatcher.test.ts` | — | cabinDispatcher |
| 5 | `src/apps/input/InputDashboard.addStock.test.tsx` | — | InputDashboard + addStock 联动测试 |
| 6 | `src/cockpit/defaultWidgetBuilder.test.ts` | V9-TEST-ST-005 | DefaultWidgetBuilder |
| 7 | `src/cockpit/widgets/EngineStatusWidget.test.tsx` | — | EngineStatusWidget |
| 8 | `src/cockpit/widgets/FundFlowWidget.test.tsx` | — | FundFlowWidget (P0) |
| 9 | `src/cockpit/widgets/HotSectorWidget.test.tsx` | — | HotSectorWidget |
| 10 | `src/cockpit/widgets/KaiScoreWidget.test.tsx` | — | KaiScoreWidget |
| 11 | `src/cockpit/widgets/MarketIndicesWidget.test.tsx` | — | MarketIndicesWidget (P0) |
| 12 | `src/cockpit/widgets/ModelCompareWidget.test.tsx` | — | ModelCompareWidget (P1) |
| 13 | `src/cockpit/widgets/PnLAnalysisWidget.test.tsx` | — | PnLAnalysisWidget |
| 14 | `src/cockpit/widgets/PortfolioOverviewWidget.kpi-negative.test.tsx` | — | PortfolioOverviewWidget 回撤/夏普 - 数据驱动（防回归） |
| 15 | `src/cockpit/widgets/PortfolioOverviewWidget.test.tsx` | — | PortfolioOverviewWidget |
| 16 | `src/cockpit/widgets/PositionControlWidget.test.tsx` | — | PositionControlWidget |
| 17 | `src/cockpit/widgets/RiskMonitorWidget.test.tsx` | — | RiskMonitorWidget |
| 18 | `src/cockpit/widgets/SignalMonitorWidget.test.tsx` | — | SignalMonitorWidget |
| 19 | `src/cockpit/widgets/ValuePitWidget.test.tsx` | — | ValuePitWidget |
| 20 | `src/cockpit/widgets/WatchlistMoversWidget.test.tsx` | — | WatchlistMoversWidget |
| 21 | `src/cockpit/widgets/WatchlistWidget.test.tsx` | — | WatchlistWidget 颜色逻辑 |
| 22 | `src/constants/theme/theme.tokens.shades.test.ts` | — | twText |
| 23 | `src/core/acl.defensive.test.ts` | V9-TEST-ST-013 | AclEngine.check - 防御性逻辑（mocked ACL_MATRIX） |
| 24 | `src/core/acl.system-dimension.test.ts` | — | ACL 维度双向验证 - system 模块 |
| 25 | `src/core/cascadeExecutor.test.ts` | — | cascadeExecutor |
| 26 | `src/core/databridgeAcl.test.ts` | — | databridgeAcl |
| 27 | `src/core/databridgeAdapter.branch-coverage.test.ts` | — | DataBridgeAdapter — isProgrammingError 分支覆盖 (P0) |
| 28 | `src/core/databridgeAdapter.test.ts` | — | DataBridgeAdapter |
| 29 | `src/core/databridgeHandlers.edge.test.ts` | V9-TEST-ST-020 | databridgeHandlers (edge) |
| 30 | `src/core/databridgeHandlers.mutation.test.ts` | V9-TEST-ST-020 | databridgeHandlers (mutation) |
| 31 | `src/core/databridgeHandlers.test.ts` | V9-TEST-ST-020 | databridgeHandlers |
| 32 | `src/core/databridgeQueries.test.ts` | — | databridgeQueries |
| 33 | `src/core/databridgeRouter.test.ts` | — | databridgeRouter |
| 34 | `src/core/databridgeStrategyRouter.test.ts` | — | databridgeStrategyRouter |
| 35 | `src/core/entityValidators.test.ts` | — | entityValidators |
| 36 | `src/core/freshnessGuard.test.ts` | — | freshnessGuard |
| 37 | `src/core/poolTransitionEngine.test.ts` | — | poolTransitionEngine |
| 38 | `src/core/refreshCoordinator.test.ts` | — | refreshCoordinator |
| 39 | `src/core/stockCodeUtils.test.ts` | — | stockCodeUtils |
| 40 | `src/core/widgetEventBus.test.ts` | — | widgetEventBus |
| 41 | `src/data/audit.test.ts` | V9-TEST-ST-019 | stampAuditFields |
| 42 | `src/data/dataLayer.doc.test.ts` | — | scoreDocStore |
| 43 | `src/data/dataLayer.intelligent.test.ts` | — | intelligentScoreStore |
| 44 | `src/data/dataLayer.news.test.ts` | — | newsStore |
| 45 | `src/data/dataLayer.rotation.test.ts` | — | rotationScoreStore |
| 46 | `src/data/dataLayer.score.test.ts` | — | v6ScoreStore |
| 47 | `src/data/dataLayer.signal.test.ts` | — | signalStore |
| 48 | `src/data/dataLayer.stock.test.ts` | — | stockStore |
| 49 | `src/data/db.test.ts` | V9-TEST-ST-021 | runMigrations (D-01) |
| 50 | `src/data/repository.test.ts` | V9-TEST-ST-023 | createRepository — 读取路径 |
| 51 | `src/data/schemas/schema.stock.test.ts` | — | schema.stock |
| 52 | `src/data/sectorDefinitions.test.ts` | V9-TEST-DATA-010 | sectorDefinitions - getSectorPoolStocks NaN 兜底 |
| 53 | `src/mcp/__tests__/analysisServer.test.ts` | V9-TEST-ST-030 | AnalysisServer |
| 54 | `src/mcp/__tests__/backtestServer.test.ts` | V9-TEST-ST-031 | BacktestServer |
| 55 | `src/mcp/__tests__/cancellation.test.ts` | V9-TEST-ST-032 | CancellationManager |
| 56 | `src/mcp/__tests__/channel-verification.test.ts` | V9-TEST-ST-033 | MCP 通道端到端验证 — 20 只 A 股 |
| 57 | `src/mcp/__tests__/client.disabled.test.ts` | V9-TEST-ST-034 | MCPClient disabled-guard (F5) |
| 58 | `src/mcp/__tests__/core.test.ts` | V9-TEST-ST-035 | MCPServerBase |
| 59 | `src/mcp/__tests__/dataCollectorServer.test.ts` | V9-TEST-ST-036 | DataCollectorServer |
| 60 | `src/mcp/__tests__/elicitation.test.ts` | V9-TEST-ST-037 | ElicitationManager |
| 61 | `src/mcp/__tests__/executionServer.test.ts` | V9-TEST-ST-038 | ExecutionServer |
| 62 | `src/mcp/__tests__/fetcherServer.test.ts` | V9-TEST-ST-039 | DataFetcherServer |
| 63 | `src/mcp/__tests__/knowledgeServer.test.ts` | V9-TEST-ST-040 | KnowledgeServer |
| 64 | `src/mcp/__tests__/llmServer.test.ts` | V9-TEST-ST-041 | LLMServer |
| 65 | `src/mcp/__tests__/mcpAclInterceptor.test.ts` | V9-TEST-ST-042 | MCP ACL 权限矩阵配置 |
| 66 | `src/mcp/__tests__/newsServer.test.ts` | V9-TEST-ST-043 | NewsServer |
| 67 | `src/mcp/__tests__/notification.test.ts` | V9-TEST-ST-044 | NotificationManager |
| 68 | `src/mcp/__tests__/poolServer.test.ts` | V9-TEST-ST-045 | PoolServer |
| 69 | `src/mcp/__tests__/portfolioServer.test.ts` | V9-TEST-ST-046 | PortfolioServer |
| 70 | `src/mcp/__tests__/progress.test.ts` | V9-TEST-ST-047 | ProgressTracker |
| 71 | `src/mcp/__tests__/register.sync.test.ts` | V9-TEST-ST-048 | syncWithConfig (F2/F3): modulePath-based reconciliation |
| 72 | `src/mcp/__tests__/roots.test.ts` | V9-TEST-ST-049 | RootsManager |
| 73 | `src/mcp/__tests__/sampling.test.ts` | V9-TEST-ST-050 | SamplingHandler |
| 74 | `src/mcp/__tests__/screeningServer.test.ts` | V9-TEST-ST-051 | ScreeningServer |
| 75 | `src/mcp/__tests__/servers.test.ts` | V9-TEST-ST-052 | V6ScoringServer |
| 76 | `src/mcp/__tests__/systemServer.test.ts` | V9-TEST-ST-053 | SystemServer |
| 77 | `src/mcp/__tests__/tradingServer.test.ts` | V9-TEST-ST-054 | TradingServer |
| 78 | `src/mcp/__tests__/v6ScoringServer.test.ts` | V9-TEST-ST-055 | V6ScoringServer |
| 79 | `src/mcp/__tests__/workflowServer.test.ts` | V9-TEST-ST-056 | WorkflowServer |
| 80 | `src/portal/__tests__/PortalShell.logging.test.tsx` | — | PortalShell 日志埋点 |
| 81 | `src/showcase/__tests__/ComponentShowcase.test.tsx` | — | ComponentShowcasePage |
| 82 | `tests/agentConfigManager.test.ts` | V9-TEST-UT-001 | AgentConfigManager |
| 83 | `tests/agentHealthMonitor.test.ts` | V9-TEST-UT-002 | AgentHealthMonitor |
| 84 | `tests/agentRegistry.test.ts` | V9-TEST-UT-003 | AgentRegistry |
| 85 | `tests/BacktestPage.colors.test.tsx` | — | BacktestPage 颜色整改 - 批次 F |
| 86 | `tests/blueprints/dataRelationship.test.ts` | V9-TEST-UT-072 | V9 data relationship blueprint |
| 87 | `tests/bridge-integration.test.ts` | V9-TEST-UT-005 | Phase 1 桥接集成测试：Context ↔ Store 数据一致性 |
| 88 | `tests/chipDistribution.unit.test.ts` | — | calcDecayFactor |
| 89 | `tests/CockpitShell.panel.test.tsx` | — | CockpitShell 分栏面板布局 |
| 90 | `tests/color-remediation.widgets.test.tsx` | — | 颜色整改 - A 股惯例验证（批次 E） |
| 91 | `tests/CoreResourcePanel.test.tsx` | — | CoreResourcePanel |
| 92 | `tests/crawlerProvider.test.ts` | V9-TEST-UT-006 | crawlerProvider |
| 93 | `tests/data-sync.test.ts` | V9-TEST-UT-008 | P1-1: 全局调度引擎 |
| 94 | `tests/databridgeAdapter.test.ts` | V9-TEST-UT-010 | DataBridgeAdapter |
| 95 | `tests/databridgePriority.test.ts` | V9-TEST-UT-011 | DataBridge priority broadcast |
| 96 | `tests/databridgeStore.test.ts` | V9-TEST-UT-012 | databridgeStore |
| 97 | `tests/dataflowEngine.test.ts` | V9-TEST-UT-013 | DataFlowEngine SSE reconnect (DF-006) |
| 98 | `tests/dualStrategyEngine.test.ts` | V9-TEST-UT-019 | dualStrategyEngine |
| 99 | `tests/e2e-verify-25stocks.integration.test.ts` | V9-TEST-UT-020 | — |
| 100 | `tests/e2e-verify-redundancy.integration.test.ts` | V9-TEST-UT-021 | — |
| 101 | `tests/eventBus.test.ts` | V9-TEST-UT-023 | eventBus |
| 102 | `tests/factor-regression-analysis.test.ts` | V9-TEST-UT-024 | 板块1: 基本面评分因子体系 |
| 103 | `tests/fetcherFinancial.test.ts` | V9-TEST-UT-025 | fetcherService - 财务数据采集 |
| 104 | `tests/fetcherKline.test.ts` | V9-TEST-UT-026 | fetcherKline |
| 105 | `tests/fetcherService.test.ts` | V9-TEST-UT-027 | fetcherService |
| 106 | `tests/file-import.test.ts` | V9-TEST-UT-028 | P0-1: 统一文件校验 |
| 107 | `tests/full-module-verification.test.ts` | V9-TEST-UT-029 | ✅ 模块1: 预测校验引擎 — 量化校验 |
| 108 | `tests/HoldingsPage.test.tsx` | — | HoldingsPage - 页面渲染 |
| 109 | `tests/HomePage.test.tsx` | — | HomePage |
| 110 | `tests/HotSectorPanel.test.tsx` | — | HotSectorPanel |
| 111 | `tests/hotSectorService.test.ts` | V9-TEST-UT-031 | hotSectorService |
| 112 | `tests/HotSectorWidget.test.tsx` | — | HotSectorWidget |
| 113 | `tests/IndustryChainWidget.test.tsx` | — | IndustryChainWidget v2 |
| 114 | `tests/intelligentScore.test.ts` | V9-TEST-UT-032 | intelligent score service |
| 115 | `tests/intentionPoolStore.test.ts` | V9-TEST-UT-033 | intentionPoolStore.deleteItems |
| 116 | `tests/localDocService.test.ts` | V9-TEST-UT-034 | localDocService |
| 117 | `tests/LocalKnowledgePage.test.tsx` | — | LocalKnowledgePage |
| 118 | `tests/MigrationPanel.test.tsx` | — | MigrationPanel |
| 119 | `tests/MigrationSubComponents.test.tsx` | — | MigrationUploadTab |
| 120 | `tests/NewsPage.test.tsx` | — | NewsPage |
| 121 | `tests/output-module.test.tsx` | — | 预测校验引擎 |
| 122 | `tests/p2-2-search.test.ts` | V9-TEST-UT-038 | P2-2: 历史记录检索器 |
| 123 | `tests/p2-3-p3-2.test.tsx` | — | P2-3: searchStore |
| 124 | `tests/p2-p3.test.ts` | V9-TEST-UT-039 | P2-1: IndexedDB Store 扩展 |
| 125 | `tests/performance/engine.benchmark.test.ts` | V9-TEST-UT-075 | TD-001: 评分引擎性能基准测试 |
| 126 | `tests/performance/v6-engine.benchmark.test.ts` | V9-TEST-PERF-001 | V6 评分引擎性能基准测试 |
| 127 | `tests/permissionRevocationService.test.ts` | V9-TEST-UT-040 | 权限自动回收服务（PermissionRevocationService） |
| 128 | `tests/poolService.test.ts` | V9-TEST-UT-041 | poolService |
| 129 | `tests/poolTransitionEngine.test.ts` | V9-TEST-UT-042 | poolTransitionEngine |
| 130 | `tests/pwa.test.ts` | V9-TEST-UT-045 | PWA manifest.json |
| 131 | `tests/QualityIndicator.test.tsx` | — | QualityIndicator |
| 132 | `tests/remediation/d4-purelogic-invariant.test.ts` | V9-TEST-UT-076 | D4 纯逻辑不变量 · sentimentAnalyzer |
| 133 | `tests/remediation/dualStrategy-dedup-invariant.test.ts` | V9-TEST-UT-077 | dualStrategy 重复条件整改回归 — 单守卫不变量 |
| 134 | `tests/remediation/resilience-guard-c29.test.ts` | V9-TEST-UT-078 | C29 resilience guard — 熔断状态机（刻意保留的重复条件） |
| 135 | `tests/remediation/signal-dedup-invariant.test.ts` | V9-TEST-UT-079 | signalStore 重复条件整改回归 — De Morgan 反转守卫 |
| 136 | `tests/ResearchReportPage.test.tsx` | — | ResearchReportPage - 页面渲染 |
| 137 | `tests/ReviewWizardPage.test.tsx` | — | ReviewWizardPage - 页面渲染 |
| 138 | `tests/riskEngine.test.ts` | V9-TEST-UT-047 | riskEngine |
| 139 | `tests/rotationScoreService.test.ts` | V9-TEST-UT-048 | rotationScoreService |
| 140 | `tests/sanitizeLlmOutput.test.ts` | V9-TEST-UT-050 | sanitizeLlmOutput — LLM 输出消毒逻辑 |
| 141 | `tests/ScoreDocPage.test.tsx` | — | ScoreDocPage |
| 142 | `tests/scoring-strategy-audit-10stocks.test.ts` | — | — |
| 143 | `tests/scoringAdapter.test.ts` | V9-TEST-UT-052 | scoringAdapter |
| 144 | `tests/screeningEngine.test.ts` | V9-TEST-UT-053 | ScreeningEngine |
| 145 | `tests/secondary-verification.test.ts` | V9-TEST-UT-054 | 二次校对 1: 数据完整性核实 |
| 146 | `tests/SectorHeatmapWidget.test.tsx` | — | SectorHeatmapWidget |
| 147 | `tests/SectorRotationHeatmap.test.tsx` | — | SectorRotationHeatmap pure functions |
| 148 | `tests/sentimentAnalyzer.test.ts` | V9-TEST-UT-055 | sentimentAnalyzer |
| 149 | `tests/services/communitySyncService.test.ts` | V9-TEST-UT-092 | communitySyncService - 社区帖同步适配器 |
| 150 | `tests/services/MockCollector.test.ts` | V9-TEST-UT-081 | MockCollector - 随机数据生成（A/B/C 板块） |
| 151 | `tests/services/profileService.test.ts` | V9-TEST-UT-094 | domainToLayers - 域 → 评分层映射 |
| 152 | `tests/services/researchReportSyncService.test.ts` | V9-TEST-UT-095 | researchReportSyncService - 券商研报同步适配器 |
| 153 | `tests/services/storage/storageFactory.test.ts` | V9-TEST-UT-082 | StorageFactory |
| 154 | `tests/sevenDimConfig.integration.test.tsx` | — | Flux 集成测试 — 模板切换 → Store → UI |
| 155 | `tests/signalGenerator.test.ts` | V9-TEST-UT-056 | signalGenerator |
| 156 | `tests/signalPersistence.test.ts` | V9-TEST-UT-057 | Signal Persistence |
| 157 | `tests/strategyEngine.test.ts` | V9-TEST-UT-059 | strategyEngine |
| 158 | `tests/strategySnapshotExport.batch.test.ts` | V9-TEST-UT-063 | buildUniqueSheetName — Sheet 命名安全逻辑 |
| 159 | `tests/StrategySnapshotPage.lifecycle.test.tsx` | — | StrategySnapshotPage - lifecycle & tri-state validation |
| 160 | `tests/StrategySnapshotPage.test.tsx` | — | StrategySnapshotPage |
| 161 | `tests/strategySnapshotService.core-scarce.test.ts` | V9-TEST-UT-060 | strategySnapshotService — 核心稀缺组合验证 |
| 162 | `tests/strategySnapshotService.dedup-anomaly.test.ts` | V9-TEST-UT-062 | classifyStocks — 重复标的去重 + 异常评分处理 |
| 163 | `tests/strategySnapshotService.factor-key-mapping.test.ts` | V9-TEST-UT-060 | classifyStocks — 因子键映射兼容性 |
| 164 | `tests/strategySnapshotService.integrity.test.ts` | V9-TEST-UT-061 | strategySnapshotService — IndexedDB 数据完整性检查 |
| 165 | `tests/strategySnapshotService.test.ts` | V9-TEST-UT-060 | strategySnapshotService |
| 166 | `tests/themeRegistry.test.ts` | V9-TEST-UT-061 | themeRegistry |
| 167 | `tests/TradeReviewPage.flicker.test.tsx` | — | TradeReviewPage - 深色模式闪烁检测 |
| 168 | `tests/TradeReviewPage.test.tsx` | — | TradeReviewPage |
| 169 | `tests/tushareProvider.test.ts` | V9-TEST-UT-063 | tushareProvider |
| 170 | `tests/utils/testHelpers.test.tsx` | — | testHelpers - 缓存清理工具 |
| 171 | `tests/v6-score-discrimination.integration.test.ts` | V9-TEST-UT-065 | — |
| 172 | `tests/v6ExceptionHandling.test.ts` | V9-TEST-UT-066 | engine.ts 异常处理 |
| 173 | `tests/v6Lifecycle.test.ts` | V9-TEST-UT-067 | 数据校验测试 |
| 174 | `tests/v6MigrationService.test.ts` | V9-TEST-UT-068 | v6MigrationService |
| 175 | `tests/valuePitAnalyzer.test.ts` | V9-TEST-UT-069 | valuePitAnalyzer |
| 176 | `tests/ValuePitWidget.test.tsx` | — | ValuePitWidget |
| 177 | `tests/__order_a.test.ts` | V9-TEST-UT-070 | orderA |
| 178 | `tests/__order_b.test.ts` | V9-TEST-UT-071 | orderB |

#### `services-other` — 其他服务（49 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/services/data-collector/collectedDataSyncService.integration.test.ts` | — | collectedDataSyncService 端到端模拟 |
| 2 | `src/services/data-collector/collectedDataSyncService.test.ts` | — | buildSummaryMarkdown |
| 3 | `src/services/data-collector/multiSourceFetcher.test.ts` | — | calculatePearson |
| 4 | `src/services/data-sync/updateExecutor.test.ts` | — | updateExecutor — selectUpdateMode |
| 5 | `src/services/data-sync-search/historySearcher.test.ts` | — | searchHistory — 关键词搜索 |
| 6 | `src/services/evaluators/evaluators.test.ts` | V9-TEST-ST-074 | schemaEvaluator |
| 7 | `src/services/execution/executionPlanService.dataflow.test.ts` | V9-TEST-ST-120 | DataBridge → executionPlanService 数据流：初始化与路由 |
| 8 | `src/services/export/__tests__/csvExportService.test.ts` | — | csvExportService |
| 9 | `src/services/export/__tests__/v6DocxExportService.test.ts` | — | v6DocxExportService |
| 10 | `src/services/fetcher/contractValidation.test.ts` | — | contractValidation — validateStockQuote |
| 11 | `src/services/fetcher/directDataAPI.integration.test.ts` | V9-TEST-ST-189 | directDataAPI 集成测试 — Vite proxy + 港股代码转换 |
| 12 | `src/services/fetcher/directDataAPI.marketPrefix.test.ts` | V9-TEST-ST-188 | getMarketPrefix |
| 13 | `src/services/fetcher/strategyDataAdapter.edge.test.ts` | V9-TEST-ST-081 | toSafeNumber |
| 14 | `src/services/fetcher/strategyDataAdapter.validation.test.ts` | V9-TEST-ST-081 | toSafeEnum |
| 15 | `src/services/fetcher/__dirty-data-e2e-verify.test.ts` | V9-TEST-ST-083 | 场景 1: 用户报告场景 - sentiment 缺 institutionBuyCount/limitUpCount |
| 16 | `src/services/fetcher/__market-data-contract.test.ts` | V9-TEST-ST-084 | Mock 数据契约一致性 |
| 17 | `src/services/input/inputService.addStock.test.ts` | — | addStock 数据流测试（自动流转已移除） |
| 18 | `src/services/output/__tests__/cycleRetrospective.test.ts` | — | cycleRetrospective |
| 19 | `src/services/output/__tests__/factorDashboard.test.ts` | — | factorDashboard |
| 20 | `src/services/output/__tests__/predictionVerifier.test.ts` | — | predictionVerifier |
| 21 | `src/services/pool/collectionProgressService.test.ts` | V9-TEST-NEW-001 | collectionProgressService |
| 22 | `src/services/pool/poolService.test.ts` | — | poolService - 股票池服务 |
| 23 | `src/services/riskControlService.test.ts` | — | riskControlService |
| 24 | `src/services/screening/multiFactorScreeningEngine.test.ts` | V9-TEST-ST-107 | multiFactorScreeningEngine |
| 25 | `src/services/stock/FullMarketStockService.test.ts` | V9-TEST-ST-116 | stockDictionary helpers |
| 26 | `src/services/system/bootstrapService.test.ts` | V9-TEST-ST-117 | bootstrapService |
| 27 | `src/services/system/seedService.test.ts` | — | seedService — P0 修复验证 (seedService.ts) |
| 28 | `src/services/system/systemService.test.ts` | V9-TEST-ST-118 | loadSystemStats |
| 29 | `src/services/trading/riskComputer.test.ts` | — | riskComputer — computeRiskMetrics |
| 30 | `src/services/trading/tradeReviewAI.dimensions.test.ts` | V9-TEST-ST-119 | tradeReviewAI.dimensions |
| 31 | `src/services/trading/tradeReviewAI.llmEnhancer.test.ts` | V9-TEST-ST-120 | tradeReviewAI.llmEnhancer |
| 32 | `src/services/trading/tradeReviewAI.profileGenerator.test.ts` | V9-TEST-ST-121 | tradeReviewAI.profileGenerator |
| 33 | `src/services/trading/tradeReviewAI.reportGenerator.test.ts` | V9-TEST-ST-122 | tradeReviewAI.reportGenerator |
| 34 | `src/services/trading/tradeReviewAI.skillDevelopment.test.ts` | V9-TEST-ST-123 | tradeReviewAI.skillDevelopment |
| 35 | `src/services/trading/tradeReviewAI.test.ts` | V9-TEST-ST-124 | tradeReviewAI |
| 36 | `src/services/trading/tradeReviewAI.utils.test.ts` | V9-TEST-ST-125 | tradeReviewAI.utils |
| 37 | `src/services/trading/watchlistMoversService.test.ts` | V9-TEST-ST-126 | computeWatchlistMovers |
| 38 | `src/services/trading/__tests__/strategySnapshotExport.test.ts` | — | strategySnapshotExport |
| 39 | `src/services/trading/__tests__/strategySnapshotSchema.test.ts` | — | STRATEGY_SNAPSHOT_SCHEMA |
| 40 | `src/services/unifiedStockService.test.ts` | V9-TEST-ST-062 | getUnifiedStockView |
| 41 | `src/services/useCase/createExecutionPlan.useCase.test.ts` | V9-TEST-ST-127 | createExecutionPlanUseCase |
| 42 | `src/services/useCase/fetcherOrchestrator.useCase.test.ts` | V9-TEST-ST-128 | fetcherOrchestratorUseCase |
| 43 | `src/services/useCase/fetchIndustryDashboard.useCase.test.ts` | V9-TEST-ST-131 | fetchIndustryDashboardUseCase |
| 44 | `src/services/useCase/fetchSectorAnalysis.useCase.test.ts` | V9-TEST-ST-132 | fetchSectorAnalysisUseCase |
| 45 | `src/services/useCase/generateTradeReview.useCase.test.ts` | V9-TEST-ST-128 | generateTradeReviewUseCase（同步版） |
| 46 | `src/services/useCase/getUnifiedStockView.useCase.test.ts` | V9-TEST-ST-129 | getUnifiedStockViewUseCase |
| 47 | `src/services/useCase/hotSectorQuery.useCase.test.ts` | V9-TEST-ST-129 | hotSectorQueryUseCase |
| 48 | `src/services/useCase/rebalancePortfolio.useCase.test.ts` | V9-TEST-ST-129 | rebalancePortfolioUseCase |
| 49 | `src/services/useCase/runDualStrategy.useCase.test.ts` | V9-TEST-ST-128 | runDualStrategyUseCase |

#### `store` — 状态管理（36 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/store/agentFeedbackStore.test.ts` | V9-TEST-ST-203 | useAgentFeedbackStore |
| 2 | `src/store/analysisHubStore.test.ts` | — | useAnalysisHubStore |
| 3 | `src/store/analysisOrchestratorStore.test.ts` | V9-TEST-ST-210 | useAnalysisOrchestratorStore |
| 4 | `src/store/analysisStore.test.ts` | V9-TEST-ST-201 | useAnalysisStore |
| 5 | `src/store/chatStore.test.ts` | — | useChatStore |
| 6 | `src/store/collectionRuntimeStore.test.ts` | V9-TEST-ST-151 | useCollectionRuntimeStore |
| 7 | `src/store/customAgentStore.test.ts` | — | useCustomAgentStore |
| 8 | `src/store/databridgeStore.test.ts` | V9-TEST-UT-012 | databridgeStore |
| 9 | `src/store/dataSyncStore.test.ts` | — | useDataSyncStore |
| 10 | `src/store/dataTestStore.test.ts` | — | useDataTestStore |
| 11 | `src/store/fileImportStore.test.ts` | V9-TEST-ST-150 | useFileImportStore |
| 12 | `src/store/hybridProofreadStore.test.ts` | — | useHybridProofreadStore |
| 13 | `src/store/industryDashboardStore.test.ts` | — | useIndustryDashboardStore |
| 14 | `src/store/intentionPoolStore.test.ts` | — | intentionPoolStore 单元测试 |
| 15 | `src/store/loopStatusStore.test.ts` | — | loopStatusStore |
| 16 | `src/store/mechanismHealthStore.test.ts` | — | useMechanismHealthStore |
| 17 | `src/store/perfMetricsStore.test.ts` | V9-TEST-ST-204 | usePerfMetricsStore |
| 18 | `src/store/positionPoolStore.test.ts` | V9-TEST-ST-152 | positionPoolStore - 初始状态 |
| 19 | `src/store/predictionStore.test.ts` | — | usePredictionStore |
| 20 | `src/store/registrationContractStore.test.ts` | — | useRegistrationContractStore |
| 21 | `src/store/researchPoolStore.test.ts` | — | researchPoolStore 单元测试 |
| 22 | `src/store/runtimeTradingConfigStore.test.ts` | — | useRuntimeTradingConfigStore |
| 23 | `src/store/searchStore.test.ts` | — | useSearchStore |
| 24 | `src/store/sevenDimConfigStore.test.ts` | V9-TEST-ST-150 | useSevenDimConfigStore |
| 25 | `src/store/signalAdviceStore.test.ts` | — | useSignalAdviceStore |
| 26 | `src/store/strategySnapshotStore.test.ts` | V9-TEST-ST-158 | useStrategySnapshotStore |
| 27 | `src/store/systemMonitorStore.test.ts` | V9-TEST-ST-160 | useSystemMonitorStore |
| 28 | `src/store/themeStore.test.ts` | V9-TEST-ST-159 | themeStore |
| 29 | `src/store/tradingHubStore.test.ts` | V9-TEST-ST-160 | useTradingHubStore |
| 30 | `src/store/tradingStore.test.ts` | V9-TEST-ST-161 | useTradingStore |
| 31 | `src/store/valuePitStore.test.ts` | V9-TEST-ST-162 | valuePitStore |
| 32 | `src/store/watchlistStore.test.ts` | — | useWatchlistStore |
| 33 | `src/store/widgetStore.test.ts` | V9-TEST-ST-163 | widgetStore |
| 34 | `src/store/workflowStore.test.ts` | V9-TEST-ST-164 | useWorkflowStore |
| 35 | `src/store/__tests__/collectionWizardStore.test.ts` | V9-TEST-ST-166 | collectionWizardStore.utils |
| 36 | `src/store/__tests__/mcpServerStore.test.ts` | V9-TEST-ST-167 | useMCPServerStore |

#### `tests-integration` — 集成测试（36 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `tests/__tests__/Alert.test.tsx` | — | Alert 组件 |
| 2 | `tests/__tests__/core/cascadeExecutor.test.ts` | — | cascadeExecutor |
| 3 | `tests/__tests__/lib/safeCoerce.test.ts` | V9-TEST-UT-093 | safeCoerce — 类型安全强制转换工具 |
| 4 | `tests/__tests__/orchestrator/phaseOrchestrator.test.ts` | V9-TEST-UT-094 | PhaseOrchestrator |
| 5 | `tests/__tests__/orchestrator/resilienceChain.test.ts` | V9-TEST-UT-095 | ResilienceChain - fetchQuote() |
| 6 | `tests/__tests__/P2-new-atoms-smoke.test.tsx` | — | P2 新增原子组件 — 冒烟测试 |
| 7 | `tests/__tests__/regression/p1-fix-regression.test.ts` | V9-TEST-UT-096 | 路由注册完整性（防回归：路由404） |
| 8 | `tests/__tests__/scripts/audit-dead-code.test.ts` | V9-TEST-UT-097 | audit-dead-code.ts v3.4（白盒测试） |
| 9 | `tests/__tests__/scripts/audit-doc-sync.test.ts` | V9-TEST-UT-098 | audit-doc-sync.ts v3.0（白盒测试） |
| 10 | `tests/__tests__/scripts/audit-hardcode.test.ts` | V9-TEST-UT-099 | audit-hardcode.ts v3.0（白盒测试） |
| 11 | `tests/__tests__/scripts/audit-layer-calls.test.ts` | V9-TEST-UT-100 | audit-layer-calls.ts v3.0（白盒测试） |
| 12 | `tests/__tests__/scripts/audit-mapping-integrity.test.ts` | V9-TEST-UT-101 | audit-mapping-integrity.ts v2.2（白盒测试） |
| 13 | `tests/__tests__/scripts/audit-split-quality.test.ts` | V9-TEST-UT-102 | audit-split-quality 模块拆分质量审计器 |
| 14 | `tests/__tests__/scripts/audit-token-consumption.test.ts` | V9-TEST-UT-103 | audit-token-consumption.ts v3.0（白盒测试） |
| 15 | `tests/__tests__/scripts/color-tokens-audit-suite.test.ts` | V9-TEST-UT-104 | 颜色与设计令牌审计域 |
| 16 | `tests/__tests__/scripts/daily-doc-validation.test.ts` | V9-TEST-UT-105 | daily-doc-validation.ts 工具函数 |
| 17 | `tests/__tests__/scripts/doc-cross-ref-sync.test.ts` | V9-TEST-UT-106 | classifyLinkTarget — filePath 级归因分类 |
| 18 | `tests/__tests__/scripts/semantic-validation.test.ts` | V9-TEST-UT-107 | 语义级校验脚本 |
| 19 | `tests/__tests__/scripts/verify-all-routes.test.ts` | V9-TEST-UT-108 | verify-all-routes.ts v3.0（白盒测试） |
| 20 | `tests/__tests__/services/orchestration/qualityGate.test.ts` | — | QualityGate |
| 21 | `tests/__tests__/services/orchestration/registrationOrchestrator.test.ts` | — | RegistrationOrchestrator |
| 22 | `tests/__tests__/services/orchestration/scoreCalibrator.test.ts` | — | ScoreCalibrator |
| 23 | `tests/__tests__/services/scoreDocComparison.test.ts` | V9-TEST-UT-109 | buildScoreComparison |
| 24 | `tests/__tests__/services/semanticSearcher.test.ts` | — | semanticSearcher (TF-IDF 模式) |
| 25 | `tests/__tests__/services/trading-use-cases.test.ts` | — | Trading Use Cases - placeOrder |
| 26 | `tests/__tests__/SevenDimConfigPage.test.tsx` | — | SevenDimConfigPage - 页面渲染 |
| 27 | `tests/__tests__/sevenDimConfigStore.test.ts` | V9-TEST-UT-086 | sevenDimConfigStore - 初始状态 |
| 28 | `tests/__tests__/SignalQualityTrendChart.test.tsx` | — | SignalQualityTrendChart 组件 |
| 29 | `tests/__tests__/snapshot/api-snapshot.test.ts` | V9-TEST-UT-110 | API 响应快照测试 |
| 30 | `tests/__tests__/snapshot/schema-snapshot.test.ts` | V9-TEST-UT-111 | 数据 Schema 快照测试 |
| 31 | `tests/__tests__/store/analysisStore.derived.test.ts` | V9-TEST-UT-112 | analysisStore.derived.ts 派生查询单元测试 |
| 32 | `tests/__tests__/store/chatStore.derived.test.ts` | V9-TEST-UT-113 | chatStore.derived.ts 派生查询单元测试 |
| 33 | `tests/__tests__/store/intentionPoolStore.test.ts` | — | intentionPoolStore.ts 单元测试 |
| 34 | `tests/__tests__/store/riskStore.derived.test.ts` | V9-TEST-UT-114 | riskStore.derived.ts 派生查询单元测试 |
| 35 | `tests/__tests__/store/rotationSignalStore.derived.test.ts` | V9-TEST-UT-115 | rotationSignalStore.derived.ts 派生查询单元测试 |
| 36 | `tests/__tests__/store/signalQualityStore.derived.test.ts` | V9-TEST-UT-116 | signalQualityStore.derived.ts 派生查询单元测试 |

#### `components` — UI 组件（24 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/components/atoms/ComplianceDisclaimer.test.tsx` | — | ComplianceDisclaimer |
| 2 | `src/components/atoms/Radio.test.tsx` | — | Radio |
| 3 | `src/components/atoms/Select.test.tsx` | — | Select |
| 4 | `src/components/chart/industry/IndustryHeatmap.test.tsx` | — | IndustryHeatmap 独立复检（验收闸门一档实跑） |
| 5 | `src/components/chart/industry/IndustryV4Panel.test.tsx` | — | IndustryV4Panel |
| 6 | `src/components/chart/industry/TrendLineChart.test.tsx` | — | TrendLineChart |
| 7 | `src/components/chart/industry/ValuationDistribution.test.tsx` | — | buildHistogram |
| 8 | `src/components/molecules/MetricCard.test.tsx` | — | MetricCard |
| 9 | `src/components/organisms/agent/__tests__/StandardAgentDetail.test.tsx` | — | StandardAgentDetail |
| 10 | `src/components/organisms/analysis/score/__tests__/IntelligentScoreExplanation.test.tsx` | — | IntelligentScoreExplanation |
| 11 | `src/components/organisms/analysis/score/__tests__/MultiPeriodTrendChart.test.tsx` | — | MultiPeriodTrendChart |
| 12 | `src/components/organisms/input/ApiTestDialog.test.tsx` | — | ApiTestDialog |
| 13 | `src/components/organisms/input/InputFlowErrorBoundary.test.tsx` | — | InputFlowErrorBoundary |
| 14 | `src/components/organisms/news/NewsCard.test.tsx` | — | NewsCard 独立复检（验收闸门一档实跑） |
| 15 | `src/components/organisms/output/__tests__/CycleRetrospectiveView.test.tsx` | — | CycleRetrospectiveView |
| 16 | `src/components/organisms/output/__tests__/reviewArtifact.test.ts` | — | reviewArtifact |
| 17 | `src/components/organisms/shared/ErrorBoundary.test.tsx` | — | ErrorBoundary |
| 18 | `src/components/organisms/shared/installGlobalErrorHandler.test.ts` | V9-TEST-ST-010 | installGlobalErrorHandler |
| 19 | `src/components/organisms/shared/PageSkeleton.test.tsx` | — | PageSkeleton |
| 20 | `src/components/organisms/shared/RouteErrorBoundary.test.tsx` | — | RouteErrorBoundary |
| 21 | `src/components/organisms/shared/ScoreFactorDeltaPanel.test.tsx` | — | ScoreFactorDeltaPanel |
| 22 | `src/components/organisms/shared/ScoreUpdateAlert.test.tsx` | — | ScoreUpdateAlert |
| 23 | `src/components/organisms/system/SystemArchitectureDiagram.test.tsx` | — | SystemArchitectureDiagram |
| 24 | `src/components/organisms/trading/RiskControlPanel.test.tsx` | — | RiskControlPanel 双向验证 |

### 优先级 P1（10-20 个未收录）

#### `lib` — 工具库（19 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/lib/batchQueue.test.ts` | — | batchQueue |
| 2 | `src/lib/derivedCache.test.ts` | — | derivedCache |
| 3 | `src/lib/errors.test.ts` | — | errors |
| 4 | `src/lib/eventBus.test.ts` | — | eventBus |
| 5 | `src/lib/format.test.ts` | — | formatFieldValue() |
| 6 | `src/lib/localStorageCrypto.test.ts` | — | localStorageCrypto |
| 7 | `src/lib/localStorageManager.test.ts` | V9-TEST-ST-024 | LocalStorageManager — 压力测试 |
| 8 | `src/lib/perf.test.ts` | — | perf |
| 9 | `src/lib/precision.test.ts` | — | 金融数值格式化 |
| 10 | `src/lib/rolePermissionMapper.test.ts` | — | rolePermissionMapper |
| 11 | `src/lib/safeCoerce.test.ts` | — | toSafeNumber() |
| 12 | `src/lib/safeRegex.test.ts` | — | safeRegex |
| 13 | `src/lib/seededRandom.test.ts` | — | seededRandom |
| 14 | `src/lib/utils/portfolioMetrics.test.ts` | — | portfolioMetrics 双向验证 |
| 15 | `src/lib/validation/__market-data-contract.test.ts` | V9-TEST-ST-029 | validateQuote |
| 16 | `src/lib/validation.test.ts` | V9-TEST-ST-026 | 股票代码验证 |
| 17 | `src/lib/webVitals.test.ts` | — | webVitals |
| 18 | `src/lib/withBroadcast.test.ts` | V9-TEST-ST-027 | withBroadcast |
| 19 | `src/lib/xssSanitizer.test.ts` | V9-TEST-ST-028 | escapeHtml |

### 优先级 P2（5-9 个未收录）

#### `scoring` — 评分引擎（9 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/services/scoring/v6-engine/calculators/l0_l1_l2.test.ts` | V9-TEST-ST-100 | judgeLongTermTrend |
| 2 | `src/services/scoring/v6-engine/calculators/l3/helpers.test.ts` | V9-TEST-ST-105 | scoreMoat |
| 3 | `src/services/scoring/v6-engine/calculators/l3.test.ts` | V9-TEST-ST-101 | scoreMoat |
| 4 | `src/services/scoring/v6-engine/calculators/l4_l5_l6.test.ts` | V9-TEST-ST-102 | buildScenarios (via L4ScenarioCalculator evidence) |
| 5 | `src/services/scoring/v6-engine/calculators/l7_l8.test.ts` | V9-TEST-ST-103 | diagnoseLifeStage 生命阶段诊断 |
| 6 | `src/services/scoring/v6-engine/calculators/lMinus1.test.ts` | V9-TEST-ST-104 | matchIndustry 行业匹配 |
| 7 | `src/services/scoring/v6-engine/v6-engine.test.ts` | V9-TEST-ST-099 | L-1 行业评分估值 |
| 8 | `src/services/scoring/v6ScoreService.test.ts` | V9-TEST-ST-095 | getAllV6Scores |
| 9 | `src/services/scoring/valuePitAnalyzer.test.ts` | V9-TEST-ST-096 | calculateCatalyst |

#### `skills` — 技能系统（8 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/services/skills/analysisConclusionSkill.test.ts` | V9-TEST-ST-108 | analysisConclusionSkill |
| 2 | `src/services/skills/batchDSkills.test.ts` | V9-TEST-ST-109 | Batch D LLM layer skills |
| 3 | `src/services/skills/batchESkills.test.ts` | V9-TEST-ST-110 | Batch E trading skills |
| 4 | `src/services/skills/factorRegressionSkill.test.ts` | V9-TEST-ST-111 | factorRegressionSkill |
| 5 | `src/services/skills/industryScoreMappingSkill.test.ts` | V9-TEST-ST-112 | industryScoreMappingSkill |
| 6 | `src/services/skills/selfPurificationSkill.test.ts` | V9-TEST-ST-113 | selfPurificationSkill |
| 7 | `src/services/skills/skillRegistry.test.ts` | V9-TEST-ST-114 | SkillRegistry |
| 8 | `src/services/skills/trendTechnicalTimingSkill.test.ts` | V9-TEST-ST-115 | trendTechnicalTimingSkill |

#### `hooks` — React Hooks（5 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/hooks/useConfirmDialog.test.tsx` | — | useConfirmDialog |
| 2 | `src/hooks/useFreshData.test.ts` | — | useFreshData |
| 3 | `src/hooks/useMediaQuery.test.ts` | — | TC-HOOK-1 BREAKPOINT 常量导出 |
| 4 | `src/hooks/usePoolBoard.test.ts` | — | usePoolBoard |
| 5 | `src/hooks/useToast.test.tsx` | — | useToast |

### 优先级 P3（<5 个未收录）

#### `pages` — 页面（4 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/pages/command/agent/__tests__/AgentFeedbackPage.test.tsx` | — | AgentFeedbackPage |
| 2 | `src/pages/command/agent/__tests__/AgentTasksPage.test.tsx` | — | AgentTasksPage |
| 3 | `src/pages/command/agent/__tests__/AgentTriggerPage.test.tsx` | — | AgentTriggerPage |
| 4 | `src/pages/input/CollectTask/hooks/useCollectionTaskStats.test.ts` | V9-TEST-ST-058 | useCollectionTaskStats |

#### `config` — 配置（2 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/config/config-source-governance.test.ts` | — | 6.1 配置源与适配层验证 |
| 2 | `src/config/secretConfig.rotation.test.ts` | V9-TEST-SEC-007 | secretConfig 密钥轮换机制 |

#### `unit-tests` — 单元测试（2 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `tests/unit/rolePermissionMapper.test.ts` | V9-TEST-UT-083 | rolePermissionMapper |
| 2 | `tests/unit/sevenDimEstimate.test.ts` | V9-TEST-UT-084 | 七维采集额度预估计算 |

#### `analysis` — 分析服务（1 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/services/analysis/analysisOrchestrator.test.ts` | V9-TEST-ST-063 | AnalysisOrchestrator |

#### `llm` — LLM 服务（1 个未收录）

| # | 文件路径 | @test_id | 首个 describe | 
|---|---|---|---|
| 1 | `src/services/llm/llmStressTest.test.ts` | V9-TEST-ST-092 | LLM 高并发压测 — 熔断器触发与拦截 |

## 四、补录策略建议

1. **P0 子域优先处理**：数量大、影响面广，建议立即补录
2. **有 @test_id 的文件优先**：已有标识，补录成本低
3. **无 @test_id 的文件需补充标识**：补录时同步添加 @test_id
4. **跨子域集成测试统一收录**：在 test-catalog.md §3.6 下统一管理
5. **CI 守护**：补录完成后，将 `audit-test-catalog-coverage.mjs` 加入 CI 防止回退
