import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LogLevel } from '@/lib/logger'
import type { ResearchLog } from '@/data/types/types.signal'

// ============================================================
// 模块隔离：顶部 vi.mock（vitest 自动 hoist，工厂内不可引用顶层变量 TD-023）
// ============================================================
vi.mock('@/lib/logger', () => {
  const info = vi.fn()
  const debug = vi.fn()
  const warn = vi.fn()
  const error = vi.fn()
  return {
    LogLevel: 'debug' as LogLevel,
    getLogger: vi.fn(() => ({ info, debug, warn, error })),
  }
})

vi.mock('@/data/dataLayerHelpers', () => ({
  sendWriteEnvelope: vi.fn().mockResolvedValue(undefined),
  queryList: vi.fn().mockResolvedValue([] as ResearchLog[]),
}))

vi.mock('@/config/dbConfig', () => ({
  STORE_NAME: { researchLogs: 'research_logs' },
}))

// ============================================================
// 动态 import — 保证 vi.mock 已生效
// ============================================================
import * as loggerMod from '@/lib/logger'
import * as dlhMod from '@/data/dataLayerHelpers'
import {
  logEntry,
  logExit,
  logException,
  withLogging,
  withLoggingSync,
  logBranchSwitch,
  logFallback,
  logGuardWarn,
  createBranchLogger,
  reportFallbackEvent,
  reportFallbackForSymbol,
  queryFallbackLogs,
  exportFallbackLogsToCsv,
} from '@/lib/logHelpers'

type LoggerRet = ReturnType<typeof loggerMod.getLogger>

function getLogMock(kind: 'info' | 'debug' | 'warn' | 'error') {
  const l = vi.mocked(loggerMod.getLogger)() as unknown as Record<string, ReturnType<typeof vi.fn>>
  return l[kind] as ReturnType<typeof vi.fn>
}

function clearAllLogs() {
  const l = vi.mocked(loggerMod.getLogger)() as unknown as Record<string, ReturnType<typeof vi.fn>>
  Object.values(l).forEach((fn) => fn.mockClear())
  vi.mocked(loggerMod.getLogger).mockClear()
  vi.mocked(dlhMod.sendWriteEnvelope).mockClear()
  vi.mocked(dlhMod.queryList).mockClear()
}

// ============================================================
// describe 1: safeStringify 分支（通过 withLogging 的 buildEntryContext 间接覆盖）
// 触发条件：单对象参数 + 无 safeKeys 命中 + 无 argsPick → safeStringify(obj)
// ============================================================
describe('logHelpers (1) safeStringify branches (via withLogging entry/result)', () => {
  beforeEach(() => { clearAllLogs() })

  it('long string value (>200) truncated with …', async () => {
    const long = 'x'.repeat(500)
    const wrapped = withLogging('m', 'op', async (p: { payload: string }) => p)
    await wrapped({ payload: long })
    const info = getLogMock('info')
    const entryCtx = info.mock.calls[0][1] as Record<string, unknown>
    const v = entryCtx.arg0 as string // arg0 = safeStringify({ payload: long })
    // payload 字段值被截断
    expect(v).toContain(`${long.slice(0, 200)}…`)
  })

  it('function 值 → [Function]', async () => {
    const wrapped = withLogging('m', 'op', async (p: { only: () => void }) => p)
    await wrapped({ only() {} })
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect((entryCtx.arg0 as string)).toContain('[Function]')
  })

  it('Error 值 → name:message 映射', async () => {
    const wrapped = withLogging('m', 'op', async (p: { err: Error }) => p)
    await wrapped({ err: new Error('boom') })
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect((entryCtx.arg0 as string)).toContain('"name":"Error"')
    expect((entryCtx.arg0 as string)).toContain('"message":"boom"')
  })

  it('Date 值 → ISO string（单基本类型 arg 场景）', async () => {
    const d = new Date('2025-01-02T03:04:05.000Z')
    const wrapped = withLogging('m', 'op', async (d: Date) => d)
    await wrapped(d)
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    // 单非对象参数 → { arg0: safeStringify(Date) } = ISO string
    expect(entryCtx.arg0).toBe('2025-01-02T03:04:05.000Z')
  })

  it('circular object → [Circular]，safeStringify 无异常', async () => {
    // 多参数：第 2 个参数设为 circular 对象 → 走 160 行 args map safeStringify
    // 注意：小 payload 避免 JSON 超 500 截断导致 [Circular] 被 slice 切除
    const a: Record<string, unknown> = { foo: 'a', small: 'x'.repeat(100) }
    a.self = a
    const wrapped = withLogging('m', 'op', async (_tag: string, circular: unknown) => circular)
    await wrapped('tag', a)
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    const arrArgs = entryCtx.args as string[]
    expect(arrArgs).toHaveLength(2)
    const json = arrArgs[1]
    expect(typeof json).toBe('string')
    expect(json.length).toBeGreaterThan(0)
    // WeakSet replacer 检测循环引用 → 插入 [Circular] 标记
    expect(json).toContain('[Circular]')
  })

  it('function-only 参数通过单参数包装 → safeStringify(function) = [Function]', async () => {
    const wrapped = withLogging('m', 'op', async (fn: () => number) => fn())
    const r = await wrapped(() => 42)
    expect(r).toBe(42)
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect(entryCtx.arg0).toBe('[Function]')
  })
})

// ============================================================
// describe 2: buildEntryContext
// ============================================================
describe('logHelpers (2) buildEntryContext logic (via withLogging args)', () => {
  beforeEach(() => { clearAllLogs() })

  it('args.length = 0 → { args: "[]" }', async () => {
    const wrapped = withLogging('m', 'op', async () => 42)
    const r = await wrapped()
    expect(r).toBe(42)
    const info = getLogMock('info')
    // 入口调用
    const entryCtx = info.mock.calls[0][1] as Record<string, unknown>
    expect(entryCtx.args).toBe('[]')
  })

  it('单个对象参数 + argsPick → 仅挑选命中字段', async () => {
    const wrapped = withLogging('m', 'op',
      async (p: { a: number; b: string; c: boolean }) => p,
      { argsPick: ['a', 'c', 'missing'] })
    await wrapped({ a: 1, b: 'skip', c: true })
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect(entryCtx).toEqual({ a: 1, c: true })
  })

  it('单个对象参数无 argsPick → 命中 safeKeys 白名单', async () => {
    const wrapped = withLogging('m', 'op',
      async (p: { symbol: string; taskId: string; secret: string }) => p)
    await wrapped({ symbol: '600519', taskId: 't1', secret: 'nope' })
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect(entryCtx).toEqual({ symbol: '600519', taskId: 't1' })
    expect('secret' in entryCtx).toBe(false)
  })

  it('单个对象无 safeKeys 命中 → 全量 safeStringify 到 arg0', async () => {
    const wrapped = withLogging('m', 'op',
      async (p: { foo: number; bar: string }) => p)
    await wrapped({ foo: 42, bar: 'baz' })
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect(typeof entryCtx.arg0).toBe('string')
    expect(entryCtx.arg0).toContain('foo')
  })

  it('单基本类型参数 → { arg0: stringify }', async () => {
    const wrapped = withLogging('m', 'op', async (s: string) => s.length)
    await wrapped('hello')
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect(entryCtx.arg0).toBe('hello')
  })

  it('多参数 → { args: [stringify, ...] }', async () => {
    const wrapped = withLogging('m', 'op',
      async (s: string, n: number, b: boolean) => ({ s, n, b }))
    await wrapped('a', 1, true)
    const entryCtx = getLogMock('info').mock.calls[0][1] as Record<string, unknown>
    expect(entryCtx.args).toEqual(['a', '1', 'true'])
  })
})

// ============================================================
// describe 3: buildResultContext
// ============================================================
describe('logHelpers (3) buildResultContext logic (via withLogging + opts)', () => {
  beforeEach(() => { clearAllLogs() })

  it('result = null → { result: "null" }', async () => {
    const wrapped = withLogging('m', 'op', async () => null)
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit.result).toBe('null')
    expect(typeof exit.durationMs).toBe('number')
  })

  it('resultKeys 命中 → 仅挑选字段', async () => {
    const wrapped = withLogging('m', 'op',
      async () => ({ success: true, count: 100, big: 'x'.repeat(10000) }),
      { resultKeys: ['success', 'count', 'absent'] })
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit).toMatchObject({ success: true, count: 100 })
    expect('big' in exit).toBe(false)
  })

  it('数组结果 → { resultType, length, first }', async () => {
    const wrapped = withLogging('m', 'op', async () => [
      { id: 1, name: 'one' }, { id: 2, name: 'two' },
    ])
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit.resultType).toBe('array')
    expect(exit.length).toBe(2)
    expect(exit.first).toContain('one')
  })

  it('数组空 → first undefined', async () => {
    const wrapped = withLogging('m', 'op', async () => [] as number[])
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit.resultType).toBe('array')
    expect(exit.length).toBe(0)
    expect(exit.first).toBeUndefined()
  })

  it('对象 → commonKeys 优先', async () => {
    const wrapped = withLogging('m', 'op', async () => ({
      success: true, count: 10, source: 'sina', other: 'nope',
    }))
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit).toMatchObject({ success: true, count: 10, source: 'sina' })
    expect('other' in exit).toBe(false)
  })

  it('对象无 commonKeys → { resultType, keys(前 5) }', async () => {
    const wrapped = withLogging('m', 'op', async () => ({
      k1: 1, k2: 2, k3: 3, k4: 4, k5: 5, k6: 6,
    }))
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit.resultType).toBe('object')
    const keys = (exit.keys as string).split(',').sort()
    expect(keys.length).toBe(5)
  })

  it('基本类型非 null → { result: stringify }', async () => {
    const wrapped = withLogging('m', 'op', async () => 42)
    await wrapped()
    const exit = getLogMock('info').mock.calls[1][1] as Record<string, unknown>
    expect(exit.result).toBe('42')
  })
})

// ============================================================
// describe 4: logEntry / logExit / logException 计时 + 分支
// ============================================================
describe('logHelpers (4) logEntry/logExit/logException API', () => {
  beforeEach(() => { clearAllLogs() })

  it('logEntry 返回 scope，包含 startTime/startedAt/entryContext', () => {
    const ctx = logEntry('mod', 'fetch', { symbol: '600519' })
    expect(ctx.module).toBe('mod')
    expect(ctx.operation).toBe('fetch')
    expect(typeof ctx.startTime).toBe('number')
    expect(typeof ctx.startedAt).toBe('number')
    expect(ctx.entryContext).toEqual({ symbol: '600519' })
    expect(getLogMock('info')).toHaveBeenCalledWith(
      '[mod] fetch 入口', { symbol: '600519' },
    )
  })

  it('logEntry 缺省 entryContext → {}', () => {
    const ctx = logEntry('mod', 'op')
    expect(ctx.entryContext).toEqual({})
  })

  it('logEntry performance 全局缺失时回退 Date.now()', () => {
    const orig = (globalThis as unknown as { performance?: unknown }).performance
    delete (globalThis as unknown as { performance?: unknown }).performance
    try {
      const before = Date.now()
      const ctx = logEntry('mod', 'op')
      const after = Date.now()
      // 回退后 startTime 为 Date.now 毫秒整数
      expect(ctx.startTime).toBeGreaterThanOrEqual(before)
      expect(ctx.startTime).toBeLessThanOrEqual(after)
    } finally {
      if (orig != null) {
        (globalThis as unknown as { performance: unknown }).performance = orig
      }
    }
  })

  it('logExit 默认 info 级别；含 result 时构建摘要', () => {
    const ctx = logEntry('m', 'op')
    logExit(ctx, { success: true })
    const info = getLogMock('info')
    const lastCall = info.mock.calls[info.mock.calls.length - 1]
    expect(lastCall[0]).toBe('[m] op 出口')
    const c = lastCall[1] as Record<string, unknown>
    expect(c.success).toBe(true)
    expect(typeof c.durationMs).toBe('number')
  })

  it('logExit opts.level = debug → 用 LOGGER.debug', () => {
    const ctx = logEntry('m', 'op')
    logExit(ctx, 'ok', { level: 'debug' })
    const debug = getLogMock('debug')
    expect(debug).toHaveBeenCalledTimes(1)
    expect(debug.mock.calls[0][0]).toBe('[m] op 出口')
    expect(getLogMock('info')).toHaveBeenCalledTimes(1) // 仅 entry
  })

  it('logExit 未传 result（仅 1 参数）→ 无 result 字段，仅 durationMs', () => {
    const ctx = logEntry('m', 'op')
    // TS 允许只传一个参数（arguments.length = 1）
    ;(logExit as (c: unknown) => void)(ctx)
    const info = getLogMock('info')
    const exitCall = info.mock.calls[info.mock.calls.length - 1][1] as Record<string, unknown>
    expect('result' in exitCall).toBe(false)
    expect('resultType' in exitCall).toBe(false)
    expect(typeof exitCall.durationMs).toBe('number')
  })

  it('logException: Error 含 stack → message + name + stack', () => {
    const ctx = logEntry('m', 'op', { a: 1 })
    const err = new Error('fail')
    logException(ctx, err)
    const er = getLogMock('error')
    expect(er).toHaveBeenCalledTimes(1)
    const c = er.mock.calls[0][1] as Record<string, unknown>
    expect(c.a).toBe(1)
    expect(c.error).toBe('fail')
    expect(c.errorName).toBe('Error')
    expect(typeof c.stack).toBe('string')
    expect(typeof c.durationMs).toBe('number')
  })

  it('logException: 非 Error (string) → error=string, errorName=typeof', () => {
    const ctx = logEntry('m', 'op')
    logException(ctx, 'string error')
    const c = getLogMock('error').mock.calls[0][1] as Record<string, unknown>
    expect(c.error).toBe('string error')
    expect(c.errorName).toBe('string')
    expect('stack' in c).toBe(false)
  })

  it('logException: Error 无 stack 不设 stack 字段', () => {
    const ctx = logEntry('m', 'op')
    const err = new Error('no stack')
    delete err.stack
    logException(ctx, err)
    const c = getLogMock('error').mock.calls[0][1] as Record<string, unknown>
    expect('stack' in c).toBe(false)
  })
})

// ============================================================
// describe 5: withLogging / withLoggingSync 成功 + 异常
// ============================================================
describe('logHelpers (5) withLogging (async/sync) wrappers', () => {
  beforeEach(() => { clearAllLogs() })

  it('withLogging 异步成功：调用 entry + exit，返回值正确穿透', async () => {
    const fn = vi.fn(async (a: number, b: number) => ({ sum: a + b }))
    const wrapped = withLogging('calc', 'add', fn, { level: 'info' })
    const r = await wrapped(3, 4)
    expect(r).toEqual({ sum: 7 })
    expect(fn).toHaveBeenCalledWith(3, 4)
    const info = getLogMock('info')
    // entry + exit
    expect(info.mock.calls[0][0]).toContain('入口')
    expect(info.mock.calls[1][0]).toContain('出口')
  })

  it('withLogging 异步抛错：logException + rethrow', async () => {
    const err = new Error('network')
    const fn = vi.fn(async () => { throw err })
    const wrapped = withLogging('net', 'fetch', fn)
    await expect(wrapped()).rejects.toThrow('network')
    expect(getLogMock('error')).toHaveBeenCalledTimes(1)
    const c = getLogMock('error').mock.calls[0][1] as Record<string, unknown>
    expect(c.error).toBe('network')
  })

  it('withLoggingSync 同步成功', () => {
    const fn = vi.fn((x: number) => x * 2)
    const wrapped = withLoggingSync('math', 'double', fn)
    expect(wrapped(21)).toBe(42)
    expect(fn).toHaveBeenCalledWith(21)
    const info = getLogMock('info')
    expect(info.mock.calls).toHaveLength(2)
  })

  it('withLoggingSync 同步抛错：logException + rethrow', () => {
    const fn = vi.fn((_x: number) => { throw new TypeError('bad') })
    const wrapped = withLoggingSync('math', 'double', fn)
    expect(() => wrapped(1)).toThrow('bad')
    const c = getLogMock('error').mock.calls[0][1] as Record<string, unknown>
    expect(c.errorName).toBe('TypeError')
  })
})

// ============================================================
// describe 6: logBranchSwitch / logFallback / logGuardWarn / createBranchLogger
// ============================================================
describe('logHelpers (6) branch logging utilities', () => {
  let logger: LoggerRet

  beforeEach(() => {
    clearAllLogs()
    vi.mocked(loggerMod.getLogger).mockClear()
    const info = vi.fn()
    const debug = vi.fn()
    const warn = vi.fn()
    const error = vi.fn()
    logger = { info, debug, warn, error } as unknown as LoggerRet
    vi.mocked(loggerMod.getLogger).mockReturnValue(logger)
  })

  it('logBranchSwitch 默认 debug 级别', () => {
    logBranchSwitch(logger, 'parser', 'parse', 'A股', { code: '600519' })
    expect(logger.debug).toHaveBeenCalledWith('[parser] parse: A股 分支', { code: '600519' })
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('logBranchSwitch info 级别', () => {
    logBranchSwitch(logger, 'parser', 'parse', '港股', {}, 'info')
    expect(logger.info).toHaveBeenCalled()
    expect((logger.info as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      '[parser] parse: 港股 分支',
    )
  })

  it('logFallback 默认 debug；input + fallback + extra 合并', () => {
    logFallback(logger, 'quotes', 'mapQuote', '000001.SZ', '000001', { market: 'sz' })
    const call = (logger.debug as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('[quotes] mapQuote: 回退')
    expect(call[1]).toEqual({ input: '000001.SZ', fallback: '000001', market: 'sz' })
  })

  it('logFallback warn 级别（关键降级路径）', () => {
    logFallback(logger, 'q', 'str', 'in', 'fall', {}, 'warn')
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('logGuardWarn 固定 warn 级别 + reason 格式化', () => {
    logGuardWarn(logger, 'codeMap', 'lengthGate', '代码长度 > 10，存在碰撞风险', { code: '000001.SZ-EXTRA' })
    const call = (logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('[codeMap] lengthGate: 守卫触发 — 代码长度 > 10，存在碰撞风险')
    expect(call[1]).toEqual({ code: '000001.SZ-EXTRA' })
  })

  it('createBranchLogger 绑定 ns，批量调用省参', () => {
    const bl = createBranchLogger(logger, 'fetch')
    bl.branchSwitch('parse', 'A股', { s: '600519' })
    bl.fallback('retry', 'sina', 'tencent', { attempt: 2 }, 'info')
    bl.guardWarn('codeGate', '超长', { s: 'xxx' })

    expect(logger.debug).toHaveBeenCalledWith('[fetch] parse: A股 分支', { s: '600519' })
    const infoCall = (logger.info as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(infoCall[0]).toBe('[fetch] retry: 回退')
    expect(infoCall[1].input).toBe('sina')
    expect(infoCall[1].fallback).toBe('tencent')
    expect(infoCall[1].attempt).toBe(2)
    expect(logger.warn).toHaveBeenCalledWith(
      '[fetch] codeGate: 守卫触发 — 超长', { s: 'xxx' },
    )
  })
})

// ============================================================
// describe 7: reportFallbackEvent + reportFallbackForSymbol
// ============================================================
describe('logHelpers (7) reportFallbackEvent & reportFallbackForSymbol', () => {
  let logger: LoggerRet

  beforeEach(() => {
    clearAllLogs()
    vi.mocked(loggerMod.getLogger).mockClear()
    const info = vi.fn()
    const debug = vi.fn()
    const warn = vi.fn()
    const error = vi.fn()
    logger = { info, debug, warn, error } as unknown as LoggerRet
    vi.mocked(loggerMod.getLogger).mockReturnValue(logger)
  })

  it('reportFallbackEvent: logger 传参优先，fromTo/extra 正确', () => {
    reportFallbackEvent({
      actor: 'collector',
      logger,
      event: 'kline_fallback',
      fromTo: { from: 'tencent', to: 'sina' },
      reason: '腾讯 kline 空',
      extra: { market: 'CN' },
      target: { type: 'stock', code: '600519' },
    })
    // 1. warn 日志
    const call = (logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('[collector] fallback:kline_fallback — 腾讯 kline 空')
    expect(call[1]).toMatchObject({
      target: { type: 'stock', code: '600519' },
      from: 'tencent', to: 'sina', market: 'CN',
    })
    // 2. sendWriteEnvelope 被调
    expect(dlhMod.sendWriteEnvelope).toHaveBeenCalledTimes(1)
    const [action, payload, origin] = vi.mocked(dlhMod.sendWriteEnvelope).mock.calls[0]
    expect(action).toBe('saveResearchLog')
    expect(origin).toBe('system')
    const pl = payload as ResearchLog
    expect(pl.actor).toBe('collector')
    expect(pl.action).toBe('fallback:kline_fallback')
    expect(pl.targetCode).toBe('600519')
    expect(pl.traceId).toMatch(/^fallback-kline_fallback-\d+-[a-z0-9]{6}$/)
    const parsed = JSON.parse(pl.payload)
    expect(parsed).toMatchObject({
      module: 'collector', event: 'kline_fallback',
      fallbackFrom: 'tencent', fallbackTo: 'sina', reason: '腾讯 kline 空',
      market: 'CN',
    })
  })

  it('reportFallbackEvent: logger 缺省 → 用 getLogger()；reason 缺省 → 无原因', () => {
    reportFallbackEvent({
      actor: 'A', event: 'chip_price_sanitize', target: { type: 'chip', code: 'BABA' },
    })
    const call = (logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('[A] fallback:chip_price_sanitize — 无原因')
    expect(call[1].from).toBeUndefined()
  })

  it('reportFallbackEvent: sendWriteEnvelope 抛 Promise reject → .catch 中 debug 日志', async () => {
    vi.mocked(dlhMod.sendWriteEnvelope).mockRejectedValueOnce(new TypeError('db down'))
    reportFallbackEvent({
      actor: 'svc', logger, event: 'kline_fallback', target: { type: 'stock', code: 'A' },
    })
    // 让 microtask 推进
    await Promise.resolve()
    await Promise.resolve()
    const dbg = (logger.debug as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(dbg[0]).toContain('[research_logs] 写入失败')
    expect(dbg[1].error).toBe('db down')
    expect(dbg[1].event).toBe('kline_fallback')
  })

  it('reportFallbackEvent: try 块同步异常 → catch debug 日志', () => {
    // payload JSON.stringify 抛错：注入循环引用属性到 extra
    const circ: Record<string, unknown> = { a: 1 }
    circ.self = circ
    // 但 extra 字段在 payload JSON stringify 之前没有被访问；
    // 要让 try 内同步抛错，让 Math.random 抛错是个办法（不优雅）。
    // 另：spy Date.now 然后 throw（但会污染时间戳）。
    // 替代：直接 stub traceId 相关抛错（更易回滚）
    const origRandom = Math.random
    try {
      Math.random = () => { throw new EvalError('bad random') }
      reportFallbackEvent({
        actor: 'x', logger, event: 'e', target: { type: 't', code: 'c' }, extra: circ,
      })
    } finally {
      Math.random = origRandom
    }
    const dbg = (logger.debug as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(dbg[0]).toContain('报告函数异常')
    expect(dbg[1].error).toBe('bad random')
  })

  it('reportFallbackForSymbol → target { type: "stock", code: symbol }', () => {
    reportFallbackForSymbol({
      actor: 'f', symbol: '00700.HK', logger, event: 'kline_fallback',
      fromTo: { from: 1, to: 2 }, reason: 'R', extra: { x: 1 },
    })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [, ctx] = (logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(ctx.target).toEqual({ type: 'stock', code: '00700.HK' })
    expect(ctx.from).toBe(1)
    expect(ctx.to).toBe(2)
  })
})

// ============================================================
// describe 8: queryFallbackLogs & exportFallbackLogsToCsv
// ============================================================
describe('logHelpers (8) queryFallbackLogs & exportFallbackLogsToCsv', () => {
  let logger: LoggerRet
  let urlCreateSpy: ReturnType<typeof vi.fn>
  let urlRevokeSpy: ReturnType<typeof vi.fn>
  let appendChildSpy: ReturnType<typeof vi.fn>
  let removeChildSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearAllLogs()
    vi.mocked(loggerMod.getLogger).mockClear()
    const info = vi.fn()
    const debug = vi.fn()
    const warn = vi.fn()
    const error = vi.fn()
    logger = { info, debug, warn, error } as unknown as LoggerRet
    vi.mocked(loggerMod.getLogger).mockReturnValue(logger)

    // DOM & URL 桩
    clickSpy = vi.fn()
    appendChildSpy = vi.fn()
    removeChildSpy = vi.fn()
    const fakeLink = { href: '', download: '', click: clickSpy }
    const createElSpy = vi.fn().mockReturnValue(fakeLink)
    vi.stubGlobal('document', {
      createElement: createElSpy,
      body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
    })
    urlCreateSpy = vi.fn().mockReturnValue('blob:fake-url')
    urlRevokeSpy = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: urlCreateSpy, revokeObjectURL: urlRevokeSpy })
    vi.stubGlobal('Blob', vi.fn().mockImplementation((parts: unknown[], opts: unknown) => ({ parts, opts })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('queryFallbackLogs: 默认 7 天；按时间倒序；action 非 fallback: 被过滤', async () => {
    const now = Date.now()
    const allLogs: ResearchLog[] = [
      { traceId: 'a', timestamp: now - 8 * 86400000, actor: 'X', action: 'fallback:kline_fallback', targetType: 'stock', targetCode: '1', payload: '' }, // 过期 8d
      { traceId: 'b', timestamp: now - 1000, actor: 'X', action: 'fallback:chip_fallback', targetType: 'stock', targetCode: '2', payload: '' }, // 新
      { traceId: 'c', timestamp: now - 3600000, actor: 'X', action: 'saveReport', targetType: 'report', targetCode: '3', payload: '' }, // 非 fallback:
      { traceId: 'd', timestamp: now - 2000, actor: 'X', action: 'fallback:kline_price_sanitize', targetType: 'stock', targetCode: '4', payload: '' }, // 中
    ]
    vi.mocked(dlhMod.queryList).mockResolvedValueOnce(allLogs)
    const r = await queryFallbackLogs(7)
    expect(dlhMod.queryList).toHaveBeenCalledWith('research_logs')
    expect(r.map(x => x.traceId)).toEqual(['b', 'd']) // 新 → 中
  })

  it('queryFallbackLogs: 自定义天数 30', async () => {
    const now = Date.now()
    const log15: ResearchLog = {
      traceId: '15', timestamp: now - 15 * 86400000, actor: 'A',
      action: 'fallback:x', targetType: 't', targetCode: 'c', payload: '',
    }
    vi.mocked(dlhMod.queryList).mockResolvedValueOnce([log15])
    const r = await queryFallbackLogs(30)
    expect(r).toHaveLength(1)
  })

  it('exportFallbackLogsToCsv: 0 条 → warn + return 0（DOM 不调用）', async () => {
    vi.mocked(dlhMod.queryList).mockResolvedValueOnce([])
    const n = await exportFallbackLogsToCsv(7)
    expect(n).toBe(0)
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(urlCreateSpy).not.toHaveBeenCalled()
  })

  it('exportFallbackLogsToCsv: 多条 → 正确 header + escape + BOM + DOM 流程', async () => {
    const now = Date.now()
    const logs: ResearchLog[] = [
      {
        traceId: 'good', timestamp: now, actor: 'svcA', action: 'fallback:kline_fallback',
        targetType: 'stock', targetCode: '600519',
        payload: JSON.stringify({ event: 'kline_fallback', fallbackFrom: 'T', fallbackTo: 'S', reason: 'quote 空' }),
      },
      {
        traceId: 'bad', timestamp: now + 1000, actor: 'svcB', action: 'fallback:chip_fallback',
        targetType: 'stock', targetCode: '00700',
        payload: 'NOT VALID JSON', // parse 失败 → rawPayload
      },
      {
        traceId: 'dangerous', timestamp: now + 2000, actor: 'svcC', action: 'fallback:x',
        targetType: 'stock', targetCode: 'CSV',
        payload: JSON.stringify({ event: 'x', fallbackFrom: '=SUM(1,2)', fallbackTo: '+1', reason: '含有,"新行\n' }),
      },
    ]
    vi.mocked(dlhMod.queryList).mockResolvedValueOnce(logs)
    const n = await exportFallbackLogsToCsv(14)
    expect(n).toBe(3)

    // Blob & URL & DOM 调用链验证
    expect(Blob).toHaveBeenCalledTimes(1)
    const blobArg = (Blob as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const csvContent = blobArg[0][0] as string
    expect(csvContent.startsWith('\uFEFF')).toBe(true) // BOM

    const lines = csvContent.slice(1).split('\n')
    expect(lines[0]).toBe(
      'timestamp,traceId,actor,action,targetType,targetCode,event,fallbackFrom,fallbackTo,reason,payload',
    )
    // 注意：queryFallbackLogs 按 timestamp 倒序（新→旧），顺序：dangerous → bad → good
    // dangerous 行 reason 有真实 \n → 被引号包裹但 split('\n') 仍多产生 1-2 行，
    // 故不用固定 index 断言，用 some/includes 避免脆弱匹配
    const flatJoined = lines.join('|')
    expect(flatJoined).toContain('chip_fallback')      // bad 的 event（action=fallback:chip_fallback → 解析失败 → 从 action 取）
    expect(flatJoined).toContain('NOT VALID JSON')
    expect(flatJoined).toContain('kline_fallback')
    expect(flatJoined).toContain('quote 空')

    // 第三条危险前缀 + 引号逗号换行
    // 从整个 lines 中取包含 fallbackFrom: =SUM 的片段做局部断言
    const dangerousPart = lines.find(l => l.includes('SUM(1,2)')) ?? ''
    expect(dangerousPart).toContain("'=SUM(1,2)") // = 前缀加 '
    expect(dangerousPart).toContain("'+1")          // + 前缀加 '
    // reason 字段原含 '"' → escape 后替换为 ""，即两个双引号（不是三个）
    expect(dangerousPart).toContain('""')
    expect(dangerousPart).toContain('含有')         // 中文原因保留

    // DOM 流程
    expect(urlCreateSpy).toHaveBeenCalledTimes(1)
    expect(appendChildSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeChildSpy).toHaveBeenCalledTimes(1)
    expect(urlRevokeSpy).toHaveBeenCalledWith('blob:fake-url')

    expect(logger.info).toHaveBeenCalledTimes(1)
    const infoArg = (logger.info as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>
    expect(infoArg.rows).toBe(3)
    expect(infoArg.days).toBe(14)
  })
})
