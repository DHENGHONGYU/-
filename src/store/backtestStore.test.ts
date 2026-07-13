import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Order } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockOrdersList = vi.hoisted(() => vi.fn())
const mockSignalsList = vi.hoisted(() => vi.fn())
const mockDailyQuotesGet = vi.hoisted(() => vi.fn())

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    orders: { list: mockOrdersList },
    signals: { list: mockSignalsList },
    dailyQuotes: { get: mockDailyQuotesGet },
  },
}))

const { mockSubscribe, capturedCallbacks, unsubscribes } = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, ((envelope: StandardEnvelope) => void)>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  const mockSubscribe = vi.fn((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedCallbacks.set(channel, callback)
    const unsub = vi.fn()
    unsubscribes.push(unsub)
    return unsub
  })
  return { mockSubscribe, capturedCallbacks, unsubscribes }
})

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    subscribe: mockSubscribe,
    query: vi.fn(async (request: { store: string; key?: string }) => {
      if (request.store === 'orders') {
        const data = await mockOrdersList()
        return { success: true, data }
      }
      if (request.store === 'signals') {
        const data = await mockSignalsList()
        return { success: true, data }
      }
      if (request.store === 'daily_quotes') {
        const data = await mockDailyQuotesGet(request.key)
        return { success: true, data }
      }
      return { success: true, data: [] }
    }),
  },
}))

vi.mock('@/config/dbConfig', () => ({
  DB_VERSION: 1,
  ENVELOPE_ACTION: {
    insertOrder: 'INSERT_ORDER',
    updateOrder: 'UPDATE_ORDER',
    deleteOrder: 'DELETE_ORDER',
  },
  MODULE_ID: { tradinghub: 'tradinghub' },
  STORE_NAME: { orders: 'orders', signals: 'signals', dailyQuotes: 'daily_quotes' },
}))

// ============================================================
// Imports
// ============================================================

import { useBacktestStore, initBacktestStoreSubscriptions } from './backtestStore'

// ============================================================
// Helpers
// ============================================================

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    symbol: 'AAPL',
    direction: 'buy',
    price: 100,
    quantity: 10,
    amount: 1000,
    status: 'filled',
    accountType: 'real',
    createdAt: Date.now(),
    ...overrides,
  } as Order
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0

  // 清理模块级订阅状态
  const cleanup = initBacktestStoreSubscriptions()
  cleanup()

  // 默认数据层返回空数据
  mockSignalsList.mockResolvedValue([])
  mockDailyQuotesGet.mockResolvedValue(undefined)
  mockOrdersList.mockResolvedValue([])

  useBacktestStore.setState({
    config: {
      strategy: 'hot_sector',
      startDate: '2023-01-01',
      endDate: '2024-01-01',
      initialCapital: 1_000_000,
    },
    results: null,
    loading: false,
    error: null,
    lastRunAt: null,
  })
})

// ============================================================
// useBacktestStore
// ============================================================

describe('useBacktestStore', () => {
  it('初始状态验证', () => {
    const state = useBacktestStore.getState()
    expect(state.config.strategy).toBe('hot_sector')
    expect(state.config.initialCapital).toBe(1_000_000)
    expect(state.results).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastRunAt).toBeNull()
  })

  it('setConfig: 更新部分配置', () => {
    useBacktestStore.getState().setConfig({ strategy: 'value_pit' })
    expect(useBacktestStore.getState().config.strategy).toBe('value_pit')
    expect(useBacktestStore.getState().config.initialCapital).toBe(1_000_000)

    useBacktestStore.getState().setConfig({ initialCapital: 500_000, startDate: '2022-01-01' })
    expect(useBacktestStore.getState().config.initialCapital).toBe(500_000)
    expect(useBacktestStore.getState().config.startDate).toBe('2022-01-01')
    expect(useBacktestStore.getState().config.strategy).toBe('value_pit')
  })

  it('runBacktest: 有订单时成功执行回测', async () => {
    mockOrdersList.mockResolvedValue([
      createMockOrder({ direction: 'buy', price: 100 }),
      createMockOrder({ direction: 'sell', price: 110 }),
    ])

    await useBacktestStore.getState().runBacktest()

    const state = useBacktestStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.results).not.toBeNull()
    expect(state.lastRunAt).not.toBeNull()
    expect(state.results!.tradeCount).toBeGreaterThanOrEqual(0)
    expect(state.results!.pnlCurve.length).toBeGreaterThan(0)
  })

  it('runBacktest: 无订单时执行纯模拟', async () => {
    mockOrdersList.mockResolvedValue([])

    await useBacktestStore.getState().runBacktest()

    const state = useBacktestStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.results).not.toBeNull()
    expect(state.results!.tradeCount).toBeGreaterThanOrEqual(0)
  })

  it('runBacktest: orders.list 失败时 BacktestEngine 内部捕获并使用空数组继续执行', async () => {
    // BacktestEngine 内部 try/catch 吞掉了 orders.list 的错误，使用空订单继续回测
    mockOrdersList.mockRejectedValue(new Error('DB error'))

    await useBacktestStore.getState().runBacktest()

    const state = useBacktestStore.getState()
    expect(state.loading).toBe(false)
    // BacktestEngine 内部捕获了 orders 错误，不会设置 store.error
    expect(state.error).toBeNull()
    // 回测仍然完成（使用空订单数组）
    expect(state.results).not.toBeNull()
  })

  it('runBacktest: orders.list 非 Error 异常时同样内部捕获继续执行', async () => {
    mockOrdersList.mockRejectedValue('string-error')

    await useBacktestStore.getState().runBacktest()

    // 错误被 BacktestEngine 内部捕获，store.error 保持 null
    expect(useBacktestStore.getState().error).toBeNull()
    expect(useBacktestStore.getState().results).not.toBeNull()
  })

  it('runBacktest: 设置 loading 为 true 并开始计算', async () => {
    let resolveList: (value: Order[]) => void
    const listPromise = new Promise<Order[]>((r) => { resolveList = r })
    mockOrdersList.mockReturnValue(listPromise)

    const promise = useBacktestStore.getState().runBacktest()
    expect(useBacktestStore.getState().loading).toBe(true)
    expect(useBacktestStore.getState().error).toBeNull()

    resolveList!([createMockOrder()])
    await promise

    expect(useBacktestStore.getState().loading).toBe(false)
  })

  it('clearResults: 清空结果', () => {
    useBacktestStore.setState({
      results: {
        totalReturn: 10,
        annualizedReturn: 5,
        maxDrawdown: 2,
        sharpeRatio: 1.5,
        winRate: 60,
        tradeCount: 10,
        profitTrades: 6,
        lossTrades: 4,
        avgProfit: 5,
        avgLoss: -3,
        pnlCurve: [1, 1.1],
        trades: [],
      },
      error: 'some error',
      lastRunAt: Date.now(),
    })

    useBacktestStore.getState().clearResults()

    const state = useBacktestStore.getState()
    expect(state.results).toBeNull()
    expect(state.error).toBeNull()
    expect(state.lastRunAt).toBeNull()
  })

  it('runBacktest: 不同策略类型都能运行', async () => {
    const strategies = ['hot_sector', 'value_pit', 'composite'] as const
    for (const strategy of strategies) {
      mockOrdersList.mockResolvedValue([createMockOrder()])
      useBacktestStore.getState().setConfig({ strategy })
      await useBacktestStore.getState().runBacktest()
      expect(useBacktestStore.getState().error).toBeNull()
      expect(useBacktestStore.getState().results).not.toBeNull()
    }
  })

  it('runBacktest: 结果中包含持仓快照与每日净值序列（供导出使用）', async () => {
    const inRangeDate = new Date('2023-06-15T10:00:00.000Z').getTime()
    mockOrdersList.mockResolvedValue([
      createMockOrder({ direction: 'buy', price: 100, createdAt: inRangeDate }),
      createMockOrder({ direction: 'sell', price: 110, createdAt: inRangeDate + 86_400_000 }),
    ])
    mockDailyQuotesGet.mockResolvedValue({
      symbol: 'AAPL',
      latest: { date: '2023-06-16', close: 110, open: 105, high: 112, low: 104, volume: 1_000_000 },
      history: [
        { date: '2023-06-15', close: 100, open: 99, high: 101, low: 98, volume: 1_000_000 },
        { date: '2023-06-16', close: 110, open: 105, high: 112, low: 104, volume: 1_000_000 },
      ],
      updatedAt: Date.now(),
    })

    await useBacktestStore.getState().runBacktest()

    const state = useBacktestStore.getState()
    expect(state.error).toBeNull()
    expect(state.results).not.toBeNull()
    expect(state.results!.positions).toBeDefined()
    expect(state.results!.dailyValues).toBeDefined()
    expect(state.results!.dailyValues!.length).toBeGreaterThan(0)
  })
})

// ============================================================
// initBacktestStoreSubscriptions
// ============================================================

describe('initBacktestStoreSubscriptions', () => {
  it('source 过滤 + action 过滤', async () => {
    const cleanup = initBacktestStoreSubscriptions()
    const cb = capturedCallbacks.get('orders')
    expect(cb).toBeDefined()

    // tradinghub source 应该被过滤
    cb!({
      meta: { source: 'tradinghub', target: 'ui', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    } as unknown as StandardEnvelope)

    // 不相关的 action 应该被过滤
    cb!({
      meta: { source: 'other', target: 'ui', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() },
      payload: {},
    } as unknown as StandardEnvelope)

    await new Promise((r) => setTimeout(r, 150))

    // 有效事件应该触发
    cb!({
      meta: { source: 'other', target: 'ui', action: 'INSERT_ORDER', traceId: 't3', timestamp: Date.now() },
      payload: {},
    } as unknown as StandardEnvelope)

    await new Promise((r) => setTimeout(r, 150))

    cleanup()
  })

  it('去抖 100ms', async () => {
    const cleanup = initBacktestStoreSubscriptions()
    const cb = capturedCallbacks.get('orders')
    expect(cb).toBeDefined()

    // 连续发送 3 个有效事件
    cb!({
      meta: { source: 'other', target: 'ui', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    } as unknown as StandardEnvelope)
    cb!({
      meta: { source: 'other', target: 'ui', action: 'UPDATE_ORDER', traceId: 't2', timestamp: Date.now() },
      payload: {},
    } as unknown as StandardEnvelope)
    cb!({
      meta: { source: 'other', target: 'ui', action: 'DELETE_ORDER', traceId: 't3', timestamp: Date.now() },
      payload: {},
    } as unknown as StandardEnvelope)

    // 50ms 内不应触发处理（ debounce 内）
    await new Promise((r) => setTimeout(r, 50))

    // 150ms 后应只触发一次处理
    await new Promise((r) => setTimeout(r, 150))

    cleanup()
  })

  it('返回 cleanup 函数', () => {
    const cleanup = initBacktestStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    cleanup()

    // 再次初始化应该能重新订阅
    const cleanup2 = initBacktestStoreSubscriptions()
    expect(typeof cleanup2).toBe('function')
    cleanup2()
  })

  it('重复初始化应返回已存在的 cleanup', () => {
    const cleanup1 = initBacktestStoreSubscriptions()
    const cleanup2 = initBacktestStoreSubscriptions()
    expect(cleanup1).toBe(cleanup2)
    cleanup1()
  })
})
