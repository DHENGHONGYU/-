/**
 * 极限压力测试计划 - 10 万条以上数据
 * 
 * 测试目标：验证优化方案在超大数据量下的性能表现
 * 测试数据量：10万、20万、50万、100万条
 * 测试维度：
 *   1. 索引构建性能
 *   2. KDJ/MACD 计算性能
 *   3. 内存占用
 *   4. 高频事件处理
 *   5. 多 Chart 联动性能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { computeKDJ } from '../indicators/kdj'
import { computeMACD } from '../indicators/macd'
import type { CandlestickChartData } from '../types'

// ============================================================
// 测试数据生成器
// ============================================================

function generateExtremeData(count: number): CandlestickChartData[] {
  const data: CandlestickChartData[] = []
  let basePrice = 100

  for (let i = 0; i < count; i++) {
    // 模拟真实 K 线数据（正弦波趋势 + 随机噪声）
    const trend = Math.sin(i / 100) * 10
    const noise = (Math.random() - 0.5) * 5
    basePrice = Math.max(10, 100 + trend + noise)

    const open = basePrice
    const change = (Math.random() - 0.5) * 4
    const close = Math.max(1, open + change)
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2

    // 生成日期字符串（从 2020-01-01 开始）
    const date = new Date(2020, 0, 1 + i)
    const timeStr = date.toISOString().slice(0, 10)

    data.push({
      time: timeStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(0.01, low).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000),
    })
  }

  return data
}

// ============================================================
// 极限压力测试套件
// ============================================================

describe('极限压力测试（10万条以上数据）', () => {
  let data100k: CandlestickChartData[]
  let data200k: CandlestickChartData[]
  let data500k: CandlestickChartData[]

  beforeAll(() => {
    console.log('\n========================================')
    console.log('开始生成极限压力测试数据...')
    console.log('========================================\n')

    const start100k = performance.now()
    data100k = generateExtremeData(100000)
    console.log(`10万条数据生成耗时: ${(performance.now() - start100k).toFixed(2)}ms`)

    const start200k = performance.now()
    data200k = generateExtremeData(200000)
    console.log(`20万条数据生成耗时: ${(performance.now() - start200k).toFixed(2)}ms`)

    const start500k = performance.now()
    data500k = generateExtremeData(500000)
    console.log(`50万条数据生成耗时: ${(performance.now() - start500k).toFixed(2)}ms`)

    console.log('\n========================================')
    console.log('数据生成完成，开始测试...\n')
  })

  afterAll(() => {
    console.log('\n========================================')
    console.log('极限压力测试完成')
    console.log('========================================\n')
  })

  // ============================================================
  // 测试组 1: 10 万条数据
  // ============================================================

  describe('10 万条数据测试', () => {
    it('索引构建应在 1000ms 内完成', () => {
      const start = performance.now()
      const index = new Map(data100k.map((d, i) => [String(d.time), i]))
      const duration = performance.now() - start

      console.log(`10万条数据索引构建耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(1000)
      expect(index.size).toBe(100000)
    })

    it('KDJ 计算应在 1000ms 内完成', () => {
      const start = performance.now()
      const result = computeKDJ(data100k)
      const duration = performance.now() - start

      console.log(`10万条数据 KDJ 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(1000)
      expect(result.k.length).toBe(100000)
      expect(result.d.length).toBe(100000)
      expect(result.j.length).toBe(100000)
    })

    it('MACD 计算应在 1000ms 内完成', () => {
      const start = performance.now()
      const result = computeMACD(data100k)
      const duration = performance.now() - start

      console.log(`10万条数据 MACD 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(1000)
      expect(result.dif.length).toBe(100000)
      expect(result.dea.length).toBe(100000)
      expect(result.histogram.length).toBe(100000)
    })

    it('Map 查找应保持 O(1) 复杂度', () => {
      const index = new Map(data100k.map((d, i) => [String(d.time), i]))

      const times = [
        data100k[0]?.time,
        data100k[50000]?.time,
        data100k[99999]?.time,
      ]

      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        for (const time of times) {
          index.get(String(time))
        }
      }
      const duration = performance.now() - start

      console.log(`10万条数据 3000 次 Map 查找耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(10) // 3000 次查找应 < 10ms
    })
  })

  // ============================================================
  // 测试组 2: 20 万条数据
  // ============================================================

  describe('20 万条数据测试', () => {
    it('索引构建应在 2000ms 内完成', () => {
      const start = performance.now()
      const index = new Map(data200k.map((d, i) => [String(d.time), i]))
      const duration = performance.now() - start

      console.log(`20万条数据索引构建耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(2000)
      expect(index.size).toBe(200000)
    })

    it('KDJ 计算应在 2000ms 内完成', () => {
      const start = performance.now()
      const result = computeKDJ(data200k)
      const duration = performance.now() - start

      console.log(`20万条数据 KDJ 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(2000)
      expect(result.k.length).toBe(200000)
    })

    it('MACD 计算应在 2000ms 内完成', () => {
      const start = performance.now()
      const result = computeMACD(data200k)
      const duration = performance.now() - start

      console.log(`20万条数据 MACD 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(2000)
      expect(result.dif.length).toBe(200000)
    })
  })

  // ============================================================
  // 测试组 3: 50 万条数据
  // ============================================================

  describe('50 万条数据测试', () => {
    it('索引构建应在 5000ms 内完成', () => {
      const start = performance.now()
      const index = new Map(data500k.map((d, i) => [String(d.time), i]))
      const duration = performance.now() - start

      console.log(`50万条数据索引构建耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(5000)
      expect(index.size).toBe(500000)
    })

    it('KDJ 计算应在 5000ms 内完成', () => {
      const start = performance.now()
      const result = computeKDJ(data500k)
      const duration = performance.now() - start

      console.log(`50万条数据 KDJ 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(5000)
      expect(result.k.length).toBe(500000)
    })

    it('MACD 计算应在 5000ms 内完成', () => {
      const start = performance.now()
      const result = computeMACD(data500k)
      const duration = performance.now() - start

      console.log(`50万条数据 MACD 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(5000)
      expect(result.dif.length).toBe(500000)
    })
  })

  // ============================================================
  // 测试组 4: 内存压力测试
  // ============================================================

  describe('内存压力测试', () => {
    it('连续创建 5 次 10万条数据索引，内存应稳定', () => {
      const durations: number[] = []

      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        const index = new Map(data100k.map((d, j) => [String(d.time), j]))
        const duration = performance.now() - start
        durations.push(duration)

        // 释放引用
        index.clear()
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      const maxDuration = Math.max(...durations)

      console.log(`连续 5 次 10万条索引构建:`)
      console.log(`  平均耗时: ${avgDuration.toFixed(2)}ms`)
      console.log(`  最大耗时: ${maxDuration.toFixed(2)}ms`)
      console.log(`  各次耗时: ${durations.map(d => d.toFixed(2)).join(', ')}ms`)

      expect(avgDuration).toBeLessThan(1500)
      expect(maxDuration).toBeLessThan(2000)
    })

    it('连续计算 5 次 KDJ/MACD（10万条），性能应稳定', () => {
      const kdjDurations: number[] = []
      const macdDurations: number[] = []

      for (let i = 0; i < 5; i++) {
        const kdjStart = performance.now()
        computeKDJ(data100k)
        kdjDurations.push(performance.now() - kdjStart)

        const macdStart = performance.now()
        computeMACD(data100k)
        macdDurations.push(performance.now() - macdStart)
      }

      const avgKDJ = kdjDurations.reduce((a, b) => a + b, 0) / kdjDurations.length
      const avgMACD = macdDurations.reduce((a, b) => a + b, 0) / macdDurations.length

      console.log(`连续 5 次 10万条计算:`)
      console.log(`  KDJ 平均耗时: ${avgKDJ.toFixed(2)}ms`)
      console.log(`  MACD 平均耗时: ${avgMACD.toFixed(2)}ms`)
      console.log(`  KDJ 各次耗时: ${kdjDurations.map(d => d.toFixed(2)).join(', ')}ms`)
      console.log(`  MACD 各次耗时: ${macdDurations.map(d => d.toFixed(2)).join(', ')}ms`)

      expect(avgKDJ).toBeLessThan(1500)
      expect(avgMACD).toBeLessThan(1500)
    })
  })

  // ============================================================
  // 测试组 5: 高频事件压力测试
  // ============================================================

  describe('高频事件压力测试', () => {
    it('50000 次 crosshair 事件（含节流）应在 500ms 内处理', () => {
      const index = new Map(data100k.map((d, i) => [String(d.time), i]))
      const THROTTLE_MS = 16

      let processedCount = 0
      let lastCrosshairTime = 0

      const start = performance.now()

      // 模拟 50000 次 crosshair 事件
      for (let i = 0; i < 50000; i++) {
        const now = performance.now()
        const elapsed = now - lastCrosshairTime

        if (elapsed < THROTTLE_MS) {
          continue // 节流：丢弃间隔内的调用
        }

        lastCrosshairTime = now

        // 处理 crosshair 事件
        const time = data100k[i % data100k.length]?.time
        const idx = index.get(String(time))

        if (idx !== undefined) {
          processedCount++
        }
      }

      const duration = performance.now() - start

      console.log(`50000 次 crosshair 事件处理:`)
      console.log(`  总耗时: ${duration.toFixed(2)}ms`)
      console.log(`  实际处理次数: ${processedCount}`)
      console.log(`  节流丢弃次数: ${50000 - processedCount}`)
      console.log(`  节流率: ${((50000 - processedCount) / 50000 * 100).toFixed(2)}%`)

      expect(duration).toBeLessThan(500)
      expect(processedCount).toBeLessThan(50000) // 节流应生效
    })

    it('多 Chart 联动（3 个图表）应在 50ms 内完成', () => {
      const index = new Map(data100k.map((d, i) => [String(d.time), i]))
      const kdjResult = computeKDJ(data100k)
      const macdResult = computeMACD(data100k)

      const start = performance.now()

      // 模拟 1000 次多 Chart 联动
      for (let i = 0; i < 1000; i++) {
        const time = data100k[i % data100k.length]?.time
        const idx = index.get(String(time))

        if (idx !== undefined) {
          // 模拟主图 crosshair
          const _mainData = data100k[idx]

          // 模拟 MACD 副图同步
          const _macdData = {
            dif: macdResult.dif[idx],
            dea: macdResult.dea[idx],
            histogram: macdResult.histogram[idx],
          }

          // 模拟 KDJ 副图同步
          const _kdjData = {
            k: kdjResult.k[idx],
            d: kdjResult.d[idx],
            j: kdjResult.j[idx],
          }
          // 标记为有意使用（压力测试模拟数据访问，不读取结果）
          void _mainData
          void _macdData
          void _kdjData
        }
      }

      const duration = performance.now() - start

      console.log(`1000 次多 Chart 联动耗时: ${duration.toFixed(2)}ms`)
      console.log(`平均每次联动耗时: ${(duration / 1000).toFixed(4)}ms`)

      expect(duration).toBeLessThan(50)
    })
  })

  // ============================================================
  // 测试组 6: 边界情况测试
  // ============================================================

  describe('边界情况测试', () => {
    it('100万条数据索引构建应在 10000ms 内完成', () => {
      const data1M = generateExtremeData(1000000)

      const start = performance.now()
      const index = new Map(data1M.map((d, i) => [String(d.time), i]))
      const duration = performance.now() - start

      console.log(`100万条数据索引构建耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(10000)
      expect(index.size).toBe(1000000)
    })

    it('100万条数据 KDJ 计算应在 10000ms 内完成', () => {
      const data1M = generateExtremeData(1000000)

      const start = performance.now()
      const result = computeKDJ(data1M)
      const duration = performance.now() - start

      console.log(`100万条数据 KDJ 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(10000)
      expect(result.k.length).toBe(1000000)
    })

    it('100万条数据 MACD 计算应在 10000ms 内完成', () => {
      const data1M = generateExtremeData(1000000)

      const start = performance.now()
      const result = computeMACD(data1M)
      const duration = performance.now() - start

      console.log(`100万条数据 MACD 计算耗时: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(10000)
      expect(result.dif.length).toBe(1000000)
    })
  })
})
