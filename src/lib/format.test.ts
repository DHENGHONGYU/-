/**
 * lib/format — 单元测试
 * 只增不删策略（TD-022 覆盖率增量 Round 3+）：新增独立测试，不编辑旧测试。
 *
 * 覆盖目标：
 *  - formatFieldValue：7 条分支 (undefined/null/number/string/boolean/bigint/symbol/object fallback)
 *  - formatRelativeTime：4 条时间分支（刚刚 / 分钟前 / 小时前 / 天前）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatFieldValue, formatRelativeTime } from './format'

describe('lib/format', () => {
  describe('formatFieldValue(value: unknown) → string', () => {
    it('value undefined → 返回 "—"', () => expect(formatFieldValue(undefined)).toBe('—'))
    it('value null → 返回 "—"', () => expect(formatFieldValue(null)).toBe('—'))

    it('value: number → toString()', () => {
      expect(formatFieldValue(42)).toBe('42')
      expect(formatFieldValue(0)).toBe('0')
      expect(formatFieldValue(-3.14)).toBe('-3.14')
    })

    it('value: string → 原样返回', () => {
      expect(formatFieldValue('hello')).toBe('hello')
      expect(formatFieldValue('')).toBe('')
    })

    it('value: boolean → toString() "true"/"false"', () => {
      expect(formatFieldValue(true)).toBe('true')
      expect(formatFieldValue(false)).toBe('false')
    })

    it('value: bigint → toString()', () => {
      expect(formatFieldValue(BigInt(12345))).toBe('12345')
      expect(formatFieldValue(BigInt(-1))).toBe('-1')
    })

    it('value: symbol → toString()', () => {
      expect(formatFieldValue(Symbol.for('demo'))).toBe('Symbol(demo)')
    })

    it('value: object (含自定义 toString) → String(value) 回退分支', () => {
      const obj = { toString() { return 'custom-obj' } }
      expect(formatFieldValue(obj)).toBe('custom-obj')
    })

    it('value: plain object {} → String({}) = "[object Object]"', () => {
      expect(formatFieldValue({})).toBe('[object Object]')
    })

    it('value: Date 对象 → 调用 String(Date) 回退分支', () => {
      const d = new Date(Date.UTC(2026, 0, 1))
      const s = formatFieldValue(d)
      // 只验证是字符串且包含 "2026"，不精确到时区差异
      expect(typeof s).toBe('string')
      expect(s).toContain('2026')
    })

    it('value: [] 数组 → String([]) = ""', () => {
      expect(formatFieldValue([])).toBe('')
    })
  })

  describe('formatRelativeTime(ts: ms) → 相对时间', () => {
    const NOW_MS = Date.UTC(2026, 6, 20, 10, 0, 0) // 2026-07-20 10:00:00 UTC
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW_MS)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('刚刚（diff < 60s）：ts = 现在之前 30s', () => {
      expect(formatRelativeTime(NOW_MS - 30_000)).toBe('刚刚')
    })

    it('刚刚（diff = 0，完全现在）', () => {
      expect(formatRelativeTime(NOW_MS)).toBe('刚刚')
    })

    it('分钟前：diff = 2*60+15 s → "2分钟前"', () => {
      expect(formatRelativeTime(NOW_MS - (2 * 60_000 + 15_000))).toBe('2分钟前')
    })

    it('分钟前：diff 刚好 1 min（边界值）→ "1分钟前"', () => {
      expect(formatRelativeTime(NOW_MS - 60_000)).toBe('1分钟前')
    })

    it('小时前：diff = 3h+5min → "3小时前"', () => {
      expect(formatRelativeTime(NOW_MS - (3 * 3_600_000 + 5 * 60_000))).toBe('3小时前')
    })

    it('小时前：diff 刚好 1h（边界值 3600s）→ "1小时前"', () => {
      expect(formatRelativeTime(NOW_MS - 3_600_000)).toBe('1小时前')
    })

    it('天前：diff = 2d + 10h → "2天前"', () => {
      expect(formatRelativeTime(NOW_MS - (2 * 86_400_000 + 10 * 3_600_000))).toBe('2天前')
    })

    it('天前：diff 刚好 1d（86400s）边界值 → "1天前"', () => {
      expect(formatRelativeTime(NOW_MS - 86_400_000)).toBe('1天前')
    })

    it('未来时间戳（diff 负）：floor(-x/1000) ≤ 0 秒 → "刚刚"', () => {
      expect(formatRelativeTime(NOW_MS + 5_000)).toBe('刚刚')
    })
  })
})
