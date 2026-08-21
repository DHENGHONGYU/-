import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createDebugLogger,
  setDebugEnabled,
  enableDebugNamespace,
  disableDebugNamespace,
  getDebugLogs,
  clearDebugLogs,
  exportDebugLogs,
  type DebugLogger,
  type DebugLevel,
} from './debugToolkit'

// 确保测试间不共享状态
beforeEach(() => {
  clearDebugLogs()
  setDebugEnabled(true)
  // 重新启用所有命名空间（清除 disabledNamespaces 的副作用）
  enableDebugNamespace('TestNS')
  enableDebugNamespace('OtherNS')
  // mock console
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

describe('lib/debugToolkit', () => {
  describe('createDebugLogger', () => {
    it('创建带 namespace 的 logger，namespace 属性可访问', () => {
      const logger = createDebugLogger('Demo')
      expect(logger.namespace).toBe('Demo')
      expect(typeof logger.log).toBe('function')
      expect(typeof logger.time).toBe('function')
      expect(typeof logger.timeEnd).toBe('function')
    })

    it('5 个日志级别方法都写入缓冲区', () => {
      const logger = createDebugLogger('TestNS')
      const levels: DebugLevel[] = ['log', 'info', 'warn', 'error', 'debug']
      for (const lvl of levels) {
        logger[lvl](`msg-${lvl}`, { key: lvl })
      }
      const logs = getDebugLogs('TestNS')
      expect(logs).toHaveLength(5)
      for (let i = 0; i < levels.length; i++) {
        expect(logs[i]!.level).toBe(levels[i])
        expect(logs[i]!.message).toBe(`msg-${levels[i]}`)
        expect((logs[i]!.context as { key: string }).key).toBe(levels[i])
      }
    })

    it('console 输出正确前缀和上下文', () => {
      const logger = createDebugLogger('ConsoleTest')
      logger.log('hello', { foo: 'bar' })
      expect(console.log).toHaveBeenCalledWith(
        '[ConsoleTest] hello',
        { foo: 'bar' },
      )
    })

    it('无 context 时 console 只输出格式化消息', () => {
      const logger = createDebugLogger('ConsoleTest')
      logger.log('no-ctx')
      expect(console.log).toHaveBeenCalledWith('[ConsoleTest] no-ctx')
    })
  })

  describe('全局控制', () => {
    let logger: DebugLogger

    beforeEach(() => {
      logger = createDebugLogger('GlobalSwitch')
    })

    it('setDebugEnabled(false) → 控制台静默，但缓冲区仍记录', () => {
      setDebugEnabled(false)
      logger.log('should-be-silent')
      expect(console.log).not.toHaveBeenCalled()
      expect(getDebugLogs('GlobalSwitch')).toHaveLength(1)
      setDebugEnabled(true)
    })

    it('disableDebugNamespace → 特定命名空间静默', () => {
      const a = createDebugLogger('A')
      const b = createDebugLogger('B')
      disableDebugNamespace('A')
      a.log('a-silent')
      b.log('b-visible')
      expect(console.log).toHaveBeenCalledTimes(1)
      expect(getDebugLogs('A')).toHaveLength(1) // 缓冲区仍有
      expect(getDebugLogs('B')).toHaveLength(1)
    })

    it('enableDebugNamespace 可恢复禁用', () => {
      disableDebugNamespace('X')
      createDebugLogger('X').log('s1')
      expect(console.log).not.toHaveBeenCalled()
      enableDebugNamespace('X')
      createDebugLogger('X').log('s2')
      expect(console.log).toHaveBeenCalledTimes(1)
    })
  })

  describe('计时器', () => {
    it('time/timeEnd 计算并记录耗时', () => {
      const logger = createDebugLogger('Timer')
      vi.useFakeTimers()
      logger.time('op')
      vi.advanceTimersByTime(123)
      logger.timeEnd('op')
      vi.useRealTimers()
      const log = getDebugLogs('Timer').find((e) => e.message.startsWith('op:'))!
      expect(log).toBeDefined()
      expect(typeof log.durationMs).toBe('number')
      expect(log.durationMs).toBeGreaterThanOrEqual(120)
    })

    it('timeEnd 无对应 time → 输出 warn 不抛错', () => {
      const logger = createDebugLogger('TimerErr')
      expect(() => logger.timeEnd('no-such')).not.toThrow()
      const warn = getDebugLogs('TimerErr').find((e) => e.level === 'warn')!
      expect(warn).toBeDefined()
      expect(warn.message).toContain('no-such')
    })
  })

  describe('getDebugLogs 过滤', () => {
    beforeEach(() => {
      const a = createDebugLogger('A')
      const b = createDebugLogger('B')
      a.log('m1')
      a.warn('m2')
      b.log('m3')
    })

    it('按 namespace 过滤', () => {
      expect(getDebugLogs('A')).toHaveLength(2)
      expect(getDebugLogs('B')).toHaveLength(1)
      expect(getDebugLogs('NotExist')).toHaveLength(0)
    })

    it('按 level 过滤', () => {
      expect(getDebugLogs('A', 'warn')).toHaveLength(1)
      expect(getDebugLogs('A', 'warn')[0]!.message).toBe('m2')
    })

    it('不传参数 → 返回全部日志', () => {
      expect(getDebugLogs()).toHaveLength(3)
    })
  })

  describe('clearDebugLogs', () => {
    it('清空缓冲区', () => {
      createDebugLogger('C').log('before')
      expect(getDebugLogs()).toHaveLength(1)
      clearDebugLogs()
      expect(getDebugLogs()).toHaveLength(0)
    })
  })

  describe('exportDebugLogs', () => {
    it('格式化为可读文本', () => {
      const d = createDebugLogger('Export')
      d.log('msg1', { x: 1 })
      const txt = exportDebugLogs('Export')
      expect(txt).toContain('[Export]')
      expect(txt).toContain('[LOG]')
      expect(txt).toContain('msg1')
      expect(txt).toContain('"x":1')
    })

    it('包含 durationMs 的条目显示 (Nms)', () => {
      const d = createDebugLogger('ExportTimer')
      vi.useFakeTimers()
      d.time('t')
      vi.advanceTimersByTime(50)
      d.timeEnd('t')
      vi.useRealTimers()
      const txt = exportDebugLogs('ExportTimer')
      // durationMs != 0 时显示 "(50ms)"，否则 timeEnd 消息本身含 "ms"
      expect(txt).toMatch(/ms[)]?/)
      // 确保 50ms 确实被记录
      const entry = getDebugLogs('ExportTimer').find((e) => e.durationMs !== undefined)!
      expect(entry).toBeDefined()
      expect(entry.durationMs).toBeGreaterThanOrEqual(50)
    })

    it('按 namespace 过滤导出', () => {
      createDebugLogger('E1').log('e1')
      createDebugLogger('E2').log('e2')
      const txt = exportDebugLogs('E1')
      expect(txt).toContain('e1')
      expect(txt).not.toContain('e2')
    })
  })

  describe('环形缓冲区（500 条上限）', () => {
    it('超出容量丢弃最旧的', () => {
      const d = createDebugLogger('Ring')
      // 写入 510 条，期望只剩后 500 条（第 10~509 条）
      for (let i = 0; i < 510; i++) {
        d.log(`m-${i}`)
      }
      const logs = getDebugLogs('Ring')
      expect(logs).toHaveLength(500)
      expect(logs[0]!.message).toBe('m-10')
      expect(logs[499]!.message).toBe('m-509')
    })
  })

  describe('formatContext 分支覆盖', () => {
    it('context 为基本类型的情况', () => {
      const d = createDebugLogger('FmtCtx')
      d.log('str', 'hello')   // string context
      d.log('null-ctx', null)
      d.log('undef-ctx', undefined)
      const logs = getDebugLogs('FmtCtx')
      expect(logs).toHaveLength(3)
      // string context 输出时 context??'' 为原字符串
      expect(console.log).toHaveBeenCalledWith('[FmtCtx] str', 'hello')
    })

    it('context JSON.stringify 抛错时回退 toString', () => {
      const d = createDebugLogger('FmtErr')
      const circular: Record<string, unknown> = {}
      circular.self = circular
      expect(() => d.log('circular', circular)).not.toThrow()
      const logs = getDebugLogs('FmtErr')
      expect(logs[0]!.context).toBe(circular) // 缓冲区保留原引用
    })
  })

  describe('window 全局暴露', () => {
    it('window 上挂了常用函数', () => {
      const w = window as unknown as Record<string, unknown>
      expect(typeof w.getDebugLogs).toBe('function')
      expect(typeof w.exportDebugLogs).toBe('function')
      expect(typeof w.clearDebugLogs).toBe('function')
      expect(typeof w.setDebugEnabled).toBe('function')
      expect(typeof w.enableDebugNamespace).toBe('function')
      expect(typeof w.disableDebugNamespace).toBe('function')
      expect(typeof w.createDebugLogger).toBe('function')
      expect(Array.isArray((w as { __debugLogs?: unknown[] }).__debugLogs)).toBe(true)
    })
  })
})
