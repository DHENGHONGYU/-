/**
 * lib/webVitals — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量 Round 3）：新增独立测试文件，不编辑/不删除已有测试。
 *
 * 关键修复（Round 3 triage，TD-023）：
 *   - 使用「静态 import 报告模块」+「vi.mock 在顶部」（Vitest 自动 hoist），而不是动态 require()。
 *     动态 require() 在 vi.restoreAllMocks() 后于后续 it() 中触发 MODULE_NOT_FOUND（Vite 模块缓存被清空），
 *     导致前 2 个 it 过、后面 6 个 it 均失败的假阳性现象。
 *
 * 被测文件 webVitals.ts：
 *   - 顶部 L1-L7 import web-vitals 5 个 onXxx + getLogger 并实例化 logger
 *   - 内部 reportWebVital() 调用 logger.info(`${name}:${delta.toFixed(2)} id=${id}`)
 *   - reportWebVitals() 一次调用 5 个 onXxx（L17-L21，共 5 条独立语句分支）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportWebVitals } from './webVitals'

type MetricCb = (m: { name: string; delta: number; id: string }) => void
type MetricFn = (cb: MetricCb) => void

const mockOnCLS = vi.fn<MetricFn>()
const mockOnFCP = vi.fn<MetricFn>()
const mockOnLCP = vi.fn<MetricFn>()
const mockOnTTFB = vi.fn<MetricFn>()
const mockOnINP = vi.fn<MetricFn>()

vi.mock('web-vitals', () => ({
  onCLS: (...a: any[]) => mockOnCLS(...a),
  onFCP: (...a: any[]) => mockOnFCP(...a),
  onLCP: (...a: any[]) => mockOnLCP(...a),
  onTTFB: (...a: any[]) => mockOnTTFB(...a),
  onINP: (...a: any[]) => mockOnINP(...a),
}))

const mockInfo = vi.fn()
vi.mock('./logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: (...a: any[]) => mockInfo(...a),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('lib/webVitals', () => {
  beforeEach(() => {
    mockOnCLS.mockClear(); mockOnFCP.mockClear(); mockOnLCP.mockClear()
    mockOnTTFB.mockClear(); mockOnINP.mockClear()
    mockInfo.mockClear()
    // 每次调用 reportWebVitals 会重新触发 5 个 onXxx 注册。
    // 注意：因为 reportWebVitals 是普通函数（不是幂等单例），每次会调用 5 个 mock 函数。
  })

  describe('reportWebVitals() — 5 个 onXxx 注册', () => {
    it('调用 1 次 → 5 个 onXxx 各被调用 1 次，每个参数都是 callback 函数', () => {
      reportWebVitals()
      expect(mockOnCLS).toHaveBeenCalledTimes(1)
      expect(mockOnFCP).toHaveBeenCalledTimes(1)
      expect(mockOnLCP).toHaveBeenCalledTimes(1)
      expect(mockOnTTFB).toHaveBeenCalledTimes(1)
      expect(mockOnINP).toHaveBeenCalledTimes(1)
      expect(typeof mockOnCLS.mock.calls[0][0]).toBe('function')
      expect(typeof mockOnFCP.mock.calls[0][0]).toBe('function')
      expect(typeof mockOnLCP.mock.calls[0][0]).toBe('function')
      expect(typeof mockOnTTFB.mock.calls[0][0]).toBe('function')
      expect(typeof mockOnINP.mock.calls[0][0]).toBe('function')
    })

    it('onCLS 回调触发 → logger.info 输出 name / delta.toFixed(2) / id', () => {
      reportWebVitals()
      const cb = mockOnCLS.mock.calls[0][0] as MetricCb
      cb({ name: 'CLS', delta: 0.05123456, id: 'v3-cls-id' })
      expect(mockInfo).toHaveBeenCalledTimes(1)
      const line = mockInfo.mock.calls[0][0] as string
      expect(line).toContain('[WebVitals]')
      expect(line).toContain('CLS')
      expect(line).toContain('0.05') // toFixed(2)
      expect(line).toContain('id=v3-cls-id')
    })

    it('onFCP 回调触发 → delta=整数 123 → toFixed(2) 补 2 位 123.00', () => {
      reportWebVitals()
      const cb = mockOnFCP.mock.calls[0][0] as MetricCb
      cb({ name: 'FCP', delta: 123, id: 'fcp-abc' })
      const line = mockInfo.mock.calls[0][0] as string
      expect(line).toContain('FCP')
      expect(line).toContain('123.00')
      expect(line).toContain('id=fcp-abc')
    })

    it('onLCP 回调触发 → delta=2500.5（半整数）→ 2500.50', () => {
      reportWebVitals()
      const cb = mockOnLCP.mock.calls[0][0] as MetricCb
      cb({ name: 'LCP', delta: 2500.5, id: 'lcp-xyz' })
      const line = mockInfo.mock.calls[0][0] as string
      expect(line).toContain('LCP')
      expect(line).toContain('2500.50')
      expect(line).toContain('id=lcp-xyz')
    })

    it('onTTFB 回调触发 → delta=30.126 → 四舍五入 30.13', () => {
      reportWebVitals()
      const cb = mockOnTTFB.mock.calls[0][0] as MetricCb
      cb({ name: 'TTFB', delta: 30.126, id: 'ttfb-x' })
      const line = mockInfo.mock.calls[0][0] as string
      expect(line).toContain('TTFB')
      expect(line).toContain('30.13')
      expect(line).toContain('id=ttfb-x')
    })

    it('onINP 回调触发（第 5 条语句 L21 的独立覆盖）→ delta=0.499 → 0.50', () => {
      reportWebVitals()
      const cb = mockOnINP.mock.calls[0][0] as MetricCb
      cb({ name: 'INP', delta: 0.499, id: 'inp-m1' })
      const line = mockInfo.mock.calls[0][0] as string
      expect(line).toContain('INP')
      expect(line).toContain('0.50')
      expect(line).toContain('id=inp-m1')
    })

    it('多次回调顺序稳定 → 3 次触发 logger.info，按 a,b,c 顺序输出 id', () => {
      reportWebVitals()
      ;(mockOnCLS.mock.calls[0][0] as MetricCb)({ name: 'CLS', delta: 0.01, id: 'a' })
      ;(mockOnLCP.mock.calls[0][0] as MetricCb)({ name: 'LCP', delta: 1, id: 'b' })
      ;(mockOnINP.mock.calls[0][0] as MetricCb)({ name: 'INP', delta: 2, id: 'c' })
      expect(mockInfo).toHaveBeenCalledTimes(3)
      const ids = mockInfo.mock.calls.map(c => {
        const m = /id=([^\s)]+)/.exec(c[0] as string)
        return m ? m[1] : null
      })
      expect(ids).toEqual(['a', 'b', 'c'])
    })

    it('连续调用 2 次 reportWebVitals → 每个 onXxx 都被调用 2 次（幂等非单例语义）', () => {
      reportWebVitals()
      reportWebVitals()
      expect(mockOnCLS).toHaveBeenCalledTimes(2)
      expect(mockOnFCP).toHaveBeenCalledTimes(2)
      expect(mockOnLCP).toHaveBeenCalledTimes(2)
      expect(mockOnTTFB).toHaveBeenCalledTimes(2)
      expect(mockOnINP).toHaveBeenCalledTimes(2)
    })
  })
})
