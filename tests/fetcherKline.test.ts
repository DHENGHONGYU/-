/**
 * @test_id V9-TEST-UT-026
 * @covers_docs [V9-DOC-PROJ-092, V9-DOC-PROJ-113, V9-DOC-FRONT-012, V9-DOC-PROJ-053]
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
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

  it('应该保存 daily quotes and update stock price', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
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

  it('应该use real kline data in V6 scoring', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
    })

    global.fetch = mockFetch(buildKlineResponse('000001.SZ'))

    await fetchStockKline('000001.SZ')
    const scoreResult = await runV6Score('000001.SZ')

    expect(scoreResult.success).toBe(true)
    // V6 评分已重构为 11 层评分，factors 以 layerId（l0~l8、lMinus1 等）为键。
    // 此处仅校验 kline 数据已流入评分并产出因子明细，不再依赖具体中文因子名。
    expect(scoreResult.data?.factors).toBeDefined()
    expect(Object.keys(scoreResult.data!.factors).length).toBeGreaterThan(0)
  })

  it('应该返回 error when stock not found', async () => {
    global.fetch = mockFetch(buildKlineResponse('NOT_EXIST'))

    const result = await fetchStockKline('NOT_EXIST')

    expect(result.success).toBe(false)
    expect(result.error).toContain('股票不存在')
  })

  it('应该返回 error when kline service fails', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
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
