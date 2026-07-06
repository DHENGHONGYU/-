import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { fetchStockKline } from '@/services/fetcher/fetcherService'
import { runV6Score } from '@/services/scoring/v6ScoreService'

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => response,
  } as Response)
}

function buildKlineResponse(symbol: string) {
  const history = []
  const basePrice = 100
  for (let i = 29; i >= 0; i--) {
    const close = basePrice + (29 - i) * 0.5
    history.push({
      date: `2026-05-${String(31 - i).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 0.8,
      low: close - 0.8,
      close,
      volume: 10000 + i * 100,
      amount: (10000 + i * 100) * close,
    })
  }
  return {
    success: true,
    symbol,
    dimension: 'kline',
    data: {
      latest: history[history.length - 1],
      history,
    },
    records: history.length,
    error: null,
    fetched_at: '2026-06-24T08:00:00',
  }
}

describe('fetcherKline', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should save daily quotes and update stock price', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    global.fetch = mockFetch(buildKlineResponse('000001.SZ'))

    const result = await fetchStockKline('000001.SZ')

    expect(result.success).toBe(true)
    expect(result.data?.price).toBe(114.5)
    expect(result.data?.source).toBe('akshare')

    const quotes = await dataLayer.dailyQuotes.get('000001.SZ')
    expect(quotes).toBeDefined()
    expect(quotes?.history.length).toBe(30)
    expect(quotes?.latest.close).toBe(114.5)
  })

  it('should use real kline data in V6 scoring', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    global.fetch = mockFetch(buildKlineResponse('000001.SZ'))

    await fetchStockKline('000001.SZ')
    const scoreResult = await runV6Score('000001.SZ')

    expect(scoreResult.success).toBe(true)
    expect(scoreResult.data?.factors['动量']).toBeDefined()
    expect(scoreResult.data?.factors['波动']).toBeDefined()
    expect(scoreResult.data?.factors['流动性']).toBeDefined()
  })

  it('should return error when stock not found', async () => {
    global.fetch = mockFetch(buildKlineResponse('NOT_EXIST'))

    const result = await fetchStockKline('NOT_EXIST')

    expect(result.success).toBe(false)
    expect(result.error).toContain('股票不存在')
  })

  it('should return error when kline service fails', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    global.fetch = mockFetch({
      success: false,
      symbol: '000001.SZ',
      dimension: 'kline',
      data: null,
      records: 0,
      error: 'AKShare K线接口异常',
      fetched_at: '2026-06-24T08:00:00',
    })

    const result = await fetchStockKline('000001.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('AKShare K线接口异常')
  })
})
