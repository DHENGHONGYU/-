/**
 * @test_id V9-TEST-ST-129
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { NewsArticle } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))

const mockListNews = vi.hoisted(() => vi.fn())
const mockGenerateMockArticlesSvc = vi.hoisted(() => vi.fn())
const mockSaveNewsArticles = vi.hoisted(() => vi.fn())
const mockAggregateSentimentTrend = vi.hoisted(() => vi.fn())
const mockExtractStockOptions = vi.hoisted(() => vi.fn())
const mockExtractIndustryOptions = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/services/news/newsService', () => ({
  listNews: (...args: unknown[]) => mockListNews(...args),
  generateMockArticles: (...args: unknown[]) => mockGenerateMockArticlesSvc(...args),
  saveNewsArticles: (...args: unknown[]) => mockSaveNewsArticles(...args),
}))
vi.mock('@/services/news/sentimentTrendEngine', () => ({
  aggregateSentimentTrend: (...args: unknown[]) => mockAggregateSentimentTrend(...args),
  extractStockOptions: (...args: unknown[]) => mockExtractStockOptions(...args),
  extractIndustryOptions: (...args: unknown[]) => mockExtractIndustryOptions(...args),
}))

// ============================================================
// Imports
// ============================================================

import { useAnalysisNewsStore } from './analysisNewsStore'

// ============================================================
// Helpers
// ============================================================

function createMockArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'news-001',
    title: '测试新闻',
    content: '测试内容',
    url: 'https://example.com/1',
    source: '测试源',
    category: '科技',
    publishTime: '2026-01-01T00:00:00Z',
    fetchTime: '2026-01-01T00:00:00Z',
    sentiment: 'positive',
    sentimentConfidence: 0.9,
    relatedStocks: ['AAPL'],
    keywords: ['AI'],
    hash: 'hash-001',
    ...overrides,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useAnalysisNewsStore.getState().reset()
})

// 清理 stubbed env（vi.stubEnv），避免跨测试污染
afterEach(() => {
  vi.unstubAllEnvs()
})

// ============================================================
// useAnalysisNewsStore
// ============================================================

describe('useAnalysisNewsStore', () => {
  it('初始状态验证', () => {
    const state = useAnalysisNewsStore.getState()
    expect(state.articles).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.filter).toEqual({ keyword: '', category: '', sentiment: '', source: '' })
    expect(state.selectedArticle).toBeNull()
  })

  it('setArticles: 更新文章列表', () => {
    const articles = [createMockArticle({ id: '1' }), createMockArticle({ id: '2' })]
    useAnalysisNewsStore.getState().setArticles(articles)

    expect(useAnalysisNewsStore.getState().articles).toHaveLength(2)
    expect(useAnalysisNewsStore.getState().articles[0]!.id).toBe('1')
  })

  it('setFilter: 更新筛选条件', () => {
    useAnalysisNewsStore.getState().setFilter({ keyword: 'AI', category: '科技', sentiment: 'positive', source: '新浪' })

    const { filter } = useAnalysisNewsStore.getState()
    expect(filter.keyword).toBe('AI')
    expect(filter.category).toBe('科技')
    expect(filter.sentiment).toBe('positive')
    expect(filter.source).toBe('新浪')
  })

  it('selectArticle: 选中/取消选中文章', () => {
    const article = createMockArticle()
    useAnalysisNewsStore.getState().selectArticle(article)
    expect(useAnalysisNewsStore.getState().selectedArticle).toEqual(article)

    useAnalysisNewsStore.getState().selectArticle(null)
    expect(useAnalysisNewsStore.getState().selectedArticle).toBeNull()
  })

  it('fetchArticles: 成功加载文章', async () => {
    const articles = [createMockArticle({ id: '1' })]
    mockListNews.mockResolvedValue({ success: true, data: articles })

    await useAnalysisNewsStore.getState().fetchArticles()

    expect(mockListNews).toHaveBeenCalledTimes(1)
    expect(useAnalysisNewsStore.getState().articles).toHaveLength(1)
    expect(useAnalysisNewsStore.getState().loading).toBe(false)
  })

  it('fetchArticles: 加载中设置 loading 状态', async () => {
    let resolvePromise!: (value: unknown) => void
    mockListNews.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    const fetchPromise = useAnalysisNewsStore.getState().fetchArticles()

    // loading 应该在请求期间为 true
    expect(useAnalysisNewsStore.getState().loading).toBe(true)

    resolvePromise({ success: true, data: [] })
    await fetchPromise

    expect(useAnalysisNewsStore.getState().loading).toBe(false)
  })

  it('reset: 重置到初始状态', () => {
    useAnalysisNewsStore.getState().setArticles([createMockArticle()])
    useAnalysisNewsStore.getState().setFilter({ keyword: 'test', category: '', sentiment: '', source: '' })
    useAnalysisNewsStore.getState().selectArticle(createMockArticle())
    useAnalysisNewsStore.getState().setLoading(true)

    useAnalysisNewsStore.getState().reset()

    const state = useAnalysisNewsStore.getState()
    expect(state.articles).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.filter).toEqual({ keyword: '', category: '', sentiment: '', source: '' })
    expect(state.selectedArticle).toBeNull()
  })
})

// ============================================================
// generateMockArticles — 行 107-139 覆盖
// @test_id V9-TEST-ST-129-EXT-1
// 覆盖分支：PROD 环境短路 / loading 防重入锁 / 保存成功刷新 / 保存失败不刷新
// ============================================================
describe('useAnalysisNewsStore - generateMockArticles', () => {
  it('generateMockArticles: 生产环境应直接返回且不生成 Mock 数据', async () => {
    vi.stubEnv('PROD', true)

    await useAnalysisNewsStore.getState().generateMockArticles()

    expect(mockGenerateMockArticlesSvc).not.toHaveBeenCalled()
    expect(mockSaveNewsArticles).not.toHaveBeenCalled()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[analysisNewsStore] generateMockArticles: 生产环境禁用',
    )
  })

  it('generateMockArticles: loading=true 时应跳过（防重入锁）', async () => {
    useAnalysisNewsStore.getState().setLoading(true)

    await useAnalysisNewsStore.getState().generateMockArticles()

    expect(mockGenerateMockArticlesSvc).not.toHaveBeenCalled()
    expect(mockSaveNewsArticles).not.toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[analysisNewsStore] generateMockArticles skipped: loading=true',
    )
  })

  it('generateMockArticles: 成功路径应生成、保存并刷新列表', async () => {
    const mockArticles = [createMockArticle({ id: 'mock-1' })]
    const savedArticles = [createMockArticle({ id: 'saved-1' })]
    const refreshedArticles = [createMockArticle({ id: 'refresh-1' })]

    mockGenerateMockArticlesSvc.mockReturnValue(mockArticles)
    mockSaveNewsArticles.mockResolvedValue({ success: true, data: savedArticles })
    mockListNews.mockResolvedValue({ success: true, data: refreshedArticles })

    await useAnalysisNewsStore.getState().generateMockArticles()

    // 应调用 service 的 generateMockArticles(5)
    expect(mockGenerateMockArticlesSvc).toHaveBeenCalledWith(5)
    // 应调用 saveNewsArticles 保存
    expect(mockSaveNewsArticles).toHaveBeenCalledWith(mockArticles)
    // 保存成功后应刷新列表（fetchArticles -> listNews）
    expect(mockListNews).toHaveBeenCalledTimes(1)
    // 最终文章列表应为刷新后的数据
    expect(useAnalysisNewsStore.getState().articles).toEqual(refreshedArticles)
    // loading 应恢复为 false
    expect(useAnalysisNewsStore.getState().loading).toBe(false)
    // 应记录保存成功日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[analysisNewsStore] generateMockArticles: saved',
      { count: 1 },
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[analysisNewsStore] generateMockArticles: refreshed list',
    )
  })

  it('generateMockArticles: 保存失败时应记录日志且不刷新列表', async () => {
    const mockArticles = [createMockArticle({ id: 'mock-1' })]

    mockGenerateMockArticlesSvc.mockReturnValue(mockArticles)
    mockSaveNewsArticles.mockResolvedValue({ success: false, error: 'DB 写入失败' })

    await useAnalysisNewsStore.getState().generateMockArticles()

    // 应调用 saveNewsArticles
    expect(mockSaveNewsArticles).toHaveBeenCalledWith(mockArticles)
    // 保存失败不应刷新列表
    expect(mockListNews).not.toHaveBeenCalled()
    // loading 应恢复为 false
    expect(useAnalysisNewsStore.getState().loading).toBe(false)
    // 应记录保存失败日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[analysisNewsStore] generateMockArticles: save failed',
      { error: 'DB 写入失败' },
    )
  })
})

// ============================================================
// computeSentimentTrend — 行 141-164 覆盖
// @test_id V9-TEST-ST-129-EXT-2
// 覆盖分支：global 维度无 value / stock 维度带 value / 空文章列表
// ============================================================
describe('useAnalysisNewsStore - computeSentimentTrend', () => {
  it('computeSentimentTrend: global 维度应调用引擎函数并更新状态', () => {
    const articles = [createMockArticle({ id: '1' })]
    useAnalysisNewsStore.getState().setArticles(articles)

    const mockTrend = {
      dimension: 'global' as const,
      value: '',
      data: [
        {
          date: '2026-01-01',
          positive: 1,
          negative: 0,
          neutral: 0,
          total: 1,
          positiveRatio: 1,
          negativeRatio: 0,
          neutralRatio: 0,
        },
      ],
      summary: {
        totalArticles: 1,
        positiveCount: 1,
        negativeCount: 0,
        neutralCount: 0,
        avgDailyArticles: 1,
      },
    }
    mockExtractStockOptions.mockReturnValue(['AAPL', 'GOOG'])
    mockExtractIndustryOptions.mockReturnValue(['科技', '金融'])
    mockAggregateSentimentTrend.mockReturnValue(mockTrend)

    useAnalysisNewsStore.getState().computeSentimentTrend('global')

    // 应调用选项提取函数
    expect(mockExtractStockOptions).toHaveBeenCalledWith(articles)
    expect(mockExtractIndustryOptions).toHaveBeenCalledWith(articles)
    // 应调用聚合引擎，value 传 undefined（因为未传入 value）
    expect(mockAggregateSentimentTrend).toHaveBeenCalledWith(articles, {
      dimension: 'global',
      value: undefined,
      fillGaps: true,
    })
    // 状态应更新
    const state = useAnalysisNewsStore.getState()
    expect(state.sentimentTrend).toEqual(mockTrend)
    expect(state.sentimentStockOptions).toEqual(['AAPL', 'GOOG'])
    expect(state.sentimentIndustryOptions).toEqual(['科技', '金融'])
  })

  it('computeSentimentTrend: stock 维度带 value 应传递给引擎', () => {
    const articles = [createMockArticle({ id: '1' })]
    useAnalysisNewsStore.getState().setArticles(articles)

    const mockTrend = {
      dimension: 'stock' as const,
      value: 'AAPL',
      data: [],
      summary: {
        totalArticles: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        avgDailyArticles: 0,
      },
    }
    mockExtractStockOptions.mockReturnValue(['AAPL'])
    mockExtractIndustryOptions.mockReturnValue([])
    mockAggregateSentimentTrend.mockReturnValue(mockTrend)

    useAnalysisNewsStore.getState().computeSentimentTrend('stock', 'AAPL')

    expect(mockAggregateSentimentTrend).toHaveBeenCalledWith(articles, {
      dimension: 'stock',
      value: 'AAPL',
      fillGaps: true,
    })
    expect(useAnalysisNewsStore.getState().sentimentTrend).toEqual(mockTrend)
  })

  it('computeSentimentTrend: 空文章列表也应正常执行', () => {
    const mockTrend = {
      dimension: 'industry' as const,
      value: '',
      data: [],
      summary: {
        totalArticles: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        avgDailyArticles: 0,
      },
    }
    mockExtractStockOptions.mockReturnValue([])
    mockExtractIndustryOptions.mockReturnValue([])
    mockAggregateSentimentTrend.mockReturnValue(mockTrend)

    useAnalysisNewsStore.getState().computeSentimentTrend('industry')

    expect(mockAggregateSentimentTrend).toHaveBeenCalledWith([], {
      dimension: 'industry',
      value: undefined,
      fillGaps: true,
    })
    expect(useAnalysisNewsStore.getState().sentimentTrend).toEqual(mockTrend)
    expect(useAnalysisNewsStore.getState().sentimentStockOptions).toEqual([])
  })
})
