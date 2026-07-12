/**
 * fetcherAdapter 单元测试
 *
 * 覆盖：adaptBasicDataToStock, adaptKlineDataToDailyQuotes,
 *       hasRealBasicData, hasEnoughHistory
 */

import { describe, test, expect } from 'vitest'
import {
  adaptBasicDataToStock,
  adaptKlineDataToDailyQuotes,
  hasRealBasicData,
  hasEnoughHistory,
} from './fetcherAdapter'
import type { CollectBasicData, CollectKlineData } from './fetcherTypes'
import type { Stock, DailyQuotes } from '@/data/types'

// ============================================================
// adaptBasicDataToStock
// ============================================================

describe('adaptBasicDataToStock', () => {
  test('完整数据转换', () => {
    const data: CollectBasicData = {
      name: '  贵州茅台  ',
      price: 1800.5,
      pe: 30.2,
      pb: 8.1,
      roe: 0.25,
      market_cap: 2.2e12,
    }

    const result = adaptBasicDataToStock('600519.SH', data)

    expect(result.symbol).toBe('600519.SH')
    expect(result.name).toBe('贵州茅台')
    expect(result.price).toBe(1800.5)
    expect(result.pe).toBe(30.2)
    expect(result.pb).toBe(8.1)
    expect(result.roe).toBe(0.25)
    expect(result.marketCap).toBe(2.2e12)
    expect(result.source).toBe('akshare')
    expect(result.updatedAt).toBeGreaterThan(0)
  })

  test('部分数据转换（只传 name）', () => {
    const data: CollectBasicData = {
      name: '五粮液',
    }

    const result = adaptBasicDataToStock('000858.SZ', data)

    expect(result.symbol).toBe('000858.SZ')
    expect(result.name).toBe('五粮液')
    expect(result.price).toBeUndefined()
    expect(result.pe).toBeUndefined()
  })

  test('空 name 不转换', () => {
    const data: CollectBasicData = {
      name: '   ',
      price: 100,
    }

    const result = adaptBasicDataToStock('000001.SZ', data)

    expect(result.name).toBeUndefined()
    expect(result.price).toBe(100)
  })

  test('NaN 值过滤', () => {
    const data: CollectBasicData = {
      name: '测试股',
      price: NaN,
      pe: NaN,
      pb: 1.5,
    }

    const result = adaptBasicDataToStock('999999.SH', data)

    expect(result.price).toBeUndefined()
    expect(result.pe).toBeUndefined()
    expect(result.pb).toBe(1.5)
  })
})

// ============================================================
// adaptKlineDataToDailyQuotes
// ============================================================

describe('adaptKlineDataToDailyQuotes', () => {
  test('正常转换', () => {
    const data: CollectKlineData = {
      latest: {
        date: '2024-06-28',
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1e6,
        amount: 1e8,
      },
      history: [
        {
          date: '2024-06-27',
          open: 98,
          high: 101,
          low: 97,
          close: 100,
          volume: 9e5,
          amount: 9e7,
        },
      ],
    }

    const result = adaptKlineDataToDailyQuotes('600519.SH', data)

    expect(result).not.toBeNull()
    expect(result!.symbol).toBe('600519.SH')
    expect(result!.latest.close).toBe(103)
    expect(result!.history).toHaveLength(1)
    expect(result!.period).toBe('daily')
    expect(result!.adjust).toBe('qfq')
  })

  test('无 latest 取 history 最后一项', () => {
    const data: CollectKlineData = {
      history: [
        {
          date: '2024-06-26',
          open: 95,
          high: 98,
          low: 94,
          close: 97,
          volume: 8e5,
          amount: 8e7,
        },
        {
          date: '2024-06-27',
          open: 98,
          high: 101,
          low: 97,
          close: 100,
          volume: 9e5,
          amount: 9e7,
        },
      ],
    }

    const result = adaptKlineDataToDailyQuotes('600519.SH', data)

    expect(result).not.toBeNull()
    expect(result!.latest.close).toBe(100)
    expect(result!.history).toHaveLength(2)
  })

  test('无效 K线过滤', () => {
    const data: CollectKlineData = {
      latest: {
        date: '2024-06-28',
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1e6,
        amount: 1e8,
      },
      history: [
        {
          date: '2024-06-27',
          open: 98,
          high: 101,
          low: 97,
          close: 100,
          volume: 9e5,
          amount: 9e7,
        },
        // 无效条目
        { date: 'bad', open: 'x', high: 1, low: 1, close: 1, volume: 1, amount: 1 } as unknown as DailyQuotes['history'][0],
      ],
    }

    const result = adaptKlineDataToDailyQuotes('600519.SH', data)

    expect(result).not.toBeNull()
    expect(result!.history).toHaveLength(1)
  })

  test('空 history 且无 latest 返回 null', () => {
    const data: CollectKlineData = {
      history: [],
    }

    const result = adaptKlineDataToDailyQuotes('600519.SH', data)

    expect(result).toBeNull()
  })
})

// ============================================================
// hasRealBasicData
// ============================================================

describe('hasRealBasicData', () => {
  test('全部字段存在返回 true', () => {
    const stock: Stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      price: 1800,
      pe: 30,
      pb: 8,
      roe: 0.25,
      marketCap: 2.2e12,
      dataVersion: 1,
      source: 'akshare',
      updatedAt: Date.now(),
      researchStatus: 'watching',
    }

    expect(hasRealBasicData(stock)).toBe(true)
  })

  test('缺少字段返回 false', () => {
    const stock: Stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      price: 1800,
      pe: 30,
      pb: 8,
      // roe 缺失
      marketCap: 2.2e12,
      dataVersion: 1,
      source: 'akshare',
      updatedAt: Date.now(),
      researchStatus: 'watching',
    }

    expect(hasRealBasicData(stock)).toBe(false)
  })
})

// ============================================================
// hasEnoughHistory
// ============================================================

describe('hasEnoughHistory', () => {
  test('足够历史返回 true', () => {
    const quotes: DailyQuotes = {
      symbol: '600519.SH',
      latest: { date: '2024-06-28', open: 100, high: 105, low: 99, close: 103, volume: 1e6, amount: 1e8 },
      history: Array.from({ length: 30 }, (_, i) => ({
        date: `2024-05-${i + 1}`,
        open: 100,
        high: 101,
        low: 99,
        close: 100 + i,
        volume: 1e6,
        amount: 1e8,
      })),
      period: 'daily',
      adjust: 'qfq',
      updatedAt: Date.now(),
    }

    expect(hasEnoughHistory(quotes, 20)).toBe(true)
  })

  test('不足返回 false', () => {
    const quotes: DailyQuotes = {
      symbol: '600519.SH',
      latest: { date: '2024-06-28', open: 100, high: 105, low: 99, close: 103, volume: 1e6, amount: 1e8 },
      history: Array.from({ length: 10 }, (_, i) => ({
        date: `2024-05-${i + 1}`,
        open: 100,
        high: 101,
        low: 99,
        close: 100 + i,
        volume: 1e6,
        amount: 1e8,
      })),
      period: 'daily',
      adjust: 'qfq',
      updatedAt: Date.now(),
    }

    expect(hasEnoughHistory(quotes, 20)).toBe(false)
  })

  test('undefined 返回 false', () => {
    expect(hasEnoughHistory(undefined, 20)).toBe(false)
  })
})
