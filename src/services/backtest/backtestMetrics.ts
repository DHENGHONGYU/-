/**
 * @module backtestMetrics
 * @description 策略回测绩效指标域。
 *
 * 从 BacktestEngine.ts 温和拆分（PR-6 阶段 3.2），负责：
 * - 计算绩效指标（总收益/年化/最大回撤/夏普/胜率/盈亏统计）
 * - 将 VirtualOrder 序列转换为 BacktestTrade（平均成本法）
 * - 构建最终持仓快照
 * - 提供空结果工厂（行为契约：pnlCurve 默认 [1.0]）
 *
 * 行为等价性：本模块所有函数均为原 BacktestEngine 私有方法的 1:1 迁移，
 * 不改任何算法、不调整公式、不重命名。拆分前 28 个测试基线全绿，
 * 拆分后必须保持全绿（特别是契约③：pnlCurve === [1.0]）。
 *
 * @see BacktestEngine.ts — 主编排器，调用本模块函数
 * @see backtestEventLoader.ts — 提供 getPriceForDate（构建持仓快照时使用）
 */

import type { DailyQuotes } from '@/data/types'
import type {
  BacktestResult,
  BacktestTrade,
} from '@/types/modules/backtest.types'
import { TRADING_DAYS_PER_YEAR } from '@/config/mathConstants'
import type {
  BacktestEngineConfig,
  VirtualOrder,
  VirtualPosition,
  BacktestEngineResult,
} from './BacktestEngine'
import { getPriceForDate } from './backtestEventLoader'

// ============================================================
// 类型定义（从 BacktestEngine.ts 迁出，供主文件 + metrics 共享）
// ============================================================

export interface InternalPosition {
  quantity: number
  avgCost: number
}

// ============================================================
// 绩效指标计算
// ============================================================

/**
 * 计算绩效指标。
 * 行为契约：dailyValues 为空时返回 _emptyMetrics 默认值（pnlCurve=[1.0]）。
 */
export function calculateBacktestMetrics(
  dailyValues: { date: string; totalValue: number; cash: number }[],
  trades: VirtualOrder[],
  config: BacktestEngineConfig,
): BacktestResult {
  const DAYS_PER_YEAR = TRADING_DAYS_PER_YEAR
  const RISK_FREE_RATE = 0.03

  // 净值曲线（归一化）
  const pnlCurve = dailyValues.map((d) =>
    config.initialCapital > 0 ? d.totalValue / config.initialCapital : 1,
  )

  if (pnlCurve.length === 0) {
    return createEmptyMetrics(config)
  }

  const finalValue = pnlCurve[pnlCurve.length - 1]!
  const totalReturn = (finalValue - 1) * 100

  const totalDays = dailyValues.length
  const years = totalDays / DAYS_PER_YEAR
  const annualizedReturn =
    years > 0 ? (Math.pow(finalValue, 1 / years) - 1) * 100 : 0

  // 最大回撤
  let peak = 1.0
  let maxDrawdownVal = 0
  for (const v of pnlCurve) {
    if (v > peak) peak = v
    const dd = (peak - v) / peak
    if (dd > maxDrawdownVal) maxDrawdownVal = dd
  }

  // 夏普比率
  const dailyReturns: number[] = []
  for (let i = 1; i < pnlCurve.length; i++) {
    dailyReturns.push(pnlCurve[i]! / pnlCurve[i - 1]! - 1)
  }
  const meanDailyReturn =
    dailyReturns.length > 0
      ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
      : 0
  const stdDailyReturn =
    dailyReturns.length > 0
      ? Math.sqrt(
          dailyReturns.reduce((sum, r) => sum + (r - meanDailyReturn) ** 2, 0) /
            dailyReturns.length,
        )
      : 0
  const sharpeRatio =
    stdDailyReturn > 0
      ? (meanDailyReturn * DAYS_PER_YEAR - RISK_FREE_RATE) /
        (stdDailyReturn * Math.sqrt(DAYS_PER_YEAR))
      : 0

  // 交易盈亏统计（基于每笔卖出与其持仓成本的对比）
  const backtestTrades = buildBacktestTrades(trades, config)
  const profitTrades = backtestTrades.filter((t) => t.pnlPct > 0)
  const lossTrades = backtestTrades.filter((t) => t.pnlPct < 0)
  const tradeCount = backtestTrades.length
  const winRate = tradeCount > 0 ? (profitTrades.length / tradeCount) * 100 : 0
  const avgProfit =
    profitTrades.length > 0
      ? profitTrades.reduce((a, t) => a + t.pnlPct, 0) / profitTrades.length
      : 0
  const avgLoss =
    lossTrades.length > 0
      ? lossTrades.reduce((a, t) => a + t.pnlPct, 0) / lossTrades.length
      : 0

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdownVal * 10000) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    tradeCount,
    profitTrades: profitTrades.length,
    lossTrades: lossTrades.length,
    avgProfit: Math.round(avgProfit * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    pnlCurve,
    trades: backtestTrades,
  }
}

/**
 * 将 VirtualOrder 序列转换为 BacktestTrade，计算每笔交易的盈亏。
 * 采用平均成本法：买入记录成本，卖出时按 avgCost 计算实现盈亏。
 */
function applySell(
  t: VirtualOrder,
  qty: number,
  avgCost: number,
  quantities: Map<string, number>,
  avgCosts: Map<string, number>,
  result: BacktestTrade[],
): void {
  const sellQty = Math.min(t.quantity, qty)
  if (sellQty <= 0) return
  const grossPnL = (t.price - avgCost) * sellQty - t.commission
  const pnlPct = avgCost > 0 ? ((t.price - avgCost) / avgCost) * 100 : 0
  result.push({
    symbol: t.symbol,
    direction: 'sell',
    price: t.price,
    quantity: sellQty,
    date: t.date,
    pnl: Math.round(grossPnL * 100) / 100,
    pnlPct: Math.round(pnlPct * 100) / 100,
    reason: '策略信号卖出',
  })
  const remaining = qty - sellQty
  if (remaining <= 0) {
    quantities.delete(t.symbol)
    avgCosts.delete(t.symbol)
  } else {
    quantities.set(t.symbol, remaining)
  }
}

export function buildBacktestTrades(
  trades: VirtualOrder[],
  _config: BacktestEngineConfig,
): BacktestTrade[] {
  const result: BacktestTrade[] = []
  const avgCosts = new Map<string, number>() // symbol -> avgCost
  const quantities = new Map<string, number>() // symbol -> 当前持仓

  for (const t of trades) {
    if (t.direction === 'buy') {
      const prevQty = quantities.get(t.symbol) ?? 0
      const prevCost = avgCosts.get(t.symbol) ?? 0
      const newQty = prevQty + t.quantity
      const newAvgCost =
        newQty > 0 ? (prevQty * prevCost + t.quantity * t.price) / newQty : 0

      quantities.set(t.symbol, newQty)
      avgCosts.set(t.symbol, newAvgCost)

      result.push({
        symbol: t.symbol,
        direction: 'buy',
        price: t.price,
        quantity: t.quantity,
        date: t.date,
        pnl: 0,
        pnlPct: 0,
        reason: '策略信号买入',
      })
    } else {
      const qty = quantities.get(t.symbol) ?? 0
      const avgCost = avgCosts.get(t.symbol) ?? 0
      applySell(t, qty, avgCost, quantities, avgCosts, result)
    }
  }

  return result
}

// ============================================================
// 组合估值与持仓快照
// ============================================================

/**
 * 构建最终持仓快照（VirtualPosition 数组）。
 * 行为契约：使用 getPriceForDate 获取 endDate 收盘价，回退到 avgCost。
 */
export function buildVirtualPositions(
  positions: Map<string, InternalPosition>,
  endDate: string,
  quotesCache: Map<string, DailyQuotes>,
): VirtualPosition[] {
  return Array.from(positions.entries()).map(([symbol, pos]) => {
    const price = getPriceForDate(symbol, endDate, quotesCache) ?? pos.avgCost
    const mv = pos.quantity * price
    const cost = pos.quantity * pos.avgCost
    return {
      symbol,
      quantity: pos.quantity,
      avgCost: Math.round(pos.avgCost * 100) / 100,
      currentPrice: Math.round(price * 100) / 100,
      marketValue: Math.round(mv * 100) / 100,
      unrealizedPnL: Math.round((mv - cost) * 100) / 100,
    }
  })
}

// ============================================================
// 空结果工厂
// ============================================================

/**
 * 构建空结果（无信号/订单时返回）。
 * 行为契约：trades/positions/dailyValues 均为空数组，metrics 为空指标。
 */
export function createEmptyResult(config: BacktestEngineConfig): BacktestEngineResult {
  return {
    trades: [],
    positions: [],
    dailyValues: [],
    metrics: createEmptyMetrics(config),
  }
}

/**
 * 构建空指标。
 * 行为契约：pnlCurve 默认 [1.0]（表示以初始资金 1.0 倍为基准），非 []。
 */
export function createEmptyMetrics(_config: BacktestEngineConfig): BacktestResult {
  return {
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0,
    tradeCount: 0,
    profitTrades: 0,
    lossTrades: 0,
    avgProfit: 0,
    avgLoss: 0,
    pnlCurve: [1.0],
    trades: [],
  }
}
