/**
 * @fileoverview 周期复盘校准引擎
 *
 * 月度复盘预测准确性，计算因子 IC/IR，输出权重校准建议。
 *
 * @module services/output/cycleRetrospective
 * @created 2026-07-15 - 输出模块补强
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type {
  FactorPrediction,
  CycleRetrospectiveReport,
  MarketCycle,
  FactorICStat,
} from '@/types/modules/prediction.types'
import { computeFactorICs } from './predictionVerifier'

const logger = getLogger()

const CYCLE_LABELS: Record<MarketCycle, string> = {
  'left-bottom': '左侧底部',
  'right-up': '右侧上升',
  'top': '顶部区域',
  'left-down': '左侧下降',
}

/**
 * 生成周期复盘报告
 *
 * @param predictions - 本周期全部预测记录
 * @param marketCycle - 当前市场周期
 * @param period - 报告周期标识（如 "2026-07"）
 * @param factorScores - 每次预测的因子得分记录
 * @param actualReturns - 每次预测的实际收益率
 * @param currentWeights - 当前因子权重
 * @returns 周期复盘报告
 */
export function generateRetrospectiveReport(
  predictions: readonly FactorPrediction[],
  marketCycle: MarketCycle,
  period: string,
  factorScores: ReadonlyArray<Record<string, number>>,
  actualReturns: readonly number[],
  currentWeights: Record<string, number>,
): CycleRetrospectiveReport {
  logger.info('[generateRetrospectiveReport] 开始生成复盘报告', {
    period,
    marketCycle: CYCLE_LABELS[marketCycle],
    totalPredictions: predictions.length,
  })

  // 1. 准确率统计
  const verified = predictions.filter((p) => p.status === 'verified')
  const directionHits = verified.filter((p) => p.hitDirection).length
  const rangeHits = verified.filter((p) => p.hitRange).length
  const directionAccuracy = verified.length > 0 ? directionHits / verified.length : 0
  const rangeAccuracy = verified.length > 0 ? rangeHits / verified.length : 0

  // 2. 因子 IC 计算
  const factorICs = computeFactorICs(factorScores, actualReturns)

  // 3. 周期适配度（各周期阶段命中率）
  const cycleAdaptation: Record<MarketCycle, number> = {
    'left-bottom': 0,
    'right-up': 0,
    'top': 0,
    'left-down': 0,
  }
  for (const cycle of Object.keys(cycleAdaptation) as MarketCycle[]) {
    const cyclePreds = verified.filter((p) => p.marketCycle === cycle)
    const cycleHits = cyclePreds.filter((p) => p.hitDirection).length
    cycleAdaptation[cycle] = cyclePreds.length > 0 ? cycleHits / cyclePreds.length : 0
  }

  // 4. 权重调整建议
  const weightAdjustments = factorICs.map((stat: FactorICStat) => {
    const currentWeight = currentWeights[stat.factorId] ?? 1
    let suggestedWeight = currentWeight
    let reason = ''

    if (stat.status === 'effective') {
      suggestedWeight = currentWeight * 1.1
      reason = `IC=${stat.ic.toFixed(3)} 有效，建议上调10%`
    } else if (stat.status === 'weakening') {
      suggestedWeight = currentWeight * 0.7
      reason = `IC=${stat.ic.toFixed(3)} 效力衰减，建议下调30%`
    } else {
      suggestedWeight = currentWeight * 0.3
      reason = `IC=${stat.ic.toFixed(3)} 接近失效，建议大幅降权`
    }

    // 限制权重范围
    suggestedWeight = Math.max(0.1, Math.min(3.0, suggestedWeight))

    return {
      factorId: stat.factorId,
      factorName: stat.factorName,
      currentWeight,
      suggestedWeight: Math.round(suggestedWeight * 100) / 100,
      reason,
    }
  })

  const report: CycleRetrospectiveReport = {
    period,
    marketCycle,
    totalPredictions: predictions.length,
    directionAccuracy: Math.round(directionAccuracy * 1000) / 1000,
    rangeAccuracy: Math.round(rangeAccuracy * 1000) / 1000,
    factorICs,
    cycleAdaptation,
    weightAdjustments,
    generatedAt: new Date().toISOString(),
  }

  logger.info('[generateRetrospectiveReport] 复盘报告已生成', {
    period,
    directionAccuracy: report.directionAccuracy,
    rangeAccuracy: report.rangeAccuracy,
    effectiveFactors: factorICs.filter((f) => f.status === 'effective').length,
    adjustments: weightAdjustments.length,
  })

  return report
}

/**
 * 格式化复盘报告为 Markdown
 */
export function formatReportAsMarkdown(report: CycleRetrospectiveReport): string {
  const lines: string[] = []
  const { period, marketCycle, totalPredictions, directionAccuracy, rangeAccuracy, factorICs, weightAdjustments } = report

  lines.push(`# 周期复盘报告 — ${period}`)
  lines.push('')
  lines.push(`> 生成时间: ${report.generatedAt}`)
  lines.push(`> 市场周期: ${CYCLE_LABELS[marketCycle]}`)
  lines.push('')

  lines.push('## 一、准确率统计')
  lines.push(`- 总预测数: ${totalPredictions}`)
  lines.push(`- 方向准确率: ${(directionAccuracy * 100).toFixed(1)}%`)
  lines.push(`- 幅度准确率: ${(rangeAccuracy * 100).toFixed(1)}%`)
  lines.push('')

  lines.push('## 二、因子 IC/IR 排名')
  lines.push('| 因子 | IC | IR | 命中率 | 状态 |')
  lines.push('|------|-----|-----|--------|------|')
  for (const stat of factorICs.slice(0, 15)) {
    const statusLabel = stat.status === 'effective' ? '✅ 有效' : stat.status === 'weakening' ? '⚠️ 衰减' : '❌ 失效'
    lines.push(`| ${stat.factorId} | ${stat.ic.toFixed(3)} | ${stat.ir.toFixed(3)} | ${(stat.hitRate * 100).toFixed(0)}% | ${statusLabel} |`)
  }
  lines.push('')

  lines.push('## 三、权重调整建议')
  lines.push('| 因子 | 当前权重 | 建议权重 | 理由 |')
  lines.push('|------|---------|---------|------|')
  for (const adj of weightAdjustments.slice(0, 15)) {
    lines.push(`| ${adj.factorId} | ${adj.currentWeight.toFixed(2)} | ${adj.suggestedWeight.toFixed(2)} | ${adj.reason} |`)
  }
  lines.push('')

  lines.push('## 四、周期适配度')
  for (const [cycle, rate] of Object.entries(report.cycleAdaptation)) {
    const label = CYCLE_LABELS[cycle as MarketCycle] ?? cycle
    lines.push(`- ${label}: ${(rate * 100).toFixed(1)}%`)
  }

  return lines.join('\n')
}
