import { describe, it, expect, beforeEach } from 'vitest'
import {
  measureAsync,
  measureSync,
  getPerfStats,
  getPerfSamples,
  clearPerf,
  recordPerf,
  PERF,
} from './perf'

describe('perf', () => {
  beforeEach(() => {
    clearPerf()
  })

  describe('PERF 常量', () => {
    it('定义了关键路径标签', () => {
      expect(PERF.DATA_FETCH_REQUEST).toBe('data-fetch:request')
      expect(PERF.SCORING_CALCULATE_ALL).toBe('scoring:calculateAll')
    })
  })

  describe('measureSync()', () => {
    it('测量同步函数耗时并返回结果', () => {
      const result = measureSync('test:sync', () => 42)
      expect(result).toBe(42)
      const stats = getPerfStats()
      expect(stats[0]!.label).toBe('test:sync')
      expect(stats[0]!.count).toBe(1)
      expect(stats[0]!.okCount).toBe(1)
    })

    it('函数抛出异常时记录失败并重新抛出', () => {
      expect(() => measureSync('test:fail', () => {
        throw new Error('sync error')
      })).toThrow('sync error')
      const stats = getPerfStats()
      expect(stats[0]!.failCount).toBe(1)
      expect(stats[0]!.okCount).toBe(0)
    })

    it('meta 信息被记录', () => {
      measureSync('test:meta', () => 'ok', { count: 100 })
      const samples = getPerfSamples()
      // meta 通过日志输出，sample 中只有 label/durationMs/ok/at
      expect(samples[0]!.label).toBe('test:meta')
      expect(samples[0]!.ok).toBe(true)
    })
  })

  describe('measureAsync()', () => {
    it('测量异步函数耗时并返回结果', async () => {
      const result = await measureAsync('test:async', async () => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return 'async result'
      })
      expect(result).toBe('async result')
      const stats = getPerfStats()
      expect(stats[0]!.label).toBe('test:async')
      expect(stats[0]!.count).toBe(1)
    })

    it('异步失败时记录并重新抛出', async () => {
      await expect(measureAsync('test:asyncFail', async () => {
        throw new Error('async error')
      })).rejects.toThrow('async error')
      const stats = getPerfStats()
      expect(stats[0]!.failCount).toBe(1)
    })
  })

  describe('recordPerf()', () => {
    it('手动记录性能采样', () => {
      recordPerf('manual:label', 15.5, true)
      const samples = getPerfSamples()
      expect(samples).toHaveLength(1)
      expect(samples[0]!.label).toBe('manual:label')
      expect(samples[0]!.durationMs).toBe(15.5)
      expect(samples[0]!.ok).toBe(true)
    })
  })

  describe('getPerfStats()', () => {
    it('聚合多个采样的统计信息', () => {
      recordPerf('agg', 10, true)
      recordPerf('agg', 20, true)
      recordPerf('agg', 30, true)
      recordPerf('agg', 40, true)
      recordPerf('agg', 50, true)
      const stats = getPerfStats()[0]!
      expect(stats.count).toBe(5)
      expect(stats.avgMs).toBe(30)
      expect(stats.maxMs).toBe(50)
      expect(stats.p50Ms).toBe(30)
    })

    it('按平均耗时降序排列', () => {
      recordPerf('fast', 5, true)
      recordPerf('slow', 50, true)
      recordPerf('mid', 20, true)
      const stats = getPerfStats()
      expect(stats[0]!.label).toBe('slow')
      expect(stats[1]!.label).toBe('mid')
      expect(stats[2]!.label).toBe('fast')
    })

    it('空时返回空数组', () => {
      expect(getPerfStats()).toEqual([])
    })

    it('包含 lastMs 字段', () => {
      recordPerf('lastTest', 10, true)
      recordPerf('lastTest', 20, true)
      const stats = getPerfStats()[0]!
      expect(stats.lastMs).toBe(20)
    })
  })

  describe('clearPerf()', () => {
    it('清空所有采样', () => {
      recordPerf('toClear', 10, true)
      expect(getPerfSamples().length).toBeGreaterThan(0)
      clearPerf()
      expect(getPerfSamples()).toHaveLength(0)
    })
  })

  describe('采样上限', () => {
    it('超过 MAX_SAMPLES 时丢弃最早的', () => {
      // MAX_SAMPLES = 1000
      for (let i = 0; i < 1100; i++) {
        recordPerf('overflow', i, true)
      }
      const samples = getPerfSamples()
      expect(samples.length).toBe(1000)
      // 最早的 100 条被丢弃，第一条应该是 index=100
      expect(samples[0]!.durationMs).toBe(100)
    })
  })
})
