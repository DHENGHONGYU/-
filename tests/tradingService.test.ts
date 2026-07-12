import { describe, expect, it, beforeEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { db, generateId } from '@/data/db'
import {
  adviseForStock,
  createBuyOrder,
  createSellOrder,
  getOrders,
  getWatchlistStocks,
  scanWatchingSignals,
} from '@/services/trading/tradingService'
import { ORDER_DIRECTION, STORE_NAME } from '@/config/dbConfig'
import type { DailyQuotes, KlineBar, Order, Stock } from '@/data/types'

function buildHistory(count: number, factory: (i: number) => KlineBar): KlineBar[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

function buildQuotes(symbol: string, history: KlineBar[], updatedAt = Date.now()): DailyQuotes {
  return {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt,
  }
}

async function seedStock(
  symbol: string,
  status: 'candidate' | 'watching' = 'watching',
  price?: number,
): Promise<Stock> {
  await dataLayer.stocks.add({
    symbol,
    name: `${symbol} 测试`,
    researchStatus: status,
    source: 'manual',
    price,
  })
  return (await dataLayer.stocks.get(symbol))!
}

async function seedDipQuotes(symbol: string): Promise<void> {
  const history = buildHistory(40, (i) => {
    const close = i < 39 ? 100 + i * 0.1 : 85
    return {
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 0.5,
      low: close - 1,
      close,
      volume: 10000,
      amount: 10000 * close,
    }
  })
  await dataLayer.dailyQuotes.save(buildQuotes(symbol, history))
}

async function seedPivotQuotes(symbol: string): Promise<void> {
  const history = buildHistory(40, (i) => {
    const close = 50 + i * 0.5
    const volume = i === 39 ? 25000 : 10000
    return {
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      open: close - 0.3,
      high: close + 0.3,
      low: close - 0.3,
      close,
      volume,
      amount: volume * close,
    }
  })
  await dataLayer.dailyQuotes.save(buildQuotes(symbol, history))
}

async function seedProfitTakingQuotes(symbol: string): Promise<void> {
  const history = buildHistory(40, (i) => {
    const close = i < 39 ? 100 + i * 0.2 : 140
    return {
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 10000,
      amount: 10000 * close,
    }
  })
  await dataLayer.dailyQuotes.save(buildQuotes(symbol, history))
}

async function seedOrder(
  symbol: string,
  direction: 'buy' | 'sell',
  quantity: number,
  price = 100,
  createdAt = Date.now(),
): Promise<Order> {
  // 使用 db.put 直接写入，以便在测试中控制 createdAt（dataLayer.orders.add 会强制使用 now()）
  const order: Order = {
    id: generateId(),
    symbol,
    direction: direction === 'buy' ? ORDER_DIRECTION.buy : ORDER_DIRECTION.sell,
    quantity,
    price,
    amount: quantity * price,
    status: 'filled',
    accountType: 'paper',
    createdAt,
  }
  await db.put('orders', order)
  return order
}

describe('tradingService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.orders)
  })

  describe('getWatchlistStocks', () => {
    it('returns only watching stocks', async () => {
      await seedStock('000001.SZ', 'watching')
      await seedStock('000002.SZ', 'candidate')

      const result = await getWatchlistStocks()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data![0]!.symbol).toBe('000001.SZ')
    })
  })

  describe('adviseForStock', () => {
    it('returns error when symbol is empty', async () => {
      const stock = await seedStock('000001.SZ')
      stock.symbol = ''
      const result = await adviseForStock(stock)
      expect(result.success).toBe(false)
      expect(result.error).toContain('股票代码不能为空')
    })

    it('returns watch advice when quotes are missing', async () => {
      const stock = await seedStock('000001.SZ')
      const result = await adviseForStock(stock)

      expect(result.success).toBe(true)
      expect(result.data?.signal.direction).toBe('watch')
      expect(result.data?.sizing.action).toBe('hold')
      expect(result.data?.sizing.targetShares).toBe(0)
      expect(result.data?.risk.ok).toBe(true)
    })

    it('returns buy advice with position sizing within risk budget', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 85)
      await seedDipQuotes('000001.SZ')

      const result = await adviseForStock(stock)

      expect(result.success).toBe(true)
      expect(result.data?.signal.direction).toBe('buy')
      expect(result.data?.sizing.action).toBe('buy')
      // 1/4 Kelly 目标仓位应在 3%-15% 之间，且受单笔 25% 上限约束
      expect(result.data?.sizing.positionPct).toBeGreaterThan(0)
      expect(result.data?.sizing.positionPct).toBeLessThanOrEqual(0.25)
      expect(result.data?.risk.ok).toBe(true)
    })

    it('returns sell advice for overbought conditions', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 140)
      await seedProfitTakingQuotes('000001.SZ')

      const result = await adviseForStock(stock)

      expect(result.success).toBe(true)
      expect(result.data?.signal.direction).toBe('sell')
      expect(result.data?.sizing.action).toBe('sell')
    })
  })

  describe('createBuyOrder', () => {
    it('creates a buy order after risk check passes', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 100)
      await seedDipQuotes('000001.SZ')

      const result = await createBuyOrder(stock, 100)

      expect(result.success).toBe(true)
      expect(result.data?.direction).toBe(ORDER_DIRECTION.buy)
      expect(result.data?.quantity).toBe(100)
      expect(result.data?.price).toBe(100)
    })

    it('blocks buy order when price is zero', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 0)
      await seedDipQuotes('000001.SZ')

      const result = await createBuyOrder(stock, 100)

      expect(result.success).toBe(false)
      expect(result.error).toContain('价格或数量非法')
    })

    it('blocks buy order that exceeds single position limit', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 100)
      await seedDipQuotes('000001.SZ')

      const result = await createBuyOrder(stock, 100_000)

      expect(result.success).toBe(false)
      expect(result.error).toContain('单笔上限')
    })

    it('blocks buy order in cooldown period', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 100)
      await seedDipQuotes('000001.SZ')
      await seedOrder('000001.SZ', 'buy', 100, 100)

      const result = await createBuyOrder(stock, 100)

      expect(result.success).toBe(false)
      expect(result.error).toContain('冷却期')
    })
  })

  describe('createSellOrder', () => {
    it('creates a sell order when holding is sufficient', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 140)
      await seedProfitTakingQuotes('000001.SZ')
      await seedOrder('000001.SZ', 'buy', 500, 140, Date.now() - 25 * 60 * 60 * 1000)

      const result = await createSellOrder(stock, 300)

      expect(result.success).toBe(true)
      expect(result.data?.direction).toBe(ORDER_DIRECTION.sell)
      expect(result.data?.quantity).toBe(300)
    })

    it('blocks sell order when holding is insufficient', async () => {
      const stock = await seedStock('000001.SZ', 'watching', 140)
      await seedProfitTakingQuotes('000001.SZ')

      const result = await createSellOrder(stock, 100)

      expect(result.success).toBe(false)
      expect(result.error).toContain('超过当前持仓')
    })
  })

  describe('scanWatchingSignals', () => {
    it('aggregates signals across all watching stocks', async () => {
      await seedStock('000001.SZ', 'watching')
      await seedDipQuotes('000001.SZ')
      await seedStock('000002.SZ', 'watching')
      await seedPivotQuotes('000002.SZ')
      await seedStock('000003.SZ', 'candidate')
      await seedProfitTakingQuotes('000003.SZ')

      const signals = await scanWatchingSignals()

      expect(signals.length).toBeGreaterThanOrEqual(2)
      const symbols = new Set(signals.map((s) => s.symbol))
      expect(symbols.has('000001.SZ')).toBe(true)
      expect(symbols.has('000002.SZ')).toBe(true)
      expect(symbols.has('000003.SZ')).toBe(false)
    })
  })

  describe('getOrders', () => {
    it('returns all orders', async () => {
      await seedOrder('000001.SZ', 'buy', 100)
      await seedOrder('000002.SZ', 'buy', 200)

      const result = await getOrders()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })
  })
})
