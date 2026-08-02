/**
 * Store 注册表（自动生成 — 单一事实源）
 *
 * @description
 * 本文件为 audit:registry 的 Store 层数据源，与 componentRegistry 同为注册表门禁的单一事实源。
 * 原 storeRegistry 因数据损坏被移除，本文档依 docs/reference/03-architecture-standards.md 标注"待重建"重新生成。
 *
 * 生成方式：node scripts/gen-store-service-registries.mjs
 * 维护约定：新增 / 移除 Store 后重新运行上述脚本同步本文件；
 *           audit:registry 正向校验条目指向文件存在、反向校验磁盘文件均已登记。
 *
 * 生成时间：2026-07-16 15:28:55
  * @doc [V9-DOC-ARCH-004, V9-DOC-DATA-032, V9-DOC-DATA-031, V9-DOC-DATA-076, V9-DOC-DATA-075]
*/

export interface StoreRegistryEntry {
  /** 条目标识（PascalCase，与文件名 camelCase 对应） */
  id: string
  /** 相对 src 的路径（不含扩展名，供 resolveRegistryPath 解析） */
  filePath: string
  /** 状态：active=有生产消费者；unused=已实现但无 UI/store 消费者（@unused 标注） */
  status: 'active' | 'unused'
}

/**
 * STORE_REGISTRY
 */
export const STORE_REGISTRY: ReadonlyArray<StoreRegistryEntry> = [
  { id: 'AgentFeedbackStore', filePath: 'src/store/agentFeedbackStore', status: 'active' },
  { id: 'AgentStore', filePath: 'src/store/agentStore', status: 'active' },
  { id: 'AnalysisHubStore', filePath: 'src/store/analysisHubStore', status: 'unused' },
  { id: 'AnalysisNewsStore', filePath: 'src/store/analysisNewsStore', status: 'active' },
  { id: 'AnalysisOrchestratorStore', filePath: 'src/store/analysisOrchestratorStore', status: 'unused' },
  { id: 'AnalysisStore', filePath: 'src/store/analysisStore', status: 'active' },
  { id: 'BacktestStore', filePath: 'src/store/backtestStore', status: 'active' },
  { id: 'ChatStore', filePath: 'src/store/chatStore', status: 'active' },
  { id: 'CollectionRuntimeStore', filePath: 'src/store/collectionRuntimeStore', status: 'active' },
  { id: 'CollectionWizardStore', filePath: 'src/store/collectionWizardStore', status: 'active' },
  { id: 'CommandStore', filePath: 'src/store/commandStore', status: 'active' },
  { id: 'CustomAgentStore', filePath: 'src/store/customAgentStore', status: 'active' },
  { id: 'DatabridgeStore', filePath: 'src/store/databridgeStore', status: 'unused' },
  { id: 'DataflowStore', filePath: 'src/store/dataflowStore', status: 'unused' },
  { id: 'DataSyncStore', filePath: 'src/store/dataSyncStore', status: 'unused' },
  { id: 'DataTestStore', filePath: 'src/store/dataTestStore', status: 'active' },
  { id: 'DisciplineStore', filePath: 'src/store/disciplineStore', status: 'active' },
  { id: 'DualStrategyStore', filePath: 'src/store/dualStrategyStore', status: 'active' },
  { id: 'EngineStore', filePath: 'src/store/engineStore', status: 'active' },
  { id: 'ExecutionStore', filePath: 'src/store/executionStore', status: 'active' },
  { id: 'FileImportStore', filePath: 'src/store/fileImportStore', status: 'unused' },
  { id: 'HoldingsStore', filePath: 'src/store/holdingsStore', status: 'active' },
  { id: 'HotSectorStore', filePath: 'src/store/hotSectorStore', status: 'active' },
  { id: 'HybridProofreadStore', filePath: 'src/store/hybridProofreadStore', status: 'unused' },
  { id: 'IndustryScoreStore', filePath: 'src/store/industryScoreStore', status: 'active' },
  { id: 'InputHubStore', filePath: 'src/store/inputHubStore', status: 'active' },
  { id: 'IntelligentScoreStore', filePath: 'src/store/intelligentScoreStore', status: 'active' },
  { id: 'IntentionPoolStore', filePath: 'src/store/intentionPoolStore', status: 'active' },
  { id: 'LocalKnowledgeStore', filePath: 'src/store/localKnowledgeStore', status: 'active' },
  { id: 'MarketDataStore', filePath: 'src/store/marketDataStore', status: 'active' },
  { id: 'McpServerStore', filePath: 'src/store/mcpServerStore', status: 'active' },
  { id: 'MechanismHealthStore', filePath: 'src/store/mechanismHealthStore', status: 'active' },
  { id: 'MultiFactorScreeningStore', filePath: 'src/store/multiFactorScreeningStore', status: 'active' },
  { id: 'OrderStore', filePath: 'src/store/orderStore', status: 'active' },
  { id: 'OutputStore', filePath: 'src/store/outputStore', status: 'active' },
  { id: 'PageStore', filePath: 'src/store/pageStore', status: 'active' },
  { id: 'PerfMetricsStore', filePath: 'src/store/perfMetricsStore', status: 'active' },
  { id: 'PortfolioStore', filePath: 'src/store/portfolioStore', status: 'active' },
  { id: 'PositionPoolStore', filePath: 'src/store/positionPoolStore', status: 'unused' },
  { id: 'PositionStore', filePath: 'src/store/positionStore', status: 'active' },
  { id: 'PredictionStore', filePath: 'src/store/predictionStore', status: 'active' },
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
  { id: 'TradingHubStore', filePath: 'src/store/tradingHubStore', status: 'unused' },
  { id: 'TradingStore', filePath: 'src/store/tradingStore', status: 'active' },
  { id: 'ValuePitStore', filePath: 'src/store/valuePitStore', status: 'active' },
  { id: 'RegistrationContractStore', filePath: 'src/store/registrationContractStore', status: 'active' },
  { id: 'WatchlistStore', filePath: 'src/store/watchlistStore', status: 'active' },
  { id: 'WidgetStore', filePath: 'src/store/widgetStore', status: 'unused' },
  { id: 'WorkflowStore', filePath: 'src/store/workflowStore', status: 'active' },
]
