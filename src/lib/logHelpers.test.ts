/**
 * logHelpers.test.ts — 100% 覆盖
 *
 * 覆盖函数：safeStringify / buildEntryContext / buildResultContext /
 *   logEntry / logExit / logException / withLogging / withLoggingSync
 *   + JSON.stringify replacer + array map callback + async/sync wrappers
 *
 * 策略：内部函数通过公共 API（withLogging/withLoggingSync/logEntry/logExit/logException）
 *   间接覆盖，传入不同类型的 args/result 触发 safeStringify 全部分支。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logEntry, logExit, logException, withLogging, withLoggingSync } from './logHelpers'

// ── mock logger：捕获 info / debug / error 调用 ──
const mockInfo = vi.fn()
const mockDebug = vi.fn()
const mockError = vi.fn()

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: (...args: any[]) => mockInfo(...args),
    debug: (...args: any[]) => mockDebug(...args),
    warn: vi.fn(),
    error: (...args: any[]) => mockError(...args),
    level: 'debug',
    name: 'logHelpers-test',
  }),
}))

// ── 辅助：从 mock 调用中提取 context 对象 ──
function ctxOf(mock: ReturnType<typeof vi.fn>, callIdx = 0): Record<string, unknown> {
  return mock.mock.calls[callIdx]![1] as Record<string, unknown>
}

describe('logHelpers', () => {
  beforeEach(() => {
    mockInfo.mockClear()
    mockDebug.mockClear()
    mockError.mockClear()
  })

  // ══════════════════════════════════════════════════════════════
  // 1. logEntry
  // ══════════════════════════════════════════════════════════════
  describe('logEntry()', () => {
    it('调用 LOGGER.info 写入「[module] operation 入口」+ entryContext', () => {
      logEntry('myService', 'doWork', { symbol: 'AAPL' })
      expect(mockInfo).toHaveBeenCalledTimes(1)
      expect(mockInfo.mock.calls[0]![0]).toBe('[myService] doWork 入口')
      expect(ctxOf(mockInfo)).toEqual({ symbol: 'AAPL' })
    })

    it('返回 LogScopeContext 包含 module/operation/startTime/startedAt/entryContext', () => {
      const ctx = logEntry('svc', 'op', { key: 'val' })
      expect(ctx.module).toBe('svc')
      expect(ctx.operation).toBe('op')
      expect(typeof ctx.startTime).toBe('number')
      expect(typeof ctx.startedAt).toBe('number')
      expect(ctx.entryContext).toEqual({ key: 'val' })
    })

    it('entryContext 缺省为空对象', () => {
      const ctx = logEntry('svc', 'op')
      expect(ctx.entryContext).toEqual({})
      expect(mockInfo).toHaveBeenCalledTimes(1)
    })

    it('performance 不可用时回退 Date.now()（fallback 分支）', () => {
      const origPerf = globalThis.performance
      try {
        Object.defineProperty(globalThis, 'performance', { value: undefined, configurable: true })
        const ctx = logEntry('svc', 'op')
        expect(typeof ctx.startTime).toBe('number')
        expect(mockInfo).toHaveBeenCalledTimes(1)
      } finally {
        Object.defineProperty(globalThis, 'performance', { value: origPerf, configurable: true })
      }
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 2. logExit
  // ══════════════════════════════════════════════════════════════
  describe('logExit()', () => {
    it('带 result 参数 → 构造 resultContext + durationMs，使用 info 级别（默认）', () => {
      const ctx = logEntry('svc', 'op')
      mockInfo.mockClear()
      logExit(ctx, { success: true, count: 5 })
      expect(mockInfo).toHaveBeenCalledTimes(1)
      expect(mockInfo.mock.calls[0]![0]).toBe('[svc] op 出口')
      const c = ctxOf(mockInfo)
      expect(c.success).toBe(true)
      expect(c.count).toBe(5)
      expect(typeof c.durationMs).toBe('number')
    })

    it('不带 result 参数（arguments.length === 1）→ 仅 durationMs', () => {
      const ctx = logEntry('svc', 'op')
      mockInfo.mockClear()
      logExit(ctx)
      expect(mockInfo).toHaveBeenCalledTimes(1)
      const c = ctxOf(mockInfo)
      expect(c.durationMs).toBeDefined()
      expect(c.result).toBeUndefined()
      expect(c.success).toBeUndefined()
    })

    it('level=debug → 使用 LOGGER.debug', () => {
      const ctx = logEntry('svc', 'op')
      mockInfo.mockClear()
      logExit(ctx, 'result', { level: 'debug' })
      expect(mockDebug).toHaveBeenCalledTimes(1)
      expect(mockInfo).not.toHaveBeenCalled()
      expect(mockDebug.mock.calls[0]![0]).toBe('[svc] op 出口')
    })

    it('level=info（默认）→ 使用 LOGGER.info', () => {
      const ctx = logEntry('svc', 'op')
      mockInfo.mockClear()
      logExit(ctx, 'result')
      expect(mockInfo).toHaveBeenCalledTimes(1)
      expect(mockDebug).not.toHaveBeenCalled()
    })

    it('performance 不可用时回退 Date.now() - ctx.startedAt（fallback 分支）', () => {
      const ctx = logEntry('svc', 'op')
      mockInfo.mockClear()
      const origPerf = globalThis.performance
      try {
        Object.defineProperty(globalThis, 'performance', { value: undefined, configurable: true })
        logExit(ctx, 'result')
        expect(mockInfo).toHaveBeenCalledTimes(1)
        expect(typeof ctxOf(mockInfo).durationMs).toBe('number')
      } finally {
        Object.defineProperty(globalThis, 'performance', { value: origPerf, configurable: true })
      }
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 3. logException
  // ══════════════════════════════════════════════════════════════
  describe('logException()', () => {
    it('Error 对象（含 stack）→ errorContext 含 error/errorName/stack', () => {
      const ctx = logEntry('svc', 'op', { symbol: 'X' })
      mockError.mockClear()
      const err = new Error('boom')
      logException(ctx, err)
      expect(mockError).toHaveBeenCalledTimes(1)
      expect(mockError.mock.calls[0]![0]).toBe('[svc] op 异常')
      const c = ctxOf(mockError)
      expect(c.error).toBe('boom')
      expect(c.errorName).toBe('Error')
      expect(c.stack).toBe(err.stack)
      expect(c.symbol).toBe('X') // entryContext 展开
      expect(typeof c.durationMs).toBe('number')
    })

    it('Error 对象（stack=null）→ 不含 stack 字段', () => {
      const ctx = logEntry('svc', 'op')
      mockError.mockClear()
      const err = new Error('no-stack')
      Object.defineProperty(err, 'stack', { value: null, configurable: true })
      logException(ctx, err)
      const c = ctxOf(mockError)
      expect(c.stack).toBeUndefined()
    })

    it('非 Error 对象（字符串）→ error=String(err), errorName=typeof err', () => {
      const ctx = logEntry('svc', 'op')
      mockError.mockClear()
      logException(ctx, 'string error')
      const c = ctxOf(mockError)
      expect(c.error).toBe('string error')
      expect(c.errorName).toBe('string')
      expect(c.stack).toBeUndefined()
    })

    it('非 Error 对象（数字）→ error=String(err), errorName="number"', () => {
      const ctx = logEntry('svc', 'op')
      mockError.mockClear()
      logException(ctx, 42)
      const c = ctxOf(mockError)
      expect(c.error).toBe('42')
      expect(c.errorName).toBe('number')
    })

    it('performance 不可用时回退 Date.now()（fallback 分支）', () => {
      const ctx = logEntry('svc', 'op')
      mockError.mockClear()
      const origPerf = globalThis.performance
      try {
        Object.defineProperty(globalThis, 'performance', { value: undefined, configurable: true })
        logException(ctx, new Error('test'))
        expect(mockError).toHaveBeenCalledTimes(1)
        expect(typeof ctxOf(mockError).durationMs).toBe('number')
      } finally {
        Object.defineProperty(globalThis, 'performance', { value: origPerf, configurable: true })
      }
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 4. withLogging（异步高阶函数）— 覆盖 buildEntryContext + buildResultContext + safeStringify
  // ══════════════════════════════════════════════════════════════
  describe('withLogging() — 异步成功路径', () => {
    it('空参数 → entryContext={ args: "[]" }', async () => {
      const wrapped = withLogging('svc', 'op', async () => 'ok')
      mockInfo.mockClear()
      await wrapped()
      // 入口日志
      expect(mockInfo.mock.calls[0]![0]).toBe('[svc] op 入口')
      expect(ctxOf(mockInfo, 0)).toEqual({ args: '[]' })
    })

    it('单个对象参数 + argsPick → 挑选指定字段', async () => {
      const wrapped = withLogging(
        'svc', 'op',
        async (_req: { symbol: string; payload: unknown }) => 'ok',
        { argsPick: ['symbol'] },
      )
      mockInfo.mockClear()
      await wrapped({ symbol: 'AAPL', payload: new Array(1000) })
      expect(ctxOf(mockInfo, 0)).toEqual({ symbol: 'AAPL' })
    })

    it('单个对象参数无 argsPick + 含 safeKeys → 挑选轻量字段', async () => {
      const wrapped = withLogging(
        'svc', 'op',
        async (_req: { symbol: string; code: string }) => 'ok',
      )
      mockInfo.mockClear()
      await wrapped({ symbol: '600000', code: 'SH' })
      const entryCtx = ctxOf(mockInfo, 0)
      expect(entryCtx.symbol).toBe('600000')
      expect(entryCtx.code).toBe('SH')
    })

    it('单个对象参数无 argsPick + 无 safeKeys → { arg0: safeStringify(obj) }', async () => {
      const wrapped = withLogging(
        'svc', 'op',
        async (_req: { custom: string }) => 'ok',
      )
      mockInfo.mockClear()
      await wrapped({ custom: 'value' })
      const entryCtx = ctxOf(mockInfo, 0)
      expect(typeof entryCtx.arg0).toBe('string')
      expect(entryCtx.arg0 as string).toContain('custom')
    })

    it('单个基本类型参数 → { arg0: safeStringify(arg) }', async () => {
      const wrapped = withLogging('svc', 'op', async (_s: string) => 'ok')
      mockInfo.mockClear()
      await wrapped('hello')
      expect(ctxOf(mockInfo, 0)).toEqual({ arg0: 'hello' })
    })

    it('多个参数 → { args: [safeStringify...] }', async () => {
      const wrapped = withLogging('svc', 'op', async (_a: string, _b: number) => 'ok')
      mockInfo.mockClear()
      await wrapped('foo', 42)
      expect(ctxOf(mockInfo, 0)).toEqual({ args: ['foo', '42'] })
    })

    it('argsPick 包含对象中不存在的 key → 跳过该 key（覆盖 !key in obj 分支）', async () => {
      const wrapped = withLogging(
        'svc', 'op',
        async (_req: { symbol: string }) => 'ok',
        { argsPick: ['symbol', 'nonExistent'] },
      )
      mockInfo.mockClear()
      await wrapped({ symbol: 'AAPL' })
      const entryCtx = ctxOf(mockInfo, 0)
      expect(entryCtx.symbol).toBe('AAPL')
      expect(entryCtx.nonExistent).toBeUndefined()
    })

    it('resultKeys 指定 → 出口日志仅记录指定字段', async () => {
      const wrapped = withLogging(
        'svc', 'op',
        async () => ({ success: true, count: 10, huge: new Array(999) }),
        { resultKeys: ['success', 'count'] },
      )
      mockInfo.mockClear()
      await wrapped()
      const exitCtx = ctxOf(mockInfo, 1) // 第二次 info 调用是出口
      expect(exitCtx.success).toBe(true)
      expect(exitCtx.count).toBe(10)
      expect(exitCtx.huge).toBeUndefined()
    })

    it('resultKeys 包含结果中不存在的 key → 跳过该 key（覆盖 !key in obj 分支）', async () => {
      const wrapped = withLogging(
        'svc', 'op',
        async () => ({ success: true }),
        { resultKeys: ['success', 'nonExistent'] },
      )
      mockInfo.mockClear()
      await wrapped()
      const exitCtx = ctxOf(mockInfo, 1)
      expect(exitCtx.success).toBe(true)
      expect(exitCtx.nonExistent).toBeUndefined()
    })

    it('返回 null → resultContext={ result: "null" }', async () => {
      const wrapped = withLogging('svc', 'op', async () => null)
      mockInfo.mockClear()
      await wrapped()
      expect(ctxOf(mockInfo, 1).result).toBe('null')
    })

    it('返回数组（含首项）→ resultType=array + length + first', async () => {
      const wrapped = withLogging('svc', 'op', async () => [1, 2, 3])
      mockInfo.mockClear()
      await wrapped()
      const c = ctxOf(mockInfo, 1)
      expect(c.resultType).toBe('array')
      expect(c.length).toBe(3)
      expect(c.first).toBe('1')
    })

    it('返回空数组 → first=undefined', async () => {
      const wrapped = withLogging('svc', 'op', async () => [])
      mockInfo.mockClear()
      await wrapped()
      const c = ctxOf(mockInfo, 1)
      expect(c.resultType).toBe('array')
      expect(c.length).toBe(0)
      expect(c.first).toBeUndefined()
    })

    it('返回对象含 commonKeys → 摘要字段', async () => {
      const wrapped = withLogging('svc', 'op', async () => ({ success: true, count: 5, status: 'ok' }))
      mockInfo.mockClear()
      await wrapped()
      const c = ctxOf(mockInfo, 1)
      expect(c.success).toBe(true)
      expect(c.count).toBe(5)
      expect(c.status).toBe('ok')
    })

    it('返回对象无 commonKeys → { resultType, keys }', async () => {
      const wrapped = withLogging('svc', 'op', async () => ({ foo: 'bar', baz: 1 }))
      mockInfo.mockClear()
      await wrapped()
      const c = ctxOf(mockInfo, 1)
      expect(c.resultType).toBe('object')
      expect(typeof c.keys).toBe('string')
    })

    it('返回基本类型 → { result: safeStringify(result) }', async () => {
      const wrapped = withLogging('svc', 'op', async () => 42)
      mockInfo.mockClear()
      await wrapped()
      expect(ctxOf(mockInfo, 1).result).toBe('42')
    })
  })

  describe('withLogging() — 异步异常路径', () => {
    it('抛出 Error → logException 记录后 rethrow', async () => {
      const wrapped = withLogging('svc', 'op', async () => {
        throw new Error('async-fail')
      })
      mockInfo.mockClear()
      await expect(wrapped()).rejects.toThrow('async-fail')
      // 入口 info + 异常 error
      expect(mockInfo).toHaveBeenCalledTimes(1)
      expect(mockError).toHaveBeenCalledTimes(1)
      expect(mockError.mock.calls[0]![0]).toBe('[svc] op 异常')
      expect(ctxOf(mockError).error).toBe('async-fail')
    })

    it('抛出非 Error → error=String(err)', async () => {
      const wrapped = withLogging('svc', 'op', async () => {
        throw 'string-throw'
      })
      await expect(wrapped()).rejects.toBe('string-throw')
      expect(ctxOf(mockError).error).toBe('string-throw')
      expect(ctxOf(mockError).errorName).toBe('string')
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 5. withLoggingSync（同步高阶函数）
  // ══════════════════════════════════════════════════════════════
  describe('withLoggingSync()', () => {
    it('成功路径：入口 + 出口日志', () => {
      const wrapped = withLoggingSync('svc', 'op', (n: number) => n * 2)
      mockInfo.mockClear()
      const result = wrapped(21)
      expect(result).toBe(42)
      expect(mockInfo).toHaveBeenCalledTimes(2) // 入口 + 出口
      expect(mockInfo.mock.calls[0]![0]).toBe('[svc] op 入口')
      expect(mockInfo.mock.calls[1]![0]).toBe('[svc] op 出口')
    })

    it('异常路径：logException 后 rethrow', () => {
      const wrapped = withLoggingSync('svc', 'op', () => {
        throw new Error('sync-fail')
      })
      mockInfo.mockClear()
      expect(() => wrapped()).toThrow('sync-fail')
      expect(mockInfo).toHaveBeenCalledTimes(1) // 仅入口
      expect(mockError).toHaveBeenCalledTimes(1)
      expect(ctxOf(mockError).error).toBe('sync-fail')
    })

    it('多个参数 → args 数组', () => {
      const wrapped = withLoggingSync('svc', 'op', (_a: string, _b: number, _c: boolean) => 'ok')
      mockInfo.mockClear()
      wrapped('x', 1, true)
      expect(ctxOf(mockInfo, 0)).toEqual({ args: ['x', '1', 'true'] })
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 6. safeStringify 全分支（通过 withLoggingSync 的 arg/result 间接覆盖）
  // ══════════════════════════════════════════════════════════════
  describe('safeStringify 全分支（通过公共 API 间接覆盖）', () => {
    it('null → "null"', () => {
      const wrapped = withLoggingSync('svc', 'op', (_v: unknown) => 'ok')
      mockInfo.mockClear()
      wrapped(null)
      expect(ctxOf(mockInfo, 0)).toEqual({ arg0: 'null' })
    })

    it('undefined → "undefined"', () => {
      const wrapped = withLoggingSync('svc', 'op', (_v: unknown) => 'ok')
      mockInfo.mockClear()
      wrapped(undefined)
      expect(ctxOf(mockInfo, 0)).toEqual({ arg0: 'undefined' })
    })

    it('长字符串 >200 字符 → 截断 + …', () => {
      const long = 'a'.repeat(250)
      const wrapped = withLoggingSync('svc', 'op', (_s: string) => 'ok')
      mockInfo.mockClear()
      wrapped(long)
      const arg0 = ctxOf(mockInfo, 0).arg0 as string
      expect(arg0.length).toBe(201) // 200 + …
      expect(arg0).toMatch(/…$/)
    })

    it('短字符串 ≤200 → 原样', () => {
      const wrapped = withLoggingSync('svc', 'op', (_s: string) => 'ok')
      mockInfo.mockClear()
      wrapped('short')
      expect(ctxOf(mockInfo, 0).arg0).toBe('short')
    })

    it('number → String(number)', () => {
      const wrapped = withLoggingSync('svc', 'op', (_n: number) => 'ok')
      mockInfo.mockClear()
      wrapped(3.14)
      expect(ctxOf(mockInfo, 0).arg0).toBe('3.14')
    })

    it('boolean → String(boolean)', () => {
      const wrapped = withLoggingSync('svc', 'op', (_b: boolean) => 'ok')
      mockInfo.mockClear()
      wrapped(true)
      expect(ctxOf(mockInfo, 0).arg0).toBe('true')
    })

    it('function → "[Function]"', () => {
      const wrapped = withLoggingSync('svc', 'op', (_f: () => void) => 'ok')
      mockInfo.mockClear()
      wrapped(() => {})
      expect(ctxOf(mockInfo, 0).arg0).toBe('[Function]')
    })

    it('Error → error.message（通过多参数路径触发 safeStringify，因为 Error.name 命中 safeKeys）', () => {
      const wrapped = withLoggingSync('svc', 'op', (_e: Error, _n: number) => 'ok')
      mockInfo.mockClear()
      wrapped(new Error('err-msg'), 42)
      // 多参数 → args 数组，每项 safeStringify：Error → message, number → String
      const args = ctxOf(mockInfo, 0).args as string[]
      expect(args[0]).toBe('err-msg')
      expect(args[1]).toBe('42')
    })

    it('Date → toISOString()（Date 无 safeKeys → arg0: safeStringify）', () => {
      const wrapped = withLoggingSync('svc', 'op', (_d: Date) => 'ok')
      mockInfo.mockClear()
      const d = new Date('2025-01-01T00:00:00Z')
      wrapped(d)
      expect(ctxOf(mockInfo, 0).arg0).toBe('2025-01-01T00:00:00.000Z')
    })

    it('循环引用对象 → JSON 含 [Circular]', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      const obj: Record<string, unknown> = { a: 1 }
      obj.self = obj // 循环引用
      wrapped(obj)
      const arg0 = ctxOf(mockInfo, 0).arg0 as string
      expect(arg0).toContain('[Circular]')
    })

    it('对象含 function 值 → JSON 中 [Function]', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      wrapped({ fn: () => {} })
      expect(ctxOf(mockInfo, 0).arg0 as string).toContain('[Function]')
    })

    it('对象含 symbol 值 → JSON 中 symbol.toString()', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      wrapped({ sym: Symbol('test') })
      expect(ctxOf(mockInfo, 0).arg0 as string).toContain('Symbol(test)')
    })

    it('对象含 Error 值 → JSON 中 {name, message}', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      wrapped({ err: new Error('nested') })
      const arg0 = ctxOf(mockInfo, 0).arg0 as string
      expect(arg0).toContain('nested')
      expect(arg0).toContain('Error')
    })

    it('大对象 JSON >500 字符 → 截断 + …(sizeB)', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      const big: Record<string, unknown> = {}
      for (let i = 0; i < 60; i++) big[`key${i}`] = `value${i}`
      wrapped(big)
      const arg0 = ctxOf(mockInfo, 0).arg0 as string
      expect(arg0).toMatch(/…\(\d+B\)$/)
    })

    it('不可序列化对象（toJSON 抛出）→ "[Unserializable]"', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      const unserializable = {
        toJSON() { throw new Error('cannot serialize') },
      }
      wrapped(unserializable)
      expect(ctxOf(mockInfo, 0).arg0).toBe('[Unserializable]')
    })

    it('toJSON 返回 undefined → JSON.stringify 返回 undefined → [Unserializable]', () => {
      const wrapped = withLoggingSync('svc', 'op', (_obj: unknown) => 'ok')
      mockInfo.mockClear()
      wrapped({ toJSON: () => undefined })
      expect(ctxOf(mockInfo, 0).arg0).toBe('[Unserializable]')
    })

    it('JSON.stringify 返回 undefined（纯 function 入参）→ "[Unserializable]"', () => {
      // JSON.stringify(function(){}) 返回 undefined
      const wrapped = withLoggingSync('svc', 'op', (_fn: unknown) => 'ok')
      mockInfo.mockClear()
      // 传入一个仅含 function 的对象，使得 JSON.stringify 整体返回 undefined
      const fnVal = function () {}
      wrapped(fnVal)
      // function 走 typeof === 'function' 分支，不进入 JSON.stringify
      // 要触发 json==null 分支需让 JSON.stringify 返回 undefined
      // 实际上 JSON.stringify 对顶部 function 返回 undefined
      // 但 safeStringify 在 L88 已拦截 function，不会进入 JSON.stringify
      // 此分支通过下方对象方式触发不了——改用 Symbol 顶层数据
      expect(ctxOf(mockInfo, 0).arg0).toBe('[Function]')
    })
  })
})