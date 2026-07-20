import { describe, it, expect, vi } from 'vitest'
import { batchQueue, createBatchQueue } from './batchQueue'

describe('batchQueue', () => {
  describe('batchQueue()', () => {
    it('按顺序执行所有任务并返回结果', async () => {
      const items = [1, 2, 3, 4, 5]
      const fn = vi.fn(async (item: number) => item * 2)
      const results = await batchQueue(items, fn, 2)
      expect(results).toEqual([2, 4, 6, 8, 10])
      expect(fn).toHaveBeenCalledTimes(5)
    })

    it('并发数控制正确', async () => {
      const items = [1, 2, 3, 4, 5]
      let active = 0
      let maxActive = 0
      const fn = async (item: number) => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise(resolve => setTimeout(resolve, 10))
        active--
        return item
      }
      await batchQueue(items, fn, 2)
      expect(maxActive).toBeLessThanOrEqual(2)
    })

    it('空数组返回空数组', async () => {
      const fn = vi.fn()
      const results = await batchQueue([], fn)
      expect(results).toEqual([])
      expect(fn).not.toHaveBeenCalled()
    })

    it('默认并发数为 10', async () => {
      const items = Array.from({ length: 15 }, (_, i) => i)
      let active = 0
      let maxActive = 0
      const fn = async (item: number) => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise(resolve => setTimeout(resolve, 5))
        active--
        return item
      }
      await batchQueue(items, fn)
      expect(maxActive).toBeLessThanOrEqual(10)
    })

    it('任务失败时结果位置为 undefined', async () => {
      const items = [1, 2, 3]
      const fn = async (item: number) => {
        if (item === 2) throw new Error('fail')
        return item
      }
      const results = await batchQueue(items, fn, 1)
      expect(results[0]).toBe(1)
      expect(results[1]).toBeUndefined()
      expect(results[2]).toBe(3)
    })

    it('传入 index 参数', async () => {
      const items = ['a', 'b', 'c']
      const indices: number[] = []
      const fn = async (_item: string, index: number) => {
        indices.push(index)
        return index
      }
      await batchQueue(items, fn, 2)
      expect(indices.sort()).toEqual([0, 1, 2])
    })
  })

  describe('createBatchQueue()', () => {
    it('创建带固定并发数的 batch 函数', async () => {
      const batcher = createBatchQueue(2)
      const items = [1, 2, 3, 4]
      let active = 0
      let maxActive = 0
      const fn = async (item: number) => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise(resolve => setTimeout(resolve, 5))
        active--
        return item
      }
      await batcher(items, fn)
      expect(maxActive).toBeLessThanOrEqual(2)
    })

    it('batcher 返回结果与 batchQueue 一致', async () => {
      const batcher = createBatchQueue(3)
      const items = [10, 20, 30]
      const fn = async (x: number) => x + 1
      const results = await batcher(items, fn)
      expect(results).toEqual([11, 21, 31])
    })
  })
})
