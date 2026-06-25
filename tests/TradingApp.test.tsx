import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradingApp from '@/apps/trading/TradingApp'
import * as tradingService from '@/services/trading/tradingService'

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
import * as portfolioBuilder from '@/services/trading/portfolioBuilder'
import type { Stock, Order, Portfolio, StrategyResult } from '@/data/types'
import type { TradeAdvice } from '@/services/trading/tradingService'
import type { TradingSignal } from '@/services/trading/signalGenerator'

const mockStock: Stock = {
  symbol: '000001.SZ',
  name: '平安银行',
  researchStatus: 'watching',
  source: 'manual',
  dataVersion: 1,
  price: 100,
}

const mockBuyAdvice: TradeAdvice = {
  signal: {
    id: 'sig-1',
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'buy_dip',
    confidence: 0.65,
    rationale: '超卖',
    snapshot: {},
    createdAt: Date.now(),
  },
  sizing: {
    action: 'buy',
    targetShares: 500,
    targetValue: 50_000,
    positionPct: 0.05,
    kellyPct: 0.2,
    roundedDown: false,
    cappedBy: 'none',
  },
  risk: {
    ok: true,
    warnings: [],
    blocks: [],
  },
}

const mockSellAdvice: TradeAdvice = {
  signal: {
    id: 'sig-2',
    symbol: '000001.SZ',
    direction: 'sell',
    type: 'sell_profit_taking',
    confidence: 0.7,
    rationale: '超买',
    snapshot: {},
    createdAt: Date.now(),
  },
  sizing: {
    action: 'sell',
    targetShares: 800,
    targetValue: 80_000,
    positionPct: 0.08,
    kellyPct: 0,
    roundedDown: false,
    cappedBy: 'none',
  },
  risk: {
    ok: true,
    warnings: [],
    blocks: [],
  },
}

const mockHoldingOrder: Order = {
  id: 'order-1',
  symbol: '000001.SZ',
  direction: 'buy',
  quantity: 1000,
  price: 90,
  amount: 90_000,
  status: 'filled',
  accountType: 'paper',
  createdAt: Date.now() - 25 * 60 * 60 * 1000,
}

const mockSignal: TradingSignal = {
  id: 'sig-3',
  symbol: '000001.SZ',
  direction: 'buy',
  type: 'buy_pivot',
  confidence: 0.75,
  rationale: '突破均线，放量上涨',
  snapshot: {},
  createdAt: Date.now(),
}

const mockWarningAdvice: TradeAdvice = {
  signal: {
    id: 'sig-4',
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'buy_dip',
    confidence: 0.6,
    rationale: '回调买入',
    snapshot: {},
    createdAt: Date.now(),
  },
  sizing: {
    action: 'buy',
    targetShares: 500,
    targetValue: 50_000,
    positionPct: 0.05,
    kellyPct: 0.2,
    roundedDown: false,
    cappedBy: 'none',
  },
  risk: {
    ok: true,
    warnings: ['仓位接近单笔上限'],
    blocks: [],
  },
}

const mockBlockedAdvice: TradeAdvice = {
  signal: {
    id: 'sig-5',
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'buy_dip',
    confidence: 0.6,
    rationale: '回调买入',
    snapshot: {},
    createdAt: Date.now(),
  },
  sizing: {
    action: 'buy',
    targetShares: 500,
    targetValue: 50_000,
    positionPct: 0.05,
    kellyPct: 0.2,
    roundedDown: false,
    cappedBy: 'none',
  },
  risk: {
    ok: false,
    warnings: [],
    blocks: ['今日交易次数已达上限 5'],
  },
}

describe('TradingApp', () => {
  beforeEach(() => {
    vi.spyOn(tradingService, 'getWatchlistStocks').mockResolvedValue({
      success: true,
      data: [mockStock],
    })
    vi.spyOn(tradingService, 'getOrders').mockResolvedValue({
      success: true,
      data: [],
    })
    vi.spyOn(tradingService, 'createBuyOrder').mockResolvedValue({
      success: true,
      data: undefined as never,
    })
    vi.spyOn(tradingService, 'createSellOrder').mockResolvedValue({
      success: true,
      data: undefined as never,
    })
    vi.spyOn(tradingService, 'scanWatchingSignals').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders initial action buttons', () => {
    render(<TradingApp />)
    expect(screen.getByRole('button', { name: /加载观察池/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /加载持仓/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /扫描信号/i })).toBeInTheDocument()
  })

  it('loads watchlist and displays advice', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))

    await waitFor(() => {
      expect(screen.getByText('000001.SZ')).toBeInTheDocument()
    })
    expect(screen.getByText('BUY')).toBeInTheDocument()
  })

  it('buy button uses advice target shares when advice action is buy', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    await userEvent.click(screen.getByRole('button', { name: /买入/i }))

    await waitFor(() => {
      expect(vi.mocked(tradingService.createBuyOrder)).toHaveBeenCalledWith(mockStock, 500)
    })
  })

  it('sell button uses holding shares, not buy advice target shares', async () => {
    // 模拟最强信号为买入，但用户持有 1000 股；卖出时应按持仓数量而非买入建议的 500 股
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })
    vi.spyOn(tradingService, 'getOrders').mockResolvedValue({
      success: true,
      data: [mockHoldingOrder],
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))
    await userEvent.click(screen.getByRole('button', { name: /加载持仓/i }))
    await waitFor(() => screen.getByText(/1000股/))

    await userEvent.click(screen.getByRole('button', { name: /卖出/i }))

    await waitFor(() => {
      expect(vi.mocked(tradingService.createSellOrder)).toHaveBeenCalledWith(mockStock, 1000)
    })
  })

  it('sell button uses sell advice target shares when advice action is sell', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockSellAdvice,
    })
    vi.spyOn(tradingService, 'getOrders').mockResolvedValue({
      success: true,
      data: [mockHoldingOrder],
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    await userEvent.click(screen.getByRole('button', { name: /卖出/i }))

    await waitFor(() => {
      expect(vi.mocked(tradingService.createSellOrder)).toHaveBeenCalledWith(mockStock, 800)
    })
  })

  it('falls back to default lot when buy advice action is not buy', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: {
        ...mockBuyAdvice,
        sizing: { ...mockBuyAdvice.sizing, action: 'hold' as const, targetShares: 0 },
      },
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    await userEvent.click(screen.getByRole('button', { name: /买入/i }))

    await waitFor(() => {
      expect(vi.mocked(tradingService.createBuyOrder)).toHaveBeenCalledWith(mockStock, 100)
    })
  })

  it('loads orders and displays holdings when clicking 加载持仓', async () => {
    vi.spyOn(tradingService, 'getOrders').mockResolvedValue({
      success: true,
      data: [mockHoldingOrder],
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载持仓/i }))

    await waitFor(() => {
      expect(screen.getByText(/1000股/)).toBeInTheDocument()
    })
    expect(screen.getByText(/filled/)).toBeInTheDocument()
  })

  it('scans signals and displays them when clicking 扫描信号', async () => {
    vi.spyOn(tradingService, 'scanWatchingSignals').mockResolvedValue([mockSignal])

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /扫描信号/i }))

    await waitFor(() => {
      expect(screen.getByText('全部信号 (1)')).toBeInTheDocument()
    })
    expect(screen.getByText('BUY')).toBeInTheDocument()
    expect(screen.getByText(/突破均线/)).toBeInTheDocument()
  })

  it('displays complete stock advice card information', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    const card = screen.getByText('000001.SZ').closest('.rounded-md') as HTMLElement
    expect(within(card).getByText('平安银行')).toBeInTheDocument()
    expect(within(card).getByText('watching')).toBeInTheDocument()
    expect(within(card).getByText('BUY')).toBeInTheDocument()
    expect(within(card).getByText(/buy_dip/)).toBeInTheDocument()
    expect(within(card).getByText(/65%/)).toBeInTheDocument()
    expect(within(card).getByText(/超卖/)).toBeInTheDocument()
    expect(within(card).getByText(/建议：buy 500 股/)).toBeInTheDocument()
  })

  it('displays risk warnings', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockWarningAdvice,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    expect(screen.getByText(/风控提示：仓位接近单笔上限/)).toBeInTheDocument()
  })

  it('displays risk blocks', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBlockedAdvice,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    expect(screen.getByText(/风控阻塞：今日交易次数已达上限 5/)).toBeInTheDocument()
  })

  it('shows message after loading watchlist', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))

    await waitFor(() => {
      expect(screen.getByText(/观察池与交易建议已更新/)).toBeInTheDocument()
    })
  })

  it('renders multiple stocks', async () => {
    const stock2: Stock = { ...mockStock, symbol: '000002.SZ', name: '万科A' }
    vi.spyOn(tradingService, 'getWatchlistStocks').mockResolvedValue({
      success: true,
      data: [mockStock, stock2],
    })
    vi.spyOn(tradingService, 'adviseForStock').mockImplementation(async (stock) => ({
      success: true,
      data: { ...mockBuyAdvice, signal: { ...mockBuyAdvice.signal, symbol: stock.symbol } },
    }))

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))

    await waitFor(() => {
      expect(screen.getByText('000001.SZ')).toBeInTheDocument()
      expect(screen.getByText('000002.SZ')).toBeInTheDocument()
      expect(screen.getByText('万科A')).toBeInTheDocument()
    })
  })

  it('updates message when buy order fails', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })
    vi.spyOn(tradingService, 'createBuyOrder').mockResolvedValue({
      success: false,
      error: '风控未通过：单笔上限',
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /加载观察池/i }))
    await waitFor(() => screen.getByText('000001.SZ'))

    await userEvent.click(screen.getByRole('button', { name: /买入/i }))

    await waitFor(() => {
      expect(screen.getByText(/风控未通过：单笔上限/)).toBeInTheDocument()
    })
  })

  it('builds and displays core resource portfolio', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    const mockPortfolio: Portfolio = {
      id: 'test',
      name: '第四次工业革命稀缺核心资源',
      theme: 'fourth-industrial-revolution-core-resource',
      totalValue: 1_000_000,
      cashReserve: 40_000,
      holdings: [
        {
          symbol: '002371.SZ',
          name: '北方华创',
          currentShares: 0,
          currentWeight: 0,
          targetWeight: 0.125,
          targetShares: 400,
          price: 300,
          marketValue: 120_000,
          score: 4.5,
          rationale: 'V6自动评分 4.5',
        },
      ],
      rebalancePlan: [
        {
          symbol: '002371.SZ',
          action: 'buy',
          shares: 400,
          reason: '目标 400 股，当前 0 股，需补仓',
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const mockStrategyResult: StrategyResult = {
      selected: [],
      coreScarce: [],
      valueBargain: [],
      hotMomentum: [],
      rejected: [],
      summary: {
        total: 1,
        selectedCount: 1,
        coreScarceCount: 1,
        valueBargainCount: 0,
        hotMomentumCount: 0,
      },
    }

    vi.spyOn(portfolioBuilder, 'buildStrategyFilteredPortfolio').mockResolvedValue({
      portfolio: mockPortfolio,
      strategyResult: mockStrategyResult,
    })

    render(<TradingApp />)
    await userEvent.click(screen.getByRole('button', { name: /构建核心组合/i }))

    await waitFor(() => {
      expect(screen.getByText('北方华创')).toBeInTheDocument()
      expect(screen.getByText('买入 400')).toBeInTheDocument()
      expect(screen.getByText('20进13入选')).toBeInTheDocument()
    })
  })
})
