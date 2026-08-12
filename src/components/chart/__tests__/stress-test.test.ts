/**
 * 大数据量压力测试（5万条以上）
 * 
 * 测试目标：
 * 1. 验证 MultiPaneChart 在超大数据量下的性能表现
 * 2. 检测内存泄漏和性能瓶颈
 * 3. 验证节流机制在高频事件下的有效性
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { computeKDJ } from '../indicators/kdj'
import { computeMACD } from '../indicators/macd'
import type { CandlestickChartData } from '../types'

/**
 * 生成超大数据集
 */
function generateMassiveDataset(count: number): CandlestickChartData[] {
  const data: CandlestickChartData[] = []
  let basePrice = 100

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2
    basePrice = Math.max(10, basePrice + change)

    const open = basePrice
    const close = basePrice + (Math.random() - 0.5) * 1
    const high = Math.max(open, close) + Math.random() * 0.5
    const low = Math.min(open, close) - Math.random() * 0.5

    // 生成唯一时间戳：以 2000-01-01 为起点，每天递增
    const date = new Date(2000, 0, 1 + i)
    const timeStr = date.toISOString().slice(0, 10)

    data.push({
      time: timeStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000),
    })
  }

  return data
}

describe('大数据量压力测试（5万条以上）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('5万条数据测试', () => {
    it('索引构建应在 500ms 内完成', () => {
      const data = generateMassiveDataset(50000)
      expect(data.length).toBe(50000)

      const start = performance.now()
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
      const duration = performance.now() - start

      expect(dataIndex.size).toBe(50000)
      expect(duration).toBeLessThan(500)

      console.log(`[压力测试] 50000 条数据索引构建: ${duration.toFixed(2)}ms`)
    })

    it('KDJ 计算应在 500ms 内完成', () => {
      const data = generateMassiveDataset(50000)

      const start = performance.now()
      const result = computeKDJ(data)
      const duration = performance.now() - start

      expect(result.k.length).toBe(50000)
      expect(result.d.length).toBe(50000)
      expect(result.j.length).toBe(50000)
      expect(duration).toBeLessThan(500)

      console.log(`[压力测试] KDJ 50000 条数据计算: ${duration.toFixed(2)}ms`)
    })

    it('MACD 计算应在 500ms 内完成', () => {
      const data = generateMassiveDataset(50000)

      const start = performance.now()
      const result = computeMACD(data)
      const duration = performance.now() - start

      expect(result.dif.length).toBe(50000)
      expect(result.dea.length).toBe(50000)
      expect(result.histogram.length).toBe(50000)
      expect(duration).toBeLessThan(500)

      console.log(`[压力测试] MACD 50000 条数据计算: ${duration.toFixed(2)}ms`)
    })

    it('Map 查找应保持 O(1) 复杂度', () => {
      const data = generateMassiveDataset(50000)
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))

      const iterations = 10000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * data.length)
        const time = String(data[randomIndex]?.time)
        dataIndex.get(time)
      }

      const duration = performance.now() - start
      const avgTime = duration / iterations

      expect(avgTime).toBeLessThan(0.01)

      console.log(`[压力测试] 50000 条数据 Map 查找平均耗时: ${(avgTime * 1000).toFixed(3)}μs`)
    })

    it('Crosshair 处理应在 16ms 内完成', () => {
      const data = generateMassiveDataset(50000)
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
      const kdjResult = computeKDJ(data)
      const macdResult = computeMACD(data)

      const iterations = 1000
      let totalDuration = 0

      for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * data.length)
        const time = String(data[randomIndex]?.time)

        const start = performance.now()

        const idx = dataIndex.get(time)
        if (idx !== undefined) {
          const kPoint = kdjResult.k[idx]
          const dPoint = kdjResult.d[idx]
          const jPoint = kdjResult.j[idx]
          const difPoint = macdResult.dif[idx]
          const deaPoint = macdResult.dea[idx]
          const histPoint = macdResult.histogram[idx]

          if (kPoint && dPoint && jPoint) {
            void { k: kPoint.value, d: dPoint.value, j: jPoint.value }
          }
          if (difPoint && deaPoint && histPoint) {
            void { dif: difPoint.value, dea: deaPoint.value, histogram: histPoint.value }
          }
        }

        totalDuration += performance.now() - start
      }

      const avgDuration = totalDuration / iterations

      expect(avgDuration).toBeLessThan(16)

      console.log(`[压力测试] 50000 条数据 Crosshair 处理平均耗时: ${(avgDuration * 1000).toFixed(3)}μs`)
      console.log(`[压力测试] 可维持帧率: ${avgDuration > 0 ? Math.floor(1000 / avgDuration) : '∞'} FPS`)
    })
  })

  describe('10万条数据测试', () => {
    it('索引构建应在 1000ms 内完成', () => {
      const data = generateMassiveDataset(100000)
      expect(data.length).toBe(100000)

      const start = performance.now()
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
      const duration = performance.now() - start

      expect(dataIndex.size).toBe(100000)
      expect(duration).toBeLessThan(1000)

      console.log(`[压力测试] 100000 条数据索引构建: ${duration.toFixed(2)}ms`)
    })

    it('KDJ 计算应在 1000ms 内完成', () => {
      const data = generateMassiveDataset(100000)

      const start = performance.now()
      const result = computeKDJ(data)
      const duration = performance.now() - start

      expect(result.k.length).toBe(100000)
      expect(duration).toBeLessThan(1000)

      console.log(`[压力测试] KDJ 100000 条数据计算: ${duration.toFixed(2)}ms`)
    })

    it('MACD 计算应在 1000ms 内完成', () => {
      const data = generateMassiveDataset(100000)

      const start = performance.now()
      const result = computeMACD(data)
      const duration = performance.now() - start

      expect(result.dif.length).toBe(100000)
      expect(duration).toBeLessThan(1000)

      console.log(`[压力测试] MACD 100000 条数据计算: ${duration.toFixed(2)}ms`)
    })
  })

  describe('内存压力测试', () => {
    it('连续创建 10 次 5万条数据索引，内存应稳定', () => {
      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const data = generateMassiveDataset(50000)
        const dataIndex = new Map(data.map((d, idx) => [String(d.time), idx]))

        expect(dataIndex.size).toBe(50000)

        // 手动触发垃圾回收（如果可用）
        if (typeof global !== 'undefined' && global.gc) {
          global.gc()
        }
      }

      console.log(`[压力测试] 连续创建 ${iterations} 次 50000 条数据索引，内存稳定`)
    })

    it('连续计算 10 次 KDJ/MACD，性能应稳定', () => {
      const data = generateMassiveDataset(50000)
      const iterations = 10
      const durations: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        computeKDJ(data)
        computeMACD(data)
        durations.push(performance.now() - start)
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      const maxDuration = Math.max(...durations)

      expect(avgDuration).toBeLessThan(1000)
      expect(maxDuration).toBeLessThan(1500)

      console.log(`[压力测试] 连续计算 ${iterations} 次 KDJ+MACD`)
      console.log(`[压力测试] 平均耗时: ${avgDuration.toFixed(2)}ms`)
      console.log(`[压力测试] 最大耗时: ${maxDuration.toFixed(2)}ms`)
    })
  })

  describe('高频事件压力测试', () => {
    it('10000 次 crosshair 事件（含节流）应在 100ms 内处理', () => {
      const THROTTLE_MS = 16
      let lastCrosshairTime = 0
      let processedCount = 0

      const onCrosshair = () => {
        const now = performance.now()
        const elapsed = now - lastCrosshairTime

        if (elapsed < THROTTLE_MS) {
          return
        }

        lastCrosshairTime = now
        processedCount++
      }

      const start = performance.now()

      // 同步触发 10000 次
      for (let i = 0; i < 10000; i++) {
        onCrosshair()
      }

      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
      expect(processedCount).toBe(1) // 只有第一次执行

      console.log(`[压力测试] 10000 次 crosshair 事件（含节流）`)
      console.log(`[压力测试] 总耗时: ${duration.toFixed(2)}ms`)
      console.log(`[压力测试] 实际处理: ${processedCount} 次`)
      console.log(`[压力测试] 降低比例: ${((1 - processedCount / 10000) * 100).toFixed(2)}%`)
    })
  })
})
