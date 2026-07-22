/**
 * @test_id V9-TEST-ST-158
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-BACK-003, V9-DOC-BACK-009]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Stock, V6Score, RotationSectorScore, StrategySnapshot } from '@/data/types'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockListStocks = vi.hoisted(() => vi.fn())
const mockGetAllV6Scores = vi.hoisted(() => vi.fn())
const mockListRotationScores = vi.hoisted(() => vi.fn())
const mockClassifyStocks = vi.hoisted(() => vi.fn())
const mockListSnapshots = vi.hoisted(() => vi.fn())
const mockSaveStrategySnapshot = vi.hoisted(() => vi.fn())

// DataBridge 订阅 mock
const mockDataBridgeSubscribe = vi.hoisted(() => vi.fn())
const mockDataBridgeUnsubscribe = vi.hoisted(() => vi.fn())

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockDataBridgeSubscribe },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: { saveStrategySnapshots: 'SAVE_STRATEGY_SNAPSHOTS' },
}))

vi.mock('@/services/pool/poolService', () => ({
  listPoolItems: mockListStocks,
}))

vi.mock('@/services/scoring/v6ScoreService', () => ({
  getAllV6Scores: mockGetAllV6Scores,
}))

vi.mock('@/services/analysis/rotationScoreService', () => ({
  listRotationScores: mockListRotationScores,
}))

vi.mock('@/services/trading/strategySnapshotService', () => ({
  classifyStocks: mockClassifyStocks,
  listSnapshots: mockListSnapshots,
  saveStrategySnapshot: mockSaveStrategySnapshot,
}))

// ============================================================
// Imports
// ============================================================

import { useStrategySnapshotStore } from './strategySnapshotStore'
import { initStrategySnapshotStoreSubscriptions, destroyStrategySnapshotStoreSubscriptions } from './strategySnapshotStore'

// ============================================================
// Helpers
// ============================================================

function createMockStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    ...overrides,
  } as Stock
}

function createMockV6Score(overrides: Partial<V6Score> = {}): V6Score {
  return {
    symbol: '600519.SH',
    score: 85,
    ...overrides,
  } as V6Score
}

function createMockRotationScore(overrides: Partial<RotationSectorScore> = {}): RotationSectorScore {
  return {
    sector: '白酒',
    score: 80,
    ...overrides,
  } as RotationSectorScore
}

function createMockGroupItem(overrides: Partial<StrategyGroupItem> = {}): StrategyGroupItem {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    composite: 85,
    classification: 'core',
    ...overrides,
  } as StrategyGroupItem
}

function createMockSnapshot(overrides: Partial<StrategySnapshot> = {}): StrategySnapshot {
  return {
    id: 'snap-1',
    version: 1,
    timestamp: Date.now(),
    date: '2024-01-01',
    time: '09:30',
    stockCount: 10,
    scoreCount: 10,
    rotationCount: 5,
    trigger: 'manual',
    core: { count: 3, avgComposite: 85, items: [] },
    hot: { count: 4, avgComposite: 75, items: [] },
    value: { count: 3, avgComposite: 65, items: [] },
    ...overrides,
  } as StrategySnapshot
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useStrategySnapshotStore.setState({
    activeTab: 'current',
    stocks: [],
    v6Scores: [],
    rotationScores: [],
    items: { core: [], hot: [], value: [] },
    snapshots: [],
    selectedSnapshot: null,
    loading: false,
    saving: false,
    error: null,
  })
})

// ============================================================
// useStrategySnapshotStore
// ============================================================

describe('useStrategySnapshotStore', () => {
  // ---------- 初始状态 ----------

  it('初始状态验证', () => {
    const state = useStrategySnapshotStore.getState()
    expect(state.activeTab).toBe('current')
    expect(state.stocks).toEqual([])
    expect(state.v6Scores).toEqual([])
    expect(state.rotationScores).toEqual([])
    expect(state.items).toEqual({ core: [], hot: [], value: [] })
    expect(state.snapshots).toEqual([])
    expect(state.selectedSnapshot).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.saving).toBe(false)
    expect(state.error).toBeNull()
  })

  // ---------- setActiveTab ----------

  it('setActiveTab: 切换到 history 标签页', () => {
    useStrategySnapshotStore.getState().setActiveTab('history')
    expect(useStrategySnapshotStore.getState().activeTab).toBe('history')
  })

  it('setActiveTab: 切换标签页时清除 error', () => {
    useStrategySnapshotStore.setState({ error: '之前的错误' })
    useStrategySnapshotStore.getState().setActiveTab('history')
    expect(useStrategySnapshotStore.getState().error).toBeNull()
  })

  // ---------- loadCurrentStrategy ----------

  it('loadCurrentStrategy: 成功加载当前策略数据', async () => {
    const stocks = [createMockStock()]
    const v6Scores = [createMockV6Score()]
    const rotationScores = [createMockRotationScore()]
    const classified = [createMockGroupItem()]

    mockListStocks.mockResolvedValue({ success: true, data: stocks })
    mockGetAllV6Scores.mockResolvedValue({ success: true, data: v6Scores })
    mockListRotationScores.mockResolvedValue({ success: true, data: rotationScores })
    mockClassifyStocks.mockReturnValue(classified)

    await useStrategySnapshotStore.getState().loadCurrentStrategy()

    const state = useStrategySnapshotStore.getState()
    expect(state.stocks).toEqual(stocks)
    expect(state.v6Scores).toEqual(v6Scores)
    expect(state.rotationScores).toEqual(rotationScores)
    expect(state.items.core).toHaveLength(1)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadCurrentStrategy: 股票服务失败应设置 error', async () => {
    mockListStocks.mockResolvedValue({ success: false, error: '股票列表加载失败' })
    mockGetAllV6Scores.mockResolvedValue({ success: true, data: [] })
    mockListRotationScores.mockResolvedValue({ success: true, data: [] })

    await useStrategySnapshotStore.getState().loadCurrentStrategy()

    const state = useStrategySnapshotStore.getState()
    expect(state.error).toBe('股票列表加载失败')
    expect(state.loading).toBe(false)
  })

  it('loadCurrentStrategy: 异常应设置 error', async () => {
    mockListStocks.mockRejectedValue(new Error('Network error'))
    mockGetAllV6Scores.mockResolvedValue({ success: true, data: [] })
    mockListRotationScores.mockResolvedValue({ success: true, data: [] })

    await useStrategySnapshotStore.getState().loadCurrentStrategy()

    const state = useStrategySnapshotStore.getState()
    expect(state.error).toBe('Network error')
    expect(state.loading).toBe(false)
  })

  // ---------- loadHistorySnapshots ----------

  it('loadHistorySnapshots: 成功加载历史快照', async () => {
    useStrategySnapshotStore.setState({ activeTab: 'history' })
    const snapshots = [createMockSnapshot(), createMockSnapshot({ id: 'snap-2', version: 2 })]
    mockListSnapshots.mockResolvedValue({ success: true, data: snapshots })

    await useStrategySnapshotStore.getState().loadHistorySnapshots()

    const state = useStrategySnapshotStore.getState()
    expect(state.snapshots).toEqual(snapshots)
    expect(state.selectedSnapshot).toEqual(snapshots[0])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadHistorySnapshots: 空列表时 selectedSnapshot 为 null', async () => {
    useStrategySnapshotStore.setState({ activeTab: 'history' })
    mockListSnapshots.mockResolvedValue({ success: true, data: [] })

    await useStrategySnapshotStore.getState().loadHistorySnapshots()

    expect(useStrategySnapshotStore.getState().selectedSnapshot).toBeNull()
  })

  it('loadHistorySnapshots: 失败应设置 error', async () => {
    useStrategySnapshotStore.setState({ activeTab: 'history' })
    mockListSnapshots.mockResolvedValue({ success: false, error: '加载历史快照失败' })

    await useStrategySnapshotStore.getState().loadHistorySnapshots()

    const state = useStrategySnapshotStore.getState()
    expect(state.error).toBe('加载历史快照失败')
    expect(state.loading).toBe(false)
  })

  it('loadHistorySnapshots: 异常应设置 error', async () => {
    useStrategySnapshotStore.setState({ activeTab: 'history' })
    mockListSnapshots.mockRejectedValue(new Error('DB error'))

    await useStrategySnapshotStore.getState().loadHistorySnapshots()

    const state = useStrategySnapshotStore.getState()
    expect(state.error).toBe('DB error')
    expect(state.loading).toBe(false)
  })

  // ---------- saveSnapshot ----------

  it('saveSnapshot: 股票池为空时跳过', async () => {
    await useStrategySnapshotStore.getState().saveSnapshot('manual')
    expect(mockSaveStrategySnapshot).not.toHaveBeenCalled()
  })

  it('saveSnapshot: 成功保存快照', async () => {
    const stocks = [createMockStock()]
    const v6Scores = [createMockV6Score()]
    const rotationScores = [createMockRotationScore()]
    useStrategySnapshotStore.setState({ stocks, v6Scores, rotationScores, activeTab: 'current' })

    mockSaveStrategySnapshot.mockResolvedValue({ success: true, data: createMockSnapshot() })

    await useStrategySnapshotStore.getState().saveSnapshot('manual')

    const state = useStrategySnapshotStore.getState()
    expect(state.saving).toBe(false)
    expect(state.error).toBeNull()
    expect(mockSaveStrategySnapshot).toHaveBeenCalledWith(
      { stocks, v6Scores, rotationScores },
      'manual',
    )
  })

  it('saveSnapshot: 失败应设置 error', async () => {
    const stocks = [createMockStock()]
    useStrategySnapshotStore.setState({ stocks, activeTab: 'current' })
    mockSaveStrategySnapshot.mockResolvedValue({ success: false, error: '保存失败' })

    await useStrategySnapshotStore.getState().saveSnapshot('manual')

    const state = useStrategySnapshotStore.getState()
    expect(state.error).toBe('保存失败')
    expect(state.saving).toBe(false)
  })

  it('saveSnapshot: 异常应设置 error', async () => {
    const stocks = [createMockStock()]
    useStrategySnapshotStore.setState({ stocks, activeTab: 'current' })
    mockSaveStrategySnapshot.mockRejectedValue(new Error('Save error'))

    await useStrategySnapshotStore.getState().saveSnapshot('manual')

    const state = useStrategySnapshotStore.getState()
    expect(state.error).toBe('Save error')
    expect(state.saving).toBe(false)
  })

  // ---------- selectSnapshot ----------

  it('selectSnapshot: 通过 id 选择快照', () => {
    const snapshots = [
      createMockSnapshot({ id: 'snap-1' }),
      createMockSnapshot({ id: 'snap-2' }),
    ]
    useStrategySnapshotStore.setState({ snapshots })

    useStrategySnapshotStore.getState().selectSnapshot('snap-2')
    expect(useStrategySnapshotStore.getState().selectedSnapshot?.id).toBe('snap-2')
  })

  it('selectSnapshot: 不存在的 id 返回 null', () => {
    const snapshots = [createMockSnapshot({ id: 'snap-1' })]
    useStrategySnapshotStore.setState({ snapshots, selectedSnapshot: snapshots[0] })

    useStrategySnapshotStore.getState().selectSnapshot('not-exist')
    expect(useStrategySnapshotStore.getState().selectedSnapshot).toBeNull()
  })

  // ---------- clearError ----------

  it('clearError: 清除错误信息', () => {
    useStrategySnapshotStore.setState({ error: '测试错误' })
    useStrategySnapshotStore.getState().clearError()
    expect(useStrategySnapshotStore.getState().error).toBeNull()
  })

  // ---------- reset ----------

  it('reset: 重置后回到初始状态', () => {
    useStrategySnapshotStore.setState({
      activeTab: 'history',
      stocks: [createMockStock()],
      v6Scores: [createMockV6Score()],
      rotationScores: [createMockRotationScore()],
      items: { core: [createMockGroupItem()], hot: [], value: [] },
      snapshots: [createMockSnapshot()],
      selectedSnapshot: createMockSnapshot(),
      loading: true,
      saving: true,
      error: '测试错误',
    })

    useStrategySnapshotStore.getState().reset()

    const state = useStrategySnapshotStore.getState()
    expect(state.activeTab).toBe('current')
    expect(state.stocks).toEqual([])
    expect(state.v6Scores).toEqual([])
    expect(state.rotationScores).toEqual([])
    expect(state.items).toEqual({ core: [], hot: [], value: [] })
    expect(state.snapshots).toEqual([])
    expect(state.selectedSnapshot).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.saving).toBe(false)
    expect(state.error).toBeNull()
  })

  // ============================================================
  // saveSnapshot: activeTab=history 时刷新历史列表
  // 未覆盖行 231-232
  // ============================================================

  /** @test_id V9-TEST-ST-158-SAVE-HISTORY-TAB */
  it('saveSnapshot: activeTab=history 时保存成功后应刷新历史列表', async () => {
    const stocks = [createMockStock()]
    const v6Scores = [createMockV6Score()]
    const rotationScores = [createMockRotationScore()]
    useStrategySnapshotStore.setState({
      stocks,
      v6Scores,
      rotationScores,
      activeTab: 'history',
    })

    const snapshots = [createMockSnapshot({ id: 'snap-new' })]
    mockSaveStrategySnapshot.mockResolvedValue({ success: true, data: createMockSnapshot() })
    mockListSnapshots.mockResolvedValue({ success: true, data: snapshots })

    await useStrategySnapshotStore.getState().saveSnapshot('manual')

    // activeTab=history，保存成功后应调用 loadHistorySnapshots
    expect(mockListSnapshots).toHaveBeenCalled()
    const state = useStrategySnapshotStore.getState()
    expect(state.snapshots).toEqual(snapshots)
    expect(state.saving).toBe(false)
  })
})

// ============================================================
// initStrategySnapshotStoreSubscriptions / destroyStrategySnapshotStoreSubscriptions
// 未覆盖行 273-297
// ============================================================

describe('initStrategySnapshotStoreSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDataBridgeSubscribe.mockClear()
    // 默认 subscribe 返回 unsubscribe 函数
    const unsub = vi.fn()
    mockDataBridgeSubscribe.mockReturnValue(unsub)
  })

  /** @test_id V9-TEST-ST-158-DB-SUB-INIT */
  it('应订阅 strategy_snapshots 频道', () => {
    initStrategySnapshotStoreSubscriptions()

    expect(mockDataBridgeSubscribe).toHaveBeenCalledWith(
      'strategy_snapshots',
      expect.any(Function),
    )
  })

  /** @test_id V9-TEST-ST-158-DB-SUB-EVENT */
  it('收到 saveStrategySnapshots 事件时应记录日志', () => {
    initStrategySnapshotStoreSubscriptions()

    const capturedCallback = mockDataBridgeSubscribe.mock.calls[0]?.[1] as ((envelope: unknown) => void) | undefined
    expect(capturedCallback).toBeDefined()

    capturedCallback!({
      meta: {
        action: 'SAVE_STRATEGY_SNAPSHOTS',
        traceId: 'trace-123',
        source: 'test',
        target: 'db',
        timestamp: Date.now(),
      },
      payload: {},
    })

    // 验证 logger.info 被调用（包含 saveStrategySnapshot 关键字）
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('saveStrategySnapshot'),
      expect.any(Object),
    )
  })

  /** @test_id V9-TEST-ST-158-DB-SUB-CLEANUP */
  it('返回的清理函数应调用 destroyStrategySnapshotStoreSubscriptions', () => {
    const unsub = vi.fn()
    mockDataBridgeSubscribe.mockReturnValue(unsub)

    const cleanup = initStrategySnapshotStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    cleanup()

    expect(unsub).toHaveBeenCalledTimes(1)
  })

  /** @test_id V9-TEST-ST-158-DB-DESTROY */
  it('destroyStrategySnapshotStoreSubscriptions 无订阅时应安全执行', () => {
    // 没有初始化过订阅，直接调用 destroy
    expect(() => destroyStrategySnapshotStoreSubscriptions()).not.toThrow()
  })

  /** @test_id V9-TEST-ST-158-DB-DESTROY-EXISTING */
  it('destroyStrategySnapshotStoreSubscriptions 有订阅时应正确清理', () => {
    const unsub = vi.fn()
    mockDataBridgeSubscribe.mockReturnValue(unsub)

    initStrategySnapshotStoreSubscriptions()
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)

    destroyStrategySnapshotStoreSubscriptions()

    expect(unsub).toHaveBeenCalledTimes(1)
  })

  /** @test_id V9-TEST-ST-158-DB-REINIT */
  it('重复调用 initStrategySnapshotStoreSubscriptions 应先清理旧订阅', () => {
    const unsub1 = vi.fn()
    mockDataBridgeSubscribe.mockReturnValueOnce(unsub1)
    initStrategySnapshotStoreSubscriptions()

    const unsub2 = vi.fn()
    mockDataBridgeSubscribe.mockReturnValueOnce(unsub2)
    initStrategySnapshotStoreSubscriptions()

    // 第一次的 unsubscribe 应被调用
    expect(unsub1).toHaveBeenCalledTimes(1)
    expect(unsub2).not.toHaveBeenCalled()
  })
})
