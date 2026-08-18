import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import NewsPage from '@/pages/analysis/NewsPage'
import type { NewsArticle } from '@/data/types'
import { UI_TEXT } from '@/constants/uiText'

const mockArticles: NewsArticle[] = [
  {
    id: 'news_1',
    title: '贵州茅台年报超预期，白酒板块强劲上涨',
    content: '600519贵州茅台发布年报，全年盈利大幅增长。',
    url: 'https://mock.news/1',
    source: 'mock',
    category: '个股',
    sentiment: 'positive',
    sentimentConfidence: 0.9,
    publishTime: new Date().toISOString(),
    fetchTime: new Date().toISOString(),
    relatedStocks: ['600519.SH'],
    keywords: ['白酒'],
    hash: 'hash1',
  },
  {
    id: 'news_2',
    title: '银行板块承压，工商银行息差收窄',
    content: '受降息预期影响，银行板块整体下跌。',
    url: 'https://mock.news/2',
    source: 'mock',
    category: '行业',
    sentiment: 'negative',
    sentimentConfidence: 0.8,
    publishTime: new Date().toISOString(),
    fetchTime: new Date().toISOString(),
    relatedStocks: ['601398.SH'],
    keywords: ['银行'],
    hash: 'hash2',
  },
]

let articlesStore: NewsArticle[] = []

vi.mock('@/services/news/newsService', () => ({
  generateMockArticles: vi.fn(() => mockArticles),
  saveNewsArticles: vi.fn(async (articles: NewsArticle[]) => {
    articlesStore = [...articles]
    return { success: true, data: articles }
  }),
  listNews: vi.fn(async () => {
    return { success: true, data: articlesStore }
  }),
}))

describe('NewsPage', () => {
  beforeEach(() => {
    articlesStore = []
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  })

  it('renders empty state', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '智能资讯' })).toBeInTheDocument()
    expect(await screen.findByText('暂无资讯')).toBeInTheDocument()
  })

  it('generates mock articles and displays cards', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /生成模拟资讯/i })[0])

    await waitFor(
      () => {
        expect(screen.queryByText('暂无资讯')).not.toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    const cards = await screen.findAllByRole('button', { name: /(贵州茅台|银行板块)/ })
    expect(cards.length).toBeGreaterThan(0)
  })

  it('filters by sentiment', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /生成模拟资讯/i })[0])
    await waitFor(
      () => {
        expect(screen.queryByText('暂无资讯')).not.toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    const allCards = await screen.findAllByRole('button', { name: /(贵州茅台|银行板块)/ })
    expect(allCards.length).toBe(2)

    await userEvent.selectOptions(screen.getByLabelText(UI_TEXT.analysis.news.sentiment), 'negative')

    await waitFor(() => {
      const negativeCards = screen.getAllByRole('button', { name: /银行板块/ })
      expect(negativeCards.length).toBe(1)
    })
  })

  it('opens dialog with full content when clicking a card', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /生成模拟资讯/i })[0])
    await waitFor(
      () => {
        expect(screen.queryByText('暂无资讯')).not.toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    const card = await screen.findByRole('button', { name: /贵州茅台/ })
    await userEvent.click(card)

    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('贵州茅台年报超预期，白酒板块强劲上涨')).toBeInTheDocument()
    expect(within(dialog).getByText(/600519贵州茅台发布年报/)).toBeInTheDocument()
  })
})
