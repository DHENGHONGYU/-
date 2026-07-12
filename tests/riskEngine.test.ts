import { describe, expect, it, beforeEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db, generateId } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME, ORDER_DIRECTION } from '@/config/dbConfig'
import { checkOrderRisk } from '@/services/trading/riskEngine'
import type { DailyQuotes, KlineBar } from '@/data/types'

function buildQuotes(symbol: string, updatedAt = Date.now()): DailyQuotes {
  const history: KlineBar[] = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, '0')}`,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10000,
    amount: 1_000_000,
  }))
  return {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt,
  }
}

async function seedOrder(symbol: string, direction: 'buy' | 'sell', quantity: number, createdAt = Date.now()) {
  await db.put('orders', {
    id: generateId(),
    symbol,
    direction: direction === 'buy' ? ORDER_DIRECTION.buy : ORDER_DIRECTION.sell,
    quantity,
    price: 100,
    amount: quantity * 100,
    status: 'filled',
    accountType: 'paper',
    createdAt,
  })
}

describe('riskEngine', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.orders)
  })

  it('passes for a valid buy order with fresh data', async () => {
    await dataLayer.dailyQuotes.save(buildQuotes('000001.SZ'))

    const result = await checkOrderRisk({
      symbol: '000001.SZ',
      direction: 'buy',
      quantity: 100,
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.ok).toBe(true)
    expect(result.blocks).toHaveLength(0)
  })

  it('blocks when market data is stale', async () => {
    const staleTime = Date.now() - 100 * 60 * 60 * 1000
    await dataLayer.dailyQuotes.save(buildQuotes('000001.SZ', staleTime))

    const result = await checkOrderRisk({
      symbol: '000001.SZ',
      direction: 'buy',
      quantity: 100,
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.ok).toBe(false)
    expect(result.blocks.some((b) => b.includes('行情数据'))).toBe(true)
  })

  it('blocks when same symbol is in cooldown', async () => {
    await dataLayer.dailyQuotes.save(buildQuotes('000001.SZ'))
    await seedOrder('000001.SZ', 'buy', 100)

    const result = await checkOrderRisk({
      symbol: '000001.SZ',
      direction: 'buy',
      quantity: 100,
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.ok).toBe(false)
    expect(result.blocks.some((b) => b.includes('冷却期'))).toBe(true)
  })

  it('blocks when daily trade limit reached', async () => {
    await dataLayer.dailyQuotes.save(buildQuotes('000001.SZ'))
    for (let i = 0; i < 5; i++) {
      await seedOrder(`OTHER${i}.SZ`, 'buy', 100)
    }

    const result = await checkOrderRisk({
      symbol: '000001.SZ',
      direction: 'buy',
      quantity: 100,
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.ok).toBe(false)
    expect(result.blocks.some((b) => b.includes('交易次数'))).toBe(true)
  })

  it('blocks when buy would exceed single position limit', async () => {
    await dataLayer.dailyQuotes.save(buildQuotes('000001.SZ'))
    await seedOrder('000001.SZ', 'buy', 2000, Date.now() - 25 * 60 * 60 * 1000)

    const result = await checkOrderRisk({
      symbol: '000001.SZ',
      direction: 'buy',
      quantity: 10000,
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.ok).toBe(false)
    expect(result.blocks.some((b) => b.includes('单笔上限'))).toBe(true)
  })

  it('blocks when selling more than held', async () => {
    await dataLayer.dailyQuotes.save(buildQuotes('000001.SZ'))

    const result = await checkOrderRisk({
      symbol: '000001.SZ',
      direction: 'sell',
      quantity: 100,
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.ok).toBe(false)
    expect(result.blocks.some((b) => b.includes('超过当前持仓'))).toBe(true)
  })
})
