/**
 * @test_id V9-TEST-ST-006
 * WidgetEngine 单元测试
 *
 * 覆盖场景：
 * 1. 初始化（构造函数 + getStats 初始值）
 * 2. loadComponent（成功/缓存命中/模板不存在/加载失败/空组件/SafeWrapper 防御）
 * 3. mountInstance（成功/实例不存在/加载失败 fallback）
 * 4. unmountInstance（状态更新 + 事件分发）
 * 5. refreshInstance（成功/失败/实例不存在）
 * 6. preloadComponent（已缓存跳过）
 * 7. clearCache（单个/全部）
 *
 * 依赖 mock：
 * - @/lib/logger：抑制日志输出
 * - @/lib/eventBus：捕获 emit 调用
 * - @/cockpit/core/widgetRegistry：mock getTemplate/getInstance/updateRuntimeState
 * - @/cockpit/defaultWidgetBuilder：mock buildFallbackRuntimeState
 *
 * 注意：componentCache 是 module-level Map，必须通过 engine.clearCache() 在 beforeEach/afterEach 中清理
  * @covers_docs []
*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type React from 'react'
import type { WidgetConfig, WidgetRuntimeState } from '@/types/modules/widget.types'

// ============================================================
// vi.hoisted 提升的 mock 函数（在 vi.mock 工厂中使用）
// ============================================================
const {
  mockGetTemplate,
  mockGetInstance,
  mockUpdateRuntimeState,
  mockBuildFallbackRuntimeState,
  mockEmit,
} = vi.hoisted(() => ({
  mockGetTemplate: vi.fn(),
  mockGetInstance: vi.fn(),
  mockUpdateRuntimeState: vi.fn(),
  mockBuildFallbackRuntimeState: vi.fn(),
  mockEmit: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: mockEmit },
}))

vi.mock('@/cockpit/core/widgetRegistry', () => ({
  widgetRegistry: {
    getTemplate: mockGetTemplate,
    getInstance: mockGetInstance,
    updateRuntimeState: mockUpdateRuntimeState,
  },
}))

vi.mock('@/cockpit/defaultWidgetBuilder', () => ({
  defaultWidgetBuilder: {
    buildFallbackRuntimeState: mockBuildFallbackRuntimeState,
  },
}))

import { WidgetEngine } from './widgetEngine'

// ============================================================
// 测试工具函数
// ============================================================

/** 构造一个 mock WidgetConfig */
function createMockWidgetConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    instanceId: 'marketIndices_1',
    widgetId: 'marketIndices',
    size: { cols: 4, rows: 2 },
    position: { x: 0, y: 0 },
    title: '大盘指数',
    settings: {},
    visible: true,
    collapsed: false,
    ...overrides,
  }
}

/**
 * SafeWrapper 的可调用类型签名。
 * 源码 loadComponent 返回 React.ComponentType（= ComponentClass | FunctionComponent 联合），
 * 但实际 SafeWrapper 是函数组件，需要断言为可调用类型才能在测试中直接调用。
 */
type SafeWrapperFn = (props: { config: unknown }) => { type: unknown; props: unknown } | null

/** 构造一个 mock React 组件 */
function createMockComponent(displayName = 'MockComp'): React.ComponentType<{ config: unknown }> {
  const Comp = vi.fn(() => null) as unknown as React.ComponentType<{ config: unknown }>
  Comp.displayName = displayName
  return Comp
}

/** 构造一个 mock WidgetTemplate（含可被追踪的 component loader） */
function createMockTemplate(widgetId: string, Comp: React.ComponentType<{ config: unknown }>) {
  const loader = vi.fn(() => Promise.resolve({ default: Comp }))
  return {
    meta: {
      id: widgetId,
      name: `测试-${widgetId}`,
      category: 'test',
      description: `测试 widget: ${widgetId}`,
      defaultSize: { cols: 1, rows: 1 } as const,
    },
    component: loader,
  }
}

describe('WidgetEngine', () => {
  let engine: WidgetEngine

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 mock 返回值
    mockGetTemplate.mockReturnValue(undefined)
    mockGetInstance.mockReturnValue(undefined)
    mockUpdateRuntimeState.mockReturnValue(true)
    mockBuildFallbackRuntimeState.mockReturnValue({
      instanceId: 'marketIndices_1',
      widgetId: 'marketIndices',
      status: 'error',
      error: 'mock fallback error',
    })
    // 实例化前先清理 module-level componentCache（避免上一个测试残留）
    // 注意：clearCache 是实例方法，需要先有实例。这里通过原型方法直接清空
    // 实际上 widgetEngine 单例已存在，先复用其 clearCache
    engine = new WidgetEngine()
    engine.clearCache()
  })

  afterEach(() => {
    // 清理 module-level cache，避免影响后续测试
    engine.clearCache()
  })

  // ============================================================
  // 初始化
  // ============================================================

  describe('初始化', () => {
    it('构造函数应能正常实例化且初始缓存为 0', () => {
      expect(engine).toBeInstanceOf(WidgetEngine)
      expect(engine.getStats()).toEqual({ cachedComponents: 0 })
    })
  })

  // ============================================================
  // loadComponent
  // ============================================================

  describe('loadComponent', () => {
    it('成功加载组件应返回 SafeWrapper 并 emit WIDGET_LOAD_SUCCESS', async () => {
      const Comp = createMockComponent('MockWidget')
      const template = createMockTemplate('loadSuccess', Comp)
      mockGetTemplate.mockReturnValue(template)

      const result = await engine.loadComponent('loadSuccess')
      expect(result).not.toBeNull()
      // displayName 应被包裹为 Safe(...)
      expect(result?.displayName).toBe('Safe(MockWidget)')
      // 应 emit 成功事件
      expect(mockEmit).toHaveBeenCalledWith('WIDGET_LOAD_SUCCESS', { widgetId: 'loadSuccess' })
      // 缓存应包含 1 个组件
      expect(engine.getStats().cachedComponents).toBe(1)
    })

    it('缓存命中时应直接返回缓存组件且不再调用 component loader', async () => {
      const Comp = createMockComponent('CachedWidget')
      const template = createMockTemplate('cached', Comp)
      mockGetTemplate.mockReturnValue(template)

      const first = await engine.loadComponent('cached')
      const second = await engine.loadComponent('cached')

      expect(first).toBe(second) // 同一引用
      expect(template.component).toHaveBeenCalledTimes(1) // loader 只调用一次
    })

    it('模板不存在时应返回 null 并 emit WIDGET_LOAD_ERROR', async () => {
      mockGetTemplate.mockReturnValue(undefined)

      const result = await engine.loadComponent('notFound')
      expect(result).toBeNull()
      expect(mockEmit).toHaveBeenCalledWith('WIDGET_LOAD_ERROR', {
        widgetId: 'notFound',
        error: 'Template not found',
      })
      // 不应加载任何组件
      expect(engine.getStats().cachedComponents).toBe(0)
    })

    it('组件加载失败时应 emit WIDGET_LOAD_ERROR 并 throw 原始错误', async () => {
      const loadError = new Error('dynamic import failed')
      mockGetTemplate.mockReturnValue({
        meta: {
          id: 'loadFail',
          name: 'm',
          category: 'c',
          description: 'd',
          defaultSize: { cols: 1, rows: 1 },
        },
        component: () => Promise.reject(loadError),
      })

      await expect(engine.loadComponent('loadFail')).rejects.toThrow('dynamic import failed')
      expect(mockEmit).toHaveBeenCalledWith('WIDGET_LOAD_ERROR', {
        widgetId: 'loadFail',
        error: 'dynamic import failed',
      })
      // 失败时不应写入缓存
      expect(engine.getStats().cachedComponents).toBe(0)
    })

    it('组件 default 为空时应 throw 并 emit WIDGET_LOAD_ERROR', async () => {
      mockGetTemplate.mockReturnValue({
        meta: {
          id: 'emptyDefault',
          name: 'm',
          category: 'c',
          description: 'd',
          defaultSize: { cols: 1, rows: 1 },
        },
        component: () =>
          Promise.resolve({
            default: null as unknown as React.ComponentType<{ config: unknown }>,
          }),
      })

      await expect(engine.loadComponent('emptyDefault')).rejects.toThrow(
        'Widget "emptyDefault" component is empty',
      )
      expect(mockEmit).toHaveBeenCalledWith('WIDGET_LOAD_ERROR', {
        widgetId: 'emptyDefault',
        error: 'Widget "emptyDefault" component is empty',
      })
    })

    it('SafeWrapper 收到 null config 时应返回 null（防御性渲染）', async () => {
      const Comp = createMockComponent('SafeTest')
      const template = createMockTemplate('safeNull', Comp)
      mockGetTemplate.mockReturnValue(template)

      const SafeWrapper = await engine.loadComponent('safeNull')
      expect(SafeWrapper).not.toBeNull()

      // config 为 null 时应返回 null，不调用原组件
      const wrapper = SafeWrapper as unknown as SafeWrapperFn
      const element = wrapper({ config: null as unknown })
      expect(element).toBeNull()
      expect(Comp).not.toHaveBeenCalled()
    })

    it('SafeWrapper 收到有效 config 时应通过 React.createElement 渲染原组件', async () => {
      const Comp = createMockComponent('SafeValid')
      const template = createMockTemplate('safeValid', Comp)
      mockGetTemplate.mockReturnValue(template)

      const SafeWrapper = await engine.loadComponent('safeValid')
      const validProps = { config: { title: 'test' } }
      // React.createElement 不立即调用组件，而是返回描述性 React Element
      const wrapper = SafeWrapper as unknown as SafeWrapperFn
      const element = wrapper(validProps)
      expect(element).not.toBeNull()
      expect(element!.type).toBe(Comp)
      // React.createElement 会创建新的 props 对象，使用 toEqual 做深度比较
      expect(element!.props).toEqual(validProps)
    })
  })

  // ============================================================
  // mountInstance
  // ============================================================

  describe('mountInstance', () => {
    it('实例不存在时应返回 false 且不 emit MOUNT_START', async () => {
      mockGetInstance.mockReturnValue(undefined)

      const result = await engine.mountInstance('nonexistent')
      expect(result).toBe(false)
      expect(mockEmit).not.toHaveBeenCalledWith('WIDGET_MOUNT_START', expect.anything())
    })

    it('成功挂载应先 loading 后 ready 并 emit WIDGET_MOUNT_SUCCESS', async () => {
      const config = createMockWidgetConfig()
      mockGetInstance.mockReturnValue(config)
      const Comp = createMockComponent('MountOk')
      mockGetTemplate.mockReturnValue(createMockTemplate('marketIndices', Comp))

      const result = await engine.mountInstance('marketIndices_1')
      expect(result).toBe(true)

      // 应先 loading 再 ready
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith('marketIndices_1', { status: 'loading' })
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith(
        'marketIndices_1',
        expect.objectContaining({ status: 'ready' }),
      )
      // lastRefresh 应为数字时间戳
      const readyCall = mockUpdateRuntimeState.mock.calls.find(
        (call) => (call[1] as Partial<WidgetRuntimeState>).status === 'ready',
      )
      expect((readyCall![1] as Partial<WidgetRuntimeState>).lastRefresh).toEqual(expect.any(Number))

      // 应 emit START 和 SUCCESS
      expect(mockEmit).toHaveBeenCalledWith(
        'WIDGET_MOUNT_START',
        expect.objectContaining({ instanceId: 'marketIndices_1', widgetId: 'marketIndices' }),
      )
      expect(mockEmit).toHaveBeenCalledWith(
        'WIDGET_MOUNT_SUCCESS',
        expect.objectContaining({ instanceId: 'marketIndices_1', widgetId: 'marketIndices' }),
      )
    })

    it('loadComponent 失败时应使用 fallback state 并返回 false', async () => {
      const config = createMockWidgetConfig()
      mockGetInstance.mockReturnValue(config)
      mockGetTemplate.mockReturnValue({
        meta: {
          id: 'marketIndices',
          name: 'm',
          category: 'c',
          description: 'd',
          defaultSize: { cols: 1, rows: 1 },
        },
        component: () => Promise.reject(new Error('mount load failed')),
      })
      const fallbackState: WidgetRuntimeState = {
        instanceId: 'marketIndices_1',
        widgetId: 'marketIndices',
        status: 'error',
        error: 'mount load failed',
      }
      mockBuildFallbackRuntimeState.mockReturnValue(fallbackState)

      const result = await engine.mountInstance('marketIndices_1')
      expect(result).toBe(false)

      // 应调用 buildFallbackRuntimeState
      expect(mockBuildFallbackRuntimeState).toHaveBeenCalledWith(
        'marketIndices_1',
        'marketIndices',
        'mount load failed',
      )
      // 应使用 fallback state 更新运行时状态
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith('marketIndices_1', fallbackState)
      // 应 emit MOUNT_ERROR
      expect(mockEmit).toHaveBeenCalledWith(
        'WIDGET_MOUNT_ERROR',
        expect.objectContaining({
          instanceId: 'marketIndices_1',
          widgetId: 'marketIndices',
          error: 'mount load failed',
        }),
      )
    })
  })

  // ============================================================
  // unmountInstance
  // ============================================================

  describe('unmountInstance', () => {
    it('应更新状态为 idle 并 emit WIDGET_UNMOUNT', () => {
      const config = createMockWidgetConfig()
      mockGetInstance.mockReturnValue(config)

      engine.unmountInstance('marketIndices_1')

      expect(mockUpdateRuntimeState).toHaveBeenCalledWith('marketIndices_1', { status: 'idle' })
      expect(mockEmit).toHaveBeenCalledWith('WIDGET_UNMOUNT', {
        instanceId: 'marketIndices_1',
        widgetId: 'marketIndices',
      })
    })

    it('实例不存在时仍应调用 updateRuntimeState（widgetId 为 undefined）', () => {
      mockGetInstance.mockReturnValue(undefined)

      engine.unmountInstance('nonexistent')

      // updateRuntimeState 仍被调用（源文件不检查 config 是否存在）
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith('nonexistent', { status: 'idle' })
      expect(mockEmit).toHaveBeenCalledWith('WIDGET_UNMOUNT', {
        instanceId: 'nonexistent',
        widgetId: undefined,
      })
    })
  })

  // ============================================================
  // refreshInstance
  // ============================================================

  describe('refreshInstance', () => {
    it('实例不存在时应返回 false', async () => {
      mockGetInstance.mockReturnValue(undefined)
      const result = await engine.refreshInstance('nonexistent')
      expect(result).toBe(false)
    })

    it('成功刷新应更新状态为 ready 并 emit WIDGET_REFRESH_SUCCESS', async () => {
      const config = createMockWidgetConfig()
      mockGetInstance.mockReturnValue(config)
      const Comp = createMockComponent('RefreshOk')
      mockGetTemplate.mockReturnValue(createMockTemplate('marketIndices', Comp))

      const result = await engine.refreshInstance('marketIndices_1')
      expect(result).toBe(true)
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith('marketIndices_1', { status: 'loading' })
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith(
        'marketIndices_1',
        expect.objectContaining({ status: 'ready' }),
      )
      expect(mockEmit).toHaveBeenCalledWith(
        'WIDGET_REFRESH_START',
        expect.objectContaining({ instanceId: 'marketIndices_1', widgetId: 'marketIndices' }),
      )
      expect(mockEmit).toHaveBeenCalledWith(
        'WIDGET_REFRESH_SUCCESS',
        expect.objectContaining({ instanceId: 'marketIndices_1', widgetId: 'marketIndices' }),
      )
    })

    it('刷新失败时应更新状态为 error 并返回 false', async () => {
      const config = createMockWidgetConfig()
      mockGetInstance.mockReturnValue(config)
      mockGetTemplate.mockReturnValue({
        meta: {
          id: 'marketIndices',
          name: 'm',
          category: 'c',
          description: 'd',
          defaultSize: { cols: 1, rows: 1 },
        },
        component: () => Promise.reject(new Error('refresh failed')),
      })

      const result = await engine.refreshInstance('marketIndices_1')
      expect(result).toBe(false)
      expect(mockUpdateRuntimeState).toHaveBeenCalledWith(
        'marketIndices_1',
        expect.objectContaining({ status: 'error', error: 'refresh failed' }),
      )
      expect(mockEmit).toHaveBeenCalledWith(
        'WIDGET_REFRESH_ERROR',
        expect.objectContaining({
          instanceId: 'marketIndices_1',
          widgetId: 'marketIndices',
          error: 'refresh failed',
        }),
      )
      // 失败时不应调用 buildFallbackRuntimeState（refresh 路径不走 fallback）
      expect(mockBuildFallbackRuntimeState).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // preloadComponent
  // ============================================================

  describe('preloadComponent', () => {
    it('已缓存时 preloadComponent 应跳过加载', async () => {
      const Comp = createMockComponent('PreloadSkip')
      const template = createMockTemplate('preloadSkip', Comp)
      mockGetTemplate.mockReturnValue(template)

      // 先正常加载一次
      await engine.loadComponent('preloadSkip')
      expect(template.component).toHaveBeenCalledTimes(1)

      // 预加载应跳过（不再次调用 loader）
      engine.preloadComponent('preloadSkip')
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(template.component).toHaveBeenCalledTimes(1)
    })

    it('未缓存时 preloadComponent 应异步触发加载', async () => {
      const Comp = createMockComponent('PreloadAsync')
      const template = createMockTemplate('preloadAsync', Comp)
      mockGetTemplate.mockReturnValue(template)

      engine.preloadComponent('preloadAsync')
      // 等待异步加载完成
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(template.component).toHaveBeenCalledTimes(1)
      expect(engine.getStats().cachedComponents).toBe(1)
    })
  })

  // ============================================================
  // clearCache
  // ============================================================

  describe('clearCache', () => {
    it('指定 widgetId 时只清除该 widget 缓存', async () => {
      const Comp = createMockComponent('ClearA')
      mockGetTemplate.mockReturnValue(createMockTemplate('clearA', Comp))

      await engine.loadComponent('clearA')
      expect(engine.getStats().cachedComponents).toBe(1)

      engine.clearCache('clearA')
      expect(engine.getStats().cachedComponents).toBe(0)
    })

    it('不传 widgetId 时清空所有缓存', async () => {
      mockGetTemplate.mockImplementation((id: string) =>
        createMockTemplate(id, createMockComponent(`Comp_${id}`)),
      )

      await engine.loadComponent('all1')
      await engine.loadComponent('all2')
      await engine.loadComponent('all3')
      expect(engine.getStats().cachedComponents).toBe(3)

      engine.clearCache()
      expect(engine.getStats().cachedComponents).toBe(0)
    })
  })
})
