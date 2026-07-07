/**
 * L3 辅助函数
 * 
 * 提供护城河评分和竞争格局评分等辅助计算
 */

import type { LayerInput } from '../../types'

/**
 * 护城河评分
 */
export function scoreMoat(input: LayerInput): number {
  const { financials, stock } = input
  let score = 3

  if (financials.grossMargin !== undefined) {
    const gm = financials.grossMargin
    if (gm >= 0.60) score = 5
    else if (gm >= 0.40) score = 4.5
    else if (gm >= 0.30) score = 4
    else if (gm >= 0.20) score = 3
    else if (gm >= 0.10) score = 2.5
    else score = 2
  }

  if (financials.revenueYoY !== undefined) {
    if (financials.revenueYoY > 1.0) score += 0.5
    else if (financials.revenueYoY > 0.5) score += 0.25
  }

  if (stock.roe !== undefined) {
    if (stock.roe > 0.20) score += 0.5
    else if (stock.roe > 0.15) score += 0.25
  }

  return Math.min(5, score)
}

/**
 * 竞争格局评分
 * 毛利率趋势通过毛利率水平推断：
 * >40% 视为递增，<20% 视为递减，20%-40% 视为稳定
 */
export function scoreCompetition(input: LayerInput): number {
  const { financials } = input
  const gm = financials.grossMargin
  const growth = financials.revenueYoY

  if (gm === undefined || growth === undefined) return 2.5

  let trend = '稳定'
  if (gm > 0.40) trend = '递增'
  else if (gm < 0.20) trend = '递减'

  if (trend === '递减') {
    if (growth > 0.30) return 4.5
    if (growth > 0.10) return 4
    return 3.5
  }

  if (trend === '递增') {
    if (growth > 0.30) return 4
    if (growth > 0.10) return 3.5
    return 3
  }

  // 稳定
  if (growth > 0.30) return 4
  if (growth > 0.10) return 3.5
  return 3
}
