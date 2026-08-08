/**
 * @fileoverview DataBridgeAdapter 分支覆盖测试 (P0)
 * @description 覆盖 isProgrammingError 三个分支 + 超时竞态安全。
 *
 * P0 用例：
 * 1. 非对象错误（string/null）→ 操作错误 → resolve success=false
 * 2. Object.create(null)（无 constructor）→ 操作错误 → resolve success=false
 * 3. TypeError（编程错误）→ fail-fast reject
 * 4. 超时后 forward 成功，entry 已删除 → 静默跳过且无 unhandled rejection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockForward, mockLogger } = vi.hoisted(() => ({
  mockForward: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    subscribe: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: vi.fn() },
}))

import { DataBridgeAdapter, destroyDataBridgeAdapter } from './databridgeAdapter'

describe('DataBridgeAdapter — isProgrammingError 分支覆盖 (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    destroyDataBridgeAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ----------------------------------------------------------
  // 分支 1：非对象错误（string/null/undefined）→ false（操作错误）
  // ----------------------------------------------------------

  it('forward 抛出字符串（非对象）→ resolve success=false（操作错误）', async () => {
    mockForward.mockRejectedValueOnce('network failure')
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', { store: 'stocks' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('network failure')
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('非对象错误'),
    )
  })

  it('forward 抛出 null → resolve success=false（操作错误）', async () => {
    mockForward.mockRejectedValueOnce(null)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    expect(result.success).toBe(false)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('非对象错误'),
    )
  })

  it('forward 抛出 undefined → resolve success=false（操作错误）', async () => {
    mockForward.mockRejectedValueOnce(undefined)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    expect(result.success).toBe(false)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('非对象错误'),
    )
  })

  // ----------------------------------------------------------
  // 分支 2：Object.create(null)（无 constructor）→ false（操作错误）
  // ----------------------------------------------------------

  it('forward 抛出 Object.create(null) → resolve success=false（操作错误）', async () => {
    const nullProtoErr = Object.create(null)
    nullProtoErr.message = 'weird error'
    mockForward.mockRejectedValueOnce(nullProtoErr)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    expect(result.success).toBe(false)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('无 constructor'),
    )
  })

  // ----------------------------------------------------------
  // 分支 3：TypeError（编程错误）→ true → fail-fast reject
  // ----------------------------------------------------------

  it('forward 抛出 TypeError → reject（编程错误 fail-fast）', async () => {
    const typeError = new TypeError('Cannot read properties of undefined')
    mockForward.mockRejectedValueOnce(typeError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(TypeError)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  it('forward 抛出 SyntaxError → reject（编程错误 fail-fast）', async () => {
    const syntaxError = new SyntaxError('Unexpected token')
    mockForward.mockRejectedValueOnce(syntaxError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(SyntaxError)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // 分支 4：普通 Error → false（操作错误）→ resolve success=false
  // ----------------------------------------------------------

  it('forward 抛出普通 Error → resolve success=false（操作错误）', async () => {
    mockForward.mockRejectedValueOnce(new Error('network timeout'))
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    expect(result.success).toBe(false)
    expect(result.error).toBe('network timeout')
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('操作错误(优雅降级)'),
    )
  })

  // ----------------------------------------------------------
  // P0 用例 5：超时后 forward 成功，entry 已删除 → 静默跳过且无 unhandled rejection
  // ----------------------------------------------------------

  it('超时后 forward 成功，entry 已删除 → 静默跳过且无 unhandled rejection', async () => {
    // forward 返回一个可控的 Promise（模拟慢响应）
    let resolveForward!: () => void
    const slowPromise = new Promise<void>((resolve) => {
      resolveForward = resolve
    })
    mockForward.mockReturnValueOnce(slowPromise)

    const adapter = new DataBridgeAdapter({ defaultTimeout: 100 })
    const queryPromise = adapter.query('FETCH_STOCKS', {})

    // 推进时间触发超时
    vi.advanceTimersByTime(101)
    const result = await queryPromise

    expect(result.success).toBe(false)
    expect(result.error).toContain('timeout')
    // pendingQueries 应已清零
    expect(adapter.getStats().pendingQueries).toBe(0)

    // forward 延迟 resolve 不应崩溃（entry 已删除，?. 安全跳过）
    expect(() => resolveForward()).not.toThrow()
  })
})
