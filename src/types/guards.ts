/**
 * V9 通用类型守卫函数
 *
 * @description
 * 集中定义跨模块复用的类型守卫（type guard）函数，简化业务层与组件层的类型收窄。
 * 所有函数遵循 `value is T` 谓词签名，可在条件分支中自动收窄类型。
 *
 * @module types/guards
 * @created 2026-06-30 - G1 批次低风险优化（类型守卫函数补充）
  * @doc [V9-DOC-QA-066]
*/

import type {
  DailyQuotes,
  ExecutionPlan,
  HotSectorScore,
  IndustryScore,
  IntelligentScore,
  LocalDoc,
  NewsArticle,
  NewsBookmark,
  NewsStockMap,
  Order,
  OrderDirection,
  OrderStatus,
  ResearchLog,
  ResearchStatus,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  SentimentCache,
  Signal,
  Stock,
  StrategySnapshot,
  ValuePitScore,
  V6Score,
} from '@/data/types'

// ============================================================
// 基础类型守卫
// ============================================================

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value)
}

// ============================================================
// 业务类型守卫
// ============================================================

/**
 * 判定是否为有效股票对象（必填字段完整性）
 */
export function isStock(value: unknown): value is Stock {
  if (!isObject(value)) return false
  const candidate = value as Partial<Stock>
  return (
    isNonEmptyString(candidate.symbol) &&
    isNonEmptyString(candidate.name) &&
    isResearchStatus(candidate.researchStatus) &&
    typeof candidate.dataVersion === 'number'
  )
}

/**
 * 判定是否为研究状态枚举值
 */
export function isResearchStatus(value: unknown): value is ResearchStatus {
  return (
    value === 'candidate' ||
    value === 'screened' ||
    value === 'deepDive' ||
    value === 'watching' ||
    value === 'archived'
  )
}

/**
 * 判定是否为 V6 评分对象
 */
export function isV6Score(value: unknown): value is V6Score {
  if (!isObject(value)) return false
  const candidate = value as Partial<V6Score>
  return (
    isNonEmptyString(candidate.symbol) &&
    typeof candidate.score === 'number' &&
    typeof candidate.algorithmVersion === 'string' &&
    typeof candidate.calculatedAt === 'number' &&
    typeof candidate.dataVersion === 'number'
  )
}

/**
 * 判定是否为智能评分对象
 */
export function isIntelligentScore(value: unknown): value is IntelligentScore {
  if (!isObject(value)) return false
  const candidate = value as Partial<IntelligentScore>
  return (
    isNonEmptyString(candidate.symbol) &&
    typeof candidate.scoredAt === 'number' &&
    typeof candidate.dataVersion === 'number' &&
    isArray(candidate.dimensionScores)
  )
}

/**
 * 判定是否为行业评分对象
 */
export function isIndustryScore(value: unknown): value is IndustryScore {
  if (!isObject(value)) return false
  const candidate = value as Partial<IndustryScore>
  return (
    isNonEmptyString(candidate.code) &&
    isNonEmptyString(candidate.name) &&
    typeof candidate.scoredAt === 'number' &&
    isArray(candidate.dimensionScores)
  )
}

/**
 * 判定是否为日线行情对象
 */
export function isDailyQuotes(value: unknown): value is DailyQuotes {
  if (!isObject(value)) return false
  const candidate = value as Partial<DailyQuotes>
  return (
    isNonEmptyString(candidate.symbol) &&
    isObject(candidate.latest) &&
    typeof candidate.updatedAt === 'number'
  )
}

/**
 * 判定是否为订单方向
 */
export function isOrderDirection(value: unknown): value is OrderDirection {
  return value === 'buy' || value === 'sell'
}

/**
 * 判定是否为订单状态
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return value === 'pending' || value === 'filled' || value === 'cancelled'
}

/**
 * 判定是否为订单对象
 */
export function isOrder(value: unknown): value is Order {
  if (!isObject(value)) return false
  const candidate = value as Partial<Order>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.symbol) &&
    isOrderDirection(candidate.direction) &&
    isOrderStatus(candidate.status) &&
    typeof candidate.quantity === 'number' &&
    typeof candidate.price === 'number' &&
    typeof candidate.createdAt === 'number'
  )
}

/**
 * 判定是否为信号对象
 */
export function isSignal(value: unknown): value is Signal {
  if (!isObject(value)) return false
  const candidate = value as Partial<Signal>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.symbol) &&
    (candidate.direction === 'buy' ||
      candidate.direction === 'sell' ||
      candidate.direction === 'hold' ||
      candidate.direction === 'watch') &&
    isNonEmptyString(candidate.type) &&
    typeof candidate.confidence === 'number' &&
    typeof candidate.createdAt === 'number'
  )
}

/**
 * 判定是否为研究日志对象
 */
export function isResearchLog(value: unknown): value is ResearchLog {
  if (!isObject(value)) return false
  const candidate = value as Partial<ResearchLog>
  return (
    isNonEmptyString(candidate.traceId) &&
    typeof candidate.timestamp === 'number' &&
    isNonEmptyString(candidate.actor) &&
    isNonEmptyString(candidate.action)
  )
}

/**
 * 判定是否为本地文档对象
 */
export function isLocalDoc(value: unknown): value is LocalDoc {
  if (!isObject(value)) return false
  const candidate = value as Partial<LocalDoc>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.symbol) &&
    typeof candidate.content === 'string' &&
    isArray(candidate.tags) &&
    typeof candidate.addedAt === 'number'
  )
}

/**
 * 判定是否为资讯对象
 */
export function isNewsArticle(value: unknown): value is NewsArticle {
  if (!isObject(value)) return false
  const candidate = value as Partial<NewsArticle>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.url) &&
    isNonEmptyString(candidate.source) &&
    isNonEmptyString(candidate.hash)
  )
}

/**
 * 判定是否为资讯收藏对象
 */
export function isNewsBookmark(value: unknown): value is NewsBookmark {
  if (!isObject(value)) return false
  const candidate = value as Partial<NewsBookmark>
  return isNonEmptyString(candidate.id) && typeof candidate.bookmarkedAt === 'number'
}

/**
 * 判定是否为资讯-股票映射对象
 */
export function isNewsStockMap(value: unknown): value is NewsStockMap {
  if (!isObject(value)) return false
  const candidate = value as Partial<NewsStockMap>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.symbol) &&
    isNonEmptyString(candidate.newsId) &&
    typeof candidate.relevanceScore === 'number'
  )
}

/**
 * 判定是否为情感缓存对象
 */
export function isSentimentCache(value: unknown): value is SentimentCache {
  if (!isObject(value)) return false
  const candidate = value as Partial<SentimentCache>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.contentHash) &&
    (candidate.sentiment === 'positive' ||
      candidate.sentiment === 'negative' ||
      candidate.sentiment === 'neutral') &&
    typeof candidate.confidence === 'number' &&
    typeof candidate.analyzedAt === 'number'
  )
}

/**
 * 判定是否为轮动评分对象
 */
export function isRotationSectorScore(value: unknown): value is RotationSectorScore {
  if (!isObject(value)) return false
  const candidate = value as Partial<RotationSectorScore>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.sectorCode) &&
    isNonEmptyString(candidate.sectorName) &&
    typeof candidate.total === 'number'
  )
}

/**
 * 判定是否为板块评分记录对象
 */
export function isSectorScoreRecord(value: unknown): value is SectorScoreRecord {
  if (!isObject(value)) return false
  const candidate = value as Partial<SectorScoreRecord>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.sectorCode) &&
    typeof candidate.composite === 'number'
  )
}

/**
 * 判定是否为评分文档版本对象
 */
export function isScoreDocVersion(value: unknown): value is ScoreDocVersion {
  if (!isObject(value)) return false
  const candidate = value as Partial<ScoreDocVersion>
  return (
    isNonEmptyString(candidate.docId) &&
    isNonEmptyString(candidate.symbol) &&
    typeof candidate.version === 'number' &&
    typeof candidate.composite === 'number'
  )
}

/**
 * 判定是否为策略快照对象
 */
export function isStrategySnapshot(value: unknown): value is StrategySnapshot {
  if (!isObject(value)) return false
  const candidate = value as Partial<StrategySnapshot>
  return (
    isNonEmptyString(candidate.id) &&
    typeof candidate.version === 'number' &&
    typeof candidate.timestamp === 'number'
  )
}

/**
 * 判定是否为热门板块评分对象
 */
export function isHotSectorScore(value: unknown): value is HotSectorScore {
  if (!isObject(value)) return false
  const candidate = value as Partial<HotSectorScore>
  return (
    isNonEmptyString(candidate.symbol) &&
    typeof candidate.score === 'number' &&
    (candidate.action === 'immediate' || candidate.action === 'probe' || candidate.action === 'ignore')
  )
}

/**
 * 判定是否为价值洼地评分对象
 */
export function isValuePitScore(value: unknown): value is ValuePitScore {
  if (!isObject(value)) return false
  const candidate = value as Partial<ValuePitScore>
  return (
    isNonEmptyString(candidate.symbol) &&
    typeof candidate.score === 'number' &&
    (candidate.action === 'immediate' ||
      candidate.action === 'probe' ||
      candidate.action === 'wait' ||
      candidate.action === 'ignore')
  )
}

/**
 * 判定是否为执行计划对象
 */
export function isExecutionPlan(value: unknown): value is ExecutionPlan {
  if (!isObject(value)) return false
  const candidate = value as Partial<ExecutionPlan>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.signalId) &&
    isNonEmptyString(candidate.symbol) &&
    (candidate.direction === 'buy' || candidate.direction === 'sell') &&
    typeof candidate.createdAt === 'number'
  )
}
