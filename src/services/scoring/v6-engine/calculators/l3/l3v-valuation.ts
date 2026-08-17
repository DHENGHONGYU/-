/**
 * L3v 估值水平计算器
 * 
 * 行业基准校准估值（四因子体系）：
 * - PEG 评分（优先）
 * - PE 评分（PEG 缺失时）
 * - 行业基准校准
 * - P0-1: DDM 分红折价因子（维度 15 数据）
 * - P0-1: 一致预期差因子（维度 16 数据）
 * 
 * 权重：14%
 * 类型：确定性层（程序直算）
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from '../../types'
import { LAYER_LABELS } from '../../types'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { matchIndustryBenchmark, clamp } from './utils'

const logger = getLogger()

// ── P0-1: DDM 折价因子阈值 ──
const DDM_THRESHOLDS = {
  /** 高股息率阈值（%），≥ 此值视为高股息，+1.0 分 */
  HIGH_DIV_YIELD: 3.5,
  /** 中等股息率阈值（%），≥ 此值视为中等股息，+0.5 分 */
  MID_DIV_YIELD: 2.0,
  /** 低股息率阈值（%），< 此值不加分 */
  LOW_DIV_YIELD: 1.0,
  /** 分红率健康阈值（%），≥ 此值视为分红可持续，+0.5 分 */
  SUSTAINABLE_PAYOUT: 20,
  /** 分红率过高阈值（%），> 此值警惕不可持续，-0.5 分 */
  EXCESSIVE_PAYOUT: 80,
  /** 近 3 年累计分红增长阈值（亿元），≥ 此值 +0.5 分 */
  DIV_GROWTH_3Y: 10,
  /** DDM 折价因子最大调整幅度 */
  MAX_ADJUST: 1.5,
}

// ── P0-1: 一致预期差因子阈值 ──
const CONSENSUS_THRESHOLDS = {
  /** 当前 PE 与一致预期 EPS 隐含 PE 的偏差阈值（%），低于此值视为低估 */
  PE_DISCOUNT: 0.7,
  /** 一致预期 EPS 增速阈值（%），≥ 此值视为高增长，+0.5 分 */
  HIGH_EPS_GROWTH: 15,
  /** 评级买入+增持占比阈值（%），≥ 此值视为乐观，+0.5 分 */
  BULLISH_RATIO: 60,
  /** 目标价上行空间阈值（%），≥ 此值 +0.5 分 */
  UPSIDE_THRESHOLD: 15,
  /** 评级下调惩罚（分） */
  DOWNGRADE_PENALTY: -0.5,
  /** 一致预期差因子最大调整幅度 */
  MAX_ADJUST: 1.5,
}

// ── P1-3: EV/EBITDA + PS 多维度估值因子阈值 ──
const MULTI_FACTOR_VALUATION = {
  /** EV/EBITDA 低估值阈值（低于此值 +0.5 分） */
  EV_EBITDA_LOW: 8,
  /** EV/EBITDA 中估值阈值（低于此值 +0.3 分） */
  EV_EBITDA_MID: 15,
  /** EV/EBITDA 高估值阈值（高于此值 -0.5 分） */
  EV_EBITDA_HIGH: 25,
  /** PS 低估值阈值（低于此值 +0.5 分，适用于高成长低利润公司） */
  PS_LOW: 2,
  /** PS 中估值阈值 */
  PS_MID: 5,
  /** PS 高估值阈值（高于此值 -0.3 分） */
  PS_HIGH: 10,
  /** 多因子调整最大幅度 */
  MAX_ADJUST: 1.0,
}

function scorePeg(peg: number): number {
  const PEG_TIERS = [
    { threshold: V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PEG_TIER1, score: 5 },
    { threshold: V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PEG_TIER2, score: 4 },
    { threshold: V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PEG_TIER3, score: 3 },
    { threshold: V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PEG_TIER4, score: 2.5 },
  ]
  const matched = PEG_TIERS.find((t) => peg < t.threshold)
  return matched?.score ?? 2
}

function scorePeRelative(pe: number, benchmark: { peLow: number; peHigh: number } | null): number {
  if (benchmark) {
    if (pe < benchmark.peLow) return 4.5
    if (pe < benchmark.peHigh) return 3.5
    return 2.5
  }
  if (pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_LOW) return 4.5
  if (pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_MEDIUM) return 3.5
  return 2.5
}

/**
 * P0-1: DDM 分红折价因子评分
 * 基于维度 15 分红股本数据，评估分红对估值的折价/溢价影响
 */
function scoreDdmDividend(input: LayerInput): { adjust: number; evidence: string[] } {
  const { dividend } = input
  const evidence: string[] = []
  let adjust = 0

  if (!dividend || dividend.totalShares === 0) {
    return { adjust: 0, evidence }
  }

  // 1. 股息率评分
  if (dividend.dividendYield >= DDM_THRESHOLDS.HIGH_DIV_YIELD) {
    adjust += 1.0
    evidence.push(`高股息率: ${dividend.dividendYield.toFixed(1)}% ≥ ${DDM_THRESHOLDS.HIGH_DIV_YIELD}% → +1.0`)
  } else if (dividend.dividendYield >= DDM_THRESHOLDS.MID_DIV_YIELD) {
    adjust += 0.5
    evidence.push(`中等股息率: ${dividend.dividendYield.toFixed(1)}% ≥ ${DDM_THRESHOLDS.MID_DIV_YIELD}% → +0.5`)
  } else if (dividend.dividendYield < DDM_THRESHOLDS.LOW_DIV_YIELD) {
    adjust -= 0.3
    evidence.push(`低股息率: ${dividend.dividendYield.toFixed(1)}% < ${DDM_THRESHOLDS.LOW_DIV_YIELD}% → -0.3`)
  }

  // 2. 分红可持续性评分
  if (dividend.payoutRatio3Y >= DDM_THRESHOLDS.SUSTAINABLE_PAYOUT &&
      dividend.payoutRatio3Y <= DDM_THRESHOLDS.EXCESSIVE_PAYOUT) {
    adjust += 0.5
    evidence.push(`分红率健康: ${dividend.payoutRatio3Y.toFixed(0)}% 在 ${DDM_THRESHOLDS.SUSTAINABLE_PAYOUT}%-${DDM_THRESHOLDS.EXCESSIVE_PAYOUT}% → +0.5`)
  } else if (dividend.payoutRatio3Y > DDM_THRESHOLDS.EXCESSIVE_PAYOUT) {
    adjust -= 0.5
    evidence.push(`分红率过高(不可持续): ${dividend.payoutRatio3Y.toFixed(0)}% > ${DDM_THRESHOLDS.EXCESSIVE_PAYOUT}% → -0.5`)
  }

  // 3. 分红稳定性评分（近 3 年累计分红）
  if (dividend.totalDividend3Y >= DDM_THRESHOLDS.DIV_GROWTH_3Y) {
    adjust += 0.5
    evidence.push(`近 3 年累计分红: ${dividend.totalDividend3Y.toFixed(1)}亿元 ≥ ${DDM_THRESHOLDS.DIV_GROWTH_3Y}亿元 → +0.5`)
  }

  // 4. 限售股解禁风险
  if (dividend.nextUnlockShares && dividend.nextUnlockShares > 0 &&
      dividend.totalShares > 0 &&
      dividend.nextUnlockShares / dividend.totalShares > 0.05) {
    adjust -= 0.5
    evidence.push(`限售股解禁占比: ${(dividend.nextUnlockShares / dividend.totalShares * 100).toFixed(1)}% > 5% → -0.5`)
  }

  adjust = Math.max(-DDM_THRESHOLDS.MAX_ADJUST, Math.min(DDM_THRESHOLDS.MAX_ADJUST, adjust))
  return { adjust, evidence }
}

/**
 * P0-1: 一致预期差因子评分
 * 基于维度 16 一致预期数据，评估当前估值与市场预期的偏差
 */
function scoreConsensusGap(input: LayerInput): { adjust: number; evidence: string[] } {
  const { consensus, stock } = input
  const evidence: string[] = []
  let adjust = 0

  if (!consensus || consensus.estimates.length === 0) {
    return { adjust: 0, evidence }
  }

  const currentYear = new Date().getFullYear()
  const currentEstimate = consensus.estimates.find(e => e.fiscalYear === currentYear) ??
    consensus.estimates.find(e => e.fiscalYear === currentYear + 1) ??
    consensus.estimates[0]

  // 1. 一致预期 EPS 增速评分
  if (consensus.estimates.length >= 2) {
    const thisYear = consensus.estimates[0]!
    const nextYear = consensus.estimates[1]!
    if (thisYear.epsEstimate > 0) {
      const epsGrowth = (nextYear.epsEstimate - thisYear.epsEstimate) / thisYear.epsEstimate * 100
      if (epsGrowth >= CONSENSUS_THRESHOLDS.HIGH_EPS_GROWTH) {
        adjust += 0.5
        evidence.push(`一致预期 EPS 增速: ${epsGrowth.toFixed(1)}% ≥ ${CONSENSUS_THRESHOLDS.HIGH_EPS_GROWTH}% → +0.5`)
      } else if (epsGrowth < 0) {
        adjust -= 0.5
        evidence.push(`一致预期 EPS 负增长: ${epsGrowth.toFixed(1)}% → -0.5`)
      }
    }
  }

  // 2. 当前 PE 与一致预期隐含 PE 对比
  if (stock.pe !== undefined && stock.pe > 0 && currentEstimate && currentEstimate.epsEstimate > 0) {
    const impliedPE = stock.price ? stock.price / currentEstimate.epsEstimate : undefined
    if (impliedPE !== undefined && impliedPE > 0) {
      const peRatio = impliedPE / stock.pe
      if (peRatio < CONSENSUS_THRESHOLDS.PE_DISCOUNT) {
        adjust += 0.5
        evidence.push(`一致预期隐含 PE(${impliedPE.toFixed(1)}) / 当前 PE(${stock.pe.toFixed(1)}) = ${peRatio.toFixed(2)} < ${CONSENSUS_THRESHOLDS.PE_DISCOUNT} → 低估 +0.5`)
      }
    }
  }

  // 3. 评级乐观度评分
  const { rating } = consensus
  const totalRatings = rating.buyCount + rating.overweightCount + rating.holdCount +
    rating.underweightSellCount
  if (totalRatings > 0) {
    const bullishRatio = (rating.buyCount + rating.overweightCount) / totalRatings * 100
    if (bullishRatio >= CONSENSUS_THRESHOLDS.BULLISH_RATIO) {
      adjust += 0.5
      evidence.push(`评级乐观度: ${bullishRatio.toFixed(0)}% ≥ ${CONSENSUS_THRESHOLDS.BULLISH_RATIO}% → +0.5`)
    } else if (bullishRatio < 30) {
      adjust -= 0.5
      evidence.push(`评级悲观度: ${bullishRatio.toFixed(0)}% < 30% → -0.5`)
    }
  }

  // 4. 目标价上行空间
  if (stock.price && stock.price > 0 && rating.consensusTargetPrice > 0) {
    const upside = (rating.consensusTargetPrice - stock.price) / stock.price * 100
    if (upside >= CONSENSUS_THRESHOLDS.UPSIDE_THRESHOLD) {
      adjust += 0.5
      evidence.push(`目标价上行空间: ${upside.toFixed(1)}% ≥ ${CONSENSUS_THRESHOLDS.UPSIDE_THRESHOLD}% → +0.5`)
    } else if (upside < -10) {
      adjust -= 0.5
      evidence.push(`目标价下行空间: ${upside.toFixed(1)}% → -0.5`)
    }
  }

  // 5. 评级变化趋势
  if (rating.recentTrend === 'downgrade') {
    adjust += CONSENSUS_THRESHOLDS.DOWNGRADE_PENALTY
    evidence.push(`评级下调趋势: ${CONSENSUS_THRESHOLDS.DOWNGRADE_PENALTY} → 谨慎`)
  } else if (rating.recentTrend === 'upgrade') {
    adjust += 0.3
    evidence.push(`评级上调趋势: +0.3`)
  }

  adjust = Math.max(-CONSENSUS_THRESHOLDS.MAX_ADJUST, Math.min(CONSENSUS_THRESHOLDS.MAX_ADJUST, adjust))
  return { adjust, evidence }
}

/**
 * P1-3: 多因子估值评分（EV/EBITDA + PS）
 * 扩展 PEG/PE 之外的估值维度，对标可比估值模型
 */
function scoreMultiFactorValuation(input: LayerInput): { adjust: number; evidence: string[] } {
  const { stock, financials } = input
  const evidence: string[] = []
  let adjust = 0

  // 1. EV/EBITDA 评分（企业价值 / 息税折旧摊销前利润）
  if (stock.marketCap && financials.netProfit && financials.netProfit > 0) {
    // 简化 EV 估算：市值 + 有息负债
    const ev = stock.marketCap + (financials.interestBearingDebt ?? 0)
    // 简化 EBITDA 估算：净利润 + 折旧摊销（用净利润的 1.5 倍近似）
    const ebitda = financials.netProfit * 1.5
    if (ebitda > 0) {
      const evEbitda = ev / ebitda
      if (evEbitda < MULTI_FACTOR_VALUATION.EV_EBITDA_LOW) {
        adjust += 0.5
        evidence.push(`EV/EBITDA=${evEbitda.toFixed(1)} < ${MULTI_FACTOR_VALUATION.EV_EBITDA_LOW} → 低估 +0.5`)
      } else if (evEbitda < MULTI_FACTOR_VALUATION.EV_EBITDA_MID) {
        adjust += 0.3
        evidence.push(`EV/EBITDA=${evEbitda.toFixed(1)} < ${MULTI_FACTOR_VALUATION.EV_EBITDA_MID} → 合理 +0.3`)
      } else if (evEbitda > MULTI_FACTOR_VALUATION.EV_EBITDA_HIGH) {
        adjust -= 0.5
        evidence.push(`EV/EBITDA=${evEbitda.toFixed(1)} > ${MULTI_FACTOR_VALUATION.EV_EBITDA_HIGH} → 高估 -0.5`)
      }
    }
  }

  // 2. PS 评分（市销率，适用于高成长低利润/亏损公司）
  if (stock.marketCap && financials.revenue && financials.revenue > 0) {
    const ps = stock.marketCap / financials.revenue
    if (ps < MULTI_FACTOR_VALUATION.PS_LOW) {
      adjust += 0.5
      evidence.push(`PS=${ps.toFixed(1)} < ${MULTI_FACTOR_VALUATION.PS_LOW} → 低估 +0.5`)
    } else if (ps < MULTI_FACTOR_VALUATION.PS_MID) {
      adjust += 0.3
      evidence.push(`PS=${ps.toFixed(1)} < ${MULTI_FACTOR_VALUATION.PS_MID} → 合理 +0.3`)
    } else if (ps > MULTI_FACTOR_VALUATION.PS_HIGH) {
      adjust -= 0.3
      evidence.push(`PS=${ps.toFixed(1)} > ${MULTI_FACTOR_VALUATION.PS_HIGH} → 偏高 -0.3`)
    }
  }

  adjust = Math.max(-MULTI_FACTOR_VALUATION.MAX_ADJUST, Math.min(MULTI_FACTOR_VALUATION.MAX_ADJUST, adjust))
  return { adjust, evidence }
}

/**
 * 估值评分（五因子体系：PEG + PE + DDM + 一致预期 + 多因子）
 */
function scoreValuation(input: LayerInput): { score: number; summary: string; evidence: string[] } {
  const { stock } = input
  const evidence: string[] = []
  const benchmark = matchIndustryBenchmark(stock.sector)

  let pegScore = 3 // 默认合理

  if (stock.peg !== undefined && stock.peg > 0) {
    pegScore = scorePeg(stock.peg)
    evidence.push(`PEG=${stock.peg.toFixed(2)}`)
  } else if (stock.pe !== undefined && stock.pe > 0) {
    // PEG 缺失时用 PE 做粗略判断
    pegScore = scorePeRelative(stock.pe, benchmark)
    evidence.push(`PE=${stock.pe.toFixed(1)}`)
  }

  // 行业基准校准
  let industryAdjust = 0
  if (benchmark && stock.pe !== undefined && stock.pe > 0) {
    if (stock.pe < benchmark.peLow) {
      industryAdjust = V6_CALCULATOR_THRESHOLDS.L3_VALUATION_INDUSTRY_ADJUST
      evidence.push(`PE ${stock.pe.toFixed(1)} < 行业下限 ${benchmark.peLow}x → 低估 +0.5`)
    } else if (stock.pe > benchmark.peHigh) {
      industryAdjust = -V6_CALCULATOR_THRESHOLDS.L3_VALUATION_INDUSTRY_ADJUST
      evidence.push(`PE ${stock.pe.toFixed(1)} > 行业上限 ${benchmark.peHigh}x → 高估 -0.5`)
    } else {
      evidence.push(`PE ${stock.pe.toFixed(1)} 在行业区间 ${benchmark.peLow}-${benchmark.peHigh}x 内`)
    }
    evidence.push(`行业基准: ${benchmark.sector} PEG ${benchmark.peglow}-${benchmark.pegHigh}`)
  }

  // P0-1: DDM 分红折价因子
  const ddmResult = scoreDdmDividend(input)
  evidence.push(...ddmResult.evidence)

  // P0-1: 一致预期差因子
  const consensusResult = scoreConsensusGap(input)
  evidence.push(...consensusResult.evidence)

  // P1-3: 多因子估值（EV/EBITDA + PS）
  const multiFactorResult = scoreMultiFactorValuation(input)
  evidence.push(...multiFactorResult.evidence)

  const totalAdjust = ddmResult.adjust + consensusResult.adjust + multiFactorResult.adjust
  const score = clamp(pegScore + industryAdjust + totalAdjust)

  // 构建摘要
  const parts: string[] = []
  if (benchmark) parts.push(benchmark.sector)
  parts.push(score >= 4 ? '低估' : score >= 3 ? '合理' : '高估')
  if (ddmResult.adjust !== 0) parts.push(`DDM${ddmResult.adjust > 0 ? '+' : ''}${ddmResult.adjust.toFixed(1)}`)
  if (consensusResult.adjust !== 0) parts.push(`预期差${consensusResult.adjust > 0 ? '+' : ''}${consensusResult.adjust.toFixed(1)}`)
  if (multiFactorResult.adjust !== 0) parts.push(`多因子${multiFactorResult.adjust > 0 ? '+' : ''}${multiFactorResult.adjust.toFixed(1)}`)
  const summary = parts.join(' | ')

  return { score, summary, evidence }
}

/**
 * L3v 估值水平计算器
 */
export const L3vValuationCalculator: LayerCalculator = {
  layerId: 'l3v' as const,

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config, dividend, consensus } = input
    const weight = config.weights.l3v
    const risks: string[] = []
    const dataSources = ['行情数据', '行业基准库']

    try {
      const { score, summary, evidence } = scoreValuation(input)

      // P0-1: 标记新数据源
      if (dividend) dataSources.push('分红股本数据(维度15)')
      if (consensus) dataSources.push('一致预期数据(维度16)')

      logger.info(`[L3v] ${stock.symbol}: PEG=${stock.peg ?? 'N/A'}, PE=${stock.pe ?? 'N/A'}, score=${score.toFixed(2)}` +
        (dividend ? `, DDM adj present` : '') +
        (consensus ? `, consensus adj present` : ''))

      if (score < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_RISK_THRESHOLD) {
        risks.push('估值偏高，需关注回撤风险')
      }

      const hasValuationData = (stock.pe !== undefined && stock.pe > 0) || (stock.peg !== undefined && stock.peg > 0)

      return {
        layerId: 'l3v',
        layerName: LAYER_LABELS.l3v ?? 'L3b 估值水平',
        score: Math.round(score * 100) / 100,
        summary,
        risks,
        evidence,
        weight,
        weightedScore: score * weight,
        dataSources,
        participated: hasValuationData,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L3v] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l3v',
        layerName: LAYER_LABELS.l3v ?? 'L3b 估值水平',
        score: Number.NaN,
        summary: `估值计算失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: Number.NaN,
        dataSources: [],
        participated: false,
      }
    }
  },
}
