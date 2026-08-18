import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import * as tradingService from '@/services/trading/tradingService'

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// 必须在 TradingApp / portfolioStore 之前 hoisted mock，否则模块加载时 portfolioStore
// 会捕获原始 buildStrategyFilteredPortfolio 引用，导致 vi.spyOn 无法生效。
const mockBuildStrategyFilteredPortfolio = vi.hoisted(() => vi.fn())
const mockComputeHoldingsFromOrders = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/portfolioBuilder', () => ({
  buildStrategyFilteredPortfolio: mockBuildStrategyFilteredPortfolio,
  computeHoldingsFromOrders: mockComputeHoldingsFromOrders,
}))

const mockLoadPortfolioInput = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/portfolioService', () => ({
  loadPortfolioInput: mockLoadPortfolioInput,
}))

import TradingApp from '@/apps/trading/TradingApp'
import type { Stock, Order, Portfolio, StrategyResult } from '@/data/types'
import type { TradeAdvice } from '@/services/trading/tradingService'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import { useWatchlistStore } from '@/store/watchlistStore'
import { useSignalAdviceStore } from '@/store/signalAdviceStore'
import { usePortfolioStore } from '@/store/portfolioStore'
import { useOrderStore } from '@/store/orderStore'
import { useTradingStore } from '@/store/tradingStore'

// 合并自 src/apps/trading/TradingApp.test.tsx：保留路由分发用例（ExecutionPlanPanel 渲染断言）。
// 仅 mock 面板组件本身，不影响下方 15 个功能用例所依赖的 executionStore 真实模块。
const executionPlanPanelRendered = vi.fn()
vi.mock('@/apps/trading/panels/ExecutionPlanPanel', () => ({
  ExecutionPlanPanel: function MockExecutionPlanPanel() {
    executionPlanPanelRendered()
    return <div data-testid="execution-plan-panel">ExecutionPlanPanel</div>
  },
}))

const mockStock: Stock = {
  symbol: '000001.SZ',
  name: '平安银行',
  researchStatus: 'watching',
  source: 'manual',
  pool: 'research',
  dataVersion: 1,
  price: 100,
}

const mockBuyAdvice: TradeAdvice = {
  signal: {
    id: 'sig-1',
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'buy_dip',
    strategy: 'test',
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
    strategy: 'test',
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
  strategy: 'test',
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
    strategy: 'test',
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
    strategy: 'test',
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
    // 重置所有子 Store 状态，防止 isRefreshing 等状态跨测试残留
    useWatchlistStore.setState({ stocks: [], loading: false, isRefreshing: false, error: null, lastUpdated: 0 })
    useSignalAdviceStore.setState({ adviceMap: {}, signals: [], loading: false, isRefreshing: false })
    usePortfolioStore.setState({ portfolio: undefined, strategyResult: undefined, loading: false })
    useOrderStore.setState({ orders: [], loading: false, isRefreshing: false })
    useTradingStore.setState({
      stocks: [],
      orders: [],
      signals: [],
      adviceMap: {},
      portfolio: undefined,
      strategyResult: undefined,
      portfolioLoading: false,
      processingSymbols: new Set(),
      message: '',
      isRefreshing: false,
    })

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
    // 默认 mock 建议生成，保证首屏自动 loadStocks 能完成（否则真实 adviseForStock 抛错导致观察池不渲染）
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    // 防止 loadPortfolio 内部调用 loadOrders 时触发真实 dataLayer DB 查询而挂起
    vi.spyOn(useOrderStore.getState(), 'refresh').mockResolvedValue(undefined)

    // loadPortfolioInput 走真实 DataBridge 会需要初始化 IndexedDB，mock 为直接返回输入
    mockLoadPortfolioInput.mockResolvedValue({ stocks: [], orders: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('renders initial action buttons', () => {
    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('button', { name: /加载观察池/i })[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /加载持仓/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /扫描信号/i })).toBeInTheDocument()
  })

  it('loads watchlist and displays advice', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])

    await waitFor(() => {
      expect(screen.getByText('000001.SZ')).toBeInTheDocument()
    })
    expect(screen.getAllByText('买入').length).toBeGreaterThan(0)
  })

  it('buy button uses advice target shares when advice action is buy', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
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

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
    await waitFor(() => screen.getByText('000001.SZ'))

    // 直接设置 orderStore 状态，因为 orderStore.refresh() 从 dataLayer 读取
    useOrderStore.setState({
      orders: [mockHoldingOrder],
      loading: false,
      isRefreshing: false,
      error: null,
    })
    useTradingStore.setState({ orders: [mockHoldingOrder] })

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

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
    await waitFor(() => screen.getByText('000001.SZ'))

    // 直接设置 orderStore 状态
    useOrderStore.setState({
      orders: [mockHoldingOrder],
      loading: false,
      isRefreshing: false,
      error: null,
    })
    useTradingStore.setState({ orders: [mockHoldingOrder] })

    await waitFor(() => screen.getByText(/1000股/))

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

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
    await waitFor(() => screen.getByText('000001.SZ'))

    await userEvent.click(screen.getByRole('button', { name: /买入/i }))

    await waitFor(() => {
      expect(vi.mocked(tradingService.createBuyOrder)).toHaveBeenCalledWith(mockStock, 100)
    })
  })

  it('loads orders and displays holdings when clicking 加载持仓', async () => {
    // mock orderStore.refresh 为 no-op，然后直接设置状态
    const refreshSpy = vi.spyOn(useOrderStore.getState(), 'refresh').mockResolvedValue(undefined)

    useOrderStore.setState({
      orders: [mockHoldingOrder],
      loading: false,
      isRefreshing: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    // 等待首屏自动 loadStocks 完成（isRefreshing 复位），否则 加载持仓 会因并发守卫被跳过
    await screen.findByText('000001.SZ')
    await userEvent.click(screen.getByRole('button', { name: /加载持仓/i }))

    await waitFor(() => {
      expect(screen.getByText(/1000股/)).toBeInTheDocument()
    })
    expect(screen.getByText(/filled/)).toBeInTheDocument()

    refreshSpy.mockRestore()
  })

  it('scans signals and displays them when clicking 扫描信号', async () => {
    vi.spyOn(tradingService, 'scanWatchingSignals').mockResolvedValue([mockSignal])

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    // 等待首屏自动 loadStocks 完成（isRefreshing 复位），否则 扫描信号 会因并发守卫被跳过
    await screen.findByText('000001.SZ')
    await userEvent.click(screen.getByRole('button', { name: /扫描信号/i }))

    await waitFor(() => {
      expect(screen.getByText('全部信号 (1)')).toBeInTheDocument()
    })
    expect(screen.getAllByText('买入').length).toBeGreaterThan(0)
    expect(screen.getByText(/突破均线/)).toBeInTheDocument()
  })

  it('displays complete stock advice card information', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
    await waitFor(() => screen.getByText('000001.SZ'))

    // 使用 getAllByText 获取所有匹配元素，取第一个（观察池卡片中的）
    const symbolElements = screen.getAllByText('000001.SZ')
    const card = symbolElements[0]!.closest('.rounded-md') as HTMLElement
    expect(within(card).getByText('平安银行')).toBeInTheDocument()
    expect(within(card).getByText('watching')).toBeInTheDocument()
    expect(within(card).getAllByText('买入').length).toBeGreaterThan(0)
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

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
    await waitFor(() => screen.getByText('000001.SZ'))

    // 使用 getAllByText 获取所有匹配元素，取第一个（观察池卡片中的）
    const symbolElements = screen.getAllByText('000001.SZ')
    const card = symbolElements[0]!.closest('.rounded-md') as HTMLElement
    expect(within(card).getByText(/风控提示：仓位接近单笔上限/)).toBeInTheDocument()
  })

  it('displays risk blocks', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBlockedAdvice,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
    await waitFor(() => screen.getByText('000001.SZ'))

    // 使用 getAllByText 获取所有匹配元素，取第一个（观察池卡片中的）
    const symbolElements = screen.getAllByText('000001.SZ')
    const card = symbolElements[0]!.closest('.rounded-md') as HTMLElement
    expect(within(card).getByText(/风控阻塞：今日交易次数已达上限 5/)).toBeInTheDocument()
  })

  it('shows message after loading watchlist', async () => {
    vi.spyOn(tradingService, 'adviseForStock').mockResolvedValue({
      success: true,
      data: mockBuyAdvice,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])

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

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])

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

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('button', { name: /加载观察池/i })[0])
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

    mockBuildStrategyFilteredPortfolio.mockResolvedValue({
      portfolio: mockPortfolio,
      strategyResult: mockStrategyResult,
    })

    render(
      <MemoryRouter>
        <TradingApp />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('button', { name: /构建核心组合/i }))

    await waitFor(() => {
      expect(screen.getByText('北方华创')).toBeInTheDocument()
      expect(screen.getByText('买入 400')).toBeInTheDocument()
      expect(screen.getByText('20进13入选')).toBeInTheDocument()
    })
  })
})

// ⬇️ 合并自 src/apps/trading/TradingApp.test.tsx（双副本收敛，保留路由分发覆盖）
describe('TradingApp 路由分发', () => {
  beforeEach(() => {
    executionPlanPanelRendered.mockClear()
  })

  it('访问 /trading/execution-plans 时应渲染 ExecutionPlanPanel', async () => {
    render(
      <MemoryRouter initialEntries={['/trading/execution-plans']}>
        <TradingApp />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(executionPlanPanelRendered).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('execution-plan-panel')).toBeInTheDocument()
      expect(screen.getByText('ExecutionPlanPanel')).toBeInTheDocument()
    })
  })

  it('访问 /trading 默认路径时不应渲染 ExecutionPlanPanel', async () => {
    render(
      <MemoryRouter initialEntries={['/trading']}>
        <TradingApp />
      </MemoryRouter>,
    )

    expect(executionPlanPanelRendered).not.toHaveBeenCalled()
    expect(screen.getByText('交易舱 · 模拟盘')).toBeInTheDocument()
  })
})
