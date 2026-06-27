/**
 * 验证 newsStore 的 DataBridge 订阅清理逻辑
 *
 * 覆盖场景：
 * 1. initNewsStoreSubscriptions 正确调用 dataBridge.subscribe
 * 2. 返回的 cleanup 函数正确取消订阅
 * 3. 重复调用 init 不会创建重复订阅（幂等性）
 * 4. cleanup 后重新 init 可以重新订阅
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// 必须在 import newsStore 之前 mock，否则模块级副作用会先执行
const mockUnsubscribe = vi.fn()
const mockSubscribe = vi.fn().mockReturnValue(mockUnsubscribe)

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    subscribe: mockSubscribe,
    forward: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// 每次测试前重置 mock 状态，并重新导入模块以重置 _unsubscribeNews
beforeEach(async () => {
  vi.clearAllMocks()
  // 通过 vitest 的模块热重载机制重置模块内部状态
  vi.resetModules()
})

describe('newsStore — DataBridge 订阅清理逻辑', () => {
  it('场景 1：initNewsStoreSubscriptions 应调用 dataBridge.subscribe 并返回 cleanup 函数', async () => {
    const { initNewsStoreSubscriptions } = await import('@/store/newsStore')

    const cleanup = initNewsStoreSubscriptions()

    // 验证 subscribe 被调用了一次，channel 为 'news'
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledWith('news', expect.any(Function))
    // 验证返回 cleanup 是函数
    expect(typeof cleanup).toBe('function')
  })

  it('场景 2：调用 cleanup 应取消订阅，且 repeated cleanup 不报错', async () => {
    const { initNewsStoreSubscriptions } = await import('@/store/newsStore')

    const cleanup = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    // 第一次 cleanup
    cleanup()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)

    // 第二次 cleanup（幂等，不应再调用 unsubscribe）
    cleanup()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1) // 仍是 1 次
  })

  it('场景 3：重复调用 init 不应创建重复订阅（幂等性）', async () => {
    const { initNewsStoreSubscriptions } = await import('@/store/newsStore')

    // 第一次 init
    const cleanup1 = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    // 第二次 init（应跳过，不重复调用 subscribe）
    const cleanup2 = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1) // 仍是 1 次，未重复订阅

    // 验证两个 cleanup 都能正确取消订阅（行为等价，引用可以不同）
    cleanup1()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)

    // 第二次 cleanup 不可再调用 unsubscribe（因为 cleanup1 已将 _unsubscribeNews 置 null）
    // 但调用 cleanup2 应安全（不抛出异常）
    expect(() => cleanup2()).not.toThrow()
  })

  it('场景 4：cleanup 后重新 init 应能重新订阅', async () => {
    const { initNewsStoreSubscriptions } = await import('@/store/newsStore')

    // 第一轮：init → cleanup
    const cleanup1 = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    cleanup1()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)

    // 重置 mock 计数以便观察第二轮
    mockSubscribe.mockClear()
    mockUnsubscribe.mockClear()

    // 第二轮：re-init（应重新调用 subscribe）
    const cleanup2 = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1) // 重新订阅

    cleanup2()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('场景 5：模拟 React 组件 mount/unmount 生命周期', async () => {
    const { initNewsStoreSubscriptions } = await import('@/store/newsStore')

    // 模拟 mount
    const cleanup = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    // 模拟 unmount（useEffect cleanup）
    cleanup()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)

    // 二次 mount
    const cleanup2 = initNewsStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(2) // 重新订阅（因为之前已 cleanup）

    // 二次 unmount
    cleanup2()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
  })
})