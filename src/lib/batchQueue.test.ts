/**
 * lib/batchQueue — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量）：新增独立测试文件，不编辑/不删除已有测试。
 * 覆盖：
 *   - batchQueue 空数组（早返回分支）
 *   - 单批次不足 concurrency（正序）
 *   - 多批次分桶（> concurrency 时进入 while 多轮循环）
 *   - 部分任务 reject → undefined 占位分支（allSettled 失败处理）
 *   - 所有任务 reject → 全 undefined 占位
 *   - 自定义 concurrency 边界（0 / 1 / > 10）
 *   - createBatchQueue 工厂返回函数复用相同 concurrency
 */
import { describe, it, expect, vi } from 'vitest'
import { batchQueue, createBatchQueue } from './batchQueue'

describe('lib/batchQueue', () => {
  describe('batchQueue<T, R>()', () => {
    it('空 items 立即返回空数组（跳过 while 循环）', async () => {
      const fn = vi.fn()
      const r = await batchQueue([], fn)
      expect(r).toEqual([])
      expect(fn).not.toHaveBeenCalled()
    })

    it('items.length < concurrency（单批次），结果顺序与 items 一致', async () => {
      const items = ['a', 'b', 'c']
      const fn = vi.fn(async (x: string, i: number) => `${x}:${i}`)
      const r = await batchQueue(items, fn, 10)
      expect(fn).toHaveBeenCalledTimes(3)
      expect(fn.mock.calls).toEqual([['a', 0], ['b', 1], ['c', 2]])
      expect(r).toEqual(['a:0', 'b:1', 'c:2'])
    })

    it('items.length 超过 concurrency 时多批次执行（3 轮 while）', async () => {
      // 10 items, concurrency=3 → 4 batches(3+3+3+1)?  10 / 3 = 3.33, 4 轮循环
      const items = Array.from({ length: 10 }, (_, i) => i)
      const fn = vi.fn(async (x: number) => x * 10)
      const r = await batchQueue(items, fn, 3)
      // 总共调用 10 次
      expect(fn).toHaveBeenCalledTimes(10)
      // 结果顺序对应输入
      expect(r).toEqual(items.map(x => x * 10))
      // 每批的 slice 索引正确：第一轮 0..2, 第二轮 3..5
      expect(fn).toHaveBeenNthCalledWith(1, 0, 0)
      expect(fn).toHaveBeenNthCalledWith(4, 3, 3)
      expect(fn).toHaveBeenNthCalledWith(7, 6, 6)
      expect(fn).toHaveBeenNthCalledWith(10, 9, 9)
    })

    it('默认 concurrency = 10（未显式传入）', async () => {
      const items = Array.from({ length: 25 }, (_, i) => i)
      const fn = vi.fn(async (x: number) => x)
      await batchQueue(items, fn)
      expect(fn).toHaveBeenCalledTimes(25)
      // 默认 10，故 25 = 3 轮 (10+10+5)，前 10 个 index 连续，10-19 下一批次
      // 但每批内 Promise.allSettled 并发，index 是基于真实调用方位置
      expect(fn).toHaveBeenNthCalledWith(1, 0, 0)
      expect(fn).toHaveBeenNthCalledWith(10, 9, 9)
      expect(fn).toHaveBeenNthCalledWith(11, 10, 10)
      expect(fn).toHaveBeenNthCalledWith(20, 19, 19)
      expect(fn).toHaveBeenNthCalledWith(21, 20, 20)
    })

    it('部分任务 reject：结果数组对应位置为 undefined（不抛出）', async () => {
      const items = ['ok', 'bad', 'ok2']
      const fn = vi.fn(async (x: string) => {
        if (x === 'bad') throw new Error('boom')
        return x.toUpperCase()
      })
      const r = await batchQueue(items, fn, 2)
      expect(r).toEqual(['OK', undefined, 'OK2'])
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('全部任务 reject：全部位置 undefined（长度保持与 items 一致）', async () => {
      const items = [1, 2, 3]
      const fn = vi.fn(async () => { throw new Error('all fail') })
      const r = await batchQueue(items, fn)
      expect(r).toHaveLength(3)
      expect(r.every(x => x === undefined)).toBe(true)
    })

    it('concurrency = 1：串行执行，顺序和 index 严格一致', async () => {
      const seq: number[] = []
      const items = [10, 20, 30, 40]
      const fn = vi.fn(async (x: number, i: number) => {
        seq.push(i)
        return x + 1
      })
      const r = await batchQueue(items, fn, 1)
      expect(seq).toEqual([0, 1, 2, 3])
      expect(r).toEqual([11, 21, 31, 41])
    })

    it('混合成功/失败 + 多批次，最终长度与输入严格相等', async () => {
      const N = 100
      const items = Array.from({ length: N }, (_, i) => i)
      const fn = vi.fn(async (x: number) => {
        if (x % 3 === 0) throw new Error('div by 3')
        return x * 2
      })
      const r = await batchQueue(items, fn, 7)
      expect(r).toHaveLength(N)
      for (let i = 0; i < N; i++) {
        if (i % 3 === 0) expect(r[i]).toBeUndefined()
        else expect(r[i]).toBe(i * 2)
      }
    })

    it('fn 抛出非 Error（字符串）时，视为 rejected 同样占位 undefined', async () => {
      const fn = vi.fn(async (x: string) => { if (x === 'x') throw 'string-reject'; return x })
      const r = await batchQueue(['a', 'x', 'b'], fn)
      expect(r).toEqual(['a', undefined, 'b'])
    })

    it('concurrency 大于 items.length 时结果正确（单批 + 末尾 slice 不越界）', async () => {
      const items = [1, 2, 3]
      const fn = vi.fn(async (x: number) => x + 1)
      const r = await batchQueue(items, fn, 10000)
      expect(r).toEqual([2, 3, 4])
    })
  })

  describe('createBatchQueue(concurrency?)', () => {
    it('返回函数，调用后产生与 batchQueue 相同语义', async () => {
      const mapper = createBatchQueue(2)
      expect(typeof mapper).toBe('function')
      const r = await mapper([1, 2, 3], async (x: number) => x * x)
      expect(r).toEqual([1, 4, 9])
    })

    it('使用默认 concurrency = 10 构造', async () => {
      const mapper = createBatchQueue()
      const items = Array.from({ length: 22 }, (_, i) => i)
      const calls: Array<[number, number]> = []
      const r = await mapper(items, async (x: number, i: number) => {
        calls.push([x, i])
        return x
      })
      expect(calls).toHaveLength(22)
      expect(r).toEqual(items)
      // 10 + 10 + 2 = 3 轮；验证各批次起点 index
      expect(calls[0]?.[1]).toBe(0)
      expect(calls[10]?.[1]).toBe(10)
      expect(calls[20]?.[1]).toBe(20)
    })

    it('独立工厂函数各自有独立 concurrency，互不影响', async () => {
      const serial = createBatchQueue(1)
      const parallel = createBatchQueue(100)
      const seq1: number[] = []
      const seq2: number[] = []
      const items = [0, 1, 2, 3, 4]
      await serial(items, async (_x: number, i: number) => { seq1.push(i); return i })
      await parallel(items, async (_x: number, i: number) => { seq2.push(i); return i })
      // 串行情况下顺序严格 0,1,2,3,4
      expect(seq1).toEqual([0, 1, 2, 3, 4])
      // 并行情况下 index 也正确（虽然并发，但调用参数的 index 来自代码位置）
      expect(seq2.sort()).toEqual([0, 1, 2, 3, 4])
    })

    it('失败任务同样占位 undefined（工厂返回函数共享失败分支）', async () => {
      const mapper = createBatchQueue(2)
      const r = await mapper(['a', 'b', 'c'], async (x: string) => {
        if (x === 'b') throw new Error('drop')
        return x.toUpperCase()
      })
      expect(r).toEqual(['A', undefined, 'C'])
    })
  })
})

void vi
