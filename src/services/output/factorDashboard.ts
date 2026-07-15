/**
 * @fileoverview 因子画板数据聚合服务
 *
 * 聚合因子得分、IC 统计、预测记录、市场周期，输出画板展示数据。
 *
 * @module services/output/factorDashboard
 * @created 2026-07-15 - 输出模块补强
 */

import { getLogger } from '@/lib/logger'
import type {
  FactorDashboardData,
  MarketCycle,
  FactorPrediction,
  FactorICStat,
} from '@/types/modules/prediction.types'

const logger = getLogger()

const CYCLE_LABELS: Record<MarketCycle, string> = {
  'left-bottom': '左侧底部',
  'right-up': '右侧上升',
  'top': '顶部区域',
  'left-down': '左侧下降',
}

/**
 * 构建因子画板数据
 *
 * @param marketCycle - 当前市场周期
 * @param cycleConfidence - 周期判定置信度
 * @param factorScores - 当前因子得分
 * @param factorWeights - 当前因子权重
 * @param factorICs - 因子 IC 统计
 * @param predictions - 近期预测记录
 * @returns 画板数据
 */
export function buildDashboardData(
  marketCycle: MarketCycle,
  cycleConfidence: number,
  factorScores: Record<string, number>,
  factorWeights: Record<string, number>,
  factorICs: ReadonlyArray<FactorICStat>,
  predictions: readonly FactorPrediction[],
): FactorDashboardData {
  // 活跃因子列表
  const activeFactors = Object.entries(factorScores)
    .map(([factorId, score]) => {
      const weight = factorWeights[factorId] ?? 1
      const icStat = factorICs.find((s) => s.factorId === factorId)
      return {
        factorId,
        factorName: factorId,
        score,
        weight,
        ic: icStat?.ic ?? 0,
        effectiveness: icStat?.status ?? 'effective',
      }
    })
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 12)

  // 顶部预测（按置信度排序）
  const topPredictions = predictions
    .filter((p) => p.status === 'pending')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((p) => ({
      symbol: p.symbol,
      stockName: p.stockName,
      direction: p.direction,
      confidence: p.confidence,
      predictedReturn: `${p.predictedReturnRange.min.toFixed(1)}% ~ ${p.predictedReturnRange.max.toFixed(1)}%`,
    }))

  // 告警
  type DashboardAlert = {
    level: 'info' | 'warning' | 'critical'
    message: string
    factorId?: string
  }
  const alerts: DashboardAlert[] = []

  // 失效因子告警
  for (const stat of factorICs) {
    if (stat.status === 'ineffective') {
      alerts.push({
        level: 'critical',
        message: `因子 ${stat.factorId} 已失效（IC=${stat.ic.toFixed(3)}），建议剔除或降权`,
        factorId: stat.factorId,
      })
    } else if (stat.status === 'weakening') {
      alerts.push({
        level: 'warning',
        message: `因子 ${stat.factorId} 效力衰减（IC=${stat.ic.toFixed(3)}），建议关注`,
        factorId: stat.factorId,
      })
    }
  }

  // 周期告警
  if (marketCycle === 'top') {
    alerts.push({
      level: 'warning',
      message: '市场可能处于顶部区域，注意控制仓位',
    })
  }

  // 情绪主导告警
  const sentimentCount = predictions.filter((p) => p.sentimentDominant).length
  if (sentimentCount > predictions.length * 0.5 && predictions.length > 0) {
    alerts.push({
      level: 'info',
      message: `情绪因子主导 ${sentimentCount}/${predictions.length} 个预测（右侧机会特征）`,
    })
  }

  const data: FactorDashboardData = {
    marketCycle,
    cycleConfidence,
    activeFactors,
    topPredictions,
    alerts,
    generatedAt: new Date().toISOString(),
  }

  logger.info('[buildDashboardData] 画板数据已构建', {
    marketCycle: CYCLE_LABELS[marketCycle],
    activeFactorCount: activeFactors.length,
    predictionCount: topPredictions.length,
    alertCount: alerts.length,
  })

  return data
}
