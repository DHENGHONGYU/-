/**
 * Store 注册表（自动生成 — 单一事实源）
 *
 * @description
 * 本文件为 audit:registry 的 Store 层数据源，与 componentRegistry 同为注册表门禁的单一事实源。
 * 原 storeRegistry 因数据损坏被移除，重新生成。原文档已归档至 archive/historical-2026-08-16/batch7/。
 *
 * 生成方式：node scripts/gen-store-service-registries.mjs
 * 维护约定：新增 / 移除 Store 后重新运行上述脚本同步本文件；
 *           audit:registry 正向校验条目指向文件存在、反向校验磁盘文件均已登记。
 *
 * 生成时间：2026-08-15 09:46:46
 */

export interface StoreRegistryEntry {
  /** 条目标识（PascalCase，与文件名 camelCase 对应） */
  id: string
  /** 相对 src 的路径（不含扩展名，供 resolveRegistryPath 解析） */
  filePath: string
  /**
   * 状态：
   *   - active: 当前被 UI/Service/其他 Store 消费
   *   - deprecated: 已实现但无真实消费者，待清理（含 deprecationMeta）
   */
  status: 'active' | 'deprecated'
  /** 当 status='deprecated' 时必填，记录废弃元信息 */
  deprecationMeta?: {
    /** 替代实现（若无填 null） */
    supersededBy: string | null
    /** 废弃时间 */
    deprecatedSince: string
    /** 计划移除版本/日期 */
    removalTarget: string
    /** 废弃理由 */
    reason: string
  }
}

export const STORE_REGISTRY: ReadonlyArray<StoreRegistryEntry> = [
  { id: 'AgentFeedbackStore', filePath: 'src/store/agentFeedbackStore', status: 'active' },
  { id: 'AgentStore', filePath: 'src/store/agentStore', status: 'active' },
  { id: 'AnalysisHubStore', filePath: 'src/store/analysisHubStore', status: 'deprecated', deprecationMeta: { supersededBy: 'AnalysisStore', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '功能并入 AnalysisStore，无 UI/Service 消费者' } },
  { id: 'AnalysisNewsStore', filePath: 'src/store/analysisNewsStore', status: 'active' },
  { id: 'AnalysisOrchestratorStore', filePath: 'src/store/analysisOrchestratorStore', status: 'deprecated', deprecationMeta: { supersededBy: 'AnalysisStore', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '编排职责上移至 services/analysis，无 UI/Service 消费者' } },
  { id: 'AnalysisStore', filePath: 'src/store/analysisStore', status: 'active' },
  { id: 'BacktestStore', filePath: 'src/store/backtestStore', status: 'active' },
  { id: 'ChatStore', filePath: 'src/store/chatStore', status: 'active' },
  { id: 'CollectionRuntimeStore', filePath: 'src/store/collectionRuntimeStore', status: 'active' },
  { id: 'CollectionWizardStore', filePath: 'src/store/collectionWizardStore', status: 'active' },
  { id: 'CommandStore', filePath: 'src/store/commandStore', status: 'active' },
  { id: 'CustomAgentStore', filePath: 'src/store/customAgentStore', status: 'active' },
  { id: 'DatabridgeStore', filePath: 'src/store/databridgeStore', status: 'deprecated', deprecationMeta: { supersededBy: 'dataBridge service', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: 'DataBridge 信封协议已迁移至 services/dataBridge，Store 层不再承载' } },
  { id: 'DataflowStore', filePath: 'src/store/dataflowStore', status: 'deprecated', deprecationMeta: { supersededBy: 'collectionPipeline + collectionRuntimeStore', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '数据流编排迁移至 collectionPipeline，Store 无消费者' } },
  { id: 'DataSyncStore', filePath: 'src/store/dataSyncStore', status: 'deprecated', deprecationMeta: { supersededBy: 'collectionRuntimeStore', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '同步职责由 collectionRuntimeStore 承载，无消费者' } },
  { id: 'DataTestStore', filePath: 'src/store/dataTestStore', status: 'active' },
  { id: 'DisciplineStore', filePath: 'src/store/disciplineStore', status: 'active' },
  { id: 'DualStrategyStore', filePath: 'src/store/dualStrategyStore', status: 'active' },
  { id: 'EngineStore', filePath: 'src/store/engineStore', status: 'active' },
  { id: 'ExecutionStore', filePath: 'src/store/executionStore', status: 'active' },
  { id: 'FileImportStore', filePath: 'src/store/fileImportStore', status: 'deprecated', deprecationMeta: { supersededBy: 'fileImportRecords dataLayer store', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '文件导入记录已下沉至 dataLayer 持久化，Store 层无消费者' } },
  { id: 'HoldingsStore', filePath: 'src/store/holdingsStore', status: 'active' },
  { id: 'HotSectorStore', filePath: 'src/store/hotSectorStore', status: 'active' },
  { id: 'HybridProofreadStore', filePath: 'src/store/hybridProofreadStore', status: 'deprecated', deprecationMeta: { supersededBy: 'proofreadService', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '混合校对逻辑迁移至 services/proofread，Store 无消费者' } },
  { id: 'IndustryDashboardStore', filePath: 'src/store/industryDashboardStore', status: 'active' },
  { id: 'IndustryScoreStore', filePath: 'src/store/industryScoreStore', status: 'active' },
  { id: 'InputHubStore', filePath: 'src/store/inputHubStore', status: 'active' },
  { id: 'IntelligentScoreStore', filePath: 'src/store/intelligentScoreStore', status: 'active' },
  { id: 'IntentionPoolStore', filePath: 'src/store/intentionPoolStore', status: 'active' },
  { id: 'LocalKnowledgeStore', filePath: 'src/store/localKnowledgeStore', status: 'active' },
  { id: 'LoopStatusStore', filePath: 'src/store/loopStatusStore', status: 'active' },
  { id: 'MarketDataStore', filePath: 'src/store/marketDataStore', status: 'active' },
  { id: 'McpServerStore', filePath: 'src/store/mcpServerStore', status: 'active' },
  { id: 'MechanismHealthStore', filePath: 'src/store/mechanismHealthStore', status: 'active' },
  { id: 'MultiFactorScreeningStore', filePath: 'src/store/multiFactorScreeningStore', status: 'active' },
  { id: 'OrderStore', filePath: 'src/store/orderStore', status: 'active' },
  { id: 'OutputStore', filePath: 'src/store/outputStore', status: 'active' },
  { id: 'PageStore', filePath: 'src/store/pageStore', status: 'active' },
  { id: 'PerfMetricsStore', filePath: 'src/store/perfMetricsStore', status: 'active' },
  { id: 'PortfolioStore', filePath: 'src/store/portfolioStore', status: 'active' },
  { id: 'PositionPoolStore', filePath: 'src/store/positionPoolStore', status: 'active' },
  { id: 'PositionStore', filePath: 'src/store/positionStore', status: 'active' },
  { id: 'PredictionStore', filePath: 'src/store/predictionStore', status: 'active' },
  { id: 'RegistrationContractStore', filePath: 'src/store/registrationContractStore', status: 'active' },
  { id: 'ResearchPoolStore', filePath: 'src/store/researchPoolStore', status: 'active' },
  { id: 'RiskStore', filePath: 'src/store/riskStore', status: 'active' },
  { id: 'RotationSignalStore', filePath: 'src/store/rotationSignalStore', status: 'active' },
  { id: 'RuntimeTradingConfigStore', filePath: 'src/store/runtimeTradingConfigStore', status: 'active' },
  { id: 'ScoreDocStore', filePath: 'src/store/scoreDocStore', status: 'active' },
  { id: 'SearchStore', filePath: 'src/store/searchStore', status: 'active' },
  { id: 'SectorAnalysisStore', filePath: 'src/store/sectorAnalysisStore', status: 'active' },
  { id: 'SevenDimConfigStore', filePath: 'src/store/sevenDimConfigStore', status: 'active' },
  { id: 'SignalAdviceStore', filePath: 'src/store/signalAdviceStore', status: 'active' },
  { id: 'SignalQualityStore', filePath: 'src/store/signalQualityStore', status: 'active' },
  { id: 'SignalStore', filePath: 'src/store/signalStore', status: 'active' },
  { id: 'StrategySnapshotStore', filePath: 'src/store/strategySnapshotStore', status: 'active' },
  { id: 'SystemMonitorStore', filePath: 'src/store/systemMonitorStore', status: 'active' },
  { id: 'ThemeStore', filePath: 'src/store/themeStore', status: 'active' },
  { id: 'TradingHubStore', filePath: 'src/store/tradingHubStore', status: 'deprecated', deprecationMeta: { supersededBy: 'tradingStore', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: '交易舱 Hub 职责并入 tradingStore，无 UI/Service 消费者' } },
  { id: 'TradingStore', filePath: 'src/store/tradingStore', status: 'active' },
  { id: 'ValuePitStore', filePath: 'src/store/valuePitStore', status: 'active' },
  { id: 'WatchlistStore', filePath: 'src/store/watchlistStore', status: 'active' },
  { id: 'WidgetStore', filePath: 'src/store/widgetStore', status: 'deprecated', deprecationMeta: { supersededBy: 'componentRegistry + widgetRegistry', deprecatedSince: '2026-08-15', removalTarget: 'v9.1.0', reason: 'Widget 元数据已由 componentRegistry 统一管理，Store 无消费者' } },
  { id: 'WorkflowStore', filePath: 'src/store/workflowStore', status: 'active' },
]
