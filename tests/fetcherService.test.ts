import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  fetchStockBasic,
  fetchStocksBasic,
  refreshSymbol,
  checkFetcherHealth,
} from '@/services/fetcher/fetcherService'

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => response,
  } as Response)
}

const BASIC_RESPONSE = {
  success: true,
  symbol: '000001.SZ',
  dimension: 'basic',
  data: {
    name: '平安银行',
    price: 12.34,
    pe: 8.5,
    pb: 0.9,
    roe: 10.2,
    market_cap: 2.4e11,
  },
  records: 1,
  error: null,
  fetched_at: '2026-06-24T08:00:00',
}

describe('fetcherService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该获取 basic data and update stock', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: 'Old Name',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
    })

    global.fetch = mockFetch(BASIC_RESPONSE)

    const result = await fetchStockBasic('000001.SZ')

    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('平安银行')
    expect(result.data?.price).toBe(12.34)
    expect(result.data?.pe).toBe(8.5)
    expect(result.data?.pb).toBe(0.9)
    expect(result.data?.roe).toBe(10.2)
    expect(result.data?.marketCap).toBe(2.4e11)
    expect(result.data?.source).toBe('akshare')
    expect(result.data?.dataVersion).toBe(2)
  })

  it('应该返回 error when stock not found', async () => {
    global.fetch = mockFetch(BASIC_RESPONSE)

    const result = await fetchStockBasic('NOT_EXIST')

    expect(result.success).toBe(false)
    expect(result.error).toContain('股票不存在')
  })

  it('应该返回 error when service returns failure', async () => {
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
      dimension: 'basic',
      data: null,
      records: 0,
      error: 'AKShare 接口异常',
      fetched_at: '2026-06-24T08:00:00',
    })

    const result = await fetchStockBasic('000001.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('AKShare 接口异常')
  })

  it('应该batch fetch stocks', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
    })

    global.fetch = mockFetch(BASIC_RESPONSE)

    const result = await fetchStocksBasic(['000001.SZ'])

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('refreshSymbol should delegate to fetchStockBasic', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
    })

    global.fetch = mockFetch(BASIC_RESPONSE)

    const result = await refreshSymbol('000001.SZ')

    expect(result.success).toBe(true)
    expect(result.data?.symbol).toBe('000001.SZ')
  })

  it('checkFetcherHealth should return ok when service is healthy', async () => {
    global.fetch = mockFetch({ status: 'ok', service: 'v9-data-collector', version: '0.1.0' }, true)

    const result = await checkFetcherHealth()

    expect(result.ok).toBe(true)
  })

  it('checkFetcherHealth should return error when service is down', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await checkFetcherHealth()

    expect(result.ok).toBe(false)
    expect(result.error).toContain('数据采集服务未启动')
  })
})
