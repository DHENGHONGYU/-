/**
 * @test_id V9-TEST-ST-149
 * @fileoverview portfolioStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. buildPortfolio 成功：设置 portfolio/strategyResult、清空 error、更新 lastUpdated
 * 3. buildPortfolio 成功：调用 buildStrategyFilteredPortfolio 传入正确参数
 * 4. buildPortfolio 成功：触发 withBroadcast 通知
 * 5. buildPortfolio loading 状态变化（true → false）
 * 6. buildPortfolio 失败：设置 error 并回滚快照
 * 7. buildPortfolio 失败：非 Error 对象转字符串
 * 8. buildPortfolio 并发调用：isRefreshing 锁跳过
 * 9. buildPortfolio 成功后 lastUpdated 更新为新时间戳
 * 10. buildPortfolio 成功后 error 字段被清空
 * 11. reset 重置所有状态到初始值
 * 12. reset 触发 withBroadcast 通知
  * @covers_docs [V9-DOC-DATA-021, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-BACK-003, V9-DOC-BACK-006]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Stock, Order, Portfolio, StrategyResult } from '@/data/types'

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

const mockBuildStrategyFilteredPortfolio = vi.hoisted(() => vi.fn())
const mockComputeHoldingsFromOrders = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/portfolioBuilder', () => ({
  buildStrategyFilteredPortfolio: mockBuildStrategyFilteredPortfolio,
  computeHoldingsFromOrders: mockComputeHoldingsFromOrders,
}))

const mockWithBroadcast = vi.hoisted(() => vi.fn())
vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: mockWithBroadcast,
  createBroadcaster: vi.fn(),
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { usePortfolioStore } from './portfolioStore'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import { buildPortfolio, buildOrder } from '../../tests/fixtures'

// ============================================================
// Helpers
// ============================================================

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

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  // 关键：用 initialState 重置状态（memory lesson: Zustand 跨测试持久化导致 isRefreshing 锁问题）
  usePortfolioStore.setState(
    {
      portfolio: undefined,
      strategyResult: undefined,
      loading: false,
      isRefreshing: false,
      error: null,
      lastUpdated: 0,
    },
    false,
  )
  vi.clearAllMocks()
})

// ============================================================
// Tests
// ============================================================

describe('usePortfolioStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = usePortfolioStore.getState()
      expect(state.portfolio).toBeUndefined()
      expect(state.strategyResult).toBeUndefined()
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBe(0)
    })
  })

  describe('buildPortfolio', () => {
    it('成功：应设置 portfolio/strategyResult 并清空 error', async () => {
      const stocks: Stock[] = [buildTestStock()]
      const orders: Order[] = [buildOrder()]
      const mockPortfolio: Portfolio = buildPortfolio()
      const mockStrategyResult: StrategyResult = emptyStrategyResult()

      mockComputeHoldingsFromOrders.mockReturnValue({ '600519.SH': 100 })
      mockBuildStrategyFilteredPortfolio.mockResolvedValue({
        portfolio: mockPortfolio,
        strategyResult: mockStrategyResult,
      })

      await usePortfolioStore.getState().buildPortfolio(stocks, orders)

      const state = usePortfolioStore.getState()
      expect(state.portfolio).toBe(mockPortfolio)
      expect(state.strategyResult).toBe(mockStrategyResult)
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBeGreaterThan(0)
    })

    it('成功：应调用 buildStrategyFilteredPortfolio 并传入正确参数', async () => {
      const stocks: Stock[] = [buildTestStock()]
      const orders: Order[] = [buildOrder()]
      const mockHoldings = { '600519.SH': 100 }

      mockComputeHoldingsFromOrders.mockReturnValue(mockHoldings)
      mockBuildStrategyFilteredPortfolio.mockResolvedValue({
        portfolio: buildPortfolio(),
        strategyResult: emptyStrategyResult(),
      })

      await usePortfolioStore.getState().buildPortfolio(stocks, orders)

      expect(mockComputeHoldingsFromOrders).toHaveBeenCalledWith(orders)
      expect(mockBuildStrategyFilteredPortfolio).toHaveBeenCalledWith({
        theme: CORE_RESOURCE_THEME,
        stocks,
        currentHoldings: mockHoldings,
      })
    })

    it('成功：应触发 withBroadcast 通知', async () => {
      const stocks: Stock[] = [buildTestStock()]
      const orders: Order[] = []
      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockResolvedValue({
        portfolio: buildPortfolio(),
        strategyResult: emptyStrategyResult(),
      })

      await usePortfolioStore.getState().buildPortfolio(stocks, orders)

      expect(mockWithBroadcast).toHaveBeenCalledWith(
        EVENT_NAMES.HOLDINGS_CHANGED,
        expect.objectContaining({ action: 'buildPortfolio' }),
      )
    })

    it('loading 状态变化：调用期间为 true，结束后为 false', async () => {
      const stocks: Stock[] = [buildTestStock()]
      const orders: Order[] = []
      let loadingDuringCall = false

      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockImplementation(async () => {
        loadingDuringCall = usePortfolioStore.getState().loading
        return { portfolio: buildPortfolio(), strategyResult: emptyStrategyResult() }
      })

      await usePortfolioStore.getState().buildPortfolio(stocks, orders)

      expect(loadingDuringCall).toBe(true)
      expect(usePortfolioStore.getState().loading).toBe(false)
    })

    it('失败：应设置 error 并回滚快照保留旧数据', async () => {
      const oldPortfolio = buildPortfolio({ id: 'old-portfolio' })
      const oldStrategyResult = emptyStrategyResult()
      usePortfolioStore.setState({
        portfolio: oldPortfolio,
        strategyResult: oldStrategyResult,
        lastUpdated: 1000,
      })

      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockRejectedValue(new Error('网络异常'))

      await usePortfolioStore.getState().buildPortfolio([], [])

      const state = usePortfolioStore.getState()
      expect(state.error).toBe('网络异常')
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      // 快照回滚
      expect(state.portfolio).toBe(oldPortfolio)
      expect(state.strategyResult).toBe(oldStrategyResult)
      expect(state.lastUpdated).toBe(1000)
    })

    it('失败：非 Error 对象应转为字符串', async () => {
      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockRejectedValue('字符串错误')

      await usePortfolioStore.getState().buildPortfolio([], [])

      expect(usePortfolioStore.getState().error).toBe('字符串错误')
    })

    it('并发调用：isRefreshing 锁应跳过第二次调用', async () => {
      // 模拟 isRefreshing=true 状态
      usePortfolioStore.setState({ isRefreshing: true })

      await usePortfolioStore.getState().buildPortfolio([buildTestStock()], [])

      // 不应调用 buildStrategyFilteredPortfolio
      expect(mockBuildStrategyFilteredPortfolio).not.toHaveBeenCalled()
      expect(mockComputeHoldingsFromOrders).not.toHaveBeenCalled()
    })

    it('成功后 lastUpdated 应更新为新时间戳', async () => {
      usePortfolioStore.setState({ lastUpdated: 1000 })
      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockResolvedValue({
        portfolio: buildPortfolio(),
        strategyResult: emptyStrategyResult(),
      })

      const before = Date.now()
      await usePortfolioStore.getState().buildPortfolio([buildTestStock()], [])
      const after = Date.now()

      const lastUpdated = usePortfolioStore.getState().lastUpdated
      expect(lastUpdated).toBeGreaterThanOrEqual(before)
      expect(lastUpdated).toBeLessThanOrEqual(after)
    })

    it('成功后 error 字段应被清空', async () => {
      usePortfolioStore.setState({ error: 'previous error' })
      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockResolvedValue({
        portfolio: buildPortfolio(),
        strategyResult: emptyStrategyResult(),
      })

      await usePortfolioStore.getState().buildPortfolio([buildTestStock()], [])

      expect(usePortfolioStore.getState().error).toBeNull()
    })

    it('成功后 logger.info 应记录 holdingsCount', async () => {
      const portfolio = buildPortfolio()
      mockComputeHoldingsFromOrders.mockReturnValue({})
      mockBuildStrategyFilteredPortfolio.mockResolvedValue({
        portfolio,
        strategyResult: emptyStrategyResult(),
      })

      await usePortfolioStore.getState().buildPortfolio([buildTestStock()], [])

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[portfolioStore] buildPortfolio 完成',
        { holdingsCount: portfolio.holdings.length },
      )
    })
  })

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      // 先填充状态
      usePortfolioStore.setState({
        portfolio: buildPortfolio(),
        strategyResult: emptyStrategyResult(),
        loading: true,
        isRefreshing: true,
        error: 'some error',
        lastUpdated: 9999,
      })

      usePortfolioStore.getState().reset()

      const state = usePortfolioStore.getState()
      expect(state.portfolio).toBeUndefined()
      expect(state.strategyResult).toBeUndefined()
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBe(0)
    })

    it('应触发 withBroadcast 通知 reset 动作', () => {
      usePortfolioStore.getState().reset()

      expect(mockWithBroadcast).toHaveBeenCalledWith(
        EVENT_NAMES.HOLDINGS_CHANGED,
        { action: 'reset' },
      )
    })
  })
})
