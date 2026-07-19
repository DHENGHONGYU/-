/**
 * @module riskComputer
 * @description 风险计算模块 - 纯函数集合
 *
 * 职责：
 * - 计算风险指标（VaR、最大回撤、波动率、夏普比率、集中度等）
 * - 生成风险告警
 *
 * 所有函数均为纯函数，便于测试和复用。
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import type { SymbolTradePair, PositionItem } from './positionComputer'
import type { PnLSummary } from './pnlComputer'
import { TRADING_DAYS_PER_YEAR, VAR_95_Z_SCORE } from '@/constants/math.constants'
import { RISK_THRESHOLDS } from '@/config/thresholds'

// ============================================================
// 类型定义
// ============================================================

/** 风险指标（基于交易对与盈亏汇总估算） */
export interface RiskMetrics {
  /** 历史模拟法 VaR(95%)，单位：% */
  var95: number
  /** VaR 风险等级 */
  varLevel: 'high' | 'medium' | 'low'
  /** 最大回撤 % */
  maxDrawdown: number
  /** 年化波动率 % */
  volatility: number
  /** 夏普比率 */
  sharpeRatio: number
  /** Beta 估算 */
  betaEstimate: number
  /** 持仓集中度 % */
  concentration: number
  /** 风险告警列表 */
  alerts: string[]
}

// ============================================================
// 工具函数
// ============================================================

/** 保留两位小数 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// ============================================================
// 核心计算函数
// ============================================================

/**
 * 从交易对与盈亏汇总估算风险指标。
 *
 * @remarks
 * 由于暂无实时行情，使用已实现盈亏曲线估算波动率、回撤、VaR 等风险指标。
 * 后续接入每日净值后可替换为基于净值的计算。
 */
export function computeRiskMetrics(
  tradePairs: SymbolTradePair[],
  pnlSummary: PnLSummary,
  positions: PositionItem[],
): RiskMetrics {
  const dailyCurve = pnlSummary.dailyCurve
  const totalInvested = round2(
    tradePairs.reduce((sum, tp) => sum + tp.totalBuy, 0),
  )

  // 日度盈亏变化（基于累计盈亏曲线的一阶差分）
  const dailyReturns: number[] = []
  for (let i = 1; i < dailyCurve.length; i++) {
    const change = dailyCurve[i]!.cumulativePnL - dailyCurve[i - 1]!.cumulativePnL
    dailyReturns.push(totalInvested > 0 ? (change / totalInvested) * 100 : 0)
  }

  const n = dailyReturns.length
  const mean = n > 0 ? dailyReturns.reduce((sum, r) => sum + r, 0) / n : 0
  const variance =
    n > 0 ? dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / n : 0
  const std = Math.sqrt(variance)

  // 年化波动率与夏普（按 252 个交易日）
  const volatility = round2(std * Math.sqrt(TRADING_DAYS_PER_YEAR))
  const sharpeRatio = volatility > 0 ? round2((mean * TRADING_DAYS_PER_YEAR) / volatility) : 0

  // 历史模拟法 VaR(95%)
  const var95 = round2(mean - VAR_95_Z_SCORE * std)
  let varLevel: 'high' | 'medium' | 'low' = 'low'
  if (var95 < RISK_THRESHOLDS.VAR_HIGH_THRESHOLD) {
    varLevel = 'high'
  } else if (var95 < RISK_THRESHOLDS.VAR_MEDIUM_THRESHOLD) {
    varLevel = 'medium'
  }

  // 最大回撤（基于累计盈亏曲线的百分比）
  let peak = -Infinity
  let maxDrawdown = 0
  for (const point of dailyCurve) {
    const value = totalInvested > 0 ? (point.cumulativePnL / totalInvested) * 100 : 0
    if (value > peak) peak = value
    const drawdown = peak > -Infinity ? peak - value : 0
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // 集中度：最大单一持仓成本市值 / 总持仓成本市值
  const totalCost = positions.reduce((sum, p) => sum + p.costValue, 0)
  const maxPosition = positions.reduce((max, p) => Math.max(max, p.costValue), 0)
  const concentration = totalCost > 0 ? round2((maxPosition / totalCost) * 100) : 0

  // Beta 估算：暂无基准数据，持仓存在时保守估算为 1.0
  const betaEstimate = positions.length > 0 ? 1 : 0

  const alerts: string[] = []
  if (concentration > RISK_THRESHOLDS.CONCENTRATION_HIGH_THRESHOLD) {
    alerts.push(`持仓集中度超过 ${RISK_THRESHOLDS.CONCENTRATION_HIGH_THRESHOLD}%，建议分散风险`)
  }
  if (sharpeRatio < 0) {
    alerts.push('夏普比率为负，组合风险收益比不佳')
  }
  if (varLevel === 'high') {
    alerts.push('VaR(95%) 处于高风险区间')
  }
  if (maxDrawdown > RISK_THRESHOLDS.MAX_DRAWDOWN_HIGH_THRESHOLD) {
    alerts.push(`最大回撤超过 ${RISK_THRESHOLDS.MAX_DRAWDOWN_HIGH_THRESHOLD}%`)
  }

  return {
    var95,
    varLevel,
    maxDrawdown: round2(maxDrawdown),
    volatility,
    sharpeRatio,
    betaEstimate,
    concentration,
    alerts,
  }
}
