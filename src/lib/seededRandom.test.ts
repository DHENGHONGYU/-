import { describe, it, expect } from 'vitest'
import { createSeededRandom, randInt, shuffle, pickRandom } from './seededRandom'

describe('seededRandom', () => {
  describe('createSeededRandom()', () => {
    it('相同种子产生相同序列', () => {
      const gen1 = createSeededRandom(42)
      const gen2 = createSeededRandom(42)
      for (let i = 0; i < 20; i++) {
        expect(gen1()).toBe(gen2())
      }
    })

    it('不同种子产生不同序列', () => {
      const gen1 = createSeededRandom(1)
      const gen2 = createSeededRandom(2)
      let same = 0
      for (let i = 0; i < 20; i++) {
        if (gen1() === gen2()) same++
      }
      expect(same).toBeLessThan(5)
    })

    it('返回值在 [0, 1) 范围内', () => {
      const gen = createSeededRandom(123)
      for (let i = 0; i < 100; i++) {
        const r = gen()
        expect(r).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThan(1)
      }
    })

    it('负种子也能工作', () => {
      const gen = createSeededRandom(-100)
      expect(typeof gen()).toBe('number')
    })
  })

  describe('randInt()', () => {
    it('返回值在 [min, max] 闭区间内', () => {
      const rng = createSeededRandom(7)
      for (let i = 0; i < 100; i++) {
        const r = randInt(1, 10, rng)
        expect(r).toBeGreaterThanOrEqual(1)
        expect(r).toBeLessThanOrEqual(10)
        expect(Number.isInteger(r)).toBe(true)
      }
    })

    it('min === max 时返回该值', () => {
      expect(randInt(5, 5)).toBe(5)
    })

    it('不指定 rng 时使用 Math.random', () => {
      const r = randInt(0, 100)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(100)
    })
  })

  describe('shuffle()', () => {
    it('返回新数组，不修改原数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const original = [...arr]
      const shuffled = shuffle(arr)
      expect(arr).toEqual(original)
      expect(shuffled).not.toBe(arr)
    })

    it('包含所有原始元素', () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = shuffle(arr, createSeededRandom(3))
      expect(shuffled).toHaveLength(5)
      expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5])
    })

    it('空数组返回空数组', () => {
      expect(shuffle([])).toEqual([])
    })

    it('单元素数组返回相同元素', () => {
      expect(shuffle(['a'])).toEqual(['a'])
    })
  })

  describe('pickRandom()', () => {
    it('返回指定数量的元素', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const picked = pickRandom(arr, 3, createSeededRandom(5))
      expect(picked).toHaveLength(3)
    })

    it('返回的元素都来自原数组', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const picked = pickRandom(arr, 3)
      for (const item of picked) {
        expect(arr).toContain(item)
      }
    })

    it('count 为 0 返回空数组', () => {
      expect(pickRandom([1, 2, 3], 0)).toEqual([])
    })

    it('count 大于数组长度时返回所有元素', () => {
      const arr = [1, 2, 3]
      const picked = pickRandom(arr, 10)
      expect(picked).toHaveLength(3)
    })
  })
})
