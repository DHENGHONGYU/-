/**
 * @test_id V9-TEST-ST-151
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
 */
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import type {
  CollectionTraceSpan,
  CollectionTaskRuntime,
  CollectionLog,
  CollectionLifecycleEvent,
} from '@/types/modules/collection.types'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type { QualityMetrics } from '@/services/data-collector/qualityMetricsCollector'

// ============================================================
// Mocks
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

const mockOn = vi.hoisted(() => vi.fn())
const mockEmit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: (...args: unknown[]) => mockOn(...args),
    off: vi.fn(),
    emit: (...args: unknown[]) => mockEmit(...args),
  },
}))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: vi.fn(),
  createBroadcaster: vi.fn(),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {
    DATA_TEST_CHANGED: 'data:test:changed',
  },
}))

const mockGetQualitySnapshot = vi.hoisted(() => vi.fn())

vi.mock('@/services/data-collector/qualityMetricsCollector', () => ({
  getQualitySnapshot: () => mockGetQualitySnapshot(),
  getQualityMetrics: () => ({
    snapshot: () => mockGetQualitySnapshot(),
    recordCollect: vi.fn(),
    recordWrite: vi.fn(),
    reset: vi.fn(),
    checkAlerts: vi.fn(),
  }),
}))

const mockQueryTraceRecords = vi.hoisted(() => vi.fn())

vi.mock('@/services/data-collector/tracePersistenceService', () => ({
  queryTraceRecords: (options?: unknown) => mockQueryTraceRecords(options),
}))

// 必须在 mock 之后导入 store
import { useCollectionRuntimeStore } from './collectionRuntimeStore'

// ============================================================
// Helpers
// ============================================================

function createInitialStats(): QualityMetrics {
  return {
    since: Date.now(),
    totalCollects: 0,
    successCollects: 0,
    successRate: 0,
    mockCollects: 0,
    mockSuccesses: 0,
    realSuccessRate: 0,
    completeness: 0,
    sourceCounts: { tushare: 0, tencent: 0, sina: 0, netease: 0, akshare: 0, mock: 0 },
    fallbackCount: 0,
    writeSuccess: 0,
    writeTotal: 0,
    writeRate: 0,
    mockWrites: 0,
    avgLatency: 0,
    totalLatency: 0,
  }
}

function createLog(overrides: Partial<CollectionLog> = {}): CollectionLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    time: '12:00:00',
    level: 'info',
    dimensionCode: '01',
    symbol: 'AAPL',
    sourceId: 'tencent',
    message: '测试日志',
    traceId: 'trace-001',
    ...overrides,
  }
}

function createSpan(overrides: Partial<CollectionTraceSpan> = {}): CollectionTraceSpan {
  return {
    traceId: 'trace-001',
    taskId: 'task-001',
    dimensionCode: '01',
    symbol: 'AAPL',
    stages: [],
    result: 'success',
    totalDurationMs: 100,
    fallbackCount: 0,
    startedAt: Date.now(),
    completedAt: Date.now() + 100,
    ...overrides,
  } as CollectionTraceSpan
}

function createTaskRuntime(overrides: Partial<CollectionTaskRuntime> = {}): CollectionTaskRuntime {
  return {
    taskId: 'task-001',
    dimensionCode: '01',
    symbol: 'AAPL',
    status: 'pending',
    progress: 0,
    ...overrides,
  } as CollectionTaskRuntime
}

// ============================================================
// Tests
// ============================================================

describe('useCollectionRuntimeStore', () => {
  // --------------------------------------------------------
  // 在 beforeAll 中捕获 eventBus.on 注册的回调（模块导入时已注册）。
  // beforeEach 的 vi.clearAllMocks() 会清空 mockOn.mock.calls，
  // 因此必须在 beforeAll（首个 beforeEach 之前）完成捕获。
  // --------------------------------------------------------
  const lifecycleCallbacks: Record<string, (event: unknown) => void> = {}
  let traceCallback: (span: unknown) => void = () => {}

  beforeAll(() => {
    for (const call of mockOn.mock.calls as unknown as [string, (event: unknown) => void][]) {
      if (call[0] === 'collect:trace') {
        traceCallback = call[1]
      } else {
        lifecycleCallbacks[call[0]] = call[1]
      }
    }
  })

  beforeEach(() => {
    useCollectionRuntimeStore.getState().reset()
    vi.clearAllMocks()
    mockGetQualitySnapshot.mockReturnValue(createInitialStats())
    mockQueryTraceRecords.mockResolvedValue([])
  })

  // --------------------------------------------------------
  // 初始状态
  // --------------------------------------------------------
  describe('初始状态', () => {
    it('所有字段应为初始值', () => {
      const state = useCollectionRuntimeStore.getState()
      expect(state.traceSpans).toEqual({})
      expect(state.logs).toEqual([])
      expect(state.taskStatuses).toEqual({})
      expect(state.overallProgress).toBe(0)
      expect(state.isRunning).toBe(false)
      expect(state.stats).toBeDefined()
      expect(typeof state.stats.since).toBe('number')
      expect(state.stats.totalCollects).toBe(0)
    })
  })

  // --------------------------------------------------------
  // appendLog
  // --------------------------------------------------------
  describe('appendLog', () => {
    it('应添加日志到列表（最新在前）', () => {
      const log1 = createLog({ id: 'log-1', message: '第一条' })
      const log2 = createLog({ id: 'log-2', message: '第二条' })

      useCollectionRuntimeStore.getState().appendLog(log1)
      useCollectionRuntimeStore.getState().appendLog(log2)

      const state = useCollectionRuntimeStore.getState()
      expect(state.logs).toHaveLength(2)
      expect(state.logs[0]!.id).toBe('log-2')
      expect(state.logs[1]!.id).toBe('log-1')
    })

    it('日志数量最多保留 200 条', () => {
      for (let i = 0; i < 250; i++) {
        useCollectionRuntimeStore.getState().appendLog(
          createLog({ id: `log-${i}`, message: `日志 ${i}` }),
        )
      }
      const state = useCollectionRuntimeStore.getState()
      expect(state.logs).toHaveLength(200)
      // 最新的在前
      expect(state.logs[0]!.id).toBe('log-249')
      // 最旧的是第 50 条（250 - 200 = 50 条被丢弃）
      expect(state.logs[199]!.id).toBe('log-50')
    })
  })

  // --------------------------------------------------------
  // addOrUpdateSpan
  // --------------------------------------------------------
  describe('addOrUpdateSpan', () => {
    it('应添加新的 trace span', () => {
      const span = createSpan({ traceId: 'trace-new' })
      useCollectionRuntimeStore.getState().addOrUpdateSpan(span)
      const state = useCollectionRuntimeStore.getState()
      expect(state.traceSpans['trace-new']).toEqual(span)
    })

    it('应更新已存在的 span', () => {
      const span1 = createSpan({ traceId: 'trace-1', result: 'success', totalDurationMs: 100 })
      const span2 = createSpan({ traceId: 'trace-1', result: 'fail', totalDurationMs: 200 })

      useCollectionRuntimeStore.getState().addOrUpdateSpan(span1)
      useCollectionRuntimeStore.getState().addOrUpdateSpan(span2)

      const state = useCollectionRuntimeStore.getState()
      expect(state.traceSpans['trace-1']!.result).toBe('fail')
      expect(state.traceSpans['trace-1']!.totalDurationMs).toBe(200)
    })

    it('应支持多个不同 traceId 的 span', () => {
      useCollectionRuntimeStore.getState().addOrUpdateSpan(createSpan({ traceId: 't1' }))
      useCollectionRuntimeStore.getState().addOrUpdateSpan(createSpan({ traceId: 't2' }))
      useCollectionRuntimeStore.getState().addOrUpdateSpan(createSpan({ traceId: 't3' }))

      const state = useCollectionRuntimeStore.getState()
      expect(Object.keys(state.traceSpans)).toHaveLength(3)
      expect(state.traceSpans['t1']).toBeDefined()
      expect(state.traceSpans['t2']).toBeDefined()
      expect(state.traceSpans['t3']).toBeDefined()
    })
  })

  // --------------------------------------------------------
  // updateTaskStatus
  // --------------------------------------------------------
  describe('updateTaskStatus', () => {
    it('应添加新任务状态', () => {
      useCollectionRuntimeStore.getState().updateTaskStatus('task-1', {
        taskId: 'task-1',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'running',
        progress: 50,
      })
      const state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['task-1']).toBeDefined()
      expect(state.taskStatuses['task-1']!.status).toBe('running')
      expect(state.taskStatuses['task-1']!.progress).toBe(50)
    })

    it('应部分更新已存在的任务状态', () => {
      const actions = useCollectionRuntimeStore.getState()
      actions.updateTaskStatus('task-1', {
        taskId: 'task-1',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'running',
        progress: 30,
      })

      // 只更新进度
      actions.updateTaskStatus('task-1', {
        taskId: 'task-1',
        progress: 60,
      })

      const state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['task-1']!.progress).toBe(60)
      expect(state.taskStatuses['task-1']!.status).toBe('running')
      expect(state.taskStatuses['task-1']!.symbol).toBe('AAPL')
    })

    it('应支持多任务状态管理', () => {
      const actions = useCollectionRuntimeStore.getState()
      actions.updateTaskStatus('task-a', {
        taskId: 'task-a',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'completed',
        progress: 100,
      })
      actions.updateTaskStatus('task-b', {
        taskId: 'task-b',
        dimensionCode: '02',
        symbol: 'TSLA',
        status: 'running',
        progress: 50,
      })
      actions.updateTaskStatus('task-c', {
        taskId: 'task-c',
        dimensionCode: '03',
        symbol: 'NVDA',
        status: 'error',
        progress: 20,
        error: '网络超时',
      })

      const state = useCollectionRuntimeStore.getState()
      expect(Object.keys(state.taskStatuses)).toHaveLength(3)
      expect(state.taskStatuses['task-a']!.status).toBe('completed')
      expect(state.taskStatuses['task-b']!.status).toBe('running')
      expect(state.taskStatuses['task-c']!.status).toBe('error')
      expect(state.taskStatuses['task-c']!.error).toBe('网络超时')
    })

    it('新任务未提供 dimensionCode/symbol 时使用默认值', () => {
      useCollectionRuntimeStore.getState().updateTaskStatus('task-new', {
        taskId: 'task-new',
        status: 'pending',
      })
      const task = useCollectionRuntimeStore.getState().taskStatuses['task-new']!
      expect(task.dimensionCode).toBe('')
      expect(task.symbol).toBe('')
      expect(task.status).toBe('pending')
      expect(task.progress).toBe(0)
    })
  })

  // --------------------------------------------------------
  // setOverallProgress
  // --------------------------------------------------------
  describe('setOverallProgress', () => {
    it('应正确设置全局进度', () => {
      useCollectionRuntimeStore.getState().setOverallProgress(42)
      expect(useCollectionRuntimeStore.getState().overallProgress).toBe(42)
    })

    it('多次调用应覆盖之前的值', () => {
      const actions = useCollectionRuntimeStore.getState()
      actions.setOverallProgress(10)
      actions.setOverallProgress(50)
      actions.setOverallProgress(99)
      expect(useCollectionRuntimeStore.getState().overallProgress).toBe(99)
    })
  })

  // --------------------------------------------------------
  // refreshStats
  // --------------------------------------------------------
  describe('refreshStats', () => {
    it('应刷新质量指标快照', () => {
      const updatedStats = {
        ...createInitialStats(),
        totalCollects: 100,
        successCollects: 95,
        successRate: 95,
      }
      mockGetQualitySnapshot.mockReturnValue(updatedStats)

      useCollectionRuntimeStore.getState().refreshStats()

      const state = useCollectionRuntimeStore.getState()
      expect(state.stats.totalCollects).toBe(100)
      expect(state.stats.successCollects).toBe(95)
      expect(state.stats.successRate).toBe(95)
      expect(mockGetQualitySnapshot).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------
  // setRunning
  // --------------------------------------------------------
  describe('setRunning', () => {
    it('应正确设置运行状态', () => {
      const actions = useCollectionRuntimeStore.getState()
      expect(useCollectionRuntimeStore.getState().isRunning).toBe(false)

      actions.setRunning(true)
      expect(useCollectionRuntimeStore.getState().isRunning).toBe(true)

      actions.setRunning(false)
      expect(useCollectionRuntimeStore.getState().isRunning).toBe(false)
    })
  })

  // --------------------------------------------------------
  // clearLogs
  // --------------------------------------------------------
  describe('clearLogs', () => {
    it('应清空所有日志', () => {
      const actions = useCollectionRuntimeStore.getState()
      actions.appendLog(createLog({ id: 'log-1' }))
      actions.appendLog(createLog({ id: 'log-2' }))
      expect(useCollectionRuntimeStore.getState().logs.length).toBeGreaterThan(0)

      actions.clearLogs()
      expect(useCollectionRuntimeStore.getState().logs).toEqual([])
    })
  })

  // --------------------------------------------------------
  // clearTraces
  // --------------------------------------------------------
  describe('clearTraces', () => {
    it('应清空所有 trace spans', () => {
      const actions = useCollectionRuntimeStore.getState()
      actions.addOrUpdateSpan(createSpan({ traceId: 't1' }))
      actions.addOrUpdateSpan(createSpan({ traceId: 't2' }))
      expect(Object.keys(useCollectionRuntimeStore.getState().traceSpans).length).toBeGreaterThan(0)

      actions.clearTraces()
      expect(useCollectionRuntimeStore.getState().traceSpans).toEqual({})
    })
  })

  // --------------------------------------------------------
  // loadPersistedTraces
  // --------------------------------------------------------
  describe('loadPersistedTraces', () => {
    it('应加载持久化的 traces 并重建任务状态', async () => {
      const persistedSpans: CollectionTraceSpan[] = [
        createSpan({
          traceId: 'trace-p1',
          taskId: 'task-p1',
          dimensionCode: '01',
          symbol: 'AAPL',
          result: 'success',
          startedAt: 1000,
          completedAt: 2000,
        }),
        createSpan({
          traceId: 'trace-p2',
          taskId: 'task-p2',
          dimensionCode: '02',
          symbol: 'TSLA',
          result: 'fail',
          error: '数据源不可用',
          startedAt: 3000,
          completedAt: 4000,
        }),
        createSpan({
          traceId: 'trace-p3',
          taskId: 'task-p3',
          dimensionCode: '03',
          symbol: 'NVDA',
          result: 'partial',
          startedAt: 5000,
          completedAt: 6000,
        }),
      ]
      mockQueryTraceRecords.mockResolvedValue(persistedSpans)

      await useCollectionRuntimeStore.getState().loadPersistedTraces()

      const state = useCollectionRuntimeStore.getState()
      expect(Object.keys(state.traceSpans)).toHaveLength(3)
      expect(state.traceSpans['trace-p1']).toBeDefined()
      expect(state.traceSpans['trace-p2']).toBeDefined()
      expect(state.traceSpans['trace-p3']).toBeDefined()

      // 任务状态应被重建
      expect(state.taskStatuses['task-p1']!.status).toBe('completed')
      expect(state.taskStatuses['task-p1']!.progress).toBe(100)
      expect(state.taskStatuses['task-p2']!.status).toBe('error')
      expect(state.taskStatuses['task-p2']!.progress).toBe(0)
      expect(state.taskStatuses['task-p2']!.error).toBe('数据源不可用')
      // partial 结果也视为 completed
      expect(state.taskStatuses['task-p3']!.status).toBe('completed')
      expect(state.taskStatuses['task-p3']!.progress).toBe(100)
    })

    it('内存中已有的 span 不应被持久化数据覆盖', async () => {
      // 先添加一个内存中的 span
      useCollectionRuntimeStore.getState().addOrUpdateSpan(
        createSpan({
          traceId: 'trace-mem',
          taskId: 'task-mem',
          result: 'success',
          totalDurationMs: 999,
        }),
      )

      // 持久化返回相同 traceId 但不同数据
      mockQueryTraceRecords.mockResolvedValue([
        createSpan({
          traceId: 'trace-mem',
          taskId: 'task-mem',
          result: 'fail',
          totalDurationMs: 111,
        }),
      ])

      await useCollectionRuntimeStore.getState().loadPersistedTraces()

      const state = useCollectionRuntimeStore.getState()
      // 内存中的版本应保留
      expect(state.traceSpans['trace-mem']!.result).toBe('success')
      expect(state.traceSpans['trace-mem']!.totalDurationMs).toBe(999)
    })

    it('内存中已有的任务状态不应被重建覆盖', async () => {
      // 先添加一个内存中的任务
      useCollectionRuntimeStore.getState().updateTaskStatus('task-mem', {
        taskId: 'task-mem',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'running',
        progress: 75,
      })

      // 持久化返回相同 taskId
      mockQueryTraceRecords.mockResolvedValue([
        createSpan({
          traceId: 'trace-mem',
          taskId: 'task-mem',
          dimensionCode: '01',
          symbol: 'AAPL',
          result: 'success',
          startedAt: 1000,
          completedAt: 2000,
        }),
      ])

      await useCollectionRuntimeStore.getState().loadPersistedTraces()

      const state = useCollectionRuntimeStore.getState()
      // 内存中的任务状态应保留
      expect(state.taskStatuses['task-mem']!.status).toBe('running')
      expect(state.taskStatuses['task-mem']!.progress).toBe(75)
    })

    it('加载失败时应静默处理（不抛出异常）', async () => {
      mockQueryTraceRecords.mockRejectedValue(new Error('DB error'))

      await expect(
        useCollectionRuntimeStore.getState().loadPersistedTraces(),
      ).resolves.not.toThrow()
    })
  })

  // --------------------------------------------------------
  // reset
  // --------------------------------------------------------
  describe('reset', () => {
    it('应将所有状态重置为初始值', () => {
      const actions = useCollectionRuntimeStore.getState()

      // 设置各种状态
      actions.appendLog(createLog())
      actions.addOrUpdateSpan(createSpan())
      actions.updateTaskStatus('task-1', {
        taskId: 'task-1',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'running',
        progress: 50,
      })
      actions.setOverallProgress(75)
      actions.setRunning(true)

      // 验证状态已变更
      const stateBefore = useCollectionRuntimeStore.getState()
      expect(stateBefore.logs.length).toBeGreaterThan(0)
      expect(Object.keys(stateBefore.traceSpans).length).toBeGreaterThan(0)
      expect(Object.keys(stateBefore.taskStatuses).length).toBeGreaterThan(0)
      expect(stateBefore.overallProgress).not.toBe(0)
      expect(stateBefore.isRunning).toBe(true)

      // 重置
      actions.reset()

      // 验证已重置
      const stateAfter = useCollectionRuntimeStore.getState()
      expect(stateAfter.logs).toEqual([])
      expect(stateAfter.traceSpans).toEqual({})
      expect(stateAfter.taskStatuses).toEqual({})
      expect(stateAfter.overallProgress).toBe(0)
      expect(stateAfter.isRunning).toBe(false)
    })
  })

  // --------------------------------------------------------
  // 综合场景：采集任务生命周期
  // --------------------------------------------------------
  describe('采集任务生命周期', () => {
    it('完整流程: 开始 → 运行中 → 进度更新 → 完成', () => {
      const actions = useCollectionRuntimeStore.getState()

      // 开始采集
      actions.setRunning(true)
      actions.updateTaskStatus('task-1', {
        taskId: 'task-1',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'running',
        progress: 0,
        startedAt: Date.now(),
      })
      actions.appendLog(createLog({ id: 'log-start', message: '开始采集', level: 'info' }))

      let state = useCollectionRuntimeStore.getState()
      expect(state.isRunning).toBe(true)
      expect(state.taskStatuses['task-1']!.status).toBe('running')

      // 进度更新
      actions.updateTaskStatus('task-1', { taskId: 'task-1', progress: 30 })
      actions.setOverallProgress(30)
      actions.appendLog(createLog({ id: 'log-p30', message: '进度 30%', level: 'info' }))

      state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['task-1']!.progress).toBe(30)
      expect(state.overallProgress).toBe(30)

      // 继续更新
      actions.updateTaskStatus('task-1', { taskId: 'task-1', progress: 70 })
      actions.setOverallProgress(70)

      state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['task-1']!.progress).toBe(70)

      // 完成
      actions.updateTaskStatus('task-1', {
        taskId: 'task-1',
        status: 'completed',
        progress: 100,
        completedAt: Date.now(),
      })
      actions.setOverallProgress(100)
      actions.setRunning(false)
      actions.appendLog(createLog({ id: 'log-done', message: '采集完成', level: 'success' }))
      actions.addOrUpdateSpan(createSpan({
        traceId: 'trace-1',
        taskId: 'task-1',
        result: 'success',
      }))

      state = useCollectionRuntimeStore.getState()
      expect(state.isRunning).toBe(false)
      expect(state.taskStatuses['task-1']!.status).toBe('completed')
      expect(state.taskStatuses['task-1']!.progress).toBe(100)
      expect(state.overallProgress).toBe(100)
      expect(state.traceSpans['trace-1']).toBeDefined()
    })

    it('失败场景: 运行中 → 错误 → 记录错误日志', () => {
      const actions = useCollectionRuntimeStore.getState()

      actions.setRunning(true)
      actions.updateTaskStatus('task-err', {
        taskId: 'task-err',
        dimensionCode: '02',
        symbol: 'TSLA',
        status: 'running',
        progress: 40,
      })
      actions.setOverallProgress(40)

      // 出错
      actions.updateTaskStatus('task-err', {
        taskId: 'task-err',
        status: 'error',
        error: '数据源连接超时',
      })
      actions.appendLog(createLog({
        id: 'log-err',
        message: '采集失败: 数据源连接超时',
        level: 'error',
        traceId: 'trace-err',
      }))
      actions.addOrUpdateSpan(createSpan({
        traceId: 'trace-err',
        taskId: 'task-err',
        result: 'fail',
        error: '数据源连接超时',
      }))
      actions.setRunning(false)

      const state = useCollectionRuntimeStore.getState()
      expect(state.isRunning).toBe(false)
      expect(state.taskStatuses['task-err']!.status).toBe('error')
      expect(state.taskStatuses['task-err']!.error).toBe('数据源连接超时')
      expect(state.logs[0]!.level).toBe('error')
      expect(state.traceSpans['trace-err']!.result).toBe('fail')
    })

    it('暂停/继续场景', () => {
      const actions = useCollectionRuntimeStore.getState()

      actions.setRunning(true)
      actions.updateTaskStatus('task-pause', {
        taskId: 'task-pause',
        dimensionCode: '03',
        symbol: 'NVDA',
        status: 'running',
        progress: 50,
      })

      // 暂停
      actions.updateTaskStatus('task-pause', {
        taskId: 'task-pause',
        status: 'paused',
      })

      let state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['task-pause']!.status).toBe('paused')
      expect(state.taskStatuses['task-pause']!.progress).toBe(50)

      // 继续
      actions.updateTaskStatus('task-pause', {
        taskId: 'task-pause',
        status: 'running',
      })

      state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['task-pause']!.status).toBe('running')
      expect(state.taskStatuses['task-pause']!.progress).toBe(50)
    })

    it('停止采集: 运行中 → 停止并重置', () => {
      const actions = useCollectionRuntimeStore.getState()

      actions.setRunning(true)
      actions.updateTaskStatus('task-stop', {
        taskId: 'task-stop',
        dimensionCode: '01',
        symbol: 'AAPL',
        status: 'running',
        progress: 30,
      })
      actions.appendLog(createLog({ id: 'log-running', message: '运行中', level: 'info' }))
      actions.setOverallProgress(30)

      // 停止并清理
      actions.setRunning(false)
      actions.clearLogs()
      actions.clearTraces()
      actions.setOverallProgress(0)

      const state = useCollectionRuntimeStore.getState()
      expect(state.isRunning).toBe(false)
      expect(state.logs).toEqual([])
      expect(state.traceSpans).toEqual({})
      expect(state.overallProgress).toBe(0)
      // 任务状态保留（用于展示历史）
      expect(state.taskStatuses['task-stop']).toBeDefined()
    })

    it('多任务并发: 多个任务同时进行，各自独立更新', () => {
      const actions = useCollectionRuntimeStore.getState()
      actions.setRunning(true)

      // 启动三个任务
      actions.updateTaskStatus('t1', {
        taskId: 't1', dimensionCode: '01', symbol: 'AAPL', status: 'running', progress: 20,
      })
      actions.updateTaskStatus('t2', {
        taskId: 't2', dimensionCode: '02', symbol: 'TSLA', status: 'running', progress: 50,
      })
      actions.updateTaskStatus('t3', {
        taskId: 't3', dimensionCode: '03', symbol: 'NVDA', status: 'pending', progress: 0,
      })

      let state = useCollectionRuntimeStore.getState()
      expect(Object.keys(state.taskStatuses)).toHaveLength(3)

      // t2 完成
      actions.updateTaskStatus('t2', { taskId: 't2', status: 'completed', progress: 100 })
      // t1 出错
      actions.updateTaskStatus('t1', { taskId: 't1', status: 'error', error: '失败' })
      // t3 开始运行
      actions.updateTaskStatus('t3', { taskId: 't3', status: 'running', progress: 10 })

      state = useCollectionRuntimeStore.getState()
      expect(state.taskStatuses['t1']!.status).toBe('error')
      expect(state.taskStatuses['t2']!.status).toBe('completed')
      expect(state.taskStatuses['t3']!.status).toBe('running')
    })
  })

  // --------------------------------------------------------
  // 事件订阅与生命周期处理（handleLifecycleEvent / handleTraceSpan）
  // 覆盖 eventBus.on 注册的回调、mapEventLevel 分支、状态映射、catch 路径
  // --------------------------------------------------------
  describe('事件订阅与生命周期处理', () => {
    /** 构造生命周期事件 */
    function createLifecycleEvent(
      overrides: Partial<CollectionLifecycleEvent>,
    ): CollectionLifecycleEvent {
      return {
        type: COLLECTION_EVENTS.TRIGGERED,
        traceId: 'trace-001',
        timestamp: 1700000000000,
        message: '测试事件',
        ...overrides,
      } as CollectionLifecycleEvent
    }

    // ---- handleLifecycleEvent 基础路径 ----

    /** @test_id V9-TEST-ST-151-evt-01 */
    it('基础事件触发 refreshStats + appendLog', () => {
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.TRIGGERED]
      cb(createLifecycleEvent({ message: '采集已触发' }))

      const state = useCollectionRuntimeStore.getState()
      expect(state.logs).toHaveLength(1)
      expect(state.logs[0]!.message).toBe('采集已触发')
      expect(mockGetQualitySnapshot).toHaveBeenCalled()
    })

    /** @test_id V9-TEST-ST-151-evt-02 */
    it('mapEventLevel: 各事件类型映射到正确的日志级别', () => {
      const cases: Array<{
        type: CollectionLifecycleEvent['type']
        expected: CollectionLog['level']
        label: string
      }> = [
        { type: COLLECTION_EVENTS.SOURCE_FAIL, expected: 'error', label: 'SOURCE_FAIL' },
        { type: COLLECTION_EVENTS.WRITE_FAIL, expected: 'error', label: 'WRITE_FAIL' },
        { type: COLLECTION_EVENTS.FALLBACK, expected: 'warn', label: 'FALLBACK' },
        { type: COLLECTION_EVENTS.SOURCE_SUCCESS, expected: 'success', label: 'SOURCE_SUCCESS' },
        { type: COLLECTION_EVENTS.WRITE_SUCCESS, expected: 'success', label: 'WRITE_SUCCESS' },
        { type: COLLECTION_EVENTS.COMPLETE, expected: 'success', label: 'COMPLETE' },
        { type: COLLECTION_EVENTS.TRIGGERED, expected: 'info', label: 'TRIGGERED(default)' },
        { type: COLLECTION_EVENTS.TASK_STATUS, expected: 'info', label: 'TASK_STATUS(default)' },
      ]

      for (const { type, expected, label } of cases) {
        useCollectionRuntimeStore.getState().reset()
        const cb = lifecycleCallbacks[type]
        cb(createLifecycleEvent({ type, traceId: `trace-${label}` }))

        const log = useCollectionRuntimeStore.getState().logs[0]
        expect(log, `事件 ${label} 应产生日志`).toBeDefined()
        expect(log!.level, `事件 ${label} 级别应为 ${expected}`).toBe(expected)
      }
    })

    // ---- taskId + payload 状态映射 ----

    /** @test_id V9-TEST-ST-151-evt-03 */
    it('携带 taskId 的事件根据 payload.status 映射任务状态', () => {
      const statusCases: Array<{
        payloadStatus: string
        expectedStatus: CollectionTaskRuntime['status']
      }> = [
        { payloadStatus: 'running', expectedStatus: 'running' },
        { payloadStatus: 'completed', expectedStatus: 'completed' },
        { payloadStatus: 'error', expectedStatus: 'error' },
        { payloadStatus: 'paused', expectedStatus: 'paused' },
        { payloadStatus: 'unknown', expectedStatus: 'pending' },
      ]

      for (const { payloadStatus, expectedStatus } of statusCases) {
        useCollectionRuntimeStore.getState().reset()
        const cb = lifecycleCallbacks[COLLECTION_EVENTS.SOURCE_START]
        cb(
          createLifecycleEvent({
            type: COLLECTION_EVENTS.SOURCE_START,
            taskId: `task-${payloadStatus}`,
            dimensionCode: '01',
            symbol: 'AAPL',
            payload: { status: payloadStatus, progress: 42 },
          }),
        )

        const task = useCollectionRuntimeStore.getState().taskStatuses[`task-${payloadStatus}`]
        expect(task, `payload.status=${payloadStatus}`).toBeDefined()
        expect(task!.status).toBe(expectedStatus)
        expect(task!.progress).toBe(42)
      }
    })

    /** @test_id V9-TEST-ST-151-evt-04 */
    it('携带 taskId 但无 payload 时任务状态默认为 pending', () => {
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.TRIGGERED]
      cb(
        createLifecycleEvent({
          type: COLLECTION_EVENTS.TRIGGERED,
          taskId: 'task-no-payload',
          dimensionCode: '02',
          symbol: 'TSLA',
        }),
      )

      const task = useCollectionRuntimeStore.getState().taskStatuses['task-no-payload']
      expect(task).toBeDefined()
      expect(task!.status).toBe('pending')
      expect(task!.dimensionCode).toBe('02')
      expect(task!.symbol).toBe('TSLA')
    })

    // ---- COMPLETE 事件 + span ----

    /** @test_id V9-TEST-ST-151-evt-05 */
    it('COMPLETE 事件携带 span 时更新 traceSpans', () => {
      const span = createSpan({ traceId: 'trace-complete-span' })
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.COMPLETE]
      cb(
        createLifecycleEvent({
          type: COLLECTION_EVENTS.COMPLETE,
          payload: { span },
        }),
      )

      expect(
        useCollectionRuntimeStore.getState().traceSpans['trace-complete-span'],
      ).toBeDefined()
    })

    /** @test_id V9-TEST-ST-151-evt-06 */
    it('COMPLETE 事件 payload 无 span 时不更新 traceSpans', () => {
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.COMPLETE]
      cb(
        createLifecycleEvent({
          type: COLLECTION_EVENTS.COMPLETE,
          payload: {},
        }),
      )

      expect(Object.keys(useCollectionRuntimeStore.getState().traceSpans)).toHaveLength(0)
    })

    /** @test_id V9-TEST-ST-151-evt-07 */
    it('COMPLETE 事件无 payload 时不更新 traceSpans', () => {
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.COMPLETE]
      cb(
        createLifecycleEvent({
          type: COLLECTION_EVENTS.COMPLETE,
        }),
      )

      expect(Object.keys(useCollectionRuntimeStore.getState().traceSpans)).toHaveLength(0)
    })

    // ---- TASK_STATUS 事件 + 全局进度 ----

    /** @test_id V9-TEST-ST-151-evt-08 */
    it('TASK_STATUS 事件携带 progress 时更新全局进度', () => {
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.TASK_STATUS]
      cb(
        createLifecycleEvent({
          type: COLLECTION_EVENTS.TASK_STATUS,
          taskId: 'task-progress',
          payload: { progress: 77 },
        }),
      )

      expect(useCollectionRuntimeStore.getState().overallProgress).toBe(77)
    })

    /** @test_id V9-TEST-ST-151-evt-09 */
    it('TASK_STATUS 事件无 progress 时不更新全局进度', () => {
      useCollectionRuntimeStore.getState().setOverallProgress(42)
      const cb = lifecycleCallbacks[COLLECTION_EVENTS.TASK_STATUS]
      cb(
        createLifecycleEvent({
          type: COLLECTION_EVENTS.TASK_STATUS,
          taskId: 'task-no-progress',
          payload: { status: 'running' },
        }),
      )

      expect(useCollectionRuntimeStore.getState().overallProgress).toBe(42)
    })

    // ---- handleLifecycleEvent 异常路径（catch 分支）----

    /** @test_id V9-TEST-ST-151-evt-10 */
    it('生命周期事件处理异常时进入 catch 不影响 store', () => {
      // 让 refreshStats 内部的 getQualitySnapshot 抛出，触发 catch 分支
      mockGetQualitySnapshot.mockImplementationOnce(() => {
        throw new Error('stats boom')
      })

      const cb = lifecycleCallbacks[COLLECTION_EVENTS.TRIGGERED]
      cb(createLifecycleEvent({ message: '不应记录' }))

      // refreshStats 抛出 → appendLog 未执行
      expect(useCollectionRuntimeStore.getState().logs).toHaveLength(0)
    })

    // ---- handleTraceSpan 路径 ----

    /** @test_id V9-TEST-ST-151-evt-11 */
    it('collect:trace 事件正常处理 span 并更新 traceSpans', () => {
      traceCallback(createSpan({ traceId: 'trace-from-bus' }))

      expect(
        useCollectionRuntimeStore.getState().traceSpans['trace-from-bus'],
      ).toBeDefined()
    })

    /** @test_id V9-TEST-ST-151-evt-12 */
    it('collect:trace 事件异常 span 时进入 catch 不影响 store', () => {
      // null.traceId 会抛出 TypeError，触发 catch 分支
      traceCallback(null)

      expect(useCollectionRuntimeStore.getState().traceSpans).toEqual({})
    })
  })
})
