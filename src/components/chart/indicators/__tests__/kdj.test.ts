import { describe, it, expect } from 'vitest'
import { computeKDJ } from '../kdj'
import type { CandlestickChartData } from '@/components/chart/CandlestickChart'

/**
 * 创建包含金叉死叉特征的 Mock 数据
 * 
 * 金叉特征：K 线从下向上穿越 D 线（看涨信号）
 * 死叉特征：K 线从上向下穿越 D 线（看跌信号）
 */
function createKDJMockData(): CandlestickChartData[] {
  // 模拟 30 个交易日的数据，包含明显的金叉死叉特征
  const data: CandlestickChartData[] = [
    // 前 8 天：预热期，价格相对稳定
    { time: '2024-01-01', open: 100, high: 102, low: 98, close: 100 },
    { time: '2024-01-02', open: 100, high: 103, low: 99, close: 101 },
    { time: '2024-01-03', open: 101, high: 104, low: 100, close: 102 },
    { time: '2024-01-04', open: 102, high: 105, low: 101, close: 103 },
    { time: '2024-01-05', open: 103, high: 106, low: 102, close: 104 },
    { time: '2024-01-06', open: 104, high: 107, low: 103, close: 105 },
    { time: '2024-01-07', open: 105, high: 108, low: 104, close: 106 },
    { time: '2024-01-08', open: 106, high: 109, low: 105, close: 107 },
    
    // 第 9-15 天：价格下跌，形成死叉
    { time: '2024-01-09', open: 107, high: 108, low: 104, close: 105 },
    { time: '2024-01-10', open: 105, high: 106, low: 102, close: 103 },
    { time: '2024-01-11', open: 103, high: 104, low: 100, close: 101 },
    { time: '2024-01-12', open: 101, high: 102, low: 98, close: 99 },
    { time: '2024-01-13', open: 99, high: 100, low: 96, close: 97 },
    { time: '2024-01-14', open: 97, high: 98, low: 94, close: 95 },
    { time: '2024-01-15', open: 95, high: 96, low: 92, close: 93 },
    
    // 第 16-22 天：价格反弹，形成金叉
    { time: '2024-01-16', open: 93, high: 95, low: 92, close: 94 },
    { time: '2024-01-17', open: 94, high: 97, low: 93, close: 96 },
    { time: '2024-01-18', open: 96, high: 99, low: 95, close: 98 },
    { time: '2024-01-19', open: 98, high: 101, low: 97, close: 100 },
    { time: '2024-01-20', open: 100, high: 103, low: 99, close: 102 },
    { time: '2024-01-21', open: 102, high: 105, low: 101, close: 104 },
    { time: '2024-01-22', open: 104, high: 107, low: 103, close: 106 },
    
    // 第 23-30 天：价格继续上涨
    { time: '2024-01-23', open: 106, high: 109, low: 105, close: 108 },
    { time: '2024-01-24', open: 108, high: 111, low: 107, close: 110 },
    { time: '2024-01-25', open: 110, high: 113, low: 109, close: 112 },
    { time: '2024-01-26', open: 112, high: 115, low: 111, close: 114 },
    { time: '2024-01-27', open: 114, high: 117, low: 113, close: 116 },
    { time: '2024-01-28', open: 116, high: 119, low: 115, close: 118 },
    { time: '2024-01-29', open: 118, high: 121, low: 117, close: 120 },
    { time: '2024-01-30', open: 120, high: 123, low: 119, close: 122 },
  ]
  
  return data
}

describe('KDJ 计算引擎', () => {
  it('应该正确计算 KDJ 指标', () => {
    const data = createKDJMockData()
    const result = computeKDJ(data)
    
    // 验证返回结构
    expect(result).toHaveProperty('k')
    expect(result).toHaveProperty('d')
    expect(result).toHaveProperty('j')
    
    // 验证数据长度
    expect(result.k.length).toBe(data.length)
    expect(result.d.length).toBe(data.length)
    expect(result.j.length).toBe(data.length)
  })
  
  it('前 N-1 个数据点应该为 null（预热期）', () => {
    const data = createKDJMockData()
    const result = computeKDJ(data, { nPeriod: 9 })
    
    // 前 8 个数据点应该为 null
    for (let i = 0; i < 8; i++) {
      expect(result.k[i]).toBeNull()
      expect(result.d[i]).toBeNull()
      expect(result.j[i]).toBeNull()
    }
    
    // 第 9 个数据点开始应该有值
    expect(result.k[8]).not.toBeNull()
    expect(result.d[8]).not.toBeNull()
    expect(result.j[8]).not.toBeNull()
  })
  
  it('应该正确识别金叉死叉特征', () => {
    const data = createKDJMockData()
    const result = computeKDJ(data)
    
    // 提取有效的 K/D 数据
    const validData = result.k
      .map((k, i) => ({
        time: data[i]?.time ?? '',
        k: k?.value ?? 0,
        d: result.d[i]?.value ?? 0,
        j: result.j[i]?.value ?? 0,
      }))
      .filter((_, i) => i >= 8) // 跳过前 8 个预热期数据
    
    // 验证金叉：K 线从下向上穿越 D 线
    // 在第 16-22 天区间应该出现金叉
    const goldenCrossIndex = validData.findIndex((d, i) => {
      if (i === 0) return false
      const prev = validData[i - 1]
      if (!prev) return false
      const prevDiff = prev.k - prev.d
      const currDiff = d.k - d.d
      return prevDiff < 0 && currDiff > 0
    })
    
    expect(goldenCrossIndex).toBeGreaterThan(0)
    
    // 验证死叉：K 线从上向下穿越 D 线
    // 在第 9-15 天区间应该出现死叉
    const deathCrossIndex = validData.findIndex((d, i) => {
      if (i === 0) return false
      const prev = validData[i - 1]
      if (!prev) return false
      const prevDiff = prev.k - prev.d
      const currDiff = d.k - d.d
      return prevDiff > 0 && currDiff < 0
    })
    
    expect(deathCrossIndex).toBeGreaterThan(0)
    expect(deathCrossIndex).toBeLessThan(goldenCrossIndex)
  })
  
  it('J 线应该等于 3K - 2D', () => {
    const data = createKDJMockData()
    const result = computeKDJ(data)
    
    const validData = result.k
      .map((k, i) => ({
        k: k?.value ?? 0,
        d: result.d[i]?.value ?? 0,
        j: result.j[i]?.value ?? 0,
      }))
      .filter((_, i) => i >= 8)
    
    for (const { k, d, j } of validData) {
      const expected = 3 * k - 2 * d
      expect(Math.abs(j - expected)).toBeLessThan(0.001)
    }
  })
  
  it('K 和 D 值应该在 0-100 范围内', () => {
    const data = createKDJMockData()
    const result = computeKDJ(data)
    
    const validK = result.k.filter((k) => k !== null).map((k) => k!.value)
    const validD = result.d.filter((d) => d !== null).map((d) => d!.value)
    
    for (const k of validK) {
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThanOrEqual(100)
    }
    
    for (const d of validD) {
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(100)
    }
  })
  
  it('应该支持自定义参数', () => {
    const data = createKDJMockData()
    const result = computeKDJ(data, { nPeriod: 14, kSmooth: 5, dSmooth: 5 })
    
    expect(result.k.length).toBe(data.length)
    expect(result.d.length).toBe(data.length)
    expect(result.j.length).toBe(data.length)
  })
  
  it('空数据应该返回空结果', () => {
    const result = computeKDJ([])
    
    expect(result.k).toEqual([])
    expect(result.d).toEqual([])
    expect(result.j).toEqual([])
  })
  
  it('应该正确处理除零情况', () => {
    // 创建所有价格相同的数据（High = Low）
    const data: CandlestickChartData[] = Array(20).fill(null).map((_, i) => ({
      time: `2024-01-${String(i + 1).padStart(2, '0')}`,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
    }))
    
    const result = computeKDJ(data)
    
    // 应该正常返回，不抛出异常
    expect(result.k.length).toBe(data.length)
    expect(result.d.length).toBe(data.length)
    expect(result.j.length).toBe(data.length)
  })
})
