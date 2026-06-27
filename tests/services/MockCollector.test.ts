import { describe, expect, it } from 'vitest'
import { MockCollector } from '@/services/data-collector/collectors/MockCollector'
import type { DataSourceConfig } from '@/types/modules/widget.types'
import { KAI_DIMENSION_NAMES, STOCK_POOL_STATUS_COLORS } from '@/constants/cockpit.constants'

/**
 * MockCollector 单元测试
 * @description 重点验证 A/B/C 三个板块对应端点的随机数据生成是否符合预期结构
 * @coverage 投资画像/分析中心、股票池管理、KAI 选股综合评分
 */
describe('MockCollector - 随机数据生成（A/B/C 板块）', () => {
  const collector = new MockCollector()

  const createDataSource = (endpoint: string): DataSourceConfig => ({
    type: 'mock',
    mode: 'polling',
    interval: 5000,
    endpoint,
    enabled: true,
  })

  // ============================================================
  // A. 投资画像 / 分析中心
  // ============================================================
  describe('A. 投资画像/分析中心 /stock-analysis/profile', () => {
    it('应返回 dataType=analysisScores 的 RawMarketData', async () => {
      const ds = createDataSource('/stock-analysis/profile')
      const raw = await collector.collect(ds)

      expect(raw.dataType).toBe('analysisScores')
      expect(raw.source).toBe('mock')
      expect(raw.timestamp).toBeGreaterThan(0)
    })

    it('应包含用户画像标签与核心指标', async () => {
      const ds = createDataSource('/stock-analysis/profile')
      const raw = await collector.collect(ds)
      const payload = raw.payload as Record<string, unknown>
      const profile = payload.profile as Record<string, unknown>

      expect(Array.isArray(profile.tags)).toBe(true)
      expect((profile.tags as string[]).length).toBeGreaterThan(0)
      expect(Array.isArray(profile.metrics)).toBe(true)
      expect((profile.metrics as unknown[]).length).toBeGreaterThanOrEqual(4)
    })

    it('指标评分应在 60-100 合理区间', async () => {
      const ds = createDataSource('/stock-analysis/profile')
      const raw = await collector.collect(ds)
      const profile = (raw.payload as Record<string, unknown>).profile as Record<string, unknown>
      const metrics = profile.metrics as Array<{ score: number }>

      metrics.forEach((metric) => {
        expect(metric.score).toBeGreaterThanOrEqual(60)
        expect(metric.score).toBeLessThanOrEqual(100)
      })
    })
  })

  // ============================================================
  // B. 股票池管理与监控
  // ============================================================
  describe('B. 股票池管理 /stock-analysis/pool', () => {
    it('应返回 dataType=stockPool 的 RawMarketData', async () => {
      const ds = createDataSource('/stock-analysis/pool')
      const raw = await collector.collect(ds)

      expect(raw.dataType).toBe('stockPool')
      expect(raw.source).toBe('mock')
    })

    it('应包含分页股票列表与总条数', async () => {
      const ds = createDataSource('/stock-analysis/pool')
      const raw = await collector.collect(ds)
      const pool = raw.payload as Record<string, unknown>

      expect(Array.isArray(pool.stocks)).toBe(true)
      expect((pool.stocks as unknown[]).length).toBeGreaterThan(0)
      expect(pool.total).toBeGreaterThanOrEqual((pool.stocks as unknown[]).length)
      expect(pool.page).toBe(1)
      expect(pool.pageSize).toBeGreaterThan(0)
    })

    it('每只股票应包含 code/name/price/changePercent/turnover/turnoverRate/statusColor', async () => {
      const ds = createDataSource('/stock-analysis/pool')
      const raw = await collector.collect(ds)
      const pool = raw.payload as Record<string, unknown>
      const stocks = pool.stocks as Array<Record<string, unknown>>

      stocks.forEach((stock) => {
        expect(typeof stock.code).toBe('string')
        expect(typeof stock.name).toBe('string')
        expect(typeof stock.price).toBe('number')
        expect(typeof stock.changePercent).toBe('number')
        expect(typeof stock.turnover).toBe('string')
        expect(typeof stock.turnoverRate).toBe('string')
        expect(typeof stock.statusColor).toBe('string')
        expect(typeof stock.statusLabel).toBe('string')
      })
    })

    it('股票状态颜色应来自常量映射', async () => {
      const ds = createDataSource('/stock-analysis/pool')
      const raw = await collector.collect(ds)
      const pool = raw.payload as Record<string, unknown>
      const stocks = pool.stocks as Array<{ statusColor: string }>

      const validColors = Object.values(STOCK_POOL_STATUS_COLORS).map((c) => c.bgClass)
      stocks.forEach((stock) => {
        expect(validColors).toContain(stock.statusColor)
      })
    })
  })

  // ============================================================
  // C. KAI 选股综合评分
  // ============================================================
  describe('C. KAI 选股综合评分 /stock-analysis/kai', () => {
    it('应返回 dataType=analysisScores 的 RawMarketData', async () => {
      const ds = createDataSource('/stock-analysis/kai')
      const raw = await collector.collect(ds)

      expect(raw.dataType).toBe('analysisScores')
    })

    it('应包含综合评分、情绪/趋势/流量值与六大维度', async () => {
      const ds = createDataSource('/stock-analysis/kai')
      const raw = await collector.collect(ds)
      const kai = (raw.payload as Record<string, unknown>).kai as Record<string, unknown>

      expect(typeof kai.totalScore).toBe('number')
      expect(typeof kai.sentiment).toBe('number')
      expect(typeof kai.trend).toBe('number')
      expect(typeof kai.flow).toBe('number')
      expect(Array.isArray(kai.dimensions)).toBe(true)
      expect((kai.dimensions as unknown[]).length).toBe(6)
    })

    it('六大维度名称应来自 KAI_DIMENSION_NAMES 常量', async () => {
      const ds = createDataSource('/stock-analysis/kai')
      const raw = await collector.collect(ds)
      const kai = (raw.payload as Record<string, unknown>).kai as Record<string, unknown>
      const dimensions = kai.dimensions as Array<{ name: string }>

      const expectedNames = Object.values(KAI_DIMENSION_NAMES)
      expect(dimensions.length).toBe(expectedNames.length)
      dimensions.forEach((dim) => {
        expect(expectedNames).toContain(dim.name)
      })
    })

    it('各维度评分应在 60-100 区间并包含细项分布', async () => {
      const ds = createDataSource('/stock-analysis/kai')
      const raw = await collector.collect(ds)
      const kai = (raw.payload as Record<string, unknown>).kai as Record<string, unknown>
      const dimensions = kai.dimensions as Array<{ score: number }>
      const details = kai.detailDistribution as Array<{ dimensionName: string; score: number }>

      dimensions.forEach((dim) => {
        expect(dim.score).toBeGreaterThanOrEqual(60)
        expect(dim.score).toBeLessThanOrEqual(100)
      })

      expect(details.length).toBeGreaterThan(dimensions.length)
      details.forEach((item) => {
        expect(item.score).toBeGreaterThanOrEqual(60)
        expect(item.score).toBeLessThanOrEqual(100)
      })
    })
  })

  // ============================================================
  // D. 通用稳定性
  // ============================================================
  describe('通用稳定性', () => {
    it('未知端点应抛出错误', async () => {
      const ds = createDataSource('/unknown/endpoint')
      await expect(collector.collect(ds)).rejects.toThrow('未知的 endpoint')
    })

    it('多次采集同一端点应产生不同随机值', async () => {
      const ds = createDataSource('/stock-analysis/pool')
      const raw1 = await collector.collect(ds)
      const raw2 = await collector.collect(ds)

      const stocks1 = (raw1.payload as Record<string, unknown>).stocks as Array<{ price: number }>
      const stocks2 = (raw2.payload as Record<string, unknown>).stocks as Array<{ price: number }>

      const allSame = stocks1.every((s, i) => s.price === stocks2[i]?.price)
      expect(allSame).toBe(false)
    })
  })
})
