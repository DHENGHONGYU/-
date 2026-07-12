/**
 * @fileoverview 契约验证器统一导出
 * @description 提供契约验证器的所有公共 API
 */

// ============================================================
// 验证器核心
// ============================================================

export {
  // 契约注册
  registerContract,
  registerContracts,
  getRegisteredContracts,
  // 契约验证
  assertContract,
  checkContract,
  // 违反记录管理
  getViolations,
  clearViolations,
  // 统计与报告
  getStats,
  resetStats,
  generateReport,
} from './contractValidator'

// ============================================================
// DataBridge 契约
// ============================================================

export {
  // Schema 定义
  BridgeQueryResultSchema,
  BridgeQueryOptionsSchema,
  DataBridgeAdapterConfigSchema,
  DataBridgeAdapterStatsSchema,
  DataActionSchema,
  // 工厂函数
  createMockBridgeQueryResult,
  createMockBridgeQueryOptions,
  // 类型导出
  type BridgeQueryResultContract,
  type BridgeQueryOptionsContract,
  type DataBridgeAdapterConfigContract,
  type DataBridgeAdapterStatsContract,
  type DataActionContract,
} from './databridge.contract'

// ============================================================
// Envelope 契约
// ============================================================

export {
  // Schema 定义
  EnvelopeMetaSchema,
  StandardEnvelopeSchema,
  // 工厂函数
  createMockEnvelope,
  createMockEnvelopeMeta,
  // 类型导出
  type EnvelopeMetaContract,
  type StandardEnvelopeContract,
} from './envelope.contract'

// ============================================================
// Fetcher 契约
// ============================================================

export {
  // Schema 定义
  CollectResponseSchema,
  HealthCheckResponseSchema,
  CollectBasicDataSchema,
  CollectKlineDataSchema,
  // 工厂函数
  createMockCollectResponse,
  createMockHealthCheckResponse,
  createMockCollectBasicData,
  // 类型导出
  type HealthCheckResponseContract,
  type CollectBasicDataContract,
  type CollectKlineDataContract,
} from './fetcher.contract'

// ============================================================
// Engine 契约
// ============================================================

export {
  // Schema 定义
  LayerIdSchema,
  ChipLevelSchema,
  V6ScoreWeightsConfigSchema,
  V6ScoreThresholdsConfigSchema,
  ConfidenceConfigSchema,
  IndustryBenchmarkSchema,
  RiskWarningConfigSchema,
  IPCConfigSchema,
  V6ScoreEngineConfigSchema,
  AuditEntrySchema,
  FactorContributionSchema,
  ScoreAuditTrailSchema,
  EngineConfigSchema,
  DataflowStatsSchema,
  AgentRuntimeStatsSchema,
  EngineStatsSchema,
  EngineLifecycleEventSchema,
  EngineHealthAlertEventSchema,
  EngineMonitorSnapshotSchema,
  // 工厂函数
  createMockLayerId,
  createMockEngineStats,
  createMockEngineConfig,
  // 类型导出
  type LayerIdContract,
  type EngineStatsContract,
  type EngineConfigContract,
  type V6ScoreEngineConfigContract,
  type ScoreAuditTrailContract,
} from './engine.contract'

// ============================================================
// Strategy 契约
// ============================================================

export {
  // Schema 定义
  HotSectorDimensionsSchema,
  HotSectorScoreSchema,
  ValuePitDimensionsSchema,
  ValuePitScoreSchema,
  RotationConditionsSchema,
  RotationSignalSchema,
  StrategySignalSchema,
  WatchlistCandidateSchema,
  StrategySummarySchema,
  DualStrategyResultSchema,
  DualStrategyRuleConfigSchema,
  StrategyGroupItemSchema,
  // 工厂函数
  createMockHotSectorScore,
  createMockValuePitScore,
  createMockRotationSignal,
  createMockDualStrategyResult,
  createMockStrategySignal,
  // 类型导出
  type HotSectorScoreContract,
  type ValuePitScoreContract,
  type RotationSignalContract,
  type DualStrategyResultContract,
  type StrategySignalContract,
} from './strategy.contract'

// ============================================================
// Store 契约
// ============================================================

export {
  // Schema 定义
  SignalStateSchema,
  PoolStateSchema,
  MarketDataStateSchema,
  // 工厂函数
  createMockSignalState,
  createMockPoolState,
  createMockMarketDataState,
  // 类型导出
  type SignalStateContract,
  type PoolStateContract,
  type MarketDataStateContract,
} from './store.contract'
