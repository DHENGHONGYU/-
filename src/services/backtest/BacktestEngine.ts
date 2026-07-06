/**
 * @module BacktestEngine
 * @description 策略回测引擎基座。
 *
 * 基于真实策略信号执行虚拟交易，核心职责：
 * - 接收回测配置（策略、日期范围、初始资金、手续费率、滑点）
 * - 在日期范围内逐日/逐信号执行策略
 * - 生成虚拟订单并跟踪持仓
 * - 计算准确的绩效指标
 *
 * 复用关系：
 * - positionSizer：计算目标仓位
 * - riskEngine 逻辑：虚拟风控检查（单笔/总仓位上限、卖出必须有持仓等）
 * - dualStrategyEngine / signalStore：信号来源
 *
 * @see src/store/backtestStore.ts — 回测 Store，管理回测配置、结果与状态
 * @see src/services/trading/positionSizer.ts — 仓位计算器（calculatePosition）
 * @see src/data/types.ts — Signal / Order / DailyQuotes 类型定义
 * @see docs/《功能模块数据契约》.md#14-策略回测引擎backtestengine — 模块契约
 * @see docs/《V9核心数据字典与类型定义（整合版）》.md — BacktestEngineConfig / VirtualOrder / VirtualPosition / BacktestEngineResult
 */

import { generateId } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import type { DailyQuotes, Signal, Order } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { calculatePosition } from '@/services/trading/positionSizer'
import type { BacktestStrategy, BacktestResult, BacktestTrade } from '@/types/modules/backtest.types'
import { TRADING_DAYS_PER_YEAR } from '@/config/mathConstants'

const logger = getLogger()

/** 毫秒精度：一天结束时刻的毫秒部分 */
const MS_END_OF_DAY = 999

/** 信号事件不足此数量时，用订单事件补充合并 */
const MIN_SIGNAL_EVENTS_FOR_COMBINE = 5

// ============================================================
// 类型定义
// ============================================================

export interface BacktestEngineConfig {
  strategy: BacktestStrategy
  startDate: string
  endDate: string
  initialCapital: number
  commissionRate: number
  slippage: number
  maxPositionPct: number
}

export interface VirtualOrder {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  price: number
  quantity: number
  date: string
  commission: number
}

export interface VirtualPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
}

export interface BacktestEngineResult {
  trades: VirtualOrder[]
  positions: VirtualPosition[]
  dailyValues: { date: string; totalValue: number; cash: number }[]
  metrics: BacktestResult
}

interface BacktestEvent {
  symbol: string
  direction: 'buy' | 'sell'
  date: string
  price: number
  confidence: number
  source: 'signal' | 'order'
  strategy?: string
}

interface InternalPosition {
  quantity: number
  avgCost: number
}

// ============================================================
// 回测引擎
// ============================================================

export class BacktestEngine {
  /**
   * 执行回测。
   */
  async run(config: BacktestEngineConfig): Promise<BacktestEngineResult> {
    logger.info('[BacktestEngine] 开始回测', {
      strategy: config.strategy,
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
    })

    // 1. 加载信号/订单事件
    const events = await this._loadEvents(config)
    if (events.length === 0) {
      logger.warn('[BacktestEngine] 未找到任何信号/订单，返回空结果')
      return this._emptyResult(config)
    }

    // 2. 预加载行情数据
    const quotesCache = await this._preloadQuotes(events)

    // 3. 初始化状态
    let cash = config.initialCapital
    const positions = new Map<string, InternalPosition>()
    const trades: VirtualOrder[] = []
    const dailyValues: { date: string; totalValue: number; cash: number }[] = []

    // 4. 按日期分组事件
    const eventsByDate = this._groupEventsByDate(events)

    // 5. 生成日期序列并逐日执行
    const dateList = this._generateDateRange(config.startDate, config.endDate)

    for (const date of dateList) {
      const dayEvents = eventsByDate.get(date) ?? []

      // 先处理卖出，释放现金
      const sellEvents = dayEvents.filter((e) => e.direction === 'sell')
      const buyEvents = dayEvents.filter((e) => e.direction === 'buy')

      for (const evt of sellEvents) {
        const price = this._getPriceForDate(evt.symbol, date, quotesCache) ?? evt.price
        if (price <= 0) continue

        const qty = this._calculateSellQuantity(evt.symbol, positions)
        if (qty <= 0) continue

        const order = this._executeVirtualSell(evt.symbol, price, qty, date, config)
        trades.push(order)
        cash = cash + order.quantity * order.price - order.commission

        const pos = positions.get(evt.symbol)
        if (pos) {
          const remaining = pos.quantity - order.quantity
          if (remaining <= 0) {
            positions.delete(evt.symbol)
          } else {
            positions.set(evt.symbol, { quantity: remaining, avgCost: pos.avgCost })
          }
        }
      }

      for (const evt of buyEvents) {
        const price = this._getPriceForDate(evt.symbol, date, quotesCache) ?? evt.price
        if (price <= 0) continue

        const portfolioValue = this._calculatePortfolioValue(cash, positions, date, quotesCache)
        const qty = this._calculatePositionSize(evt, cash, portfolioValue, positions, config)
        if (qty <= 0) continue

        const order = this._executeVirtualBuy(evt.symbol, price, qty, date, config)
        const totalCost = order.quantity * order.price + order.commission
        if (totalCost > cash) continue

        trades.push(order)
        cash = cash - totalCost

        const pos = positions.get(evt.symbol) ?? { quantity: 0, avgCost: 0 }
        const newQty = pos.quantity + order.quantity
        const newAvgCost =
          newQty > 0
            ? (pos.quantity * pos.avgCost + order.quantity * order.price) / newQty
            : 0
        positions.set(evt.symbol, { quantity: newQty, avgCost: newAvgCost })
      }

      // 6. 记录当日收盘净值
      const dayTotalValue = this._calculatePortfolioValue(cash, positions, date, quotesCache)
      dailyValues.push({ date, totalValue: dayTotalValue, cash })
    }

    // 7. 计算绩效指标
    const metrics = this._calculateMetrics(dailyValues, trades, config)

    // 8. 构建最终持仓
    const virtualPositions = this._buildVirtualPositions(positions, config.endDate, quotesCache)

    // 9. 将持仓与净值序列一并注入 metrics，供 backtestStore 导出使用（避免重复计算）
    metrics.positions = virtualPositions
    metrics.dailyValues = dailyValues

    logger.info('[BacktestEngine] 回测完成', {
      tradeCount: trades.length,
      finalValue: dailyValues[dailyValues.length - 1]?.totalValue ?? config.initialCapital,
      totalReturn: metrics.totalReturn,
    })

    return { trades, positions: virtualPositions, dailyValues, metrics }
  }

  // ============================================================
  // 信号加载
  // ============================================================

  private async _loadEvents(config: BacktestEngineConfig): Promise<BacktestEvent[]> {
    const startTs = new Date(config.startDate).getTime()
    const endTsEod = new Date(config.endDate)
    endTsEod.setHours(23, 59, 59, MS_END_OF_DAY)
    const endTs = endTsEod.getTime()

    // 1. 从 signals 获取策略信号
    const signalEvents = await this._loadSignalEvents(config, startTs, endTs)

    // 2. 若信号不足，用 orders 补充
    if (signalEvents.length < MIN_SIGNAL_EVENTS_FOR_COMBINE) {
      const orderEvents = await this._loadOrderEvents(config, startTs, endTs)
      const combined = this._mergeEvents(signalEvents, orderEvents)
      return combined.sort((a, b) => a.date.localeCompare(b.date))
    }

    return signalEvents.sort((a, b) => a.date.localeCompare(b.date))
  }

  private async _loadSignalEvents(
    config: BacktestEngineConfig,
    startTs: number,
    endTs: number,
  ): Promise<BacktestEvent[]> {
    let signals: Signal[] = []
    try {
      signals = await dataLayer.signals.list()
    } catch {
      logger.warn('[BacktestEngine] 读取 signals 失败')
      return []
    }

    const filtered = signals.filter((s) => {
      const ts = s.createdAt ?? 0
      if (ts < startTs || ts > endTs) return false
      if (s.direction !== 'buy' && s.direction !== 'sell') return false
      if (config.strategy === 'hot_sector') return s.strategy === 'hot-sector'
      if (config.strategy === 'value_pit') return s.strategy === 'value-pit'
      return true // composite 或 strategy 未匹配时全保留
    })

    // 预加载行情用于定价
    const quotesCache = new Map<string, DailyQuotes>()
    for (const s of filtered) {
      if (!quotesCache.has(s.symbol)) {
        const q = await dataLayer.dailyQuotes.get(s.symbol)
        if (q) quotesCache.set(s.symbol, q)
      }
    }

    return filtered
      .map((s) => {
        const date = new Date(s.createdAt ?? Date.now()).toISOString().slice(0, 10)
        const quotes = quotesCache.get(s.symbol)
        const price = this._getPriceForDate(s.symbol, date, quotesCache) ?? quotes?.latest.close ?? 0
        return {
          symbol: s.symbol,
          direction: s.direction as 'buy' | 'sell',
          date,
          price,
          confidence: s.confidence,
          source: 'signal' as const,
          strategy: s.strategy,
        }
      })
      .filter((e) => e.price > 0)
  }

  private async _loadOrderEvents(
    _config: BacktestEngineConfig,
    startTs: number,
    endTs: number,
  ): Promise<BacktestEvent[]> {
    let orders: Order[] = []
    try {
      orders = await dataLayer.orders.list()
    } catch {
      logger.warn('[BacktestEngine] 读取 orders 失败')
      return []
    }

    const filtered = orders.filter((o) => {
      const ts = o.createdAt ?? 0
      return ts >= startTs && ts <= endTs && (o.direction === 'buy' || o.direction === 'sell')
    })

    return filtered.map((o) => ({
      symbol: o.symbol,
      direction: o.direction as 'buy' | 'sell',
      date: new Date(o.createdAt ?? Date.now()).toISOString().slice(0, 10),
      price: o.price,
      confidence: 0.5,
      source: 'order' as const,
      strategy: undefined,
    }))
  }

  private _mergeEvents(signals: BacktestEvent[], orders: BacktestEvent[]): BacktestEvent[] {
    const seen = new Set<string>()
    const merged: BacktestEvent[] = []

    for (const e of signals) {
      const key = `${e.date}-${e.symbol}-${e.direction}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(e)
      }
    }

    for (const e of orders) {
      const key = `${e.date}-${e.symbol}-${e.direction}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(e)
      }
    }

    return merged
  }

  private _groupEventsByDate(events: BacktestEvent[]): Map<string, BacktestEvent[]> {
    const map = new Map<string, BacktestEvent[]>()
    for (const e of events) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }

  // ============================================================
  // 行情数据
  // ============================================================

  private async _preloadQuotes(events: BacktestEvent[]): Promise<Map<string, DailyQuotes>> {
    const cache = new Map<string, DailyQuotes>()
    const symbols = new Set(events.map((e) => e.symbol))
    for (const sym of symbols) {
      const q = await dataLayer.dailyQuotes.get(sym)
      if (q) cache.set(sym, q)
    }
    return cache
  }

  private _getPriceForDate(
    symbol: string,
    date: string,
    cache: Map<string, DailyQuotes>,
  ): number | undefined {
    const quotes = cache.get(symbol)
    if (!quotes) return undefined
    const bar = quotes.history.find((b) => b.date === date)
    if (bar) return bar.close
    // 若历史无该日，回退到最新价（适用于信号日期在最新价附近）
    return quotes.latest.close
  }

  // ============================================================
  // 日期工具
  // ============================================================

  private _generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    const curr = new Date(start)

    while (curr <= end) {
      // 跳过周末（简化：仅周六日）
      const day = curr.getDay()
      if (day !== 0 && day !== 6) {
        dates.push(curr.toISOString().slice(0, 10))
      }
      curr.setDate(curr.getDate() + 1)
    }

    return dates
  }

  // ============================================================
  // 仓位与执行
  // ============================================================

  /**
   * 计算买入数量。
   * 复用 positionSizer，并叠加 maxPositionPct 约束。
   */
  private _calculatePositionSize(
    event: BacktestEvent,
    cash: number,
    portfolioValue: number,
    positions: Map<string, InternalPosition>,
    config: BacktestEngineConfig,
  ): number {
    if (event.direction !== 'buy' || event.price <= 0 || portfolioValue <= 0) {
      return 0
    }

    const holding = positions.get(event.symbol) ?? { quantity: 0, avgCost: 0 }
    const holdingValue = holding.quantity * event.price
    const totalPositionValue = Array.from(positions.entries()).reduce((sum, [, pos]) => {
      return sum + pos.quantity * event.price
    }, 0)

    const sizing = calculatePosition({
      direction: 'buy',
      price: event.price,
      portfolioValue,
      currentHoldingShares: holding.quantity,
      currentHoldingValue: holdingValue,
      currentTotalPositionValue: totalPositionValue,
    })

    if (sizing.action !== 'buy' || sizing.targetShares <= 0) {
      return 0
    }

    let targetShares = sizing.targetShares

    // 叠加 maxPositionPct 约束（回测专用）
    const maxSingleValue = config.maxPositionPct * portfolioValue
    const afterBuyValue = (holding.quantity + targetShares) * event.price
    if (afterBuyValue > maxSingleValue) {
      const maxShares = Math.floor(maxSingleValue / event.price)
      targetShares = Math.max(0, maxShares - holding.quantity)
    }

    // 检查现金是否足够（含手续费）
    const execPrice = event.price * (1 + config.slippage)
    const maxAffordable = Math.floor(
      cash / (execPrice * (1 + config.commissionRate)),
    )
    targetShares = Math.min(targetShares, maxAffordable)

    return targetShares > 0 ? targetShares : 0
  }

  private _calculateSellQuantity(
    symbol: string,
    positions: Map<string, InternalPosition>,
  ): number {
    const pos = positions.get(symbol)
    return pos && pos.quantity > 0 ? pos.quantity : 0
  }

  private _executeVirtualBuy(
    symbol: string,
    price: number,
    quantity: number,
    date: string,
    config: BacktestEngineConfig,
  ): VirtualOrder {
    const execPrice = price * (1 + config.slippage)
    const grossValue = quantity * execPrice
    const commission = grossValue * config.commissionRate

    return {
      id: `bt-${generateId()}`,
      symbol,
      direction: 'buy',
      price: Math.round(execPrice * 100) / 100,
      quantity,
      date,
      commission: Math.round(commission * 100) / 100,
    }
  }

  private _executeVirtualSell(
    symbol: string,
    price: number,
    quantity: number,
    date: string,
    config: BacktestEngineConfig,
  ): VirtualOrder {
    const execPrice = price * (1 - config.slippage)
    const grossValue = quantity * execPrice
    const commission = grossValue * config.commissionRate

    return {
      id: `bt-${generateId()}`,
      symbol,
      direction: 'sell',
      price: Math.round(execPrice * 100) / 100,
      quantity,
      date,
      commission: Math.round(commission * 100) / 100,
    }
  }

  // ============================================================
  // 组合估值
  // ============================================================

  private _calculatePortfolioValue(
    cash: number,
    positions: Map<string, InternalPosition>,
    date: string,
    quotesCache: Map<string, DailyQuotes>,
  ): number {
    let marketValue = 0
    for (const [symbol, pos] of positions) {
      const price = this._getPriceForDate(symbol, date, quotesCache) ?? pos.avgCost
      marketValue += pos.quantity * price
    }
    return cash + marketValue
  }

  private _buildVirtualPositions(
    positions: Map<string, InternalPosition>,
    endDate: string,
    quotesCache: Map<string, DailyQuotes>,
  ): VirtualPosition[] {
    return Array.from(positions.entries()).map(([symbol, pos]) => {
      const price = this._getPriceForDate(symbol, endDate, quotesCache) ?? pos.avgCost
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
  // 绩效指标
  // ============================================================

  private _calculateMetrics(
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
      return this._emptyMetrics(config)
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
    const backtestTrades = this._buildBacktestTrades(trades, config)
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
  private _buildBacktestTrades(
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
        const sellQty = Math.min(t.quantity, qty)
        if (sellQty <= 0) continue

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
    }

    return result
  }

  private _emptyResult(config: BacktestEngineConfig): BacktestEngineResult {
    return {
      trades: [],
      positions: [],
      dailyValues: [],
      metrics: this._emptyMetrics(config),
    }
  }

  private _emptyMetrics(_config: BacktestEngineConfig): BacktestResult {
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
}
