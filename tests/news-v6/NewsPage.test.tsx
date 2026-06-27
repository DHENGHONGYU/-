import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import NewsPage from '@/pages/news-v6/NewsPage'
import type { V6NewsArticle } from '@/pages/news-v6/types'

const mockArticles: V6NewsArticle[] = [
  {
    id: 'news_1',
    title: '贵州茅台年报超预期',
    content: '600519贵州茅台发布年报，全年盈利大幅增长。',
    url: 'https://mock.news/1',
    source: 'mock',
    category: '个股',
    publishTime: new Date().toISOString(),
    fetchTime: new Date().toISOString(),
    sentiment: 0.8,
    sentimentConfidence: 0.9,
    relatedStocks: ['600519.SH'],
    keywords: ['白酒'],
    hash: 'hash1',
  },
  {
    id: 'news_2',
    title: '银行板块承压',
    content: '受降息预期影响，银行板块整体下跌。',
    url: 'https://mock.news/2',
    source: 'mock',
    category: '行业',
    publishTime: new Date().toISOString(),
    fetchTime: new Date().toISOString(),
    sentiment: -0.7,
    sentimentConfidence: 0.8,
    relatedStocks: ['601398.SH'],
    keywords: ['银行'],
    hash: 'hash2',
  },
]

const mockSetArticles = vi.fn()
const mockAppendArticles = vi.fn()
const mockSetLoading = vi.fn()
const mockSetError = vi.fn()
const mockSetHasMore = vi.fn()
const mockSetCurrentOffset = vi.fn()
const mockSelectArticle = vi.fn()
const mockSetFilter = vi.fn()
const mockInitBookmarks = vi.fn().mockResolvedValue(undefined)
const mockInitSubscriptions = vi.fn().mockReturnValue(vi.fn())

let storeState = {
  articles: [] as V6NewsArticle[],
  loading: false,
  error: null as string | null,
  hasMore: false,
  currentOffset: 0,
  selectedArticle: null as V6NewsArticle | null,
  bookmarkedIds: new Set<string>(),
  filter: {
    category: 'all',
    sentiment: 'all',
    source: 'all',
    stockCode: '',
    dateRange: 'all',
    searchQuery: '',
    sortBy: 'time' as const,
  },
  searchInput: '',
  showFilter: false,
  displayCount: 20,
}

vi.mock('@/store/newsStore', () => ({
  useNewsStore: () => ({
    ...storeState,
    setArticles: mockSetArticles,
    appendArticles: mockAppendArticles,
    setLoading: mockSetLoading,
    setError: mockSetError,
    setHasMore: mockSetHasMore,
    setCurrentOffset: mockSetCurrentOffset,
    selectArticle: mockSelectArticle,
    setFilter: mockSetFilter,
    initBookmarks: mockInitBookmarks,
  }),
  initNewsStoreSubscriptions: () => mockInitSubscriptions(),
}))

const mockListNews = vi.fn()
const mockSaveNewsArticles = vi.fn()
const mockGenerateMockArticles = vi.fn()

vi.mock('@/services/news/newsService', () => ({
  listNews: (...args: unknown[]) => mockListNews(...args),
  saveNewsArticles: (...args: unknown[]) => mockSaveNewsArticles(...args),
  generateMockArticles: (...args: unknown[]) => mockGenerateMockArticles(...args),
}))

function resetStore() {
  storeState = {
    articles: [],
    loading: false,
    error: null,
    hasMore: false,
    currentOffset: 0,
    selectedArticle: null,
    bookmarkedIds: new Set<string>(),
    filter: {
      category: 'all',
      sentiment: 'all',
      source: 'all',
      stockCode: '',
      dateRange: 'all',
      searchQuery: '',
      sortBy: 'time',
    },
    searchInput: '',
    showFilter: false,
    displayCount: 20,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NewsPage />
    </MemoryRouter>,
  )
}

describe('news-v6/NewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
    mockListNews.mockResolvedValue({ success: true, data: [] })
    mockSaveNewsArticles.mockResolvedValue({ success: true, data: mockArticles })
    mockGenerateMockArticles.mockReturnValue(mockArticles)
  })

  it('初始加载空状态时显示标题与空提示', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '智能资讯中心' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('暂无资讯')).toBeInTheDocument()
    })
  })

  it('加载数据成功后渲染资讯列表', async () => {
    storeState.articles = mockArticles
    storeState.hasMore = false
    mockListNews.mockResolvedValue({ success: true, data: mockArticles.map((a) => ({ ...a, sentiment: 'positive' as const })) })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('贵州茅台年报超预期')).toBeInTheDocument()
      expect(screen.getByText('银行板块承压')).toBeInTheDocument()
    })
  })

  it('生成模拟数据按钮触发 seed 与 reload', async () => {
    renderPage()
    const button = screen.getByRole('button', { name: /生成模拟数据/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(mockGenerateMockArticles).toHaveBeenCalledWith(15)
      expect(mockSaveNewsArticles).toHaveBeenCalled()
    })
  })

  it('点击文章卡片打开详情弹窗', async () => {
    const firstArticle = mockArticles[0]
    if (!firstArticle) throw new Error('No mock article available')
    storeState.articles = [firstArticle]
    storeState.hasMore = false

    renderPage()

    const card = await screen.findByText('贵州茅台年报超预期')
    await userEvent.click(card)

    await waitFor(() => {
      expect(mockSelectArticle).toHaveBeenCalledWith(firstArticle)
    })
  })

  it('加载失败时显示错误提示与重试按钮', async () => {
    storeState.error = '网络异常'
    storeState.hasMore = false

    renderPage()

    expect(screen.getByText('加载失败')).toBeInTheDocument()
    expect(screen.getByText('网络异常')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('组件卸载时清理 DataBridge 订阅', async () => {
    const cleanup = vi.fn()
    mockInitSubscriptions.mockReturnValue(cleanup)

    const { unmount } = renderPage()
    unmount()

    expect(mockInitSubscriptions).toHaveBeenCalledTimes(1)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
