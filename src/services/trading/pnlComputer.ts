/**
 * @module pnlComputer
 * @description 盈亏计算模块 - 纯函数集合
 *
 * 职责：
 * - 从交易对计算盈亏汇总（胜率、盈亏比、月度盈亏、日度曲线）
 * - 计算已实现和未实现盈亏
 *
 * 所有函数均为纯函数，便于测试和复用。
 */

import type { SymbolTradePair } from './positionComputer'

// ============================================================
// 类型定义
// ============================================================

/** 盈亏汇总 */
export interface PnLSummary {
  /** 总已实现盈亏（金额，元） */
  totalRealizedPnl: number
  /** 总未实现盈亏（金额，元）—— 按最新价估算，暂无行情时为 0 */
  totalUnrealizedPnl: number
  /** 胜率 % */
  winRate: number
  /** 盈亏比 */
  profitFactor: number
  /** 总交易笔数（完成配对的） */
  totalTrades: number
  /** 盈利交易数 */
  profitTrades: number
  /** 亏损交易数 */
  lossTrades: number
  /** 月度盈亏列表 */
  monthlyPnL: Array<{ month: string; pnl: number; trades: number }>
  /** 日度累计盈亏曲线 */
  dailyCurve: Array<{ date: string; cumulativePnL: number }>
}

// ============================================================
// 常量
// ============================================================

/** 无亏损时的盈亏比占位值（表示"极优"） */
const PROFIT_FACTOR_NO_LOSS = 999

// ============================================================
// 工具函数
// ============================================================

/** 保留两位小数 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 保留一位小数 */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

// ============================================================
// 核心计算函数
// ============================================================

/**
 * 从交易对结果计算盈亏汇总。
 *
 * @param tradePairs - 交易对数组
 * @returns 盈亏汇总指标
 */
export function computePnLSummary(tradePairs: SymbolTradePair[]): PnLSummary {
  const flatPairs = tradePairs.flatMap((tp) => tp.pairs)
  const totalTrades = flatPairs.length

  if (totalTrades === 0) {
    return {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [],
    }
  }

  const profitPairs = flatPairs.filter((p) => p.realizedAmount > 0)
  const lossPairs = flatPairs.filter((p) => p.realizedAmount < 0)
  const profitTrades = profitPairs.length
  const lossTrades = lossPairs.length

  const totalRealizedPnl = round2(flatPairs.reduce((sum, p) => sum + p.realizedAmount, 0))
  const winRate = round1((profitTrades / totalTrades) * 100)

  const totalProfit = profitPairs.length > 0
    ? profitPairs.reduce((sum, p) => sum + p.realizedAmount, 0)
    : 0
  const totalLoss = lossPairs.length > 0
    ? Math.abs(lossPairs.reduce((sum, p) => sum + p.realizedAmount, 0))
    : 0
  const profitFactor = totalLoss > 0
    ? round2(totalProfit / totalLoss)
    : totalProfit > 0
      ? PROFIT_FACTOR_NO_LOSS
      : 0

  // 月度盈亏（按卖出日期聚合）
  const monthlyMap = new Map<string, { pnl: number; trades: number }>()
  for (const pair of flatPairs) {
    const month = pair.sellDate.slice(0, 7)
    const existing = monthlyMap.get(month) ?? { pnl: 0, trades: 0 }
    existing.pnl += pair.realizedAmount
    existing.trades += 1
    monthlyMap.set(month, existing)
  }
  const monthlyPnL = Array.from(monthlyMap.entries())
    .map(([month, val]) => ({
      month,
      pnl: round2(val.pnl),
      trades: val.trades,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // 日度累计盈亏曲线（按卖出日期排序累加）
  const sortedByDate = [...flatPairs].sort((a, b) => a.sellDate.localeCompare(b.sellDate))
  let cumulative = 0
  const dailyCurve = sortedByDate.map((pair) => {
    cumulative += pair.realizedAmount
    return {
      date: pair.sellDate,
      cumulativePnL: round2(cumulative),
    }
  })

  // 未实现盈亏：暂无实时行情，暂计为 0
  // 后续可接入 dailyQuotes 后，用最新价 × 持仓数量 - 持仓成本计算
  const totalUnrealizedPnl = 0

  return {
    totalRealizedPnl,
    totalUnrealizedPnl,
    winRate,
    profitFactor,
    totalTrades,
    profitTrades,
    lossTrades,
    monthlyPnL,
    dailyCurve,
  }
}
