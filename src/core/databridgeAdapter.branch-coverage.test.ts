/**
 * @test_id V9-TEST-BRANCH-DATABRIDGEADAPTER
 * databridgeAdapter 分支覆盖率补充测试
 *
 * 覆盖目标：
 *   1. query() 默认配置（无 options）→ 使用 defaultTimeout
 *   2. query() 成功完成 → resolve success=true
 *   3. query() 超时 → resolve success=false
 *   4. query() 编程错误（TypeError/ReferenceError）→ reject
 *   5. query() 操作错误 → resolve success=false
 *   6. query() 超时后 catch 忽略（entry 已删除）
 *   7. subscribe() + destroySubscriptions()
 *   8. getStats()
 *   9. 单例工厂 createDataBridgeAdapter/getDataBridgeAdapter/destroyDataBridgeAdapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ──────────────────────────────────────────────
// Hoisted mocks（vi.mock 工厂会在文件顶部执行，必须用 vi.hoisted）
// ──────────────────────────────────────────────
const { mockLogger, mockForward, mockEventBusOn } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockForward: vi.fn(),
  mockEventBusOn: vi.fn(() => vi.fn()),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('./databridge', () => ({
  dataBridge: {
    forward: mockForward,
  },
}))

vi.mock('./envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, payload: unknown) => ({ meta, payload })),
  },
  EnvelopeError: class EnvelopeError extends Error {},
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-1'),
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: mockEventBusOn,
  },
}))

// 导入被测模块
import { DataBridgeAdapter, createDataBridgeAdapter, getDataBridgeAdapter, destroyDataBridgeAdapter } from './databridgeAdapter'

describe('databridgeAdapter — 分支覆盖率补充', () => {
  let adapter: DataBridgeAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new DataBridgeAdapter({ defaultTimeout: 100000 })
  })

  afterEach(() => {
    destroyDataBridgeAdapter()
  })

  // ──────────────────────────────────────────
  // query() 成功路径
  // ──────────────────────────────────────────
  describe('query() 成功路径', () => {
    it('forward 成功时应返回 success=true', async () => {
      mockForward.mockResolvedValueOnce(undefined)

      const result = await adapter.query('FETCH_STOCKS', { store: 'stocks' })

      expect(result.success).toBe(true)
      expect(result.traceId).toBeDefined()
    })

    it('无 options 时应使用 defaultTimeout', async () => {
      mockForward.mockResolvedValueOnce(undefined)

      const result = await adapter.query('FETCH_STOCKS', { store: 'stocks' })

      expect(result.success).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('query() action="FETCH_STOCKS"'),
      )
    })

    // 覆盖 L41: payload 默认参数分支（default-arg）
    // 当调用 query 时不传 payload，应回落到默认值 {}
    it('不传 payload 时应使用默认值 {}（L41 默认参数分支）', async () => {
      mockForward.mockResolvedValueOnce(undefined)

      // 仅传 action，不传 payload 参数
      const result = await adapter.query('FETCH_STOCKS')

      expect(result.success).toBe(true)
      expect(result.traceId).toBeDefined()
      // 验证 forward 被调用，且 envelope.payload 为空对象
      expect(mockForward).toHaveBeenCalledTimes(1)
      const envelopeArg = mockForward.mock.calls[0]![0]
      expect(envelopeArg.payload).toEqual({})
    })

    // 覆盖 L45: ?? 10000 最终兜底分支（binary-expr 第 3 location）
    // 当 options.timeout 为 undefined 且 config.defaultTimeout 也为 undefined 时，应回落到 10000
    it('config.defaultTimeout 为 undefined 时应回落到 10000ms 兜底（L45 最终兜底分支）', async () => {
      // 显式传入 defaultTimeout: undefined，对象展开会覆盖构造函数默认的 10000
      const adapterNoTimeout = new DataBridgeAdapter({ defaultTimeout: undefined })
      mockForward.mockResolvedValueOnce(undefined)

      // 不传 options.timeout，让 options.timeout 为 undefined
      const result = await adapterNoTimeout.query('FETCH_STOCKS', { store: 'stocks' })

      expect(result.success).toBe(true)
      // 验证 adapter 实例创建成功（defaultTimeout 已被覆盖为 undefined，回落到 10000）
      expect(adapterNoTimeout.getStats().enableFallbackQueue).toBe(true)
    })
  })

  // ──────────────────────────────────────────
  // query() 超时路径
  // ──────────────────────────────────────────
  describe('query() 超时', () => {
    it('超时应返回 success=false', async () => {
      // forward 不 resolve，模拟超时
      mockForward.mockReturnValueOnce(new Promise(() => {}))

      const result = await adapter.query('FETCH_STOCKS', { store: 'stocks' }, { timeout: 50 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Query timeout'),
      )
    })

    it('超时后 forward 拒绝时应忽略已处理的 entry（竞态条件 L101-102）', async () => {
      // 创建可控的 promise：延迟 reject
      let rejectFn!: (reason?: unknown) => void
      const controllablePromise = new Promise((_, reject) => {
        rejectFn = reject
      })
      mockForward.mockReturnValueOnce(controllablePromise)

      // 设置短超时
      const queryPromise = adapter.query('FETCH_STOCKS', { store: 'stocks' }, { timeout: 50 })

      // 等待超时触发（entry 从 pendingQueries 中删除）
      const result = await queryPromise
      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')

      // 超时后 entry 已被删除，现在手动触发 forward reject
      rejectFn(new Error('late rejection'))

      // 等待 .catch() 微任务执行
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 验证 warn 日志被调用：entry 已不存在，忽略错误
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Query already settled, ignoring error'),
      )
    })

    it('超时后 forward 成功时应跳过 resolve（竞态条件 L94 可选链）', async () => {
      // 创建可控的 promise：延迟 resolve
      let resolveFn!: (value?: unknown) => void
      const controllablePromise = new Promise((resolve) => {
        resolveFn = resolve
      })
      mockForward.mockReturnValueOnce(controllablePromise)

      // 设置短超时
      const queryPromise = adapter.query('FETCH_STOCKS', { store: 'stocks' }, { timeout: 50 })

      // 等待超时触发
      const result = await queryPromise
      expect(result.success).toBe(false)

      // 超时后 entry 已被删除，现在手动触发 forward resolve
      resolveFn(undefined)

      // 等待 .then() 微任务执行
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 验证 debug 日志记录了 forward 完成
      // 但 this.pendingQueries.get(traceId)?.resolve(result) 跳过（entry 已删除）
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Query forwarded'),
      )
    })
  })

  // ──────────────────────────────────────────
  // query() 编程错误 → reject
  // ──────────────────────────────────────────
  describe('query() 编程错误', () => {
    it('TypeError 应 reject 而非 resolve', async () => {
      const typeError = new TypeError('Cannot read property of undefined')
      mockForward.mockRejectedValueOnce(typeError)

      await expect(adapter.query('FETCH_STOCKS', { store: 'stocks' })).rejects.toThrow(TypeError)
    })

    it('ReferenceError 应 reject', async () => {
      const refError = new ReferenceError('x is not defined')
      mockForward.mockRejectedValueOnce(refError)

      await expect(adapter.query('FETCH_STOCKS', { store: 'stocks' })).rejects.toThrow(ReferenceError)
    })

    it('SyntaxError 应 reject', async () => {
      const syntaxError = new SyntaxError('Unexpected token')
      mockForward.mockRejectedValueOnce(syntaxError)

      await expect(adapter.query('FETCH_STOCKS', { store: 'stocks' })).rejects.toThrow(SyntaxError)
    })

    it('RangeError 应 reject', async () => {
      const rangeError = new RangeError('Invalid array length')
      mockForward.mockRejectedValueOnce(rangeError)

      await expect(adapter.query('FETCH_STOCKS', { store: 'stocks' })).rejects.toThrow(RangeError)
    })
  })

  // ──────────────────────────────────────────
  // query() 操作错误 → resolve success=false
  // ──────────────────────────────────────────
  describe('query() 操作错误', () => {
    it('普通 Error 应 resolve 为 success=false', async () => {
      const opError = new Error('Database connection failed')
      mockForward.mockRejectedValueOnce(opError)

      const result = await adapter.query('FETCH_STOCKS', { store: 'stocks' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })
  })

  // ──────────────────────────────────────────
  // subscribe() + destroySubscriptions()
  // ──────────────────────────────────────────
  describe('subscribe() 与 destroySubscriptions()', () => {
    it('subscribe 应返回取消订阅函数', () => {
      const callback = vi.fn()
      const unsub = adapter.subscribe('stocks', callback)

      expect(typeof unsub).toBe('function')
      expect(mockEventBusOn).toHaveBeenCalledWith('stocks', callback)
      expect(adapter.getStats().activeSubscriptions).toBe(1)
    })

    it('取消订阅应从 activeSubscriptions 移除', () => {
      const callback = vi.fn()
      const unsub = adapter.subscribe('stocks', callback)

      expect(adapter.getStats().activeSubscriptions).toBe(1)

      unsub()

      expect(adapter.getStats().activeSubscriptions).toBe(0)
    })

    it('destroySubscriptions 应清理所有订阅', () => {
      adapter.subscribe('ch1', vi.fn())
      adapter.subscribe('ch2', vi.fn())
      adapter.subscribe('ch3', vi.fn())

      expect(adapter.getStats().activeSubscriptions).toBe(3)

      adapter.destroySubscriptions()

      expect(adapter.getStats().activeSubscriptions).toBe(0)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('All subscriptions cleaned up'),
      )
    })
  })

  // ──────────────────────────────────────────
  // getStats()
  // ──────────────────────────────────────────
  describe('getStats()', () => {
    it('应返回正确的统计信息', () => {
      const stats = adapter.getStats()

      expect(stats).toEqual({
        pendingQueries: 0,
        activeSubscriptions: 0,
        enableFallbackQueue: true,
      })
    })

    it('有 pending query 时应反映在 stats 中', () => {
      mockForward.mockReturnValueOnce(new Promise(() => {}))

      // 不 await，让 query 保持 pending
      adapter.query('FETCH_STOCKS', { store: 'stocks' }, { timeout: 100000 })

      expect(adapter.getStats().pendingQueries).toBe(1)
    })
  })

  // ──────────────────────────────────────────
  // 单例工厂函数
  // ──────────────────────────────────────────
  describe('单例工厂', () => {
    it('createDataBridgeAdapter 应返回单例', () => {
      const a1 = createDataBridgeAdapter()
      const a2 = createDataBridgeAdapter()

      expect(a1).toBe(a2)
    })

    it('getDataBridgeAdapter 未初始化时应抛出', () => {
      destroyDataBridgeAdapter()

      expect(() => getDataBridgeAdapter()).toThrow('not initialized')
    })

    it('getDataBridgeAdapter 初始化后应返回实例', () => {
      const created = createDataBridgeAdapter()
      const got = getDataBridgeAdapter()

      expect(got).toBe(created)
    })

    it('destroyDataBridgeAdapter 应清理并重置单例', () => {
      const adapter = createDataBridgeAdapter()
      adapter.subscribe('ch', vi.fn())

      destroyDataBridgeAdapter()

      expect(() => getDataBridgeAdapter()).toThrow('not initialized')
    })
  })

  // ──────────────────────────────────────────
  // 构造函数默认配置
  // ──────────────────────────────────────────
  describe('构造函数默认配置', () => {
    it('无 config 时应使用默认值', () => {
      const adapter = new DataBridgeAdapter()

      const stats = adapter.getStats()

      expect(stats.enableFallbackQueue).toBe(true)
    })

    it('传入 config 时应覆盖默认值', () => {
      const adapter = new DataBridgeAdapter({ enableFallbackQueue: false, defaultTimeout: 5000 })

      const stats = adapter.getStats()

      expect(stats.enableFallbackQueue).toBe(false)
    })
  })
})
