import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import NewsV6Page from './NewsV6Page'
import type { NewsArticle } from '@/types'

// ------------------------------------------------------------------
// vi.hoisted mocks
// ------------------------------------------------------------------

const mockFetchArticles = vi.hoisted(() => vi.fn())
const mockGenerateMockArticles = vi.hoisted(() => vi.fn())
const mockSelectArticle = vi.hoisted(() => vi.fn())
const mockSetFilter = vi.hoisted(() => vi.fn())

const mockArticles: NewsArticle[] = [
  {
    id: 'news-v6-1',
    title: 'V6 试点：半导体板块景气回升',
    content: '多家机构调研显示半导体设备订单环比改善，国产替代进程加速推进。',
    url: 'https://example.com/1',
    source: '财经日报',
    category: '行业',
    publishTime: '2026-08-18T08:00:00.000Z',
    fetchTime: '2026-08-18T08:01:00.000Z',
    sentiment: 'positive',
    sentimentConfidence: 0.82,
    relatedStocks: ['600519', '000858'],
    keywords: ['半导体', '景气'],
    hash: 'abc123',
  },
  {
    id: 'news-v6-2',
    title: '政策利好：新能源汽车补贴延续',
    content: '相关部门明确延续新能源汽车购置补贴，产业链上下游受益。',
    url: 'https://example.com/2',
    source: '政策快讯',
    category: '政策',
    publishTime: '2026-08-18T07:30:00.000Z',
    fetchTime: '2026-08-18T07:31:00.000Z',
    sentiment: 'neutral',
    sentimentConfidence: 0.5,
    relatedStocks: [],
    keywords: ['新能源'],
    hash: 'def456',
  },
]

const mockState = vi.hoisted(() => ({
  articles: [] as NewsArticle[],
  loading: false,
  filter: { keyword: '', category: '', sentiment: '', source: '' },
  selectedArticle: null as NewsArticle | null,
}))

vi.mock('@/store/analysisNewsStore', () => ({
  useAnalysisNewsStore: (selector: (s: typeof mockState) => unknown) => {
    const s = {
      ...mockState,
      setFilter: mockSetFilter,
      selectArticle: mockSelectArticle,
      fetchArticles: mockFetchArticles,
      generateMockArticles: mockGenerateMockArticles,
    }
    return selector(s)
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return {
    ...actual,
    Sparkles: () => <svg data-testid="icon-sparkles" />,
    RefreshCw: () => <svg data-testid="icon-refresh" />,
    Newspaper: () => <svg data-testid="icon-newspaper" />,
    Layers: () => <svg data-testid="icon-layers" />,
  }
})

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  }
})

vi.mock('@/components/organisms/news/NewsFilterPanel', () => ({
  NewsFilterPanel: ({ filter, onChange }: { filter: unknown; onChange: (f: unknown) => void }) => (
    <div data-testid="news-filter-panel" onClick={() => onChange(filter)}>
      过滤面板
    </div>
  ),
}))

vi.mock('@/components/organisms/analysis/news/NewsSentimentTrend', () => ({
  NewsSentimentTrend: () => <div data-testid="news-sentiment-trend">情感趋势</div>,
}))

vi.mock('@/components/molecules/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@/components/molecules/Dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('NewsV6Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.articles = []
    mockState.loading = false
    mockState.filter = { keyword: '', category: '', sentiment: '', source: '' }
    mockState.selectedArticle = null
  })

  it('渲染标题与 V6 标识', () => {
    render(
      <MemoryRouter>
        <NewsV6Page />
      </MemoryRouter>,
    )
    // "智能资讯 V6" 同时出现在面包屑与页头
    expect(screen.getAllByText('智能资讯 V6').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('News V6')).toBeTruthy()
  })

  it('初始化时调用 fetchArticles', () => {
    render(
      <MemoryRouter>
        <NewsV6Page />
      </MemoryRouter>,
    )
    expect(mockFetchArticles).toHaveBeenCalledTimes(1)
  })

  it('有资讯时渲染分类色标签与情感色边框内容', () => {
    mockState.articles = mockArticles
    render(
      <MemoryRouter>
        <NewsV6Page />
      </MemoryRouter>,
    )
    expect(screen.getByText('V6 试点：半导体板块景气回升')).toBeTruthy()
    expect(screen.getByText('政策利好：新能源汽车补贴延续')).toBeTruthy()
    // V6 分类配色标签
    const industryBadge = screen.getByText('行业')
    expect(industryBadge.className).toContain('bg-purple-100')
    // 情感趋势组件随 articles>0 渲染
    expect(screen.getByTestId('news-sentiment-trend')).toBeTruthy()
  })

  it('无资讯时显示空状态', () => {
    mockState.articles = []
    render(
      <MemoryRouter>
        <NewsV6Page />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })

  it('点击资讯卡片触发 selectArticle', () => {
    mockState.articles = mockArticles
    render(
      <MemoryRouter>
        <NewsV6Page />
      </MemoryRouter>,
    )
    const card = screen.getByText('V6 试点：半导体板块景气回升').closest('[role="button"]') as HTMLElement
    fireEvent.click(card)
    expect(mockSelectArticle).toHaveBeenCalledWith(mockArticles[0])
  })

  it('点击生成模拟资讯触发 generateMockArticles', async () => {
    render(
      <MemoryRouter>
        <NewsV6Page />
      </MemoryRouter>,
    )
    const btn = screen.getByText('生成模拟资讯') as HTMLElement
    fireEvent.click(btn)
    await waitFor(() => expect(mockGenerateMockArticles).toHaveBeenCalledTimes(1))
  })
})
