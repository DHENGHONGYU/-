/**
 * L7 第二曲线 + L8 技术筹码 计算器
 *
 * 按 SKILL v4.3：
 * - L7：生命阶段诊断 + 催化剂强度评估（权重 15%）
 * - L8：八级筹码量化体系 SCD→PCH→AII→MATRIX→RSI→CCS→DIV→CSR（权重 4%）
 *
 * 类型：L7 为 LLM 可增强层，L8 为确定性层（K线量价直算）
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import { getLogger } from '@/lib/logger'
import type {
  LayerInput, LayerScore, LayerCalculator, ChipResult,
  TurnoverVolumeSynergyResult, TVRLevel,
  MainForceChipFlowSignal, MainForceChipFlowType, ChipFlowDirection,
  TradeSignal, TradeSignalType, MarketSession,
  LowLiquidityInterceptMeta, BreakoutTradeStyle,
  FundFlowContext,
} from '../types'
import type { LayerId } from '../types'
import { LAYER_LABELS } from '../types'
import { CHIP_LEVELS } from '../config'
import type { ChipLevel } from '../config'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { safeArrayGet, safeLast } from '@/lib/precision'
import { calcChipDistribution, calcPAS, pasToScore, calcVWAP, calcBias, biasToScore, calcProfitRatio, profitToScore } from './chipDistribution'
import type { ChipDistribution } from './chipDistribution'
// P1-12 分层合规下沉：TurnoverVolumeEnergy + computeTurnoverVolumeEnergy
//   原实现在本文件，为解除 domain → services 反向依赖，
//   将纯函数落地到 domain 层，services 在此 re-export 保持 API 兼容。
import { computeTurnoverVolumeEnergy } from '@/domain/scoring/energy'
import type { TurnoverVolumeEnergy } from '@/domain/scoring/energy'
export { computeTurnoverVolumeEnergy } from '@/domain/scoring/energy'
export type { TurnoverVolumeEnergy } from '@/domain/scoring/energy'

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
        participated: true,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L7] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l7' as LayerId,
        layerName: LAYER_LABELS.l7 ?? 'L7 第二曲线',
        score: Number.NaN,
        summary: `第二曲线计算失败: ${msg}`,
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
    PAS: null,
    BIAS: null,
    PRO: null,
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

  // PAS + BIAS + PRO — 基于真实筹码分布计算
  let distribution: ChipDistribution | null = null
  let biasValue: number | null = null
  let profitRatioValue: number | null = null
  const histCloses = q.history
  const histVolumes = q.volumeHistory
  // G3-B Phase 3：KlineBar.turnoverRate 是 % 形式，÷ 100 转成算法用的小数
  const histTurnoverRatesPct = q.turnoverRateHistory
  const turnoverRates = histTurnoverRatesPct?.length
    ? histTurnoverRatesPct.map((trPct) => trPct / 100)
    : undefined
  if (histCloses && histVolumes && histCloses.length >= 2 && histVolumes.length >= 2) {
    distribution = calcChipDistribution(histCloses, histVolumes, {
      windowDays: V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIST_WINDOW_DAYS,
      bucketCount: V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIST_BUCKETS,
      currentPrice: q.latestClose,
      decayModel: 'hybrid',
      turnoverRates,
    })

    if (distribution.source === 'real' && distribution.buckets.length > 0) {
      const currentPrice = q.latestClose ?? histCloses[histCloses.length - 1]!
      const prevClose = histCloses[histCloses.length - 2]!
      const dailyVolume = histVolumes[histVolumes.length - 1]!

      // PAS 穿透率
      const pasValue = calcPAS(distribution, currentPrice, prevClose, dailyVolume)
      levels.PAS = pasToScore(pasValue)

      // BIAS 乖离率（优先使用筹码分布 VWAP，回退到简单 VWAP）
      const vwap = distribution.vwap ?? calcVWAP(histCloses, histVolumes)
      biasValue = calcBias(vwap, currentPrice)
      levels.BIAS = biasToScore(biasValue)

      // PRO 获利盘比例
      profitRatioValue = distribution.profitRatio ?? calcProfitRatio(distribution, currentPrice)
      levels.PRO = profitToScore(profitRatioValue)
    }
  }

  // CSR — 筹码结构风险比（综合所有级，含 PAS + BIAS + PRO）
  // CSR 此时为 null，自动被 filter 排除
  const validScores = Object.values(levels).filter((v): v is number => v !== null)
  const csr = validScores.length > 0
    ? validScores.reduce((s, v) => s + v, 0) / validScores.length
    : V6_CALCULATOR_THRESHOLDS.L8_CHIP_CSR_DEFAULT
  levels.CSR = Math.round(csr * 100) / 100

  // 综合筹码得分
  const score = levels.CSR

  // MATRIX 联动：获利盘 > 80% 且 MATRIX ≥ 3.5 → 止盈预警
  const takeProfitWarning = profitRatioValue !== null
    && profitRatioValue > V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_HIGH
    && levels.MATRIX !== null
    && levels.MATRIX >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_LOW

  // 矩阵描述
  const matrix = levels.MATRIX !== null && levels.MATRIX >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_LOW ? '筹码集中-多头博弈'
    : levels.MATRIX !== null && levels.MATRIX >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_MEDIUM ? '筹码中性-均衡'
    : '筹码分散-空头博弈'

  // 风险等级
  const riskLevel: 'low' | 'medium' | 'high' = score >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_LOW ? 'low' : score >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_RISK_MEDIUM ? 'medium' : 'high'

  return { levels, score, matrix, riskLevel, distribution, pas: levels.PAS, bias: biasValue, profitRatio: profitRatioValue, takeProfitWarning }
}

// ============================================================
// L8 换手率-量比协同指标体系（TVR, v4.4 新增）
// 参考同花顺/东方财富/通达信量价协同策略
// ============================================================

/** 构建 TradeSignal 辅助函数 */
function buildTradeSignal(
  type: TradeSignalType, label: string, conclusion: string,
  indicators: string[], dimension: 2 | 3, confidence: number,
): TradeSignal {
  return { type, label, conclusion, indicators, dimension, confidence }
}

/** 构建 MainForceChipFlowSignal 辅助函数（含统一命中日志） */
function buildChipFlowSignal(
  type: MainForceChipFlowType, label: string, opportunityScore: number,
  direction: ChipFlowDirection, description: string, action: string,
  tradeSignal: TradeSignal, marketSession: MarketSession = 'trading_hours',
  turnover?: number, volumeRatio?: number,
  lowLiquidityMeta?: LowLiquidityInterceptMeta,
  fundFlow?: FundFlowContext,
): MainForceChipFlowSignal {
  // ★ v4.6 自动推导 breakoutStyle + energy（断线交易风格 + 能量强度）
  // ★ v4.7 传入 fundFlow 供 classifyBreakoutStyle 做资金流向二次确认
  const energy = computeTurnoverVolumeEnergy(turnover, volumeRatio)
  const breakoutStyle = classifyBreakoutStyle(turnover, volumeRatio, energy, fundFlow)

  // ★ 核心信号统一日志：方便排查实盘信号触发逻辑
  const sessionTag = marketSession === 'low_liquidity' ? ' [低流动性]' : marketSession === 'unknown' ? ' [时段未知]' : ''
  const breakoutTag = breakoutStyle !== 'no_breakout' ? ` [断线:${breakoutStyle}|L${energy.level}${energy.label}]` : ''
  // ★ v4.5.3 拦截原因明细：让日志直接可读，不需要再查阈值
  // ★ v4.5.4 补充日成交金额与豁免状态
  const metaTag = lowLiquidityMeta
    ? ` [拦截原因: 换手${(lowLiquidityMeta.turnoverActual * 100).toFixed(2)}% < ${(lowLiquidityMeta.turnoverThreshold * 100).toFixed(1)}% | 量比${lowLiquidityMeta.volumeRatioActual.toFixed(2)} < ${lowLiquidityMeta.volumeRatioThreshold.toFixed(1)}${lowLiquidityMeta.dailyTurnoverAmount !== undefined ? ` | 日成交额${(lowLiquidityMeta.dailyTurnoverAmount / 1e8).toFixed(2)}亿${lowLiquidityMeta.bypassedByAmount ? '(已豁免)' : ''}` : ''} | ${lowLiquidityMeta.rule}]`
    : ''
  const logLevel = marketSession === 'low_liquidity'
    ? 'debug' // 低流动性时段降级为 debug，避免盘后日志噪音
    : tradeSignal.type === 'golden_buy' || tradeSignal.type === 'escape' || tradeSignal.type === 'golden_sell'
      ? 'warn'   // 黄金买点/逃离/黄金卖点 → warn 级别（实盘重点关注）
      : tradeSignal.type === 'follow_buy' || tradeSignal.type === 'reduce'
        ? 'info'  // 跟进买点/减仓 → info 级别
        : 'debug' // 持有/观望/中性 → debug 级别
  const msg = `[ChipFlow] 信号命中${sessionTag}${breakoutTag}${metaTag}: ${label} | 类型=${type} | 方向=${direction} | 机会分=${opportunityScore.toFixed(1)} | 交易=${tradeSignal.type}(${tradeSignal.dimension}指标) | 置信度=${tradeSignal.confidence.toFixed(2)} | 能量=${energy.label}(${energy.raw.toFixed(4)}) | ${description} | 操作=${action}`
  if (logLevel === 'warn') logger.warn(msg)
  else if (logLevel === 'info') logger.info(msg)
  else logger.debug(msg)
  const base: MainForceChipFlowSignal = {
    type, label, opportunityScore, direction, confidence: tradeSignal.confidence, description, action, tradeSignal, marketSession,
    breakoutStyle, energy,
  }
  if (lowLiquidityMeta) base.lowLiquidityMeta = lowLiquidityMeta
  return base
}

/**
 * @note computeTurnoverVolumeEnergy / TurnoverVolumeEnergy 实现已下沉到
 *   src/lib/scoring/energy.ts（P1-12 分层合规），本文件顶部 re-export 保持 API 兼容。
 */

/**
 * 断线交易风格分类（纯函数，v4.6 新增 / v4.7 资金流向二次确认）
 *
 * 基于换手率 × 量比 的 8 种组合，对应 8 种突破风格与交易纪律。
 *
 * ★ v4.7 优化：当传入 fundFlow 且技术面触发假突破条件时，
 * 若主力资金实际净流入（mainForceNet > 0），则降级为 no_breakout（降低误报率）。
 * 无 fundFlow 参数时保持原有行为（向后兼容）。
 *
 * @export
 * @param turnover 换手率（小数，如 0.03 = 3%）
 * @param volumeRatio 量比（倍数，如 2.5）
 * @param energy computeTurnoverVolumeEnergy() 的结果（能量等级）
 * @param fundFlow 资金流向上下文（可选，v4.7 新增）
 * @returns BreakoutTradeStyle
 */
export function classifyBreakoutStyle(
  turnover: number | undefined,
  volumeRatio: number | undefined,
  energy: TurnoverVolumeEnergy,
  fundFlow?: FundFlowContext,
): BreakoutTradeStyle {
  const T = V6_CALCULATOR_THRESHOLDS
  const turnoverMissing = turnover === undefined
  const volumeRatioMissing = volumeRatio === undefined
  if (turnoverMissing || volumeRatioMissing) {
    logger.debug(
      `[L8] classifyBreakoutStyle 参数缺失: turnover=${turnoverMissing ? 'undefined' : String(turnover)}, volumeRatio=${volumeRatioMissing ? 'undefined' : String(volumeRatio)}，使用保守默认值`,
    )
  }
  const t = turnoverMissing ? 0.001 : turnover
  const v = volumeRatioMissing ? 0.5 : volumeRatio
  const tpct = t * 100 // 百分比视角

  // 8 种风格：优先匹配高能量 / 高量比模式
  if (energy.level >= 4 && tpct >= 5 && v >= 2.5) return 'sniper_breakout'    // 狙击型：中高换手 + 极高量比
  if (energy.level >= 3 && tpct >= 3 && v >= 2) return 'momentum_breakout'    // 动量型：中高换手 + 显著放量

  // ★ v4.7/v4.8 假突破判定：技术条件 + 资金流向二次确认（能量级别差异化阈值）
  if (tpct >= 8 && v < 1.5) {
    // v4.8 能量级别差异化资金流向降级阈值
    // L5/L4：>0 严格降级（精度优先，历史 FPR 最高）
    // L3：>0.5 放宽降级（平衡召回率，微幅流入常为机构噪音）
    // L2：>1.0 更放宽（召回优先，低能量假突破罕见，需强证据才不预警）
    if (fundFlow?.mainForceNet !== undefined) {
      const downgradeThreshold =
        energy.level >= 4 ? T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L4
        : energy.level === 3 ? T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L3
        : T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L2
      if (fundFlow.mainForceNet > downgradeThreshold) {
        // 主力净流入超过阈值 → 降级为 no_breakout（降低误报率）
        return 'no_breakout'
      }
    }
    // 无资金流向数据或主力净流出 → 确认假突破
    return 'fake_breakout'
  }

  if (tpct < 2 && v >= 5) return 'probe_breakout'                               // 试探型：低换手 + 极大量
  if (energy.level >= 3 && tpct >= 2 && tpct < 5 && v >= 1.5) return 'steady_breakout' // 稳健型：中换手 + 温和放量
  if (energy.level >= 2 && tpct < 3 && v >= 1 && v < 2.5) return 'value_breakout' // 价值型：低换手 + 温和量
  if (energy.level === 1) return 'breakout_watch'                               // 观望待突破：极低能量 = 抛压枯竭
  return 'no_breakout'
}

/**
 * 主力筹码变动信号识别 ★ v4.5 新增
 *
 * 基于换手率-量比关系矩阵（资深专家心得），采用双指标/三指标组合分析，
 * 识别 12 种主力筹码变动模式，输出黄金买点/卖点/逃离机会的交易结论。
 *
 * 判断依据（专家共识）：
 * - 量比看方向（资金来没来），换手看力度（热度够不够）
 * - 位置定生死：低位高换手=吸筹(天堂)；高位高换手=出货(地狱)
 * - 量比大+换手低=试盘/吸筹前奏；量比低+换手高=对倒诱多
 *
 * @param input V6 引擎层输入（含换手率/量比/位置/价变等指标）
 * @param options 可选分析选项
 * @param options.enableLowLiquidityIntercept ★ v4.5.2 是否启用低流动性拦截。
 *   true（默认）: t<0.5% 且 v<0.7 时强制降级为"低流动性观望"，避免盘后误判
 *   false:         关闭拦截，所有数据进入正常分支判断，用于回测/对比数据
 * @param options.dailyTurnoverAmountBypass ★ v4.5.4 日成交金额豁免阈值（元，默认 3 亿）。
 *   当 quotes.dailyTurnoverAmount > 该阈值时，即使触发低流动性条件也不拦截，
 *   避免大市值低换手蓝筹股（如茅台/工行）被误判为僵尸股。
 */
export function detectMainForceChipFlow(
  input: LayerInput,
  options?: {
    /** ★ v4.5.2 是否启用低流动性拦截（默认 true） */
    enableLowLiquidityIntercept?: boolean
    /** ★ v4.5.4 日成交金额豁免阈值（元，默认 3 亿 = 3_0000_0000） */
    dailyTurnoverAmountBypass?: number
  },
): MainForceChipFlowSignal {
  const { quotes: q } = input
  const turnover = q.avgTurnover20d
  const volumeRatio = q.volumeRatio
  const priceChange = q.latestReturn1d ?? q.return20d
  const turnoverStd = q.turnover20dStd
  // 价格位置推断：return60d > 30% 为高位，< 0 为低位
  const return60d = q.return60d ?? 0
  const isHighPosition = return60d > 0.3
  const isLowPosition = return60d < 0

  // ★ v4.7 提取资金流向数据，用于假突破二次确认
  const fundFlow: FundFlowContext = {
    mainForceNet: q.mainForceFlow ? safeLast(q.mainForceFlow) : undefined,
    northboundNet: q.northboundHoldings && q.northboundHoldings.length >= 2
      ? (q.northboundHoldings[q.northboundHoldings.length - 1] ?? 0) - (q.northboundHoldings[q.northboundHoldings.length - 2] ?? 0)
      : undefined,
    marginChange: q.marginBalance && q.marginBalance.length >= 2
      ? (q.marginBalance[q.marginBalance.length - 1] ?? 0) - (q.marginBalance[q.marginBalance.length - 2] ?? 0)
      : undefined,
  }

  // ★ 入口日志：记录输入数据摘要，方便排查
  logger.info(
    `[ChipFlow] 输入: symbol=${input.stock.symbol} | 换手率=${turnover !== undefined ? (turnover * 100).toFixed(2) + '%' : 'N/A'} | 量比=${volumeRatio !== undefined ? volumeRatio.toFixed(2) : 'N/A'} | 价变=${priceChange !== undefined ? (priceChange * 100).toFixed(2) + '%' : 'N/A'} | 60日收益=${(return60d * 100).toFixed(1)}% | 位置=${isHighPosition ? '高位' : isLowPosition ? '低位' : '中位'} | 换手std=${turnoverStd !== undefined ? turnoverStd.toFixed(4) : 'N/A'}`,
  )

  const T = V6_CALCULATOR_THRESHOLDS
  // 阈值快捷引用
  const tExtremeLow = T.L8_MFC_TURNOVER_EXTREME_LOW
  const tLow = T.L8_MFC_TURNOVER_LOW
  const tMild = T.L8_MFC_TURNOVER_MILD
  const tActive = T.L8_MFC_TURNOVER_ACTIVE
  const tDeath = T.L8_MFC_TURNOVER_DEATH
  const vExtremeLow = T.L8_MFC_VR_EXTREME_LOW
  const vNormal = T.L8_MFC_VR_NORMAL
  const vMild = T.L8_MFC_VR_MILD
  const vSignificant = T.L8_MFC_VR_SIGNIFICANT
  const priceUp = T.L8_MFC_PRICE_UP
  const priceDown = T.L8_MFC_PRICE_DOWN
  const stableRatio = T.L8_MFC_TURNOVER_STABLE_RATIO

  // 数据缺失时的默认中性信号
  if (turnover === undefined || volumeRatio === undefined) {
    return buildChipFlowSignal(
      'neutral', '中性（数据不足）', T.L8_MFC_SCORE_NEUTRAL, 'neutral',
      '换手率或量比数据缺失，无法识别主力筹码变动信号',
      '观望，等待数据补全',
      buildTradeSignal('wait', '观望（数据不足）', '数据不足，暂不操作', [], 2, T.L8_MFC_CONFIDENCE_BASIC),
      'unknown',
    )
  }

  const t = turnover
  const v = volumeRatio

  // ★ v4.5.1 低流动性/盘后时段检测：换手<0.5% 且 量比<0.7 → 低流动性标记
  // ★ v4.5.2 新增开关 enableLowLiquidityIntercept: 默认(true)启用拦截，false 时放行供回测对比
  // ★ v4.5.3 拦截原因元数据固化：阈值、实际值、规则中文表述全部打包透出，便于调度器日志与后续准确性分析
  // ★ v4.5.4 阈值收紧（量比 0.8→0.7，误杀率 22.2%→0%）+ 日成交金额>3亿豁免（区分蓝筹股与僵尸股）
  const lowLiquidityIntercept = options?.enableLowLiquidityIntercept ?? true
  const TURNOVER_LOW_LIQ_THRESHOLD = 0.005   // 0.5%
  const VOLUMERATIO_LOW_LIQ_THRESHOLD = 0.7   // v4.5.4 由 0.8 收紧到 0.7
  const DAILY_TURNOVER_AMOUNT_BYPASS = options?.dailyTurnoverAmountBypass ?? 3_0000_0000  // 3 亿元（元）
  const isLowLiquidity = t < TURNOVER_LOW_LIQ_THRESHOLD && v < VOLUMERATIO_LOW_LIQ_THRESHOLD
  // ★ v4.5.4 蓝筹豁免：日成交金额 > 3 亿时放行，避免误杀大市值低换手蓝筹
  const dailyAmount = q.dailyTurnoverAmount
  const amountBypassed = dailyAmount !== undefined && dailyAmount > DAILY_TURNOVER_AMOUNT_BYPASS

  // 低流动性时段特殊处理：信号降级为"低流动性观望"，避免误判
  // ★ v4.5.4 若日成交金额 > 3 亿（蓝筹股特征），跳过拦截，进入正常分支判断
  if (isLowLiquidity && lowLiquidityIntercept && !amountBypassed) {
    const meta: LowLiquidityInterceptMeta = {
      turnoverActual: Number(t.toFixed(6)),
      turnoverThreshold: TURNOVER_LOW_LIQ_THRESHOLD,
      volumeRatioActual: Number(v.toFixed(4)),
      volumeRatioThreshold: VOLUMERATIO_LOW_LIQ_THRESHOLD,
      rule: `换手<${(TURNOVER_LOW_LIQ_THRESHOLD * 100).toFixed(1)}% 且 量比<${VOLUMERATIO_LOW_LIQ_THRESHOLD.toFixed(1)}（低流动性时段判定规则 v4.5.4）`,
      dailyTurnoverAmount: dailyAmount,
      dailyTurnoverAmountThreshold: DAILY_TURNOVER_AMOUNT_BYPASS,
      bypassedByAmount: false,
    }
    return buildChipFlowSignal(
      'neutral', '低流动性观望', T.L8_MFC_SCORE_NEUTRAL, 'neutral',
      `换手率${(t * 100).toFixed(2)}%(极低) + 量比${v.toFixed(2)}(缩量)，当前为低流动性时段（盘后/午休/冷门股），量价信号可信度低，不宜作为交易依据`,
      '盘后/低流动性时段，等待交易时间复评',
      buildTradeSignal('wait', '观望（低流动性时段）',
        '低流动性时段量价数据不具参考价值，主力信号可信度低，待交易时间重新评估',
        [`换手率${(t * 100).toFixed(2)}%(<0.5%)`, `量比${v.toFixed(2)}(<0.7)`, '低流动性时段'],
        2, T.L8_MFC_CONFIDENCE_BASIC),
      'low_liquidity',
      t, v,
      meta,
      fundFlow,
    )
  }

  // ★ v4.5.4 蓝筹豁免日志：记录被成交金额放行的股票，便于后续审计
  if (isLowLiquidity && lowLiquidityIntercept && amountBypassed) {
    logger.info(
      `[ChipFlow] 蓝筹豁免放行: symbol=${input.stock.symbol} | 换手率=${(t * 100).toFixed(2)}% | 量比=${v.toFixed(2)} | 日成交金额=${(dailyAmount / 1e8).toFixed(2)}亿元(>${(DAILY_TURNOVER_AMOUNT_BYPASS / 1e8).toFixed(1)}亿) → 跳过低流动性拦截，进入正常分支`,
    )
  }

  const isPriceUp = priceChange !== undefined && priceChange >= priceUp
  const isPriceDown = priceChange !== undefined && priceChange <= priceDown
  const isPriceFlat = priceChange !== undefined && Math.abs(priceChange) < T.L8_MFC_PRICE_FLAT
  const isTurnoverStable = turnoverStd !== undefined && t > 0
    ? (turnoverStd / t) < stableRatio
    : false

  // 置信度：数据维度越全越高
  const confidence = (priceChange !== undefined && turnoverStd !== undefined)
    ? T.L8_MFC_CONFIDENCE_FULL
    : priceChange !== undefined
      ? T.L8_MFC_CONFIDENCE_PARTIAL
      : T.L8_MFC_CONFIDENCE_BASIC

  const tPct = (t * 100).toFixed(1)
  const vStr = v.toFixed(1)

  // ---- 组合矩阵判断（按机会评分从高到低）----

  // 1. 温和吸筹：换手3%-5% + 量比>2.5 + 非高位（黄金买点）
  if (t >= tLow && t < tMild && v >= vMild && !isHighPosition) {
    return buildChipFlowSignal(
      'accumulation', '温和吸筹', T.L8_MFC_SCORE_ACCUMULATION, 'inflow',
      `换手率${tPct}%(温和活跃) + 量比${vStr}(显著放量) + ${isLowPosition ? '低位' : '中位'}，主力温和放量吸筹`,
      '提前埋伏，需耐心等待启动',
      buildTradeSignal('golden_buy', '黄金买点：温和吸筹',
        '双指标共振+低位，主力温和放量吸筹，最佳埋伏时机',
        [`换手率${tPct}%(3%-5%)`, `量比${vStr}(>2.5)`, isLowPosition ? '低位' : '中位'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 2. 主力试盘：换手<3% + 量比>5（跟进买点，需次日确认）
  if (t < tLow && v >= vSignificant) {
    return buildChipFlowSignal(
      'probing', '主力试盘', T.L8_MFC_SCORE_PROBING, 'lock',
      `换手率${tPct}%(低) + 量比${vStr}(极端放量)，大单扫货但筹码锁死，试盘动作`,
      '加入自选重点盯，次日很可能有动作',
      buildTradeSignal('follow_buy', '跟进买点：主力试盘',
        '量大换手低=筹码锁好，试盘前奏，次日确认后跟进',
        [`换手率${tPct}%(<3%)`, `量比${vStr}(>5)`],
        2, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 3. 强势启动：换手5%-10% + 量比>5 + 低位价涨（黄金买点）
  if (t >= tMild && t < tActive && v >= vSignificant && isLowPosition && isPriceUp) {
    return buildChipFlowSignal(
      'pullup', '强势启动', T.L8_MFC_SCORE_PULLUP, 'inflow',
      `换手率${tPct}%(活跃) + 量比${vStr}(极端放量) + 低位价涨，主力明目张胆抢筹`,
      '果断上车',
      buildTradeSignal('golden_buy', '黄金买点：强势启动',
        '三指标共振(换手+量比+低位价涨)，主升浪启动信号',
        [`换手率${tPct}%(5%-10%)`, `量比${vStr}(>5)`, '低位+价涨'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 4. 主升浪加速：换手5%-10% + 量比2.5-5 + 价涨 + 非高位（跟进买点）
  if (t >= tMild && t < tActive && v >= vMild && v < vSignificant && isPriceUp && !isHighPosition) {
    return buildChipFlowSignal(
      'pullup', '主升浪加速', T.L8_MFC_SCORE_MAIN_WAVE, 'inflow',
      `换手率${tPct}%(活跃) + 量比${vStr}(显著放量) + 价涨，资金疯狂抢筹，主升浪最肥肉段`,
      '上车并守好纪律，别被盘中震荡甩下',
      buildTradeSignal('follow_buy', '跟进买点：主升浪加速',
        '三指标共振(换手+量比+价涨)，主升浪加速，最肥利润段',
        [`换手率${tPct}%(5%-10%)`, `量比${vStr}(2.5-5)`, '价涨'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 5. 筹码锁定：换手<1% + 量比<0.5 + 企稳（观望，等放量突破）
  if (t < tExtremeLow && v < vExtremeLow && (isPriceFlat || isPriceUp)) {
    return buildChipFlowSignal(
      'lockup', '筹码锁定', T.L8_MFC_SCORE_LOCKUP, 'lock',
      `换手率${tPct}%(极低) + 量比${vStr}(极度缩量) + 企稳，抛压枯竭，主力锁仓等风来`,
      '等待放量突破启动信号，突破时介入',
      buildTradeSignal('wait', '观望：筹码锁定变盘在即',
        '双指标极低+企稳，筹码高度锁定，变盘在即，等放量突破介入',
        [`换手率${tPct}%(<1%)`, `量比${vStr}(<0.5)`],
        2, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 6. 暴力吸筹：换手>10% + 量比>5 + 低位（跟进买点，控制仓位）
  if (t >= tActive && v >= vSignificant && isLowPosition) {
    return buildChipFlowSignal(
      'accumulation', '暴力吸筹', T.L8_MFC_SCORE_VIOLENT_ACC, 'inflow',
      `换手率${tPct}%(极高) + 量比${vStr}(极端放量) + 低位，主力用大成交量强行收集筹码`,
      '可跟，但控制仓位',
      buildTradeSignal('follow_buy', '跟进买点：暴力吸筹',
        '三指标共振(高换手+极端放量+低位)，主力暴力收集，控制仓位跟进',
        [`换手率${tPct}%(>10%)`, `量比${vStr}(>5)`, '低位'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 7. 健康趋势：换手3%-10% + 量比1.5-2.5 + 价涨（持有）
  if (t >= tLow && t < tActive && v >= vNormal && v < vMild && isPriceUp) {
    return buildChipFlowSignal(
      'pullup', '健康趋势', T.L8_MFC_SCORE_HEALTHY, 'inflow',
      `换手率${tPct}%(活跃) + 量比${vStr}(温和放量) + 价涨，主力正常运作，趋势健康`,
      '持有/适当介入',
      buildTradeSignal('hold', '持有：健康趋势',
        '三指标共振(换手+量比+价涨)，主力正常运作核心区间，趋势健康',
        [`换手率${tPct}%(3%-10%)`, `量比${vStr}(1.5-2.5)`, '价涨'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 8. 筹码集中：换手率稳定(std/mean<0.3) + 价涨 + 换手<10%（持有，拿住躺赢）
  if (isTurnoverStable && isPriceUp && t < tActive) {
    return buildChipFlowSignal(
      'lockup', '筹码集中', T.L8_MFC_SCORE_CONCENTRATING, 'lock',
      `换手率${tPct}%(稳定) + 价涨，换手率波动小+价涨=筹码集中铁证，主力用最少筹码推股价`,
      '拿住躺赢，主升浪才刚开始',
      buildTradeSignal('hold', '持有：筹码集中主升浪',
        '三指标(换手稳定+价涨+低波动)，筹码高度集中，主升浪控盘完成',
        [`换手率${tPct}%(稳定)`, '价涨', `换手率std/mean<${stableRatio}`],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 9. 对倒陷阱：换手>5% + 量比<1.5（逃离，先跑）
  if (t >= tMild && v < vNormal) {
    return buildChipFlowSignal(
      'fakeup', '对倒陷阱', T.L8_MFC_SCORE_FAKEUP, 'neutral',
      `换手率${tPct}%(高) + 量比${vStr}(低)，换手高但量比未跟上，存量资金左手倒右手，诱多/撤退`,
      '先跑，安全第一',
      buildTradeSignal('escape', '逃离：对倒陷阱',
        '双指标背离(高换手+低量比)，无新鲜资金进场，存量对倒诱多，先跑为敬',
        [`换手率${tPct}%(>5%)`, `量比${vStr}(<1.5)`],
        2, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 10. 死亡换手：换手>15% + 量比>5 + 高位（逃离，立即清仓）—— 优先于主力派发匹配
  if (t >= tDeath && v >= vSignificant && isHighPosition) {
    return buildChipFlowSignal(
      'distribution', '死亡换手', T.L8_MFC_SCORE_DEATH, 'outflow',
      `换手率${tPct}%(死亡换手) + 量比${vStr}(极端放量) + 高位，分歧顶峰，次日低开闷杀概率大`,
      '立即清仓，一股不留',
      buildTradeSignal('escape', '逃离：死亡换手',
        '三指标极端共振(死亡换手+极端放量+高位)，崩盘前兆，立即清仓',
        [`换手率${tPct}%(>15%)`, `量比${vStr}(>5)`, '高位'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 11. 主力派发：换手>10% + 量比>2.5 + 高位（黄金卖点）
  if (t >= tActive && v >= vMild && isHighPosition) {
    return buildChipFlowSignal(
      'distribution', '主力派发', T.L8_MFC_SCORE_DISTRIBUTION, 'outflow',
      `换手率${tPct}%(极高) + 量比${vStr}(显著放量) + 高位，主力借热度吸引散户跟风，边拉边出货`,
      '坚决回避/清仓',
      buildTradeSignal('golden_sell', '黄金卖点：主力派发',
        '三指标共振(高换手+放量+高位)，主力高位派发，最佳卖出时机',
        [`换手率${tPct}%(>10%)`, `量比${vStr}(>2.5)`, '高位'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 12. 高位滞涨：高位 + 高换手 + 价不涨（减仓）
  if (isHighPosition && t >= tMild && !isPriceUp) {
    return buildChipFlowSignal(
      'distribution', '高位滞涨', T.L8_MFC_SCORE_DISTRIBUTION, 'outflow',
      `换手率${tPct}%(高) + 高位 + 价${isPriceDown ? '跌' : '平'}，高位放量滞涨，主力悄悄派发`,
      '减仓防范风险',
      buildTradeSignal('reduce', '减仓：高位滞涨',
        '三指标(高位+高换手+价不涨)，高位放量滞涨，主力悄悄出货，减仓防范',
        [`换手率${tPct}%(>5%)`, '高位', isPriceDown ? '价跌' : '价平'],
        3, confidence),
      'trading_hours', t, v, undefined, fundFlow,
    )
  }

  // 默认中性
  return buildChipFlowSignal(
    'neutral', '中性', T.L8_MFC_SCORE_NEUTRAL, 'neutral',
    `换手率${tPct}% + 量比${vStr}，无明确主力信号`,
    '观望',
    buildTradeSignal('wait', '观望：无明确信号',
      '指标组合未触发任何主力信号，暂不操作',
      [`换手率${tPct}%`, `量比${vStr}`],
      2, confidence),
    'trading_hours', t, v,
  )
}

/** TVR 九级指标名称顺序 */
export const TVR_LEVELS: TVRLevel[] = [
  'ACT', 'VRL', 'SYG', 'CN', 'AS', 'DV', 'BC', 'ES', 'TVR',
]

/**
 * 换手率-量比协同分析 (Turnover-Volume Ratio Synergy)
 *
 * 九级指标体系：
 * - ACT 活跃度分级：基于20日均换手率
 * - VRL 量比分级：基于当日量比
 * - SYG 量能协同度：换手率与量比同向加分
 * - CN 资金性质推断：结合价格方向判断主力意图
 * - AS 异动信号检测：量比>2或换手波动剧烈
 * - DV 量价背离识别：价涨量缩/价跌量增
 * - BC 突破确认度：放量突破=强突破
 * - ES 顶底信号：地量地价/天量天价
 * - TVR 综合评分：前八级加权 + chipFlow 加成
 */

/** TVR-04 CN 资金性质推断（早退守卫扁平化） */
function resolveCapitalNature(
  levels: Record<TVRLevel, number | null>,
  signals: string[],
  turnover: number,
  volumeRatio: number,
  isPriceUp: boolean,
  isPriceDown: boolean,
): string {
  const isHighTurnover = turnover >= V6_CALCULATOR_THRESHOLDS.L8_MFC_TURNOVER_MILD
  const isHighVR = volumeRatio >= V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_MILD
  const isLowVR = volumeRatio < V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_NORMAL
  if (isHighTurnover && isHighVR && isPriceUp) {
    levels.CN = 5
    return '主力进场'
  }
  if (isHighTurnover && isHighVR && isPriceDown) {
    levels.CN = 1
    signals.push('主力出货')
    return '主力出货'
  }
  if (!isHighTurnover && isHighVR) {
    levels.CN = 4
    return '主力吸筹'
  }
  if (isHighTurnover && isLowVR) {
    levels.CN = 2
    signals.push('诱多/对倒')
    return '诱多/对倒'
  }
  levels.CN = 3
  return '中性'
}

/** TVR-06 DV 量价背离识别（早退守卫扁平化） */
function resolveDivergence(
  levels: Record<TVRLevel, number | null>,
  signals: string[],
  isPriceUp: boolean,
  isPriceDown: boolean,
  volumeRatio: number,
): void {
  const isVRUp = volumeRatio >= V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_NORMAL
  const isVRDown = volumeRatio < V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_LOW
  if (isPriceUp && isVRDown) {
    levels.DV = 1.5
    signals.push('价涨量缩(背离)')
  } else if (isPriceDown && isVRUp) {
    levels.DV = 1.5
    signals.push('价跌量增(背离)')
  } else if (isPriceUp && isVRUp) {
    levels.DV = 4.5
    signals.push('量价齐升')
  } else {
    levels.DV = 3
  }
}

export function evaluateTurnoverVolumeSynergy(input: LayerInput): TurnoverVolumeSynergyResult {
  const { quotes: q } = input
  const levels: Record<TVRLevel, number | null> = {
    ACT: null, VRL: null, SYG: null, CN: null,
    AS: null, DV: null, BC: null, ES: null, TVR: null,
  }
  const signals: string[] = []

  // ★ v4.5 主力筹码变动信号识别
  const chipFlow = detectMainForceChipFlow(input)
  signals.push(chipFlow.label)
  if (chipFlow.tradeSignal.label) signals.push(chipFlow.tradeSignal.label)

  const turnover = q.avgTurnover20d
  const volumeRatio = q.volumeRatio
  const priceChange = q.latestReturn1d ?? q.return20d
  const turnoverStd = q.turnover20dStd
  const priceUpThreshold = V6_CALCULATOR_THRESHOLDS.L8_TVR_DV_PRICE_UP
  const priceDownThreshold = V6_CALCULATOR_THRESHOLDS.L8_TVR_DV_PRICE_DOWN
  const isPriceUp = priceChange !== undefined && priceChange >= priceUpThreshold
  const isPriceDown = priceChange !== undefined && priceChange <= priceDownThreshold

  // ---- TVR-01 ACT 活跃度分级 ----
  let activityLabel = '数据不足'
  if (turnover !== undefined) {
    const actLevels = V6_CALCULATOR_THRESHOLDS.L8_TVR_ACT_LEVELS
    const actScores = V6_CALCULATOR_THRESHOLDS.L8_TVR_ACT_SCORES
    const actLabels = V6_CALCULATOR_THRESHOLDS.L8_TVR_ACT_LABELS
    let idx = actLevels.length
    for (let i = 0; i < actLevels.length; i++) {
      if (turnover < safeArrayGet(actLevels, i)!) { idx = i; break }
    }
    levels.ACT = safeArrayGet(actScores, idx)!
    activityLabel = safeArrayGet(actLabels, idx)!
  }

  // ---- TVR-02 VRL 量比分级 ----
  let volumeRatioLabel = '数据不足'
  if (volumeRatio !== undefined) {
    const vrlLevels = V6_CALCULATOR_THRESHOLDS.L8_TVR_VRL_LEVELS
    const vrlScores = V6_CALCULATOR_THRESHOLDS.L8_TVR_VRL_SCORES
    const vrlLabels = V6_CALCULATOR_THRESHOLDS.L8_TVR_VRL_LABELS
    let idx = vrlLevels.length
    for (let i = 0; i < vrlLevels.length; i++) {
      if (volumeRatio < safeArrayGet(vrlLevels, i)!) { idx = i; break }
    }
    levels.VRL = safeArrayGet(vrlScores, idx)!
    volumeRatioLabel = safeArrayGet(vrlLabels, idx)!
  }

  // ---- TVR-03 SYG 量能协同度 ----
  if (turnover !== undefined && volumeRatio !== undefined) {
    const isHighTurnover = turnover >= V6_CALCULATOR_THRESHOLDS.L8_MFC_TURNOVER_MILD
    const isLowTurnover = turnover < V6_CALCULATOR_THRESHOLDS.L8_MFC_TURNOVER_LOW
    const isHighVR = volumeRatio >= V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_MILD
    const isLowVR = volumeRatio < V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_LOW
    // 同向协同加分，背离减分
    if ((isHighTurnover && isHighVR) || (isLowTurnover && isLowVR)) {
      levels.SYG = 4.5
      signals.push('量能协同')
    } else if ((isHighTurnover && isLowVR) || (isLowTurnover && isHighVR)) {
      levels.SYG = 1.5
      signals.push('量能背离')
    } else {
      levels.SYG = 3.0
    }
  }

  // ---- TVR-04 CN 资金性质推断 ----
  let capitalNature = '中性'
  if (turnover !== undefined && volumeRatio !== undefined) {
    capitalNature = resolveCapitalNature(levels, signals, turnover, volumeRatio, isPriceUp, isPriceDown)
  }

  // ---- TVR-05 AS 异动信号检测 ----
  if (turnover !== undefined && volumeRatio !== undefined) {
    const isVRAnomaly = volumeRatio > 2
    const isTurnoverVolatile = turnoverStd !== undefined && turnover > 0
      ? (turnoverStd / turnover) > 0.5
      : false
    if (isVRAnomaly || isTurnoverVolatile) {
      levels.AS = 5
      signals.push('异动信号')
    } else {
      levels.AS = 3
    }
  }

  // ---- TVR-06 DV 量价背离识别 ----
  if (priceChange !== undefined && volumeRatio !== undefined) {
    resolveDivergence(levels, signals, isPriceUp, isPriceDown, volumeRatio)
  }

  // ---- TVR-07 BC 突破确认度 ----
  if (priceChange !== undefined && volumeRatio !== undefined) {
    const isVRUp = volumeRatio >= V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_MILD
    const isVRDown = volumeRatio < V6_CALCULATOR_THRESHOLDS.L8_MFC_VR_NORMAL
    if (isPriceUp && isVRUp) {
      levels.BC = 5
      signals.push('放量突破')
    } else if (isPriceUp && isVRDown) {
      levels.BC = 2
      signals.push('缩量突破(假突破风险)')
    } else {
      levels.BC = 3
    }
  }

  // ---- TVR-08 ES 顶底信号 ----
  if (turnover !== undefined && priceChange !== undefined) {
    const isLowTurnover = turnover < V6_CALCULATOR_THRESHOLDS.L8_MFC_TURNOVER_EXTREME_LOW
    const isHighTurnover = turnover >= V6_CALCULATOR_THRESHOLDS.L8_MFC_TURNOVER_ACTIVE
    if (isLowTurnover && isPriceDown) {
      levels.ES = 4
      signals.push('地量地价(底部信号)')
    } else if (isHighTurnover && isPriceUp) {
      levels.ES = 1.5
      signals.push('天量天价(顶部信号)')
    } else {
      levels.ES = 3
    }
  }

  // ---- TVR 综合评分（加权平均 + chipFlow 加成） ----
  const weights: Record<string, number> = {
    ACT: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_ACT,
    VRL: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_VRL,
    SYG: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_SYG,
    CN: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_CN,
    AS: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_AS,
    DV: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_DV,
    BC: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_BC,
    ES: V6_CALCULATOR_THRESHOLDS.L8_TVR_WEIGHT_ES,
  }
  let weightedSum = 0
  let totalWeight = 0
  const levelKeys: TVRLevel[] = ['ACT', 'VRL', 'SYG', 'CN', 'AS', 'DV', 'BC', 'ES']
  for (const key of levelKeys) {
    const v = levels[key]
    const w = weights[key]
    if (v !== null && typeof w === 'number' && w > 0) {
      weightedSum += v * w
      totalWeight += w
    }
  }
  const tvrComposite = totalWeight > 0
    ? weightedSum / totalWeight
    : V6_CALCULATOR_THRESHOLDS.L8_TVR_DEFAULT

  // ★ v4.5 纳入 chipFlow 机会评分
  const chipFlowBonusWeight = V6_CALCULATOR_THRESHOLDS.L8_MFC_TVR_BONUS_WEIGHT
  const finalScore = tvrComposite * (1 - chipFlowBonusWeight) + chipFlow.opportunityScore * chipFlowBonusWeight
  levels.TVR = Math.round(Math.max(1, Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, finalScore)) * 100) / 100

  const score = levels.TVR
  const riskLevel: 'low' | 'medium' | 'high' = score >= V6_CALCULATOR_THRESHOLDS.L8_TVR_RISK_LOW ? 'low' : score >= V6_CALCULATOR_THRESHOLDS.L8_TVR_RISK_MEDIUM ? 'medium' : 'high'

  return {
    levels,
    score,
    activityLabel,
    volumeRatioLabel,
    capitalNature,
    signals: Array.from(new Set(signals)),
    riskLevel,
    chipFlow,
  }
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
      const tvr = evaluateTurnoverVolumeSynergy(input)

      const evidence: string[] = []
      for (const level of CHIP_LEVELS) {
        const val = chip.levels[level]
        if (val !== null) evidence.push(`筹码.${level}: ${val.toFixed(1)}`)
      }
      // PAS + BIAS + PRO 详情
      if (chip.distribution?.source === 'real') {
        evidence.push(`分布: ${chip.distribution.daysUsed}日, VWAP=${chip.distribution.vwap?.toFixed(2) ?? 'N/A'}, 获利盘=${chip.distribution.profitRatio !== null ? (chip.distribution.profitRatio * 100).toFixed(0) + '%' : 'N/A'}`)
        if (chip.pas !== null && chip.pas !== undefined) {
          evidence.push(`PAS穿透率: ${chip.pas > 0 ? '+' : ''}${chip.pas.toFixed(4)}（${chip.pas > 0 ? '向上穿透' : chip.pas < 0 ? '向下穿透' : '无穿越'}）`)
        }
        if (chip.bias !== null && chip.bias !== undefined) {
          evidence.push(`BIAS乖离率: ${chip.bias > 0 ? '+' : ''}${(chip.bias * 100).toFixed(2)}%（${Math.abs(chip.bias) >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_BIAS_DANGER ? '严重偏离' : Math.abs(chip.bias) >= V6_CALCULATOR_THRESHOLDS.L8_CHIP_BIAS_NORMAL ? '偏离较大' : '贴近筹码重心'}）`)
        }
        if (chip.profitRatio !== null && chip.profitRatio !== undefined) {
          evidence.push(`PRO获利盘: ${(chip.profitRatio * 100).toFixed(1)}%（${chip.profitRatio > V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_HIGH ? '止盈风险' : chip.profitRatio < V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_LOW ? '套牢盘重' : '健康均衡'}）`)
        }
      }
      // 止盈预警（MATRIX 联动）
      if (chip.takeProfitWarning) {
        evidence.push('【止盈预警】获利盘>80%且筹码博弈强势，止盈信号触发')
        risks.push('获利盘比例过高且筹码集中，建议关注止盈时机')
      }
      // TVR 协同分析 evidence
      for (const level of TVR_LEVELS) {
        const val = tvr.levels[level]
        if (val !== null) evidence.push(`TVR.${level}: ${val.toFixed(1)}`)
      }
      if (tvr.signals.length > 0) {
        evidence.push(`TVR信号: ${tvr.signals.join('、')}`)
      }
      // ★ v4.5 主力筹码变动信号 evidence（买卖点结论）
      const cf = tvr.chipFlow
      evidence.push(`主力筹码: ${cf.label}(${cf.opportunityScore.toFixed(1)}) 方向=${cf.direction}`)
      evidence.push(`交易信号: ${cf.tradeSignal.label} [${cf.tradeSignal.dimension}指标] ${cf.tradeSignal.conclusion}`)
      if (cf.tradeSignal.indicators.length > 0) {
        evidence.push(`指标组合: ${cf.tradeSignal.indicators.join(' + ')}`)
      }

      // 筹码风险
      if (chip.riskLevel === 'high') {
        risks.push('筹码结构风险高，技术面偏空')
      }
      if (chip.riskLevel === 'medium') {
        risks.push('筹码结构中性，需关注资金流向')
      }
      // TVR 协同风险
      if (tvr.capitalNature === '主力出货') {
        risks.push('换手率-量比协同提示主力出货信号')
      }
      if (tvr.capitalNature === '诱多/对倒') {
        risks.push('换手率-量比协同提示诱多/对倒风险')
      }
      if (tvr.signals.includes('天量天价(顶部信号)')) {
        risks.push('换手率-量比协同提示天量天价顶部信号')
      }
      if (tvr.signals.includes('价涨量缩(背离)') || tvr.signals.includes('价跌量增(背离)')) {
        risks.push('换手率-量比协同提示量价背离')
      }
      // ★ v4.5 交易信号风险
      if (cf.tradeSignal.type === 'escape') {
        risks.push(`【逃离信号】${cf.label}：${cf.action}`)
      }
      if (cf.tradeSignal.type === 'golden_sell') {
        risks.push(`【黄金卖点】${cf.label}：${cf.action}`)
      }
      if (cf.tradeSignal.type === 'reduce') {
        risks.push(`【减仓信号】${cf.label}：${cf.action}`)
      }

      // 最终 L8 得分 = 筹码得分 × 0.6 + TVR 协同得分 × 0.4
      const chipWeight = V6_CALCULATOR_THRESHOLDS.L8_FINAL_CHIP_WEIGHT
      const tvrWeight = V6_CALCULATOR_THRESHOLDS.L8_FINAL_TVR_WEIGHT
      const finalScore = chip.score * chipWeight + tvr.score * tvrWeight
      const finalRounded = Math.round(finalScore * 100) / 100

      // 综合风险等级（取两者更严重的）
      const riskRank = { low: 0, medium: 1, high: 2 }
      const combinedRisk = riskRank[chip.riskLevel] >= riskRank[tvr.riskLevel] ? chip.riskLevel : tvr.riskLevel

      logger.info(
        `[L8] ${stock.symbol}: chip=${chip.score.toFixed(2)}(w${chipWeight}) + tvr=${tvr.score.toFixed(2)}(w${tvrWeight}) = ${finalRounded}, risk=${combinedRisk}, matrix=${chip.matrix}, chipFlow=${cf.label}[${cf.tradeSignal.type}], tvrSignals=[${tvr.signals.join('|')}]`,
      )

      // ★ v4.5 交易信号类型 emoji 映射
      const tradeEmoji = cf.tradeSignal.type === 'golden_buy' ? '★买'
        : cf.tradeSignal.type === 'follow_buy' ? '↑买'
        : cf.tradeSignal.type === 'hold' ? '=持'
        : cf.tradeSignal.type === 'wait' ? '?望'
        : cf.tradeSignal.type === 'reduce' ? '↓减'
        : cf.tradeSignal.type === 'golden_sell' ? '★卖'
        : cf.tradeSignal.type === 'escape' ? '!!逃'
        : '-'

      return {
        layerId: 'l8' as LayerId,
        layerName: LAYER_LABELS.l8 ?? 'L8 技术筹码',
        score: finalRounded,
        summary: `筹码 ${chip.matrix} | CSR=${chip.levels.CSR?.toFixed(1) ?? 'N/A'} | PAS=${chip.levels.PAS?.toFixed(1) ?? 'N/A'} | TVR: ${tvr.activityLabel}/${tvr.volumeRatioLabel} | 主力[${cf.label}] | ${tradeEmoji}${cf.tradeSignal.label} | 风险${combinedRisk === 'low' ? '低' : combinedRisk === 'medium' ? '中' : '高'}`,
        risks,
        evidence,
        weight,
        weightedScore: finalRounded * weight,
        dataSources: chip.distribution?.source === 'real'
          ? ['K线数据', '量价数据', '换手率数据', '筹码分布计算', 'PAS穿透率', '换手率-量比协同']
          : ['K线数据', '量价数据', '换手率数据', '换手率-量比协同'],
        participated: true,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L8] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l8' as LayerId,
        layerName: LAYER_LABELS.l8 ?? 'L8 技术筹码',
        score: Number.NaN,
        summary: `筹码计算失败: ${msg}`,
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