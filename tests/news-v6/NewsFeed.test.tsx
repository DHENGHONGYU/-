import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewsFeed from '@/pages/news-v6/components/NewsFeed'
import type { V6NewsArticle } from '@/pages/news-v6/types'

const mockArticles: V6NewsArticle[] = [
  {
    id: 'news_1',
    title: '贵州茅台年报超预期',
    content: '600519贵州茅台发布年报。',
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

const mockSetFilter = vi.fn()
const mockSetSearchInput = vi.fn()
const mockSetShowFilter = vi.fn()
const mockSetDisplayCount = vi.fn()
const mockResetDisplay = vi.fn()
const mockToggleBookmark = vi.fn()

let storeState = {
  articles: [] as V6NewsArticle[],
  loading: false,
  hasMore: false,
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
    setFilter: mockSetFilter,
    setSearchInput: mockSetSearchInput,
    setShowFilter: mockSetShowFilter,
    setDisplayCount: mockSetDisplayCount,
    resetDisplay: mockResetDisplay,
    toggleBookmark: mockToggleBookmark,
  }),
}))

function resetStore() {
  storeState = {
    articles: [],
    loading: false,
    hasMore: false,
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

const defaultProps = {
  onLoadMore: vi.fn(),
  onRefresh: vi.fn(),
  onFilterChange: vi.fn(),
  onArticleClick: vi.fn(),
  pageSize: 20,
}

function renderFeed(props = {}) {
  return render(<NewsFeed {...defaultProps} {...props} />)
}

describe('news-v6/NewsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('空状态显示提示', () => {
    renderFeed()
    expect(screen.getByText('暂无资讯')).toBeInTheDocument()
    expect(screen.getByText('试试调整筛选条件或稍后刷新')).toBeInTheDocument()
  })

  it('渲染文章列表', () => {
    storeState.articles = mockArticles
    storeState.displayCount = 20
    renderFeed()

    expect(screen.getByText('贵州茅台年报超预期')).toBeInTheDocument()
    expect(screen.getByText('银行板块承压')).toBeInTheDocument()
  })

  it('加载中状态显示 spinner', () => {
    storeState.loading = true
    renderFeed()

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('点击刷新按钮触发 onRefresh', async () => {
    renderFeed()
    const refreshButton = screen.getByRole('button', { name: '' }).closest('button') ?? screen.getAllByRole('button')[2]
    await userEvent.click(refreshButton)

    await waitFor(() => {
      expect(defaultProps.onRefresh).toHaveBeenCalled()
      expect(mockResetDisplay).toHaveBeenCalled()
    })
  })

  it('点击加载更多触发 onLoadMore', async () => {
    storeState.articles = mockArticles
    storeState.displayCount = 1
    storeState.hasMore = true
    renderFeed()

    const loadMoreButton = screen.getByRole('button', { name: '加载更多' })
    await userEvent.click(loadMoreButton)

    await waitFor(() => {
      expect(defaultProps.onLoadMore).toHaveBeenCalled()
    })
  })

  it('搜索输入变更时立即更新 searchInput', async () => {
    renderFeed()
    const searchInput = screen.getByPlaceholderText('搜索标题、内容、股票代码...')

    fireEvent.change(searchInput, { target: { value: '茅台' } })

    await waitFor(() => {
      expect(mockSetSearchInput).toHaveBeenCalledWith('茅台')
    })
  })

  it('筛选按钮切换 showFilter', async () => {
    renderFeed()
    const filterButton = screen.getByRole('button', { name: '筛选' })

    await userEvent.click(filterButton)
    expect(mockSetShowFilter).toHaveBeenCalledWith(true)
  })

  it('情感分布统计正确显示', () => {
    storeState.articles = mockArticles
    renderFeed()

    expect(screen.getByText('看多 1')).toBeInTheDocument()
    expect(screen.getByText('看空 1')).toBeInTheDocument()
    expect(screen.getByText('中性 0')).toBeInTheDocument()
  })
})
