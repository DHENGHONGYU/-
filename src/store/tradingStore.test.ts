/**
 * @test_id V9-TEST-ST-161
 * @fileoverview tradingStore 单元测试
 *
 * tradingStore 是向后兼容的 Facade，委托给子 Store：
 * - useWatchlistStore: 自选股管理
 * - useSignalAdviceStore: 信号建议
 * - usePortfolioStore: 投资组合
 * - useOrderStore: 订单管理（总账本，reset 不调用其 reset）
 *
 * 覆盖场景（15 个 it）：
 * 1. 初始状态验证
 * 2. loadStocks 委托（stocks 非空 / 为空）
 * 3. loadOrders 委托 + 空列表 message
 * 4. scanSignals 委托
 * 5. loadPortfolio 委托 + portfolioLoading 状态 + message
 * 6. handleBuy 成功（含 advice 数量）/ 失败 / 并发锁
 * 7. handleSell 成功 / 失败
 * 8. getHoldingShares 计算净持仓
 * 9. setMessage
 * 10. reset 重置状态 + 调用子 Store reset
  * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-005, V9-DOC-ARCH-008, V9-DOC-BACK-010, V9-DOC-BACK-003]
*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Stock, Order, Portfolio, StrategyResult } from '@/data/types'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { TradeAdvice } from '@/services/trading/tradingService'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockCreateBuyOrder = vi.hoisted(() => vi.fn())
const mockCreateSellOrder = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/tradingService', () => ({
  createBuyOrder: mockCreateBuyOrder,
  createSellOrder: mockCreateSellOrder,
}))

const mockEventBusEmit = vi.hoisted(() => vi.fn())
vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    emit: mockEventBusEmit,
    on: vi.fn(),
    off: vi.fn(),
    getStats: vi.fn(),
  },
}))

// ---- Facade 同步订阅捕获器（用于测试 initTradingStoreFacadeSync 的订阅回调） ----
const facadeSyncCapture = vi.hoisted(() => {
  const captured: Record<string, ((state: unknown) => void) | null> = {
    watchlist: null,
    signal: null,
    portfolio: null,
    order: null,
  }
  const unsubSpies = {
    watchlist: vi.fn(),
    signal: vi.fn(),
    portfolio: vi.fn(),
    order: vi.fn(),
  }
  return { captured, unsubSpies }
})

// portfolioStore.setState mock（loadPortfolio 异常路径需要）
const mockPortfolioSetState = vi.hoisted(() => vi.fn())

// ---- 子 Store mocks ----

const mockWatchlist = vi.hoisted(() => ({
  stocks: [] as Stock[],
  loadStocks: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('./watchlistStore', () => ({
  useWatchlistStore: {
    getState: () => mockWatchlist,
    subscribe: vi.fn((cb: (state: unknown) => void) => {
      facadeSyncCapture.captured.watchlist = cb
      return facadeSyncCapture.unsubSpies.watchlist
    }),
  },
}))

const mockSignalAdvice = vi.hoisted(() => ({
  signals: [] as TradingSignal[],
  adviceMap: {} as Record<string, TradeAdvice>,
  scanSignals: vi.fn(),
  generateAdviceForStocks: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('./signalAdviceStore', () => ({
  useSignalAdviceStore: {
    getState: () => mockSignalAdvice,
    subscribe: vi.fn((cb: (state: unknown) => void) => {
      facadeSyncCapture.captured.signal = cb
      return facadeSyncCapture.unsubSpies.signal
    }),
  },
}))

const mockPortfolio = vi.hoisted(() => ({
  portfolio: undefined as Portfolio | undefined,
  strategyResult: undefined as StrategyResult | undefined,
  loading: false,
  buildPortfolio: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('./portfolioStore', () => ({
  usePortfolioStore: {
    getState: () => mockPortfolio,
    subscribe: vi.fn((cb: (state: unknown) => void) => {
      facadeSyncCapture.captured.portfolio = cb
      return facadeSyncCapture.unsubSpies.portfolio
    }),
    setState: mockPortfolioSetState,
  },
}))

const mockOrder = vi.hoisted(() => ({
  orders: [] as Order[],
  refresh: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('./orderStore', () => ({
  useOrderStore: {
    getState: () => mockOrder,
    subscribe: vi.fn((cb: (state: unknown) => void) => {
      facadeSyncCapture.captured.order = cb
      return facadeSyncCapture.unsubSpies.order
    }),
  },
}))

// ---- portfolioService 输入 mock（loadPortfolio 已改为从真实数据源构建） ----
const mockLoadPortfolioInput = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/portfolioService', () => ({
  loadPortfolioInput: mockLoadPortfolioInput,
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useTradingStore, initTradingStoreFacadeSync } from './tradingStore'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { buildOrder, buildPortfolio } from '../../tests/fixtures'

// ============================================================
// Helpers
// ============================================================

function buildTestStock(overrides: Partial<Stock> = {}): Stock {
  const defaults: Stock = {
    symbol: '600519.SH',
    name: '贵州茅台',
    price: 1800,
    pool: 'research',
    researchStatus: 'watching',
    source: 'akshare',
    dataVersion: 1,
  }
  return { ...defaults, ...overrides }
}

function buildBuyAdvice(targetShares: number): TradeAdvice {
  const signal = {
    id: 'sig-001',
    symbol: '600519.SH',
    direction: 'buy',
    type: 'technical',
    strategy: 'v6-engine',
    confidence: 0.8,
    rationale: '估值合理',
    snapshot: {
      pePercentile: 0.3,
      pbPercentile: 0.25,
      priceToMA20: 1.05,
      priceToMA60: 0.92,
      volumeRatio: 1.8,
      rsi14: 55,
      macdDirection: 'green',
    },
    createdAt: 1700000000000,
  } as unknown as TradingSignal

  return {
    signal,
    sizing: {
      action: 'buy',
      targetShares,
      targetValue: targetShares * 1800,
      positionPct: 0.1,
      kellyPct: 0.15,
      roundedDown: false,
      cappedBy: 'none',
    },
    risk: { ok: true, warnings: [], blocks: [] },
  }
}

function emptyStrategyResult(): StrategyResult {
  return {
    selected: [],
    coreScarce: [],
    valueBargain: [],
    hotMomentum: [],
    rejected: [],
    summary: {
      total: 0,
      selectedCount: 0,
      coreScarceCount: 0,
      valueBargainCount: 0,
      hotMomentumCount: 0,
    },
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  // 关键：用 initialState 重置状态（memory lesson: Zustand 跨测试持久化导致 isRefreshing 锁问题）
  useTradingStore.setState(
    {
      stocks: [],
      orders: [],
      signals: [],
      adviceMap: {},
      portfolio: undefined,
      strategyResult: undefined,
      portfolioLoading: false,
      processingSymbols: new Set<string>(),
      message: '',
      isRefreshing: false,
    },
    false,
  )

  // 重置 sub-store mock 状态
  mockWatchlist.stocks = []
  mockSignalAdvice.signals = []
  mockSignalAdvice.adviceMap = {}
  mockPortfolio.portfolio = undefined
  mockPortfolio.strategyResult = undefined
  mockPortfolio.loading = false
  mockOrder.orders = []

  // 重置 mock 函数（清除调用历史 + 实现）
  vi.clearAllMocks()
  mockCreateBuyOrder.mockReset()
  mockCreateSellOrder.mockReset()

  // 设置 sub-store 默认实现
  mockWatchlist.loadStocks.mockResolvedValue(undefined)
  mockWatchlist.reset.mockImplementation(() => {})
  mockSignalAdvice.scanSignals.mockResolvedValue(undefined)
  mockSignalAdvice.generateAdviceForStocks.mockResolvedValue(undefined)
  mockSignalAdvice.reset.mockImplementation(() => {})
  mockPortfolio.buildPortfolio.mockResolvedValue(undefined)
  mockPortfolio.reset.mockImplementation(() => {})
  mockOrder.refresh.mockResolvedValue(undefined)
  mockOrder.reset.mockImplementation(() => {})
  mockLoadPortfolioInput.mockResolvedValue({ stocks: [], orders: [] })
})

// ============================================================
// Tests
// ============================================================

describe('useTradingStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = useTradingStore.getState()
      expect(state.stocks).toEqual([])
      expect(state.orders).toEqual([])
      expect(state.signals).toEqual([])
      expect(state.adviceMap).toEqual({})
      expect(state.portfolio).toBeUndefined()
      expect(state.strategyResult).toBeUndefined()
      expect(state.portfolioLoading).toBe(false)
      expect(state.processingSymbols).toBeInstanceOf(Set)
      expect(state.processingSymbols.size).toBe(0)
      expect(state.message).toBe('')
      expect(state.isRefreshing).toBe(false)
    })
  })

  describe('loadStocks', () => {
    it('stocks 非空：应委托给 watchlistStore + signalAdviceStore 并同步状态', async () => {
      const testStocks: Stock[] = [buildTestStock()]
      const testAdviceMap: Record<string, TradeAdvice> = {
        '600519.SH': buildBuyAdvice(100),
      }
      mockWatchlist.loadStocks.mockImplementation(async () => {
        mockWatchlist.stocks = testStocks
      })
      mockSignalAdvice.generateAdviceForStocks.mockImplementation(async () => {
        mockSignalAdvice.adviceMap = testAdviceMap
      })

      await useTradingStore.getState().loadStocks()

      expect(mockWatchlist.loadStocks).toHaveBeenCalledTimes(1)
      expect(mockSignalAdvice.generateAdviceForStocks).toHaveBeenCalledWith(testStocks)
      const state = useTradingStore.getState()
      expect(state.stocks).toBe(testStocks)
      expect(state.adviceMap).toBe(testAdviceMap)
      expect(state.message).toBe('观察池与交易建议已更新')
    })

    it('stocks 为空：应设置 message 为"观察池为空"且不调用 generateAdviceForStocks', async () => {
      mockWatchlist.loadStocks.mockImplementation(async () => {
        mockWatchlist.stocks = []
      })

      await useTradingStore.getState().loadStocks()

      expect(useTradingStore.getState().message).toBe('观察池为空')
      expect(useTradingStore.getState().stocks).toEqual([])
      expect(mockSignalAdvice.generateAdviceForStocks).not.toHaveBeenCalled()
    })
  })

  describe('loadOrders', () => {
    it('应委托给 orderStore.refresh 并同步 orders，空列表时设置 message', async () => {
      // 先测试非空场景
      const testOrders: Order[] = [buildOrder({ symbol: '600519.SH' })]
      mockOrder.refresh.mockImplementation(async () => {
        mockOrder.orders = testOrders
      })

      await useTradingStore.getState().loadOrders()
      expect(mockOrder.refresh).toHaveBeenCalledTimes(1)
      expect(useTradingStore.getState().orders).toBe(testOrders)

      // 再测试空列表场景
      vi.clearAllMocks()
      mockOrder.refresh.mockImplementation(async () => {
        mockOrder.orders = []
      })

      await useTradingStore.getState().loadOrders()
      expect(useTradingStore.getState().orders).toEqual([])
      expect(useTradingStore.getState().message).toBe('订单列表为空')
    })
  })

  describe('scanSignals', () => {
    it('应委托给 signalAdviceStore.scanSignals 并同步 signals + message', async () => {
      const testSignals = [
        { id: 'sig-1', symbol: '600519.SH', direction: 'buy' },
      ] as unknown as TradingSignal[]
      mockSignalAdvice.scanSignals.mockImplementation(async () => {
        mockSignalAdvice.signals = testSignals
      })

      await useTradingStore.getState().scanSignals()

      expect(mockSignalAdvice.scanSignals).toHaveBeenCalledTimes(1)
      const state = useTradingStore.getState()
      expect(state.signals).toBe(testSignals)
      expect(state.message).toBe('扫描完成，共 1 条信号')
    })
  })

  describe('loadPortfolio', () => {
    it('应委托给 portfolioStore.buildPortfolio，portfolioLoading 期间为 true，结束后同步状态', async () => {
      const testStocks: Stock[] = [buildTestStock()]
      const testOrders: Order[] = [buildOrder()]
      const testPortfolio = buildPortfolio()
      const testStrategyResult = emptyStrategyResult()
      mockLoadPortfolioInput.mockResolvedValueOnce({ stocks: testStocks, orders: testOrders })
      let loadingDuringCall = false
      mockPortfolio.buildPortfolio.mockImplementation(async () => {
        loadingDuringCall = useTradingStore.getState().portfolioLoading
        mockPortfolio.portfolio = testPortfolio
        mockPortfolio.strategyResult = testStrategyResult
      })

      await useTradingStore.getState().loadPortfolio()

      expect(mockPortfolio.buildPortfolio).toHaveBeenCalledWith(testStocks, testOrders)
      expect(loadingDuringCall).toBe(true)
      const state = useTradingStore.getState()
      expect(state.portfolio).toBe(testPortfolio)
      expect(state.strategyResult).toBe(testStrategyResult)
      expect(state.portfolioLoading).toBe(false)
    })

    it('holdings 非空时 message 应包含标的数', async () => {
      const testStocks: Stock[] = [buildTestStock()]
      const testOrders: Order[] = [buildOrder()]
      mockLoadPortfolioInput.mockResolvedValueOnce({ stocks: testStocks, orders: testOrders })
      const portfolio = buildPortfolio() // 默认 2 个 holdings
      mockPortfolio.buildPortfolio.mockImplementation(async () => {
        mockPortfolio.portfolio = portfolio
        mockPortfolio.strategyResult = emptyStrategyResult()
      })

      await useTradingStore.getState().loadPortfolio()

      expect(useTradingStore.getState().message).toBe(
        `核心稀缺组合已构建，共 ${portfolio.holdings.length} 只标的`,
      )
    })

    // @test_id 追加：loadPortfolio 异常路径（覆盖 catch 分支 lines 200-203）
    it('portfolio holdings 为空时 message 应为"核心稀缺组合为空..."', async () => {
      const emptyPortfolio = { holdings: [] } as unknown as Portfolio
      mockLoadPortfolioInput.mockResolvedValueOnce({ stocks: [], orders: [] })
      mockPortfolio.buildPortfolio.mockImplementation(async () => {
        mockPortfolio.portfolio = emptyPortfolio
        mockPortfolio.strategyResult = emptyStrategyResult()
      })

      await useTradingStore.getState().loadPortfolio()

      expect(useTradingStore.getState().message).toBe(
        '核心稀缺组合为空，无匹配标的或评分不足',
      )
    })

    it('loadPortfolioInput 抛出 Error 时应捕获错误、记录日志、设置 portfolioStore error 和失败 message', async () => {
      const error = new Error('数据源不可用')
      mockLoadPortfolioInput.mockRejectedValueOnce(error)

      await useTradingStore.getState().loadPortfolio()

      const state = useTradingStore.getState()
      expect(state.portfolioLoading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.message).toBe('组合加载失败：数据源不可用')
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[tradingStore] loadPortfolio 失败',
        { error: '数据源不可用' },
      )
      // usePortfolioStore.setState 应被调用设置 error 和 loading=false
      expect(mockPortfolioSetState).toHaveBeenCalledWith({
        error: '数据源不可用',
        loading: false,
      })
    })

    it('loadPortfolioInput 抛出非 Error 值时应使用 String(err) 作为 message', async () => {
      mockLoadPortfolioInput.mockRejectedValueOnce('字符串错误')

      await useTradingStore.getState().loadPortfolio()

      expect(useTradingStore.getState().message).toBe('组合加载失败：字符串错误')
    })

    it('buildPortfolio 抛出 Error 时应捕获错误并设置失败 message', async () => {
      mockLoadPortfolioInput.mockResolvedValueOnce({ stocks: [], orders: [] })
      mockPortfolio.buildPortfolio.mockRejectedValueOnce(new Error('构建失败'))

      await useTradingStore.getState().loadPortfolio()

      const state = useTradingStore.getState()
      expect(state.message).toBe('组合加载失败：构建失败')
      expect(state.portfolioLoading).toBe(false)
      expect(state.isRefreshing).toBe(false)
    })
  })

  describe('handleBuy', () => {
    it('成功：应调用 createBuyOrder + 设置 message + emit ORDERS_CHANGED + 清除 processingSymbols', async () => {
      const stock = buildTestStock()
      const advice = buildBuyAdvice(250)
      mockSignalAdvice.adviceMap = { [stock.symbol]: advice }
      mockCreateBuyOrder.mockResolvedValue({ success: true, data: buildOrder() })
      mockOrder.refresh.mockImplementation(async () => {
        mockOrder.orders = [buildOrder({ symbol: stock.symbol })]
      })

      await useTradingStore.getState().handleBuy(stock)

      // 有 advice 且 action=buy → 使用 advice.sizing.targetShares
      expect(mockCreateBuyOrder).toHaveBeenCalledWith(stock, 250)
      const state = useTradingStore.getState()
      expect(state.message).toBe(`已买入 ${stock.symbol} 250 股`)
      expect(mockEventBusEmit).toHaveBeenCalledWith(
        EVENT_NAMES.ORDERS_CHANGED,
        { action: 'buy', symbol: stock.symbol, quantity: 250 },
      )
      // processingSymbols 应已清除
      expect(state.processingSymbols.has(stock.symbol)).toBe(false)
    })

    it('失败：应设置错误 message（含无 error 字段的默认消息）且不 emit 事件', async () => {
      const stock = buildTestStock()
      // 先测试有 error 字段
      mockCreateBuyOrder.mockResolvedValue({ success: false, error: '余额不足' })

      await useTradingStore.getState().handleBuy(stock)
      expect(useTradingStore.getState().message).toBe('余额不足')
      expect(mockEventBusEmit).not.toHaveBeenCalled()
      expect(useTradingStore.getState().processingSymbols.has(stock.symbol)).toBe(false)

      // 再测试无 error 字段（默认消息）
      vi.clearAllMocks()
      mockCreateBuyOrder.mockResolvedValue({ success: false })

      await useTradingStore.getState().handleBuy(stock)
      expect(useTradingStore.getState().message).toBe('买入失败')
      expect(mockEventBusEmit).not.toHaveBeenCalled()
    })

    it('并发锁：processingSymbols 包含 symbol 时应跳过且不调用 createBuyOrder', async () => {
      const stock = buildTestStock()
      useTradingStore.setState({ processingSymbols: new Set([stock.symbol]) })

      await useTradingStore.getState().handleBuy(stock)

      expect(mockCreateBuyOrder).not.toHaveBeenCalled()
    })
  })

  describe('handleSell', () => {
    it('成功：应调用 createSellOrder + emit ORDERS_CHANGED', async () => {
      const stock = buildTestStock()
      mockCreateSellOrder.mockResolvedValue({ success: true, data: buildOrder() })
      mockOrder.refresh.mockImplementation(async () => {
        mockOrder.orders = [buildOrder({ symbol: stock.symbol, direction: 'sell' })]
      })

      await useTradingStore.getState().handleSell(stock)

      // 无 advice 且 getHoldingShares 返回 0 → 默认 100
      expect(mockCreateSellOrder).toHaveBeenCalledWith(stock, 100)
      const state = useTradingStore.getState()
      expect(state.message).toBe(`已卖出 ${stock.symbol} 100 股`)
      expect(mockEventBusEmit).toHaveBeenCalledWith(
        EVENT_NAMES.ORDERS_CHANGED,
        { action: 'sell', symbol: stock.symbol, quantity: 100 },
      )
    })

    it('失败：应设置错误 message 且不 emit 事件', async () => {
      const stock = buildTestStock()
      mockCreateSellOrder.mockResolvedValue({ success: false, error: '持仓不足' })

      await useTradingStore.getState().handleSell(stock)

      expect(useTradingStore.getState().message).toBe('持仓不足')
      expect(mockEventBusEmit).not.toHaveBeenCalled()
    })
  })

  describe('getHoldingShares', () => {
    it('应正确计算净持仓（买入 - 卖出），不存在的 symbol 返回 0', () => {
      const symbol = '600519.SH'
      mockOrder.orders = [
        buildOrder({ id: 'o1', symbol, direction: 'buy', quantity: 100 }),
        buildOrder({ id: 'o2', symbol, direction: 'buy', quantity: 50 }),
        buildOrder({ id: 'o3', symbol, direction: 'sell', quantity: 80 }),
      ]

      // 100 + 50 - 80 = 70
      expect(useTradingStore.getState().getHoldingShares(symbol)).toBe(70)
      // 不存在的 symbol
      expect(useTradingStore.getState().getHoldingShares('000001.SZ')).toBe(0)
    })
  })

  describe('setMessage', () => {
    it('应设置 message 字段', () => {
      useTradingStore.getState().setMessage('测试消息')
      expect(useTradingStore.getState().message).toBe('测试消息')
    })
  })

  describe('reset', () => {
    it('应重置 tradingStore 状态并调用子 Store reset（orderStore 除外）', () => {
      useTradingStore.setState({
        stocks: [buildTestStock()],
        orders: [buildOrder()],
        message: '旧消息',
        portfolioLoading: true,
        processingSymbols: new Set(['600519.SH']),
      })

      useTradingStore.getState().reset()

      const state = useTradingStore.getState()
      expect(state.stocks).toEqual([])
      expect(state.orders).toEqual([])
      expect(state.signals).toEqual([])
      expect(state.adviceMap).toEqual({})
      expect(state.portfolio).toBeUndefined()
      expect(state.strategyResult).toBeUndefined()
      expect(state.portfolioLoading).toBe(false)
      expect(state.processingSymbols.size).toBe(0)
      expect(state.message).toBe('')
      expect(state.isRefreshing).toBe(false)

      // 验证调用子 Store reset（注意：orderStore 是总账本，reset 不调用其 reset）
      expect(mockWatchlist.reset).toHaveBeenCalledTimes(1)
      expect(mockSignalAdvice.reset).toHaveBeenCalledTimes(1)
      expect(mockPortfolio.reset).toHaveBeenCalledTimes(1)
      expect(mockOrder.reset).not.toHaveBeenCalled()
    })
  })

  describe('异常传播与并发控制', () => {
    it('loadStocks: watchlistStore.loadStocks 抛错时应向上传播，不被吞掉', async () => {
      const errorMessage = '数据库连接失败'
      mockWatchlist.loadStocks.mockRejectedValueOnce(new Error(errorMessage))

      await expect(useTradingStore.getState().loadStocks()).rejects.toThrow(errorMessage)

      // 验证后续流程未被调用
      expect(mockSignalAdvice.generateAdviceForStocks).not.toHaveBeenCalled()
      // 验证状态未被设置（异常导致未到 set 步骤）
      expect(useTradingStore.getState().stocks).toEqual([])
      expect(useTradingStore.getState().message).toBe('')
    })

    it('handleSell: processingSymbols 包含 symbol 时应跳过且不调用 createSellOrder', async () => {
      const stock = buildTestStock()
      useTradingStore.setState({ processingSymbols: new Set([stock.symbol]) })

      await useTradingStore.getState().handleSell(stock)

      expect(mockCreateSellOrder).not.toHaveBeenCalled()
      // 验证 processingSymbols 仍包含该 symbol（未进入 try-finally 清理）
      expect(useTradingStore.getState().processingSymbols.has(stock.symbol)).toBe(true)
    })
  })
})

// ============================================================
// initTradingStoreFacadeSync —— Facade 订阅同步（覆盖 lines 315-397）
// ============================================================

describe('initTradingStoreFacadeSync', () => {
  let activeCleanup: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    // 重置捕获器
    facadeSyncCapture.captured.watchlist = null
    facadeSyncCapture.captured.signal = null
    facadeSyncCapture.captured.portfolio = null
    facadeSyncCapture.captured.order = null
    // 重置 sub-store mock 状态
    mockWatchlist.stocks = []
    mockSignalAdvice.signals = []
    mockSignalAdvice.adviceMap = {}
    mockPortfolio.portfolio = undefined
    mockPortfolio.strategyResult = undefined
    mockPortfolio.loading = false
    mockOrder.orders = []
  })

  afterEach(() => {
    if (activeCleanup) {
      activeCleanup()
      activeCleanup = null
    }
  })

  // @test_id 追加：初始化 + 初始同步
  it('初始化时应订阅 4 个子 Store 并做初始同步', () => {
    const testStocks: Stock[] = [buildTestStock()]
    const testSignals = [
      { id: 'sig-1', symbol: '600519.SH', direction: 'buy' },
    ] as unknown as TradingSignal[]
    const testAdviceMap: Record<string, TradeAdvice> = {
      '600519.SH': buildBuyAdvice(100),
    }
    const testPortfolio = buildPortfolio()
    const testStrategyResult = emptyStrategyResult()
    const testOrders: Order[] = [buildOrder()]

    mockWatchlist.stocks = testStocks
    mockSignalAdvice.signals = testSignals
    mockSignalAdvice.adviceMap = testAdviceMap
    mockPortfolio.portfolio = testPortfolio
    mockPortfolio.strategyResult = testStrategyResult
    mockPortfolio.loading = false
    mockOrder.orders = testOrders

    activeCleanup = initTradingStoreFacadeSync()

    const state = useTradingStore.getState()
    expect(state.stocks).toBe(testStocks)
    expect(state.signals).toBe(testSignals)
    expect(state.adviceMap).toBe(testAdviceMap)
    expect(state.portfolio).toBe(testPortfolio)
    expect(state.strategyResult).toBe(testStrategyResult)
    expect(state.portfolioLoading).toBe(false)
    expect(state.orders).toBe(testOrders)
    expect(mockLogger.info).toHaveBeenCalledWith('[tradingStore] Facade sync initialized')
  })

  it('重复初始化应返回已有 cleanup 并 warn', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const secondCleanup = initTradingStoreFacadeSync()

    expect(secondCleanup).toBe(activeCleanup)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[tradingStore] Facade sync already initialized',
    )
  })

  it('cleanup 应调用所有子 Store 的 unsubscribe', () => {
    activeCleanup = initTradingStoreFacadeSync()
    activeCleanup()
    activeCleanup = null

    expect(facadeSyncCapture.unsubSpies.watchlist).toHaveBeenCalledTimes(1)
    expect(facadeSyncCapture.unsubSpies.signal).toHaveBeenCalledTimes(1)
    expect(facadeSyncCapture.unsubSpies.portfolio).toHaveBeenCalledTimes(1)
    expect(facadeSyncCapture.unsubSpies.order).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledWith('[tradingStore] Facade sync destroyed')
  })

  // ---- watchlistStore 订阅回调 ----
  it('watchlistStore stocks 引用变化时应同步到 Facade', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const cb = facadeSyncCapture.captured.watchlist
    expect(cb).not.toBeNull()

    const newStocks = [buildTestStock({ symbol: '000001.SZ' })]
    mockWatchlist.stocks = newStocks
    cb!({ stocks: newStocks })

    expect(useTradingStore.getState().stocks).toBe(newStocks)
  })

  it('watchlistStore stocks 引用不变时不应同步', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const cb = facadeSyncCapture.captured.watchlist
    const prevStocks = useTradingStore.getState().stocks
    const sameStocks = mockWatchlist.stocks

    cb!({ stocks: sameStocks })

    expect(useTradingStore.getState().stocks).toBe(prevStocks)
  })

  // ---- signalAdviceStore 订阅回调 ----
  it('signalAdviceStore signals 变化时应同步到 Facade', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const cb = facadeSyncCapture.captured.signal
    expect(cb).not.toBeNull()

    const newSignals = [
      { id: 'sig-2', symbol: '000001.SZ', direction: 'sell' },
    ] as unknown as TradingSignal[]
    const newAdviceMap = { '000001.SZ': buildBuyAdvice(50) }
    mockSignalAdvice.signals = newSignals
    mockSignalAdvice.adviceMap = newAdviceMap
    cb!({ signals: newSignals, adviceMap: newAdviceMap })

    const state = useTradingStore.getState()
    expect(state.signals).toBe(newSignals)
    expect(state.adviceMap).toBe(newAdviceMap)
  })

  // ---- portfolioStore 订阅回调 ----
  it('portfolioStore portfolio 变化时应同步到 Facade', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const cb = facadeSyncCapture.captured.portfolio
    expect(cb).not.toBeNull()

    const newPortfolio = buildPortfolio()
    const newStrategyResult = emptyStrategyResult()
    mockPortfolio.portfolio = newPortfolio
    mockPortfolio.strategyResult = newStrategyResult
    mockPortfolio.loading = true
    cb!({ portfolio: newPortfolio, strategyResult: newStrategyResult, loading: true })

    const state = useTradingStore.getState()
    expect(state.portfolio).toBe(newPortfolio)
    expect(state.strategyResult).toBe(newStrategyResult)
    expect(state.portfolioLoading).toBe(true)
  })

  // ---- orderStore 订阅回调 ----
  it('orderStore orders 变化时应同步到 Facade', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const cb = facadeSyncCapture.captured.order
    expect(cb).not.toBeNull()

    const newOrders: Order[] = [buildOrder({ symbol: '600519.SH' })]
    mockOrder.orders = newOrders
    cb!({ orders: newOrders })

    expect(useTradingStore.getState().orders).toBe(newOrders)
  })

  it('orderStore orders 引用不变时不应同步', () => {
    activeCleanup = initTradingStoreFacadeSync()
    const cb = facadeSyncCapture.captured.order
    const prevOrders = useTradingStore.getState().orders
    const sameOrders = mockOrder.orders

    cb!({ orders: sameOrders })

    expect(useTradingStore.getState().orders).toBe(prevOrders)
  })
})
