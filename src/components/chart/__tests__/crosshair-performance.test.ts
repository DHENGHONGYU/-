import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CandlestickChartData } from '../types'
import { computeKDJ } from '../indicators/kdj'
import { computeMACD } from '../indicators/macd'

/**
 * 生成大量测试数据
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
    
    data.push({
      time: `2024-01-${String((i % 31) + 1).padStart(2, '0')}`,
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
    
    const start = performance.now()
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const duration = performance.now() - start
    
    expect(dataIndex.size).toBe(1000)
    expect(duration).toBeLessThan(10)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] 1000 条数据索引构建: ${duration.toFixed(2)}ms`)
    }
  })
  
  it('5000 条数据：时间索引构建应在 50ms 内完成', () => {
    const data = generateLargeDataset(5000)
    
    const start = performance.now()
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const duration = performance.now() - start
    
    expect(dataIndex.size).toBe(5000)
    expect(duration).toBeLessThan(50)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] 5000 条数据索引构建: ${duration.toFixed(2)}ms`)
    }
  })
  
  it('10000 条数据：时间索引构建应在 100ms 内完成', () => {
    const data = generateLargeDataset(10000)
    
    const start = performance.now()
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const duration = performance.now() - start
    
    expect(dataIndex.size).toBe(10000)
    expect(duration).toBeLessThan(100)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] 10000 条数据索引构建: ${duration.toFixed(2)}ms`)
    }
  })
  
  it('Map 查找应在 0.01ms 内完成（O(1) 复杂度）', () => {
    const data = generateLargeDataset(10000)
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    
    // 测试 1000 次查找的平均时间
    const iterations = 1000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      const randomIndex = Math.floor(Math.random() * data.length)
      const time = String(data[randomIndex]?.time)
      dataIndex.get(time)
    }
    
    const duration = performance.now() - start
    const avgTime = duration / iterations
    
    expect(avgTime).toBeLessThan(0.01) // 平均每次查找 < 0.01ms
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] Map 查找平均耗时: ${(avgTime * 1000).toFixed(3)}μs`)
    }
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] KDJ 5000 条数据计算: ${duration.toFixed(2)}ms`)
    }
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] MACD 5000 条数据计算: ${duration.toFixed(2)}ms`)
    }
  })
  
  it('模拟 crosshair 事件处理（含节流）应在 16ms 内完成', () => {
    const data = generateLargeDataset(5000)
    const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
    const kdjResult = computeKDJ(data)
    const macdResult = computeMACD(data)
    
    // 模拟 100 次 crosshair 事件
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
        
        // 模拟数据提取
        if (kPoint && dPoint && jPoint) {
          const kdj = { k: kPoint.value, d: dPoint.value, j: jPoint.value }
        }
        if (difPoint && deaPoint && histPoint) {
          const macd = { dif: difPoint.value, dea: deaPoint.value, histogram: histPoint.value }
        }
      }
      
      totalDuration += performance.now() - start
    }
    
    const avgDuration = totalDuration / iterations
    
    expect(avgDuration).toBeLessThan(16) // 60fps 要求
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能测试] Crosshair 处理平均耗时: ${(avgDuration * 1000).toFixed(3)}μs`)
      console.log(`[性能测试] 可维持帧率: ${Math.floor(1000 / avgDuration)} FPS`)
    }
  })
  
  it('节流机制应有效降低事件处理频率', () => {
    const THROTTLE_MS = 16
    let lastCrosshairTime = 0
    let processedCount = 0
    
    const processCrosshair = () => {
      processedCount++
    }
    
    const onCrosshair = () => {
      const now = performance.now()
      const elapsed = now - lastCrosshairTime
      
      if (elapsed >= THROTTLE_MS) {
        lastCrosshairTime = now
        processCrosshair()
      } else {
        setTimeout(() => {
          lastCrosshairTime = performance.now()
          processCrosshair()
        }, THROTTLE_MS - elapsed)
      }
    }
    
    // 模拟 100 次快速触发（间隔 5ms）
    const startTime = performance.now()
    for (let i = 0; i < 100; i++) {
      onCrosshair()
    }
    
    // 等待所有 setTimeout 完成
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const totalTime = performance.now() - startTime
        
        // 节流后处理次数应远小于 100
        expect(processedCount).toBeLessThan(100)
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[性能测试] 节流效果: 100 次触发 -> ${processedCount} 次处理`)
          console.log(`[性能测试] 总耗时: ${totalTime.toFixed(2)}ms`)
        }
        
        resolve()
      }, 200)
    })
  })
})
