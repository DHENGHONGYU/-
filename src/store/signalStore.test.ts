/**
 * @test_id V9-TEST-ST-156
 * signalStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. refresh: 正常生成信号（前20只股票，每只生成信号后 pickStrongest）
 * 3. refresh: 信号按 confidence 降序排列
 * 4. refresh: 单只股票信号生成失败跳过
 * 5. refresh: 股票池为空 → signals 为空
 * 6. refresh: generateSignalsForSymbol 全部失败 → signals 为空
 * 7. refresh: 失败时设置 error（dataBridge.query 抛异常）
 * 8. refresh: 设置 loading / isRefreshing 状态
 * 9. topSignals: 取前 N 个（默认10）
 * 10. topSignals: limit 大于总数
 * 11. topSignals: signals 为空
 * 12. initSignalStoreSubscriptions: 订阅 2 个频道（v6_scores + signals）
 * 13. initSignalStoreSubscriptions: source 过滤（跳过 trading/tradinghub）
 * 14. initSignalStoreSubscriptions: action 过滤（只响应特定 action）
 * 15. initSignalStoreSubscriptions: 去抖 100ms + 并发锁
 * 16. initSignalStoreSubscriptions: 返回 cleanup 函数
 * 17. initSignalStoreGlobalSubscriptions: 首次调用注册订阅 + checkDataReady
 * 18. initSignalStoreGlobalSubscriptions: 重复调用幂等
 * 19. initSignalStoreGlobalSubscriptions: 已有组件级订阅时标记为全局
 * 20. destroySignalStoreSubscriptions: 全局保护跳过清理
 * 21. destroySignalStoreSubscriptions: 组件级正常清理（清除定时器 + unsub）
 * 22. initSignalStoreSubscriptions: 已有全局订阅时返回 no-op cleanup
 * 23. refresh: 排队刷新（_pendingRefresh）在完成后触发
 * 24. checkDataReady: 两个查询都成功 → dataReady=true
 * 25. checkDataReady: 股票池空 → dataReady=false
 * 26. checkDataReady: 异常 → dataReady=false
 * @covers_docs [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
 */

import { vi } from 'vitest'
import type { Signal, Stock } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import { assertContract } from '../../tests/contracts'

// ============================================================
// vi.hoisted mocks
// ============================================================

const { mockSubscribe, mockDataBridgeQuery, capturedCallbacks, unsubscribes } = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, ((envelope: StandardEnvelope) => void)>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  const mockSubscribe = vi.fn((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedCallbacks.set(channel, callback)
    const unsub = vi.fn()
    unsubscribes.push(unsub)
    return unsub
  })
  const mockDataBridgeQuery = vi.fn()
  return { mockSubscribe, mockDataBridgeQuery, capturedCallbacks, unsubscribes }
})

// ============================================================
// vi.mock declarations
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, query: mockDataBridgeQuery },
}))

vi.mock('@/services/trading/signalGenerator', () => ({
  generateSignalsForSymbol: vi.fn(),
  pickStrongestSignal: vi.fn(),
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    insertSignal: 'INSERT_SIGNAL',
    saveV6Score: 'SAVE_V6_SCORE',
    saveScores: 'SAVE_SCORES',
    queryList: 'QUERY_LIST',
  },
  MODULE_ID: { trading: 'trading', tradinghub: 'tradinghub' },
  STORE_NAME: { stocks: 'stocks', signals: 'signals', v6Scores: 'v6_scores' },
}))

// ============================================================
// Imports
// ============================================================

import { useSignalStore, topSignals, initSignalStoreSubscriptions, initSignalStoreGlobalSubscriptions, _resetSignalStoreSubscriptionsForTest } from './signalStore'
import {
  generateSignalsForSymbol,
  pickStrongestSignal,
} from '@/services/trading/signalGenerator'

// ============================================================
// Helpers
// ============================================================

function createMockStock(symbol: string): Stock {
  return {
    symbol,
    name: symbol,
    researchStatus: 'candidate',
    source: 'manual',
    dataVersion: 1,
  } as Stock
}

function createMockSignal(
  symbol: string,
  confidence: number,
  direction: 'buy' | 'sell' = 'buy',
): Signal {
  return {
    id: `sig-${symbol}`,
    symbol,
    type: 'momentum',
    confidence,
    direction,
    rationale: 'test',
    snapshot: {},
    createdAt: Date.now(),
  } as Signal
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0

  // 重新设置 mockSubscribe 实现（clearAllMocks 会清除实现）
  mockSubscribe.mockImplementation((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedCallbacks.set(channel, callback)
    const unsub = vi.fn()
    unsubscribes.push(unsub)
    return unsub
  })

  // 清理模块级订阅状态，确保每次测试都是干净的
  _resetSignalStoreSubscriptionsForTest()

  useSignalStore.setState({
    signals: [],
    loading: false,
    error: null,
    lastUpdated: 0,
    isRefreshing: false,
  })
})

// ============================================================
// 初始状态
// ============================================================

describe('useSignalStore', () => {
  it('初始状态验证', () => {
    const state = useSignalStore.getState()
    expect(state.signals).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
    expect(state.isRefreshing).toBe(false)
    
    // 验证初始状态符合契约
    assertContract('SignalState', state, '初始状态')
  })

  // ============================================================
  // refresh
  // ============================================================

  it('refresh: 正常生成信号（前20只股票，每只生成信号后 pickStrongest）', async () => {
    const stocks = Array.from({ length: 25 }, (_, i) => createMockStock(`STK${i}`))
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })

    stocks.slice(0, 20).forEach((stock, i) => {
      const signal = createMockSignal(stock.symbol, 50 + i)
      ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([signal])
      ;(pickStrongestSignal as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(signal)
    })

    await useSignalStore.getState().refresh()

    const state = useSignalStore.getState()
    expect(state.signals).toHaveLength(20)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBeGreaterThan(0)
    expect(generateSignalsForSymbol).toHaveBeenCalledTimes(20)
  })

  it('refresh: 信号按 confidence 降序排列', async () => {
    const stocks = [createMockStock('A'), createMockStock('B'), createMockStock('C')]
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })

    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([createMockSignal('A', 30)])
      .mockResolvedValueOnce([createMockSignal('B', 80)])
      .mockResolvedValueOnce([createMockSignal('C', 50)])

    ;(pickStrongestSignal as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(createMockSignal('A', 30))
      .mockReturnValueOnce(createMockSignal('B', 80))
      .mockReturnValueOnce(createMockSignal('C', 50))

    await useSignalStore.getState().refresh()

    const signals = useSignalStore.getState().signals
    expect(signals[0]!.confidence).toBe(80)
    expect(signals[1]!.confidence).toBe(50)
    expect(signals[2]!.confidence).toBe(30)
  })

  it('refresh: 单只股票信号生成失败跳过', async () => {
    const stocks = [createMockStock('A'), createMockStock('B')]
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })

    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([createMockSignal('B', 60)])

    ;(pickStrongestSignal as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(createMockSignal('B', 60))

    await useSignalStore.getState().refresh()

    expect(useSignalStore.getState().signals).toHaveLength(1)
    expect(useSignalStore.getState().signals[0]!.symbol).toBe('B')
  })

  it('refresh: 股票池为空 → signals 为空', async () => {
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
    await useSignalStore.getState().refresh()
    expect(useSignalStore.getState().signals).toEqual([])
    expect(useSignalStore.getState().loading).toBe(false)
  })

  it('refresh: generateSignalsForSymbol 全部失败 → signals 为空', async () => {
    const stocks = [createMockStock('A'), createMockStock('B')]
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })
    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    )

    await useSignalStore.getState().refresh()

    expect(useSignalStore.getState().signals).toEqual([])
    expect(useSignalStore.getState().error).toBeNull()
  })

  it('refresh: 失败时设置 error（dataBridge.query 抛异常）', async () => {
    mockDataBridgeQuery.mockRejectedValue(new Error('db error'))

    await useSignalStore.getState().refresh()

    const state = useSignalStore.getState()
    expect(state.error).toBe('db error')
    expect(state.loading).toBe(false)
    expect(state.isRefreshing).toBe(false)
  })

  it('refresh: 设置 loading / isRefreshing 状态', async () => {
    const stocks = [createMockStock('A')]
    let resolveList: (value: { success: true; data: Stock[] }) => void
    const listPromise = new Promise<{ success: true; data: Stock[] }>((r) => {
      resolveList = r
    })
    mockDataBridgeQuery.mockReturnValue(listPromise)
    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockSignal('A', 70),
    ])
    ;(pickStrongestSignal as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockSignal('A', 70),
    )

    const promise = useSignalStore.getState().refresh()

    // refresh 执行中 loading 和 isRefreshing 应为 true
    expect(useSignalStore.getState().loading).toBe(true)
    expect(useSignalStore.getState().isRefreshing).toBe(true)

    resolveList!({ success: true, data: stocks })
    await promise

    // refresh 结束后恢复为 false
    expect(useSignalStore.getState().loading).toBe(false)
    expect(useSignalStore.getState().isRefreshing).toBe(false)
  })

  // ============================================================
  // refresh: 并发锁 + 排队刷新
  // ============================================================

  /** @test_id V9-TEST-ST-156-refresh-pending-01 */
  it('refresh: 并发锁，isRefreshing=true 时跳过', async () => {
    const stocks = [createMockStock('A')]
    let resolveList!: (value: { success: true; data: Stock[] }) => void
    const listPromise = new Promise<{ success: true; data: Stock[] }>((r) => { resolveList = r })
    mockDataBridgeQuery.mockReturnValue(listPromise)
    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockSignal('A', 70),
    ])
    ;(pickStrongestSignal as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockSignal('A', 70),
    )

    const promise1 = useSignalStore.getState().refresh()
    // isRefreshing=true → 第二次调用直接跳过
    await useSignalStore.getState().refresh()

    // dataBridge.query 只应被调用一次
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(1)

    resolveList!({ success: true, data: stocks })
    await promise1
  })

  // ============================================================
  // topSignals
  // ============================================================

  it('topSignals: 取前 N 个（默认10）', () => {
    const signals = Array.from({ length: 15 }, (_, i) =>
      createMockSignal(`S${i}`, 100 - i),
    )
    useSignalStore.setState({ signals })

    const result = topSignals()
    expect(result).toHaveLength(10)
    expect(result[0]!.symbol).toBe('S0')
    expect(result[9]!.symbol).toBe('S9')
  })

  it('topSignals: limit 大于总数', () => {
    const signals = [createMockSignal('A', 80), createMockSignal('B', 70)]
    useSignalStore.setState({ signals })

    const result = topSignals(100)
    expect(result).toHaveLength(2)
  })

  it('topSignals: signals 为空', () => {
    useSignalStore.setState({ signals: [] })
    expect(topSignals()).toEqual([])
    expect(topSignals(5)).toEqual([])
  })

  // ============================================================
  // checkDataReady
  // ============================================================

  /** @test_id V9-TEST-ST-156-check-01 */
  it('checkDataReady: 两个查询都成功且有数据 → dataReady=true', async () => {
    mockDataBridgeQuery
      .mockResolvedValueOnce({ success: true, data: [createMockStock('A')] })
      .mockResolvedValueOnce({ success: true, data: [{ score: 90 }] })

    await useSignalStore.getState().checkDataReady()

    expect(useSignalStore.getState().dataReady).toBe(true)
  })

  /** @test_id V9-TEST-ST-156-check-02 */
  it('checkDataReady: 股票池为空 → dataReady=false', async () => {
    mockDataBridgeQuery
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [{ score: 90 }] })

    await useSignalStore.getState().checkDataReady()

    expect(useSignalStore.getState().dataReady).toBe(false)
  })

  /** @test_id V9-TEST-ST-156-check-03 */
  it('checkDataReady: 查询失败 → dataReady=false', async () => {
    mockDataBridgeQuery
      .mockResolvedValueOnce({ success: false, error: 'fail' })
      .mockResolvedValueOnce({ success: true, data: [{ score: 90 }] })

    await useSignalStore.getState().checkDataReady()

    expect(useSignalStore.getState().dataReady).toBe(false)
  })

  /** @test_id V9-TEST-ST-156-check-04 */
  it('checkDataReady: 异常 → dataReady=false', async () => {
    mockDataBridgeQuery.mockRejectedValue(new Error('network'))

    await useSignalStore.getState().checkDataReady()

    expect(useSignalStore.getState().dataReady).toBe(false)
  })
})

// ============================================================
// initSignalStoreSubscriptions
// ============================================================

describe('initSignalStoreSubscriptions', () => {
  it('订阅 2 个频道（v6_scores + signals）', () => {
    initSignalStoreSubscriptions()

    expect(mockSubscribe).toHaveBeenCalledTimes(2)
    expect(mockSubscribe).toHaveBeenCalledWith('v6_scores', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('signals', expect.any(Function))
  })

  it('source 过滤（跳过 trading/tradinghub）', async () => {
    initSignalStoreSubscriptions()
    const v6Cb = capturedCallbacks.get('v6_scores')
    const signalsCb = capturedCallbacks.get('signals')
    expect(v6Cb).toBeDefined()
    expect(signalsCb).toBeDefined()

    // 模拟 refresh 已经被触发过，避免并发锁影响
    useSignalStore.setState({ isRefreshing: false })

    // trading source 应该被过滤掉
    v6Cb!({
      meta: { source: 'trading', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })
    signalsCb!({
      meta: { source: 'tradinghub', target: 'db', action: 'INSERT_SIGNAL', traceId: 't2', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 150))
    // 不应该触发 refresh（因为没有合法的 source 通过）
    expect(useSignalStore.getState().isRefreshing).toBe(false)
  })

  it('action 过滤（只响应特定 action）', async () => {
    const stocks = [createMockStock('A')]
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })
    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockSignal('A', 60),
    ])
    ;(pickStrongestSignal as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockSignal('A', 60),
    )

    initSignalStoreSubscriptions()
    const v6Cb = capturedCallbacks.get('v6_scores')!
    const signalsCb = capturedCallbacks.get('signals')!

    // 不相关的 action 不应触发
    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })
    signalsCb({
      meta: { source: 'analyzer', target: 'db', action: 'UPDATE_ORDER', traceId: 't2', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 350))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()

    // 正确的 action 应该触发（使用 SAVE_SCORES）
    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't3', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(1)
  })

  it('去抖 300ms + 并发锁', async () => {
    const stocks = [createMockStock('A')]
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })
    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockSignal('A', 60),
    ])
    ;(pickStrongestSignal as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockSignal('A', 60),
    )

    initSignalStoreSubscriptions()
    const v6Cb = capturedCallbacks.get('v6_scores')!

    // 连续触发多次
    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })
    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() },
      payload: {},
    })
    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't3', timestamp: Date.now() },
      payload: {},
    })

    // 100ms 内不应触发
    await new Promise((r) => setTimeout(r, 100))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()

    // 400ms 后应只触发一次
    await new Promise((r) => setTimeout(r, 350))
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(1)

    // 模拟 isRefreshing=true，再次触发应该被跳过
    useSignalStore.setState({ isRefreshing: true })
    vi.clearAllMocks()

    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't4', timestamp: Date.now() },
      payload: {},
    })
    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
  })

  it('返回 cleanup 函数', () => {
    const cleanup = initSignalStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2)
    expect(typeof cleanup).toBe('function')

    cleanup()

    // 再次初始化应该能重新订阅（因为之前的 cleanup 已清理）
    const cleanup2 = initSignalStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(4) // 2次 + 2次
    expect(typeof cleanup2).toBe('function')

    cleanup2()
  })

  // ============================================================
  // 新增：幂等 + cleanup 路径
  // ============================================================

  /** @test_id V9-TEST-ST-156-sub-idempotent-01 */
  it('已有组件级订阅时，返回销毁函数（不重复注册）', () => {
    initSignalStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2)

    // 再次调用 → 幂等返回 destroySignalStoreSubscriptions
    const cleanup = initSignalStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2) // 不增加
    expect(typeof cleanup).toBe('function')

    cleanup() // 清理
  })

  /** @test_id V9-TEST-ST-156-sub-idempotent-02 */
  it('全局已初始化时，返回 no-op cleanup', () => {
    // 先全局初始化
    mockDataBridgeQuery.mockResolvedValue({ success: false, error: 'no data' })
    initSignalStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2)

    // 组件级调用 → 返回 no-op cleanup
    const cleanup = initSignalStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2) // 不增加
    expect(typeof cleanup).toBe('function')

    // cleanup 不应调用 unsub（全局保护）
    cleanup()
    unsubscribes.forEach(unsub => expect(unsub).not.toHaveBeenCalled())
  })

  /** @test_id V9-TEST-ST-156-sub-callback-01 */
  it('signals 频道回调：tradinghub source 被过滤', async () => {
    initSignalStoreSubscriptions()
    const signalsCb = capturedCallbacks.get('signals')!

    signalsCb({
      meta: { source: 'tradinghub', target: 'db', action: 'INSERT_SIGNAL', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
  })
})

// ============================================================
// initSignalStoreGlobalSubscriptions
// ============================================================

describe('initSignalStoreGlobalSubscriptions', () => {
  /** @test_id V9-TEST-ST-156-global-01 */
  it('首次调用 → 注册订阅 + 调用 checkDataReady', async () => {
    mockDataBridgeQuery
      .mockResolvedValueOnce({ success: true, data: [createMockStock('A')] })
      .mockResolvedValueOnce({ success: false, error: 'no scores' })

    initSignalStoreGlobalSubscriptions()

    expect(mockSubscribe).toHaveBeenCalledTimes(2)
    expect(mockSubscribe).toHaveBeenCalledWith('v6_scores', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('signals', expect.any(Function))

    // 等待 checkDataReady 完成
    await vi.waitFor(() => expect(mockDataBridgeQuery).toHaveBeenCalled(), { timeout: 1000 })
    // checkDataReady 调用了 2 次 query（stocks + v6Scores）
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(2)
    expect(useSignalStore.getState().dataReady).toBe(false)
  })

  /** @test_id V9-TEST-ST-156-global-02 */
  it('重复调用 → 幂等跳过', () => {
    mockDataBridgeQuery.mockResolvedValue({ success: false, error: 'no data' })

    initSignalStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2)

    initSignalStoreGlobalSubscriptions()
    // 仍然只注册了 2 次
    expect(mockSubscribe).toHaveBeenCalledTimes(2)
  })

  /** @test_id V9-TEST-ST-156-global-03 */
  it('已有组件级订阅时 → 标记为全局（不重复注册）', () => {
    mockDataBridgeQuery.mockResolvedValue({ success: false, error: 'no data' })

    // 先组件级初始化
    initSignalStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2)

    // 再全局初始化 → 已有订阅，只标记全局
    initSignalStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2) // 不增加
  })

  /** @test_id V9-TEST-ST-156-global-04 */
  it('全局初始化后，组件级 cleanup 不销毁订阅', () => {
    mockDataBridgeQuery.mockResolvedValue({ success: false, error: 'no data' })

    initSignalStoreGlobalSubscriptions()
    const unsubs = [...unsubscribes]

    // 组件调用 init → 获取 no-op cleanup
    const cleanup = initSignalStoreSubscriptions()
    cleanup()

    // 全局保护 → unsub 不应被调用
    unsubs.forEach(unsub => expect(unsub).not.toHaveBeenCalled())
  })

  /** @test_id V9-TEST-ST-156-global-05 */
  it('全局初始化后，回调能正常触发', async () => {
    const stocks = [createMockStock('A')]
    mockDataBridgeQuery
      .mockResolvedValueOnce({ success: false, error: 'no scores' })
      .mockResolvedValueOnce({ success: false, error: 'no scores' })
      .mockResolvedValue({ success: true, data: stocks })
    ;(generateSignalsForSymbol as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockSignal('A', 60),
    ])
    ;(pickStrongestSignal as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockSignal('A', 60),
    )

    initSignalStoreGlobalSubscriptions()
    // 等待 checkDataReady 完成
    await vi.waitFor(() => expect(mockDataBridgeQuery).toHaveBeenCalled(), { timeout: 1000 })

    vi.clearAllMocks()
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: stocks })

    // 触发回调
    const v6Cb = capturedCallbacks.get('v6_scores')!
    v6Cb({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    await vi.waitFor(() => expect(mockDataBridgeQuery).toHaveBeenCalled(), { timeout: 1000 })
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// destroySignalStoreSubscriptions
// ============================================================

describe('destroySignalStoreSubscriptions（通过 cleanup 间接触发）', () => {
  /** @test_id V9-TEST-ST-156-destroy-01 */
  it('组件级 cleanup → 取消订阅 + 清除定时器', () => {
    initSignalStoreSubscriptions()
    const unsubs = [...unsubscribes]
    expect(unsubs.length).toBe(2)

    const cleanup = initSignalStoreSubscriptions()
    cleanup()

    // 两个 unsub 都应被调用
    unsubs.forEach(unsub => expect(unsub).toHaveBeenCalled())
  })

  /** @test_id V9-TEST-ST-156-destroy-02 */
  it('全局初始化后，destroy 跳过（全局保护）', () => {
    mockDataBridgeQuery.mockResolvedValue({ success: false, error: 'no data' })

    initSignalStoreGlobalSubscriptions()
    const unsubs = [...unsubscribes]

    // 直接调用 cleanup（全局标记保护）
    const cleanup = initSignalStoreSubscriptions()
    cleanup()

    unsubs.forEach(unsub => expect(unsub).not.toHaveBeenCalled())
  })
})

// ============================================================
// _resetSignalStoreSubscriptionsForTest
// ============================================================

describe('_resetSignalStoreSubscriptionsForTest', () => {
  /** @test_id V9-TEST-ST-156-reset-01 */
  it('重置所有订阅状态和 store 状态', () => {
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
    initSignalStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2)

    _resetSignalStoreSubscriptionsForTest()

    // store 状态应回到初始值
    const state = useSignalStore.getState()
    expect(state.signals).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
    expect(state.isRefreshing).toBe(false)
    expect(state.dataReady).toBe(false)
  })
})
