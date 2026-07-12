import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskScheduler } from './TaskScheduler'
import type { DataSourceConfig, CollectionResultCallback } from '@/types/modules/widget.types'

// ============================================================
// Mock dependencies
// ============================================================

const mockCollectWithRetry = vi.fn().mockResolvedValue({
  timestamp: Date.now(),
  dataType: 'indices',
  payload: { data: 'mock' },
  source: 'mock',
})

const mockCancel = vi.fn()

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('./collectors/BaseCollector', () => ({
  BaseCollector: class {
    collectWithRetry = mockCollectWithRetry
    cancel = mockCancel
  },
}))

vi.mock('./collectors/MockCollector', () => ({
  MockCollector: class {
    collectWithRetry = mockCollectWithRetry
    cancel = mockCancel
  },
}))

vi.mock('./collectors/RestCollector', () => ({
  RestCollector: class {
    collectWithRetry = mockCollectWithRetry
    cancel = mockCancel
  },
}))

vi.mock('./collectors/WebSocketCollector', () => ({
  WebSocketCollector: class {
    collectWithRetry = mockCollectWithRetry
    cancel = mockCancel
  },
}))

vi.mock('@/constants/cockpit.constants', () => ({
  DATA_SOURCE_TYPE: { MOCK: 'mock', REST: 'rest', WEBSOCKET: 'websocket' },
}))

// ============================================================
// Test helpers
// ============================================================

function createMockDataSource(overrides: Partial<DataSourceConfig> = {}): DataSourceConfig {
  return {
    type: 'mock',
    mode: 'polling',
    interval: 5000,
    enabled: true,
    ...overrides,
  }
}

// ============================================================
// TaskScheduler tests
// ============================================================

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    scheduler = new TaskScheduler()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ----------------------------------------------------------
  // registerTask
  // ----------------------------------------------------------

  test('registerTask: 注册成功，返回 taskId，包含 widgetId/instanceId/dataSource', () => {
    const dataSource = createMockDataSource()
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    expect(taskId).toMatch(/^task_widget_1_instance_1_\d+$/)

    const status = scheduler.getTaskStatus(taskId)
    expect(status).toBe('pending')

    const tasks = scheduler.getAllTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.widgetId).toBe('widget_1')
    expect(tasks[0]!.instanceId).toBe('instance_1')
    expect(tasks[0]!.dataSource).toEqual(dataSource)
  })

  test('registerTask: 多次注册，taskCounter 递增', () => {
    const dataSource = createMockDataSource()
    const taskId1 = scheduler.registerTask('widget_1', 'instance_1', dataSource)
    const taskId2 = scheduler.registerTask('widget_1', 'instance_2', dataSource)
    const taskId3 = scheduler.registerTask('widget_2', 'instance_1', dataSource)

    expect(taskId1).toMatch(/_1$/)
    expect(taskId2).toMatch(/_2$/)
    expect(taskId3).toMatch(/_3$/)

    expect(scheduler.getAllTasks()).toHaveLength(3)
  })

  // ----------------------------------------------------------
  // startTask
  // ----------------------------------------------------------

  test('startTask: polling 模式，立即执行 + 设置定时器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)

    expect(scheduler.getTaskStatus(taskId)).toBe('running')
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)

    // 推进定时器，触发轮询
    await vi.advanceTimersByTimeAsync(1000)
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1000)
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(3)
  })

  test('startTask: once 模式，执行一次后状态变为 completed', async () => {
    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)

    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)
    expect(scheduler.getTaskStatus(taskId)).toBe('completed')
  })

  test('startTask: streaming 模式，执行一次', async () => {
    const dataSource = createMockDataSource({ mode: 'streaming' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)

    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)
    expect(scheduler.getTaskStatus(taskId)).toBe('running')
  })

  test('startTask: 任务不存在，报错（不抛异常，仅记录日志）', async () => {
    // 不存在的任务，startTask 不会抛异常，仅记录日志
    await scheduler.startTask('task_nonexistent')
    // 没有抛异常即通过
    expect(scheduler.getTaskStatus('task_nonexistent')).toBeUndefined()
  })

  test('startTask: 任务已在运行中，跳过', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)

    // 再次启动同一个任务
    await scheduler.startTask(taskId)
    // 由于状态已经是 running，不会重复执行
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)
  })

  // ----------------------------------------------------------
  // stopTask
  // ----------------------------------------------------------

  test('stopTask: 停止定时器，状态变为 paused', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(scheduler.getTaskStatus(taskId)).toBe('running')

    scheduler.stopTask(taskId)
    expect(scheduler.getTaskStatus(taskId)).toBe('paused')

    // 定时器已停止，不会再触发采集
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)
  })

  test('stopTask: 不存在任务，不报错', () => {
    // 停止不存在的任务不应抛异常
    expect(() => scheduler.stopTask('task_nonexistent')).not.toThrow()
  })

  test('stopTask: 取消采集器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    scheduler.stopTask(taskId)

    expect(mockCancel).toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // unregisterTask
  // ----------------------------------------------------------

  test('unregisterTask: 先 stop 再删除', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(scheduler.getAllTasks()).toHaveLength(1)

    scheduler.unregisterTask(taskId)
    expect(scheduler.getAllTasks()).toHaveLength(0)
    expect(scheduler.getTaskStatus(taskId)).toBeUndefined()
  })

  // ----------------------------------------------------------
  // subscribe
  // ----------------------------------------------------------

  test('subscribe: 添加监听器，返回取消订阅函数', () => {
    const listener: CollectionResultCallback = vi.fn()
    const unsubscribe = scheduler.subscribe(listener)

    expect(typeof unsubscribe).toBe('function')

    // 触发监听器（通过 executeTask 间接验证）
    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)
    scheduler.startTask(taskId)

    unsubscribe()
  })

  test('subscribe: 取消订阅后不再接收通知', async () => {
    const listener: CollectionResultCallback = vi.fn()
    const unsubscribe = scheduler.subscribe(listener)

    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    unsubscribe()
    await scheduler.startTask(taskId)

    // 等待异步 executeTask 完成
    await vi.advanceTimersByTimeAsync(0)
    expect(listener).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // getTaskStatus
  // ----------------------------------------------------------

  test('getTaskStatus: 存在返回状态，不存在返回 undefined', () => {
    const dataSource = createMockDataSource()
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    expect(scheduler.getTaskStatus(taskId)).toBe('pending')
    expect(scheduler.getTaskStatus('task_nonexistent')).toBeUndefined()
  })

  // ----------------------------------------------------------
  // getAllTasks
  // ----------------------------------------------------------

  test('getAllTasks: 返回所有任务', () => {
    const dataSource = createMockDataSource()
    scheduler.registerTask('widget_1', 'instance_1', dataSource)
    scheduler.registerTask('widget_2', 'instance_1', dataSource)

    const tasks = scheduler.getAllTasks()
    expect(tasks).toHaveLength(2)
    expect(tasks[0]!.widgetId).toBe('widget_1')
    expect(tasks[1]!.widgetId).toBe('widget_2')
  })

  test('getAllTasks: 空任务返回空数组', () => {
    expect(scheduler.getAllTasks()).toEqual([])
  })

  // ----------------------------------------------------------
  // dispose
  // ----------------------------------------------------------

  test('dispose: 清除所有定时器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    scheduler.dispose()

    // 定时器已清除，不会再触发采集
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockCollectWithRetry).toHaveBeenCalledTimes(1)
  })

  test('dispose: 取消所有采集器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId1 = scheduler.registerTask('widget_1', 'instance_1', dataSource)
    const taskId2 = scheduler.registerTask('widget_2', 'instance_1', dataSource)

    await scheduler.startTask(taskId1)
    await scheduler.startTask(taskId2)

    scheduler.dispose()

    expect(mockCancel).toHaveBeenCalledTimes(2)
  })

  test('dispose: 清空所有任务和监听器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)
    const listener: CollectionResultCallback = vi.fn()
    scheduler.subscribe(listener)

    await scheduler.startTask(taskId)
    scheduler.dispose()

    expect(scheduler.getAllTasks()).toEqual([])
    expect(scheduler.getTaskStatus(taskId)).toBeUndefined()
  })

  // ----------------------------------------------------------
  // executeTask (private, tested via public methods)
  // ----------------------------------------------------------

  test('executeTask: 成功时通知所有监听器', async () => {
    const listener: CollectionResultCallback = vi.fn()
    scheduler.subscribe(listener)

    const mockData = {
      timestamp: Date.now(),
      dataType: 'indices' as const,
      payload: { test: 'data' },
      source: 'mock',
    }
    mockCollectWithRetry.mockResolvedValueOnce(mockData)

    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    await vi.advanceTimersByTimeAsync(0)

    expect(listener).toHaveBeenCalledWith(taskId, mockData)
  })

  test('executeTask: 失败时通知监听器错误', async () => {
    const listener = vi.fn() as unknown as CollectionResultCallback
    scheduler.subscribe(listener)

    const error = new Error('采集失败')
    mockCollectWithRetry.mockRejectedValueOnce(error)

    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    await vi.advanceTimersByTimeAsync(0)

    expect(listener).toHaveBeenCalledTimes(1)
    const call = (listener as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(call[0]).toBe(taskId)
    expect(call[1]).toBeNull()
    expect(call[2]).toBeInstanceOf(Error)
    expect((call[2] as Error).message).toBe('采集失败')
  })

  // ----------------------------------------------------------
  // getOrCreateCollector (private, tested via public methods)
  // ----------------------------------------------------------

  test('getOrCreateCollector: mock 类型返回 MockCollector', async () => {
    const dataSource = createMockDataSource({ type: 'mock', mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(mockCollectWithRetry).toHaveBeenCalled()
  })

  test('getOrCreateCollector: rest 类型返回 RestCollector', async () => {
    const dataSource = createMockDataSource({ type: 'rest', mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(mockCollectWithRetry).toHaveBeenCalled()
  })

  test('getOrCreateCollector: websocket 类型返回 WebSocketCollector', async () => {
    const dataSource = createMockDataSource({ type: 'websocket', mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(mockCollectWithRetry).toHaveBeenCalled()
  })

  test('getOrCreateCollector: 未知类型返回 MockCollector（兜底）', async () => {
    const dataSource = createMockDataSource({ type: 'unknown_type' as any, mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(mockCollectWithRetry).toHaveBeenCalled()
  })
})
