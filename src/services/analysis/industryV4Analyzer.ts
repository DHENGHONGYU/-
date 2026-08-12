/**
 * 行业 V4 维度分析引擎
 *
 * V4 维度框架（行业四力模型）：
 * V4-1 景气度 (Prosperity)：行业增长速度、盈利能力、产能利用率
 * V4-2 竞争格局 (Competition)：集中度、进入壁垒、议价能力
 * V4-3 政策环境 (Policy)：政策支持力度、监管风险、补贴力度
 * V4-4 技术成熟度 (Technology)：技术迭代速度、渗透率、替代风险
 *
 * 设计原则：
 * - 数据驱动：基于聚合的行业财务/行情数据计算
 * - 可解释：每个维度评分附带详细依据和子指标
 * - 质量感知：数据不足时降权或标记，不强行评分
 *
 * @module services/analysis/industryV4Analyzer
 * @created 2026-07-16 - v2.9.0
 * @updated 2026-07-16 - v2.9.5：V4子指标细化 + 趋势分析 + 估值集成
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { getLogger } from '@/lib/logger'
import type {
  IndustryV4Analysis,
  IndustryV4DimensionDetail,
  IndustryDefinition,
  IndustryFinancialAggregate,
  IndustryQuoteAggregate,
  IndustryDataValidation,
  IndustryV4AnalysisEnhanced,
  V4SubIndicators,
  ProsperitySubIndicators,
  CompetitionSubIndicators,
  PolicySubIndicators,
  TechnologySubIndicators,
  IndustryTrendAnalysis,
  ProsperityTrend,
  TrendDirection,
  TrendStrength,
  IndustryFinancialAggregateEnhanced,
  RotationSignalType,
  IndustryRotationSignal,
} from '@/data/types/types.sector'
import type { IndustryAggregationResult } from './industryDataAggregator'

const logger = getLogger()

// ============================================================
// V4 维度权重配置
// ============================================================

const V4_WEIGHTS = {
  prosperity: 0.30,
  competition: 0.25,
  policy: 0.20,
  technology: 0.25,
}

// ============================================================
// 行业轮动信号评分权重与阈值
// ============================================================

const ROTATION_SIGNAL_WEIGHTS = {
  v4: 0.40,
  trend: 0.25,
  valuation: 0.20,
  momentum: 0.15,
}

const RATING_THRESHOLDS = {
  S: 4.2,
  A: 3.6,
  B_PLUS: 3.0,
  B: 2.4,
  C: 1.8,
} as const

const ALLOCATION_THRESHOLDS = {
  OVERWEIGHT: 4.2,
  OVERWEIGHT_SLIGHT: 3.6,
  NEUTRAL: 3.0,
  NEUTRAL_UNDER: 2.4,
} as const

const SIGNAL_THRESHOLDS = {
  STRONG_BUY: 4.2,
  BUY: 3.6,
  HOLD: 3.0,
  REDUCE: 2.4,
} as const

const DEFAULT_COMPOSITE_SCORE = 2.5

// ============================================================
// 趋势分析阈值与变化量
// ============================================================

const GROWTH_THRESHOLDS = {
  STRONG_UP: 20,
  MODERATE_UP: 10,
  WEAK_UP: 0,
  WEAK_DOWN: -10,
  MODERATE_DOWN: -20,
} as const

const TREND_CHANGE = {
  STRONG_UP: 0.5,
  MODERATE_UP: 0.3,
  WEAK_UP: 0.1,
  WEAK_DOWN: -0.1,
  MODERATE_DOWN: -0.3,
  STRONG_DOWN: -0.5,
} as const

const TREND_SCORE_MAP: Record<TrendDirection, Record<TrendStrength, number>> = {
  up: { strong: 4.5, moderate: 3.8, weak: 3.2, unknown: 3.0 },
  down: { strong: 1.5, moderate: 2.2, weak: 2.8, unknown: 3.0 },
  unknown: { strong: 3.0, moderate: 3.0, weak: 3.0, unknown: 3.0 },
  flat: { strong: 3.0, moderate: 3.0, weak: 3.0, unknown: 3.0 },
}

// ============================================================
// 关键词匹配工具
// ============================================================

/**
 * 关键词匹配：检查行业名称、描述、关键词文本是否包含指定词。
 * 统一抽取 policy/competition 多维度中重复的条件判断（audit:complexity L6）。
 */
function matchesKeyword(
  nameLower: string,
  descLower: string,
  kw: string,
  kwText?: string,
): boolean {
  return (
    nameLower.includes(kw) ||
    descLower.includes(kw) ||
    (kwText ? kwText.includes(kw) : false)
  )
}

/**
 * 检查是否有研发费用率数据，消除 competition/policy/technology 中重复的 fin.rdRatioMedian !== null 条件。
 */
function hasRdData(fin: { rdRatioMedian: number | null }): boolean {
  return fin.rdRatioMedian !== null
}

/**
 * 根据政策关键词命中数解析政策支持评分。
 * 消除 analyzePolicy / calcPolicySubIndicators 中重复的深层 else-if 链（audit:complexity L4）。
 */
function resolvePolicyScore(highMatch: number, midMatch: number): number {
  if (highMatch >= 2) return 4.5
  if (highMatch === 1) return 4.0
  if (midMatch >= 2) return 3.5
  if (midMatch === 1) return 3.0
  return 3.0
}

/**
 * 根据营收增速解析趋势方向/强度/变化值。
 * 消除 calcSimpleTrend 中重复的深层 else-if 链（audit:complexity L4）。
 */
function resolveTrendFromGrowth(growthRate: number): {
  direction: 'up' | 'down'
  strength: 'strong' | 'moderate' | 'weak'
  change: number
} {
  if (growthRate > GROWTH_THRESHOLDS.STRONG_UP) return { direction: 'up', strength: 'strong', change: TREND_CHANGE.STRONG_UP }
  if (growthRate > GROWTH_THRESHOLDS.MODERATE_UP) return { direction: 'up', strength: 'moderate', change: TREND_CHANGE.MODERATE_UP }
  if (growthRate > GROWTH_THRESHOLDS.WEAK_UP) return { direction: 'up', strength: 'weak', change: TREND_CHANGE.WEAK_UP }
  if (growthRate > GROWTH_THRESHOLDS.WEAK_DOWN) return { direction: 'down', strength: 'weak', change: TREND_CHANGE.WEAK_DOWN }
  if (growthRate > GROWTH_THRESHOLDS.MODERATE_DOWN) return { direction: 'down', strength: 'moderate', change: TREND_CHANGE.MODERATE_DOWN }
  return { direction: 'down', strength: 'strong', change: TREND_CHANGE.STRONG_DOWN }
}

/**
 * 根据成熟度阶段解析市场渗透率。
 * 消除 calcTechnologySubIndicators 中 5 分支 else-if 链第 4 层 depth=4 嵌套（audit:complexity L4）。
 * 用卫语句早返回，每个 if 独立不嵌套。
 */
function resolvePenetrationRate(maturityStage: number): number {
  if (maturityStage <= 1.5) return 0.05
  if (maturityStage <= 2.5) return 0.2
  if (maturityStage <= 3.5) return 0.5
  if (maturityStage <= 4.5) return 0.8
  return 0.95
}

/**
 * 统计关键词列表中命中的数量。
 * 消除 analyzePolicy / calcPolicySubIndicators 中重复的 for+matchesKeyword if 条件（audit:complexity L5）。
 */
function countKeywordMatches(
  keywords: string[],
  nameLower: string,
  descLower: string,
  kwText?: string,
): number {
  let count = 0
  for (const kw of keywords) {
    if (matchesKeyword(nameLower, descLower, kw, kwText)) count++
  }
  return count
}

// ============================================================
// 评分映射工具
// ============================================================

/**
 * 将数值映射到 0-5 分（线性映射）
 */
function linearScore(value: number, min: number, max: number, invert = false): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.max(min, Math.min(max, value))
  const normalized = (clamped - min) / (max - min)
  const score = normalized * 5
  return invert ? 5 - score : score
}

/**
 * 将百分比增速映射到评分
 * - ≥50% = 5分
 * - 30% = 4分
 * - 15% = 3分
 * - 5% = 2分
 * - 0% = 1分
 * - <0% = 0-1分
 */
function growthScore(growthRate: number | null): number | null {
  if (growthRate === null || !Number.isFinite(growthRate)) return null

  if (growthRate >= 50) return 5.0
  if (growthRate >= 30) return 4.0 + ((growthRate - 30) / 20)
  if (growthRate >= 15) return 3.0 + ((growthRate - 15) / 15)
  if (growthRate >= 5) return 2.0 + ((growthRate - 5) / 10)
  if (growthRate >= 0) return 1.0 + (growthRate / 5)
  return Math.max(0, 1.0 + growthRate / 20)
}

/**
 * 毛利率映射到评分
 * - ≥50% = 5分（高壁垒/高附加值）
 * - 30% = 4分
 * - 20% = 3分
 * - 10% = 2分
 * - <10% = 1分
 */
function marginScore(grossMargin: number | null): number | null {
  if (grossMargin === null || !Number.isFinite(grossMargin)) return null
  return linearScore(grossMargin, 0, 50)
}

/**
 * ROE 映射到评分
 * - ≥20% = 5分
 * - 15% = 4分
 * - 10% = 3分
 * - 5% = 2分
 * - <5% = 1分
 */
function roeScore(roe: number | null): number | null {
  if (roe === null || !Number.isFinite(roe)) return null
  return linearScore(roe, 0, 20)
}

/**
 * 研发费用率映射到技术评分
 * - ≥15% = 5分（高研发强度）
 * - 10% = 4分
 * - 5% = 3分
 * - 2% = 2分
 * - <2% = 1分
 */
function rdScore(rdRatio: number | null): number | null {
  if (rdRatio === null || !Number.isFinite(rdRatio)) return null
  return linearScore(rdRatio, 0, 15)
}

// ============================================================
// V4-1 景气度分析
// ============================================================

/**
 * V4-1 景气度分析
 *
 * 子指标：
 * - 营收增速（权重 40%）
 * - 净利润增速（权重 30%）
 * - ROE 水平（权重 20%）
 * - 毛利率水平（权重 10%）
 */
function analyzeProsperity(
  fin: IndustryFinancialAggregate,
): IndustryV4DimensionDetail {
  const subIndicators: IndustryV4DimensionDetail['subIndicators'] = []
  const evidence: string[] = []
  let totalWeight = 0
  let weightedScore = 0

  // 营收增速
  const revScore = growthScore(fin.revenueYoYMedian)
  if (revScore !== null) {
    subIndicators.push({ name: '营收增速中位数', value: fin.revenueYoYMedian, unit: '%' })
    weightedScore += revScore * 0.40
    totalWeight += 0.40
    evidence.push(`营收增速: ${fin.revenueYoYMedian?.toFixed(1)}% → ${revScore.toFixed(1)}分`)
  }

  // 净利润增速
  const profitScore = growthScore(fin.netProfitYoYMedian)
  if (profitScore !== null) {
    subIndicators.push({ name: '净利润增速中位数', value: fin.netProfitYoYMedian, unit: '%' })
    weightedScore += profitScore * 0.30
    totalWeight += 0.30
    evidence.push(`净利润增速: ${fin.netProfitYoYMedian?.toFixed(1)}% → ${profitScore.toFixed(1)}分`)
  }

  // ROE
  const roeS = roeScore(fin.roeMedian)
  if (roeS !== null) {
    subIndicators.push({ name: 'ROE 中位数', value: fin.roeMedian, unit: '%' })
    weightedScore += roeS * 0.20
    totalWeight += 0.20
    evidence.push(`ROE: ${fin.roeMedian?.toFixed(1)}% → ${roeS.toFixed(1)}分`)
  }

  // 毛利率
  const gmScore = marginScore(fin.grossMarginMedian)
  if (gmScore !== null) {
    subIndicators.push({ name: '毛利率中位数', value: fin.grossMarginMedian, unit: '%' })
    weightedScore += gmScore * 0.10
    totalWeight += 0.10
    evidence.push(`毛利率: ${fin.grossMarginMedian?.toFixed(1)}% → ${gmScore.toFixed(1)}分`)
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : null
  const scoreLabel = score !== null ? (
    score >= 4 ? '高景气' : score >= 3 ? '景气向上' : score >= 2 ? '平稳' : '下行') : '数据不足'

  return {
    name: '景气度',
    score,
    weight: V4_WEIGHTS.prosperity,
    rationale: score !== null
      ? `行业景气度${scoreLabel}，综合评分 ${score.toFixed(1)}/5，基于 ${subIndicators.length} 个财务指标`
      : '财务数据不足，无法评估景气度',
    evidence,
    subIndicators,
  }
}

// ============================================================
// V4-2 竞争格局分析
// ============================================================

/**
 * V4-2 竞争格局分析
 *
 * 子指标（基于财务数据的 proxy：
 * - 毛利率水平（反映议价能力/差异化，权重 40%）
 * - 净利率水平（反映盈利稳定性，权重 30%）
 * - 研发费用率（反映进入壁垒，权重 30%）
 *
 * 注：真正的 CR5/集中度数据需要外部数据源，
 * 这里用财务指标作为代理
 */
function analyzeCompetition(
  fin: IndustryFinancialAggregate,
): IndustryV4DimensionDetail {
  const subIndicators: IndustryV4DimensionDetail['subIndicators'] = []
  const evidence: string[] = []
  let totalWeight = 0
  let weightedScore = 0

  // 毛利率（议价能力 proxy）
  const gmScore = marginScore(fin.grossMarginMedian)
  if (gmScore !== null) {
    subIndicators.push({ name: '毛利率中位数', value: fin.grossMarginMedian, unit: '%' })
    weightedScore += gmScore * 0.40
    totalWeight += 0.40
    evidence.push(`毛利率 ${fin.grossMarginMedian?.toFixed(1)}% → 议价能力 ${gmScore.toFixed(1)}分`)
  }

  // 净利率（盈利稳定性 proxy）
  const nmScore = marginScore(fin.netMarginMedian)
  if (nmScore !== null) {
    subIndicators.push({ name: '净利率中位数', value: fin.netMarginMedian, unit: '%' })
    weightedScore += nmScore * 0.30
    totalWeight += 0.30
    evidence.push(`净利率 ${fin.netMarginMedian?.toFixed(1)}% → 盈利稳定性 ${nmScore.toFixed(1)}分`)
  }

  // 研发费用率（进入壁垒 proxy）
  const rdS = rdScore(fin.rdRatioMedian)
  if (rdS !== null) {
    subIndicators.push({ name: '研发费用率中位数', value: fin.rdRatioMedian, unit: '%' })
    weightedScore += rdS * 0.30
    totalWeight += 0.30
    evidence.push(`研发费用率 ${fin.rdRatioMedian?.toFixed(1)}% → 技术壁垒 ${rdS.toFixed(1)}分`)
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : null
  const scoreLabel = score !== null ? (
    score >= 4 ? '竞争格局好' : score >= 3 ? '竞争有序' : score >= 2 ? '竞争激烈' : '红海竞争') : '数据不足'

  return {
    name: '竞争格局',
    score,
    weight: V4_WEIGHTS.competition,
    rationale: score !== null
      ? `行业${scoreLabel}，综合评分 ${score.toFixed(1)}/5（基于财务指标代理分析）`
      : '财务数据不足，无法评估竞争格局',
    evidence,
    subIndicators,
  }
}

// ============================================================
// V4-3 政策环境分析
// ============================================================

/**
 * V4-3 政策环境分析
 *
 * 基于行业关键词匹配政策支持等级：
 * - 战略新兴产业 = 4-5分
 * - 未来产业 = 3.5-4.5分
 * - 传统行业 = 2-3分
 * - 限制类 = 1-2分
 *
 * 同时结合研发费用率验证政策支持强度
 */
function analyzePolicy(
  industry: IndustryDefinition,
  fin: IndustryFinancialAggregate,
): IndustryV4DimensionDetail {
  const subIndicators: IndustryV4DimensionDetail['subIndicators'] = []
  const evidence: string[] = []

  // 从行业名称/描述中提取政策信号
  const nameLower = industry.name.toLowerCase()
  const descLower = industry.description.toLowerCase()
  const kwText = industry.keywords.join(' ').toLowerCase()

  // 高政策支持关键词
  const highPolicyKeywords = [
    '国家战略', '十五五', '新兴产业', '未来产业', '卡脖子',
    '国产替代', '自主可控', '专精特新',
  ]

  // 中政策支持关键词
  const midPolicyKeywords = [
    '消费升级', '民生', '基础设施', '绿色', '双碳',
  ]

  const highMatch = countKeywordMatches(highPolicyKeywords, nameLower, descLower, kwText)
  const midMatch = countKeywordMatches(midPolicyKeywords, nameLower, descLower, kwText)

  let baseScore = resolvePolicyScore(highMatch, midMatch)
  const policyLevelMap: Record<number, string> = {
    4.5: '强政策支持',
    4.0: '较强政策支持',
    3.5: '中等政策支持',
    3.0: '一般政策支持',
  }
  const policyLevel = policyLevelMap[baseScore] || '一般政策支持'

  // 研发费用率作为政策支持强度验证（高研发通常对应政策鼓励方向）
  const rdS = rdScore(fin.rdRatioMedian)
  if (rdS !== null) {
    subIndicators.push({ name: '研发费用率中位数', value: fin.rdRatioMedian, unit: '%' })
    // 研发费用率对政策分有 20% 的调整权重
    const adjustment = (rdS - 2.5) * 0.2
    baseScore = Math.max(1, Math.min(5, baseScore + adjustment))
    evidence.push(`研发强度验证: 研发费用率 ${fin.rdRatioMedian?.toFixed(1)}% → 政策支持验证 ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(2)}分`)
  }

  subIndicators.push({ name: '政策支持等级', value: baseScore })

  evidence.unshift(`政策等级: ${policyLevel} → 基础分 ${baseScore.toFixed(1)}`)

  return {
    name: '政策环境',
    score: Math.round(baseScore * 10) / 10,
    weight: V4_WEIGHTS.policy,
    rationale: `行业${policyLevel}，评分 ${baseScore.toFixed(1)}/5，基于行业属性与研发强度综合判断`,
    evidence,
    subIndicators,
  }
}

// ============================================================
// V4-4 技术成熟度分析
// ============================================================

/**
 * V4-4 技术成熟度分析
 *
 * 子指标：
 * - 研发费用率（技术投入强度，权重 50%）
 * - 毛利率（技术溢价能力，权重 30%）
 * - 营收增速（技术商业化进度，权重 20%）
 */
function analyzeTechnology(
  _industry: IndustryDefinition,
  fin: IndustryFinancialAggregate,
): IndustryV4DimensionDetail {
  const subIndicators: IndustryV4DimensionDetail['subIndicators'] = []
  const evidence: string[] = []
  let totalWeight = 0
  let weightedScore = 0

  // 研发费用率（技术投入强度）
  const rdS = rdScore(fin.rdRatioMedian)
  if (rdS !== null) {
    subIndicators.push({ name: '研发费用率中位数', value: fin.rdRatioMedian, unit: '%' })
    weightedScore += rdS * 0.50
    totalWeight += 0.50
    evidence.push(`研发强度 ${fin.rdRatioMedian?.toFixed(1)}% → 技术投入 ${rdS.toFixed(1)}分`)
  }

  // 毛利率（技术溢价能力）
  const gmScore = marginScore(fin.grossMarginMedian)
  if (gmScore !== null) {
    subIndicators.push({ name: '毛利率中位数', value: fin.grossMarginMedian, unit: '%' })
    weightedScore += gmScore * 0.30
    totalWeight += 0.30
    evidence.push(`毛利率 ${fin.grossMarginMedian?.toFixed(1)}% → 技术溢价 ${gmScore.toFixed(1)}分`)
  }

  // 营收增速（商业化进度）
  const revScore = growthScore(fin.revenueYoYMedian)
  if (revScore !== null) {
    subIndicators.push({ name: '营收增速中位数', value: fin.revenueYoYMedian, unit: '%' })
    weightedScore += revScore * 0.20
    totalWeight += 0.20
    evidence.push(`营收增速 ${fin.revenueYoYMedian?.toFixed(1)}% → 商业化进度 ${revScore.toFixed(1)}分`)
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : null
  const scoreLabel = score !== null ? (
    score >= 4 ? '技术领先' : score >= 3 ? '技术成熟' : score >= 2 ? '技术追赶' : '技术落后') : '数据不足'

  return {
    name: '技术成熟度',
    score,
    weight: V4_WEIGHTS.technology,
    rationale: score !== null
      ? `行业技术${scoreLabel}，综合评分 ${score.toFixed(1)}/5`
      : '数据不足，无法评估技术成熟度',
    evidence,
    subIndicators,
  }
}

// ============================================================
// 综合 V4 分析
// ============================================================

/**
 * 执行行业 V4 维度分析
 */
export function analyzeIndustryV4(
  industry: IndustryDefinition,
  financialAggregate: IndustryFinancialAggregate,
  quoteAggregate: IndustryQuoteAggregate,
  validation: IndustryDataValidation,
): IndustryV4Analysis {
  // V4-1 景气度
  const prosperity = analyzeProsperity(financialAggregate)

  // V4-2 竞争格局
  const competition = analyzeCompetition(financialAggregate)

  // V4-3 政策环境
  const policy = analyzePolicy(industry, financialAggregate)

  // V4-4 技术成熟度
  const technology = analyzeTechnology(industry, financialAggregate)

  // 计算综合分（仅纳入有数据的维度，按权重重新分配
  const dims = [prosperity, competition, policy, technology]
  let totalWeight = 0
  let weightedSum = 0

  for (const dim of dims) {
    if (dim.score !== null && Number.isFinite(dim.score)) {
      weightedSum += dim.score * dim.weight
      totalWeight += dim.weight
    }
  }

  const v4Composite = totalWeight > 0 ? weightedSum / totalWeight : null

  // 数据完整度
  const dataCompleteness = validation.dataCompleteness

  // 数据来源
  const dataSources: string[] = []
  if (financialAggregate.sampleCount >= 5) {
    dataSources.push('个股财务数据聚合')
  }
  if (quoteAggregate.sampleCount >= 5) {
    dataSources.push('个股行情数据聚合')
  }
  dataSources.push('行业分类体系')

  const result: IndustryV4Analysis = {
    industryCode: industry.code,
    industryName: industry.name,
    tier: industry.tier,
    v4Composite,
    dimensions: {
      prosperity,
      competition,
      policy,
      technology,
    },
    constituentCount: financialAggregate.sampleCount,
    dataCompleteness,
    dataSources,
    analyzedAt: Date.now(),
  }

  logger.info(`[industryV4Analyzer] V4分析完成: ${industry.name}, 综合分=${v4Composite?.toFixed(2) ?? 'N/A'}, 样本=${financialAggregate.sampleCount}`, {
    prosperity: prosperity.score,
    competition: competition.score,
    policy: policy.score,
    technology: technology.score,
  })

  return result
}

/**
 * 批量 V4 分析入口
 */
export function analyzeAllIndustriesV4(
  aggregationResults: IndustryAggregationResult[],
): IndustryV4Analysis[] {
  const results: IndustryV4Analysis[] = []

  for (const agg of aggregationResults) {
    const v4 = analyzeIndustryV4(
      agg.industry,
      agg.financialAggregate,
      agg.quoteAggregate,
      agg.validation,
    )
    results.push(v4)
  }

  logger.info(`[industryV4Analyzer] 批量V4分析完成: ${results.length} 个行业`)

  return results.sort((a, b) => {
    const scoreA = a.v4Composite ?? -1
    const scoreB = b.v4Composite ?? -1
    return scoreB - scoreA
  })
}

/**
 * 获取 V4 维度评级标签
 */
export function getV4RatingLabel(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '数据不足'
  if (score >= RATING_THRESHOLDS.S) return 'S级'
  if (score >= RATING_THRESHOLDS.A) return 'A级'
  if (score >= RATING_THRESHOLDS.B_PLUS) return 'B+级'
  if (score >= RATING_THRESHOLDS.B) return 'B级'
  if (score >= RATING_THRESHOLDS.C) return 'C级'
  return 'D级'
}

/**
 * 获取配置建议
 */
export function getAllocationRecommendation(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '数据不足，建议观望'
  if (score >= ALLOCATION_THRESHOLDS.OVERWEIGHT) return '超配'
  if (score >= ALLOCATION_THRESHOLDS.OVERWEIGHT_SLIGHT) return '标配偏多'
  if (score >= ALLOCATION_THRESHOLDS.NEUTRAL) return '标配'
  if (score >= ALLOCATION_THRESHOLDS.NEUTRAL_UNDER) return '标配偏空'
  return '低配'
}

// ============================================================
// V4 子指标细化（v2.9.5 新增）
// ============================================================

/**
 * 计算景气度子指标（细化版）
 */
function calcProsperitySubIndicators(
  fin: IndustryFinancialAggregateEnhanced,
): ProsperitySubIndicators {
  // 产能利用率估算（基于 ROE 推算，ROE 高通常意味着产能利用率高）
  let capacityUtilization: number | null = null
  if (fin.roeMedian !== null && fin.roeMedian > 0) {
    capacityUtilization = Math.min(100, Math.max(30, fin.roeMedian * 5)) // ROE 20% → 100%
  }

  // 库存周期位置（基于库存周转天数推算，天数越少周期位置越低）
  let inventoryCyclePosition: number | null = null
  if (fin.inventoryTurnoverDaysMedian !== null && fin.inventoryTurnoverDaysMedian > 0) {
    inventoryCyclePosition = Math.min(1, Math.max(0, 1 - fin.inventoryTurnoverDaysMedian / 365))
  }

  // 订单能见度（基于经营性现金流/净利润推算）
  let orderVisibility: number | null = null
  if (fin.ocfToProfitRatioMedian !== null) {
    orderVisibility = Math.min(1, Math.max(0, fin.ocfToProfitRatioMedian / 150))
  }

  return {
    revenueGrowth: fin.revenueYoYMedian,
    profitGrowth: fin.netProfitYoYMedian,
    grossMargin: fin.grossMarginMedian,
    roe: fin.roeMedian,
    capacityUtilization,
    inventoryTurnoverDays: fin.inventoryTurnoverDaysMedian,
    inventoryCyclePosition,
    orderVisibility,
    cashFlowQuality: fin.ocfToProfitRatioMedian,
  }
}

/**
 * 计算竞争格局子指标（细化版）
 */
function calcCompetitionSubIndicators(
  industry: IndustryDefinition,
  fin: IndustryFinancialAggregateEnhanced,
): CompetitionSubIndicators {
  // 进入壁垒评分（基于行业属性 + 研发费用率估算）
  let entryBarrier = 2.5
  const nameLower = industry.name.toLowerCase()
  const descLower = industry.description.toLowerCase()

  // 技术壁垒
  if (hasRdData(fin)) {
    entryBarrier += Math.min(1.5, fin.rdRatioMedian! / 10)
  }

  // 重资产/牌照壁垒（关键词匹配）
  const heavyAssetKeywords = ['半导体', '芯片', '晶圆', '面板', '新能源', '光伏', '医药', '创新药', '金融', '银行', '保险']
  for (const kw of heavyAssetKeywords) {
    if (matchesKeyword(nameLower, descLower, kw)) {
      entryBarrier += 0.5
      break
    }
  }
  entryBarrier = Math.min(5, Math.max(1, entryBarrier))

  // 议价能力（基于应收周转天数推算，天数越少议价能力越强）
  let pricingPower: number | null = null
  if (fin.receivableTurnoverDaysMedian !== null && fin.receivableTurnoverDaysMedian > 0) {
    pricingPower = Math.min(5, Math.max(0, 5 - fin.receivableTurnoverDaysMedian / 30))
  }

  // 龙头利润率优势
  let leaderMarginAdvantage: number | null = null
  if (fin.top25NetMargin !== null && fin.netMarginMedian !== null) {
    leaderMarginAdvantage = fin.top25NetMargin - fin.netMarginMedian
  }

  return {
    cr5: fin.marketCapCr5,
    cr10: fin.marketCapCr10,
    marginDispersion: fin.grossMarginDispersion,
    leaderMarginAdvantage,
    entryBarrier,
    pricingPower,
  }
}

/**
 * 计算政策环境子指标（细化版）
 */
function calcPolicySubIndicators(
  industry: IndustryDefinition,
  fin: IndustryFinancialAggregateEnhanced,
): PolicySubIndicators {
  // 复用现有政策分析逻辑的核心判断
  let policySupport = 3.0
  let regulatoryRisk = 2.0
  let planAlignment = 3.0

  const nameLower = industry.name.toLowerCase()
  const descLower = industry.description.toLowerCase()
  const kwText = industry.keywords.join(' ').toLowerCase()

  // 高政策支持
  const highPolicyKeywords = [
    '国家战略', '十五五', '新兴产业', '未来产业', '卡脖子',
    '国产替代', '自主可控', '专精特新', '半导体', '芯片',
    '人工智能', '新能源', '光伏', '储能', '创新药',
  ]

  // 中政策支持
  const midPolicyKeywords = [
    '消费升级', '民生', '基础设施', '绿色', '双碳',
    '高端制造', '机器人', '工业软件',
  ]

  // 高监管风险
  const highRegKeywords = [
    '金融', '银行', '保险', '证券', '互联网', '教育',
    '医疗', '医药', '地产', '煤炭', '钢铁',
  ]

  const highMatch = countKeywordMatches(highPolicyKeywords, nameLower, descLower, kwText)
  const midMatch = countKeywordMatches(midPolicyKeywords, nameLower, descLower, kwText)

  const policyScore = resolvePolicyScore(highMatch, midMatch)
  policySupport = policyScore
  planAlignment = policyScore

  // 研发强度验证
  if (hasRdData(fin)) {
    const adjustment = (fin.rdRatioMedian! - 5) * 0.1
    policySupport = Math.max(1, Math.min(5, policySupport + adjustment))
  }

  // 监管风险判断
  const regMatch = countKeywordMatches(highRegKeywords, nameLower, descLower)
  if (regMatch >= 2) {
    regulatoryRisk = 4.0
  } else if (regMatch === 1) {
    regulatoryRisk = 3.0
  }

  // 补贴强度（暂无政府补助数据，留空）
  const subsidyIntensity: number | null = fin.subsidyToRevenueRatioMedian

  return {
    policySupport,
    regulatoryRisk,
    subsidyIntensity,
    planAlignment,
  }
}

/**
 * 计算技术成熟度子指标（细化版）
 */
function calcTechnologySubIndicators(
  industry: IndustryDefinition,
  fin: IndustryFinancialAggregateEnhanced,
): TechnologySubIndicators {
  // 缓存重复访问的财务字段（减少重复条件）
  const rd = fin.rdRatioMedian

  // 技术人员占比估算 + 技术迭代速度（合并到同一 rd null 检查）
  let techTalentRatio: number | null = null
  let iterationSpeed: number | null = null
  if (hasRdData(fin)) {
    techTalentRatio = Math.min(80, rd! * 2) // 研发费用率15% → 30%技术人员
    iterationSpeed = Math.min(5, Math.max(1, rd! / 3))
  }

  // 技术成熟度阶段（基于行业属性 + 增速判断）
  let maturityStage = 3 // 默认为成长期中期
  const nameLower = industry.name.toLowerCase()

  const earlyStageKeywords = ['量子计算', '人形机器人', '元宇宙', '脑机接口', '可控核聚变']
  const growthStageKeywords = ['人工智能', '半导体', '创新药', '新能源', '储能', '光伏']
  const matureStageKeywords = ['消费', '金融', '地产', '电力', '交通运输']

  if (earlyStageKeywords.some(kw => nameLower.includes(kw))) {
    maturityStage = 1 // 萌芽期
  } else if (growthStageKeywords.some(kw => nameLower.includes(kw))) {
    maturityStage = 2 // 成长期
  } else if (matureStageKeywords.some(kw => nameLower.includes(kw))) {
    maturityStage = 4 // 成熟期
  }

  // 用营收增速微调
  if (fin.revenueYoYMedian !== null) {
    if (fin.revenueYoYMedian > 30) maturityStage = Math.max(1, maturityStage - 0.5)
    else if (fin.revenueYoYMedian < 5) maturityStage = Math.min(5, maturityStage + 0.5)
  }

  // 市场渗透率估算（基于成熟阶段）
  const penetrationRate = resolvePenetrationRate(maturityStage)

  // 替代风险（反向指标，成熟度越高替代风险越低）
  const substitutionRisk = Math.min(5, Math.max(1, 6 - maturityStage))

  return {
    rdRatio: fin.rdRatioMedian,
    techTalentRatio,
    maturityStage,
    penetrationRate,
    iterationSpeed,
    substitutionRisk,
  }
}

/**
 * 计算完整 V4 子指标集合
 */
function calcAllSubIndicators(
  industry: IndustryDefinition,
  fin: IndustryFinancialAggregateEnhanced,
): V4SubIndicators {
  return {
    prosperity: calcProsperitySubIndicators(fin),
    competition: calcCompetitionSubIndicators(industry, fin),
    policy: calcPolicySubIndicators(industry, fin),
    technology: calcTechnologySubIndicators(industry, fin),
  }
}

// ============================================================
// 行业趋势分析（v2.9.5 新增）
// ============================================================

/**
 * 计算单指标趋势（简化版，基于增速本身的二阶效应）
 *
 * 由于目前只有单期数据，我们用：
 * - 营收增速 vs 利润增速 的对比 → 推断趋势方向
 * - 利润率变化方向 → 推断加速度
 */
function calcSimpleTrend(
  currentScore: number | null,
  growthRate: number | null,
  marginChange: number | null,
): ProsperityTrend {
  let direction: TrendDirection = 'unknown'
  let strength: TrendStrength = 'unknown'
  let change: number | null = null
  let changeRate: number | null = null
  let acceleration: number | null = null
  const consecutivePeriods = 1
  const isInflectionPoint = false
  const inflectionType: 'bottom' | 'top' | null = null

  if (growthRate !== null && currentScore !== null) {
    // 简化：用增速大小推断趋势方向（高增速=向上，负增长=向下）
    const trend = resolveTrendFromGrowth(growthRate)
    direction = trend.direction
    strength = trend.strength
    change = trend.change

    changeRate = currentScore > 0 ? (change / currentScore) * 100 : null

    // 加速度（基于利润率变化 proxy）
    if (marginChange !== null) {
      acceleration = marginChange / 10
    }
  }

  return {
    currentScore,
    previousScore: currentScore !== null && change !== null ? currentScore - change : null,
    change,
    changeRate,
    direction,
    strength,
    acceleration,
    consecutivePeriods,
    isInflectionPoint,
    inflectionType,
  }
}

/**
 * 分析行业趋势（单期数据简化版）
 *
 * 注：完整趋势分析需要多期历史数据。
 * 这里基于单期数据做简化推断，后续接入历史数据后升级。
 */
export function analyzeIndustryTrend(
  industry: IndustryDefinition,
  fin: IndustryFinancialAggregateEnhanced,
  prosperityScore: number | null,
): IndustryTrendAnalysis {
  // 营收增速趋势
  const revGrowth = fin.revenueYoYMedian
  const revTrend = calcSimpleTrend(
    revGrowth !== null ? Math.min(5, Math.max(0, revGrowth / 10)) : null,
    revGrowth,
    fin.grossMarginMedian,
  )

  // 利润增速趋势
  const profitGrowth = fin.netProfitYoYMedian
  const profitTrend = calcSimpleTrend(
    profitGrowth !== null ? Math.min(5, Math.max(0, profitGrowth / 10)) : null,
    profitGrowth,
    fin.netMarginMedian,
  )

  // 综合景气度趋势
  const prosperityTrend = calcSimpleTrend(
    prosperityScore,
    revGrowth,
    fin.grossMarginMedian,
  )

  // 综合趋势评分
  let trendScore: number | null = null
  if (prosperityTrend.change !== null && prosperityScore !== null) {
    const trendComponent = prosperityTrend.direction === 'up' ? 1 : prosperityTrend.direction === 'down' ? -1 : 0
    const strengthMul = prosperityTrend.strength === 'strong' ? 1.5 : prosperityTrend.strength === 'moderate' ? 1 : 0.5
    trendScore = Math.min(5, Math.max(0, 2.5 + trendComponent * strengthMul))
  }

  // 趋势总结
  let summary = ''
  if (prosperityTrend.direction === 'up') {
    const strengthText = prosperityTrend.strength === 'strong' ? '强劲' : prosperityTrend.strength === 'moderate' ? '稳健' : '温和'
    summary = `行业景气度${strengthText}向上，营收增速 ${revGrowth?.toFixed(1) ?? 'N/A'}%，利润增速 ${profitGrowth?.toFixed(1) ?? 'N/A'}%`
  } else if (prosperityTrend.direction === 'down') {
    const strengthText = prosperityTrend.strength === 'strong' ? '明显' : prosperityTrend.strength === 'moderate' ? '有所' : '小幅'
    summary = `行业景气度${strengthText}下行，营收增速 ${revGrowth?.toFixed(1) ?? 'N/A'}%，利润增速 ${profitGrowth?.toFixed(1) ?? 'N/A'}%`
  } else {
    summary = '行业景气度平稳，暂无明显趋势信号'
  }

  return {
    industryCode: industry.code,
    industryName: industry.name,
    prosperityTrend,
    revenueGrowthTrend: revTrend,
    profitGrowthTrend: profitTrend,
    trendScore,
    summary,
    analyzedAt: Date.now(),
  }
}

// ============================================================
// 增强版 V4 分析入口（v2.9.5 新增）
// ============================================================

/**
 * 增强版：执行行业 V4 维度分析（含子指标细化 + 趋势 + 估值）
 */
export function analyzeIndustryV4Enhanced(
  industry: IndustryDefinition,
  financialAggregate: IndustryFinancialAggregateEnhanced,
  quoteAggregate: IndustryQuoteAggregate,
  validation: IndustryDataValidation,
  valuation?: import('@/data/types/types.sector').IndustryValuationAnalysis,
): IndustryV4AnalysisEnhanced {
  // 基础 V4 分析
  const base = analyzeIndustryV4(industry, financialAggregate, quoteAggregate, validation)

  // 子指标细化
  const subIndicators = calcAllSubIndicators(industry, financialAggregate)

  // 趋势分析
  const trend = analyzeIndustryTrend(
    industry,
    financialAggregate,
    base.dimensions.prosperity.score,
  )

  const result: IndustryV4AnalysisEnhanced = {
    ...base,
    subIndicators,
    trend,
    valuation,
  }

  logger.info(`[industryV4Analyzer] 增强版V4分析完成: ${industry.name}`, {
    v4Composite: result.v4Composite,
    hasValuation: valuation !== undefined,
    trendDirection: trend.prosperityTrend.direction,
  })

  return result
}

/**
 * 批量增强版 V4 分析
 */
export function analyzeAllIndustriesV4Enhanced(
  aggregationResults: Array<{
    industry: IndustryDefinition
    financialAggregate: IndustryFinancialAggregateEnhanced
    quoteAggregate: IndustryQuoteAggregate
    validation: IndustryDataValidation
    valuation?: import('@/data/types/types.sector').IndustryValuationAnalysis
  }>,
): IndustryV4AnalysisEnhanced[] {
  const results: IndustryV4AnalysisEnhanced[] = []

  for (const agg of aggregationResults) {
    const v4 = analyzeIndustryV4Enhanced(
      agg.industry,
      agg.financialAggregate,
      agg.quoteAggregate,
      agg.validation,
      agg.valuation,
    )
    results.push(v4)
  }

  logger.info(`[industryV4Analyzer] 增强版批量V4分析完成: ${results.length} 个行业`)

  return results.sort((a, b) => {
    const scoreA = a.v4Composite ?? -1
    const scoreB = b.v4Composite ?? -1
    return scoreB - scoreA
  })
}

// ============================================================
// 行业轮动信号（v2.9.5 新增）
// ============================================================

/**
 * 根据综合评分解析轮动信号。
 * 消除 generateRotationSignals 中深层 else-if 链（audit:complexity L5）。
 */
function resolveRotationSignal(compositeScore: number): { signal: string; signalStrength: number } {
  if (compositeScore >= SIGNAL_THRESHOLDS.STRONG_BUY) return { signal: 'strong_buy', signalStrength: 5 }
  if (compositeScore >= SIGNAL_THRESHOLDS.BUY) return { signal: 'buy', signalStrength: 4 }
  if (compositeScore >= SIGNAL_THRESHOLDS.HOLD) return { signal: 'hold', signalStrength: 3 }
  if (compositeScore >= SIGNAL_THRESHOLDS.REDUCE) return { signal: 'reduce', signalStrength: 2 }
  return { signal: 'strong_reduce', signalStrength: 1 }
}

/**
 * 根据估值数据计算估值评分。
 * 消除 generateRotationSignals 中嵌套 if-else（audit:complexity L4）。
 */
function resolveValuationScore(valuation: { valuationScore?: number | null; pePercentile?: number | null } | null): number | null {
  if (!valuation) return null
  if (valuation.valuationScore != null) return valuation.valuationScore
  if (valuation.pePercentile != null) return 5 - valuation.pePercentile * 5
  return null
}

/**
 * 生成行业轮动信号
 *
 * 综合考虑：
 * - V4 景气度（40%）：行业基本面
 * - 趋势方向（25%）：景气变化方向
 * - 估值水平（20%）：安全边际
 * - 行情动量（15%）：市场热度
 */
export function generateRotationSignals(
  v4Analyses: IndustryV4AnalysisEnhanced[],
): IndustryRotationSignal[] {
  const signals: IndustryRotationSignal[] = []

  for (const v4 of v4Analyses) {
    const v4Score = v4.v4Composite

    let trendScore: number | null = null
    if (v4.trend?.trendScore !== undefined) {
      trendScore = v4.trend.trendScore
    } else if (v4.trend?.prosperityTrend) {
      const t = v4.trend.prosperityTrend
      trendScore = TREND_SCORE_MAP[t.direction][t.strength]
    }

    const valuationScore = resolveValuationScore(v4.valuation ?? null)

    const momentumScore = v4.dimensions.technology.score

    let totalWeight = 0
    let weightedSum = 0
    const scores: IndustryRotationSignal['scores'] = {
      v4: v4Score,
      trend: trendScore,
      valuation: valuationScore,
      momentum: momentumScore,
    }

    if (v4Score !== null) {
      weightedSum += v4Score * ROTATION_SIGNAL_WEIGHTS.v4
      totalWeight += ROTATION_SIGNAL_WEIGHTS.v4
    }
    if (trendScore !== null) {
      weightedSum += trendScore * ROTATION_SIGNAL_WEIGHTS.trend
      totalWeight += ROTATION_SIGNAL_WEIGHTS.trend
    }
    if (valuationScore !== null) {
      weightedSum += valuationScore * ROTATION_SIGNAL_WEIGHTS.valuation
      totalWeight += ROTATION_SIGNAL_WEIGHTS.valuation
    }
    if (momentumScore !== null) {
      weightedSum += momentumScore * ROTATION_SIGNAL_WEIGHTS.momentum
      totalWeight += ROTATION_SIGNAL_WEIGHTS.momentum
    }

    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : DEFAULT_COMPOSITE_SCORE

    const rs = resolveRotationSignal(compositeScore)
    const signal = rs.signal as RotationSignalType
    const signalStrength = rs.signalStrength

    const rationale = buildRotationRationale(v4, scores, compositeScore, signal)
    const risks = buildRotationRisks(v4)

    signals.push({
      industryCode: v4.industryCode,
      industryName: v4.industryName,
      signal,
      signalStrength,
      compositeScore: Math.round(compositeScore * 100) / 100,
      scores,
      rationale,
      risks,
      generatedAt: Date.now(),
    })
  }

  return signals.sort((a, b) => b.compositeScore - a.compositeScore)
}

function buildRotationRationale(
  v4: IndustryV4AnalysisEnhanced,
  scores: IndustryRotationSignal['scores'],
  _compositeScore: number,
  signal: RotationSignalType,
): string {
  const parts: string[] = []

  if (scores.v4 !== null) {
    if (scores.v4 >= 4) parts.push(`景气度高(${scores.v4.toFixed(1)})`)
    else if (scores.v4 >= 3) parts.push(`景气度尚可(${scores.v4.toFixed(1)})`)
    else parts.push(`景气度偏低(${scores.v4.toFixed(1)})`)
  }

  if (v4.trend?.prosperityTrend) {
    const t = v4.trend.prosperityTrend
    if (t.direction === 'up') {
      const s = t.strength === 'strong' ? '强劲' : t.strength === 'moderate' ? '稳健' : '温和'
      parts.push(`趋势${s}向上`)
    } else if (t.direction === 'down') {
      const s = t.strength === 'strong' ? '明显' : t.strength === 'moderate' ? '有所' : '小幅'
      parts.push(`趋势${s}下行`)
    }
  }

  if (v4.valuation?.pePercentileLevel) {
    const levelMap: Record<string, string> = {
      extremely_low: '极度低估',
      low: '低估',
      medium_low: '偏低估',
      medium: '估值合理',
      medium_high: '偏高估',
      high: '高估',
      extremely_high: '极度高估',
    }
    parts.push(levelMap[v4.valuation.pePercentileLevel] ?? '估值未知')
  }

  const signalLabel: Record<RotationSignalType, string> = {
    strong_buy: '强烈推荐',
    buy: '推荐',
    hold: '持有',
    reduce: '谨慎',
    strong_reduce: '回避',
    observe: '观察',
  }

  return `${signalLabel[signal]}：${parts.join('，')}`
}

function buildRotationRisks(v4: IndustryV4AnalysisEnhanced): string[] {
  const risks: string[] = []

  if (v4.dataCompleteness < 0.5) {
    risks.push('行业数据完整度较低，分析参考性有限')
  }
  if (v4.constituentCount < 5) {
    risks.push(`成分股数量较少(${v4.constituentCount}只)，行业代表性不足`)
  }

  if (v4.trend?.prosperityTrend.direction === 'down') {
    risks.push('行业景气度处于下行趋势，需警惕业绩不及预期风险')
  }

  if (v4.valuation?.pePercentileLevel === 'extremely_high' || v4.valuation?.pePercentileLevel === 'high') {
    risks.push('行业估值处于历史高位，存在估值回调风险')
  }

  if (v4.subIndicators.policy.regulatoryRisk != null && v4.subIndicators.policy.regulatoryRisk >= 4) {
    risks.push('行业监管风险较高，需关注政策变化')
  }

  if (v4.subIndicators.technology.substitutionRisk != null && v4.subIndicators.technology.substitutionRisk >= 4) {
    risks.push('技术替代风险较高，需关注技术路线变化')
  }

  return risks
}

/**
 * 获取信号类型的中文标签
 */
export function getSignalLabel(signal: RotationSignalType): string {
  const map: Record<RotationSignalType, string> = {
    strong_buy: '强烈推荐',
    buy: '推荐',
    hold: '持有',
    reduce: '谨慎',
    strong_reduce: '回避',
    observe: '观察',
  }
  return map[signal]
}
