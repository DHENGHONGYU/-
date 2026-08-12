/**
 * @test_id V9-TEST-UT-046
 * @covers_docs []
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryBuilder, type QueryBuilderResult } from '@/data/queryBuilder'

// --- Mock dataBridge ---
const mockStocksGet = vi.fn().mockImplementation(async (symbol: string) => ({
  symbol,
  name: symbol === '000001.SZ' ? '平安银行' : symbol === '600036.SH' ? '招商银行' : 'Unknown',
  industryCode: '801780',
  researchStatus: 'candidate' as const,
  source: 'manual' as const,
  dataVersion: 1,
}))
const mockDailyQuotesGet = vi.fn().mockResolvedValue({
  symbol: '000001.SZ',
  latest: { date: '2025-01-10', open: 12.0, high: 12.5, low: 11.8, close: 12.3, volume: 100000, amount: 1230000 },
  history: [],
  period: 'daily',
  adjust: 'qfq',
  updatedAt: Date.now(),
})
const mockV6ScoresGet = vi.fn().mockResolvedValue({
  symbol: '000001.SZ',
  score: 78.5,
  factors: { moat: 8, growth: 7 },
  algorithmVersion: 'v1',
  calculatedAt: Date.now(),
  dataVersion: 1,
})
const mockIntelligentScoresGetLatest = vi.fn().mockResolvedValue({
  symbol: '000001.SZ',
  overallScore: 82,
  dimensionScores: [],
  summary: 'test',
  basis: 'test',
  missingFields: [],
  sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
  configSnapshot: { model: 'gpt-4', baseURL: '' },
  modelResponse: '',
  dataVersion: 1,
  scoredAt: Date.now(),
})
const mockIndustryScoresGetLatest = vi.fn().mockResolvedValue({
  code: '801780',
  name: '银行',
  overallScore: 75,
  dimensionScores: [],
  summary: 'test',
  basis: 'test',
  missingFields: [],
  sectorSnapshot: { composite: 75, recommendation: 'hold', positionPct: '50%', subTracks: [] },
  configSnapshot: { model: 'gpt-4', baseURL: '' },
  modelResponse: '',
  scoredAt: Date.now(),
})
const mockSignalsListBySymbol = vi.fn().mockResolvedValue([
  { id: 's1', symbol: '000001.SZ', direction: 'buy', type: 'hot-sector', confidence: 0.85, rationale: 'test', snapshot: {}, createdAt: Date.now() },
])
const mockNewsStockMapListBySymbol = vi.fn().mockResolvedValue([
  { id: '000001.SZ_n1', symbol: '000001.SZ', newsId: 'n1', relevanceScore: 0.9, isTitleMatch: true, isContentMatch: false, industryMatch: false },
  { id: '000001.SZ_n2', symbol: '000001.SZ', newsId: 'n2', relevanceScore: 0.7, isTitleMatch: false, isContentMatch: true, industryMatch: false },
])
const mockNewsGet = vi.fn().mockImplementation(async (id: string) => ({
  id,
  title: `News ${id}`,
  content: 'content',
  url: 'https://example.com',
  source: 'test',
  category: 'finance',
  publishTime: '2025-01-10',
  fetchTime: '2025-01-10',
  sentiment: 'positive' as const,
  sentimentConfidence: 0.8,
  relatedStocks: ['000001.SZ'],
  keywords: ['bank'],
  hash: 'abc123',
}))

// P4 后 queryBuilder 统一走 DataBridge.query，按 action/store 路由到原 mock 函数。
vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn(async (request: { action: string; store: string; key?: string; indexName?: string; indexValue?: unknown }) => {
      if (request.action === 'QUERY_GET' && request.store === 'stocks') {
        return { success: true, data: await mockStocksGet(request.key) }
      }
      if (request.action === 'QUERY_GET' && request.store === 'daily_quotes') {
        return { success: true, data: await mockDailyQuotesGet(request.key) }
      }
      if (request.action === 'QUERY_GET' && request.store === 'v6_scores') {
        return { success: true, data: await mockV6ScoresGet(request.key) }
      }
      if (request.action === 'QUERY_BY_INDEX' && request.store === 'intelligent_scores' && request.indexName === 'by-symbol') {
        return { success: true, data: [await mockIntelligentScoresGetLatest(request.indexValue)] }
      }
      if (request.action === 'QUERY_BY_INDEX' && request.store === 'industry_scores' && request.indexName === 'by-code') {
        return { success: true, data: [await mockIndustryScoresGetLatest(request.indexValue)] }
      }
      if (request.action === 'QUERY_BY_INDEX' && request.store === 'signals' && request.indexName === 'by-symbol') {
        return { success: true, data: await mockSignalsListBySymbol(request.indexValue) }
      }
      if (request.action === 'QUERY_BY_INDEX' && request.store === 'news_stock_map' && request.indexName === 'by-symbol') {
        return { success: true, data: await mockNewsStockMapListBySymbol(request.indexValue) }
      }
      if (request.action === 'QUERY_GET' && request.store === 'news') {
        return { success: true, data: await mockNewsGet(request.key) }
      }
      return { success: false, error: `unmocked query: ${request.action}/${request.store}` }
    }),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('QueryBuilder', () => {
  let qb: QueryBuilder

  beforeEach(() => {
    vi.clearAllMocks()
    qb = new QueryBuilder()
  })

  function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
    expect(result.ok).toBe(true)
    expect(result.value).toBeDefined()
    return result.value as T
  }

  it('应该query stock with basic and v6Score dimensions', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeBasic: true,
        includeV6Score: true,
      }),
    )
    expect(result.stock).toBeDefined()
    expect(result.stock!.symbol).toBe('000001.SZ')
    expect(result.stock!.name).toBe('平安银行')
    expect(result.v6Score).toBeDefined()
    expect(result.v6Score!.score).toBe(78.5)
    expect(mockStocksGet).toHaveBeenCalledWith('000001.SZ')
    expect(mockV6ScoresGet).toHaveBeenCalledWith('000001.SZ')
  })

  it('应该返回 undefined for unrequested dimensions', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeBasic: true,
      }),
    )
    expect(result.stock).toBeDefined()
    expect(result.v6Score).toBeUndefined()
    expect(result.quotes).toBeUndefined()
    expect(result.intelligentScore).toBeUndefined()
    expect(result.industryScore).toBeUndefined()
    expect(result.signals).toBeUndefined()
    expect(result.news).toBeUndefined()
  })

  it('应该query quotes dimension', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeQuotes: true,
      }),
    )
    expect(result.quotes).toBeDefined()
    expect(result.quotes!.symbol).toBe('000001.SZ')
    expect(result.quotes!.latest.close).toBe(12.3)
    expect(mockDailyQuotesGet).toHaveBeenCalledWith('000001.SZ')
  })

  it('应该query intelligentScore dimension', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeIntelligentScore: true,
      }),
    )
    expect(result.intelligentScore).toBeDefined()
    expect(result.intelligentScore!.overallScore).toBe(82)
    expect(mockIntelligentScoresGetLatest).toHaveBeenCalledWith('000001.SZ')
  })

  it('应该query industryScore dimension via industryCode', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeIndustryScore: true,
      }),
    )
    expect(result.industryScore).toBeDefined()
    expect(result.industryScore!.code).toBe('801780')
    expect(result.industryScore!.overallScore).toBe(75)
    // industryScore 内部需要先查 stock 获取 industryCode
    expect(mockStocksGet).toHaveBeenCalledWith('000001.SZ')
    expect(mockIndustryScoresGetLatest).toHaveBeenCalledWith('801780')
  })

  it('应该返回 undefined industryScore when stock has no industryCode', async () => {
    mockStocksGet.mockResolvedValueOnce({
      symbol: '000001.SZ',
      name: '平安银行',
      // no industryCode
      researchStatus: 'candidate',
      source: 'manual',
      dataVersion: 1,
    })

    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeIndustryScore: true,
      }),
    )
    expect(result.industryScore).toBeUndefined()
    expect(mockIndustryScoresGetLatest).not.toHaveBeenCalled()
  })

  it('应该query signals dimension', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeSignals: true,
      }),
    )
    expect(result.signals).toBeDefined()
    expect(result.signals!.length).toBe(1)
    expect((result.signals as any)[0].direction).toBe('buy')
    expect(mockSignalsListBySymbol).toHaveBeenCalledWith('000001.SZ')
  })

  it('应该query news dimension via newsStockMap', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeNews: true,
      }),
    )
    expect(result.news).toBeDefined()
    expect(result.news!.length).toBe(2)
    expect((result.news as any)[0].id).toBe('n1')
    expect((result.news as any)[1].id).toBe('n2')
    expect(mockNewsStockMapListBySymbol).toHaveBeenCalledWith('000001.SZ')
    expect(mockNewsGet).toHaveBeenCalledWith('n1')
    expect(mockNewsGet).toHaveBeenCalledWith('n2')
  })

  it('应该处理缺失值 data gracefully (stock not found)', async () => {
    mockStocksGet.mockResolvedValueOnce(undefined)
    mockV6ScoresGet.mockResolvedValueOnce(undefined)

    const result = unwrap(
      await qb.queryStock({
        symbol: '999999.SZ',
        includeBasic: true,
        includeV6Score: true,
      }),
    )
    expect(result.stock).toBeUndefined()
    expect(result.v6Score).toBeUndefined()
  })

  it('应该处理错误 in basic dimension gracefully', async () => {
    mockStocksGet.mockRejectedValueOnce(new Error('DB error'))

    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeBasic: true,
        includeV6Score: true,
      }),
    )
    expect(result.stock).toBeUndefined()
    expect(result.errors).toContain('basic')
    expect(result.v6Score).toBeDefined()
  })

  it('应该返回 empty array for signals on error', async () => {
    mockSignalsListBySymbol.mockRejectedValueOnce(new Error('DB error'))

    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeSignals: true,
      }),
    )
    expect(result.signals).toEqual([])
    expect(result.errors).toContain('signals')
  })

  it('应该返回 empty array for news on error', async () => {
    mockNewsStockMapListBySymbol.mockRejectedValueOnce(new Error('DB error'))

    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeNews: true,
      }),
    )
    expect(result.news).toEqual([])
    expect(result.errors).toContain('news')
  })

  it('应该query all dimensions in parallel', async () => {
    const result = unwrap(
      await qb.queryStock({
        symbol: '000001.SZ',
        includeBasic: true,
        includeQuotes: true,
        includeV6Score: true,
        includeIntelligentScore: true,
        includeIndustryScore: true,
        includeSignals: true,
        includeNews: true,
      }),
    )

    expect(result.stock).toBeDefined()
    expect(result.quotes).toBeDefined()
    expect(result.v6Score).toBeDefined()
    expect(result.intelligentScore).toBeDefined()
    expect(result.industryScore).toBeDefined()
    expect(result.signals).toBeDefined()
    expect(result.news).toBeDefined()
    expect(result.errors).toBeUndefined()
  })

  it('应该batch query multiple symbols', async () => {
    const result = await qb.queryStocksBatch(['000001.SZ', '600036.SH'], {
      includeBasic: true,
    })
    expect(result.ok).toBe(true)
    const results = (result as { ok: true; value: Map<string, QueryBuilderResult> }).value
    expect(results.size).toBe(2)
    expect(results.get('000001.SZ')?.stock?.symbol).toBe('000001.SZ')
    expect(results.get('600036.SH')?.stock?.symbol).toBe('600036.SH')
  })

  it('应该处理空值 symbols in batch query', async () => {
    const result = await qb.queryStocksBatch([], {
      includeBasic: true,
    })
    expect(result.ok).toBe(true)
    expect((result as { ok: true; value: Map<string, QueryBuilderResult> }).value.size).toBe(0)
  })
})
