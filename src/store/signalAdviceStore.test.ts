/**
 * @test_id V9-TEST-ST-SIGNAL-ADVICE
 * @fileoverview signalAdviceStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. scanSignals 成功 —— 更新 signals / lastUpdated
 * 3. scanSignals 异常 —— 回滚到快照，设置 error
 * 4. scanSignals 并发锁 —— 跳过
 * 5. generateAdvice 成功 —— 更新 adviceMap
 * 6. reset —— 恢复初始状态
 * @covers_docs [V9-DOC-ARCH-007, V9-DOC-BACK-015, V9-DOC-DATA-031, V9-DOC-DATA-032]
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
  EVENT_NAMES: { SIGNALS_CHANGED: 'signals:changed' },
}))

const mockScanWatchingSignals = vi.hoisted(() => vi.fn())
const mockAdviseForStock = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/tradingService', () => ({
  scanWatchingSignals: mockScanWatchingSignals,
  adviseForStock: mockAdviseForStock,
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useSignalAdviceStore } from './signalAdviceStore'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { TradeAdvice } from '@/services/trading/tradingService'
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

function buildTestSignal(overrides: Partial<TradingSignal> = {}): TradingSignal {
  return {
    id: 'sig-001',
    symbol: '600519.SH',
    direction: 'buy',
    type: 'technical',
    strategy: 'v6-engine',
    confidence: 0.8,
    rationale: '估值合理',
    createdAt: 1700000000000,
    snapshot: {
      pePercentile: 0.3,
      pbPercentile: 0.25,
      priceToMA20: 1.05,
      priceToMA60: 0.92,
      volumeRatio: 1.8,
      rsi14: 55,
      macdDirection: 'green',
    },
    ...overrides,
  } as unknown as TradingSignal
}

function buildTestAdvice(): TradeAdvice {
  return {
    signal: buildTestSignal(),
    sizing: {
      action: 'buy',
      targetShares: 100,
      targetValue: 180000,
      positionPct: 0.1,
      kellyPct: 0.15,
      roundedDown: false,
      cappedBy: 'none',
    },
    risk: { ok: true, warnings: [], blocks: [] },
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  useSignalAdviceStore.setState({
    signals: [],
    adviceMap: {},
    loading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: 0,
  }, false)

  vi.clearAllMocks()
  mockScanWatchingSignals.mockReset()
  mockAdviseForStock.mockReset()
  mockWithBroadcast.mockReset()
})

// ============================================================
// Tests
// ============================================================

describe('useSignalAdviceStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = useSignalAdviceStore.getState()
      expect(state.signals).toEqual([])
      expect(state.adviceMap).toEqual({})
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBe(0)
    })
  })

  describe('scanSignals', () => {
    it('成功：应更新 signals、lastUpdated 并广播事件', async () => {
      const testSignals: TradingSignal[] = [buildTestSignal(), buildTestSignal({ id: 'sig-002', symbol: '000001.SZ' })]
      mockScanWatchingSignals.mockResolvedValue(testSignals)

      await useSignalAdviceStore.getState().scanSignals()

      const state = useSignalAdviceStore.getState()
      expect(state.signals).toEqual(testSignals)
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBeGreaterThan(0)
      expect(mockWithBroadcast).toHaveBeenCalledWith('signals:changed', {
        action: 'scan',
        count: 2,
      })
    })

    it('异常：应回滚到快照并设置 error', async () => {
      const existingSignals: TradingSignal[] = [buildTestSignal()]
      useSignalAdviceStore.setState({ signals: existingSignals, lastUpdated: 1000 })

      mockScanWatchingSignals.mockRejectedValue(new Error('扫描服务异常'))

      await useSignalAdviceStore.getState().scanSignals()

      const state = useSignalAdviceStore.getState()
      expect(state.signals).toEqual(existingSignals)
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBe('扫描服务异常')
      expect(state.lastUpdated).toBe(1000)
    })

    it('并发锁：isRefreshing=true 时应跳过调用', async () => {
      useSignalAdviceStore.setState({ isRefreshing: true })
      mockScanWatchingSignals.mockResolvedValue([])

      await useSignalAdviceStore.getState().scanSignals()

      expect(mockScanWatchingSignals).not.toHaveBeenCalled()
    })
  })

  describe('generateAdvice', () => {
    it('成功：应在 adviceMap 中添加该 symbol 的建议', async () => {
      const stock = buildTestStock()
      const advice = buildTestAdvice()
      mockAdviseForStock.mockResolvedValue({ success: true, data: advice })

      await useSignalAdviceStore.getState().generateAdvice(stock)

      const state = useSignalAdviceStore.getState()
      expect(state.adviceMap['600519.SH']).toEqual(advice)
      expect(state.lastUpdated).toBeGreaterThan(0)
    })

    it('失败：应设置 error', async () => {
      const stock = buildTestStock()
      mockAdviseForStock.mockResolvedValue({ success: false, error: '无法生成建议' })

      await useSignalAdviceStore.getState().generateAdvice(stock)

      expect(useSignalAdviceStore.getState().error).toBe('无法生成建议')
    })

    // @test_id 追加：generateAdvice 异常与边界路径
    it('异常：adviseForStock 抛出 Error 时应捕获并设置 error', async () => {
      const stock = buildTestStock()
      mockAdviseForStock.mockRejectedValue(new Error('网络超时'))

      await useSignalAdviceStore.getState().generateAdvice(stock)

      expect(useSignalAdviceStore.getState().error).toBe('网络超时')
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[signalAdviceStore] generateAdvice 异常',
        { symbol: '600519.SH', error: '网络超时' },
      )
    })

    it('异常：adviseForStock 抛出非 Error 值时应使用 String(err)', async () => {
      const stock = buildTestStock()
      mockAdviseForStock.mockRejectedValue('字符串异常')

      await useSignalAdviceStore.getState().generateAdvice(stock)

      expect(useSignalAdviceStore.getState().error).toBe('字符串异常')
    })

    it('失败且无 error 字段时应使用默认消息', async () => {
      const stock = buildTestStock()
      mockAdviseForStock.mockResolvedValue({ success: false })

      await useSignalAdviceStore.getState().generateAdvice(stock)

      expect(useSignalAdviceStore.getState().error).toBe('生成交易建议失败')
    })

    it('成功时应广播 SIGNALS_CHANGED 事件', async () => {
      const stock = buildTestStock()
      mockAdviseForStock.mockResolvedValue({ success: true, data: buildTestAdvice() })

      await useSignalAdviceStore.getState().generateAdvice(stock)

      expect(mockWithBroadcast).toHaveBeenCalledWith('signals:changed', {
        action: 'generateAdvice',
        symbol: '600519.SH',
      })
    })
  })

  describe('reset', () => {
    it('应重置所有状态到初始值并广播事件', () => {
      useSignalAdviceStore.setState({
        signals: [buildTestSignal()],
        adviceMap: { '600519.SH': buildTestAdvice() },
        loading: true,
        isRefreshing: true,
        error: 'some error',
        lastUpdated: Date.now(),
      })

      useSignalAdviceStore.getState().reset()

      const state = useSignalAdviceStore.getState()
      expect(state.signals).toEqual([])
      expect(state.adviceMap).toEqual({})
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBe(0)
      expect(mockWithBroadcast).toHaveBeenCalledWith('signals:changed', { action: 'reset' })
    })
  })

  // ============================================================
  // generateAdviceForStocks —— 批量生成建议
  // ============================================================
  describe('generateAdviceForStocks', () => {
    // @test_id 追加：generateAdviceForStocks 成功/部分失败/并发锁/异常/空数组
    it('成功：应批量生成 adviceMap 并广播事件', async () => {
      const stock1 = buildTestStock({ symbol: '600519.SH' })
      const stock2 = buildTestStock({ symbol: '000001.SZ', name: '平安银行' })
      const advice1 = buildTestAdvice()
      const advice2 = buildTestAdvice()
      mockAdviseForStock.mockResolvedValueOnce({ success: true, data: advice1 })
      mockAdviseForStock.mockResolvedValueOnce({ success: true, data: advice2 })

      await useSignalAdviceStore.getState().generateAdviceForStocks([stock1, stock2])

      const state = useSignalAdviceStore.getState()
      expect(state.adviceMap['600519.SH']).toEqual(advice1)
      expect(state.adviceMap['000001.SZ']).toEqual(advice2)
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBeGreaterThan(0)
      expect(mockWithBroadcast).toHaveBeenCalledWith('signals:changed', {
        action: 'generateAdviceBatch',
        count: 2,
      })
    })

    it('部分失败：应只保留成功的建议', async () => {
      const stock1 = buildTestStock({ symbol: '600519.SH' })
      const stock2 = buildTestStock({ symbol: '000001.SZ', name: '平安银行' })
      mockAdviseForStock.mockResolvedValueOnce({ success: true, data: buildTestAdvice() })
      mockAdviseForStock.mockResolvedValueOnce({ success: false, error: '不适合' })

      await useSignalAdviceStore.getState().generateAdviceForStocks([stock1, stock2])

      const state = useSignalAdviceStore.getState()
      expect(Object.keys(state.adviceMap)).toEqual(['600519.SH'])
      expect(state.error).toBeNull()
    })

    it('并发锁：isRefreshing=true 时应跳过', async () => {
      useSignalAdviceStore.setState({ isRefreshing: true })
      mockAdviseForStock.mockResolvedValue({ success: true, data: buildTestAdvice() })

      await useSignalAdviceStore.getState().generateAdviceForStocks([buildTestStock()])

      expect(mockAdviseForStock).not.toHaveBeenCalled()
    })

    it('异常：adviseForStock 抛错时应设置 error 并重置状态', async () => {
      const stock = buildTestStock()
      mockAdviseForStock.mockRejectedValue(new Error('批量服务异常'))

      await useSignalAdviceStore.getState().generateAdviceForStocks([stock])

      const state = useSignalAdviceStore.getState()
      expect(state.error).toBe('批量服务异常')
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[signalAdviceStore] generateAdviceForStocks 异常',
        { error: '批量服务异常' },
      )
    })

    it('空数组：应正常完成并广播 count=0', async () => {
      await useSignalAdviceStore.getState().generateAdviceForStocks([])

      const state = useSignalAdviceStore.getState()
      expect(state.adviceMap).toEqual({})
      expect(state.loading).toBe(false)
      expect(mockWithBroadcast).toHaveBeenCalledWith('signals:changed', {
        action: 'generateAdviceBatch',
        count: 0,
      })
    })
  })
})
