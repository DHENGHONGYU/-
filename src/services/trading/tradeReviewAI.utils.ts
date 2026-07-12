/**
 * 交易复盘 AI 工具函数
 *
 * 提供共享的辅助函数，避免循环依赖
 */

import type { Order } from '@/data/types'
import type { TradePair } from './tradeReviewAI.types'

function createTradePair(sellOrder: Order, buys: Order[]): TradePair | null {
  if (buys.length === 0) return null
  const buy = buys.shift()!
  const profitPct = ((sellOrder.price - buy.price) / buy.price) * 100
  const holdDays = Math.round((sellOrder.createdAt - buy.createdAt) / (24 * 60 * 60 * 1000))
  return {
    buyId: buy.id,
    sellId: sellOrder.id,
    profitPct: Math.round(profitPct * 100) / 100,
    holdDays,
  }
}

/**
 * 将订单配对为交易对（买→卖）
 */
function pairOneSymbolOrders(symOrders: Order[]): TradePair[] {
  const pairs: TradePair[] = []
  const buys: Order[] = []
  for (const order of symOrders) {
    if (order.direction === 'buy') {
      buys.push(order)
      continue
    }
    const pair = createTradePair(order, buys)
    if (pair) pairs.push(pair)
  }
  return pairs
}

export function buildTradePairs(orders: Order[]): TradePair[] {
  const pairs: TradePair[] = []
  const bySymbol = new Map<string, Order[]>()

  for (const order of orders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  for (const [, symOrders] of bySymbol) {
    symOrders.sort((a, b) => a.createdAt - b.createdAt)
    pairs.push(...pairOneSymbolOrders(symOrders))
  }

  return pairs
}
