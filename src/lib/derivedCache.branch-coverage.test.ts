/**
 * @test_id V9-TEST-BRANCH-DERIVEDCACHE
 * derivedCache 分支覆盖率补充测试
 *
 * 覆盖目标：
 *   1. memoizeByRef 缓存命中/未命中/引用变化分支
 *   2. memoizeByKey 缓存命中/未命中分支
 *   3. buildGroupIndex 分组存在/不存在分支
 *   4. safeLength null/undefined 分支
 *   5. safeDivide 除数为 0 分支
 *   6. average 空数组分支
 *   7. refHash null/undefined 分支（通过 VERBOSE 日志间接覆盖）
 *   8. resetAllMemoCaches 重置后必 miss
 *   9. getCacheStatsSnapshot 统计快照
 */
import { describe, it, expect, beforeEach } from 'vitest'
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

describe('derivedCache — 分支覆盖率补充', () => {
  beforeEach(() => {
    resetCacheStats()
    resetAllMemoCaches()
  })

  describe('memoizeByRef 缓存命中/未命中', () => {
    it('首次调用应 miss 并计算结果', () => {
      const fn = vi.fn((x: number) => x * 2)
      const memo = memoizeByRef(fn, 'test-miss')

      const result = memo(5)

      expect(result).toBe(10)
      expect(fn).toHaveBeenCalledTimes(1)

      const stats = getCacheStatsSnapshot()['test-miss']!
      expect(stats.misses).toBe(1)
      expect(stats.hits).toBe(0)
    })

    it('相同引用第二次调用应 hit 并返回缓存', () => {
      const fn = vi.fn((arr: number[]) => arr.length)
      const memo = memoizeByRef(fn, 'test-hit')
      const input = [1, 2, 3]

      memo(input)
      const result = memo(input) // 相同引用

      expect(result).toBe(3)
      expect(fn).toHaveBeenCalledTimes(1) // 只计算一次

      const stats = getCacheStatsSnapshot()['test-hit']!
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })

    it('引用变化后应 miss 并重新计算', () => {
      const fn = vi.fn((arr: number[]) => arr.length)
      const memo = memoizeByRef(fn, 'test-ref-change')

      memo([1, 2])
      memo([1, 2, 3]) // 新引用

      expect(fn).toHaveBeenCalledTimes(2)

      const stats = getCacheStatsSnapshot()['test-ref-change']!
      expect(stats.misses).toBe(2)
      expect(stats.hits).toBe(0)
    })

    it('resetAllMemoCaches 后应强制 miss', () => {
      const fn = vi.fn((x: number) => x + 1)
      const memo = memoizeByRef(fn, 'test-reset')

      memo(10)
      expect(fn).toHaveBeenCalledTimes(1)

      resetAllMemoCaches()

      memo(10) // 相同值但缓存已重置
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('memoizeByKey 缓存命中/未命中', () => {
    it('首次调用应 miss', () => {
      const fn = vi.fn((a: number, b: number) => a + b)
      const memo = memoizeByKey(fn, 'test-key-miss')

      const result = memo(1, 2)

      expect(result).toBe(3)
      expect(fn).toHaveBeenCalledTimes(1)

      const stats = getCacheStatsSnapshot()['test-key-miss']!
      expect(stats.misses).toBe(1)
    })

    it('相同参数第二次调用应 hit', () => {
      const fn = vi.fn((a: number, b: number) => a * b)
      const memo = memoizeByKey(fn, 'test-key-hit')

      memo(3, 4)
      const result = memo(3, 4) // 相同参数

      expect(result).toBe(12)
      expect(fn).toHaveBeenCalledTimes(1)

      const stats = getCacheStatsSnapshot()['test-key-hit']!
      expect(stats.hits).toBe(1)
    })

    it('不同参数应 miss', () => {
      const fn = vi.fn((a: number, b: number) => a - b)
      const memo = memoizeByKey(fn, 'test-key-diff')

      memo(5, 2)
      memo(10, 3) // 不同参数

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('buildIndex', () => {
    it('应正确构建索引 Map', () => {
      const list = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }]
      const index = buildIndex(list, (item) => item.id)

      expect(index.size).toBe(2)
      expect(index.get('a')?.v).toBe(1)
      expect(index.get('b')?.v).toBe(2)
    })

    it('空列表应返回空 Map', () => {
      const index = buildIndex([], () => 'x')
      expect(index.size).toBe(0)
    })
  })

  describe('buildGroupIndex 分组分支', () => {
    it('已存在的分组应 push 新元素', () => {
      const list = [
        { cat: 'A', v: 1 },
        { cat: 'A', v: 2 },
        { cat: 'B', v: 3 },
      ]
      const groups = buildGroupIndex(list, (item) => item.cat)

      expect(groups.size).toBe(2)
      expect(groups.get('A')).toHaveLength(2)
      expect(groups.get('B')).toHaveLength(1)
    })

    it('不存在的分组应创建新数组', () => {
      const list = [{ cat: 'X', v: 10 }]
      const groups = buildGroupIndex(list, (item) => item.cat)

      expect(groups.get('X')).toEqual([{ cat: 'X', v: 10 }])
    })

    it('空列表应返回空 Map', () => {
      const groups = buildGroupIndex([], () => 'x')
      expect(groups.size).toBe(0)
    })
  })

  describe('safeLength null/undefined 分支', () => {
    it('null 应返回 0', () => {
      expect(safeLength(null)).toBe(0)
    })

    it('undefined 应返回 0', () => {
      expect(safeLength(undefined)).toBe(0)
    })

    it('正常数组应返回长度', () => {
      expect(safeLength([1, 2, 3])).toBe(3)
    })

    it('空数组应返回 0', () => {
      expect(safeLength([])).toBe(0)
    })
  })

  describe('safeDivide 除数为 0 分支', () => {
    it('除数为 0 应返回 0', () => {
      expect(safeDivide(10, 0)).toBe(0)
    })

    it('正常除法应返回商', () => {
      expect(safeDivide(10, 2)).toBe(5)
    })

    it('除数为负数应正常计算', () => {
      expect(safeDivide(10, -2)).toBe(-5)
    })
  })

  describe('average 空数组分支', () => {
    it('空数组应返回 0', () => {
      expect(average([])).toBe(0)
    })

    it('正常数组应返回平均值', () => {
      expect(average([1, 2, 3, 4])).toBe(2.5)
    })

    it('单元素数组应返回该元素', () => {
      expect(average([42])).toBe(42)
    })
  })

  describe('getCacheStatsSnapshot', () => {
    it('应返回当前统计快照', () => {
      const fn = vi.fn((x: number) => x)
      const memo = memoizeByRef(fn, 'test-snapshot')

      memo(1)
      memo(1) // hit

      const snapshot = getCacheStatsSnapshot()

      expect(snapshot['test-snapshot']).toBeDefined()
      expect(snapshot['test-snapshot']!.hits).toBe(1)
      expect(snapshot['test-snapshot']!.misses).toBe(1)
      expect(snapshot['test-snapshot']!.totalCalls).toBe(2)
    })

    it('resetCacheStats 后快照应为空', () => {
      const fn = vi.fn((x: number) => x)
      memoizeByRef(fn, 'test-clear')(1)

      resetCacheStats()

      const snapshot = getCacheStatsSnapshot()
      expect(Object.keys(snapshot)).toHaveLength(0)
    })
  })
})
