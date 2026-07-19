/**
 * @module positionComputer
 * @description 持仓计算模块 - 纯函数集合
 * 
 * 职责：
 * - 从订单列表构建交易对（FIFO 配对）
 * - 计算当前持仓（未平仓头寸）
 * - 计算已实现盈亏
 * 
 * 所有函数均为纯函数，便于测试和复用。
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import type { Order } from '@/data/types'
import type { TradePair } from '@/services/trading/tradeReviewAI.types'

// 重新导出规范 TradePair 类型，便于消费方从本模块直接导入
export type { TradePair }

// ============================================================
// 类型定义
// ============================================================

/** 单笔匹配的交易对明细（扩展规范 TradePair，增加持仓计算特有字段） */
export interface MatchedTradePair extends TradePair {
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
export interface SymbolTradePair {
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

// ============================================================
// 工具函数
// ============================================================

/** 保留两位小数 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 时间戳转日期字符串 YYYY-MM-DD */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/** 计算持仓天数（两个时间戳之间的自然日差，向上取整） */
function computeHoldDays(buyTimestamp: number, sellTimestamp: number): number {
  return Math.ceil((sellTimestamp - buyTimestamp) / (24 * 60 * 60 * 1000))
}

// ============================================================
// 核心计算函数
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

interface BuyQueueItem {
  id: string
  price: number
  quantity: number
  createdAt: number
  amount: number
}

function pairOneSymbol(sorted: Order[]): {
  pairs: MatchedTradePair[]
  realizedPnl: number
  openPositions: number
  avgCostPrice: number
} {
  const buyQueue: BuyQueueItem[] = []
  const pairs: MatchedTradePair[] = []
  let realizedPnl = 0

  for (const order of sorted) {
    if (order.direction === 'buy') {
      buyQueue.push({
        id: order.id,
        price: order.price,
        quantity: order.quantity,
        createdAt: order.createdAt,
        amount: order.amount,
      })
      continue
    }
    if (order.direction === 'sell' && buyQueue.length > 0) {
      const matchResult = matchSellWithBuys(order, buyQueue)
      pairs.push(...matchResult.pairs)
      realizedPnl += matchResult.realizedPnl
    }
  }

  const openPositions = buyQueue.reduce((sum, b) => sum + b.quantity, 0)
  const totalOpenCost = buyQueue.reduce((sum, b) => sum + b.amount, 0)
  const avgCostPrice = openPositions > 0 ? round2(totalOpenCost / openPositions) : 0
  return { pairs, realizedPnl, openPositions, avgCostPrice }
}

/**
 * buildTradePairs
 * @param orders
 * @returns SymbolTradePair[]
 */
export function buildTradePairs(orders: Order[]): SymbolTradePair[] {
  const bySymbol = new Map<string, Order[]>()

  for (const order of orders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  const tradePairs: SymbolTradePair[] = []

  for (const [symbol, symOrders] of bySymbol) {
    const buyOrders = symOrders.filter((o) => o.direction === 'buy')
    const sellOrders = symOrders.filter((o) => o.direction === 'sell')
    const totalBuy = buyOrders.reduce((sum, o) => sum + o.amount, 0)
    const totalSell = sellOrders.reduce((sum, o) => sum + o.amount, 0)

    const sorted = [...symOrders].sort((a, b) => a.createdAt - b.createdAt)
    const { pairs, realizedPnl, openPositions, avgCostPrice } = pairOneSymbol(sorted)

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

interface MatchResult {
  pairs: MatchedTradePair[]
  realizedPnl: number
}

/**
 * 将卖单与买单队列进行 FIFO 配对
 */
function matchSellWithBuys(
  sellOrder: Order,
  buyQueue: BuyQueueItem[],
): MatchResult {
  const pairs: MatchedTradePair[] = []
  let realizedPnl = 0
  let remainingQty = sellOrder.quantity

  while (remainingQty > 0 && buyQueue.length > 0) {
    const buy = buyQueue[0]!
    const matchQty = Math.min(remainingQty, buy.quantity)
    const buyAmount = (matchQty / buy.quantity) * buy.amount
    const sellAmount = matchQty * sellOrder.price
    const realized = sellAmount - buyAmount

    pairs.push({
      buyId: buy.id ?? '',
      sellId: sellOrder.id ?? '',
      profitPct: buy.price > 0 ? round2(((sellOrder.price - buy.price) / buy.price) * 100) : 0,
      holdDays: computeHoldDays(buy.createdAt, sellOrder.createdAt),
      buyDate: formatDate(buy.createdAt),
      sellDate: formatDate(sellOrder.createdAt),
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

  return { pairs, realizedPnl }
}

/**
 * 从交易对结果派生出当前持仓列表。
 *
 * @param tradePairs - 交易对数组
 * @returns 净持仓 > 0 的持仓项数组，按市值降序
 */
export function buildPositions(tradePairs: SymbolTradePair[]): PositionItem[] {
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
