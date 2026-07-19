/**
 * scoreTrendService - 多周期评分趋势聚合服务
 *
 * 为行业评分（V4）与智能评分（个股）提供按周/月/季度的趋势数据聚合，
 * 所有标签、阈值均来自配置与类型，组件层零硬编码。
  * @doc [V9-DOC-BACK-010, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-BACK-006]
*/

import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import type { ScoreTrendPeriod } from '@/types/modules/score.types'
import { MS_PER_DAY } from '@/constants/math.constants'
import type { IndustryScore, IntelligentScore } from '@/data/types'

const logger = getLogger()

export type { ScoreTrendPeriod }
export type ScoreTrendEntityType = 'industry' | 'stock'

export interface ScoreTrendPoint {
  /** 周期标签，如 2026-W27 / 2026-07 / 2026-Q3 */
  period: string
  /** 综合评分平均值 */
  composite: number
  /** 参与聚合的样本数 */
  count: number
  /** 各维度平均分 */
  dimensions: Record<string, number>
}

export interface ScoreTrendData {
  entityId: string
  entityType: ScoreTrendEntityType
  period: ScoreTrendPeriod
  points: ScoreTrendPoint[]
}

interface DimensionLike {
  name: string
  score: number | null | undefined
}

interface Bucket {
  label: string
  compositeSum: number
  compositeCount: number
  dimensions: Map<string, { sum: number; count: number }>
}

function getISOWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7)
}

function getISOWeekYear(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  return tmp.getUTCFullYear()
}

/**
 * formatPeriodLabel
 * @param date
 * @param period
 * @returns string
 */
export function formatPeriodLabel(date: Date, period: ScoreTrendPeriod): string {
  if (period === 'week') {
    const year = getISOWeekYear(date)
    const week = String(getISOWeek(date)).padStart(2, '0')
    return `${year}-W${week}`
  }

  if (period === 'month') {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

function getOrCreateBucket(buckets: Map<string, Bucket>, label: string): Bucket {
  let bucket = buckets.get(label)
  if (!bucket) {
    bucket = { label, compositeSum: 0, compositeCount: 0, dimensions: new Map() }
    buckets.set(label, bucket)
  }
  return bucket
}

function addCompositeScore(bucket: Bucket, score: number | null | undefined): void {
  if (typeof score === 'number' && Number.isFinite(score)) {
    bucket.compositeSum += score
    bucket.compositeCount += 1
  }
}

function addDimensionScores(bucket: Bucket, dimensions: DimensionLike[] | undefined): void {
  if (!dimensions) return
  for (const dim of dimensions) {
    if (!dim?.name) continue
    const s = dim.score
    if (typeof s !== 'number' || !Number.isFinite(s)) continue
    let entry = bucket.dimensions.get(dim.name)
    if (!entry) {
      entry = { sum: 0, count: 0 }
      bucket.dimensions.set(dim.name, entry)
    }
    entry.sum += s
    entry.count += 1
  }
}

/**
 * aggregateScoresByPeriod
 */
export function aggregateScoresByPeriod<T>(
  items: T[],
  period: ScoreTrendPeriod,
  getDate: (item: T) => Date,
  getScore: (item: T) => number | null | undefined,
  getDimensions?: (item: T) => DimensionLike[],
): ScoreTrendPoint[] {
  const buckets = new Map<string, Bucket>()

  for (const item of items) {
    const date = getDate(item)
    if (Number.isNaN(date.getTime())) {
      logger.warn('aggregateScoresByPeriod: 跳过无效日期项')
      continue
    }

    const label = formatPeriodLabel(date, period)
    const bucket = getOrCreateBucket(buckets, label)

    addCompositeScore(bucket, getScore(item))
    addDimensionScores(bucket, getDimensions?.(item))
  }

  const sortedLabels = Array.from(buckets.keys()).sort()
  return sortedLabels.map((label) => bucketToPoint(buckets.get(label)!))
}

function bucketToPoint(bucket: Bucket): ScoreTrendPoint {
  const composite = bucket.compositeCount > 0
    ? Number((bucket.compositeSum / bucket.compositeCount).toFixed(2))
    : 0

  const dimensions: Record<string, number> = {}
  for (const [name, entry] of bucket.dimensions.entries()) {
    dimensions[name] = entry.count > 0
      ? Number((entry.sum / entry.count).toFixed(2))
      : 0
  }

  return {
    period: bucket.label,
    composite,
    count: bucket.compositeCount,
    dimensions,
  }
}

/**
 * loadIndustryScoreTrend
 */
export async function loadIndustryScoreTrend(
  code: string,
  period: ScoreTrendPeriod,
): Promise<{ success: true; data: ScoreTrendData } | { success: false; error: string }> {
  try {
    const result = await dataBridge.query<IndustryScore[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.industryScores,
      indexName: 'by-code',
      indexValue: code,
    })
    const scores = result.success ? (result.data ?? []) : []
    const points = aggregateScoresByPeriod(
      scores,
      period,
      (s) => new Date(s.scoredAt),
      (s) => s.overallScore,
      (s) => s.dimensionScores,
    )

    return {
      success: true,
      data: { entityId: code, entityType: 'industry', period, points },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`loadIndustryScoreTrend 失败: ${message}`, { err, code, period })
    return { success: false, error: message }
  }
}

/**
 * loadStockScoreTrend
 */
export async function loadStockScoreTrend(
  symbol: string,
  period: ScoreTrendPeriod,
): Promise<{ success: true; data: ScoreTrendData } | { success: false; error: string }> {
  try {
    const result = await dataBridge.query<IntelligentScore[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.intelligentScores,
      indexName: 'by-symbol',
      indexValue: symbol,
    })
    const scores = result.success ? (result.data ?? []) : []
    const points = aggregateScoresByPeriod(
      scores,
      period,
      (s) => new Date(s.scoredAt),
      (s) => s.overallScore,
      (s) => s.dimensionScores,
    )

    return {
      success: true,
      data: { entityId: symbol, entityType: 'stock', period, points },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`loadStockScoreTrend 失败: ${message}`, { err, symbol, period })
    return { success: false, error: message }
  }
}
