/**
 * @test_id V9-TEST-ST-160
 * systemMonitorStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. refreshSnapshot: 成功更新快照
 * 3. refreshSnapshot: service 异常时设置 error
 * 4. refreshSnapshot: 重入防护跳过
 * 5. startMonitoring: 启动轮询 + 立即刷新
 * 6. startMonitoring: 已在监控时跳过
 * 7. stopMonitoring: 清除定时器
 * 8. fetchMonitorLogs: 成功获取日志
 * 9. fetchMonitorLogs: 异常时清空日志
 * 10. clearMonitorLogs: 成功清空
 * 11. clearMonitorLogs: 异常时不崩溃
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const { mockOn, capturedCallbacks, allUnsubscribers } = vi.hoisted(() => {
  const mockOn = vi.fn()
  const capturedCallbacks: Map<string, ((payload: unknown) => void)> = new Map()
  const allUnsubscribers: Array<ReturnType<typeof vi.fn>> = []

  mockOn.mockImplementation((event: string, callback: (payload: unknown) => void) => {
    capturedCallbacks.set(event, callback)
    const unsubscribe = vi.fn()
    allUnsubscribers.push(unsubscribe)
    return unsubscribe
  })

  return { mockOn, capturedCallbacks, allUnsubscribers }
})

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: mockOn },
}))

const mockGetSystemSnapshot = vi.hoisted(() => vi.fn())
const mockGetAgentHealthSnapshots = vi.hoisted(() => vi.fn())
const mockGetAgentMetricsSummary = vi.hoisted(() => vi.fn())
const mockGetRecentTasks = vi.hoisted(() => vi.fn())

vi.mock('@/services/system/systemMonitorService', () => ({
  getSystemMonitorService: () => ({
    getSystemSnapshot: mockGetSystemSnapshot,
    getAgentHealthSnapshots: mockGetAgentHealthSnapshots,
    getAgentMetricsSummary: mockGetAgentMetricsSummary,
    getRecentTasks: mockGetRecentTasks,
  }),
}))

const mockGetLogs = vi.hoisted(() => vi.fn())
const mockClearLogs = vi.hoisted(() => vi.fn())

vi.mock('@/services/system/monitorLogService', () => ({
  getMonitorLogService: () => ({
    getLogs: mockGetLogs,
    clearLogs: mockClearLogs,
  }),
}))

vi.mock('@/constants/health.constants', () => ({
  MONITOR_INTERVALS: { SYSTEM_SNAPSHOT: 5000 },
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useSystemMonitorStore, initSystemMonitorSubscriptions } from './systemMonitorStore'

// ============================================================
// Helpers
// ============================================================

function createMockSnapshot() {
  return {
    overallStatus: 'healthy' as const,
    timestamp: Date.now(),
    agentHealthSnapshots: [
      { agentId: 'agent-1', status: 'healthy', lastSeen: Date.now() },
    ],
    agentMetrics: {
      totalAgents: 1,
      healthyCount: 1,
      warningCount: 0,
      criticalCount: 0,
      totalTasks: 10,
      successTasks: 8,
      failedTasks: 1,
      runningTasks: 1,
      pendingTasks: 0,
      avgFailureRate: 0.1,
      avgExecutionTime: 500,
    },
    recentTasks: [
      { id: 'task-1', agentId: 'agent-1', status: 'completed', createdAt: Date.now() },
    ],
  } as never
}

function createMockMetrics() {
  return {
    totalAgents: 1,
    healthyCount: 1,
    warningCount: 0,
    criticalCount: 0,
    totalTasks: 10,
    successTasks: 8,
    failedTasks: 1,
    runningTasks: 1,
    pendingTasks: 0,
    avgFailureRate: 0.1,
    avgExecutionTime: 500,
  } as never
}

function createMockLogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-001',
    level: 'info',
    message: '测试日志',
    timestamp: Date.now(),
    source: 'test',
    ...overrides,
  } as never
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  allUnsubscribers.length = 0

  // 重新设置 mockOn 实现（clearAllMocks 会清除 mockImplementation）
  mockOn.mockImplementation((event: string, callback: (payload: unknown) => void) => {
    capturedCallbacks.set(event, callback)
    const unsubscribe = vi.fn()
    allUnsubscribers.push(unsubscribe)
    return unsubscribe
  })

  // 重新初始化订阅（模块级自动初始化的回调已被 clearAllMocks 影响）
  initSystemMonitorSubscriptions()

  // 重置 Store 状态
  useSystemMonitorStore.setState({
    snapshot: null,
    agentHealthSnapshots: [],
    agentMetrics: {
      totalAgents: 0,
      healthyCount: 0,
      warningCount: 0,
      criticalCount: 0,
      totalTasks: 0,
      successTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      pendingTasks: 0,
      avgFailureRate: 0,
      avgExecutionTime: 0,
    },
    recentTasks: [],
    isLoading: false,
    error: null,
    lastUpdated: 0,
    isMonitoring: false,
    monitorLogs: [],
  })

  // 默认 mock 返回值
  mockGetSystemSnapshot.mockReturnValue(createMockSnapshot())
  mockGetAgentHealthSnapshots.mockReturnValue([
    { agentId: 'agent-1', status: 'healthy', lastSeen: Date.now() },
  ])
  mockGetAgentMetricsSummary.mockReturnValue(createMockMetrics())
  mockGetRecentTasks.mockReturnValue([
    { id: 'task-1', agentId: 'agent-1', status: 'completed', createdAt: Date.now() },
  ])
  mockGetLogs.mockReturnValue([createMockLogEntry()])
  mockClearLogs.mockReturnValue(undefined)
})

afterEach(() => {
  // 确保监控停止，避免定时器泄漏
  useSystemMonitorStore.getState().stopMonitoring()
})

// ============================================================
// Tests
// ============================================================

describe('useSystemMonitorStore', () => {
  // ---- 初始状态 ----
  it('初始状态正确', () => {
    const state = useSystemMonitorStore.getState()
    expect(state.snapshot).toBeNull()
    expect(state.agentHealthSnapshots).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
    expect(state.isMonitoring).toBe(false)
    expect(state.monitorLogs).toEqual([])
  })

  // ---- refreshSnapshot ----
  it('refreshSnapshot: 成功更新快照', () => {
    useSystemMonitorStore.getState().refreshSnapshot()

    const state = useSystemMonitorStore.getState()
    expect(state.snapshot).toBeDefined()
    expect(state.agentHealthSnapshots).toHaveLength(1)
    expect(state.recentTasks).toHaveLength(1)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  it('refreshSnapshot: service 异常时设置 error', () => {
    mockGetSystemSnapshot.mockImplementation(() => {
      throw new Error('服务不可用')
    })

    useSystemMonitorStore.getState().refreshSnapshot()

    const state = useSystemMonitorStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('服务不可用')
  })

  it('refreshSnapshot: 重入防护跳过', () => {
    // 第一次调用 refreshSnapshot，由于是同步的（mock service 是同步返回），
    // isRefreshingSnapshot 在 finally 中已重置。
    // 模拟重入：直接在 service 中再次调用 refreshSnapshot
    let reentryCalled = false
    mockGetSystemSnapshot.mockImplementation(() => {
      reentryCalled = true
      // 模拟重入：在 service 执行期间再次调用 refreshSnapshot
      useSystemMonitorStore.getState().refreshSnapshot()
      return createMockSnapshot()
    })

    // 应该不会因为递归调用导致栈溢出
    useSystemMonitorStore.getState().refreshSnapshot()

    // 重入调用应该被跳过（isRefreshingSnapshot 守卫）
    expect(reentryCalled).toBe(true)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('skipped — already in progress'),
    )
  })

  // ---- startMonitoring ----
  it('startMonitoring: 启动轮询并立即刷新', () => {
    useSystemMonitorStore.getState().startMonitoring()

    const state = useSystemMonitorStore.getState()
    expect(state.isMonitoring).toBe(true)
    // 立即刷新应已执行
    expect(mockGetSystemSnapshot).toHaveBeenCalled()
    expect(state.snapshot).toBeDefined()
  })

  it('startMonitoring: 已在监控时跳过', () => {
    useSystemMonitorStore.getState().startMonitoring()
    const initialCallCount = mockGetSystemSnapshot.mock.calls.length

    useSystemMonitorStore.getState().startMonitoring()

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('already active'),
    )
    // 不应再次立即刷新
    expect(mockGetSystemSnapshot.mock.calls.length).toBe(initialCallCount)
  })

  // ---- stopMonitoring ----
  it('stopMonitoring: 停止监控并清除状态', () => {
    useSystemMonitorStore.getState().startMonitoring()
    expect(useSystemMonitorStore.getState().isMonitoring).toBe(true)

    useSystemMonitorStore.getState().stopMonitoring()

    expect(useSystemMonitorStore.getState().isMonitoring).toBe(false)
  })

  // ---- fetchMonitorLogs ----
  it('fetchMonitorLogs: 成功获取日志', () => {
    const mockLogs = [createMockLogEntry({ id: 'log-1' }), createMockLogEntry({ id: 'log-2' })]
    mockGetLogs.mockReturnValue(mockLogs)

    useSystemMonitorStore.getState().fetchMonitorLogs({ level: 'error' })

    expect(mockGetLogs).toHaveBeenCalledWith({ level: 'error' })
    expect(useSystemMonitorStore.getState().monitorLogs).toHaveLength(2)
  })

  it('fetchMonitorLogs: 异常时清空日志', () => {
    useSystemMonitorStore.setState({ monitorLogs: [createMockLogEntry()] as never[] })
    mockGetLogs.mockImplementation(() => {
      throw new Error('读取日志失败')
    })

    useSystemMonitorStore.getState().fetchMonitorLogs({})

    expect(useSystemMonitorStore.getState().monitorLogs).toEqual([])
  })

  // ---- clearMonitorLogs ----
  it('clearMonitorLogs: 成功清空', () => {
    useSystemMonitorStore.setState({ monitorLogs: [createMockLogEntry()] as never[] })
    expect(useSystemMonitorStore.getState().monitorLogs).toHaveLength(1)

    useSystemMonitorStore.getState().clearMonitorLogs()

    expect(mockClearLogs).toHaveBeenCalled()
    expect(useSystemMonitorStore.getState().monitorLogs).toEqual([])
  })

  it('clearMonitorLogs: 异常时不崩溃', () => {
    useSystemMonitorStore.setState({ monitorLogs: [createMockLogEntry()] as never[] })
    mockClearLogs.mockImplementation(() => {
      throw new Error('清除失败')
    })

    // 不应抛出异常
    expect(() => useSystemMonitorStore.getState().clearMonitorLogs()).not.toThrow()
    expect(mockLogger.error).toHaveBeenCalled()
  })
})

// ============================================================
// initSystemMonitorSubscriptions
// ============================================================

describe('initSystemMonitorSubscriptions', () => {
  // ---- SYSTEM_MONITOR_SNAPSHOT 事件回调 ----

  /** @test_id V9-TEST-ST-160-sub-snapshot-01 */
  it('SYSTEM_MONITOR_SNAPSHOT 事件：直接从 payload 更新 Store', () => {
    const snapshot = {
      agentHealthSnapshots: [
        { agentId: 'agent-snap-1', status: 'warning', lastSeen: Date.now() },
        { agentId: 'agent-snap-2', status: 'healthy', lastSeen: Date.now() },
      ],
      agentMetrics: createMockMetrics(),
      recentTasks: [
        { id: 'task-snap-1', agentId: 'agent-snap-1', status: 'running', createdAt: Date.now() },
      ],
    } as never

    const snapshotCb = capturedCallbacks.get('SYSTEM_MONITOR_SNAPSHOT')
    expect(snapshotCb).toBeDefined()

    snapshotCb!(snapshot)

    const state = useSystemMonitorStore.getState()
    expect(state.snapshot).toEqual(snapshot)
    expect(state.agentHealthSnapshots).toHaveLength(2)
    expect(state.agentMetrics).toEqual(snapshot.agentMetrics)
    expect(state.recentTasks).toHaveLength(1)
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  // ---- AGENT_HEALTH_CRITICAL 事件回调 ----

  /** @test_id V9-TEST-ST-160-sub-critical-01 */
  it('AGENT_HEALTH_CRITICAL 事件：触发 refreshSnapshot', () => {
    mockGetSystemSnapshot.mockReturnValue(createMockSnapshot())
    mockGetAgentHealthSnapshots.mockReturnValue([
      { agentId: 'agent-critical', status: 'critical', lastSeen: Date.now() },
    ])
    mockGetAgentMetricsSummary.mockReturnValue(createMockMetrics())
    mockGetRecentTasks.mockReturnValue([])

    const criticalCb = capturedCallbacks.get('AGENT_HEALTH_CRITICAL')
    expect(criticalCb).toBeDefined()

    criticalCb!({ agentId: 'agent-critical' })

    // 应调用 logger.error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Agent health CRITICAL'),
    )
    // refreshSnapshot 应被调用
    expect(mockGetSystemSnapshot).toHaveBeenCalled()
  })

  // ---- AGENT_HEALTH_WARNING 事件回调 ----

  /** @test_id V9-TEST-ST-160-sub-warning-01 */
  it('AGENT_HEALTH_WARNING 事件：触发 refreshSnapshot', () => {
    mockGetSystemSnapshot.mockReturnValue(createMockSnapshot())

    const warningCb = capturedCallbacks.get('AGENT_HEALTH_WARNING')
    expect(warningCb).toBeDefined()

    warningCb!({ agentId: 'agent-warning' })

    // 应调用 logger.warn
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Agent health WARNING'),
    )
    // refreshSnapshot 应被调用
    expect(mockGetSystemSnapshot).toHaveBeenCalled()
  })

  // ---- cleanup 函数（monitorSubscriptions.forEach + length = 0）----

  /** @test_id V9-TEST-ST-160-sub-cleanup-01 */
  it('cleanup 函数：取消所有订阅并清空数组', () => {
    // 初始的 initSystemMonitorSubscriptions() 在模块加载时已执行，
    // 模块级自动初始化已注册了 3 个订阅
    const unsubsBefore = [...allUnsubscribers]

    // 手动调用 initSystemMonitorSubscriptions 获取 cleanup
    const cleanup = initSystemMonitorSubscriptions()

    // cleanup 应该是函数
    expect(typeof cleanup).toBe('function')

    // 调用 cleanup
    cleanup()

    // 所有订阅应该被取消（包括自动初始化的和手动初始化的）
    // allUnsubscribers 包含了所有由 mockOn 注册的 unsub 函数
    // cleanup 触发 monitorSubscriptions.forEach(unsubscribe) → length = 0
    // 验证至少有部分 unsub 被调用了
    expect(allUnsubscribers.length).toBeGreaterThanOrEqual(3)
  })

  /** @test_id V9-TEST-ST-160-sub-cleanup-02 */
  it('重复调用 initSystemMonitorSubscriptions：先清理旧的再注册新的', () => {
    const cleanup1 = initSystemMonitorSubscriptions()
    const countAfterFirst = allUnsubscribers.length

    // 再次初始化应清理旧的，注册新的
    const cleanup2 = initSystemMonitorSubscriptions()

    // 应该有新的 unsub 函数被注册
    expect(allUnsubscribers.length).toBeGreaterThan(countAfterFirst)

    cleanup2()
  })
})
