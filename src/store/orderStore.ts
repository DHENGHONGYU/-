/**
 * @module orderStore
 * @lifecycle @Global
 * @description 交易总账本 —— 订单域的唯一可信源（Single Source of Truth）。
 * 统一管理全部订单、当前持仓、已实现盈亏与未实现盈亏，
 * 取代原先分散在 positionStore / holdingsStore / orderStore 中的重复计算。
 *
 * @compliance
 * - isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 订阅 STORE_NAME.orders 频道，source 过滤防自激，100ms 去抖合并
 * - 保持 useOrderStore 导出名，向后兼容现有引用
 *
 * @see docs/《V9核心数据字典与类型定义（整合版）》.md
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { getLogger } from '@/lib/logger'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { refreshCoordinator } from '@/core/refreshCoordinator'
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  STORE_NAME,
  type EnvelopeAction,
} from '@/config/dbConfig'
import type { Order } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 单笔匹配的交易对明细 */
export interface MatchedTradePair {
  /** 盈亏百分比（基于买入价） */
  profitPct: number
  /** 买入日期 YYYY-MM-DD */
  buyDate: string
  /** 卖出日期 YYYY-MM-DD */
  sellDate: string
  /** 配对数量（股） */
  quantity: number
  /** 已实现盈亏金额（元） */
  realizedAmount: number
}

/** 按 symbol 聚合的交易对与持仓信息 */
export interface TradePair {
  /** 股票代码 */
  symbol: string
  /** 买入订单列表 */
  buyOrders: Order[]
  /** 卖出订单列表 */
  sellOrders: Order[]
  /** 买入总金额 */
  totalBuy: number
  /** 卖出总金额 */
  totalSell: number
  /** 已实现盈亏（金额，元） */
  realizedPnl: number
  /** 未平仓数量（股） */
  openPositions: number
  /** 未平仓平均成本价 */
  avgCostPrice: number
  /** 内部配对明细，用于 UI 曲线/月度聚合 */
  pairs: MatchedTradePair[]
}

/** 当前持仓项 */
export interface PositionItem {
  /** 股票代码 */
  symbol: string
  /** 持仓数量（股） */
  quantity: number
  /** 平均成本价 */
  avgCost: number
  /** 持仓市值（按成本价计） */
  costValue: number
  /** 持仓方向 */
  direction: 'buy' | 'sell'
  /** 首次买入时间戳 */
  firstBuyAt: number
  /** 最近一次变动时间戳 */
  lastChangedAt: number
}

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

/**
 * OrderStore 状态接口 —— 订单域唯一可信源。
 * 包含订单原始数据、派生持仓、派生盈亏汇总。
 */
export interface OrderState {
  // ---- 核心数据 ----
  /** 全部订单列表（原始数据） */
  orders: Order[]
  /** 当前持仓（按 symbol 聚合，净持仓 > 0 的标的） */
  positions: PositionItem[]
  /** 已实现盈亏总金额（元） */
  realizedPnL: number
  /** 未实现盈亏总金额（元）—— 无行情时为 0 */
  unrealizedPnL: number
  /** 按 symbol 聚合的交易对（派生） */
  tradePairs: TradePair[]
  /** 盈亏汇总（派生） */
  pnlSummary: PnLSummary
  /** 风险指标（派生） */
  riskMetrics: RiskMetrics

  // ---- 加载状态 ----
  /** 是否正在加载（首次加载） */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否正在刷新中（用于并发锁） */
  isRefreshing: boolean
  /** 最后更新时间戳 */
  lastUpdated: number

  // ---- Actions ----
  /**
   * 从 dataLayer 全量刷新订单、持仓与盈亏数据。
   * 具备 isRefreshing 并发锁，失败时回滚到旧快照。
   */
  refresh: () => Promise<void>
  /**
   * 内部刷新方法，实际执行刷新逻辑（由 refresh() 和 coordinator 调用）。
   */
  _doRefresh: () => Promise<void>
  /**
   * 新增订单。通过 dataBridge.forward() 走信封协议写入，
   * 写入后由订阅机制异步触发刷新。
   * @param order - 订单数据（不含 id 和 createdAt，由系统生成）
   * @returns 写入结果，成功时包含完整订单
   */
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<{ success: boolean; data?: Order; error?: string }>
  /**
   * 更新订单。通过 dataBridge.forward() 走信封协议。
   * @param id - 订单 ID
   * @param updates - 要更新的字段
   */
  updateOrder: (id: string, updates: Partial<Order>) => Promise<{ success: boolean; error?: string }>
  /**
   * 删除订单。通过 dataBridge.forward() 走信封协议。
   * @param id - 订单 ID
   */
  deleteOrder: (id: string) => Promise<{ success: boolean; error?: string }>
  /**
   * 获取指定股票的持仓信息（selector 风格辅助函数）。
   * @param symbol - 股票代码
   * @returns 持仓项，若不存在则返回 null
   */
  getPosition: (symbol: string) => PositionItem | null
  /**
   * 重置 store 到初始空状态。
   */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  OrderState,
  'refresh' | '_doRefresh' | 'addOrder' | 'updateOrder' | 'deleteOrder' | 'getPosition' | 'reset'
> = {
  orders: [],
  positions: [],
  realizedPnL: 0,
  unrealizedPnL: 0,
  tradePairs: [],
  pnlSummary: {
    totalRealizedPnl: 0,
    totalUnrealizedPnl: 0,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    profitTrades: 0,
    lossTrades: 0,
    monthlyPnL: [],
    dailyCurve: [],
  },
  riskMetrics: {
    var95: 0,
    varLevel: 'low',
    maxDrawdown: 0,
    volatility: 0,
    sharpeRatio: 0,
    betaEstimate: 0,
    concentration: 0,
    alerts: [],
  },
  loading: true,
  error: null,
  isRefreshing: false,
  lastUpdated: 0,
}

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

/** 时间戳转日期字符串 YYYY-MM-DD */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/** 生成 traceId */
function createTraceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ============================================================
// 共享计算函数 —— 纯函数，便于测试与复用
// ============================================================

/**
 * 按 symbol 对订单进行 FIFO 配对，计算已实现盈亏与未平仓头寸。
 *
 * @param orders - 订单列表
 * @returns 按 symbol 聚合的交易对数组
 *
 * @remarks
 * 配对算法：
 * 1. 按 symbol 分组
 * 2. 每组内按 createdAt 升序排列
 * 3. 买单入队，卖单从队头取买单进行 FIFO 配对
 * 4. 未配对的买单累积为当前持仓，计算平均成本价
 */
export function buildTradePairs(orders: Order[]): TradePair[] {
  const bySymbol = new Map<string, Order[]>()

  for (const order of orders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  const tradePairs: TradePair[] = []

  for (const [symbol, symOrders] of bySymbol) {
    const buyOrders = symOrders.filter((o) => o.direction === 'buy')
    const sellOrders = symOrders.filter((o) => o.direction === 'sell')
    const totalBuy = buyOrders.reduce((sum, o) => sum + o.amount, 0)
    const totalSell = sellOrders.reduce((sum, o) => sum + o.amount, 0)

    const sorted = [...symOrders].sort((a, b) => a.createdAt - b.createdAt)

    // FIFO 配对队列：每个元素为 { price, quantity, createdAt }
    interface BuyQueueItem {
      price: number
      quantity: number
      createdAt: number
      amount: number
    }
    const buyQueue: BuyQueueItem[] = []
    const pairs: MatchedTradePair[] = []
    let realizedPnl = 0

    for (const order of sorted) {
      if (order.direction === 'buy') {
        buyQueue.push({
          price: order.price,
          quantity: order.quantity,
          createdAt: order.createdAt,
          amount: order.amount,
        })
      } else if (order.direction === 'sell' && buyQueue.length > 0) {
        // 卖单与买单 FIFO 配对
        let remainingQty = order.quantity

        while (remainingQty > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]!
          const matchQty = Math.min(remainingQty, buy.quantity)
          const buyAmount = (matchQty / buy.quantity) * buy.amount
          const sellAmount = matchQty * order.price
          const realized = sellAmount - buyAmount

          pairs.push({
            profitPct: buy.price > 0 ? round2(((order.price - buy.price) / buy.price) * 100) : 0,
            buyDate: formatDate(buy.createdAt),
            sellDate: formatDate(order.createdAt),
            quantity: matchQty,
            realizedAmount: round2(realized),
          })

          realizedPnl += realized
          remainingQty -= matchQty

          if (matchQty >= buy.quantity) {
            buyQueue.shift()
          } else {
            buy.quantity -= matchQty
            buy.amount -= buyAmount
          }
        }
      }
    }

    // 计算未平仓持仓
    const openPositions = buyQueue.reduce((sum, b) => sum + b.quantity, 0)
    const totalOpenCost = buyQueue.reduce((sum, b) => sum + b.amount, 0)
    const avgCostPrice = openPositions > 0 ? round2(totalOpenCost / openPositions) : 0

    tradePairs.push({
      symbol,
      buyOrders,
      sellOrders,
      totalBuy: round2(totalBuy),
      totalSell: round2(totalSell),
      realizedPnl: round2(realizedPnl),
      openPositions,
      avgCostPrice,
      pairs,
    })
  }

  return tradePairs
}

/**
 * 从交易对结果计算盈亏汇总。
 *
 * @param tradePairs - 交易对数组
 * @returns 盈亏汇总指标
 */
export function computePnLSummary(tradePairs: TradePair[]): PnLSummary {
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
      ? 999
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

/**
 * 从交易对结果派生出当前持仓列表。
 *
 * @param tradePairs - 交易对数组
 * @returns 净持仓 > 0 的持仓项数组，按市值降序
 */
export function buildPositions(tradePairs: TradePair[]): PositionItem[] {
  const positions: PositionItem[] = []

  for (const tp of tradePairs) {
    if (tp.openPositions <= 0) continue

    // 找出首次买入和最近一次变动时间
    const allOrders = [...tp.buyOrders, ...tp.sellOrders]
    const firstBuy = tp.buyOrders.reduce(
      (earliest, o) => (o.createdAt < earliest ? o.createdAt : earliest),
      Infinity,
    )
    const lastChanged = allOrders.reduce(
      (latest, o) => (o.createdAt > latest ? o.createdAt : latest),
      0,
    )

    positions.push({
      symbol: tp.symbol,
      quantity: tp.openPositions,
      avgCost: tp.avgCostPrice,
      costValue: round2(tp.openPositions * tp.avgCostPrice),
      direction: 'buy',
      firstBuyAt: isFinite(firstBuy) ? firstBuy : 0,
      lastChangedAt: lastChanged,
    })
  }

  // 按成本市值降序排列
  positions.sort((a, b) => b.costValue - a.costValue)
  return positions
}

/**
 * 从交易对与盈亏汇总估算风险指标。
 *
 * @remarks
 * 由于暂无实时行情，使用已实现盈亏曲线估算波动率、回撤、VaR 等风险指标。
 * 后续接入每日净值后可替换为基于净值的计算。
 */
export function computeRiskMetrics(
  tradePairs: TradePair[],
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
  const volatility = round2(std * Math.sqrt(252))
  const sharpeRatio = volatility > 0 ? round2((mean * 252) / volatility) : 0

  // 历史模拟法 VaR(95%)
  const var95 = round2(mean - 1.645 * std)
  let varLevel: 'high' | 'medium' | 'low' = 'low'
  if (var95 < -5) {
    varLevel = 'high'
  } else if (var95 < -2) {
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
  if (concentration > 50) {
    alerts.push('持仓集中度超过 50%，建议分散风险')
  }
  if (sharpeRatio < 0) {
    alerts.push('夏普比率为负，组合风险收益比不佳')
  }
  if (varLevel === 'high') {
    alerts.push('VaR(95%) 处于高风险区间')
  }
  if (maxDrawdown > 20) {
    alerts.push('最大回撤超过 20%')
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

// ============================================================
// Store
// ============================================================

/**
 * 订单域全局 Store —— 交易总账本。
 * 统一管理订单、持仓、盈亏，作为订单域唯一可信源。
 */
export const useOrderStore = create<OrderState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ----------------------------------------------------------
    // refresh —— 全量刷新
    // ----------------------------------------------------------

  /**
   * 从 dataLayer 全量刷新订单数据，并重新计算持仓与盈亏。
   *
   * @remarks
   * - 具备 isRefreshing 并发锁，防止重复调用
   * - 失败时保留旧数据快照（仅更新 error / loading 状态）
   * - 同时更新 positions、realizedPnL、unrealizedPnL 等派生数据
   */
  refresh: async () => {
    // 使用 RefreshCoordinator 协调跨 Store 刷新
    // isRefreshing 时不再直接 return，而是 await 正在进行的刷新 Promise
    // 这样 disciplineStore 调用 orderStore.getState().refresh() 时，
    // 如果 orderStore 正在刷新，会等待完成后使用最新数据
    await refreshCoordinator.coordinateRefresh('orderStore', () =>
      get()._doRefresh(),
    )
  },

  /**
   * 内部刷新方法，实际执行刷新逻辑。
   * 由 refresh() 和 RefreshCoordinator 共同调用。
   */
  _doRefresh: async () => {
    const state = get()

    // 保存旧数据快照，用于失败回滚
    const snapshot = {
      orders: state.orders,
      positions: state.positions,
      realizedPnL: state.realizedPnL,
      unrealizedPnL: state.unrealizedPnL,
      tradePairs: state.tradePairs,
      pnlSummary: state.pnlSummary,
      riskMetrics: state.riskMetrics,
      lastUpdated: state.lastUpdated,
    }

    set({ isRefreshing: true, loading: state.orders.length === 0, error: null })

    try {
      logger.info('[orderStore] refresh 开始')
      const orders = await dataLayer.orders.list()

      // 计算派生数据
      const tradePairs = buildTradePairs(orders)
      const pnlSummary = computePnLSummary(tradePairs)
      const positions = buildPositions(tradePairs)
      const riskMetrics = computeRiskMetrics(tradePairs, pnlSummary, positions)

      set({
        orders,
        positions,
        tradePairs,
        pnlSummary,
        riskMetrics,
        realizedPnL: pnlSummary.totalRealizedPnl,
        unrealizedPnL: pnlSummary.totalUnrealizedPnl,
        loading: false,
        error: null,
        isRefreshing: false,
        lastUpdated: Date.now(),
      })

      logger.info('[orderStore] refresh 完成', {
        orders: orders.length,
        positions: positions.length,
        realizedPnL: pnlSummary.totalRealizedPnl,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] refresh 失败，回滚到旧快照', { error: message })

      // 失败回滚：保留旧数据，仅更新错误和加载状态
      set({
        ...snapshot,
        loading: false,
        error: message,
        isRefreshing: false,
      })
    }
  },

  // ----------------------------------------------------------
  // addOrder —— 新增订单
  // ----------------------------------------------------------

  /**
   * 新增订单。通过 dataBridge.forward() 走信封协议写入 DB，
   * 写入成功后由 STORE_NAME.orders 频道订阅机制异步触发 refresh。
   *
   * @param order - 订单数据（不含 id 和 createdAt）
   * @returns 写入结果，成功时 data 为完整订单（含 id/createdAt）
   */
  addOrder: async (order) => {
    logger.info('[orderStore] addOrder', { symbol: order.symbol, direction: order.direction })

    try {
      const fullOrder: Order = {
        ...order,
        id: createTraceId('ord'),
        createdAt: Date.now(),
      }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.orderstore,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertOrder,
          traceId: createTraceId('os-add'),
        },
        fullOrder,
      )

      await dataBridge.forward(envelope)

      logger.info('[orderStore] addOrder 成功', { id: fullOrder.id, symbol: fullOrder.symbol })
      withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'add', id: fullOrder.id, symbol: fullOrder.symbol })
      return { success: true, data: fullOrder }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] addOrder 失败', { error: message, symbol: order.symbol })
      return { success: false, error: message }
    }
  },

  // ----------------------------------------------------------
  // updateOrder —— 更新订单
  // ----------------------------------------------------------

  /**
   * 更新订单。通过 dataBridge.forward() 走信封协议。
   *
   * @param id - 订单 ID
   * @param updates - 要更新的字段（不能修改 id 和 createdAt）
   */
  updateOrder: async (id, updates) => {
    logger.info('[orderStore] updateOrder', { id, fields: Object.keys(updates) })

    try {
      const payload = { id, ...updates }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.orderstore,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateOrder,
          traceId: createTraceId('os-upd'),
        },
        payload,
      )

      await dataBridge.forward(envelope)

      logger.info('[orderStore] updateOrder 成功', { id })
      withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'update', id })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] updateOrder 失败', { error: message, id })
      return { success: false, error: message }
    }
  },

  // ----------------------------------------------------------
  // deleteOrder —— 删除订单
  // ----------------------------------------------------------

  /**
   * 删除订单。通过 dataBridge.forward() 走信封协议。
   *
   * @param id - 订单 ID
   */
  deleteOrder: async (id) => {
    logger.info('[orderStore] deleteOrder', { id })

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.orderstore,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.deleteOrder,
          traceId: createTraceId('os-del'),
        },
        { id },
      )

      await dataBridge.forward(envelope)

      logger.info('[orderStore] deleteOrder 成功', { id })
      withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'delete', id })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] deleteOrder 失败', { error: message, id })
      return { success: false, error: message }
    }
  },

  // ----------------------------------------------------------
  // getPosition —— 单标的持仓 selector
  // ----------------------------------------------------------

  /**
   * 获取指定股票的持仓信息。
   *
   * @param symbol - 股票代码
   * @returns 持仓项，若不存在或已清仓则返回 null
   */
  getPosition: (symbol) => {
    const { positions } = get()
    return positions.find((p) => p.symbol === symbol) ?? null
  },

  // ----------------------------------------------------------
  // reset —— 重置
  // ----------------------------------------------------------

  /**
   * 重置 store 到初始空状态。
   * 通常用于登出/切换账户等场景。
   */
  reset: () => {
    logger.info('[orderStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'reset' })
  },
}))
)

// ============================================================
// DataBridge 订阅生命周期
// ============================================================

/**
 * 本模块 source 标识，用于订阅时 source 过滤，防止自激（自己发的事件自己又处理）。
 *
 * @remarks
 * 订阅 STORE_NAME.orders 频道，source 为 MODULE_ID.orderstore。
 * 写操作发出的事件 meta.source === 此值，订阅回调中据此过滤跳过。
 */
const ORDER_STORE_SOURCE = MODULE_ID.orderstore

/** 去抖合并窗口（毫秒）：短时间内多次变更合并为一次 refresh */
const DEBOUNCE_MS = 100

let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 需要触发刷新的订单相关 action 集合 */
const _ORDER_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
  ENVELOPE_ACTION.deleteOrder,
  ENVELOPE_ACTION.tradeActionExecuted,
])

/**
 * 去抖执行 refresh，100ms 内多次调用合并为一次。
 *
 * @param envelope - 触发去抖的信封（用于日志追踪）
 */
function _debouncedRefresh(envelope: StandardEnvelope): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    logger.info('[orderStore] Debounced refresh triggered', {
      traceId: envelope.meta.traceId,
      action: envelope.meta.action,
      source: envelope.meta.source,
    })
    // 通过 coordinator 协调刷新，确保跨 Store 数据一致性
    void refreshCoordinator.coordinateRefresh('orderStore', () =>
      useOrderStore.getState()._doRefresh(),
    )
  }, DEBOUNCE_MS)
}

/**
 * 初始化 OrderStore 的 DataBridge 订阅。
 *
 * 订阅 STORE_NAME.orders 频道，监听以下 action 并触发去抖刷新：
 * - insertOrder
 * - updateOrder
 * - deleteOrder
 * - tradeActionExecuted
 *
 * 同时做 source 过滤：跳过 source 为 'orderstore' 的事件，防止自激。
 *
 * @returns 清理函数，调用后取消所有订阅并清理定时器
 *
 * @example
 * ```ts
 * // 在 App 根组件中初始化
 * useEffect(() => {
 *   const cleanup = initOrderStoreSubscriptions()
 *   return cleanup
 * }, [])
 * ```
 */
export function initOrderStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[orderStore] Subscriptions already initialized, skipping')
    return _unsubscribeOrders
  }

  _unsubscribeOrders = dataBridge.subscribe(
    STORE_NAME.orders,
    (envelope) => {
      // priority: high — 交易执行需即时响应

      // source 过滤：跳过本模块发出的事件，防止自激
      if (envelope.meta.source === ORDER_STORE_SOURCE) {
        return
      }

      if (_ORDER_CHANGE_ACTIONS.has(envelope.meta.action)) {
        logger.info('[orderStore] DataBridge orders event, scheduling debounced refresh', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
          source: envelope.meta.source,
        })
        _debouncedRefresh(envelope)
      }
    },
  )

  logger.info('[orderStore] DataBridge orders subscriptions initialized')

  /** 清理函数：取消订阅 + 清除去抖定时器 */
  return () => {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    _unsubscribeOrders?.()
    _unsubscribeOrders = null
    logger.info('[orderStore] DataBridge subscriptions destroyed')
  }
}
