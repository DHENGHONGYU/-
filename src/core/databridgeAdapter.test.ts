import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockForward, mockSubscribe, mockEventBusOn, mockLogger } = vi.hoisted(() => ({
  mockForward: vi.fn(),
  mockSubscribe: vi.fn(),
  mockEventBusOn: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    subscribe: mockSubscribe,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// 生产实现 subscribe() 走 eventBus.on（见 databridgeAdapter.ts），故 mock eventBus
vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: mockEventBusOn,
  },
}))

// 在导入前先清除单例状态
vi.hoisted(() => {
  // 用 dynamic import 来控制顺序
})

import {
  DataBridgeAdapter,
  createDataBridgeAdapter,
  getDataBridgeAdapter,
  destroyDataBridgeAdapter,
} from './databridgeAdapter'

describe('DataBridgeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    destroyDataBridgeAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('构造函数', () => {
    it('使用默认配置初始化', () => {
      const adapter = new DataBridgeAdapter()
      const stats = adapter.getStats()

      expect(stats.pendingQueries).toBe(0)
      expect(stats.activeSubscriptions).toBe(0)
      expect(stats.enableFallbackQueue).toBe(true)
    })

    it('接受自定义配置', () => {
      const adapter = new DataBridgeAdapter({
        enableFallbackQueue: false,
        defaultTimeout: 5000,
      })
      const stats = adapter.getStats()

      expect(stats.enableFallbackQueue).toBe(false)
    })
  })

  describe('query()', () => {
    it('成功时返回 success: true 和数据', async () => {
      mockForward.mockResolvedValue(undefined)

      const adapter = new DataBridgeAdapter()
      const result = await adapter.query('FETCH_STOCKS', { key: '1' })

      expect(result.success).toBe(true)
      expect(result.traceId).toBeDefined()
    })

    it('失败时返回 success: false 和错误消息', async () => {
      mockForward.mockRejectedValue(new Error('query failed'))

      const adapter = new DataBridgeAdapter()
      const result = await adapter.query('FETCH_STOCKS', { key: 'bad' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('query failed')
    })

    it('超时时返回 success: false 和超时错误', async () => {
      // forward 不 resolve，让超时触发
      mockForward.mockReturnValue(new Promise(() => {}))

      const adapter = new DataBridgeAdapter({ defaultTimeout: 1000 })
      const resultPromise = adapter.query('FETCH_STOCKS', { key: '1' })

      // 推进时间触发超时
      vi.advanceTimersByTime(1001)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
      expect(result.error).toContain('1000ms')
    })

    it('支持自定义超时时间', async () => {
      mockForward.mockReturnValue(new Promise(() => {}))

      const adapter = new DataBridgeAdapter({ defaultTimeout: 10000 })
      const resultPromise = adapter.query('FETCH_STOCKS', { key: '1' }, { timeout: 500 })

      vi.advanceTimersByTime(501)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error).toContain('500ms')
    })

    it('成功后 pendingQueries 清零', async () => {
      mockForward.mockResolvedValue(undefined)

      const adapter = new DataBridgeAdapter()
      await adapter.query('FETCH_STOCKS', { key: '1' })

      expect(adapter.getStats().pendingQueries).toBe(0)
    })

    it('失败后 pendingQueries 清零', async () => {
      mockForward.mockRejectedValue(new Error('fail'))

      const adapter = new DataBridgeAdapter()
      await adapter.query('FETCH_STOCKS', { key: '1' })

      expect(adapter.getStats().pendingQueries).toBe(0)
    })

    it('超时后 pendingQueries 清零', async () => {
      mockForward.mockReturnValue(new Promise(() => {}))

      const adapter = new DataBridgeAdapter({ defaultTimeout: 100 })
      const resultPromise = adapter.query('FETCH_STOCKS', { key: '1' })

      vi.advanceTimersByTime(101)
      await resultPromise

      expect(adapter.getStats().pendingQueries).toBe(0)
    })

    it('envelope 的 action 正确透传', async () => {
      mockForward.mockResolvedValue(undefined)

      const adapter = new DataBridgeAdapter()
      await adapter.query('FETCH_NEWS', { store: 'stocks' })

      expect(mockForward).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            action: 'FETCH_NEWS',
          }),
        }),
      )
    })

    it('envelope 的 payload 正确透传', async () => {
      mockForward.mockResolvedValue(undefined)
      const payload = { store: 'stocks', key: '123' }

      const adapter = new DataBridgeAdapter()
      await adapter.query('FETCH_STOCKS', payload)

      expect(mockForward).toHaveBeenCalledWith(
        expect.objectContaining({ payload }),
      )
    })

    it('traceId 在结果中返回', async () => {
      mockForward.mockResolvedValue(undefined)

      const adapter = new DataBridgeAdapter()
      const result = await adapter.query('FETCH_STOCKS', {})

      expect(result.traceId).toBeDefined()
      expect(typeof result.traceId).toBe('string')
      expect(result.traceId.length).toBeGreaterThan(0)
    })

    it('多次查询有不同的 traceId', async () => {
      mockForward.mockResolvedValue(undefined)

      const adapter = new DataBridgeAdapter()
      const r1 = await adapter.query('FETCH_STOCKS', {})
      const r2 = await adapter.query('FETCH_STOCKS', {})

      expect(r1.traceId).not.toBe(r2.traceId)
    })
  })

  describe('subscribe()', () => {
    it('调用 dataBridge.subscribe 并返回取消订阅函数', () => {
      const mockUnsub = vi.fn()
      mockEventBusOn.mockReturnValue(mockUnsub)

      const adapter = new DataBridgeAdapter()
      const callback = vi.fn()
      const unsubscribe = adapter.subscribe('stocks', callback)

      expect(mockEventBusOn).toHaveBeenCalledWith('stocks', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('订阅后 activeSubscriptions 计数增加', () => {
      mockEventBusOn.mockReturnValue(vi.fn())

      const adapter = new DataBridgeAdapter()
      adapter.subscribe('stocks', vi.fn())

      expect(adapter.getStats().activeSubscriptions).toBe(1)
    })

    it('取消订阅后计数减少', () => {
      const mockUnsub = vi.fn()
      mockEventBusOn.mockReturnValue(mockUnsub)

      const adapter = new DataBridgeAdapter()
      const unsub = adapter.subscribe('stocks', vi.fn())
      expect(adapter.getStats().activeSubscriptions).toBe(1)

      unsub()
      expect(adapter.getStats().activeSubscriptions).toBe(0)
    })

    it('多个订阅独立管理', () => {
      mockEventBusOn.mockReturnValue(vi.fn())

      const adapter = new DataBridgeAdapter()
      adapter.subscribe('stocks', vi.fn())
      adapter.subscribe('quotes', vi.fn())
      adapter.subscribe('news', vi.fn())

      expect(adapter.getStats().activeSubscriptions).toBe(3)
    })

    it('取消订阅会调用原始 unsubscribe', () => {
      const mockUnsub = vi.fn()
      mockEventBusOn.mockReturnValue(mockUnsub)

      const adapter = new DataBridgeAdapter()
      const unsub = adapter.subscribe('stocks', vi.fn())
      unsub()

      expect(mockUnsub).toHaveBeenCalledTimes(1)
    })

    it('重复取消订阅安全', () => {
      const mockUnsub = vi.fn()
      mockEventBusOn.mockReturnValue(mockUnsub)

      const adapter = new DataBridgeAdapter()
      const unsub = adapter.subscribe('stocks', vi.fn())
      unsub()
      // 第二次取消不应报错，也不应改变计数（已为0）
      unsub()

      expect(adapter.getStats().activeSubscriptions).toBe(0)
    })
  })

  describe('destroySubscriptions()', () => {
    it('清除所有活跃订阅', () => {
      const mockUnsub1 = vi.fn()
      const mockUnsub2 = vi.fn()
      mockEventBusOn.mockReturnValueOnce(mockUnsub1).mockReturnValueOnce(mockUnsub2)

      const adapter = new DataBridgeAdapter()
      adapter.subscribe('stocks', vi.fn())
      adapter.subscribe('quotes', vi.fn())

      adapter.destroySubscriptions()

      expect(mockUnsub1).toHaveBeenCalled()
      expect(mockUnsub2).toHaveBeenCalled()
      expect(adapter.getStats().activeSubscriptions).toBe(0)
    })

    it('无订阅时安全调用', () => {
      const adapter = new DataBridgeAdapter()
      expect(() => adapter.destroySubscriptions()).not.toThrow()
      expect(adapter.getStats().activeSubscriptions).toBe(0)
    })
  })

  describe('getStats()', () => {
    it('返回正确的初始状态', () => {
      const adapter = new DataBridgeAdapter()
      const stats = adapter.getStats()

      expect(stats).toEqual({
        pendingQueries: 0,
        activeSubscriptions: 0,
        enableFallbackQueue: true,
      })
    })

    it('反映实时的订阅数', () => {
      mockEventBusOn.mockReturnValue(vi.fn())

      const adapter = new DataBridgeAdapter()
      adapter.subscribe('a', vi.fn())
      adapter.subscribe('b', vi.fn())

      expect(adapter.getStats().activeSubscriptions).toBe(2)
    })
  })

  describe('单例管理', () => {
    it('createDataBridgeAdapter 创建实例', () => {
      const adapter = createDataBridgeAdapter()
      expect(adapter).toBeInstanceOf(DataBridgeAdapter)
    })

    it('createDataBridgeAdapter 第二次调用返回同一实例', () => {
      const a1 = createDataBridgeAdapter()
      const a2 = createDataBridgeAdapter()
      expect(a1).toBe(a2)
    })

    it('getDataBridgeAdapter 在未初始化时抛出错误', () => {
      destroyDataBridgeAdapter()
      expect(() => getDataBridgeAdapter()).toThrow('not initialized')
    })

    it('getDataBridgeAdapter 在初始化后返回实例', () => {
      createDataBridgeAdapter()
      const adapter = getDataBridgeAdapter()
      expect(adapter).toBeInstanceOf(DataBridgeAdapter)
    })

    it('destroyDataBridgeAdapter 清除实例', () => {
      createDataBridgeAdapter()
      destroyDataBridgeAdapter()
      expect(() => getDataBridgeAdapter()).toThrow()
    })

    it('destroy 后可重新创建', () => {
      const a1 = createDataBridgeAdapter()
      destroyDataBridgeAdapter()
      const a2 = createDataBridgeAdapter()
      expect(a1).not.toBe(a2)
    })
  })
})
