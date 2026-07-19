/**
 * @fileoverview 数据层类型定义（barrel re-export）
 *
 * 原单文件 types.ts（914 行），现拆分为 13 个子模块，本文件作为统一入口。
 * 所有 API 保持完全兼容，外部引用方无需修改任何 import 语句。
 *
 * 拆分结构（2026-07-07 PR-1）：
 * - types/types.dataLayer.ts: L0 基础层（dbConfig re-export + DataLayerResult）
 * - types/types.execution.ts: 执行计划域（ExecutionPlan/RiskCheckItem/ExecutionLog/MissingReport）
 * - types/types.stock.ts: 股票基础域（Stock/FinancialReport/StockDataQuality/PoolGroupMeta）
 * - types/types.score.ts: 评分域（V6Score/DimensionScore/IntelligentScore/IndustryScore）
 * - types/types.order.ts: 订单域（Order/Watchlist）
 * - types/types.portfolio.ts: 组合域（Portfolio/PortfolioHolding/RebalanceAction）
 * - types/types.strategy.ts: 策略域（StrategyResult/HotSectorScore/ValuePitScore/DualStrategyResult）
 * - types/types.signal.ts: 信号域（Signal/SignalSnapshot/ResearchLog）
 * - types/types.marketData.ts: 行情数据域（KlineBar/DailyQuotes）
 * - types/types.sector.ts: 板块评分域（SectorDefinition/SectorScoreRecord）
 * - types/types.rotation.ts: 轮动域（RotationFactor/RotationSectorScore/MarketStyle）
 * - types/types.scoreDoc.ts: 评分文档域（ScoreDocVersion/V6LayerScore/StrategySnapshot）
 * - types/types.knowledge.ts: 知识库/资讯域（LocalDoc/NewsArticle/SentimentCache）
 * - types/types.sevenDimensions.ts: 七维数据域（DataDimensionType/GlobalMeta/UnifiedStockData）
 * - types.ts（本文件）: barrel re-export，保持原 API 兼容
 *
 * 使用方式：
 * import type { Stock, Order, V6Score } from '@/data/types'
 *
 * @module data/types
 * @updated 2026-07-07 - PR-1：拆分为 13 个子模块，保持原 API 兼容
  * @doc [V9-DOC-QA-066]
*/

// ============================================================
// L0 基础层（dbConfig re-export + DataLayerResult）
// ============================================================
export type {
  AccountType,
  DataSource,
  OrderDirection,
  OrderStatus,
  ResearchStatus,
  PoolStatus,
  PoolType,
} from './types/types.dataLayer'
export type { DataLayerResult } from './types/types.dataLayer'

// ============================================================
// 执行计划域
// ============================================================
export type {
  ExecutionPhase,
  ExecutionPlan,
  RiskCheckItem,
  ExecutionLog,
  MissingReport,
} from './types/types.execution'

// ============================================================
// 股票基础域
// ============================================================
export type {
  StockDataQuality,
  FinancialReport,
  Stock,
  PoolGroupMeta,
} from './types/types.stock'

// ============================================================
// 评分域
// ============================================================
export type {
  V6Score,
  DimensionScore,
  IntelligentScore,
  IndustryDimensionScore,
  IndustryScore,
} from './types/types.score'

// ============================================================
// 订单域
// ============================================================
export type { Order, Watchlist } from './types/types.order'

// ============================================================
// 组合域
// ============================================================
export type {
  PortfolioHolding,
  Portfolio,
  RebalanceAction,
} from './types/types.portfolio'

// ============================================================
// 策略域
// ============================================================
export type {
  StrategyClassification,
  StrategyCandidate,
  StrategyResult,
  HotSectorDimensionScores,
  HotSectorScore,
  ValuePitDimensionScores,
  ValuePitScore,
  DualStrategyResult,
} from './types/types.strategy'

// ============================================================
// 信号域
// ============================================================
export type { SignalSnapshot, Signal, ResearchLog } from './types/types.signal'

// ============================================================
// 行情数据域
// ============================================================
export type { KlineBar, DailyQuotes } from './types/types.marketData'

// ============================================================
// 板块评分域
// ============================================================
export type {
  SectorScoreDimensions,
  SectorUsChinaData,
  SectorDefinition,
  SectorStockMapping,
  SectorScoreRecord,
} from './types/types.sector'

// ============================================================
// 轮动域
// ============================================================
export type {
  MarketStyle,
  RotationSubFactor,
  RotationFactor,
  RotationSignalGrade,
  RotationScoreBucket,
  RotationAlertLevel,
  DeclineNature,
  RotationSectorScore,
} from './types/types.rotation'

// ============================================================
// 评分文档域
// ============================================================
export type {
  V6LayerScore,
  ScoreDocVersion,
  FileLibraryStats,
  StrategyGroupSnapshot,
  StrategySnapshot,
} from './types/types.scoreDoc'

// ============================================================
// 知识库/资讯域
// ============================================================
export type {
  LocalDoc,
  NewsArticle,
  NewsStockMap,
  SentimentCache,
  NewsBookmark,
} from './types/types.knowledge'

// ============================================================
// 七维数据域
// ============================================================
export type {
  DataDimensionType,
  DataDimensionMeta,
  DimensionStatus,
  StockMeta,
  GlobalMeta,
  UnifiedStockData,
} from './types/types.sevenDimensions'

// ============================================================
// 混合校对域
// ============================================================
export type {
  FileType,
  RiskLevel,
  CheckStatus,
  FileHash,
  HashVerifyRequest,
  HashVerifyResponse,
  RiskDetail,
  RuleConfig,
  RulePackage,
  RuleMatchResult,
  LocalScanResult,
  CloudRiskResult,
  ProofreadReport,
  PerformanceMetric,
  RulesSyncResult,
  HashBatchVerifyRequest,
  HashBatchVerifyResponse,
  RiskDetailsRequest,
  RiskDetailsResponse,
} from './types/types.hybridProofread'

// ── 阶段 B-1：自定义智能体（v26 新增） ──
export type { CustomAgent, CustomAgentType, CustomAgentApiConfig } from './types/types.customAgent'

// ── 采集与工作流类型（v27/v28 新增，支撑 dataLayer 暴露） ──
export type { PersistedWizardConfig } from './types/types.collectConfig'
export type { CollectionTraceSpan } from './types/types.traceRecords'
export type {
  WorkflowDef,
  WorkflowRun,
  ScheduleDef,
  TriggerDef,
} from './types/types.workflow'

// ── Schema 迁移追踪记录类型 ──
export type { SchemaMigrationRecord } from './types/types.schemaMigrations'

// ── 交易复盘持久化实体（v29 新增，P1-3 类型归位） ──
export type { TradeReviewRecord } from './types/types.tradeReview'

// ── RBAC 6 表持久化实体（v24 新增，P2-1 类型归位） ──
export type {
  RbacUser,
  RbacRole,
  RbacPermission,
  RbacUserRole,
  RbacRolePermission,
  RbacPermissionAuditLog,
} from './types/types.rbac'
