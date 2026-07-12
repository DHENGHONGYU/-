import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { IndustryScore, IntelligentScore, Stock, V6Score } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 综合评分视图。
 *
 * 将 V6 自动评分、V6 个股智能评分、V4 行业评分聚合为单一视图，
 * 供交易舱 / 组合构建器使用。
 */
export interface CompositeScoreView {
  symbol: string
  /** V6 自动评分（0-5） */
  v6Score: number | null
  /** V6 个股智能评分（0-5） */
  intelligentScore: number | null
  /** 行业/主题评分（0-5） */
  industryScore: number | null
  /** V6 估值因子分（0-5），策略规则引擎用 */
  valuationScore: number | null
  /** 聚合后的综合评分（0-5），用于组合排序 */
  composite: number | null
  /** 评分来源摘要 */
  rationale: string
  /** 数据新鲜度：最近一次评分时间 */
  scoredAt: number | null
}

export interface ScoringAdapterOptions {
  /**
   * 综合评分计算时各评分来源的权重。
   * 默认：v6 50%、intelligent 30%、industry 20%。
   */
  weights?: {
    v6: number
    intelligent: number
    industry: number
  }
  /**
   * 智能评分缺失时是否回退到 V6 自动评分。
   * 默认 true。
   */
  fallbackToV6?: boolean
}

const DEFAULT_WEIGHTS = {
  v6: 0.5,
  intelligent: 0.3,
  industry: 0.2,
}

function weightedAverage(values: Array<{ value: number | null; weight: number }>): number | null {
  let totalWeight = 0
  let weightedSum = 0

  for (const { value, weight } of values) {
    if (value === null || Number.isNaN(value)) continue
    weightedSum += value * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return null
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

/**
 * 为单只股票计算综合评分视图。
 */
export async function getCompositeScore(
  stock: Stock,
  options?: ScoringAdapterOptions,
): Promise<CompositeScoreView> {
  const weights = { ...DEFAULT_WEIGHTS, ...options?.weights }
  const fallbackToV6 = options?.fallbackToV6 ?? true

  let v6Score: V6Score | undefined
  let intelligentScore: IntelligentScore | undefined
  let industryScore: IndustryScore | undefined

  try {
    const v6Result = await dataBridge.query<V6Score>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.v6Scores,
      key: stock.symbol,
      source: MODULE_ID.trading,
    })
    v6Score = v6Result.success && v6Result.data ? v6Result.data : undefined
  } catch (e) {
    logger.warn('[scoringAdapter] 读取 V6 评分失败', { symbol: stock.symbol, error: e })
  }

  try {
    const intelligentResult = await dataBridge.query<IntelligentScore>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.intelligentScores,
      key: stock.symbol,
      source: MODULE_ID.trading,
    })
    intelligentScore = intelligentResult.success && intelligentResult.data ? intelligentResult.data : undefined
  } catch (e) {
    logger.warn('[scoringAdapter] 读取智能评分失败', { symbol: stock.symbol, error: e })
  }

  // 行业评分：优先通过股票 sector 名称匹配行业评分 code
  try {
    if (stock.sector) {
      const allIndustryScoresResult = await dataBridge.query<IndustryScore[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.industryScores,
        source: MODULE_ID.trading,
      })
      const allIndustryScores = allIndustryScoresResult.success && allIndustryScoresResult.data ? allIndustryScoresResult.data : []
      const matched = allIndustryScores
        .filter((s) => s.name.includes(stock.sector!) || stock.sector!.includes(s.name))
      const missingScoredAt = matched.filter((s) => s.scoredAt == null)
      if (missingScoredAt.length > 0) logger.warn('[ScoringAdapter] 字段缺失，使用默认值', { field: 'scoredAt', symbol: stock.symbol, missingCount: missingScoredAt.length })
      industryScore = matched
        .sort((a, b) => {
          const ta = a.scoredAt ?? 0
          const tb = b.scoredAt ?? 0
          return tb - ta
        })[0]
    }
  } catch (e) {
    logger.warn('[scoringAdapter] 读取行业评分失败', { symbol: stock.symbol, error: e })
  }

  const v6Value = v6Score?.score ?? null
  const intelligentValue = intelligentScore?.overallScore ?? null
  const industryValue = industryScore?.sectorSnapshot?.composite ?? industryScore?.overallScore ?? null
  const valuationValue = v6Score?.factors?.估值 ?? null

  let composite = weightedAverage([
    { value: v6Value, weight: weights.v6 },
    { value: intelligentValue, weight: weights.intelligent },
    { value: industryValue, weight: weights.industry },
  ])

  // 若智能评分缺失且允许回退，则回退到 V6 评分
  if (composite === null && fallbackToV6 && v6Value !== null) {
    composite = v6Value
  }

  const rationale = buildRationale(v6Value, intelligentValue, industryValue, valuationValue, composite)

  // 检测评分时间戳缺失
  const scoredAtSources = {
    v6CalculatedAt: v6Score?.calculatedAt ?? null,
    intelligentScoredAt: intelligentScore?.scoredAt ?? null,
    industryScoredAt: industryScore?.scoredAt ?? null,
  }
  const missingTimestamps = Object.entries(scoredAtSources)
    .filter(([, v]) => v == null)
    .map(([k]) => k)
  if (missingTimestamps.length > 0 && missingTimestamps.length < 3) {
    logger.warn('[ScoringAdapter] 评分因子缺失', { factor: 'scoredAt', symbol: stock.symbol, missingFields: missingTimestamps })
  }

  const scoredAt = Math.max(
    v6Score?.calculatedAt ?? 0,
    intelligentScore?.scoredAt ?? 0,
    industryScore?.scoredAt ?? 0,
  ) || null

  return {
    symbol: stock.symbol,
    v6Score: v6Value,
    intelligentScore: intelligentValue,
    industryScore: industryValue,
    valuationScore: valuationValue,
    composite,
    rationale,
    scoredAt,
  }
}

function buildRationale(
  v6: number | null,
  intelligent: number | null,
  industry: number | null,
  valuation: number | null,
  composite: number | null,
): string {
  const parts: string[] = []
  if (v6 !== null) parts.push(`V6自动评分 ${v6}`)
  if (intelligent !== null) parts.push(`智能评分 ${intelligent}`)
  if (industry !== null) parts.push(`行业评分 ${industry}`)
  if (valuation !== null) parts.push(`估值分 ${valuation}`)

  if (parts.length === 0) return '暂无评分数据'

  const compositeText = composite !== null ? `；综合 ${composite}` : ''
  return `${parts.join(' / ')}${compositeText}`
}

/**
 * 批量获取一组股票的综合评分视图。
 */
export async function getCompositeScores(
  stocks: Stock[],
  options?: ScoringAdapterOptions,
): Promise<CompositeScoreView[]> {
  const results = await Promise.all(stocks.map((stock) => getCompositeScore(stock, options)))
  return results
}
