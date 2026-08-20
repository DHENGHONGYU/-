/**
 * lib/seededRandom — 单元测试
 * 只增不删策略（TD-022 覆盖率增量 Round 3+）。
 *
 * 覆盖目标：
 *  - createSeededRandom(seed)：mulberry32 算法确定性，不同 seed 差异
 *  - randInt(min, max, rng)：含/不含自定义 rng，边界命中
 *  - shuffle(arr, rng)：Fisher-Yates，含 null/undefined 洞 → continue 分支
 *  - pickRandom(arr, count, rng)：取前 N 个
 */
import { describe, it, expect } from 'vitest'
import { createSeededRandom, randInt, shuffle, pickRandom } from './seededRandom'

describe('lib/seededRandom', () => {
  describe('createSeededRandom(seed) — 确定性', () => {
    it('相同 seed → 相同序列（mulberry32 再现）', () => {
      const r1 = createSeededRandom(12345)
      const r2 = createSeededRandom(12345)
      const seq1 = Array.from({ length: 5 }, () => r1())
      const seq2 = Array.from({ length: 5 }, () => r2())
      expect(seq1).toEqual(seq2)
    })

    it('不同 seed → 大概率序列不同', () => {
      const a = createSeededRandom(1)
      const b = createSeededRandom(2)
      // 取前 3 个至少 1 个不同的概率极高
      const diff = Array.from({ length: 3 }, () => a() !== b()).some(Boolean)
      expect(diff).toBe(true)
    })

    it('产出范围 [0, 1)，1000 样本无一 ≥ 1 或 < 0', () => {
      const r = createSeededRandom(777)
      for (let i = 0; i < 1000; i++) {
        const v = r()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    })

    it('seed 非整数时，seed | 0 → 取整', () => {
      const a = createSeededRandom(42.9)
      const b = createSeededRandom(42)
      expect(a()).toBe(b())
    })

    it('seed=负整数 → 仍能产出 [0,1) 值', () => {
      const r = createSeededRandom(-1)
      const v = r()
      expect(v >= 0 && v < 1).toBe(true)
    })
  })

  describe('randInt(min, max, rng?)', () => {
    it('rng 恒 0 → 产出 min（Math.floor(0*(N)) + min）', () => {
      expect(randInt(5, 10, () => 0)).toBe(5)
    })
    it('rng 恒 0.99999 → 靠近 max（floor(0.99999*6)=5 → 5+5=10）', () => {
      expect(randInt(5, 10, () => 0.999_999)).toBe(10)
    })
    it('默认 rng=Math.random → 100 次取值都在 [min,max]（闭区间）', () => {
      for (let i = 0; i < 100; i++) {
        const v = randInt(0, 9)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(9)
        expect(Number.isInteger(v)).toBe(true)
      }
    })
    it('min === max → 无论 rng 返回啥，结果恒等于 min', () => {
      expect(randInt(3, 3, () => 0)).toBe(3)
      expect(randInt(3, 3, () => 0.9)).toBe(3)
    })
  })

  describe('shuffle(arr, rng?) — Fisher-Yates', () => {
    it('不修改原数组 → 返回新数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const clone = [...arr]
      const out = shuffle(arr, createSeededRandom(10))
      expect(arr).toEqual(clone) // 原数组不变
      expect(out).not.toBe(arr) // 返回新引用
    })
    it('与确定性 rng：相同 rng → 相同 shuffle 结果', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const a = shuffle(arr, createSeededRandom(42))
      const b = shuffle(arr, createSeededRandom(42))
      expect(a).toEqual(b)
    })
    it('含 null 洞 → L32 `if (si == null || sj == null) continue` 分支命中', () => {
      const arr: (number | null)[] = [1, null, 3]
      const rng = createSeededRandom(1)
      // 多跑几次以保证一定概率命中 j=1 (null) 与 i 交换
      for (let i = 0; i < 50; i++) {
        const out = shuffle(arr, rng)
        expect(out.length).toBe(3)
        // null 仍然存在，没被破坏掉
        expect(out.some(v => v === null)).toBe(true)
      }
    })
    it('空数组 → 空数组', () => {
      expect(shuffle([])).toEqual([])
    })
    it('单元素数组 → 单元素原义', () => {
      expect(shuffle([42])).toEqual([42])
    })
  })

  describe('pickRandom(arr, count, rng?)', () => {
    it('长度 = count（count ≤ arr.length）', () => {
      const arr = [1, 2, 3, 4, 5]
      const out = pickRandom(arr, 3, createSeededRandom(3))
      expect(out).toHaveLength(3)
      expect(out.every(x => arr.includes(x))).toBe(true)
    })
    it('count > arr.length → 返回 arr.length 个元素（不会越界）', () => {
      const arr = [1, 2]
      const out = pickRandom(arr, 100, createSeededRandom(7))
      expect(out).toHaveLength(2)
    })
    it('count = 0 → 空数组', () => {
      expect(pickRandom([1, 2, 3], 0)).toEqual([])
    })
  })
})
