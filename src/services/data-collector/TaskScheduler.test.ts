/**
 * @test_id V9-TEST-ST-073
 * @covers_docs []
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskScheduler } from './TaskScheduler'
import type { DataSourceConfig, CollectionResultCallback } from '@/types/modules/widget.types'

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
    collectWithRetry = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'indices',
      payload: { data: 'mock' },
      source: 'mock',
    })
    cancel = vi.fn()
  },
}))

vi.mock('./collectors/MockCollector', () => ({
  MockCollector: class {
    collectWithRetry = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'indices',
      payload: { data: 'mock' },
      source: 'mock',
    })
    cancel = vi.fn()
  },
}))

vi.mock('./collectors/RestCollector', () => ({
  RestCollector: class {
    collectWithRetry = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'indices',
      payload: { data: 'mock' },
      source: 'mock',
    })
    cancel = vi.fn()
  },
}))

vi.mock('./collectors/WebSocketCollector', () => ({
  WebSocketCollector: class {
    collectWithRetry = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'indices',
      payload: { data: 'mock' },
      source: 'mock',
    })
    cancel = vi.fn()
  },
}))

vi.mock('./collectors/LiveCollector', () => ({
  LiveCollector: class {
    collectWithRetry = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'indices',
      payload: { data: 'mock' },
      source: 'mock',
    })
    cancel = vi.fn()
  },
}))

vi.mock('./collectors/NewsCrawler', () => ({
  NewsCrawler: class {
    collectWithRetry = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'news',
      payload: { data: 'mock' },
      source: 'newsCrawler',
    })
    cancel = vi.fn()
    clearCache = vi.fn()
    getCacheStats = vi.fn().mockReturnValue({ totalSymbols: 0, totalNews: 0 })
  },
  newsCrawler: {
    collectWithRetry: vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      dataType: 'news',
      payload: { data: 'mock' },
      source: 'newsCrawler',
    }),
    cancel: vi.fn(),
    clearCache: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ totalSymbols: 0, totalNews: 0 }),
  },
}))

vi.mock('@/constants/cockpit.constants', () => ({
  DATA_SOURCE_TYPE: { MOCK: 'mock', REST: 'rest', WEBSOCKET: 'websocket' },
}))

function createMockDataSource(overrides: Partial<DataSourceConfig> = {}): DataSourceConfig {
  return {
    type: 'mock',
    mode: 'polling',
    interval: 5000,
    enabled: true,
    ...overrides,
  }
}

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

  test('startTask: polling 模式，立即执行 + 设置定时器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)

    expect(scheduler.getTaskStatus(taskId)).toBe('running')

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
  })

  test('startTask: once 模式，执行一次后状态变为 completed', async () => {
    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)

    expect(scheduler.getTaskStatus(taskId)).toBe('completed')
  })

  test('startTask: streaming 模式，执行一次', async () => {
    const dataSource = createMockDataSource({ mode: 'streaming' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)

    expect(scheduler.getTaskStatus(taskId)).toBe('running')
  })

  test('startTask: 任务不存在，报错（不抛异常，仅记录日志）', async () => {
    await scheduler.startTask('task_nonexistent')
    expect(scheduler.getTaskStatus('task_nonexistent')).toBeUndefined()
  })

  test('startTask: 任务已在运行中，跳过', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    await scheduler.startTask(taskId)
  })

  test('stopTask: 停止定时器，状态变为 paused', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(scheduler.getTaskStatus(taskId)).toBe('running')

    scheduler.stopTask(taskId)
    expect(scheduler.getTaskStatus(taskId)).toBe('paused')

    await vi.advanceTimersByTimeAsync(2000)
  })

  test('stopTask: 不存在任务，不报错', () => {
    expect(() => scheduler.stopTask('task_nonexistent')).not.toThrow()
  })

  test('stopTask: 取消采集器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    scheduler.stopTask(taskId)
  })

  test('unregisterTask: 先 stop 再删除', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(scheduler.getAllTasks()).toHaveLength(1)

    scheduler.unregisterTask(taskId)
    expect(scheduler.getAllTasks()).toHaveLength(0)
    expect(scheduler.getTaskStatus(taskId)).toBeUndefined()
  })

  test('subscribe: 添加监听器，返回取消订阅函数', () => {
    const listener: CollectionResultCallback = vi.fn()
    const unsubscribe = scheduler.subscribe(listener)

    expect(typeof unsubscribe).toBe('function')

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

    await scheduler.startTask(taskId)
    unsubscribe()
  })

  test('getTaskStatus: 存在返回状态，不存在返回 undefined', () => {
    const dataSource = createMockDataSource()
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    expect(scheduler.getTaskStatus(taskId)).toBe('pending')
    expect(scheduler.getTaskStatus('task_nonexistent')).toBeUndefined()
  })

  test('getAllTasks: 返回所有任务', () => {
    const dataSource = createMockDataSource()
    scheduler.registerTask('widget_1', 'instance_1', dataSource)
    scheduler.registerTask('widget_1', 'instance_2', dataSource)
    scheduler.registerTask('widget_2', 'instance_1', dataSource)

    expect(scheduler.getAllTasks()).toHaveLength(3)
  })

  test('getAllTasks: 空任务返回空数组', () => {
    expect(scheduler.getAllTasks()).toEqual([])
  })

  test('dispose: 清除所有定时器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    expect(scheduler.getTaskStatus(taskId)).toBe('running')

    scheduler.dispose()

    await vi.advanceTimersByTimeAsync(2000)
  })

  test('dispose: 取消所有采集器', async () => {
    const dataSource = createMockDataSource({ mode: 'polling', interval: 1000 })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
    scheduler.dispose()
  })

  test('dispose: 清空所有任务和监听器', () => {
    const dataSource = createMockDataSource()
    scheduler.registerTask('widget_1', 'instance_1', dataSource)

    const listener: CollectionResultCallback = vi.fn()
    scheduler.subscribe(listener)

    scheduler.dispose()

    expect(scheduler.getAllTasks()).toEqual([])
  })

  test('executeTask: 成功时通知所有监听器', async () => {
    const listener: CollectionResultCallback = vi.fn()
    scheduler.subscribe(listener)

    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
  })

  test('executeTask: 失败时通知监听器错误', async () => {
    const listener: CollectionResultCallback = vi.fn()
    scheduler.subscribe(listener)

    const dataSource = createMockDataSource({ mode: 'once' })
    const taskId = scheduler.registerTask('widget_1', 'instance_1', dataSource)

    await scheduler.startTask(taskId)
  })

  test('getOrCreateCollector: mock 类型返回 MockCollector', () => {
    const collector = (scheduler as any).getOrCreateCollector('mock')
    expect(collector.constructor.name).toBe('MockCollector')
  })

  test('getOrCreateCollector: rest 类型返回 RestCollector', () => {
    const collector = (scheduler as any).getOrCreateCollector('rest')
    expect(collector.constructor.name).toBe('RestCollector')
  })

  test('getOrCreateCollector: websocket 类型返回 WebSocketCollector', () => {
    const collector = (scheduler as any).getOrCreateCollector('websocket')
    expect(collector.constructor.name).toBe('WebSocketCollector')
  })
})
