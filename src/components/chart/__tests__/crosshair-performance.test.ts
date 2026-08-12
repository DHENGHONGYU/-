import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CandlestickChartData } from '../types'
import { computeKDJ } from '../indicators/kdj'
import { computeMACD } from '../indicators/macd'

/**
 * 生成大量测试数据（时间戳唯一）
 */
function generateLargeDataset(count: number): CandlestickChartData[] {
  const data: CandlestickChartData[] = []
  let basePrice = 100

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2
    basePrice = Math.max(10, basePrice + change)

    const open = basePrice
    const close = basePrice + (Math.random() - 0.5) * 1
    const high = Math.max(open, close) + Math.random() * 0.5
    const low = Math.min(open, close) - Math.random() * 0.5

    // 生成唯一时间戳：以 2020-01-01 为起点，每天递增
    const date = new Date(2020, 0, 1 + i)
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

describe('十字光标性能测试', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1000 条数据：时间索引构建应在 10ms 内完成', () => {
    const data = generateLargeDataset(1000)
    expect(data.length).toBe(1000)

    const start = performance.now()
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const duration = performance.now() - start

    expect(dataIndex.size).toBe(1000)
    expect(duration).toBeLessThan(10)

    console.log(`[性能测试] 1000 条数据索引构建: ${duration.toFixed(2)}ms`)
  })

  it('5000 条数据：时间索引构建应在 50ms 内完成', () => {
    const data = generateLargeDataset(5000)
    expect(data.length).toBe(5000)

    const start = performance.now()
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const duration = performance.now() - start

    expect(dataIndex.size).toBe(5000)
    expect(duration).toBeLessThan(50)

    console.log(`[性能测试] 5000 条数据索引构建: ${duration.toFixed(2)}ms`)
  })

  it('10000 条数据：时间索引构建应在 100ms 内完成', () => {
    const data = generateLargeDataset(10000)
    expect(data.length).toBe(10000)

    const start = performance.now()
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const duration = performance.now() - start

    expect(dataIndex.size).toBe(10000)
    expect(duration).toBeLessThan(100)

    console.log(`[性能测试] 10000 条数据索引构建: ${duration.toFixed(2)}ms`)
  })

  it('Map 查找应在 0.01ms 内完成（O(1) 复杂度）', () => {
    const data = generateLargeDataset(10000)
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))

    const iterations = 1000
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      const randomIndex = Math.floor(Math.random() * data.length)
      const time = String(data[randomIndex]?.time)
      dataIndex.get(time)
    }

    const duration = performance.now() - start
    const avgTime = duration / iterations

    expect(avgTime).toBeLessThan(0.01)

    console.log(`[性能测试] Map 查找平均耗时: ${(avgTime * 1000).toFixed(3)}μs`)
  })

  it('KDJ 计算在 5000 条数据下应在 50ms 内完成', () => {
    const data = generateLargeDataset(5000)

    const start = performance.now()
    const result = computeKDJ(data)
    const duration = performance.now() - start

    expect(result.k.length).toBe(5000)
    expect(result.d.length).toBe(5000)
    expect(result.j.length).toBe(5000)
    expect(duration).toBeLessThan(50)

    console.log(`[性能测试] KDJ 5000 条数据计算: ${duration.toFixed(2)}ms`)
  })

  it('MACD 计算在 5000 条数据下应在 50ms 内完成', () => {
    const data = generateLargeDataset(5000)

    const start = performance.now()
    const result = computeMACD(data)
    const duration = performance.now() - start

    expect(result.dif.length).toBe(5000)
    expect(result.dea.length).toBe(5000)
    expect(result.histogram.length).toBe(5000)
    expect(duration).toBeLessThan(50)

    console.log(`[性能测试] MACD 5000 条数据计算: ${duration.toFixed(2)}ms`)
  })

  it('模拟 crosshair 事件处理（含节流）应在 16ms 内完成', () => {
    const data = generateLargeDataset(5000)
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const kdjResult = computeKDJ(data)
    const macdResult = computeMACD(data)

    const iterations = 100
    let totalDuration = 0

    for (let i = 0; i < iterations; i++) {
      const randomIndex = Math.floor(Math.random() * data.length)
      const time = String(data[randomIndex]?.time)

      const start = performance.now()

      // 模拟 crosshair 处理逻辑
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

    expect(avgDuration).toBeLessThan(16) // 60fps 要求

    console.log(`[性能测试] Crosshair 处理平均耗时: ${(avgDuration * 1000).toFixed(3)}μs`)
    console.log(`[性能测试] 可维持帧率: ${avgDuration > 0 ? Math.floor(1000 / avgDuration) : '∞'} FPS`)
  })

  it('节流机制应有效降低事件处理频率', () => {
    const THROTTLE_MS = 16
    let lastCrosshairTime = 0
    let processedCount = 0

    // 标准节流：丢弃间隔内的调用（与 MultiPaneChart 实现一致）
    const onCrosshair = () => {
      const now = performance.now()
      const elapsed = now - lastCrosshairTime

      if (elapsed < THROTTLE_MS) {
        return // 丢弃
      }

      lastCrosshairTime = now
      processedCount++
    }

    // 同步循环模拟 100 次高频触发（间隔 < 1ms，远小于 16ms 节流阈值）
    for (let i = 0; i < 100; i++) {
      onCrosshair()
    }

    // 同步循环总耗时 < 1ms，所有调用几乎在同一时刻
    // 只有第一次调用满足 elapsed >= 16ms（因为 lastCrosshairTime 初始为 0）
    // 后续 99 次调用 elapsed ≈ 0，全部被丢弃
    expect(processedCount).toBe(1)
    expect(processedCount).toBeLessThan(100)

    console.log(`[性能测试] 节流效果: 100 次同步触发 -> ${processedCount} 次处理`)
    console.log(`[性能测试] 降低比例: ${((1 - processedCount / 100) * 100).toFixed(1)}%`)
  })
})
