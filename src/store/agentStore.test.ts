/**
 * @test_id V9-TEST-ST-128
 * agentStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. registerAgent 添加新 agent / 重复 agentId 不添加
 * 3. updateTask 更新/添加任务
 * 4. refreshStats 刷新统计
 * 5. initAgentSubscriptions 响应 AGENT_REGISTERED
 * 6. initAgentSubscriptions 响应 AGENT_TASK_STARTED / COMPLETED / FAILED / TIMEOUT / CANCELLED
 * 7. initAgentSubscriptions 任务不存在时不更新 task
 * 8. destroyAgentSubscriptions 清理所有订阅
 * 9. 重复 initAgentSubscriptions 先清理旧订阅
  * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockOn, capturedCallbacks, allUnsubscribers, mockGetStats, mockGetTask } = vi.hoisted(() => {
  const mockOn = vi.fn()
  const capturedCallbacks: Map<string, ((payload: unknown) => void)> = new Map()
  const allUnsubscribers: Array<ReturnType<typeof vi.fn>> = []

  mockOn.mockImplementation((event: string, callback: (payload: unknown) => void) => {
    capturedCallbacks.set(event, callback)
    const unsubscribe = vi.fn()
    allUnsubscribers.push(unsubscribe)
    return unsubscribe
  })

  const mockGetStats = vi.fn().mockReturnValue({
    totalAgents: 3,
    pendingTasks: 1,
    runningTasks: 2,
    completedTasks: 10,
    failedTasks: 1,
  })

  const mockGetTask = vi.fn().mockReturnValue(undefined)

  return { mockOn, capturedCallbacks, allUnsubscribers, mockGetStats, mockGetTask }
})

vi.mock('@/agents/agentRuntime', () => ({
  agentRuntime: {
    getStats: mockGetStats,
    getTask: mockGetTask,
  },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: mockOn },
}))

import { useAgentStore, initAgentSubscriptions, destroyAgentSubscriptions } from './agentStore'
import type { AgentTask } from '@/agents/agentRuntime'

function createMockTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'strategy-001-123456-abcde',
    agentId: 'strategy-agent',
    type: 'analysis',
    payload: {},
    timeout: 30000,
    status: 'running',
    createdAt: Date.now(),
    startedAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  allUnsubscribers.length = 0
  mockGetStats.mockReturnValue({
    totalAgents: 3,
    pendingTasks: 1,
    runningTasks: 2,
    completedTasks: 10,
    failedTasks: 1,
  })
  mockGetTask.mockReturnValue(undefined)

  // 重置 store（源文件末尾自动调用 initAgentSubscriptions）
  useAgentStore.setState({
    registeredAgents: [],
    tasks: new Map(),
    stats: mockGetStats(),
  })
})

/**
 * @status known-failing
 * @tracked-in package.json test:known 脚本
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 * @skip-reason 此测试为已知失败，已通过 vitest --exclude 跳过；
 *               修复后请移除 .skip 标记并从 test:clean 的 --exclude 列表中删除
 */
describe('agentStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================

  it('初始状态正确', () => {
    const state = useAgentStore.getState()
    expect(state.registeredAgents).toEqual([])
    expect(state.tasks).toBeInstanceOf(Map)
    expect(state.tasks.size).toBe(0)
    expect(state.stats).toEqual({
      totalAgents: 3,
      pendingTasks: 1,
      runningTasks: 2,
      completedTasks: 10,
      failedTasks: 1,
    })
  })

  // ============================================================
  // registerAgent
  // ============================================================

  it('registerAgent 添加新 agent', () => {
    const store = useAgentStore.getState()
    store.registerAgent('strategy-agent')
    const state = useAgentStore.getState()
    expect(state.registeredAgents).toContain('strategy-agent')
    expect(state.registeredAgents).toHaveLength(1)
  })

  it('registerAgent 添加多个 agent', () => {
    const store = useAgentStore.getState()
    store.registerAgent('strategy-agent')
    store.registerAgent('llm-agent')
    store.registerAgent('tool-agent')
    expect(useAgentStore.getState().registeredAgents).toHaveLength(3)
  })

  it('registerAgent 重复 agentId 不添加', () => {
    const store = useAgentStore.getState()
    store.registerAgent('strategy-agent')
    store.registerAgent('strategy-agent')
    expect(useAgentStore.getState().registeredAgents).toHaveLength(1)
  })

  // ============================================================
  // updateTask
  // ============================================================

  it('updateTask 添加新任务', () => {
    const task = createMockTask()
    const store = useAgentStore.getState()
    store.updateTask(task)
    const state = useAgentStore.getState()
    expect(state.tasks.get(task.id)).toEqual(task)
    expect(state.tasks.size).toBe(1)
  })

  it('updateTask 更新已有任务', () => {
    const task = createMockTask({ status: 'running' })
    const store = useAgentStore.getState()
    store.updateTask(task)

    const updatedTask = { ...task, status: 'completed' as const, result: { data: 'ok' } }
    store.updateTask(updatedTask)

    const state = useAgentStore.getState()
    expect(state.tasks.get(task.id)!.status).toBe('completed')
    expect(state.tasks.get(task.id)!.result).toEqual({ data: 'ok' })
  })

  // ============================================================
  // refreshStats
  // ============================================================

  it('refreshStats 调用 agentRuntime.getStats 并更新状态', () => {
    const newStats = {
      totalAgents: 5,
      pendingTasks: 2,
      runningTasks: 3,
      completedTasks: 20,
      failedTasks: 2,
    }
    mockGetStats.mockReturnValue(newStats)
    mockGetStats.mockClear() // 清除 beforeEach 中的调用记录

    const store = useAgentStore.getState()
    store.refreshStats()

    expect(mockGetStats).toHaveBeenCalledTimes(1)
    expect(useAgentStore.getState().stats).toEqual(newStats)
  })

  // ============================================================
  // initAgentSubscriptions - AGENT_REGISTERED
  // ============================================================

  it('initAgentSubscriptions 订阅 AGENT_REGISTERED 事件，注册 agent 并刷新统计', () => {
    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_REGISTERED')
    expect(callback).toBeDefined()

    const newStats = {
      totalAgents: 5,
      pendingTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
    }
    mockGetStats.mockReturnValueOnce(newStats)

    callback!({ agentId: 'new-agent' })

    expect(useAgentStore.getState().registeredAgents).toContain('new-agent')
    expect(useAgentStore.getState().stats).toEqual(newStats)
  })

  // ============================================================
  // initAgentSubscriptions - AGENT_TASK_STARTED
  // ============================================================

  it('initAgentSubscriptions 订阅 AGENT_TASK_STARTED 事件，更新任务并刷新统计', () => {
    const task = createMockTask({ status: 'running' })
    mockGetTask.mockReturnValueOnce(task)

    const newStats = {
      totalAgents: 3,
      pendingTasks: 0,
      runningTasks: 1,
      completedTasks: 0,
      failedTasks: 0,
    }
    mockGetStats.mockReturnValueOnce(newStats)

    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_TASK_STARTED')
    expect(callback).toBeDefined()

    callback!({ taskId: task.id })

    expect(mockGetTask).toHaveBeenCalledWith(task.id)
    expect(useAgentStore.getState().tasks.get(task.id)).toEqual(task)
    expect(useAgentStore.getState().stats).toEqual(newStats)
  })

  // ============================================================
  // initAgentSubscriptions - AGENT_TASK_COMPLETED
  // ============================================================

  it('initAgentSubscriptions 订阅 AGENT_TASK_COMPLETED 事件，更新任务并刷新统计', () => {
    const task = createMockTask({ status: 'completed', result: { score: 4.5 } })
    mockGetTask.mockReturnValueOnce(task)

    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_TASK_COMPLETED')
    expect(callback).toBeDefined()

    callback!({ taskId: task.id })

    const storedTask = useAgentStore.getState().tasks.get(task.id)
    expect(storedTask).toBeDefined()
    expect(storedTask!.status).toBe('completed')
  })

  // ============================================================
  // initAgentSubscriptions - AGENT_TASK_FAILED
  // ============================================================

  it('initAgentSubscriptions 订阅 AGENT_TASK_FAILED 事件，更新任务并刷新统计', () => {
    const task = createMockTask({ status: 'failed', error: '计算超时' })
    mockGetTask.mockReturnValueOnce(task)

    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_TASK_FAILED')
    expect(callback).toBeDefined()

    callback!({ taskId: task.id })

    const storedTask = useAgentStore.getState().tasks.get(task.id)
    expect(storedTask).toBeDefined()
    expect(storedTask!.status).toBe('failed')
    expect(storedTask!.error).toBe('计算超时')
  })

  // ============================================================
  // initAgentSubscriptions - AGENT_TASK_TIMEOUT
  // ============================================================

  it('initAgentSubscriptions 订阅 AGENT_TASK_TIMEOUT 事件，更新任务并刷新统计', () => {
    const task = createMockTask({ status: 'timeout', error: 'Task timeout after 30000ms' })
    mockGetTask.mockReturnValueOnce(task)

    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_TASK_TIMEOUT')
    expect(callback).toBeDefined()

    callback!({ taskId: task.id })

    const storedTask = useAgentStore.getState().tasks.get(task.id)
    expect(storedTask).toBeDefined()
    expect(storedTask!.status).toBe('timeout')
  })

  // ============================================================
  // initAgentSubscriptions - AGENT_TASK_CANCELLED
  // ============================================================

  it('initAgentSubscriptions 订阅 AGENT_TASK_CANCELLED 事件，更新任务并刷新统计', () => {
    const task = createMockTask({ status: 'failed', error: 'Task cancelled' })
    mockGetTask.mockReturnValueOnce(task)

    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_TASK_CANCELLED')
    expect(callback).toBeDefined()

    callback!({ taskId: task.id })

    const storedTask = useAgentStore.getState().tasks.get(task.id)
    expect(storedTask).toBeDefined()
    expect(storedTask!.status).toBe('failed')
  })

  // ============================================================
  // initAgentSubscriptions - 任务不存在时不更新 task
  // ============================================================

  it('initAgentSubscriptions AGENT_TASK_STARTED 事件中 getTask 返回 undefined 时不更新任务', () => {
    mockGetTask.mockReturnValueOnce(undefined)

    initAgentSubscriptions()
    const callback = capturedCallbacks.get('AGENT_TASK_STARTED')
    expect(callback).toBeDefined()

    callback!({ taskId: 'nonexistent-task' })

    expect(useAgentStore.getState().tasks.size).toBe(0)
    expect(mockGetStats).toHaveBeenCalled() // 仍然刷新统计
  })

  // ============================================================
  // destroyAgentSubscriptions
  // ============================================================

  it('destroyAgentSubscriptions 调用所有 unsubscribe 函数', () => {
    initAgentSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(6) // AGENT_REGISTERED + 5 task events
    expect(allUnsubscribers).toHaveLength(6)

    destroyAgentSubscriptions()

    allUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // initAgentSubscriptions 返回清理函数
  // ============================================================

  it('initAgentSubscriptions 返回的清理函数正确工作', () => {
    const cleanup = initAgentSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(6)

    cleanup()

    allUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // 重复调用 initAgentSubscriptions 先清理旧订阅
  // ============================================================

  it('initAgentSubscriptions 重复调用时先清理旧订阅', () => {
    initAgentSubscriptions()
    const firstUnsubscribers = [...allUnsubscribers]

    initAgentSubscriptions()

    firstUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
    expect(mockOn).toHaveBeenCalledTimes(12)
  })
})
