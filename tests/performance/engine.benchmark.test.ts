/**
 * TD-001 性能基准测试：评分引擎性能验证
 * 
 * 测试目标：
 * 1. 验证评分引擎在不同数据规模下的性能表现
 * 2. 定位性能瓶颈（引擎层 vs 计算器层 vs 数据获取层）
 * 3. 确认是否存在 O(n²) 嵌套循环问题
 * 
 * 测试数据规模：
 * - 小规模：100 条股票数据
 * - 中规模：1,000 条股票数据
 * - 大规模：5,000 条股票数据
 * - 超大规模：10,000 条股票数据
 * 
 * 性能指标：
 * - 总耗时（毫秒）
 * - 平均每股票耗时（微秒）
 * - 内存占用（MB）
 * 
 * 验收标准：
 * - 1,000 条数据 < 500ms
 * - 5,000 条数据 < 2,500ms
 * - 10,000 条数据 < 5,000ms
 * - 时间复杂度应为 O(n)，而非 O(n²)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { V6ScoreEngine } from '@/services/scoring/v6-engine/engine'
import type { LayerInput, V6ScoreInput } from '@/services/scoring/v6-engine/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 测试数据生成器
// ============================================================

interface BenchmarkResult {
  dataSize: number
  totalTime: number
  avgTimePerStock: number
  memoryUsage: number
}

function generateMockStockData(count: number): V6ScoreInput[] {
  const stocks: V6ScoreInput[] = []
  
  for (let i = 0; i < count; i++) {
    stocks.push({
      symbol: `TEST${String(i).padStart(4, '0')}`,
      name: `测试股票${i}`,
      sector: i % 10 === 0 ? '银行' : i % 10 === 1 ? '科技' : '制造业',
      financials: {
        revenue: 1000000 + Math.random() * 9000000,
        revenueYoY: (Math.random() - 0.3) * 0.5,
        netProfit: 100000 + Math.random() * 900000,
        netMargin: Math.random() * 0.3,
        operatingCF: 200000 + Math.random() * 800000,
        ordersInHand: 500000 + Math.random() * 2000000,
        newOrders: Math.random() > 0.5 ? 100000 + Math.random() * 500000 : 0,
      },
      valuation: {
        pe: 10 + Math.random() * 40,
        pb: 1 + Math.random() * 5,
        ps: 2 + Math.random() * 10,
        pcf: 5 + Math.random() * 20,
      },
      marketData: {
        price: 10 + Math.random() * 100,
        changePercent: (Math.random() - 0.5) * 10,
        volume: 1000000 + Math.random() * 10000000,
        turnoverRate: Math.random() * 0.1,
        marketCap: 1000000000 + Math.random() * 9000000000,
      },
      technical: {
        ma5: 50 + Math.random() * 50,
        ma20: 45 + Math.random() * 55,
        ma60: 40 + Math.random() * 60,
        rsi: 30 + Math.random() * 40,
        macd: (Math.random() - 0.5) * 2,
      },
      chipDistribution: {
        concentration: Math.random(),
        avgCost: 50 + Math.random() * 50,
        profitRatio: Math.random(),
      },
      news: [
        { title: '公司新闻1', sentiment: Math.random() > 0.5 ? 'positive' : 'negative', timestamp: Date.now() - 86400000 },
        { title: '公司新闻2', sentiment: Math.random() > 0.5 ? 'positive' : 'neutral', timestamp: Date.now() - 172800000 },
      ],
    })
  }
  
  return stocks
}

function measureMemory(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

// ============================================================
// 性能基准测试
// ============================================================

describe('TD-001: 评分引擎性能基准测试', () => {
  let engine: V6ScoreEngine
  
  beforeAll(() => {
    engine = new V6ScoreEngine()
    logger.info('[Benchmark] 评分引擎性能基准测试开始')
  })
  
  it('小规模数据（100 条）性能测试', async () => {
    const dataSize = 100
    const stocks = generateMockStockData(dataSize)
    
    const startTime = performance.now()
    const startMemory = measureMemory()
    
    // 执行评分
    const results = await Promise.all(
      stocks.map(async (stock) => {
        const input: LayerInput = {
          symbol: stock.symbol,
          financials: stock.financials,
          valuation: stock.valuation,
          marketData: stock.marketData,
          technical: stock.technical,
          chipDistribution: stock.chipDistribution,
          news: stock.news,
        }
        return engine.calculateAll(input)
      })
    )
    
    const endTime = performance.now()
    const endMemory = measureMemory()
    
    const totalTime = endTime - startTime
    const avgTimePerStock = (totalTime / dataSize) * 1000 // 微秒
    const memoryUsage = endMemory - startMemory
    
    const result: BenchmarkResult = {
      dataSize,
      totalTime,
      avgTimePerStock,
      memoryUsage,
    }
    
    logger.info('[Benchmark] 小规模数据性能测试结果', {
      dataSize,
      totalTime: `${totalTime.toFixed(2)}ms`,
      avgTimePerStock: `${avgTimePerStock.toFixed(2)}μs`,
      memoryUsage: `${memoryUsage.toFixed(2)}MB`,
    })
    
    // 验收标准：100 条数据 < 50ms
    expect(totalTime).toBeLessThan(50)
    expect(results).toHaveLength(dataSize)
  })
  
  it('中规模数据（1,000 条）性能测试', async () => {
    const dataSize = 1000
    const stocks = generateMockStockData(dataSize)
    
    const startTime = performance.now()
    const startMemory = measureMemory()
    
    const results = await Promise.all(
      stocks.map(async (stock) => {
        const input: LayerInput = {
          symbol: stock.symbol,
          financials: stock.financials,
          valuation: stock.valuation,
          marketData: stock.marketData,
          technical: stock.technical,
          chipDistribution: stock.chipDistribution,
          news: stock.news,
        }
        return engine.calculateAll(input)
      })
    )
    
    const endTime = performance.now()
    const endMemory = measureMemory()
    
    const totalTime = endTime - startTime
    const avgTimePerStock = (totalTime / dataSize) * 1000
    const memoryUsage = endMemory - startMemory
    
    const result: BenchmarkResult = {
      dataSize,
      totalTime,
      avgTimePerStock,
      memoryUsage,
    }
    
    logger.info('[Benchmark] 中规模数据性能测试结果', {
      dataSize,
      totalTime: `${totalTime.toFixed(2)}ms`,
      avgTimePerStock: `${avgTimePerStock.toFixed(2)}μs`,
      memoryUsage: `${memoryUsage.toFixed(2)}MB`,
    })
    
    // 验收标准：1,000 条数据 < 500ms
    expect(totalTime).toBeLessThan(500)
    expect(results).toHaveLength(dataSize)
  })
  
  it('大规模数据（5,000 条）性能测试', async () => {
    const dataSize = 5000
    const stocks = generateMockStockData(dataSize)
    
    const startTime = performance.now()
    const startMemory = measureMemory()
    
    const results = await Promise.all(
      stocks.map(async (stock) => {
        const input: LayerInput = {
          symbol: stock.symbol,
          financials: stock.financials,
          valuation: stock.valuation,
          marketData: stock.marketData,
          technical: stock.technical,
          chipDistribution: stock.chipDistribution,
          news: stock.news,
        }
        return engine.calculateAll(input)
      })
    )
    
    const endTime = performance.now()
    const endMemory = measureMemory()
    
    const totalTime = endTime - startTime
    const avgTimePerStock = (totalTime / dataSize) * 1000
    const memoryUsage = endMemory - startMemory
    
    const result: BenchmarkResult = {
      dataSize,
      totalTime,
      avgTimePerStock,
      memoryUsage,
    }
    
    logger.info('[Benchmark] 大规模数据性能测试结果', {
      dataSize,
      totalTime: `${totalTime.toFixed(2)}ms`,
      avgTimePerStock: `${avgTimePerStock.toFixed(2)}μs`,
      memoryUsage: `${memoryUsage.toFixed(2)}MB`,
    })
    
    // 验收标准：5,000 条数据 < 2,500ms
    expect(totalTime).toBeLessThan(2500)
    expect(results).toHaveLength(dataSize)
  })
  
  it('超大规模数据（10,000 条）性能测试', async () => {
    const dataSize = 10000
    const stocks = generateMockStockData(dataSize)
    
    const startTime = performance.now()
    const startMemory = measureMemory()
    
    const results = await Promise.all(
      stocks.map(async (stock) => {
        const input: LayerInput = {
          symbol: stock.symbol,
          financials: stock.financials,
          valuation: stock.valuation,
          marketData: stock.marketData,
          technical: stock.technical,
          chipDistribution: stock.chipDistribution,
          news: stock.news,
        }
        return engine.calculateAll(input)
      })
    )
    
    const endTime = performance.now()
    const endMemory = measureMemory()
    
    const totalTime = endTime - startTime
    const avgTimePerStock = (totalTime / dataSize) * 1000
    const memoryUsage = endMemory - startMemory
    
    const result: BenchmarkResult = {
      dataSize,
      totalTime,
      avgTimePerStock,
      memoryUsage,
    }
    
    logger.info('[Benchmark] 超大规模数据性能测试结果', {
      dataSize,
      totalTime: `${totalTime.toFixed(2)}ms`,
      avgTimePerStock: `${avgTimePerStock.toFixed(2)}μs`,
      memoryUsage: `${memoryUsage.toFixed(2)}MB`,
    })
    
    // 验收标准：10,000 条数据 < 5,000ms
    expect(totalTime).toBeLessThan(5000)
    expect(results).toHaveLength(dataSize)
  })
  
  it('时间复杂度验证：应为 O(n) 而非 O(n²)', async () => {
    // 测试 1,000 条和 2,000 条数据的耗时比例
    // 如果是 O(n)，比例应接近 2:1
    // 如果是 O(n²)，比例应接近 4:1
    
    const stocks1000 = generateMockStockData(1000)
    const stocks2000 = generateMockStockData(2000)
    
    const start1 = performance.now()
    await Promise.all(
      stocks1000.map(async (stock) => {
        const input: LayerInput = {
          symbol: stock.symbol,
          financials: stock.financials,
          valuation: stock.valuation,
          marketData: stock.marketData,
          technical: stock.technical,
          chipDistribution: stock.chipDistribution,
          news: stock.news,
        }
        return engine.calculateAll(input)
      })
    )
    const time1000 = performance.now() - start1
    
    const start2 = performance.now()
    await Promise.all(
      stocks2000.map(async (stock) => {
        const input: LayerInput = {
          symbol: stock.symbol,
          financials: stock.financials,
          valuation: stock.valuation,
          marketData: stock.marketData,
          technical: stock.technical,
          chipDistribution: stock.chipDistribution,
          news: stock.news,
        }
        return engine.calculateAll(input)
      })
    )
    const time2000 = performance.now() - start2
    
    const ratio = time2000 / time1000
    
    logger.info('[Benchmark] 时间复杂度验证结果', {
      time1000: `${time1000.toFixed(2)}ms`,
      time2000: `${time2000.toFixed(2)}ms`,
      ratio: ratio.toFixed(2),
      expectedLinearRatio: '~2.0',
      expectedQuadraticRatio: '~4.0',
    })
    
    // 验收标准：比例应接近 2.0（O(n)），而非 4.0（O(n²)）
    // 允许一定误差（1.5 ~ 2.5）
    expect(ratio).toBeLessThan(2.5)
    expect(ratio).toBeGreaterThan(1.5)
  })
})
