import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  memoizeByRef,
  memoizeByKey,
  buildIndex,
  buildGroupIndex,
  safeLength,
  safeDivide,
  average,
  resetCacheStats,
  resetAllMemoCaches,
  getCacheStatsSnapshot,
} from './derivedCache'

describe('derivedCache', () => {
  beforeEach(() => {
    resetCacheStats()
    resetAllMemoCaches()
  })

  describe('memoizeByRef()', () => {
    it('相同引用直接返回缓存结果', () => {
      const fn = vi.fn((arr: number[]) => arr.reduce((s, v) => s + v, 0))
      const memoized = memoizeByRef(fn, 'sumTest')
      const arr = [1, 2, 3]
      const r1 = memoized(arr)
      const r2 = memoized(arr)
      expect(r1).toBe(6)
      expect(r2).toBe(6)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('不同引用重新计算', () => {
      const fn = vi.fn((arr: number[]) => arr.length)
      const memoized = memoizeByRef(fn, 'lenTest')
      memoized([1, 2])
      memoized([1, 2, 3])
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('缓存命中统计正确', () => {
      const fn = vi.fn((x: number[]) => x[0])
      const memoized = memoizeByRef(fn, 'statsTest')
      const arr = [10]
      memoized(arr) // miss
      memoized(arr) // hit
      memoized(arr) // hit
      const stats = getCacheStatsSnapshot()
      expect(stats['statsTest']!.hits).toBe(2)
      expect(stats['statsTest']!.misses).toBe(1)
      expect(stats['statsTest']!.totalCalls).toBe(3)
    })
  })

  describe('memoizeByKey()', () => {
    it('相同参数返回缓存结果', () => {
      const fn = vi.fn((a: number, b: number) => a + b)
      const memoized = memoizeByKey(fn, 'addTest')
      const r1 = memoized(1, 2)
      const r2 = memoized(1, 2)
      expect(r1).toBe(3)
      expect(r2).toBe(3)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('不同参数重新计算', () => {
      const fn = vi.fn((a: number, b: number) => a * b)
      const memoized = memoizeByKey(fn, 'mulTest')
      memoized(2, 3)
      memoized(4, 5)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('缓存命中统计正确', () => {
      const fn = vi.fn((x: number) => x * x)
      const memoized = memoizeByKey(fn, 'squareTest')
      memoized(5) // miss
      memoized(5) // hit
      memoized(6) // miss
      memoized(5) // hit
      const stats = getCacheStatsSnapshot()
      expect(stats['squareTest']!.hits).toBe(2)
      expect(stats['squareTest']!.misses).toBe(2)
    })
  })

  describe('buildIndex()', () => {
    it('按 key 建立 Map 索引', () => {
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ]
      const idx = buildIndex(items, item => item.id)
      expect(idx.get(1)?.name).toBe('a')
      expect(idx.get(2)?.name).toBe('b')
      expect(idx.size).toBe(2)
    })

    it('key 相同时后面的覆盖前面的', () => {
      const items = [
        { id: 1, name: 'first' },
        { id: 1, name: 'second' },
      ]
      const idx = buildIndex(items, item => item.id)
      expect(idx.get(1)?.name).toBe('second')
    })

    it('空数组返回空 Map', () => {
      const idx = buildIndex([], (x: { id: number }) => x.id)
      expect(idx.size).toBe(0)
    })
  })

  describe('buildGroupIndex()', () => {
    it('按 key 分组', () => {
      const items = [
        { type: 'a', val: 1 },
        { type: 'b', val: 2 },
        { type: 'a', val: 3 },
      ]
      const idx = buildGroupIndex(items, item => item.type)
      expect(idx.get('a')).toHaveLength(2)
      expect(idx.get('b')).toHaveLength(1)
      expect(idx.get('a')?.[0]?.val).toBe(1)
      expect(idx.get('a')?.[1]?.val).toBe(3)
    })

    it('空数组返回空 Map', () => {
      const idx = buildGroupIndex([], (x: { type: string }) => x.type)
      expect(idx.size).toBe(0)
    })
  })

  describe('safeLength()', () => {
    it('正常数组返回长度', () => {
      expect(safeLength([1, 2, 3])).toBe(3)
    })

    it('null 返回 0', () => {
      expect(safeLength(null)).toBe(0)
    })

    it('undefined 返回 0', () => {
      expect(safeLength(undefined)).toBe(0)
    })

    it('空数组返回 0', () => {
      expect(safeLength([])).toBe(0)
    })
  })

  describe('safeDivide()', () => {
    it('正常除法', () => {
      expect(safeDivide(10, 2)).toBe(5)
    })

    it('除数为 0 返回 0', () => {
      expect(safeDivide(10, 0)).toBe(0)
    })

    it('负数除法', () => {
      expect(safeDivide(-10, 2)).toBe(-5)
    })
  })

  describe('average()', () => {
    it('计算平均值', () => {
      expect(average([1, 2, 3, 4, 5])).toBe(3)
    })

    it('空数组返回 0', () => {
      expect(average([])).toBe(0)
    })

    it('单元素返回该元素', () => {
      expect(average([42])).toBe(42)
    })
  })
})
