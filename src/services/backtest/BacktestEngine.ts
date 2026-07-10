/**
 * @module BacktestEngine
 * @description 策略回测引擎基座（编排器）。
 *
 * 从原 722 行温和拆分为 3 文件（PR-6 阶段 3.2，2026-07-08）：
 * - BacktestEngine.ts（本文件）：核心编排器，保留 run() + 仓位计算 + 虚拟交易执行
 * - backtestEventLoader.ts：事件加载/行情/日期域（8 个函数）
 * - backtestMetrics.ts：绩效指标/交易转换/空结果域（4 个函数）
 *
 * 拆分原则：
 * - 公共 API 完全向后兼容（index.ts 导出签名零变更）
 * - 行为等价性通过 28 个测试（含 6 个契约测试）锁定
 * - 内部类型 BacktestEvent 迁至 eventLoader，InternalPosition 迁至 metrics
 *
 * 核心职责：
 * - 接收回测配置（策略、日期范围、初始资金、手续费率、滑点）
 * - 在日期范围内逐日/逐信号执行策略
 * - 生成虚拟订单并跟踪持仓
 * - 委托 backtestMetrics 计算绩效指标
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
import type { DailyQuotes } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { calculatePosition } from '@/services/trading/positionSizer'
import type { BacktestStrategy, BacktestResult } from '@/types/modules/backtest.types'
import {
  loadBacktestEvents,
  groupEventsByDate,
  preloadQuotes,
  getPriceForDate,
  generateDateRange,
  type BacktestEvent,
} from './backtestEventLoader'
import {
  calculateBacktestMetrics,
  buildVirtualPositions,
  createEmptyResult,
  type InternalPosition,
} from './backtestMetrics'

const logger = getLogger()

// ============================================================
// 公共类型定义（保持向后兼容，被 index.ts re-export）
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

// ============================================================
// 回测引擎（编排器）
// ============================================================

/**
 * BacktestEngine
 */
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
    const events = await loadBacktestEvents(config)
    if (events.length === 0) {
      logger.warn('[BacktestEngine] 未找到任何信号/订单，返回空结果')
      return createEmptyResult(config)
    }

    // 2. 预加载行情数据
    const quotesCache = await preloadQuotes(events)

    // 3. 初始化状态
    let cash = config.initialCapital
    const positions = new Map<string, InternalPosition>()
    const trades: VirtualOrder[] = []
    const dailyValues: { date: string; totalValue: number; cash: number }[] = []

    // 4. 按日期分组事件
    const eventsByDate = groupEventsByDate(events)

    // 5. 生成日期序列并逐日执行
    const dateList = generateDateRange(config.startDate, config.endDate)

    for (const date of dateList) {
      const dayEvents = eventsByDate.get(date) ?? []

      // 先处理卖出，释放现金
      const sellEvents = dayEvents.filter((e) => e.direction === 'sell')
      const buyEvents = dayEvents.filter((e) => e.direction === 'buy')

      cash = this._processSellEvents(sellEvents, date, quotesCache, positions, cash, trades, config)
      cash = this._processBuyEvents(buyEvents, date, quotesCache, positions, cash, trades, config)

      // 6. 记录当日收盘净值
      const dayTotalValue = this._calculatePortfolioValue(cash, positions, date, quotesCache)
      dailyValues.push({ date, totalValue: dayTotalValue, cash })
    }

    // 7. 计算绩效指标
    const metrics = calculateBacktestMetrics(dailyValues, trades, config)

    // 8. 构建最终持仓
    const virtualPositions = buildVirtualPositions(positions, config.endDate, quotesCache)

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

  /**
   * 逐笔处理卖出事件。将价格/数量校验封装到独立方法，避免 run() 内重复 if 条件。
   */
  private _processSellEvents(
    sellEvents: BacktestEvent[],
    date: string,
    quotesCache: Map<string, DailyQuotes>,
    positions: Map<string, InternalPosition>,
    cash: number,
    trades: VirtualOrder[],
    config: BacktestEngineConfig,
  ): number {
    for (const evt of sellEvents) {
      const price = getPriceForDate(evt.symbol, date, quotesCache) ?? evt.price
      if (price <= 0) continue

      const qty = this._calculateSellQuantity(evt.symbol, positions)
      if (qty <= 0) continue

      const order = this._executeVirtualSell(evt.symbol, price, qty, date, config)
      trades.push(order)
      cash = cash + order.quantity * order.price - order.commission
      this._updatePositionAfterSell(positions, evt.symbol, order.quantity)
    }
    return cash
  }

  /**
   * 逐笔处理买入事件。将价格/数量校验封装到独立方法，避免 run() 内重复 if 条件。
   */
  private _processBuyEvents(
    buyEvents: BacktestEvent[],
    date: string,
    quotesCache: Map<string, DailyQuotes>,
    positions: Map<string, InternalPosition>,
    cash: number,
    trades: VirtualOrder[],
    config: BacktestEngineConfig,
  ): number {
    for (const evt of buyEvents) {
      const price = getPriceForDate(evt.symbol, date, quotesCache) ?? evt.price
      if (price <= 0) continue

      const portfolioValue = this._calculatePortfolioValue(cash, positions, date, quotesCache)
      const qty = this._calculatePositionSize(evt, cash, portfolioValue, positions, config)
      if (qty <= 0) continue

      const order = this._executeVirtualBuy(evt.symbol, price, qty, date, config)
      const totalCost = order.quantity * order.price + order.commission
      if (totalCost > cash) continue

      trades.push(order)
      cash = cash - totalCost
      this._updatePositionAfterBuy(positions, evt.symbol, order.quantity, order.price)
    }
    return cash
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

  /**
   * 卖出后更新持仓（减仓或清仓）。
   */
  private _updatePositionAfterSell(
    positions: Map<string, InternalPosition>,
    symbol: string,
    soldQuantity: number,
  ): void {
    const pos = positions.get(symbol)
    if (!pos) return

    const remaining = pos.quantity - soldQuantity
    if (remaining <= 0) {
      positions.delete(symbol)
    } else {
      positions.set(symbol, { quantity: remaining, avgCost: pos.avgCost })
    }
  }

  /**
   * 买入后更新持仓（加仓并重新计算平均成本）。
   */
  private _updatePositionAfterBuy(
    positions: Map<string, InternalPosition>,
    symbol: string,
    boughtQuantity: number,
    price: number,
  ): void {
    const pos = positions.get(symbol) ?? { quantity: 0, avgCost: 0 }
    const newQty = pos.quantity + boughtQuantity
    const newAvgCost =
      newQty > 0
        ? (pos.quantity * pos.avgCost + boughtQuantity * price) / newQty
        : 0
    positions.set(symbol, { quantity: newQty, avgCost: newAvgCost })
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
      const price = getPriceForDate(symbol, date, quotesCache) ?? pos.avgCost
      marketValue += pos.quantity * price
    }
    return cash + marketValue
  }
}
