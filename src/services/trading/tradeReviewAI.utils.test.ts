import { describe, it, expect } from 'vitest'
import { buildTradePairs } from './tradeReviewAI.utils'
import type { Order } from '@/data/types'

function makeOrder(overrides: Partial<Order> & Record<string, unknown> = {}): Order {
  return {
    id: `order_${Math.random().toString(36).slice(2, 8)}`,
    symbol: '600519',
    direction: 'buy',
    quantity: 100,
    price: 100,
    amount: 10000,
    status: 'filled',
    accountType: 'paper',
    createdAt: Date.now() - 86400000,
    ...overrides,
  }
}

describe('tradeReviewAI.utils', () => {
  describe('buildTradePairs', () => {
    it('空订单应返回空数组', () => {
      const pairs = buildTradePairs([])
      expect(pairs).toEqual([])
    })

    it('单笔买入无卖出应返回空数组', () => {
      const orders = [makeOrder({ direction: 'buy' })]
      const pairs = buildTradePairs(orders)
      expect(pairs).toEqual([])
    })

    it('单笔买入+卖出应生成一个交易对', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 110, createdAt: now }),
      ]
      const pairs = buildTradePairs(orders)

      expect(pairs).toHaveLength(1)
      expect(pairs[0]!.buyId).toBe('b1')
      expect(pairs[0]!.sellId).toBe('s1')
      expect(pairs[0]!.profitPct).toBe(10)
      expect(pairs[0]!.holdDays).toBe(1)
    })

    it('多笔交易应按时间顺序配对', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 * 2 }),
        makeOrder({ id: 'b2', symbol: 'A', direction: 'buy', price: 105, createdAt: now - 86400000 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 110, createdAt: now - 86400000 * 1.5 }),
        makeOrder({ id: 's2', symbol: 'A', direction: 'sell', price: 115, createdAt: now }),
      ]
      const pairs = buildTradePairs(orders)

      expect(pairs).toHaveLength(2)
      expect(pairs[0]!.buyId).toBe('b1')
      expect(pairs[0]!.sellId).toBe('s1')
      expect(pairs[1]!.buyId).toBe('b2')
      expect(pairs[1]!.sellId).toBe('s2')
    })

    it('不同标的应独立配对', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 }),
        makeOrder({ id: 'b2', symbol: 'B', direction: 'buy', price: 200, createdAt: now - 86400000 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 110, createdAt: now }),
        makeOrder({ id: 's2', symbol: 'B', direction: 'sell', price: 220, createdAt: now }),
      ]
      const pairs = buildTradePairs(orders)

      expect(pairs).toHaveLength(2)
      const symbolA = pairs.find((p) => p.buyId === 'b1')
      const symbolB = pairs.find((p) => p.buyId === 'b2')
      expect(symbolA).toBeDefined()
      expect(symbolB).toBeDefined()
    })

    it('亏损交易应计算负收益率', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 90, createdAt: now }),
      ]
      const pairs = buildTradePairs(orders)

      expect(pairs).toHaveLength(1)
      expect(pairs[0]!.profitPct).toBe(-10)
    })

    it('持有天数应正确计算', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 * 5 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 110, createdAt: now }),
      ]
      const pairs = buildTradePairs(orders)

      expect(pairs).toHaveLength(1)
      expect(pairs[0]!.holdDays).toBe(5)
    })
  })
})
