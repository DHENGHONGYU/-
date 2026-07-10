/**
 * L7 第二曲线 + L8 技术筹码 计算器
 *
 * 按 SKILL v4.3：
 * - L7：生命阶段诊断 + 催化剂强度评估（权重 15%）
 * - L8：八级筹码量化体系 SCD→PCH→AII→MATRIX→RSI→CCS→DIV→CSR（权重 4%）
 *
 * 类型：L7 为 LLM 可增强层，L8 为确定性层（K线量价直算）
 */

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator, ChipResult } from '../types'
import type { LayerId } from '../types'
import { LAYER_LABELS } from '../types'
import { CHIP_LEVELS } from '../config'
import type { ChipLevel } from '../config'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { safeArrayGet } from '@/utils/precision'

const logger = getLogger()

// ============================================================
// L7 第二曲线分析 — 权重 15%
// ============================================================

interface LifeStage {
  stage: string
  description: string
  baseScore: number
}

/**
 * diagnoseLifeStage
 * @param input
 * @returns LifeStage
 */
export function diagnoseLifeStage(input: LayerInput): LifeStage {
  const { financials: f } = input
  const revenueYoY = f.revenueYoY
  // revenueShare 表示该业务在总收入中的占比，这里用整体营收增速做近似
  // 实际使用时应由调用方传入按业务板块拆分的 revenueShare

  if (revenueYoY === undefined) {
    return { stage: '数据不足', description: '无法判断生命阶段', baseScore: 2.5 }
  }

  // 营收高增速 + 亏损 → 孵化期/爆发期
  const isLossMaking = f.netProfit !== undefined && f.netProfit < 0

  if (revenueYoY > V6_CALCULATOR_THRESHOLDS.L7_LIFE_STAGE_TIER1) {
    return isLossMaking
      ? { stage: '孵化期', description: '营收翻倍增长但仍在投入期，高研发烧钱', baseScore: 3.0 }
      : { stage: '爆发期', description: '营收翻倍增长，亏损收窄或扭亏', baseScore: 4.0 }
  }

  if (revenueYoY > V6_CALCULATOR_THRESHOLDS.L7_LIFE_STAGE_TIER2) {
    return isLossMaking
      ? { stage: '爆发期', description: '高速增长中，亏损收窄', baseScore: 4.0 }
      : { stage: '成长前期', description: '高速增长，盈亏平衡附近', baseScore: 4.5 }
  }

  if (revenueYoY > V6_CALCULATOR_THRESHOLDS.L7_LIFE_STAGE_TIER3) {
    return { stage: '成长前期', description: '稳健高增长', baseScore: 4.5 }
  }

  if (revenueYoY > V6_CALCULATOR_THRESHOLDS.L7_LIFE_STAGE_TIER4) {
    return { stage: '成长后期', description: '增速放缓但规模效应显现，开始盈利', baseScore: 5.0 }
  }

  if (revenueYoY > V6_CALCULATOR_THRESHOLDS.L7_LIFE_STAGE_TIER5) {
    return { stage: '成长后期', description: '中等增速，盈利稳定', baseScore: 4.5 }
  }

  return { stage: '成熟期', description: '增速放缓，稳定盈利', baseScore: 3.0 }
}

/**
 * scoreSecondCurve
 * @param input
 */
export function scoreSecondCurve(input: LayerInput): { score: number; summary: string; evidence: string[]; stage: LifeStage } {
  const { financials: f } = input
  const evidence: string[] = []
  const stage = diagnoseLifeStage(input)

  evidence.push(`生命阶段: ${stage.stage} — ${stage.description}`)

  let score = stage.baseScore

  // 催化剂强度评估
  let catalystScore = 0
  if (f.ordersInHand !== undefined && f.revenue !== undefined) {
    const ocr = f.ordersInHand / (f.revenue || 1)
    if (ocr > V6_CALCULATOR_THRESHOLDS.L7_CATALYST_OCR_TIER1) {
      catalystScore += 0.5
      evidence.push(`在手订单覆盖 ${ocr.toFixed(1)}x 营收 → 强催化剂 +0.5`)
    } else if (ocr > V6_CALCULATOR_THRESHOLDS.L7_CATALYST_OCR_TIER2) {
      catalystScore += 0.25
      evidence.push(`在手订单覆盖 ${ocr.toFixed(1)}x 营收 → 中等催化剂 +0.25`)
    }
  }

  if (f.newOrders !== undefined && f.newOrders > 0) {
    catalystScore += 0.25
    evidence.push(`新签订单: ${f.newOrders.toFixed(2)}亿 → 催化剂 +0.25`)
  }

  if (f.rdRatio !== undefined && f.rdRatio > V6_CALCULATOR_THRESHOLDS.L7_CATALYST_RD_HIGH) {
    catalystScore += 0.25
    evidence.push(`研发/营收=${(f.rdRatio * 100).toFixed(1)}%>10% → 技术储备催化 +0.25`)
  }

  score = Math.min(5, score + catalystScore)

  const summary = `${stage.stage} | 催化剂${catalystScore >= 0.5 ? '强' : catalystScore >= 0.25 ? '中等' : '弱'} | ${stage.baseScore >= 4.5 ? '双赛道催化在即' : stage.baseScore >= 4 ? '单赛道强催化' : '曲线不清'}`

  return { score, summary, evidence, stage }
}

/**
 * L7SecondCurveCalculator
 */
export const L7SecondCurveCalculator: LayerCalculator = {
  layerId: 'l7',

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l7
    const risks: string[] = []

    try {
      const { score, summary, evidence, stage } = scoreSecondCurve(input)

      if (score <= V6_CALCULATOR_THRESHOLDS.L7_RISK_THRESHOLD) {
        risks.push('第二曲线不清晰，增长动力单一')
      }
      if (stage.stage === '成熟期' && score < 4) {
        risks.push('处于成熟期且无新催化剂，关注增长天花板')
      }

      logger.info(`[L7] ${stock.symbol}: ${stage.stage}, score=${score.toFixed(2)}`)

      return {
        layerId: 'l7' as LayerId,
        layerName: LAYER_LABELS.l7 ?? 'L7 第二曲线',
        score: Math.round(score * 100) / 100,
        summary,
        risks,
        evidence,
        weight,
        weightedScore: score * weight,
        dataSources: ['财报数据', '订单数据', '行业分析'],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L7] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l7' as LayerId,
        layerName: LAYER_LABELS.l7 ?? 'L7 第二曲线',
        score: 0,
        summary: `第二曲线计算失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: 0,
        dataSources: [],
      }
    }
  },
}

// ============================================================
// L8 技术筹码分析 — 权重 4%
// ============================================================

/**
 * 八级筹码量化体系（SKILL v4.1）
 *
 * 从 QuoteData 中提取 K线/量价/换手率数据，映射到八级指标。
 * 注：完整八级体系需要详细的筹码分布数据（股东人数变化、主力资金流向等），
 * 当前以 K线量价代理指标替代，后续可扩展接入 Level2 数据。
 */

export function evaluateChip(input: LayerInput): ChipResult {
  const { quotes: q } = input
  const levels: Record<ChipLevel, number | null> = {
    SCD: null,
    PCH: null,
    AII: null,
    MATRIX: null,
    RSI: null,
    CCS: null,
    DIV: null,
    CSR: null,
  }

  // SCD — 股东人数变化度（代理：20日收益率+波动率 综合判断）
  if (q.return20d !== undefined && q.volatility20d !== undefined) {
    // 正收益+低波动 → 筹码趋于集中，数值高好
    const scdRaw = (q.return20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_SCD_RETURN_MULTIPLIER + V6_CALCULATOR_THRESHOLDS.L8_CHIP_SCD_OFFSET) / (q.volatility20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_SCD_RETURN_MULTIPLIER + 1)
    const scd = Math.max(0, Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, scdRaw * V6_CALCULATOR_THRESHOLDS.L8_CHIP_SCD_SCORE_MULTIPLIER))
    levels.SCD = Math.round(scd * 100) / 100
  }

  // PCH — 筹码集中度（代理：换手率越低越集中）
  if (q.avgTurnover20d !== undefined) {
    // 换手率 < 1% 高度集中=5分，>10% 极度分散=1分
    const turnoverLevels = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PCH_TURNOVER_LEVELS
    const pchScores = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PCH_SCORES
    const pch = q.avgTurnover20d < safeArrayGet(turnoverLevels, 0)! ? safeArrayGet(pchScores, 0)!
      : q.avgTurnover20d < safeArrayGet(turnoverLevels, 1)! ? safeArrayGet(pchScores, 1)!
      : q.avgTurnover20d < safeArrayGet(turnoverLevels, 2)! ? safeArrayGet(pchScores, 2)!
      : q.avgTurnover20d < safeArrayGet(turnoverLevels, 3)! ? safeArrayGet(pchScores, 3)!
      : q.avgTurnover20d < safeArrayGet(turnoverLevels, 4)! ? safeArrayGet(pchScores, 4)!
      : q.avgTurnover20d < safeArrayGet(turnoverLevels, 5)! ? safeArrayGet(pchScores, 5)!
      : q.avgTurnover20d < safeArrayGet(turnoverLevels, 6)! ? safeArrayGet(pchScores, 6)!
      : safeArrayGet(pchScores, 7)!
    levels.PCH = pch
  }

  // AII — 庄家吸筹强度指数（代理：20日正收益+低换手）
  if (q.return20d !== undefined && q.avgTurnover20d !== undefined) {
    // 正收益+低换手 → 吸筹信号
    const aiiRaw = (q.return20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_RETURN_MULTIPLIER - q.avgTurnover20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_RETURN_MULTIPLIER * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_TURNOVER_MULTIPLIER)
    const aii = Math.max(1, Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, aiiRaw * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_SCORE_MULTIPLIER + V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_OFFSET))
    levels.AII = Math.round(aii * 100) / 100
  }

  // MATRIX — 筹码博弈态势矩阵（代理：收益率+波动率+换手率三维）
  if (q.return20d !== undefined && q.volatility20d !== undefined && q.avgTurnover20d !== undefined) {
    const ret = q.return20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_RETURN_MULTIPLIER
    const vol = q.volatility20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_RETURN_MULTIPLIER
    const to = q.avgTurnover20d * V6_CALCULATOR_THRESHOLDS.L8_CHIP_AII_RETURN_MULTIPLIER
    const matrixRaw = (ret * V6_CALCULATOR_THRESHOLDS.L8_CHIP_MATRIX_RETURN_WEIGHT - vol * V6_CALCULATOR_THRESHOLDS.L8_CHIP_MATRIX_VOLATILITY_WEIGHT + (V6_CALCULATOR_THRESHOLDS.L8_CHIP_MATRIX_REFERENCE - to) * V6_CALCULATOR_THRESHOLDS.L8_CHIP_MATRIX_TURNOVER_WEIGHT)
    const matrix = Math.max(1, Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, matrixRaw * V6_CALCULATOR_THRESHOLDS.L8_CHIP_MATRIX_SCORE_MULTIPLIER + V6_CALCULATOR_THRESHOLDS.L8_CHIP_MATRIX_OFFSET))
    levels.MATRIX = Math.round(matrix * 100) / 100
  }

  // RSI — 筹码相对强弱（代理：60日收益率正负）
  if (q.return60d !== undefined) {
    const returnLevels = V6_CALCULATOR_THRESHOLDS.L8_CHIP_RETURN60D_LEVELS
    const returnScores = V6_CALCULATOR_THRESHOLDS.L8_CHIP_RETURN60D_SCORES
    const rsi = q.return60d > safeArrayGet(returnLevels, 0)! ? safeArrayGet(returnScores, 0)!
      : q.return60d > safeArrayGet(returnLevels, 1)! ? safeArrayGet(returnScores, 1)!
      : q.return60d > safeArrayGet(returnLevels, 2)! ? safeArrayGet(returnScores, 2)!
      : q.return60d > safeArrayGet(returnLevels, 3)! ? safeArrayGet(returnScores, 3)!
      : q.return60d > safeArrayGet(returnLevels, 4)! ? safeArrayGet(returnScores, 4)!
      : q.return60d > safeArrayGet(returnLevels, 5)! ? safeArrayGet(returnScores, 5)!
      : safeArrayGet(returnScores, 6)!
    levels.RSI = rsi
  }

  // CCS — 筹码系统性风险（代理：波动率越高风险越大）
  if (q.volatility20d !== undefined) {
    const volLevels = V6_CALCULATOR_THRESHOLDS.L8_CHIP_VOLATILITY_LEVELS
    const volScores = V6_CALCULATOR_THRESHOLDS.L8_CHIP_VOLATILITY_SCORES
    const ccs = q.volatility20d < safeArrayGet(volLevels, 0)! ? safeArrayGet(volScores, 0)!
      : q.volatility20d < safeArrayGet(volLevels, 1)! ? safeArrayGet(volScores, 1)!
      : q.volatility20d < safeArrayGet(volLevels, 2)! ? safeArrayGet(volScores, 2)!
      : q.volatility20d < safeArrayGet(volLevels, 3)! ? safeArrayGet(volScores, 3)!
      : q.volatility20d < safeArrayGet(volLevels, 4)! ? safeArrayGet(volScores, 4)!
      : safeArrayGet(volScores, 5)!
    levels.CCS = ccs
  }
  // DIV — 散户游资辨识度（代理：高换手+高波动）
  if (q.avgTurnover20d !== undefined && q.volatility20d !== undefined) {
    const divRaw = (q.avgTurnover20d * 100) * V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIV_TURNOVER_WEIGHT + (q.volatility20d * 100) * V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIV_VOLATILITY_WEIGHT
    // 高换手+高波动 → 散户特征
    const divLevels = V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIV_LEVELS
    const divScores = V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIV_SCORES
    const div = divRaw > safeArrayGet(divLevels, 0)! ? safeArrayGet(divScores, 0)!
      : divRaw > safeArrayGet(divLevels, 1)! ? safeArrayGet(divScores, 1)!
      : divRaw > safeArrayGet(divLevels, 2)! ? safeArrayGet(divScores, 2)!
      : divRaw > safeArrayGet(divLevels, 3)! ? safeArrayGet(divScores, 3)!
      : safeArrayGet(divScores, 4)!
    levels.DIV = div
  }

  // CSR — 筹码结构风险比（综合前七级）
  const validScores = Object.values(levels).filter((v): v is number => v !== null)
  const csr = validScores.length > 0
    ? validScores.reduce((s, v) => s + v, 0) / validScores.length
    : V6_CALCULATOR_THRESHOLDS.L8_CHIP_CSR_DEFAULT
  levels.CSR = Math.round(csr * 100) / 100

  // 综合筹码得分
  const score = levels.CSR

  // 矩阵描述
  const matrix = levels.MATRIX !== null && levels.MATRIX >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_LOW ? '筹码集中-多头博弈'
    : levels.MATRIX !== null && levels.MATRIX >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_MEDIUM ? '筹码中性-均衡'
    : '筹码分散-空头博弈'

  // 风险等级
  const riskLevel: 'low' | 'medium' | 'high' = score >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_LOW ? 'low' : score >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_MEDIUM ? 'medium' : 'high'

  return { levels, score, matrix, riskLevel }
}

/**
 * L8ChipCalculator
 */
export const L8ChipCalculator: LayerCalculator = {
  layerId: 'l8',

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l8
    const risks: string[] = []

    try {
      const chip = evaluateChip(input)

      const evidence: string[] = []
      for (const level of CHIP_LEVELS) {
        const val = chip.levels[level]
        if (val !== null) {
          evidence.push(`${level}: ${val.toFixed(1)}`)
        }
      }

      if (chip.riskLevel === 'high') {
        risks.push('筹码结构风险高，技术面偏空')
      }
      if (chip.riskLevel === 'medium') {
        risks.push('筹码结构中性，需关注资金流向')
      }

      logger.info(`[L8] ${stock.symbol}: chip=${chip.score.toFixed(2)}, risk=${chip.riskLevel}, matrix=${chip.matrix}`)

      return {
        layerId: 'l8' as LayerId,
        layerName: LAYER_LABELS.l8 ?? 'L8 技术筹码',
        score: Math.round(chip.score * 100) / 100,
        summary: `筹码 ${chip.matrix} | 风险${chip.riskLevel === 'low' ? '低' : chip.riskLevel === 'medium' ? '中' : '高'} | CSR=${chip.levels.CSR?.toFixed(1) ?? 'N/A'}`,
        risks,
        evidence,
        weight,
        weightedScore: chip.score * weight,
        dataSources: ['K线数据', '量价数据', '换手率数据'],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L8] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l8' as LayerId,
        layerName: LAYER_LABELS.l8 ?? 'L8 技术筹码',
        score: 0,
        summary: `筹码计算失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: 0,
        dataSources: [],
      }
    }
  },
}