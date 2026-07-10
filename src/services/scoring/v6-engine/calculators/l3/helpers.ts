/**
 * @module l3/helpers
 * @description V6 评分引擎 L3 层辅助函数
 *
 * L3 层是确定性计算层，负责护城河评分和竞争格局评分的量化计算。
 * 这些辅助函数被 L3 计算器调用，是评分引擎的核心逻辑组件。
 *
 * 评分体系：1-5 分制，5 分为最高，1 分为最低
 *
 * @compliance AGENTS.md §六 引擎架构约束：L3 是确定性层（程序计算）
 */

import type { LayerInput } from '../../types'

/**
 * 护城河评分计算
 *
 * 根据毛利率、营收增速、ROE 三个维度综合评估企业护城河宽度。
 * 毛利率是核心指标，营收增速和 ROE 作为加分项。
 *
 * 评分规则：
 * ┌──────────────┬───────┐
 * │ 毛利率区间   │ 基础分 │
 * ├──────────────┼───────┤
 * │ >= 60%      │ 5.0   │
 * │ 40%-60%     │ 4.5   │
 * │ 30%-40%     │ 4.0   │
 * │ 20%-30%     │ 3.0   │
 * │ 10%-20%     │ 2.5   │
 * │ < 10%       │ 2.0   │
 * └──────────────┴───────┘
 *
 * 加分规则：
 * - 营收增速 > 100%：+0.5 分
 * - 营收增速 > 50%：+0.25 分
 * - ROE > 20%：+0.5 分
 * - ROE > 15%：+0.25 分
 *
 * 封顶规则：总分不超过 5.0 分
 *
 * @param {LayerInput} input - 输入数据，包含财务数据和股票基础信息
 * @param {Financials} input.financials - 财务数据
 * @param {number} [input.financials.grossMargin] - 毛利率（0-1）
 * @param {number} [input.financials.revenueYoY] - 营收同比增速
 * @param {Stock} input.stock - 股票基础信息
 * @param {number} [input.stock.roe] - 净资产收益率（0-1）
 * @returns {number} 护城河评分（1-5 分）
 *
 * @example
 * ```typescript
 * const score = scoreMoat({
 *   financials: { grossMargin: 0.45, revenueYoY: 0.35 },
 *   stock: { roe: 0.18 }
 * })
 * // score = 4.5 (毛利率基础分) + 0 (营收增速未达标) + 0.25 (ROE>15%) = 4.75
 * ```
 */
export function scoreMoat(input: LayerInput): number {
  const { financials, stock } = input
  let score = 3

  if (financials.grossMargin !== undefined) {
    const gm = financials.grossMargin
    const tiers = [
      { threshold: 0.60, score: 5 },
      { threshold: 0.40, score: 4.5 },
      { threshold: 0.30, score: 4 },
      { threshold: 0.20, score: 3 },
      { threshold: 0.10, score: 2.5 },
    ]
    score = tiers.find((tier) => gm >= tier.threshold)?.score ?? 2
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
 * 竞争格局评分计算
 *
 * 根据毛利率水平和营收增速综合评估行业竞争格局。
 * 毛利率趋势通过毛利率水平推断：
 * - >40%：高毛利行业，通常竞争格局较好（递增）
 * - 20%-40%：中等毛利行业，竞争格局相对稳定
 * - <20%：低毛利行业，通常竞争激烈（递减）
 *
 * 评分规则：
 *
 * 递减趋势（毛利率 < 20%）：
 * ┌──────────────┬───────┐
 * │ 营收增速    │ 评分  │
 * ├──────────────┼───────┤
 * │ > 30%       │ 4.5   │
 * │ > 10%       │ 4.0   │
 * │ <= 10%      │ 3.5   │
 * └──────────────┴───────┘
 *
 * 递增趋势（毛利率 > 40%）：
 * ┌──────────────┬───────┐
 * │ 营收增速    │ 评分  │
 * ├──────────────┼───────┤
 * │ > 30%       │ 4.0   │
 * │ > 10%       │ 3.5   │
 * │ <= 10%      │ 3.0   │
 * └──────────────┴───────┘
 *
 * 稳定趋势（毛利率 20%-40%）：
 * ┌──────────────┬───────┐
 * │ 营收增速    │ 评分  │
 * ├──────────────┼───────┤
 * │ > 30%       │ 4.0   │
 * │ > 10%       │ 3.5   │
 * │ <= 10%      │ 3.0   │
 * └──────────────┴───────┘
 *
 * @param {LayerInput} input - 输入数据，包含财务数据
 * @param {Financials} input.financials - 财务数据
 * @param {number} [input.financials.grossMargin] - 毛利率（0-1）
 * @param {number} [input.financials.revenueYoY] - 营收同比增速
 * @returns {number} 竞争格局评分（1-5 分），数据缺失时返回 2.5（中性分）
 *
 * @example
 * ```typescript
 * const score = scoreCompetition({
 *   financials: { grossMargin: 0.45, revenueYoY: 0.35 }
 * })
 * // 毛利率 > 40% → 递增趋势，营收增速 > 30% → 评分 = 4.0
 * ```
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

  if (growth > 0.30) return 4
  if (growth > 0.10) return 3.5
  return 3
}
