/**
 * @test_id V9-TEST-UT-031
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-BACK-027, V9-DOC-DATA-052, V9-DOC-DATA-042, V9-DOC-DATA-051]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  getHotSectors,
  getHotSectorByCode,
  addHotSectorStock,
  addHotSectorStocks,
} from '@/services/input/hotSectorService'
import type { RotationSectorScore } from '@/data/types'

// 测试夹具：rotationScores seed 数据（hotSectorService 现从 rotationScores store 读取）
const TEST_SCORE_DATE = '2026-08-09'
const seedRotationScores: RotationSectorScore[] = [
  {
    id: '801050.SW__20260809',
    sectorCode: '801050.SW',
    sectorName: '人工智能',
    scoreDate: TEST_SCORE_DATE,
    f1Jingqi: 90,
    f2Zijin: 82,
    f3Guzhi: 65,
    f4Beta: 75,
    f5Nengliang: 85,
    total: 88,
    resonance: 8,
    signal: 'buy',
    alertLevel: 'none',
    declineType: 'none',
    poolStocks: [
      { symbol: '002230.SZ', name: '科大讯飞' },
      { symbol: '688256.SH', name: '寒武纪' },
    ],
    modelUsed: 'test',
    createdAt: '2026-08-09T00:00:00Z',
  },
  {
    id: '801120.SW__20260809',
    sectorCode: '801120.SW',
    sectorName: '半导体',
    scoreDate: TEST_SCORE_DATE,
    f1Jingqi: 85,
    f2Zijin: 78,
    f3Guzhi: 68,
    f4Beta: 70,
    f5Nengliang: 80,
    total: 82,
    resonance: 7,
    signal: 'buy',
    alertLevel: 'none',
    declineType: 'none',
    poolStocks: [
      { symbol: '600519.SH', name: '贵州茅台' },
      { symbol: '000001.SZ', name: '平安银行' },
    ],
    modelUsed: 'test',
    createdAt: '2026-08-09T00:00:00Z',
  },
]

describe('hotSectorService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    // Seed rotationScores store（hotSectorService 改为从 rotationScores store 读取）
    for (const rs of seedRotationScores) {
      await dataLayer.rotationScores.save(rs)
    }
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
  })

  it('returns configured hot sectors', async () => {
    const sectors = await getHotSectors()
    expect(sectors.length).toBeGreaterThan(0)
    expect(sectors[0]).toHaveProperty('code')
    expect(sectors[0]).toHaveProperty('name')
    expect(sectors[0]).toHaveProperty('score')
    expect(sectors[0]).toHaveProperty('stocks')
  })

  it('finds sector by code', async () => {
    const sectors = await getHotSectors()
    const sector = await getHotSectorByCode(sectors[0]!.code)
    expect(sector).toBeDefined()
    expect(sector?.code).toBe(sectors[0]!.code)
  })

  it('adds a single hot sector stock to candidate pool', async () => {
    const sectors = await getHotSectors()
    const sector = sectors[0]!
    const target = sector.stocks[0]!

    const result = await addHotSectorStock(sector.code, target.symbol)

    expect(result.success).toBe(true)
    const stock = await dataLayer.stocks.get(target.symbol)
    expect(stock).toBeDefined()
    expect(stock?.name).toBe(target.name)
    expect(stock?.researchStatus).toBe('screening')
  })

  it('skips adding existing hot sector stock', async () => {
    const sectors = await getHotSectors()
    const sector = sectors[0]!
    const target = sector.stocks[0]!

    await addHotSectorStock(sector.code, target.symbol)
    const result = await addHotSectorStock(sector.code, target.symbol)

    expect(result.success).toBe(false)
    expect(result.error).toContain('已存在')
  })

  it('adds all stocks of a sector', async () => {
    const sectors = await getHotSectors()
    const sector = sectors[0]!

    const result = await addHotSectorStocks(sector.code)

    expect(result.success).toBe(true)
    expect(result.data?.added.length).toBe(sector.stocks.length)

    for (const stock of sector.stocks) {
      const saved = await dataLayer.stocks.get(stock.symbol)
      expect(saved).toBeDefined()
    }
  })
})
