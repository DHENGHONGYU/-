import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WatchlistMoversWidget from './WatchlistMoversWidget'
import * as MarketDataProvider from '@/cockpit/providers/MarketDataProvider'
import type { MarketData, WidgetConfig } from '@/types/modules/widget.types'

const baseConfig: WidgetConfig = {
  instanceId: 'wm-1',
  widgetId: 'watchlistMovers',
  title: '自选股异动',
  size: { cols: 1, rows: 1 },
  settings: {},
  visible: true,
  collapsed: false,
}

function mockMarketData(partial: Partial<MarketData> = {}, loading = false, error?: string) {
  const data: MarketData = {
    timestamp: Date.now(),
    indices: [],
    sectors: [],
    fundFlows: [],
    sentiment: {
      fearGreedIndex: 50,
      fearGreedLabel: '中性',
      totalStocks: 0,
      up: 0,
      down: 0,
      flat: 0,
      limitUp: 0,
      limitDown: 0,
    },
    watchlist: [],
    portfolio: {
      totalAssets: '0',
      availableFunds: '0',
      todayPnL: '0',
      todayPnLPercent: 0,
      totalPnL: '0',
      totalPnLPercent: 0,
      holdings: 0,
      holdingsList: [],
      rebalancePlan: [],
      maxDrawdown: 0,
      sharpeRatio: 0,
    },
    tradeReview: {
      totalTrades: 0,
      profitable: 0,
      losing: 0,
      winRate: 0,
      profitLossRatio: 0,
      disciplineScore: 0,
    },
    analysisScores: {
      profile: { tags: [], metrics: [] },
      kai: {
        totalScore: 0,
        sentiment: 0,
        trend: 0,
        flow: 0,
        dimensions: [],
        detailDistribution: [],
      },
    },
    modelComparison: {
      leftModel: { id: '', name: '', version: '', score: 0 },
      rightModel: { id: '', name: '', version: '', score: 0 },
      dimensions: [],
      riskHint: '',
    },
    poolBoard: { items: [], total: 0, page: 1, pageSize: 20 },
    chatHistory: { target: '', targetType: 'stock', messages: [] },
    hotSectors: [],
    valuePit: [],
    ...partial,
  }
  vi.spyOn(MarketDataProvider, 'useMarketData').mockReturnValue({
    data,
    loadingMap: { 'wm-1': loading },
    errorMap: { 'wm-1': error ?? null },
    refreshWidget: vi.fn(),
    getTaskStats: () => ({ total: 0, running: 0, error: 0 }),
    sendChatMessage: vi.fn().mockResolvedValue({ id: '1', role: 'assistant', content: '', timestamp: Date.now() }),
  })
}

describe('WatchlistMoversWidget', () => {
  it('renders loading skeleton when loading', () => {
    mockMarketData({}, true)
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('自选股异动')).toBeInTheDocument()
  })

  it('renders error state', () => {
    mockMarketData({}, false, '行情加载失败')
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('行情加载失败')).toBeInTheDocument()
  })

  it('renders top gainers and losers', () => {
    mockMarketData({
      watchlist: [
        { code: '600519.SH', name: '贵州茅台', price: 1700, changePercent: 2.5 },
        { code: '000001.SZ', name: '平安银行', price: 12.5, changePercent: -1.8 },
        { code: '000333.SZ', name: '美的集团', price: 58.2, changePercent: 0.5 },
      ],
    })
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('涨幅榜')).toBeInTheDocument()
    expect(screen.getByText('跌幅榜')).toBeInTheDocument()
    expect(screen.getByText('振幅榜')).toBeInTheDocument()
    expect(screen.getAllByText('贵州茅台').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('平安银行').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty text when no movers', () => {
    mockMarketData({ watchlist: [] })
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('暂无上涨标的')).toBeInTheDocument()
    expect(screen.getByText('暂无下跌标的')).toBeInTheDocument()
    expect(screen.getByText('暂无活跃标的')).toBeInTheDocument()
  })
})
