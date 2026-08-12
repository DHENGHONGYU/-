/**
 * @fileoverview DataBridgeAdapter 分支覆盖测试 (P0 + P1)
 * @description 覆盖 isProgrammingError 所有分支 + 超时竞态安全 + 子类原型链边界。
 *
 * P0 用例：
 * 1. 非对象错误（string/null/undefined）→ 操作错误 → resolve success=false
 * 2. Object.create(null)（无 constructor）→ 操作错误 → resolve success=false
 * 3. TypeError/SyntaxError（编程错误）→ fail-fast reject
 * 4. 超时后 forward 成功，entry 已删除 → 静默跳过且无 unhandled rejection
 *
 * P1 用例：
 * 5. 自定义子类 extends TypeError → true（编程错误 fail-fast）
 * 6. EvalError/URIError → true（编程错误 fail-fast）
 * 7. ReferenceError/RangeError → true（编程错误 fail-fast）
 * 8. 自定义子类 extends SyntaxError → true（验证 instanceof 对非 TypeError 子类生效）
 * 9. 自定义子类 extends Error（非编程错误）→ false（假阳性边界：不应误判为编程错误）
 * 10. 多层继承孙类 extends CustomTypeError extends TypeError → true（原型链深度遍历）
 *
 * 极端边界用例（原型链篡改与 constructor 覆写）：
 * 11. constructor 被覆写为 Error 但原型链不变 → instanceof 回退匹配 → true
 * 12. TypeError 原型链被 setPrototypeOf 篡改为 Error.prototype → instanceof 失败 → false
 * 13. Object.create(TypeError.prototype) 伪造 TypeError → constructor + instanceof 均匹配 → true
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

// ============================================================
// 调试日志辅助 — 在关键分支点输出测试上下文，便于排查失败
// ============================================================
function debugLog(branch: string, context: Record<string, unknown>): void {
  console.log(`[test-debug] ${branch}`, context)
}

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
    debugLog('分支1-字符串', { errorType: 'string', errorValue: 'network failure' })
    mockForward.mockRejectedValueOnce('network failure')
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', { store: 'stocks' })

    debugLog('分支1-字符串 结果', { success: result.success, error: result.error })
    expect(result.success).toBe(false)
    expect(result.error).toBe('network failure')
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('非对象错误'),
    )
  })

  it('forward 抛出 null → resolve success=false（操作错误）', async () => {
    debugLog('分支1-null', { errorType: 'null' })
    mockForward.mockRejectedValueOnce(null)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    debugLog('分支1-null 结果', { success: result.success })
    expect(result.success).toBe(false)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('非对象错误'),
    )
  })

  it('forward 抛出 undefined → resolve success=false（操作错误）', async () => {
    debugLog('分支1-undefined', { errorType: 'undefined' })
    mockForward.mockRejectedValueOnce(undefined)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    debugLog('分支1-undefined 结果', { success: result.success })
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
    debugLog('分支2-无constructor', { errorType: 'Object.create(null)', hasConstructor: false })
    mockForward.mockRejectedValueOnce(nullProtoErr)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    debugLog('分支2-无constructor 结果', { success: result.success })
    expect(result.success).toBe(false)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('无 constructor'),
    )
  })

  // ----------------------------------------------------------
  // 分支 3：TypeError/SyntaxError（编程错误）→ true → fail-fast reject
  // ----------------------------------------------------------

  it('forward 抛出 TypeError → reject（编程错误 fail-fast）', async () => {
    const typeError = new TypeError('Cannot read properties of undefined')
    debugLog('分支3-TypeError', { errorType: 'TypeError', constructor: typeError.constructor.name })
    mockForward.mockRejectedValueOnce(typeError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(TypeError)
    debugLog('分支3-TypeError 结果', { rejected: true, errorType: 'TypeError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  it('forward 抛出 SyntaxError → reject（编程错误 fail-fast）', async () => {
    const syntaxError = new SyntaxError('Unexpected token')
    debugLog('分支3-SyntaxError', { errorType: 'SyntaxError', constructor: syntaxError.constructor.name })
    mockForward.mockRejectedValueOnce(syntaxError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(SyntaxError)
    debugLog('分支3-SyntaxError 结果', { rejected: true, errorType: 'SyntaxError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // 分支 4：普通 Error → false（操作错误）→ resolve success=false
  // ----------------------------------------------------------

  it('forward 抛出普通 Error → resolve success=false（操作错误）', async () => {
    const err = new Error('network timeout')
    debugLog('分支4-普通Error', { errorType: 'Error', constructor: err.constructor.name })
    mockForward.mockRejectedValueOnce(err)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    debugLog('分支4-普通Error 结果', { success: result.success, error: result.error })
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
    let resolveForward!: () => void
    const slowPromise = new Promise<void>((resolve) => {
      resolveForward = resolve
    })
    mockForward.mockReturnValueOnce(slowPromise)
    debugLog('竞态-超时', { timeout: 100, forwardWillResolve: 'delayed' })

    const adapter = new DataBridgeAdapter({ defaultTimeout: 100 })
    const queryPromise = adapter.query('FETCH_STOCKS', {})

    vi.advanceTimersByTime(101)
    const result = await queryPromise

    debugLog('竞态-超时 结果', { success: result.success, error: result.error, pendingQueries: adapter.getStats().pendingQueries })
    expect(result.success).toBe(false)
    expect(result.error).toContain('timeout')
    expect(adapter.getStats().pendingQueries).toBe(0)

    // forward 延迟 resolve 不应崩溃（entry 已删除，?. 安全跳过）
    expect(() => resolveForward()).not.toThrow()
    debugLog('竞态-超时 验证', { delayedResolveSafe: true })
  })
})

// ============================================================
// P1 用例：自定义子类 + 其他编程错误类型
// ============================================================
describe('DataBridgeAdapter — isProgrammingError P1 扩展', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    destroyDataBridgeAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ----------------------------------------------------------
  // P1 用例 1：自定义子类 extends TypeError → true（fail-fast reject）
  // 验证 Set.has(constructor) 能匹配子类构造器
  // ----------------------------------------------------------
  it('forward 抛出自定义子类 extends TypeError → reject（编程错误 fail-fast）', async () => {
    class CustomTypeError extends TypeError {}
    const customErr = new CustomTypeError('custom type error')
    debugLog('P1-自定义子类', { errorType: 'CustomTypeError extends TypeError', constructor: customErr.constructor.name })

    mockForward.mockRejectedValueOnce(customErr)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(CustomTypeError)
    debugLog('P1-自定义子类 结果', { rejected: true, errorType: 'CustomTypeError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // P1 用例 2：EvalError/URIError → true（fail-fast reject）
  // 验证 Set 中其他编程错误类型也能正确匹配
  // ----------------------------------------------------------
  it('forward 抛出 EvalError → reject（编程错误 fail-fast）', async () => {
    const evalError = new EvalError('eval not allowed')
    debugLog('P1-EvalError', { errorType: 'EvalError', constructor: evalError.constructor.name })

    mockForward.mockRejectedValueOnce(evalError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(EvalError)
    debugLog('P1-EvalError 结果', { rejected: true, errorType: 'EvalError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  it('forward 抛出 URIError → reject（编程错误 fail-fast）', async () => {
    const uriError = new URIError('malformed URI sequence')
    debugLog('P1-URIError', { errorType: 'URIError', constructor: uriError.constructor.name })

    mockForward.mockRejectedValueOnce(uriError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(URIError)
    debugLog('P1-URIError 结果', { rejected: true, errorType: 'URIError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // P1 用例 3：ReferenceError/RangeError → true（fail-fast reject）
  // 补全覆盖 Set 中剩余的编程错误类型
  // ----------------------------------------------------------
  it('forward 抛出 ReferenceError → reject（编程错误 fail-fast）', async () => {
    const refError = new ReferenceError('x is not defined')
    debugLog('P1-ReferenceError', { errorType: 'ReferenceError', constructor: refError.constructor.name })

    mockForward.mockRejectedValueOnce(refError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(ReferenceError)
    debugLog('P1-ReferenceError 结果', { rejected: true, errorType: 'ReferenceError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  it('forward 抛出 RangeError → reject（编程错误 fail-fast）', async () => {
    const rangeError = new RangeError('Maximum call stack size exceeded')
    debugLog('P1-RangeError', { errorType: 'RangeError', constructor: rangeError.constructor.name })

    mockForward.mockRejectedValueOnce(rangeError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(RangeError)
    debugLog('P1-RangeError 结果', { rejected: true, errorType: 'RangeError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // P1 用例 6：自定义子类 extends SyntaxError → true（fail-fast reject）
  // 验证 instanceof 对非 TypeError 的编程错误子类也能正确匹配
  // ----------------------------------------------------------
  it('forward 抛出自定义子类 extends SyntaxError → reject（编程错误 fail-fast）', async () => {
    class CustomSyntaxError extends SyntaxError {}
    const customErr = new CustomSyntaxError('custom syntax error')
    debugLog('P1-子类SyntaxError', { errorType: 'CustomSyntaxError extends SyntaxError', constructor: customErr.constructor.name })

    mockForward.mockRejectedValueOnce(customErr)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(CustomSyntaxError)
    debugLog('P1-子类SyntaxError 结果', { rejected: true, errorType: 'CustomSyntaxError' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // P1 用例 7：自定义子类 extends Error（非编程错误）→ false（操作错误）
  // 假阳性边界：CustomError extends Error 不应被误判为编程错误
  // 验证 instanceof 检查不会过度匹配普通 Error 子类
  // ----------------------------------------------------------
  it('forward 抛出自定义子类 extends Error（非编程错误）→ resolve success=false（操作错误）', async () => {
    class CustomOperationalError extends Error {}
    const customErr = new CustomOperationalError('custom operational error')
    debugLog('P1-假阳性边界', {
      errorType: 'CustomOperationalError extends Error',
      constructor: customErr.constructor.name,
      expectedIsProgramming: false,
      branch: 'false-positive-boundary',
    })

    mockForward.mockRejectedValueOnce(customErr)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    debugLog('P1-假阳性边界 结果', { success: result.success, error: result.error, resolved: true })
    // 应优雅降级 resolve success=false，而非 fail-fast reject
    expect(result.success).toBe(false)
    expect(result.error).toBe('custom operational error')
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('操作错误(优雅降级)'),
    )
  })

  // ----------------------------------------------------------
  // P1 用例 8：多层继承 extends CustomTypeError extends TypeError → true（fail-fast reject）
  // 验证 instanceof 原型链深度遍历：孙类也能正确匹配
  // ----------------------------------------------------------
  it('forward 抛出多层继承子类（孙类 extends CustomTypeError extends TypeError）→ reject（编程错误 fail-fast）', async () => {
    class CustomTypeError extends TypeError {}
    class DeepError extends CustomTypeError {}
    const deepErr = new DeepError('deep inheritance error')
    debugLog('P1-多层继承', {
      errorType: 'DeepError extends CustomTypeError extends TypeError',
      constructor: deepErr.constructor.name,
      prototypeChainDepth: 3,
      branch: 'multi-level-inheritance',
    })

    mockForward.mockRejectedValueOnce(deepErr)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(DeepError)
    debugLog('P1-多层继承 结果', { rejected: true, errorType: 'DeepError', prototypeChainTraversed: true })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })
})

// ============================================================
// 极端边界用例：原型链篡改与 constructor 覆写
// ============================================================
describe('DataBridgeAdapter — isProgrammingError 极端原型链边界', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    destroyDataBridgeAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ----------------------------------------------------------
  // 极端用例 1：constructor 属性被覆写为 Error，但原型链不变
  // 场景：某些库会覆写 this.constructor，导致 Set.has(constructor) 失败
  // 验证 instanceof 回退路径：Set 检查失败后 instanceof TypeError 仍能匹配 → true
  // 这是双重判断（Set + instanceof）的核心价值验证
  // ----------------------------------------------------------
  it('constructor 被覆写为 Error 但原型链不变 → instanceof 回退匹配 → reject（编程错误）', async () => {
    const err = new TypeError('original type error')
    // 覆写 constructor 属性，模拟第三方库行为
    Object.defineProperty(err, 'constructor', { value: Error, writable: true, configurable: true })
    debugLog('极端-constructor覆写', {
      errorType: 'TypeError with constructor overridden to Error',
      constructorName: err.constructor.name,
      instanceofTypeError: err instanceof TypeError,
      setHasConstructor: false,
      branch: 'constructor-override-instanceof-fallback',
    })

    mockForward.mockRejectedValueOnce(err)
    const adapter = new DataBridgeAdapter()

    // Set.has(Error) → false，但 instanceof TypeError → true → 仍判定为编程错误
    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(TypeError)
    debugLog('极端-constructor覆写 结果', {
      rejected: true,
      fallbackPath: 'instanceof',
      setCheckFailed: true,
      instanceofSucceeded: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })

  // ----------------------------------------------------------
  // 极端用例 2：TypeError 实例原型链被 setPrototypeOf 篡改为 Error.prototype
  // 场景：原型链被故意或意外修改后，instanceof TypeError 返回 false
  // 验证原型链断裂后正确判定为操作错误（false）→ 优雅降级 resolve
  // ----------------------------------------------------------
  it('TypeError 原型链被篡改为 Error.prototype → instanceof 失败 → resolve success=false（操作错误）', async () => {
    const err = new TypeError('original type error')
    // 篡改原型链，使 instanceof TypeError 返回 false
    Object.setPrototypeOf(err, Error.prototype)
    debugLog('极端-原型链篡改', {
      errorType: 'TypeError with prototype set to Error.prototype',
      constructorName: err.constructor.name,
      instanceofTypeError: err instanceof TypeError,
      instanceofError: err instanceof Error,
      branch: 'prototype-tampered-instanceof-fails',
    })

    mockForward.mockRejectedValueOnce(err)
    const adapter = new DataBridgeAdapter()
    const result = await adapter.query('FETCH_STOCKS', {})

    // constructor → Error（不在 Set 中），instanceof TypeError → false → 判定为操作错误
    debugLog('极端-原型链篡改 结果', {
      success: result.success,
      error: result.error,
      resolved: true,
      instanceofFailed: true,
      classifiedAs: 'operational',
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('original type error')
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('操作错误(优雅降级)'),
    )
  })

  // ----------------------------------------------------------
  // 极端用例 3：Object.create(TypeError.prototype) 伪造 TypeError
  // 场景：未经 new TypeError() 构造，仅通过原型链创建的"伪 TypeError"
  // 验证 constructor → TypeError（在 Set 中）+ instanceof TypeError → true → 正确判定为编程错误
  // ----------------------------------------------------------
  it('Object.create(TypeError.prototype) 伪造 TypeError → reject（编程错误 fail-fast）', async () => {
    const fakeTypeError = Object.create(TypeError.prototype) as TypeError
    fakeTypeError.message = 'fake type error via prototype'
    debugLog('极端-伪造TypeError', {
      errorType: 'Object.create(TypeError.prototype)',
      constructorName: fakeTypeError.constructor.name,
      instanceofTypeError: fakeTypeError instanceof TypeError,
      wasConstructed: false,
      branch: 'fake-typeerror-via-prototype',
    })

    mockForward.mockRejectedValueOnce(fakeTypeError)
    const adapter = new DataBridgeAdapter()

    await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow()
    debugLog('极端-伪造TypeError 结果', {
      rejected: true,
      classifiedAs: 'programming',
      setMatched: true,
      instanceofSucceeded: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('编程错误(fail-fast reject)'),
    )
  })
})
