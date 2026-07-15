/**
 * L3v 估值水平计算器
 * 
 * 行业基准校准估值：
 * - PEG 评分（优先）
 * - PE 评分（PEG 缺失时）
 * - 行业基准校准
 * 
 * 权重：8%
 * 类型：确定性层（程序直算）
 */

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from '../../types'
import { LAYER_LABELS } from '../../types'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { matchIndustryBenchmark, clamp } from './utils'

const logger = getLogger()

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
 * 估值评分
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
      industryAdjust = V6_CALCULATOR_THRESHOLDS.L3_VALUATION_INDUSTRY_ADJUST // 低于行业区间下限 → 低估
      evidence.push(`PE ${stock.pe.toFixed(1)} < 行业下限 ${benchmark.peLow}x → 低估 +0.5`)
    } else if (stock.pe > benchmark.peHigh) {
      industryAdjust = -V6_CALCULATOR_THRESHOLDS.L3_VALUATION_INDUSTRY_ADJUST // 高于行业区间上限 → 高估
      evidence.push(`PE ${stock.pe.toFixed(1)} > 行业上限 ${benchmark.peHigh}x → 高估 -0.5`)
    } else {
      evidence.push(`PE ${stock.pe.toFixed(1)} 在行业区间 ${benchmark.peLow}-${benchmark.peHigh}x 内`)
    }
    evidence.push(`行业基准: ${benchmark.sector} PEG ${benchmark.peglow}-${benchmark.pegHigh}`)
  }

  const score = clamp(pegScore + industryAdjust)
  const summary = benchmark
    ? `${benchmark.sector}行业基准校准 | PEG ${score >= 4 ? '低估' : score >= 3 ? '合理' : '高估'}`
    : `PEG 评分 ${score >= 4 ? '低估' : score >= 3 ? '合理' : '高估'}`

  return { score, summary, evidence }
}

/**
 * L3v 估值水平计算器
 */
export const L3vValuationCalculator: LayerCalculator = {
  layerId: 'l3v' as const,

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l3v
    const risks: string[] = []

    try {
      const { score, summary, evidence } = scoreValuation(input)

      logger.info(`[L3v] ${stock.symbol}: PEG=${stock.peg ?? 'N/A'}, PE=${stock.pe ?? 'N/A'}, score=${score.toFixed(2)}`)

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
        dataSources: ['行情数据', '行业基准库'],
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
