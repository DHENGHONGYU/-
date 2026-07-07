/**
 * @module store.derived
 * @description Store 派生查询统一导出
 *
 * 集中导出 5 个待接入 Store 的派生查询函数，便于 UI 组件按需导入。
 *
 * 使用方式：
 *   import {
 *     useIsExecutable,
 *     useScoreLevelDistribution,
 *     useStrengthDistribution,
 *     useMetrics,
 *     useCanSend,
 *   } from '@/store/derived'
 *
 * @since v2.2.0
 * @compliance AGENTS.md §一 分层规则
 */

// ═══════════════════════════════════════════════════════════════
// analysisStore 派生查询
// ═══════════════════════════════════════════════════════════════
export {
  // 类型
  type ScoreLevelDistribution,
  type TrendDirection,

  // 基础聚合
  isLoadingAny as analysisIsLoadingAny,
  errorUnion as analysisErrorUnion,
  hasError as analysisHasError,
  isStocksEmpty,
  isScoresEmpty,
  stocksCount,
  scoresCount,

  // 评分等级分布
  scoreLevelDistribution,
  getScoreLevelDistribution,

  // 按字段查找
  scoreBySymbol,
  stockBySymbol,
  stocksBySector,
  stocksByScoreRange,
  topStocks,

  // 趋势分析
  trendDirection,
  trendChangeRate,
  trendPeak,
  trendTrough,
  hasTrendData,

  // React Hooks
  useScoreLevelDistribution,
  useIsLoadingAny as useAnalysisIsLoadingAny,
  useErrorUnion as useAnalysisErrorUnion,
} from '@/store/analysisStore.derived'

// ═══════════════════════════════════════════════════════════════
// rotationSignalStore 派生查询
// ═══════════════════════════════════════════════════════════════
export {
  // 类型
  type StrengthDistribution,
  type SectorStat,
  type SignalConditionsDetail,

  // 基础聚合
  isSignalsEmpty,
  signalsCount,
  isLoading as rotationIsLoading,
  hasError as rotationHasError,

  // 信号筛选
  triggeredSignals,
  signalsByStrength,
  strongSignals,
  mediumSignals,
  weakSignals,
  bySector,

  // 统计聚合
  strengthDistribution,
  getStrengthDistribution,
  triggeredCount,
  triggeredRate,
  hasAnyTriggered,

  // 时间排序
  latestSignals,
  recentTriggered,

  // 板块聚合
  getSectorStats,
  isHotSector,
  hotSectors,
  signalConditions,

  // React Hooks
  useStrengthDistribution,
  useSectorStats,
  useTriggeredCount,
} from '@/store/rotationSignalStore.derived'

// ═══════════════════════════════════════════════════════════════
// riskStore 派生查询
// ═══════════════════════════════════════════════════════════════
export {
  // 类型
  type RiskLevelText,
  type CircuitStateText,
  type RiskTrendDirection,
  type SymbolRiskStats,
  type VerdictTimelineEntry,

  // 执行决策
  isExecutable,
  riskLevelText,
  latestVerdict,
  pendingBlocks,
  pendingWarnings,

  // 回路状态
  isCircuitOpen,
  needsManualIntervention,
  circuitStateText,
  isCircuitHalfOpen,

  // 风控统计
  blockedCount,
  warningCount,
  normalCount,
  blockedRate,
  verdictsCount,

  // 趋势分析
  riskTrend,
  riskTrendDirection,
  verdictsTimeline,

  // 按 symbol 聚合
  symbolRiskStats,

  // React Hooks
  useIsExecutable,
  useRiskLevelText,
  useIsCircuitOpen,
  usePendingBlocks,
} from '@/store/riskStore.derived'

// ═══════════════════════════════════════════════════════════════
// signalQualityStore 派生查询
// ═══════════════════════════════════════════════════════════════
export {
  // 类型
  type SignalQualityGrade,
  type SymbolQualityStats,
  type DirectionStat,
  type DateDistributionEntry,
  type SignalTypeStat,

  // 基础聚合
  hasMetrics,
  isReviewsEmpty,
  reviewsCount,
  isLoading as signalQualityIsLoading,
  hasError as signalQualityHasError,

  // 按 symbol 查询指标
  reviewsBySymbol as reviewsBySymbolDerived,
  accuracyBySymbol,
  winRateBySymbol,
  avgReturnBySymbol,
  signalQualityGrade,
  isLowQuality,

  // 方向与类型筛选
  reviewsByDirection,
  reviewsByType,
  reviewsByDateRange,
  recentReviews,

  // 盈亏分析
  profitableReviews,
  losingReviews,
  averageReturn,
  averageWin,
  averageLoss,
  bestReview,
  worstReview,

  // 方向统计
  getDirectionStats,
  topSignalTypes,

  // 趋势分析
  accuracyTrend,
  winRateTrend,

  // React Hooks
  useMetrics,
  useDirectionStats,
  useIsReviewsEmpty,
} from '@/store/signalQualityStore.derived'

// ═══════════════════════════════════════════════════════════════
// chatStore 派生查询
// ═══════════════════════════════════════════════════════════════
export {
  // 类型
  type MessageRole,
  type MessageStats,

  // 基础聚合
  messageCount,
  hasMessages,
  isEmpty as isChatEmpty,
  isLoading as chatIsLoading,
  hasError as chatHasError,

  // 消息访问
  lastMessage,
  lastUserMessage,
  lastAssistantMessage,
  currentStreamingMessage,

  // 发送状态
  canSend,
  streamingProgress,

  // 角色统计
  getMessageStats,
  messagesByRole,
  conversationTurns,

  // 上下文管理
  estimatedTokenCount,
  isOverContextLimit,
  messagesToTruncate,

  // 消息搜索
  searchMessages,
  messagesByDate,

  // React Hooks
  useCanSend,
  useLastMessage,
  useMessageStats,
  useIsEmpty as useIsChatEmpty,
} from '@/store/chatStore.derived'
