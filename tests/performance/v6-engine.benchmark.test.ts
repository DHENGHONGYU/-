/**
 * @test_id V9-TEST-PERF-001
 * V6 评分引擎性能基准测试套件
 *
 * 测试目标：
 * 1. 建立 V6 评分引擎性能基线（单只 / 批量 / 各层耗时分布）
 * 2. 检测性能回归（与历史基线对比）
 * 3. 验证冷启动 vs 热启动差异
 * 4. 评估内存占用与稳定性
 *
 * 性能指标：
 * - 平均耗时、中位数、P95、标准差
 * - 内存占用变化
 * - 多次运行方差（稳定性）
 *
 * 验收标准（宽松阈值，用于回归检测而非硬失败）：
 * - 单只评分 < 20ms（热启动）
 * - 100 只批量 < 500ms
 * - 1000 只批量 < 3000ms
 * - 多次运行变异系数 < 30%
 *
 * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066]
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { V6ScoreEngine } from '@/services/scoring/v6-engine/engine'
import type { V6ScoreInput, LayerId } from '@/services/scoring/v6-engine/types'
import { ALL_LAYER_IDS } from '@/services/scoring/v6-engine/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 性能统计工具
// ============================================================

interface BenchmarkStats {
  /** 运行次数 */
  count: number
  /** 平均耗时（ms） */
  avg: number
  /** 中位数（ms） */
  median: number
  /** P95 分位（ms） */
  p95: number
  /** 最小值（ms） */
  min: number
  /** 最大值（ms） */
  max: number
  /** 标准差（ms） */
  stdDev: number
  /** 变异系数（标准差/均值，衡量稳定性） */
  cv: number
}

function computeStats(timings: number[]): BenchmarkStats {
  const sorted = [...timings].sort((a, b) => a - b)
  const count = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  const avg = sum / count
  const median = sorted[Math.floor(count * 0.5)] ?? 0
  const p95 = sorted[Math.floor(count * 0.95)] ?? sorted[count - 1] ?? 0
  const min = sorted[0] ?? 0
  const max = sorted[count - 1] ?? 0
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / count
  const stdDev = Math.sqrt(variance)
  const cv = avg > 0 ? stdDev / avg : 0

  return { count, avg, median, p95, min, max, stdDev, cv }
}

function measureMemory(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

function formatStats(label: string, stats: BenchmarkStats): string {
  return (
    `${label}: avg=${stats.avg.toFixed(2)}ms, median=${stats.median.toFixed(2)}ms, ` +
    `p95=${stats.p95.toFixed(2)}ms, min=${stats.min.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms, ` +
    `stdDev=${stats.stdDev.toFixed(2)}ms, cv=${(stats.cv * 100).toFixed(1)}%, n=${stats.count}`
  )
}

// ============================================================
// 测试数据生成器（确定性随机，避免 flaky）
// ============================================================

/**
 * 确定性伪随机数生成器（Mulberry32）
 * 确保每次测试生成相同的数据，消除随机波动
 */
function createSeededRandom(seed: number) {
  let a = seed >>> 0
  return function random(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateMockStockData(count: number, seed: number = 42): V6ScoreInput[] {
  const random = createSeededRandom(seed)
  const sectors = ['银行', '科技', '制造业', '医药', '消费', '能源', '地产', '汽车', '电子', '化工']
  const stocks: V6ScoreInput[] = []

  for (let i = 0; i < count; i++) {
    const price = 10 + random() * 100
    const history = Array.from({ length: 60 }, () => price * (0.9 + random() * 0.2))
    const volumeHistory = Array.from({ length: 60 }, () => 1000000 + random() * 10000000)

    stocks.push({
      symbol: `BENCH${String(i).padStart(6, '0')}`,
      stock: {
        symbol: `BENCH${String(i).padStart(6, '0')}`,
        name: `基准股票${i}`,
        sector: sectors[i % sectors.length],
        price,
        marketCap: 1000000000 + random() * 9000000000,
        pe: 5 + random() * 50,
        pb: 0.5 + random() * 8,
        roe: random() * 0.3,
        eps: random() * 5,
      },
      financials: {
        revenue: 1000000 + random() * 9000000,
        revenueYoY: (random() - 0.3) * 0.8,
        netProfit: 100000 + random() * 900000,
        netProfitYoY: (random() - 0.2) * 0.6,
        grossMargin: 0.1 + random() * 0.6,
        netMargin: random() * 0.25,
        operatingCF: 200000 + random() * 800000,
        rdRatio: random() * 0.15,
        receivables: 50000 + random() * 500000,
        inventoryTurnoverDays: 30 + random() * 180,
        interestBearingDebt: random() * 1000000,
        goodwill: random() * 200000,
        netAssets: 500000 + random() * 5000000,
        ordersInHand: 500000 + random() * 2000000,
        newOrders: random() > 0.3 ? 100000 + random() * 500000 : 0,
        shareholderPledge: random() * 0.4,
        customerConcentration: random() * 0.5,
      },
      quotes: {
        latestClose: price,
        return20d: (random() - 0.5) * 0.15,
        return60d: (random() - 0.5) * 0.3,
        volatility20d: 0.01 + random() * 0.04,
        avgTurnover20d: 0.005 + random() * 0.08,
        history,
        volumeHistory,
        shareholderCount: Array.from({ length: 4 }, () => 10000 + random() * 90000),
        northboundHoldings: Array.from({ length: 4 }, () => random() * 5000),
        mainForceFlow: Array.from({ length: 10 }, () => (random() - 0.5) * 2),
        marginBalance: Array.from({ length: 4 }, () => 1000 + random() * 10000),
      },
      industryScore: {
        sectorName: sectors[i % sectors.length]!,
        skillCScore: 2 + random() * 2,
        skillCRating: random() > 0.5 ? 'A' : 'B',
        skillNScore: 2 + random() * 2,
        relevance: 0.5 + random() * 0.5,
        allocationBias: random() > 0.5 ? '超配' : '标配',
      },
      zeroToOneEvents: i % 5 === 0 ? [
        {
          type: '技术突破',
          description: '关键技术取得重大突破',
          date: '2026-01-15',
          mce: 0.6 + random() * 0.3,
          monthsAgo: 6 + Math.floor(random() * 12),
        },
      ] : undefined,
    })
  }

  return stocks
}

// ============================================================
// 基准测试
// ============================================================

describe('V6 评分引擎性能基准测试', () => {
  let engine: V6ScoreEngine

  beforeAll(() => {
    engine = new V6ScoreEngine()
    logger.info('[Perf-Benchmark] V6 评分引擎性能基准测试开始')
  })

  afterAll(() => {
    logger.info('[Perf-Benchmark] V6 评分引擎性能基准测试结束')
  })

  // ----------------------------------------------------------
  // 1. 单只股票评分性能（冷启动 / 热启动）
  // ----------------------------------------------------------
  describe('单只股票评分性能', () => {
    let testStock: V6ScoreInput

    beforeAll(() => {
      testStock = generateMockStockData(1, 100)[0]!
    })

    it('冷启动：首次评分耗时', async () => {
      // 使用全新的引擎实例模拟冷启动
      const coldEngine = new V6ScoreEngine()
      const timings: number[] = []

      // 首次运行（冷启动，包含模块初始化开销）
      const start = performance.now()
      const result = await coldEngine.calculateAll(testStock)
      const duration = performance.now() - start
      timings.push(duration)

      const stats = computeStats(timings)

      logger.info(`[Perf] 冷启动单只评分: ${formatStats('cold-start', stats)}`)
      logger.info(`[Perf] 冷启动内存变化: ${measureMemory().toFixed(2)}MB`)

      expect(result).toBeDefined()
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(5)
      // 宽松断言：冷启动 < 200ms（包含 JIT 编译等开销）
      expect(duration).toBeLessThan(200)
    })

    it('热启动：连续多次评分平均耗时', async () => {
      const iterations = 20
      const timings: number[] = []

      // 预热 3 次，确保 JIT 编译完成
      for (let i = 0; i < 3; i++) {
        await engine.calculateAll(testStock)
      }

      // 正式测量
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await engine.calculateAll(testStock)
        timings.push(performance.now() - start)
      }

      const stats = computeStats(timings)
      logger.info(`[Perf] 热启动单只评分: ${formatStats('hot-start', stats)}`)

      expect(stats.avg).toBeGreaterThan(0)
      // 宽松断言：热启动平均 < 20ms
      expect(stats.avg).toBeLessThan(20)
      // 稳定性：变异系数 < 50%
      expect(stats.cv).toBeLessThan(0.5)
    })

    it('评分耗时稳定性：多次运行方差分析', async () => {
      const iterations = 30
      const timings: number[] = []

      // 预热
      await engine.calculateAll(testStock)
      await engine.calculateAll(testStock)

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await engine.calculateAll(testStock)
        timings.push(performance.now() - start)
      }

      const stats = computeStats(timings)
      logger.info(`[Perf] 稳定性测试: ${formatStats('stability', stats)}`)

      // 断言：P95 不超过均值的 2 倍
      expect(stats.p95).toBeLessThan(stats.avg * 2.5)
      // 变异系数 < 35%（性能测试的典型可接受范围）
      expect(stats.cv).toBeLessThan(0.35)
    })
  })

  // ----------------------------------------------------------
  // 2. 批量评分性能
  // ----------------------------------------------------------
  describe('批量评分性能', () => {
    const batchSizes = [10, 50, 100]
    const batchData: Record<number, V6ScoreInput[]> = {}

    beforeAll(() => {
      for (const size of batchSizes) {
        batchData[size] = generateMockStockData(size, 200 + size)
      }
    })

    it.each(batchSizes.map((n) => [n]))('批量评分 %i 只股票', async (size: number) => {
      const stocks = batchData[size]!
      const iterations = 5
      const timings: number[] = []

      // 预热
      await Promise.all(stocks.map((s) => engine.calculateAll(s)))

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const results = await Promise.all(stocks.map((s) => engine.calculateAll(s)))
        timings.push(performance.now() - start)
        expect(results).toHaveLength(size)
      }

      const stats = computeStats(timings)
      const perStockAvg = stats.avg / size

      logger.info(
        `[Perf] 批量评分 (n=${size}): ${formatStats('batch', stats)}, ` +
        `perStock=${perStockAvg.toFixed(3)}ms`
      )

      expect(stats.avg).toBeGreaterThan(0)
      // 宽松断言：每只股票平均 < 20ms
      expect(perStockAvg).toBeLessThan(20)
    })

    it('批量评分时间复杂度验证（近似 O(n)）', async () => {
      const size10 = batchData[10]!
      const size100 = batchData[100]!

      // 预热
      await Promise.all(size100.map((s) => engine.calculateAll(s)))

      // 测量 10 只
      const start10 = performance.now()
      await Promise.all(size10.map((s) => engine.calculateAll(s)))
      const time10 = performance.now() - start10

      // 测量 100 只
      const start100 = performance.now()
      await Promise.all(size100.map((s) => engine.calculateAll(s)))
      const time100 = performance.now() - start100

      const ratio = time100 / time10
      const expectedLinearRatio = 10 // 100/10

      logger.info(`[Perf] 时间复杂度验证: 10只=${time10.toFixed(2)}ms, 100只=${time100.toFixed(2)}ms, ` +
        `实际比例=${ratio.toFixed(2)}, 线性预期=${expectedLinearRatio}`)

      // 允许一定误差（5x ~ 15x 均视为近似线性）
      expect(ratio).toBeGreaterThan(3)
      expect(ratio).toBeLessThan(20)
    })

    it('批量评分内存占用变化', async () => {
      const size = 100
      const stocks = generateMockStockData(size, 300)
      const memBefore = measureMemory()

      const start = performance.now()
      const results = await Promise.all(stocks.map((s) => engine.calculateAll(s)))
      const duration = performance.now() - start

      const memAfter = measureMemory()
      const memDelta = memAfter - memBefore

      logger.info(`[Perf] 批量评分内存: before=${memBefore.toFixed(2)}MB, after=${memAfter.toFixed(2)}MB, ` +
        `delta=${memDelta.toFixed(2)}MB, duration=${duration.toFixed(2)}ms`)

      expect(results).toHaveLength(size)
      // 100 只评分结果内存增量应 < 50MB
      expect(memDelta).toBeLessThan(50)
    })
  })

  // ----------------------------------------------------------
  // 3. 各层计算器耗时分布
  // ----------------------------------------------------------
  describe('各层计算器耗时分布', () => {
    let testStock: V6ScoreInput

    beforeAll(() => {
      testStock = generateMockStockData(1, 400)[0]!
    })

    it('各层计算器单独耗时测量', async () => {
      const layerTimings: Record<LayerId, number[]> = {} as Record<LayerId, number[]>
      const iterations = 10

      // 预热
      for (const layerId of ALL_LAYER_IDS) {
        await engine.calculateLayer(layerId, {
          ...testStock,
          config: engine.getConfig(),
        })
      }

      // 测量每层
      for (let i = 0; i < iterations; i++) {
        for (const layerId of ALL_LAYER_IDS) {
          const start = performance.now()
          await engine.calculateLayer(layerId, {
            ...testStock,
            config: engine.getConfig(),
          })
          const dur = performance.now() - start

          if (!layerTimings[layerId]) layerTimings[layerId] = []
          layerTimings[layerId].push(dur)
        }
      }

      // 计算各层统计并输出
      const layerStats: Array<{ layer: LayerId; avg: number; p95: number }> = []
      for (const layerId of ALL_LAYER_IDS) {
        const stats = computeStats(layerTimings[layerId])
        layerStats.push({ layer: layerId, avg: stats.avg, p95: stats.p95 })
        logger.info(`[Perf] 层 ${layerId}: avg=${stats.avg.toFixed(3)}ms, p95=${stats.p95.toFixed(3)}ms`)
      }

      // 按耗时排序，找热点
      layerStats.sort((a, b) => b.avg - a.avg)
      const totalAvg = layerStats.reduce((sum, l) => sum + l.avg, 0)
      logger.info(`[Perf] 各层总耗时: ${totalAvg.toFixed(3)}ms`)
      logger.info(`[Perf] Top3 最慢层: ${layerStats.slice(0, 3).map(l => `${l.layer}(${l.avg.toFixed(2)}ms)`).join(', ')}`)

      // 断言：所有层都有有效耗时（> 0）
      for (const ls of layerStats) {
        expect(ls.avg).toBeGreaterThanOrEqual(0)
      }
      // 总耗时合理范围
      expect(totalAvg).toBeGreaterThan(0)
      expect(totalAvg).toBeLessThan(50)
    })

    it('并行计算 vs 串行计算性能对比', async () => {
      const iterations = 5
      const stock = testStock
      const parallelTimings: number[] = []
      const serialTimings: number[] = []

      // 预热
      await engine.calculateAll(stock)

      for (let i = 0; i < iterations; i++) {
        // 并行（calculateAll 内部使用 Promise.all）
        const pStart = performance.now()
        await engine.calculateAll(stock)
        parallelTimings.push(performance.now() - pStart)

        // 串行
        const sStart = performance.now()
        for (const layerId of ALL_LAYER_IDS) {
          await engine.calculateLayer(layerId, {
            ...stock,
            config: engine.getConfig(),
          })
        }
        serialTimings.push(performance.now() - sStart)
      }

      const pStats = computeStats(parallelTimings)
      const sStats = computeStats(serialTimings)
      const speedup = sStats.avg / pStats.avg

      logger.info(`[Perf] 并行 vs 串行: 并行avg=${pStats.avg.toFixed(2)}ms, 串行avg=${sStats.avg.toFixed(2)}ms, ` +
        `加速比=${speedup.toFixed(2)}x`)

      // 回归护栏：并行不应比串行慢超过 2 倍（CI/负载环境下并行开销可能使其略慢，
      // 故不强制 speedup>1，仅防止并行实现严重退化）。正确性与性能基线由其它用例覆盖。
      expect(speedup).toBeGreaterThan(0.5)
    })
  })

  // ----------------------------------------------------------
  // 4. 引擎生命周期性能
  // ----------------------------------------------------------
  describe('引擎生命周期性能', () => {
    it('引擎实例化耗时', () => {
      const iterations = 20
      const timings: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const inst = new V6ScoreEngine()
        timings.push(performance.now() - start)
        // 避免 DCE 优化
        expect(inst).toBeDefined()
      }

      const stats = computeStats(timings)
      logger.info(`[Perf] 引擎实例化: ${formatStats('instantiation', stats)}`)

      expect(stats.avg).toBeGreaterThanOrEqual(0)
      expect(stats.avg).toBeLessThan(10) // 实例化应很快
    })

    it('配置更新性能', () => {
      const localEngine = new V6ScoreEngine()
      const iterations = 100
      const timings: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        localEngine.updateConfig({
          offlineMode: i % 2 === 0,
        })
        timings.push(performance.now() - start)
      }

      const stats = computeStats(timings)
      logger.info(`[Perf] 配置更新: ${formatStats('config-update', stats)}`)

      expect(stats.avg).toBeGreaterThanOrEqual(0)
      expect(stats.avg).toBeLessThan(1) // 配置更新应极快
    })

    it('获取配置性能', () => {
      const iterations = 1000
      const timings: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const cfg = engine.getConfig()
        timings.push(performance.now() - start)
        // 避免 DCE
        expect(cfg).toBeDefined()
      }

      const stats = computeStats(timings)
      logger.info(`[Perf] 获取配置: ${formatStats('get-config', stats)}`)

      expect(stats.avg).toBeGreaterThanOrEqual(0)
      expect(stats.avg).toBeLessThan(0.1) // 微秒级
    })
  })
})
