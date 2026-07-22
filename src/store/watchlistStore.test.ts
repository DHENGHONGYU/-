/**
 * @test_id V9-TEST-ST-WATCHLIST
 * @fileoverview watchlistStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. loadStocks 成功（stocks 非空）—— 更新 stocks / loading / lastUpdated
 * 3. loadStocks 成功但 result.success=false —— 回滚到快照
 * 4. loadStocks 异常 —— 回滚到快照，设置 error
 * 5. loadStocks 并发锁（isRefreshing=true）—— 跳过
 * 6. reset —— 恢复初始状态
 * @covers_docs [V9-DOC-PROJ-118, V9-DOC-DATA-032, V9-DOC-DATA-031]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockWithBroadcast = vi.hoisted(() => vi.fn())
vi.mock('@/store/helpers/withBroadcast', () => ({ withBroadcast: mockWithBroadcast }))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { STOCKS_CHANGED: 'stocks:changed' },
}))

const mockGetWatchlistStocks = vi.hoisted(() => vi.fn())
const mockPersistWatchlistSnapshot = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/tradingService', () => ({
  getWatchlistStocks: mockGetWatchlistStocks,
  persistWatchlistSnapshot: mockPersistWatchlistSnapshot,
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useWatchlistStore } from './watchlistStore'
import type { Stock } from '@/data/types'

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

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  useWatchlistStore.setState({
    stocks: [],
    loading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: 0,
  }, false)

  vi.clearAllMocks()
  mockGetWatchlistStocks.mockReset()
  mockPersistWatchlistSnapshot.mockResolvedValue({ success: true })
  mockWithBroadcast.mockReset()
})

// ============================================================
// Tests
// ============================================================

describe('useWatchlistStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = useWatchlistStore.getState()
      expect(state.stocks).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBe(0)
    })
  })

  describe('loadStocks', () => {
    it('成功：应更新 stocks、lastUpdated 并广播事件', async () => {
      const testStocks: Stock[] = [buildTestStock(), buildTestStock({ symbol: '000001.SZ', name: '平安银行' })]
      mockGetWatchlistStocks.mockResolvedValue({ success: true, data: testStocks })

      await useWatchlistStore.getState().loadStocks()

      const state = useWatchlistStore.getState()
      expect(state.stocks).toEqual(testStocks)
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBeGreaterThan(0)
      expect(mockWithBroadcast).toHaveBeenCalledWith('stocks:changed', {
        action: 'loadWatchlist',
        count: 2,
      })
    })

    it('result.success=false：应回滚到快照并设置 error', async () => {
      const existingStocks: Stock[] = [buildTestStock()]
      useWatchlistStore.setState({ stocks: existingStocks, lastUpdated: 1000 })

      mockGetWatchlistStocks.mockResolvedValue({ success: false, error: '网络错误' })

      await useWatchlistStore.getState().loadStocks()

      const state = useWatchlistStore.getState()
      expect(state.stocks).toEqual(existingStocks)
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBe('网络错误')
      expect(state.lastUpdated).toBe(1000) // 快照回滚
    })

    it('异常：应回滚到快照并设置 error', async () => {
      const existingStocks: Stock[] = [buildTestStock()]
      useWatchlistStore.setState({ stocks: existingStocks, lastUpdated: 2000 })

      mockGetWatchlistStocks.mockRejectedValue(new Error('服务不可用'))

      await useWatchlistStore.getState().loadStocks()

      const state = useWatchlistStore.getState()
      expect(state.stocks).toEqual(existingStocks)
      expect(state.error).toBe('服务不可用')
      expect(state.lastUpdated).toBe(2000)
    })

    it('并发锁：isRefreshing=true 时应跳过调用', async () => {
      useWatchlistStore.setState({ isRefreshing: true })
      mockGetWatchlistStocks.mockResolvedValue({ success: true, data: [] })

      await useWatchlistStore.getState().loadStocks()

      expect(mockGetWatchlistStocks).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('应重置所有状态到初始值并广播事件', () => {
      useWatchlistStore.setState({
        stocks: [buildTestStock()],
        loading: true,
        isRefreshing: true,
        error: 'some error',
        lastUpdated: Date.now(),
      })

      useWatchlistStore.getState().reset()

      const state = useWatchlistStore.getState()
      expect(state.stocks).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBe(0)
      expect(mockWithBroadcast).toHaveBeenCalledWith('stocks:changed', { action: 'reset' })
    })
  })
})
