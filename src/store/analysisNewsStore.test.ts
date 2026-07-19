/**
 * @test_id V9-TEST-ST-129
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { NewsArticle } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))

const mockListNews = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/services/news/newsService', () => ({
  listNews: (...args: unknown[]) => mockListNews(...args),
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
