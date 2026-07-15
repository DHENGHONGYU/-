/**
 * @fileoverview 预测校验引擎
 *
 * 生成因子预测、校验预测准确性、计算因子 IC/IR。
 *
 * @module services/output/predictionVerifier
 * @created 2026-07-15 - 输出模块补强
 */

import { getLogger } from '@/lib/logger'
import type {
  FactorPrediction,
  PredictionDirection,
  PredictionHorizon,
  MarketCycle,
  CycleMetrics,
  FactorICStat,
  FactorEffectiveness,
} from '@/types/modules/prediction.types'
import { IC_THRESHOLDS } from '@/types/modules/prediction.types'
import { spearmanCorrelation } from '@/core/statistics'

const logger = getLogger()

/** 周期阶段中文名 */
const CYCLE_LABELS: Record<MarketCycle, string> = {
  'left-bottom': '左侧底部',
  'right-up': '右侧上升',
  'top': '顶部区域',
  'left-down': '左侧下降',
}

/** 时间窗口映射 */
const HORIZON_DAYS: Record<PredictionHorizon, number> = {
  '5d': 5,
  '10d': 10,
  '20d': 20,
  '60d': 60,
}

/**
 * 识别市场周期阶段
 *
 * @param metrics - 市场指标
 * @returns 周期阶段
 */
export function identifyMarketCycle(metrics: CycleMetrics): {
  cycle: MarketCycle
  confidence: number
  label: string
} {
  const { indexMA5, indexMA20, indexMA60, volume20d, volume60d, northFlow5d, rsi14 } = metrics
  const maBull = indexMA5 > indexMA20 && indexMA20 > indexMA60
  const volExpand = volume20d > volume60d * 1.2
  const northIn = northFlow5d > 0
  const rsiHigh = rsi14 > 70
  const rsiMid = rsi14 > 50 && rsi14 <= 70
  const rsiLow = rsi14 < 30

  let cycle: MarketCycle
  let confidence = 0.5

  if (maBull && rsiHigh) {
    cycle = 'top'
    confidence = 0.8
  } else if (maBull && volExpand && northIn && rsiMid) {
    cycle = 'right-up'
    confidence = 0.85
  } else if (!maBull && rsiLow) {
    cycle = 'left-bottom'
    confidence = 0.7
  } else if (!maBull && rsi14 < 50) {
    cycle = 'left-down'
    confidence = 0.6
  } else {
    cycle = 'right-up'
    confidence = 0.5
  }

  logger.info('[identifyMarketCycle] 周期判定', {
    cycle: CYCLE_LABELS[cycle],
    confidence,
    maBull,
    volExpand,
    northIn,
    rsi14,
  })

  return { cycle, confidence, label: CYCLE_LABELS[cycle] ?? '未知' }
}

/**
 * 生成因子预测
 *
 * @param symbol - 股票代码
 * @param stockName - 股票名称
 * @param factorScores - 因子得分映射
 * @param factorWeights - 因子权重（周期适配后）
 * @param marketCycle - 当前市场周期
 * @param horizon - 预测时间窗口
 * @returns 因子预测记录
 */
export function generatePrediction(
  symbol: string,
  stockName: string,
  factorScores: Record<string, number>,
  factorWeights: Record<string, number>,
  marketCycle: MarketCycle,
  horizon: PredictionHorizon = '20d',
): FactorPrediction {
  const timeWindow = HORIZON_DAYS[horizon]

  // 计算加权综合分
  let weightedSum = 0
  let totalWeight = 0
  const drivingFactors: Array<{
    factorId: string
    factorName: string
    factorScore: number
    contribution: number
  }> = []

  for (const [factorId, score] of Object.entries(factorScores)) {
    const weight = factorWeights[factorId] ?? 1
    if (score === undefined || score === null || Number.isNaN(score)) continue
    weightedSum += score * weight
    totalWeight += weight
    drivingFactors.push({
      factorId,
      factorName: factorId,
      factorScore: score,
      contribution: score * weight,
    })
  }

  const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 2.5

  // 预测方向与幅度
  let direction: PredictionDirection
  let minReturn: number
  let maxReturn: number

  if (compositeScore >= 3.5) {
    direction = 'bullish'
    const intensity = (compositeScore - 3.5) / 1.5
    minReturn = 3 + intensity * 7
    maxReturn = 8 + intensity * 12
  } else if (compositeScore <= 1.5) {
    direction = 'bearish'
    const intensity = (1.5 - compositeScore) / 1.5
    minReturn = -(3 + intensity * 7)
    maxReturn = -(1 + intensity * 4)
  } else {
    direction = 'neutral'
    minReturn = -3
    maxReturn = 3
  }

  // 置信度
  const baseConfidence = Math.abs(compositeScore - 2.5) / 2.5
  const confidence = Math.min(0.95, Math.max(0.3, baseConfidence + 0.4))

  // 情绪因子是否主导
  const sentimentFactorIds = ['F3_6', 'F3_7', 'F2_8']
  const sentimentContribution = drivingFactors
    .filter((f) => sentimentFactorIds.includes(f.factorId))
    .reduce((sum, f) => sum + Math.abs(f.contribution), 0)
  const totalContribution = drivingFactors.reduce((sum, f) => sum + Math.abs(f.contribution), 0)
  const sentimentDominant = totalContribution > 0 && sentimentContribution / totalContribution > 0.3

  // 排序驱动因子（按贡献度降序）
  drivingFactors.sort((a, b) => b.contribution - a.contribution)

  const prediction: FactorPrediction = {
    predictionId: `pred-${symbol}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    symbol,
    stockName,
    direction,
    predictedReturnRange: { min: minReturn, max: maxReturn },
    timeWindow,
    horizon,
    drivingFactors: drivingFactors.slice(0, 5),
    confidence,
    marketCycle,
    sentimentDominant,
    status: 'pending',
  }

  logger.info('[generatePrediction] 预测已生成', {
    predictionId: prediction.predictionId,
    symbol,
    direction,
    compositeScore: compositeScore.toFixed(2),
    confidence: confidence.toFixed(2),
    sentimentDominant,
  })

  return prediction
}

/**
 * 校验预测
 *
 * @param prediction - 预测记录
 * @param actualReturn - 实际涨跌幅（%）
 * @returns 校验结果
 */
export function verifyPrediction(
  prediction: FactorPrediction,
  actualReturn: number,
): {
  hitDirection: boolean
  hitRange: boolean
  deviation: number
} {
  const hitDirection =
    (prediction.direction === 'bullish' && actualReturn > 0) ||
    (prediction.direction === 'bearish' && actualReturn < 0) ||
    (prediction.direction === 'neutral' && Math.abs(actualReturn) < 3)

  const hitRange =
    actualReturn >= prediction.predictedReturnRange.min &&
    actualReturn <= prediction.predictedReturnRange.max

  const predictedMid =
    (prediction.predictedReturnRange.min + prediction.predictedReturnRange.max) / 2
  const deviation = Math.abs(actualReturn - predictedMid)

  logger.info('[verifyPrediction] 预测校验完成', {
    predictionId: prediction.predictionId,
    actualReturn,
    hitDirection,
    hitRange,
    deviation,
  })

  return { hitDirection, hitRange, deviation }
}

/**
 * 批量计算因子 IC（信息系数）
 *
 * @param predictions - 已校验的预测列表
 * @param factorScores - 每次预测的因子得分记录
 * @param actualReturns - 每次预测的实际收益率
 * @returns 因子 IC 统计列表
 */
export function computeFactorICs(
  factorScores: ReadonlyArray<Record<string, number>>,
  actualReturns: readonly number[],
): ReadonlyArray<FactorICStat> {
  if (factorScores.length === 0 || actualReturns.length === 0) {
    return []
  }

  // 收集所有因子 ID
  const factorIds = new Set<string>()
  for (const scores of factorScores) {
    for (const id of Object.keys(scores)) {
      factorIds.add(id)
    }
  }

  const results: FactorICStat[] = []
  const n = Math.min(factorScores.length, actualReturns.length)

  for (const factorId of factorIds) {
    const factorValues: number[] = []
    const returns: number[] = []

    for (let i = 0; i < n; i++) {
      const score = factorScores[i]?.[factorId]
      if (score !== undefined && !Number.isNaN(score)) {
        factorValues.push(score)
        returns.push(actualReturns[i] ?? 0)
      }
    }

    if (factorValues.length < 5) continue

    const ic = spearmanCorrelation(factorValues, returns)

    // 计算 IR（需要多期 IC，此处简化为 IC / 1）
    const ir = Math.abs(ic)

    // 命中率（因子得分高且收益正 → 命中）
    let hits = 0
    for (let i = 0; i < factorValues.length; i++) {
      const fv = factorValues[i] ?? 0
      const ar = returns[i] ?? 0
      if ((fv > 2.5 && ar > 0) || (fv < 2.5 && ar < 0)) hits++
    }
    const hitRate = factorValues.length > 0 ? hits / factorValues.length : 0

    let status: FactorEffectiveness
    if (ic >= IC_THRESHOLDS.effective) status = 'effective'
    else if (ic >= IC_THRESHOLDS.weakening) status = 'weakening'
    else status = 'ineffective'

    results.push({
      factorId,
      factorName: factorId,
      ic: Math.round(ic * 1000) / 1000,
      ir: Math.round(ir * 1000) / 1000,
      hitRate: Math.round(hitRate * 1000) / 1000,
      status,
      sampleCount: factorValues.length,
    })
  }

  // 按 |IC| 降序
  results.sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic))

  logger.info('[computeFactorICs] 因子IC计算完成', {
    factorCount: results.length,
    effective: results.filter((r) => r.status === 'effective').length,
    weakening: results.filter((r) => r.status === 'weakening').length,
    ineffective: results.filter((r) => r.status === 'ineffective').length,
  })

  return results
}
