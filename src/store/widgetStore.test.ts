/**
 * widgetStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. addInstance 添加 widget 配置
 * 3. removeInstance 删除实例和运行时状态
 * 4. updateInstance 更新存在的实例
 * 5. updateInstance 不存在的实例无效果
 * 6. updateRuntimeState 更新运行时状态
 * 7. refreshStats 刷新统计
 * 8. initWidgetSubscriptions 响应 WIDGET_MOUNT_SUCCESS
 * 9. initWidgetSubscriptions 响应 WIDGET_UNMOUNT
 * 10. initWidgetSubscriptions 响应 WIDGET_REFRESH_SUCCESS
 * 11. initWidgetSubscriptions 响应 WIDGET_MOUNT_ERROR
 * 12. initWidgetSubscriptions 实例不存在时不添加
 * 13. destroyWidgetSubscriptions 清理所有订阅
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockOn, capturedCallbacks, allUnsubscribers, mockGetStats, mockGetInstance } = vi.hoisted(() => {
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
    templates: 18,
    instances: 14,
    states: [],
  })

  const mockGetInstance = vi.fn().mockReturnValue(undefined)

  return { mockOn, capturedCallbacks, allUnsubscribers, mockGetStats, mockGetInstance }
})

vi.mock('@/cockpit/core/widgetRegistry', () => ({
  widgetRegistry: {
    getStats: mockGetStats,
    getInstance: mockGetInstance,
  },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: mockOn },
}))

import { useWidgetStore, initWidgetSubscriptions, destroyWidgetSubscriptions } from './widgetStore'
import type { WidgetConfig, WidgetRuntimeState } from '@/types/modules/widget.types'

function createMockWidgetConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    instanceId: 'marketIndices_1',
    widgetId: 'marketIndices',
    size: { cols: 12, rows: 2 },
    position: { x: 0, y: 0 },
    title: '大盘指数',
    settings: {},
    visible: true,
    collapsed: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  allUnsubscribers.length = 0
  mockGetStats.mockReturnValue({
    templates: 18,
    instances: 14,
    states: [],
  })
  mockGetInstance.mockReturnValue(undefined)

  // 重置 store（源文件末尾自动调用 initWidgetSubscriptions）
  useWidgetStore.setState({
    instances: new Map(),
    runtimeStates: new Map(),
    stats: mockGetStats(),
  })
})

describe('widgetStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================

  it('初始状态正确', () => {
    const state = useWidgetStore.getState()
    expect(state.instances).toBeInstanceOf(Map)
    expect(state.instances.size).toBe(0)
    expect(state.runtimeStates).toBeInstanceOf(Map)
    expect(state.runtimeStates.size).toBe(0)
    expect(state.stats).toEqual({
      templates: 18,
      instances: 14,
      states: [],
    })
  })

  // ============================================================
  // addInstance
  // ============================================================

  it('addInstance 添加 widget 配置', () => {
    const config = createMockWidgetConfig()
    const store = useWidgetStore.getState()
    store.addInstance(config)

    const state = useWidgetStore.getState()
    expect(state.instances.size).toBe(1)
    expect(state.instances.get('marketIndices_1')).toEqual(config)
  })

  it('addInstance 支持添加多个实例', () => {
    const config1 = createMockWidgetConfig({ instanceId: 'marketIndices_1' })
    const config2 = createMockWidgetConfig({
      instanceId: 'sectorHeatmap_1',
      widgetId: 'sectorHeatmap',
      title: '板块热力图',
    })
    const store = useWidgetStore.getState()
    store.addInstance(config1)
    store.addInstance(config2)

    expect(useWidgetStore.getState().instances.size).toBe(2)
  })

  // ============================================================
  // removeInstance
  // ============================================================

  it('removeInstance 删除实例和运行时状态', () => {
    const config = createMockWidgetConfig()
    useWidgetStore.setState({
      instances: new Map([[config.instanceId, config]]),
      runtimeStates: new Map([[config.instanceId, {
        instanceId: config.instanceId,
        widgetId: config.widgetId,
        status: 'ready',
      } as WidgetRuntimeState]]),
    })

    const store = useWidgetStore.getState()
    store.removeInstance('marketIndices_1')

    const state = useWidgetStore.getState()
    expect(state.instances.size).toBe(0)
    expect(state.runtimeStates.size).toBe(0)
  })

  it('removeInstance 删除不存在的实例不报错', () => {
    const store = useWidgetStore.getState()
    expect(() => store.removeInstance('nonexistent')).not.toThrow()
    expect(useWidgetStore.getState().instances.size).toBe(0)
  })

  // ============================================================
  // updateInstance
  // ============================================================

  it('updateInstance 更新存在的实例', () => {
    const config = createMockWidgetConfig()
    useWidgetStore.setState({
      instances: new Map([[config.instanceId, config]]),
    })

    const store = useWidgetStore.getState()
    store.updateInstance('marketIndices_1', { title: '更新标题', visible: false })

    const updated = useWidgetStore.getState().instances.get('marketIndices_1')!
    expect(updated.title).toBe('更新标题')
    expect(updated.visible).toBe(false)
    // 其他属性不变
    expect(updated.widgetId).toBe('marketIndices')
    expect(updated.size).toEqual({ cols: 12, rows: 2 })
  })

  it('updateInstance 不存在的实例无效果', () => {
    const config = createMockWidgetConfig()
    useWidgetStore.setState({
      instances: new Map([[config.instanceId, config]]),
    })

    const store = useWidgetStore.getState()
    store.updateInstance('nonexistent', { title: '无效更新' })

    // 原实例不受影响
    const unchanged = useWidgetStore.getState().instances.get('marketIndices_1')!
    expect(unchanged.title).toBe('大盘指数')
  })

  // ============================================================
  // updateRuntimeState
  // ============================================================

  it('updateRuntimeState 更新运行时状态', () => {
    useWidgetStore.setState({
      runtimeStates: new Map([['marketIndices_1', {
        instanceId: 'marketIndices_1',
        widgetId: 'marketIndices',
        status: 'idle',
      } as WidgetRuntimeState]]),
    })

    const store = useWidgetStore.getState()
    store.updateRuntimeState('marketIndices_1', { status: 'ready', lastRefresh: Date.now() })

    const rtState = useWidgetStore.getState().runtimeStates.get('marketIndices_1')!
    expect(rtState.status).toBe('ready')
    expect(rtState.lastRefresh).toBeDefined()
    expect(rtState.widgetId).toBe('marketIndices') // 保留原有属性
  })

  it('updateRuntimeState 为新实例创建运行时状态', () => {
    const store = useWidgetStore.getState()
    store.updateRuntimeState('newWidget_1', { status: 'loading' })

    const rtState = useWidgetStore.getState().runtimeStates.get('newWidget_1')!
    expect(rtState).toBeDefined()
    expect(rtState.instanceId).toBe('newWidget_1')
    expect(rtState.status).toBe('loading')
  })

  // ============================================================
  // refreshStats
  // ============================================================

  it('refreshStats 调用 widgetRegistry.getStats 并更新状态', () => {
    const newStats = {
      templates: 20,
      instances: 16,
      states: [{ instanceId: 'marketIndices_1', status: 'ready' }],
    }
    mockGetStats.mockReturnValue(newStats)
    mockGetStats.mockClear() // 清除 beforeEach 中的调用记录

    const store = useWidgetStore.getState()
    store.refreshStats()

    expect(mockGetStats).toHaveBeenCalledTimes(1)
    expect(useWidgetStore.getState().stats).toEqual(newStats)
  })

  // ============================================================
  // initWidgetSubscriptions - WIDGET_MOUNT_SUCCESS
  // ============================================================

  it('initWidgetSubscriptions 订阅 WIDGET_MOUNT_SUCCESS 事件，添加实例并更新运行时状态', () => {
    const config = createMockWidgetConfig()
    mockGetInstance.mockReturnValueOnce(config)

    initWidgetSubscriptions()
    const callback = capturedCallbacks.get('WIDGET_MOUNT_SUCCESS')
    expect(callback).toBeDefined()

    callback!({ instanceId: 'marketIndices_1' })

    expect(useWidgetStore.getState().instances.get('marketIndices_1')).toEqual(config)

    const rtState = useWidgetStore.getState().runtimeStates.get('marketIndices_1')!
    expect(rtState.status).toBe('ready')
    expect(rtState.lastRefresh).toBeDefined()
    expect(mockGetStats).toHaveBeenCalled()
  })

  it('initWidgetSubscriptions WIDGET_MOUNT_SUCCESS 实例不存在时不添加', () => {
    mockGetInstance.mockReturnValueOnce(undefined)

    initWidgetSubscriptions()
    const callback = capturedCallbacks.get('WIDGET_MOUNT_SUCCESS')
    callback!({ instanceId: 'nonexistent' })

    expect(useWidgetStore.getState().instances.size).toBe(0)
    // 仍然刷新统计
    expect(mockGetStats).toHaveBeenCalled()
  })

  // ============================================================
  // initWidgetSubscriptions - WIDGET_UNMOUNT
  // ============================================================

  it('initWidgetSubscriptions 订阅 WIDGET_UNMOUNT 事件，移除实例', () => {
    const config = createMockWidgetConfig()
    useWidgetStore.setState({
      instances: new Map([[config.instanceId, config]]),
      runtimeStates: new Map([[config.instanceId, {
        instanceId: config.instanceId,
        widgetId: config.widgetId,
        status: 'ready',
      } as WidgetRuntimeState]]),
    })

    initWidgetSubscriptions()
    const callback = capturedCallbacks.get('WIDGET_UNMOUNT')
    expect(callback).toBeDefined()

    callback!({ instanceId: 'marketIndices_1' })

    expect(useWidgetStore.getState().instances.size).toBe(0)
    expect(useWidgetStore.getState().runtimeStates.size).toBe(0)
    expect(mockGetStats).toHaveBeenCalled()
  })

  // ============================================================
  // initWidgetSubscriptions - WIDGET_REFRESH_SUCCESS
  // ============================================================

  it('initWidgetSubscriptions 订阅 WIDGET_REFRESH_SUCCESS 事件，更新运行时状态', () => {
    useWidgetStore.setState({
      runtimeStates: new Map([['marketIndices_1', {
        instanceId: 'marketIndices_1',
        widgetId: 'marketIndices',
        status: 'loading',
      } as WidgetRuntimeState]]),
    })

    initWidgetSubscriptions()
    const callback = capturedCallbacks.get('WIDGET_REFRESH_SUCCESS')
    expect(callback).toBeDefined()

    callback!({ instanceId: 'marketIndices_1' })

    const rtState = useWidgetStore.getState().runtimeStates.get('marketIndices_1')!
    expect(rtState.status).toBe('ready')
    expect(rtState.lastRefresh).toBeDefined()
  })

  // ============================================================
  // initWidgetSubscriptions - WIDGET_MOUNT_ERROR
  // ============================================================

  it('initWidgetSubscriptions 订阅 WIDGET_MOUNT_ERROR 事件，设置错误状态', () => {
    useWidgetStore.setState({
      runtimeStates: new Map([['marketIndices_1', {
        instanceId: 'marketIndices_1',
        widgetId: 'marketIndices',
        status: 'loading',
      } as WidgetRuntimeState]]),
    })

    initWidgetSubscriptions()
    const callback = capturedCallbacks.get('WIDGET_MOUNT_ERROR')
    expect(callback).toBeDefined()

    callback!({ instanceId: 'marketIndices_1', error: '组件加载失败' })

    const rtState = useWidgetStore.getState().runtimeStates.get('marketIndices_1')!
    expect(rtState.status).toBe('error')
    expect(rtState.error).toBe('组件加载失败')
  })

  // ============================================================
  // destroyWidgetSubscriptions
  // ============================================================

  it('destroyWidgetSubscriptions 调用所有 unsubscribe 函数', () => {
    initWidgetSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(4) // MOUNT_SUCCESS, UNMOUNT, REFRESH_SUCCESS, MOUNT_ERROR
    expect(allUnsubscribers).toHaveLength(4)

    destroyWidgetSubscriptions()

    allUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // initWidgetSubscriptions 返回清理函数
  // ============================================================

  it('initWidgetSubscriptions 返回的清理函数正确工作', () => {
    const cleanup = initWidgetSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(4)

    cleanup()

    allUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // 重复调用 initWidgetSubscriptions 先清理旧订阅
  // ============================================================

  it('initWidgetSubscriptions 重复调用时先清理旧订阅', () => {
    initWidgetSubscriptions()
    const firstUnsubscribers = [...allUnsubscribers]

    initWidgetSubscriptions()

    firstUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
    expect(mockOn).toHaveBeenCalledTimes(8)
  })
})
