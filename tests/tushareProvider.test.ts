/**
 * @test_id V9-TEST-UT-063
 * @covers_docs []
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  tushareRequest,
  toTushareCode,
  fromTushareCode,
  TushareProviderError,
} from '@/services/data-collector/tushareProvider'
import {
  mapDailyToQuote,
  mapDailyToKlines,
  mapHolderNumberToChip,
  mapAnnouncementToNews,
  mapReportToResearch,
} from '@/services/data-collector/tushareAdapter'

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock fetch
type FetchMock = (input: string, init?: RequestInit) => Promise<Response>
const globalFetch = vi.fn<Parameters<FetchMock>, ReturnType<FetchMock>>()

beforeEach(() => {
  vi.stubGlobal('fetch', globalFetch)
  globalThis.__TUSHARE_TOKEN__ = 'test-token'
})

afterEach(() => {
  vi.unstubAllGlobals()
  globalThis.__TUSHARE_TOKEN__ = undefined
  vi.clearAllMocks()
})

describe('tushareProvider', () => {
  it('tushareRequest 应返回记录数组', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: 'req-1',
          code: 0,
          msg: '',
          data: {
            fields: ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount'],
            items: [['600519.SH', '20260101', 100, 101, 99, 100.5, 10000, 1000000]],
          },
        }),
        { status: 200 },
      ),
    )

    const records = await tushareRequest('daily', { ts_code: '600519.SH', start_date: '20260101', end_date: '20260101' })
    expect(records).toHaveLength(1)
    expect(records[0]).toHaveProperty('ts_code', '600519.SH')
    expect(records[0]).toHaveProperty('close', 100.5)
  })

  it('tushareRequest 业务错误时应抛出 TushareProviderError', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: 'req-2',
          code: -1000,
          msg: 'Token invalid',
          data: null,
        }),
        { status: 200 },
      ),
    )

    await expect(tushareRequest('stock_basic', { ts_code: '600519.SH' })).rejects.toThrow(TushareProviderError)
  })

  it('Token 缺失时应抛出 TOKEN_MISSING 错误', async () => {
    globalThis.__TUSHARE_TOKEN__ = ''
    await expect(tushareRequest('stock_basic', { ts_code: '600519.SH' })).rejects.toThrow(TushareProviderError)
    globalThis.__TUSHARE_TOKEN__ = 'test-token'
  })
})

describe('tushareAdapter', () => {
  it('mapDailyToQuote 应转换价格字段', () => {
    const record = {
      ts_code: '600519.SH',
      close: 1500,
      pre_close: 1480,
      change: 20,
      pct_change: 1.35,
      open: 1490,
      high: 1510,
      low: 1485,
      vol: 50000,
      amount: 75000000,
    }
    const quote = mapDailyToQuote(record)
    expect(quote.symbol).toBe('600519')
    expect(quote.price).toBe(1500)
    expect(quote.change).toBe(20)
    expect(quote.volume).toBe(50000)
  })

  it('mapDailyToKlines 应过滤无效日期', () => {
    const records = [
      { trade_date: '20260101', open: 100, high: 101, low: 99, close: 100.5, vol: 1000, amount: 100000 },
      { trade_date: '', open: 100, high: 101, low: 99, close: 100.5, vol: 1000, amount: 100000 },
    ]
    const klines = mapDailyToKlines(records)
    expect(klines).toHaveLength(1)
    expect(klines[0]!.date).toBe('2026-01-01')
  })

  it('mapHolderNumberToChip 应转换股东户数', () => {
    const record = { ts_code: '600519.SH', end_date: '20261231', holder_num: 150000 }
    const chip = mapHolderNumberToChip(record)
    expect(chip.shareholderCount).toBe(150000)
    expect(chip.date).toBe('2026-12-31')
  })

  it('mapAnnouncementToNews 应转换公告', () => {
    const record = { ts_code: '600519.SH', ann_date: '20260101', title: '年度报告', url: 'http://example.com' }
    const news = mapAnnouncementToNews(record)
    expect(news.title).toBe('年度报告')
    expect(news.category).toBe('announcement')
    expect(news.source).toBe('Tushare公告')
  })

  it('mapReportToResearch 应转换研报', () => {
    const record = { ts_code: '600519.SH', title: '买入评级', author: '分析师A', org_name: '券商B', rating_name: '买入', pub_date: '20260101' }
    const report = mapReportToResearch(record)
    expect(report.title).toBe('买入评级')
    expect(report.rating).toBe('买入')
    expect(report.institution).toBe('券商B')
  })
})

describe('stockCodeUtils', () => {
  it('toTushareCode 应转换沪市/深市/北交所代码', () => {
    expect(toTushareCode('600519')).toBe('600519.SH')
    expect(toTushareCode('000001')).toBe('000001.SZ')
    expect(toTushareCode('300750')).toBe('300750.SZ')
  })

  it('fromTushareCode 应还原 6 位代码', () => {
    expect(fromTushareCode('600519.SH')).toBe('600519')
  })
})
