/**
 * Service 注册表（自动生成 — 单一事实源）
 *
 * @description
 * 本文件为 audit:registry 的 Service 层数据源，与 componentRegistry 同为注册表门禁的单一事实源。
 * 原 storeRegistry 因数据损坏被移除，重新生成。原文档已归档至 archive/historical-2026-08-16/batch7/。
 *
 * 生成方式：node scripts/gen-store-service-registries.mjs
 * 维护约定：新增 / 移除 Service 后重新运行上述脚本同步本文件；
 *           audit:registry 正向校验条目指向文件存在、反向校验磁盘文件均已登记。
 * ⚠️ 同名 id 冲突 1 条（不同目录下同名文件，保留多条 id 相同条目；audit 反向检查按文件名匹配，不影响校验）：
 *   - PortfolioService: src/services/portfolio/portfolioService vs src/services/trading/portfolioService
 * 生成时间：2026-08-15 09:46:46
 */

export interface ServiceRegistryEntry {
  /** 条目标识（PascalCase，与文件名 camelCase 对应） */
  id: string
  /** 相对 src 的路径（不含扩展名，供 resolveRegistryPath 解析） */
  filePath: string
  /** 状态（默认 active） */
  status: 'active'
}

export const SERVICE_REGISTRY: ReadonlyArray<ServiceRegistryEntry> = [
  { id: 'AiMemoryService', filePath: 'src/services/system/aiMemoryService', status: 'active' },
  { id: 'AnalysisService', filePath: 'src/services/analysis/analysisService', status: 'active' },
  { id: 'ArchitectureService', filePath: 'src/services/system/architectureService', status: 'active' },
  { id: 'BacktestExportService', filePath: 'src/services/export/backtestExportService', status: 'active' },
  { id: 'BatchImportService', filePath: 'src/services/input/batchImportService', status: 'active' },
  { id: 'BootstrapService', filePath: 'src/services/system/bootstrapService', status: 'active' },
  { id: 'CollectedDataSyncService', filePath: 'src/services/data-collector/collectedDataSyncService', status: 'active' },
  { id: 'CollectionProgressService', filePath: 'src/services/pool/collectionProgressService', status: 'active' },
  { id: 'CollectionReportService', filePath: 'src/services/data-collector/collectionReportService', status: 'active' },
  { id: 'KimiAIService', filePath: 'src/services/data-collector/kimiAIService', status: 'active' },
  { id: 'KimiAIStrategy', filePath: 'src/services/data-collector/kimiAIStrategy', status: 'active' },
  { id: 'CollectionService', filePath: 'src/services/pool/collectionService', status: 'active' },
  { id: 'CommunitySyncService', filePath: 'src/services/profile/communitySyncService', status: 'active' },
  { id: 'ConfigExportService', filePath: 'src/services/collection/configExportService', status: 'active' },
  { id: 'CrossValidator', filePath: 'src/services/data-collector/crossValidator', status: 'active' },
  { id: 'CustomAgentService', filePath: 'src/services/system/customAgentService', status: 'active' },
  { id: 'DataCleanupService', filePath: 'src/services/storage/DataCleanupService', status: 'active' },
  { id: 'DeduplicationService', filePath: 'src/services/storage/DeduplicationService', status: 'active' },
  { id: 'ExecutionLogService', filePath: 'src/services/execution/executionLogService', status: 'active' },
  { id: 'ExecutionPlanService', filePath: 'src/services/execution/executionPlanService', status: 'active' },
  { id: 'FeedbackService', filePath: 'src/services/feedbackService', status: 'active' },
  { id: 'FetcherService', filePath: 'src/services/fetcher/fetcherService', status: 'active' },
  { id: 'FullMarketStockService', filePath: 'src/services/stock/FullMarketStockService', status: 'active' },
  { id: 'HashService', filePath: 'src/services/hybrid-proofread/hashService', status: 'active' },
  { id: 'HealthDashboardService', filePath: 'src/services/system/healthDashboardService', status: 'active' },
  { id: 'HotSectorService', filePath: 'src/services/input/hotSectorService', status: 'active' },
  { id: 'IndustryAnalysisService', filePath: 'src/services/analysis/industryAnalysisService', status: 'active' },
  { id: 'IndustryScoreService', filePath: 'src/services/scoring/industryScoreService', status: 'active' },
  { id: 'InputService', filePath: 'src/services/input/inputService', status: 'active' },
  { id: 'IntelligentScoreService', filePath: 'src/services/scoring/intelligentScoreService', status: 'active' },
  { id: 'IntentionPoolService', filePath: 'src/services/input/intentionPoolService', status: 'active' },
  { id: 'LocalDocService', filePath: 'src/services/system/localDocService', status: 'active' },
  { id: 'LocalDocSyncService', filePath: 'src/services/profile/localDocSyncService', status: 'active' },
  { id: 'LocalEmbeddingService', filePath: 'src/services/system/localEmbeddingService', status: 'active' },
  { id: 'McpCollector', filePath: 'src/services/data-collector/mcpCollector', status: 'active' },
  { id: 'MechanismMonitorService', filePath: 'src/services/system/mechanismMonitorService', status: 'active' },
  { id: 'MonitorLogService', filePath: 'src/services/system/monitorLogService', status: 'active' },
  { id: 'NewsService', filePath: 'src/services/news/newsService', status: 'active' },
  { id: 'NewsStatsService', filePath: 'src/services/pool/newsStatsService', status: 'active' },
  { id: 'NewsSyncService', filePath: 'src/services/profile/newsSyncService', status: 'active' },
  { id: 'NoticeSyncService', filePath: 'src/services/profile/noticeSyncService', status: 'active' },
  { id: 'ObservationPoolReviewer', filePath: 'src/services/orchestration/observationPoolReviewer', status: 'active' },
  { id: 'ParseAccuracyService', filePath: 'src/services/validation/ParseAccuracyService', status: 'active' },
  { id: 'PermissionRevocationService', filePath: 'src/services/rbac/permissionRevocationService', status: 'active' },
  { id: 'PoolService', filePath: 'src/services/pool/poolService', status: 'active' },
  { id: 'PortfolioService', filePath: 'src/services/portfolio/portfolioService', status: 'active' },
  { id: 'TradingPortfolioService', filePath: 'src/services/trading/portfolioService', status: 'active' },
  { id: 'ProfileIntegrationService', filePath: 'src/services/analysis/profileIntegrationService', status: 'active' },
  { id: 'ProfileService', filePath: 'src/services/profile/profileService', status: 'active' },
  { id: 'QualityMetricsService', filePath: 'src/services/quality/QualityMetricsService', status: 'active' },
  { id: 'RbacManagementService', filePath: 'src/services/rbac/rbacManagementService', status: 'active' },
  { id: 'RegistrationContractService', filePath: 'src/services/analysis/registrationContractService', status: 'active' },
  { id: 'ResearchPipelineOrchestrator', filePath: 'src/services/orchestration/researchPipelineOrchestrator', status: 'active' },
  { id: 'ResearchReportSyncService', filePath: 'src/services/profile/researchReportSyncService', status: 'active' },
  { id: 'RiskControlService', filePath: 'src/services/riskControlService', status: 'active' },
  { id: 'RotationScoreService', filePath: 'src/services/analysis/rotationScoreService', status: 'active' },
  { id: 'SampleBasket', filePath: 'src/services/scoring/rles-engine/calibration/sampleBasket', status: 'active' },
  { id: 'RlesBreadthFactorService', filePath: 'src/services/scoring/rles-engine/breadthFactor', status: 'active' },
  { id: 'RlesChipBridgeService', filePath: 'src/services/scoring/rles-engine/chipBridge', status: 'active' },
  { id: 'RlesBacktest', filePath: 'src/services/scoring/rles-engine/rlesBacktest', status: 'active' },
  { id: 'RlesCalibration', filePath: 'src/services/scoring/rles-engine/calibration/rlesCalibration', status: 'active' },
  { id: 'RlesHardRiskDetectorService', filePath: 'src/services/scoring/rles-engine/hardRiskDetector', status: 'active' },
  { id: 'RlesReviewLaunchEvaluatorService', filePath: 'src/services/scoring/rles-engine/reviewLaunchEvaluator', status: 'active' },
  { id: 'RlesSectorScoreBridgeService', filePath: 'src/services/scoring/rles-engine/sectorScoreBridge', status: 'active' },
  { id: 'ScoreDocArchiveService', filePath: 'src/services/profile/scoreDocArchiveService', status: 'active' },
  { id: 'ScoreDocService', filePath: 'src/services/analysis/scoreDocService', status: 'active' },
  { id: 'ScoreEvidenceService', filePath: 'src/services/profile/scoreEvidenceService', status: 'active' },
  { id: 'ScorePageService', filePath: 'src/services/analysis/scorePageService', status: 'active' },
  { id: 'ScoreTrendService', filePath: 'src/services/analysis/scoreTrendService', status: 'active' },
  { id: 'SeedService', filePath: 'src/services/system/seedService', status: 'active' },
  { id: 'SimilarStockRecallService', filePath: 'src/services/analysis/similarStockRecallService', status: 'active' },
  { id: 'StrategySnapshotService', filePath: 'src/services/trading/strategySnapshotService', status: 'active' },
  { id: 'StressTestService', filePath: 'src/services/perf/stressTestService', status: 'active' },
  { id: 'SystemMonitorService', filePath: 'src/services/system/systemMonitorService', status: 'active' },
  { id: 'SystemService', filePath: 'src/services/system/systemService', status: 'active' },
  { id: 'TagService', filePath: 'src/services/profile/tagService', status: 'active' },
  { id: 'TracePersistenceService', filePath: 'src/services/data-collector/tracePersistenceService', status: 'active' },
  { id: 'TradingService', filePath: 'src/services/trading/tradingService', status: 'active' },
  { id: 'UnifiedStockService', filePath: 'src/services/unifiedStockService', status: 'active' },
  { id: 'V6MigrationService', filePath: 'src/services/system/v6MigrationService', status: 'active' },
  { id: 'V6ScoreService', filePath: 'src/services/scoring/v6ScoreService', status: 'active' },
]
