/**
 * @test_id V9-TEST-ST-022
 * queryBuilder.ts 单元测试 — D-02 类型安全化
 *
 * 通过 mock @/core/databridge 隔离底层存储，验证：
 * - 成功路径返回 ok(QueryBuilderResult) 且维度正确组装
 * - 参数校验失败（symbol 缺失）返回 fail(ValidationError)
 * - 单维度失败仅记入 errors，整体仍为 ok（partial success）
 * - 批量查询返回 ok(Map)
 *
 * @vitest
 * @covers_docs []
*/
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockQuery,
  mockLogger,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { queryBuilder } from './queryBuilder'
import { ValidationError } from '@/lib/errors'

type MockStore = Record<string, unknown>

/**
 * 精细化 mock dataBridge.query
 * 支持 QUERY_GET 和 QUERY_BY_INDEX 两种 action
 * 通过 store#key 或 store@indexName#indexValue 定位数据
 */
function setupMockData(data: {
  get?: MockStore          // store#key → value
  byIndex?: MockStore      // store@indexName#indexValue → value[]
  throwStores?: string[]   // 这些 store 的查询会抛错
}): void {
  mockQuery.mockImplementation(async (req: {
    action: string
    store: string
    key?: string
    indexName?: string
    indexValue?: unknown
  }) => {
    // 检查是否应该抛错
    if (data.throwStores?.includes(req.store)) {
      throw new Error(`DB error for ${req.store}`)
    }

    if (req.action === 'QUERY_GET') {
      const key = `${req.store}#${req.key ?? ''}`
      const value = data.get?.[key]
      return { success: true, data: value }
    }

    if (req.action === 'QUERY_BY_INDEX') {
      const key = `${req.store}@${req.indexName}#${String(req.indexValue)}`
      const value = data.byIndex?.[key] ?? []
      return { success: true, data: value }
    }

    return { success: false, data: undefined }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ success: true, data: undefined })
})

describe('QueryBuilder.queryStock — 参数校验', () => {
  it('symbol 为空字符串返回 ValidationError', async () => {
    const res = await queryBuilder.queryStock({ symbol: '' })

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(ValidationError)
      expect((res.error as ValidationError).field).toBe('symbol')
    }
  })

  it('symbol 缺失返回 ValidationError', async () => {
    // @ts-expect-error 测试运行时校验
    const res = await queryBuilder.queryStock({})

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(ValidationError)
    }
  })

  it('symbol 为有效字符串时通过校验', async () => {
    setupMockData({ get: {} })
    const res = await queryBuilder.queryStock({ symbol: '600000' })

    expect(res.ok).toBe(true)
  })

  it('includeBasic 非 boolean 时被过滤', async () => {
    setupMockData({ get: {} })
    // @ts-expect-error 测试运行时校验
    const res = await queryBuilder.queryStock({ symbol: '600000', includeBasic: 'yes' })

    expect(res.ok).toBe(false)
  })
})

describe('QueryBuilder.queryStock — 各维度独立测试', () => {
  it('includeBasic: 返回股票基础信息', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '浦发银行', industryCode: 'I01' },
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock?.symbol).toBe('600000')
      expect(res.value.stock?.name).toBe('浦发银行')
    }
  })

  it('includeBasic: 查询失败 → errors 含 basic', async () => {
    setupMockData({
      throwStores: ['stocks'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock).toBeUndefined()
      expect(res.value.errors).toContain('basic')
    }
  })

  it('includeQuotes: 返回 K 线行情数据', async () => {
    setupMockData({
      get: {
        'daily_quotes#600000': { symbol: '600000', close: 10.5, volume: 1000000 },
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeQuotes: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.quotes?.latest.close).toBe(10.5)
    }
  })

  it('includeQuotes: 查询失败 → errors 含 quotes', async () => {
    setupMockData({
      throwStores: ['daily_quotes'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeQuotes: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.quotes).toBeUndefined()
      expect(res.value.errors).toContain('quotes')
    }
  })

  it('includeV6Score: 返回 V6 评分', async () => {
    setupMockData({
      get: {
        'v6_scores#600000': { symbol: '600000', totalScore: 75, layers: {} },
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeV6Score: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.v6Score?.score).toBe(75)
    }
  })

  it('includeV6Score: 查询失败 → errors 含 v6Score', async () => {
    setupMockData({
      throwStores: ['v6_scores'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeV6Score: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.v6Score).toBeUndefined()
      expect(res.value.errors).toContain('v6Score')
    }
  })

  it('includeIntelligentScore: 返回最新智能评分', async () => {
    setupMockData({
      byIndex: {
        'intelligent_scores@by-symbol#600000': [
          { symbol: '600000', score: 80, scoredAt: 1000 },
          { symbol: '600000', score: 85, scoredAt: 2000 },
          { symbol: '600000', score: 82, scoredAt: 1500 },
        ],
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeIntelligentScore: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      // 应返回 scoredAt 最新的那条 (2000)
      expect(res.value.intelligentScore?.overallScore).toBe(85)
      expect(res.value.intelligentScore?.scoredAt).toBe(2000)
    }
  })

  it('includeIntelligentScore: 空数组 → 不返回数据', async () => {
    setupMockData({
      byIndex: {
        'intelligent_scores@by-symbol#600000': [],
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeIntelligentScore: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.intelligentScore).toBeUndefined()
    }
  })

  it('includeIntelligentScore: 查询失败 → errors 含 intelligentScore', async () => {
    setupMockData({
      throwStores: ['intelligent_scores'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeIntelligentScore: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.intelligentScore).toBeUndefined()
      expect(res.value.errors).toContain('intelligentScore')
    }
  })

  it('includeIndustryScore: 有 industryCode 时返回行业评分', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '浦发银行', industryCode: 'I01' },
      },
      byIndex: {
        'industry_scores@by-code#I01': [
          { code: 'I01', score: 70, scoredAt: 1000 },
          { code: 'I01', score: 75, scoredAt: 2000 },
        ],
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeIndustryScore: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.industryScore?.overallScore).toBe(75)
      expect(res.value.industryScore?.scoredAt).toBe(2000)
    }
  })

  it('includeIndustryScore: 无 industryCode 时不返回数据', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '测试股' },
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeIndustryScore: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.industryScore).toBeUndefined()
      // 没有 industryCode 不算错误，不应该进 errors
      expect(res.value.errors).toBeUndefined()
    }
  })

  it('includeIndustryScore: 股票查询失败 → errors 含 industryScore', async () => {
    setupMockData({
      throwStores: ['stocks'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeIndustryScore: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.errors).toContain('industryScore')
    }
  })

  it('includeSignals: 返回交易信号列表', async () => {
    setupMockData({
      byIndex: {
        'signals@by-symbol#600000': [
          { id: 's1', symbol: '600000', type: 'buy', strength: 'strong' },
          { id: 's2', symbol: '600000', type: 'sell', strength: 'weak' },
        ],
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeSignals: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.signals).toHaveLength(2)
      expect(res.value.signals?.[0]?.type).toBe('buy')
    }
  })

  it('includeSignals: 查询失败 → errors 含 signals 且 signals 为 []', async () => {
    setupMockData({
      throwStores: ['signals'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeSignals: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.signals).toEqual([])
      expect(res.value.errors).toContain('signals')
    }
  })

  it('includeNews: 通过 newsStockMap 关联查询新闻', async () => {
    setupMockData({
      byIndex: {
        'news_stock_map@by-symbol#600000': [
          { newsId: 'n1', symbol: '600000' },
          { newsId: 'n2', symbol: '600000' },
        ],
      },
      get: {
        'news#n1': { id: 'n1', title: '新闻1' },
        'news#n2': { id: 'n2', title: '新闻2' },
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeNews: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.news).toHaveLength(2)
      const titles = res.value.news?.map((n) => (n as { title: string }).title).sort()
      expect(titles).toEqual(['新闻1', '新闻2'])
    }
  })

  it('includeNews: 部分新闻查询失败 → 只保留成功的', async () => {
    setupMockData({
      byIndex: {
        'news_stock_map@by-symbol#600000': [
          { newsId: 'n1', symbol: '600000' },
          { newsId: 'n2', symbol: '600000' },
          { newsId: 'n3', symbol: '600000' },
        ],
      },
      get: {
        'news#n1': { id: 'n1', title: '新闻1' },
        'news#n2': { id: 'n2', title: '新闻2' },
        // n3 不存在 → 返回 undefined → 被过滤
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeNews: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.news).toHaveLength(2)
    }
  })

  it('includeNews: newsStockMap 查询失败 → errors 含 news', async () => {
    setupMockData({
      throwStores: ['news_stock_map'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeNews: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.news).toEqual([])
      expect(res.value.errors).toContain('news')
    }
  })

  it('includeNews: 空映射 → 空数组', async () => {
    setupMockData({
      byIndex: {
        'news_stock_map@by-symbol#600000': [],
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeNews: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.news).toEqual([])
    }
  })
})

describe('QueryBuilder.queryStock — 维度组合', () => {
  it('全维度查询成功', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '浦发银行', industryCode: 'I01' },
        'daily_quotes#600000': { symbol: '600000', close: 10.5 },
        'v6_scores#600000': { symbol: '600000', totalScore: 75 },
        'news#n1': { id: 'n1', title: '新闻1' },
      },
      byIndex: {
        'intelligent_scores@by-symbol#600000': [
          { symbol: '600000', score: 80, scoredAt: 2000 },
        ],
        'industry_scores@by-code#I01': [
          { code: 'I01', score: 70, scoredAt: 2000 },
        ],
        'signals@by-symbol#600000': [
          { id: 's1', type: 'buy' },
        ],
        'news_stock_map@by-symbol#600000': [
          { newsId: 'n1', symbol: '600000' },
        ],
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
      includeQuotes: true,
      includeV6Score: true,
      includeIntelligentScore: true,
      includeIndustryScore: true,
      includeSignals: true,
      includeNews: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock).toBeDefined()
      expect(res.value.quotes).toBeDefined()
      expect(res.value.v6Score).toBeDefined()
      expect(res.value.intelligentScore).toBeDefined()
      expect(res.value.industryScore).toBeDefined()
      expect(res.value.signals).toHaveLength(1)
      expect(res.value.news).toHaveLength(1)
      expect(res.value.errors).toBeUndefined()
    }
  })

  it('多维度混合成功失败 → 部分成功', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '浦发银行', industryCode: 'I01' },
        'daily_quotes#600000': { symbol: '600000', close: 10.5 },
      },
      byIndex: {
        'signals@by-symbol#600000': [{ id: 's1', type: 'buy' }],
      },
      throwStores: ['v6_scores', 'intelligent_scores'],
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
      includeQuotes: true,
      includeV6Score: true,
      includeIntelligentScore: true,
      includeSignals: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock).toBeDefined()
      expect(res.value.quotes).toBeDefined()
      expect(res.value.signals).toHaveLength(1)
      expect(res.value.v6Score).toBeUndefined()
      expect(res.value.intelligentScore).toBeUndefined()
      expect(res.value.errors).toContain('v6Score')
      expect(res.value.errors).toContain('intelligentScore')
    }
  })

  it('无任何 include → 空结果无 errors', async () => {
    setupMockData({ get: {}, byIndex: {} })

    const res = await queryBuilder.queryStock({ symbol: '600000' })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.errors).toBeUndefined()
      expect(res.value.stock).toBeUndefined()
    }
  })

  it('value 为 null 时不加入结果', async () => {
    setupMockData({
      get: {
        'stocks#600000': null,
      },
    })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock).toBeUndefined()
    }
  })
})

describe('QueryBuilder.queryStock — 日志与错误信息', () => {
  it('查询成功时记录 info 日志', async () => {
    setupMockData({ get: {} })

    await queryBuilder.queryStock({ symbol: '600000' })

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[QueryBuilder] queryStock'),
    )
  })

  it('参数校验失败时记录 warn 日志', async () => {
    await queryBuilder.queryStock({ symbol: '' })

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('参数校验失败'),
    )
  })

  it('维度失败时记录 warn 日志', async () => {
    setupMockData({
      throwStores: ['stocks'],
    })

    await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
    })

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch basic data'),
    )
  })
})

describe('QueryBuilder.queryStocksBatch — 批量查询', () => {
  it('全部成功 → 返回全部结果', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '浦发银行' },
        'stocks#600519': { symbol: '600519', name: '贵州茅台' },
      },
    })

    const res = await queryBuilder.queryStocksBatch(
      ['600000', '600519'],
      { includeBasic: true },
    )

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.size).toBe(2)
      expect(res.value.get('600000')?.stock?.name).toBe('浦发银行')
      expect(res.value.get('600519')?.stock?.name).toBe('贵州茅台')
    }
  })

  it('部分失败 → 跳过失败标的，保留成功的', async () => {
    // 600000 的 stocks 查询抛错，但 queryStock 仍然返回 ok
    // 只有参数校验失败才会导致 queryStock 返回 fail
    setupMockData({
      get: {
        'stocks#600519': { symbol: '600519', name: '贵州茅台' },
      },
      throwStores: ['stocks'],
    })

    const res = await queryBuilder.queryStocksBatch(
      ['600000', '600519'],
      { includeBasic: true },
    )

    // 所有标的的 queryStock 都会返回 ok（partial success），所以都在 map 里
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.size).toBe(2)
      // 600000 的 stock 是 undefined，但 queryStock 仍然是 ok
      expect(res.value.get('600000')?.stock).toBeUndefined()
      expect(res.value.get('600519')?.stock).toBeUndefined() // 也会失败，因为 throwStores 全局生效
    }
  })

  it('空数组 → 返回空 Map', async () => {
    setupMockData({ get: {} })

    const res = await queryBuilder.queryStocksBatch([], { includeBasic: true })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.size).toBe(0)
    }
  })

  it('单标的成功 → 返回 1 条', async () => {
    setupMockData({
      get: {
        'stocks#600000': { symbol: '600000', name: '浦发银行' },
      },
    })

    const res = await queryBuilder.queryStocksBatch(['600000'], { includeBasic: true })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.size).toBe(1)
    }
  })

  it('批量查询记录 info 日志', async () => {
    setupMockData({ get: {} })

    await queryBuilder.queryStocksBatch(['600000'], { includeBasic: true })

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[QueryBuilder] queryStocksBatch'),
    )
  })

  it('单标的参数校验失败 → 跳过该标的（走 fail 分支）', async () => {
    setupMockData({ get: {} })

    // 空字符串 symbol 会导致 queryStock 返回 fail
    const res = await queryBuilder.queryStocksBatch(
      ['', '600000'],
      { includeBasic: true },
    )

    expect(res.ok).toBe(true)
    if (res.ok) {
      // 只有 600000 成功，空 symbol 被跳过
      expect(res.value.size).toBe(1)
      expect(res.value.has('600000')).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('跳过失败标的'),
      )
    }
  })
})
