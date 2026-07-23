/**
 * @test_id V9-TEST-ST-134
 * dualStrategyStore 单元测试
 *
 * 覆盖场景：
 * 1.  初始状态验证
 * 2.  fetchScores: 传入 stocks，调用 runDualStrategy，更新 3 个 scores
 * 3.  fetchScores: 无传入 stocks，从 poolStore 获取
 * 4.  fetchScores: poolStore 为空，从 dataLayer.stocks.list 获取
 * 5.  fetchScores: 股票池为空，返回空结果（不 fallback 到 Mock 数据）
 * 6.  fetchScores: 并发锁（isRefreshing=true 跳过）
 * 7.  fetchScores: runDualStrategy 失败，快照回滚
 * 8.  fetchScores: 持久化到 DataBridge（调用 save）
 * 9.  fetchScores: scores 按 score 降序排序
 * 10. refresh: 从 dataLayer 读取 3 个列表
 * 11. refresh: 过滤 rotationSignals（type='buy_rotation'）
 * 12. refresh: 并发锁
 * 13. refresh: 失败设置 error
 * 14. clearScores: 重置所有状态
 * 15. topHotSectors: 取前 N 个（默认 5）
 * 16. topValuePits: 取前 N 个
 * 17. activeRotationSignals: 过滤 triggered=true
 * 18. hotSectorBuySignals: 过滤 action='immediate'
 * 19. valuePitBuildCandidates: 过滤 action='immediate'
 * 20. valuePitWaitSignals: 过滤 action='wait'
 * 21. hotSectorBySymbol: 存在/不存在
 * 22. valuePitBySymbol: 存在/不存在
 * 23. rotationSignalBySector: 存在/不存在
 * 24. signalToRotationSignal: confidence>=0.7→strong, >=0.4→medium, 否则 weak
 * 25. rotationSignalToSignal: strong→0.8, medium→0.6, weak→0.4
 * 26. shouldSkipSelf: analyzer/tradinghub/strategy → true, 其他 → false
 * 27. initDualStrategyStoreSubscriptions: 订阅 5 个频道
 * 28. initDualStrategyStoreSubscriptions: source 过滤（shouldSkipSelf）
 * 29. initDualStrategyStoreSubscriptions: 去抖 100ms
 * 30. initDualStrategyStoreSubscriptions: 重复调用不重复订阅
 * 31. initDualStrategyStoreSubscriptions: 返回 cleanup
 * 32. destroyDualStrategyStoreSubscriptions: 清除所有订阅和定时器
  * @covers_docs [V9-DOC-BACK-003, V9-DOC-BACK-012, V9-DOC-ARCH-008, V9-DOC-BACK-010, V9-DOC-BACK-006]
*/

import { vi } from 'vitest'
import type { HotSectorScore, ValuePitScore, Signal, Stock } from '@/data/types'
import type { RotationSignal } from '@/services/scoring/rotationSignalDetector'
import type { StandardEnvelope } from '@/core/envelope'

// ============================================================
// vi.hoisted mocks
// ============================================================

const {
  mockDataBridgeQuery,
  mockDataBridgeForward,
  mockRunDualStrategy,
  mockHotSectorAnalyze,
  mockValuePitAnalyze,
  mockRotationDetect,
  mockSubscribe,
  capturedCallbacks,
  unsubscribes,
} = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, ((envelope: StandardEnvelope) => void)>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  return {
    mockDataBridgeQuery: vi.fn().mockResolvedValue({ success: true, data: [] }),
    mockDataBridgeForward: vi.fn().mockResolvedValue({ success: true }),
    mockRunDualStrategy: vi.fn(),
    mockHotSectorAnalyze: vi.fn(),
    mockValuePitAnalyze: vi.fn(),
    mockRotationDetect: vi.fn(),
    mockSubscribe: vi.fn((channel: string, callback: (envelope: StandardEnvelope) => void) => {
      capturedCallbacks.set(channel, callback)
      const unsub = vi.fn()
      unsubscribes.push(unsub)
      return unsub
    }),
    capturedCallbacks,
    unsubscribes,
  }
})

// ============================================================
// vi.mock declarations
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, query: mockDataBridgeQuery, forward: mockDataBridgeForward },
}))

vi.mock('@/services/trading/dualStrategyEngine', () => ({
  runDualStrategy: mockRunDualStrategy,
}))

vi.mock('@/services/scoring/hotSectorAnalyzer', () => ({
  analyze: mockHotSectorAnalyze,
}))

vi.mock('@/services/scoring/valuePitAnalyzer', () => ({
  analyze: mockValuePitAnalyze,
}))

vi.mock('@/services/scoring/rotationSignalDetector', () => ({
  detect: mockRotationDetect,
}))

vi.mock('@/config/dbConfig', () => ({
  MODULE_ID: { analyzer: 'analyzer', tradinghub: 'tradinghub', strategy: 'strategy', pool: 'pool' },
  STORE_NAME: { hotSectorScores: 'hotSectorScores', valuePitScores: 'valuePitScores', rotationScores: 'rotationScores', signals: 'signals', stocks: 'stocks' },
  ENVELOPE_ACTION: { queryList: 'QUERY_LIST', saveScores: 'SAVE_SCORES', insertSignal: 'INSERT_SIGNAL', saveV6Score: 'SAVE_V6_SCORE' },
  ENVELOPE_TARGET: { db: 'db' },
}))

// ============================================================
// Imports
// ============================================================

import {
  useDualStrategyStore,
  topHotSectors,
  topValuePits,
  activeRotationSignals,
  hotSectorBuySignals,
  valuePitBuildCandidates,
  valuePitWaitSignals,
  hotSectorBySymbol,
  valuePitBySymbol,
  rotationSignalBySector,
  signalToRotationSignal,
  rotationSignalToSignal,
  getSnapshot,
  shouldSkipSelf,
  initDualStrategyStoreSubscriptions,
  initDualStrategyStoreGlobalSubscriptions,
  _resetDualStrategyStoreSubscriptionsForTest,
} from './dualStrategyStore'

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

function createMockHotSectorScore(symbol: string, score: number, action: 'immediate' | 'probe' | 'ignore' = 'immediate'): HotSectorScore {
  return {
    symbol,
    name: symbol,
    score,
    dimensions: {} as any,
    action,
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
}

function createMockValuePitScore(symbol: string, score: number, action: 'immediate' | 'probe' | 'wait' | 'ignore' = 'immediate'): ValuePitScore {
  return {
    symbol,
    name: symbol,
    score,
    dimensions: {} as any,
    rotationSignal: false,
    action,
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
}

function createMockSignal(symbol: string, confidence: number, type: string = 'buy_rotation'): Signal {
  return {
    id: `sig-${symbol}`,
    symbol,
    direction: 'buy',
    type,
    strategy: 'test_strategy',
    confidence,
    rationale: 'test',
    snapshot: {},
    createdAt: Date.now(),
  }
}

function createMockRotationSignal(sectorId: string, triggered: boolean = true, strength: 'weak' | 'medium' | 'strong' = 'strong'): RotationSignal {
  return {
    sectorId,
    triggered,
    conditions: { volumeBreakthrough: true, capitalInflow: true, goldenCross: true },
    strength,
    detectedAt: Date.now(),
  }
}

function mockQueryByStore(
  stocks: Stock[] = [],
  hotScores: HotSectorScore[] = [],
  valueScores: ValuePitScore[] = [],
  signals: Signal[] = [],
) {
  mockDataBridgeQuery.mockImplementation((req: { store: string }) => {
    switch (req.store) {
      case 'stocks':
        return Promise.resolve({ success: true, data: stocks })
      case 'hotSectorScores':
        return Promise.resolve({ success: true, data: hotScores })
      case 'valuePitScores':
        return Promise.resolve({ success: true, data: valueScores })
      case 'signals':
        return Promise.resolve({ success: true, data: signals })
      default:
        return Promise.resolve({ success: true, data: [] })
    }
  })
}

function resetStoreState() {
  useDualStrategyStore.setState({
    hotSectorScores: [],
    valuePitScores: [],
    rotationSignals: [],
    loading: false,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0

  // 清理模块级订阅状态
  const cleanup = initDualStrategyStoreSubscriptions()
  cleanup()

  resetStoreState()

  // 重置 hoisted mock 默认行为
  mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
  mockDataBridgeForward.mockResolvedValue({ success: true })
})

// ============================================================
// useDualStrategyStore
// ============================================================

describe('useDualStrategyStore', () => {
  it('初始状态验证', () => {
    const state = useDualStrategyStore.getState()
    expect(state.hotSectorScores).toEqual([])
    expect(state.valuePitScores).toEqual([])
    expect(state.rotationSignals).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(0)
  })

  // ----------------------------------------------------------
  // fetchScores
  // ----------------------------------------------------------

  it('fetchScores: 传入 stocks，调用 runDualStrategy，更新 3 个 scores', async () => {
    const stocks = [createMockStock('A'), createMockStock('B')]
    const hotScores = [createMockHotSectorScore('A', 4.5), createMockHotSectorScore('B', 3.8)]
    const valueScores = [createMockValuePitScore('A', 3.5), createMockValuePitScore('B', 4.0)]
    const signals = [createMockSignal('A', 0.8, 'buy_rotation'), createMockSignal('B', 0.5, 'momentum')]

    mockRunDualStrategy.mockResolvedValue({
      success: true,
      data: { hotSectorScores: hotScores, valuePitScores: valueScores, signals },
    })

    await useDualStrategyStore.getState().fetchScores(stocks)

    const state = useDualStrategyStore.getState()
    expect(mockRunDualStrategy).toHaveBeenCalledWith(stocks, { persistScores: false })
    expect(state.hotSectorScores).toHaveLength(2)
    expect(state.valuePitScores).toHaveLength(2)
    expect(state.rotationSignals).toHaveLength(1)
    expect(state.rotationSignals[0]!.sectorId).toBe('A')
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  it('fetchScores: 无传入 stocks，从 DataBridge.query 获取', async () => {
    // 注意：不再从 poolStore 获取，统一从 DataBridge.query(stocks) 获取
    const dlStocks = [createMockStock('DL1')]
    mockQueryByStore(dlStocks)

    const hotScores = [createMockHotSectorScore('DL1', 4.0)]
    const valueScores = [createMockValuePitScore('DL1', 3.5)]
    const signals: Signal[] = []

    mockRunDualStrategy.mockResolvedValue({
      success: true,
      data: { hotSectorScores: hotScores, valuePitScores: valueScores, signals },
    })

    await useDualStrategyStore.getState().fetchScores()

    // 现在统一从 DataBridge.query 获取，不再依赖 poolStore
    expect(mockDataBridgeQuery).toHaveBeenCalledWith(expect.objectContaining({ store: 'stocks', action: 'QUERY_LIST' }))
    expect(mockRunDualStrategy).toHaveBeenCalledWith(dlStocks, { persistScores: false })
    expect(useDualStrategyStore.getState().hotSectorScores).toHaveLength(1)
  })

  it('fetchScores: 股票池为空，返回空结果（不 fallback 到 Mock 数据）', async () => {
    mockQueryByStore([])

    await useDualStrategyStore.getState().fetchScores()

    expect(mockRunDualStrategy).not.toHaveBeenCalled()
    expect(mockHotSectorAnalyze).not.toHaveBeenCalled()
    expect(mockValuePitAnalyze).not.toHaveBeenCalled()
    expect(mockRotationDetect).not.toHaveBeenCalled()
    expect(useDualStrategyStore.getState().hotSectorScores).toHaveLength(0)
    expect(useDualStrategyStore.getState().valuePitScores).toHaveLength(0)
    expect(useDualStrategyStore.getState().rotationSignals).toHaveLength(0)
  })

  it('fetchScores: 并发锁（isRefreshing=true 跳过）', async () => {
    useDualStrategyStore.setState({ isRefreshing: true })

    await useDualStrategyStore.getState().fetchScores([createMockStock('A')])

    expect(mockRunDualStrategy).not.toHaveBeenCalled()
    expect(mockHotSectorAnalyze).not.toHaveBeenCalled()
  })

  it('fetchScores: runDualStrategy 失败，快照回滚', async () => {
    const existingHot = [createMockHotSectorScore('EXIST', 5.0)]
    const existingValue = [createMockValuePitScore('EXIST', 4.0)]
    const existingRot = [createMockRotationSignal('EXIST')]

    useDualStrategyStore.setState({
      hotSectorScores: existingHot,
      valuePitScores: existingValue,
      rotationSignals: existingRot,
      lastUpdated: 12345,
    })

    mockRunDualStrategy.mockResolvedValue({ success: false, error: '引擎故障' })

    await useDualStrategyStore.getState().fetchScores([createMockStock('A')])

    const state = useDualStrategyStore.getState()
    expect(state.error).toBe('引擎故障')
    expect(state.hotSectorScores).toEqual(existingHot)
    expect(state.valuePitScores).toEqual(existingValue)
    expect(state.rotationSignals).toEqual(existingRot)
    expect(state.lastUpdated).toBe(12345)
    expect(state.loading).toBe(false)
    expect(state.isRefreshing).toBe(false)
  })

  it('fetchScores: 持久化到 DataBridge（调用 save）', async () => {
    const stocks = [createMockStock('A')]
    const hotScores = [createMockHotSectorScore('A', 4.5)]
    const valueScores = [createMockValuePitScore('A', 3.5)]
    const signals = [createMockSignal('A', 0.8, 'buy_rotation')]

    mockRunDualStrategy.mockResolvedValue({
      success: true,
      data: { hotSectorScores: hotScores, valuePitScores: valueScores, signals },
    })

    await useDualStrategyStore.getState().fetchScores(stocks)

    expect(mockDataBridgeForward).toHaveBeenCalledTimes(3)
    const forwardedPayloads = mockDataBridgeForward.mock.calls.map((c) => (c[0] as { payload: unknown }).payload)
    expect(forwardedPayloads).toContain(hotScores[0])
    expect(forwardedPayloads).toContain(valueScores[0])
    expect(forwardedPayloads).toContain(signals[0])
  })

  it('fetchScores: scores 按 score 降序排序', async () => {
    const stocks = [createMockStock('A'), createMockStock('B'), createMockStock('C')]
    const hotScores = [
      createMockHotSectorScore('A', 3.0),
      createMockHotSectorScore('B', 5.0),
      createMockHotSectorScore('C', 4.0),
    ]
    const valueScores = [
      createMockValuePitScore('A', 2.0),
      createMockValuePitScore('B', 4.5),
      createMockValuePitScore('C', 3.5),
    ]
    const signals: Signal[] = []

    mockRunDualStrategy.mockResolvedValue({
      success: true,
      data: { hotSectorScores: hotScores, valuePitScores: valueScores, signals },
    })

    await useDualStrategyStore.getState().fetchScores(stocks)

    const state = useDualStrategyStore.getState()
    expect(state.hotSectorScores[0]!.score).toBe(5.0)
    expect(state.hotSectorScores[1]!.score).toBe(4.0)
    expect(state.hotSectorScores[2]!.score).toBe(3.0)
    expect(state.valuePitScores[0]!.score).toBe(4.5)
    expect(state.valuePitScores[1]!.score).toBe(3.5)
    expect(state.valuePitScores[2]!.score).toBe(2.0)
  })

  /** @test_id V9-TEST-ST-134-FETCH-DB-FAIL */
  it('fetchScores: DataBridge.query 股票池失败时抛出错误并快照回滚', async () => {
    const existingHot = [createMockHotSectorScore('EXIST', 5.0)]
    useDualStrategyStore.setState({
      hotSectorScores: existingHot,
      lastUpdated: 99999,
    })

    mockDataBridgeQuery.mockResolvedValue({ success: false, error: 'DB连接失败' })

    await useDualStrategyStore.getState().fetchScores()

    const state = useDualStrategyStore.getState()
    expect(state.error).toBe('DB连接失败')
    expect(state.hotSectorScores).toEqual(existingHot) // 快照回滚
    expect(state.isRefreshing).toBe(false)
    expect(mockRunDualStrategy).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-134-FETCH-DB-NULL */
  it('fetchScores: DataBridge.query 返回 data=null 时按空数组处理', async () => {
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: null })

    await useDualStrategyStore.getState().fetchScores()

    // data=null → inputStocks=[] → 不调用 runDualStrategy → 返回空结果
    expect(mockRunDualStrategy).not.toHaveBeenCalled()
    expect(useDualStrategyStore.getState().hotSectorScores).toHaveLength(0)
  })

  // ----------------------------------------------------------
  // refresh
  // ----------------------------------------------------------

  it('refresh: 从 DataBridge 读取 3 个列表', async () => {
    const hotScores = [createMockHotSectorScore('A', 4.0)]
    const valueScores = [createMockValuePitScore('B', 3.5)]
    const allSignals = [createMockSignal('C', 0.6, 'buy_rotation')]

    mockQueryByStore([], hotScores, valueScores, allSignals)

    await useDualStrategyStore.getState().refresh()

    expect(mockDataBridgeQuery).toHaveBeenCalledWith(expect.objectContaining({ store: 'hotSectorScores', action: 'QUERY_LIST' }))
    expect(mockDataBridgeQuery).toHaveBeenCalledWith(expect.objectContaining({ store: 'valuePitScores', action: 'QUERY_LIST' }))
    expect(mockDataBridgeQuery).toHaveBeenCalledWith(expect.objectContaining({ store: 'signals', action: 'QUERY_LIST' }))
    expect(useDualStrategyStore.getState().hotSectorScores).toEqual(hotScores)
    expect(useDualStrategyStore.getState().valuePitScores).toEqual(valueScores)
  })

  it('refresh: 过滤 rotationSignals（type=buy_rotation）', async () => {
    const allSignals = [
      createMockSignal('ROT1', 0.8, 'buy_rotation'),
      createMockSignal('OTHER', 0.5, 'momentum'),
      createMockSignal('ROT2', 0.6, 'buy_rotation'),
    ]

    mockQueryByStore([], [], [], allSignals)

    await useDualStrategyStore.getState().refresh()

    const rotSignals = useDualStrategyStore.getState().rotationSignals
    expect(rotSignals).toHaveLength(2)
    expect(rotSignals.some((r) => r.sectorId === 'ROT1')).toBe(true)
    expect(rotSignals.some((r) => r.sectorId === 'ROT2')).toBe(true)
    expect(rotSignals.some((r) => r.sectorId === 'OTHER')).toBe(false)
  })

  it('refresh: 并发锁', async () => {
    useDualStrategyStore.setState({ isRefreshing: true })

    await useDualStrategyStore.getState().refresh()

    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
  })

  it('refresh: 失败设置 error', async () => {
    mockDataBridgeQuery.mockRejectedValue(new Error('db error'))

    await useDualStrategyStore.getState().refresh()

    const state = useDualStrategyStore.getState()
    expect(state.error).toBe('db error')
    expect(state.loading).toBe(false)
    expect(state.isRefreshing).toBe(false)
  })

  /** @test_id V9-TEST-ST-134-REFRESH-SUCCESS-FALSE */
  it('refresh: 某个 query success=false 时抛出错误并设置 error', async () => {
    mockDataBridgeQuery.mockImplementation((req: { store: string }) => {
      if (req.store === 'hotSectorScores') {
        return Promise.resolve({ success: false, error: 'hot查询失败' })
      }
      return Promise.resolve({ success: true, data: [] })
    })

    await useDualStrategyStore.getState().refresh()

    expect(useDualStrategyStore.getState().error).toBe('hot查询失败')
    expect(useDualStrategyStore.getState().isRefreshing).toBe(false)
  })

  /** @test_id V9-TEST-ST-134-REFRESH-NON-ERROR */
  it('refresh: 非 Error 类型异常时设置 error', async () => {
    mockDataBridgeQuery.mockRejectedValue('网络超时')

    await useDualStrategyStore.getState().refresh()

    expect(useDualStrategyStore.getState().error).toBe('网络超时')
    expect(useDualStrategyStore.getState().isRefreshing).toBe(false)
  })

  // ----------------------------------------------------------
  // clearScores
  // ----------------------------------------------------------

  it('clearScores: 重置所有状态', () => {
    useDualStrategyStore.setState({
      hotSectorScores: [createMockHotSectorScore('A', 4.0)],
      valuePitScores: [createMockValuePitScore('B', 3.5)],
      rotationSignals: [createMockRotationSignal('C')],
      loading: true,
      error: 'some error',
      isRefreshing: true,
      lastUpdated: 12345,
    })

    useDualStrategyStore.getState().clearScores()

    const state = useDualStrategyStore.getState()
    expect(state.hotSectorScores).toEqual([])
    expect(state.valuePitScores).toEqual([])
    expect(state.rotationSignals).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(0)
  })
})

// ============================================================
// 派生函数
// ============================================================

describe('派生函数', () => {
  beforeEach(() => {
    resetStoreState()
  })

  it('topHotSectors: 取前 N 个（默认 5）', () => {
    const scores = Array.from({ length: 10 }, (_, i) => createMockHotSectorScore(`H${i}`, 10 - i))
    useDualStrategyStore.setState({ hotSectorScores: scores })

    const result = topHotSectors()
    expect(result).toHaveLength(5)
    expect(result[0]!.symbol).toBe('H0')
    expect(result[4]!.symbol).toBe('H4')

    const result3 = topHotSectors(3)
    expect(result3).toHaveLength(3)
  })

  it('topValuePits: 取前 N 个', () => {
    const scores = Array.from({ length: 8 }, (_, i) => createMockValuePitScore(`V${i}`, 8 - i))
    useDualStrategyStore.setState({ valuePitScores: scores })

    const result = topValuePits()
    expect(result).toHaveLength(5)
    expect(result[0]!.symbol).toBe('V0')

    const result7 = topValuePits(7)
    expect(result7).toHaveLength(7)
  })

  it('activeRotationSignals: 过滤 triggered=true', () => {
    const signals = [
      createMockRotationSignal('A', true),
      createMockRotationSignal('B', false),
      createMockRotationSignal('C', true),
    ]
    useDualStrategyStore.setState({ rotationSignals: signals })

    const result = activeRotationSignals()
    expect(result).toHaveLength(2)
    expect(result.some((r) => r.sectorId === 'A')).toBe(true)
    expect(result.some((r) => r.sectorId === 'C')).toBe(true)
    expect(result.some((r) => r.sectorId === 'B')).toBe(false)
  })

  it('hotSectorBuySignals: 过滤 action=immediate', () => {
    const scores = [
      createMockHotSectorScore('A', 4.5, 'immediate'),
      createMockHotSectorScore('B', 3.5, 'probe'),
      createMockHotSectorScore('C', 4.0, 'immediate'),
      createMockHotSectorScore('D', 3.0, 'ignore'),
    ]
    useDualStrategyStore.setState({ hotSectorScores: scores })

    const result = hotSectorBuySignals()
    expect(result).toHaveLength(2)
    expect(result.some((r) => r.symbol === 'A')).toBe(true)
    expect(result.some((r) => r.symbol === 'C')).toBe(true)
  })

  it('valuePitBuildCandidates: 过滤 action=immediate', () => {
    const scores = [
      createMockValuePitScore('A', 4.5, 'immediate'),
      createMockValuePitScore('B', 3.5, 'wait'),
      createMockValuePitScore('C', 4.0, 'immediate'),
      createMockValuePitScore('D', 3.0, 'ignore'),
    ]
    useDualStrategyStore.setState({ valuePitScores: scores })

    const result = valuePitBuildCandidates()
    expect(result).toHaveLength(2)
    expect(result.some((r) => r.symbol === 'A')).toBe(true)
    expect(result.some((r) => r.symbol === 'C')).toBe(true)
  })

  it('valuePitWaitSignals: 过滤 action=wait', () => {
    const scores = [
      createMockValuePitScore('A', 4.5, 'immediate'),
      createMockValuePitScore('B', 3.5, 'wait'),
      createMockValuePitScore('C', 4.0, 'wait'),
      createMockValuePitScore('D', 3.0, 'ignore'),
    ]
    useDualStrategyStore.setState({ valuePitScores: scores })

    const result = valuePitWaitSignals()
    expect(result).toHaveLength(2)
    expect(result.some((r) => r.symbol === 'B')).toBe(true)
    expect(result.some((r) => r.symbol === 'C')).toBe(true)
  })

  it('hotSectorBySymbol: 存在/不存在', () => {
    const scores = [createMockHotSectorScore('A', 4.5), createMockHotSectorScore('B', 3.5)]
    useDualStrategyStore.setState({ hotSectorScores: scores })

    expect(hotSectorBySymbol('A')).toBeDefined()
    expect(hotSectorBySymbol('A')?.score).toBe(4.5)
    expect(hotSectorBySymbol('NOT_EXIST')).toBeUndefined()
  })

  it('valuePitBySymbol: 存在/不存在', () => {
    const scores = [createMockValuePitScore('A', 4.5), createMockValuePitScore('B', 3.5)]
    useDualStrategyStore.setState({ valuePitScores: scores })

    expect(valuePitBySymbol('A')).toBeDefined()
    expect(valuePitBySymbol('A')?.score).toBe(4.5)
    expect(valuePitBySymbol('NOT_EXIST')).toBeUndefined()
  })

  it('rotationSignalBySector: 存在/不存在', () => {
    const signals = [createMockRotationSignal('A'), createMockRotationSignal('B')]
    useDualStrategyStore.setState({ rotationSignals: signals })

    expect(rotationSignalBySector('A')).toBeDefined()
    expect(rotationSignalBySector('NOT_EXIST')).toBeUndefined()
  })
})

// ============================================================
// 辅助函数
// ============================================================

describe('辅助函数', () => {
  it('signalToRotationSignal: confidence>=0.7→strong, >=0.4→medium, 否则 weak', () => {
    const signalStrong = createMockSignal('A', 0.9)
    const signalMedium = createMockSignal('B', 0.5)
    const signalWeak = createMockSignal('C', 0.3)

    const rotStrong = signalToRotationSignal(signalStrong)
    expect(rotStrong.strength).toBe('strong')
    expect(rotStrong.sectorId).toBe('A')
    expect(rotStrong.triggered).toBe(true)

    const rotMedium = signalToRotationSignal(signalMedium)
    expect(rotMedium.strength).toBe('medium')

    const rotWeak = signalToRotationSignal(signalWeak)
    expect(rotWeak.strength).toBe('weak')
  })

  it('rotationSignalToSignal: strong→0.8, medium→0.6, weak→0.4', () => {
    const rotStrong = createMockRotationSignal('A', true, 'strong')
    const rotMedium = createMockRotationSignal('B', true, 'medium')
    const rotWeak = createMockRotationSignal('C', true, 'weak')

    const sigStrong = rotationSignalToSignal(rotStrong)
    expect(sigStrong.confidence).toBe(0.8)
    expect(sigStrong.symbol).toBe('A')
    expect(sigStrong.type).toBe('buy_rotation')
    expect(sigStrong.direction).toBe('buy')

    const sigMedium = rotationSignalToSignal(rotMedium)
    expect(sigMedium.confidence).toBe(0.6)

    const sigWeak = rotationSignalToSignal(rotWeak)
    expect(sigWeak.confidence).toBe(0.4)
  })

  it('shouldSkipSelf: analyzer/tradinghub/strategy → true, 其他 → false', () => {
    expect(shouldSkipSelf({ meta: { source: 'analyzer', action: 'SAVE' } })).toBe(true)
    expect(shouldSkipSelf({ meta: { source: 'tradinghub', action: 'SAVE' } })).toBe(true)
    expect(shouldSkipSelf({ meta: { source: 'strategy', action: 'SAVE' } })).toBe(true)
    expect(shouldSkipSelf({ meta: { source: 'pool', action: 'SAVE' } })).toBe(false)
    expect(shouldSkipSelf({ meta: { source: 'external', action: 'SAVE' } })).toBe(false)
  })

  it('getSnapshot: 正确提取状态快照', () => {
    const state = {
      hotSectorScores: [createMockHotSectorScore('A', 4.0)],
      valuePitScores: [createMockValuePitScore('B', 3.5)],
      rotationSignals: [createMockRotationSignal('C')],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 12345,
      fetchScores: vi.fn() as any,
      refresh: vi.fn() as any,
      clearScores: vi.fn() as any,
    }

    const snapshot = getSnapshot(state)
    expect(snapshot.hotSectorScores).toEqual(state.hotSectorScores)
    expect(snapshot.valuePitScores).toEqual(state.valuePitScores)
    expect(snapshot.rotationSignals).toEqual(state.rotationSignals)
    expect(snapshot.lastUpdated).toBe(12345)
  })
})

// ============================================================
// initDualStrategyStoreSubscriptions
// ============================================================

describe('initDualStrategyStoreSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallbacks.clear()
    unsubscribes.length = 0
    _resetDualStrategyStoreSubscriptionsForTest()
  })

  it('订阅 5 个频道', () => {
    initDualStrategyStoreSubscriptions()

    expect(mockSubscribe).toHaveBeenCalledTimes(5)
    expect(mockSubscribe).toHaveBeenCalledWith('hotSectorScores', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('valuePitScores', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('rotationScores', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('signals', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('stocks', expect.any(Function))
  })

  it('source 过滤（shouldSkipSelf）', async () => {
    mockQueryByStore()

    initDualStrategyStoreSubscriptions()
    const hotCb = capturedCallbacks.get('hotSectorScores')
    expect(hotCb).toBeDefined()

    // 被过滤的 source 不应触发 refresh
    hotCb!({
      meta: { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()

    // 合法的 source 应该触发 refresh
    hotCb!({
      meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).toHaveBeenCalled()
  })

  // ============================================================
  // 所有频道回调均可正常处理事件（未覆盖行 617, 624, 631）
  // ============================================================

  /** @test_id V9-TEST-ST-134-ALL-CHANNELS */
  it('valuePitScores / rotationScores / signals 频道回调均可正常处理事件', async () => {
    mockQueryByStore()

    initDualStrategyStoreSubscriptions()

    const envelope = {
      meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't-all', timestamp: Date.now() },
      payload: {},
    }

    // 触发各频道回调（source 非 analyzer，应调用 debouncedRefresh）
    const valueCb = capturedCallbacks.get('valuePitScores')!
    const rotationCb = capturedCallbacks.get('rotationScores')!
    const signalsCb = capturedCallbacks.get('signals')!

    valueCb(envelope)
    rotationCb(envelope)
    signalsCb(envelope)

    // 等待 debounce + refresh
    await new Promise((r) => setTimeout(r, 500))
    // 应触发了 refresh（3 个 query 调用）
    expect(mockDataBridgeQuery).toHaveBeenCalled()
  })

  it('去抖 300ms', async () => {
    mockQueryByStore()

    initDualStrategyStoreSubscriptions()
    const hotCb = capturedCallbacks.get('hotSectorScores')!

    // 连续触发多次
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() }, payload: {} })
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() }, payload: {} })
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't3', timestamp: Date.now() }, payload: {} })

    // 100ms 内不应触发
    await new Promise((r) => setTimeout(r, 100))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()

    // 400ms 后应只触发一次（防抖合并）
    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(3) // refresh 内部 3 个 query
  })

  it('重复调用不重复订阅', () => {
    initDualStrategyStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5)

    // 第二次调用应该跳过
    initDualStrategyStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5)
  })

  it('返回 cleanup', () => {
    const cleanup = initDualStrategyStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    cleanup()

    // cleanup 后再次初始化应该能重新订阅
    const cleanup2 = initDualStrategyStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(10) // 2 次初始化 × 5 个频道
    expect(typeof cleanup2).toBe('function')

    cleanup2()
  })

  it('cleanup 清除所有订阅和定时器', async () => {
    mockQueryByStore()

    const cleanup = initDualStrategyStoreSubscriptions()
    const hotCb = capturedCallbacks.get('hotSectorScores')!

    // 触发一个事件，启动去抖定时器
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() }, payload: {} })

    // 立刻 cleanup
    cleanup()

    // 等待超过去抖时间，验证没有触发 refresh
    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()

    // 验证所有 unsubscribe 被调用
    expect(unsubscribes.length).toBe(5)
    unsubscribes.forEach((unsub) => {
      expect(unsub).toHaveBeenCalled()
    })
  })

  // ============================================================
  // stocks 频道 source 过滤
  // 未覆盖行 638-644
  // ============================================================

  /** @test_id V9-TEST-ST-134-STOCKS-POOL-FILTER */
  it('stocks 频道事件 source=pool 时应被过滤，不触发 refresh', async () => {
    mockQueryByStore()

    initDualStrategyStoreSubscriptions()
    const stocksCb = capturedCallbacks.get('stocks')
    expect(stocksCb).toBeDefined()

    // pool source 应被过滤
    stocksCb!({
      meta: { source: 'pool', target: 'db', action: 'INSERT_STOCK', traceId: 't-pool', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 400))

    // 不应触发 refresh
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-134-STOCKS-NON-POOL */
  it('stocks 频道事件 source 非 pool 时应触发 refresh', async () => {
    mockQueryByStore()

    initDualStrategyStoreSubscriptions()
    const stocksCb = capturedCallbacks.get('stocks')
    expect(stocksCb).toBeDefined()

    // 非 pool source 应触发 debouncedRefresh
    stocksCb!({
      meta: { source: 'system', target: 'db', action: 'INSERT_STOCK', traceId: 't-sys', timestamp: Date.now() },
      payload: {},
    })

    await new Promise((r) => setTimeout(r, 400))

    // 应触发 refresh（3 个 query）
    expect(mockDataBridgeQuery).toHaveBeenCalled()
  })

  // ============================================================
  // destroyDualStrategyStoreSubscriptions - globalSubscriptionsInitialized
  // 未覆盖行 651-652
  // ============================================================

  /** @test_id V9-TEST-ST-134-DESTROY-GUARD */
  it('全局订阅初始化后 destroyDualStrategyStoreSubscriptions 应跳过（通过 _reset 间接调用）', () => {
    _resetDualStrategyStoreSubscriptionsForTest()
    capturedCallbacks.clear()
    unsubscribes.length = 0
    mockSubscribe.mockClear()

    // 初始化全局订阅
    initDualStrategyStoreGlobalSubscriptions()

    expect(mockSubscribe).toHaveBeenCalledTimes(5)
    const globalUnsubs = [...unsubscribes]

    // 调用 _reset（内部会调用 destroy，global=true 时 destroy 应跳过）
    _resetDualStrategyStoreSubscriptionsForTest()

    // destroy 在 global=true 时应跳过，不调用 unsubscribe
    globalUnsubs.forEach((unsub) => {
      expect(unsub).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 全局订阅已初始化时组件级 init 返回 no-op（未覆盖行 541-546）
  // ============================================================

  /** @test_id V9-TEST-ST-134-GLOBAL-NOOP */
  it('全局订阅已初始化时 initDualStrategyStoreSubscriptions 返回 no-op cleanup', () => {
    _resetDualStrategyStoreSubscriptionsForTest()
    capturedCallbacks.clear()
    unsubscribes.length = 0
    mockSubscribe.mockClear()

    // 先初始化全局订阅
    initDualStrategyStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5)

    // 组件级 init 应返回 no-op cleanup，不增加订阅
    const cleanup = initDualStrategyStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5) // 不增加
    expect(typeof cleanup).toBe('function')

    // cleanup 是 no-op，不应销毁全局订阅
    cleanup()
    // 全局订阅仍应存在（通过再次调用 global init 验证不会重复订阅）
    initDualStrategyStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5)
  })

  // ============================================================
  // initDualStrategyStoreGlobalSubscriptions 重复调用（未覆盖行 564-567）
  // ============================================================

  /** @test_id V9-TEST-ST-134-GLOBAL-DUP */
  it('initDualStrategyStoreGlobalSubscriptions: 重复调用跳过', () => {
    _resetDualStrategyStoreSubscriptionsForTest()
    capturedCallbacks.clear()
    unsubscribes.length = 0
    mockSubscribe.mockClear()

    initDualStrategyStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5)

    initDualStrategyStoreGlobalSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(5) // 不增加
  })

  // ============================================================
  // debouncedRefresh: 最小刷新间隔内事件被跳过（未覆盖行 494-497）
  // ============================================================

  /** @test_id V9-TEST-ST-134-DEBOUNCE-MIN-INTERVAL */
  it('debouncedRefresh: 最小刷新间隔内的事件被跳过', async () => {
    mockQueryByStore()
    _resetDualStrategyStoreSubscriptionsForTest()
    capturedCallbacks.clear()
    unsubscribes.length = 0
    mockSubscribe.mockClear()
    mockDataBridgeQuery.mockClear()

    initDualStrategyStoreSubscriptions()
    const hotCb = capturedCallbacks.get('hotSectorScores')!

    // 第一次事件 → 触发 refresh（首次数据事件跳过最小间隔检查）
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() }, payload: {} })
    await new Promise((r) => setTimeout(r, 500)) // 等待 debounce (300ms) + refresh

    const queryCountAfterFirst = mockDataBridgeQuery.mock.calls.length
    expect(queryCountAfterFirst).toBe(3) // hot, value, signals

    // 第二次事件在最小间隔内（<2000ms）→ 应被跳过
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() }, payload: {} })
    await new Promise((r) => setTimeout(r, 500)) // 等待 debounce

    // 不应增加 query 调用
    expect(mockDataBridgeQuery.mock.calls.length).toBe(queryCountAfterFirst)
  })

  // ============================================================
  // debouncedRefresh: refresh 进行中时新事件标记 _pendingRefresh 排队
  // 未覆盖行 511-513, 374（成功后触发排队刷新）
  // 使用 fake timers 精确控制 debounce 和最小刷新间隔
  // ============================================================

  /** @test_id V9-TEST-ST-134-DEBOUNCE-PENDING */
  it('debouncedRefresh: refresh 进行中时新事件标记 _pendingRefresh，成功后触发排队刷新', async () => {
    vi.useFakeTimers()
    try {
      _resetDualStrategyStoreSubscriptionsForTest()
      capturedCallbacks.clear()
      unsubscribes.length = 0
      mockSubscribe.mockClear()
      mockDataBridgeQuery.mockClear()

      // 使用共享 pending promise 延迟所有 query，使 refresh 保持 isRefreshing=true
      let resolveAllQueries!: (value: any) => void
      const queryPromise = new Promise((resolve) => { resolveAllQueries = resolve })
      mockDataBridgeQuery.mockImplementation(() => queryPromise)

      initDualStrategyStoreSubscriptions()
      const hotCb = capturedCallbacks.get('hotSectorScores')!

      // 第一次事件 → debounce 300ms → refresh 开始（query 被延迟）
      hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() }, payload: {} })
      await vi.advanceTimersByTimeAsync(300) // 触发 debounce 回调

      // isRefreshing 应为 true（refresh 正在等待延迟的 query）
      expect(useDualStrategyStore.getState().isRefreshing).toBe(true)

      // 推进 2000ms 超过最小刷新间隔
      await vi.advanceTimersByTimeAsync(2000)

      // 第二次事件 → debounce 300ms → isRefreshing=true → 标记 _pendingRefresh（行 511-513）
      hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() }, payload: {} })
      await vi.advanceTimersByTimeAsync(300) // 触发第二次 debounce 回调

      // 完成第一个 query → refresh 完成 → _pendingRefresh=true → 调用 debouncedRefresh（行 374）
      resolveAllQueries({ success: true, data: [] })
      await vi.advanceTimersByTimeAsync(0) // 刷新微任务

      // refresh 应已完成
      expect(useDualStrategyStore.getState().isRefreshing).toBe(false)
    } finally {
      _resetDualStrategyStoreSubscriptionsForTest()
      vi.useRealTimers()
    }
  })

  // ============================================================
  // debouncedRefresh: refresh 失败时清除 _pendingRefresh 标记
  // 未覆盖行 383（失败时清除排队标记）
  // ============================================================

  /** @test_id V9-TEST-ST-134-DEBOUNCE-PENDING-FAIL */
  it('debouncedRefresh: refresh 失败时清除 _pendingRefresh 标记', async () => {
    vi.useFakeTimers()
    try {
      _resetDualStrategyStoreSubscriptionsForTest()
      capturedCallbacks.clear()
      unsubscribes.length = 0
      mockSubscribe.mockClear()
      mockDataBridgeQuery.mockClear()

      // 使用共享 pending promise 延迟所有 query，后续 reject 使 refresh 失败
      let rejectAllQueries!: (reason: any) => void
      const queryPromise = new Promise((_, reject) => { rejectAllQueries = reject })
      mockDataBridgeQuery.mockImplementation(() => queryPromise)

      initDualStrategyStoreSubscriptions()
      const hotCb = capturedCallbacks.get('hotSectorScores')!

      // 第一次事件 → debounce 300ms → refresh 开始（query 被延迟）
      hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() }, payload: {} })
      await vi.advanceTimersByTimeAsync(300) // 触发 debounce 回调

      expect(useDualStrategyStore.getState().isRefreshing).toBe(true)

      // 推进 2000ms 超过最小刷新间隔
      await vi.advanceTimersByTimeAsync(2000)

      // 第二次事件 → debounce 300ms → isRefreshing=true → 标记 _pendingRefresh（行 511-513）
      hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't2', timestamp: Date.now() }, payload: {} })
      await vi.advanceTimersByTimeAsync(300) // 触发第二次 debounce 回调

      // reject query → refresh 失败 → catch 块清除 _pendingRefresh（行 383）
      rejectAllQueries(new Error('刷新失败'))
      await vi.advanceTimersByTimeAsync(0) // 刷新微任务

      // refresh 应已失败
      const state = useDualStrategyStore.getState()
      expect(state.isRefreshing).toBe(false)
      expect(state.error).toBe('刷新失败')
    } finally {
      _resetDualStrategyStoreSubscriptionsForTest()
      vi.useRealTimers()
    }
  })

  // ============================================================
  // _resetDualStrategyStoreSubscriptionsForTest: 清除活跃 debounce timer
  // 未覆盖行 579-580
  // ============================================================

  /** @test_id V9-TEST-ST-134-RESET-TIMER */
  it('_resetDualStrategyStoreSubscriptionsForTest: 有活跃 debounce timer 时清除', async () => {
    mockQueryByStore()
    _resetDualStrategyStoreSubscriptionsForTest()
    capturedCallbacks.clear()
    unsubscribes.length = 0
    mockSubscribe.mockClear()
    mockDataBridgeQuery.mockClear()

    initDualStrategyStoreSubscriptions()
    const hotCb = capturedCallbacks.get('hotSectorScores')!

    // 触发事件，设置 debounce timer（但不等待其触发）
    hotCb({ meta: { source: 'system', target: 'db', action: 'SAVE_SCORES', traceId: 't1', timestamp: Date.now() }, payload: {} })

    // 立即调用 _reset，应清除 debounce timer
    _resetDualStrategyStoreSubscriptionsForTest()

    // 等待 debounce 周期，确认 refresh 未被触发（timer 已被清除）
    await new Promise((r) => setTimeout(r, 500))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
  })
})
