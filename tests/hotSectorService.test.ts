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

describe('hotSectorService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  it('returns configured hot sectors', () => {
    const sectors = getHotSectors()
    expect(sectors.length).toBeGreaterThan(0)
    expect(sectors[0]).toHaveProperty('code')
    expect(sectors[0]).toHaveProperty('name')
    expect(sectors[0]).toHaveProperty('score')
    expect(sectors[0]).toHaveProperty('stocks')
  })

  it('finds sector by code', () => {
    const sectors = getHotSectors()
    const sector = getHotSectorByCode(sectors[0]!.code)
    expect(sector).toBeDefined()
    expect(sector?.code).toBe(sectors[0]!.code)
  })

  it('adds a single hot sector stock to candidate pool', async () => {
    const sectors = getHotSectors()
    const sector = sectors[0]!
    const target = sector.stocks[0]!

    const result = await addHotSectorStock(sector.code, target.symbol)

    expect(result.success).toBe(true)
    const stock = await dataLayer.stocks.get(target.symbol)
    expect(stock).toBeDefined()
    expect(stock?.name).toBe(target.name)
    expect(stock?.researchStatus).toBe('candidate')
  })

  it('skips adding existing hot sector stock', async () => {
    const sectors = getHotSectors()
    const sector = sectors[0]!
    const target = sector.stocks[0]!

    await addHotSectorStock(sector.code, target.symbol)
    const result = await addHotSectorStock(sector.code, target.symbol)

    expect(result.success).toBe(false)
    expect(result.error).toContain('已存在')
  })

  it('adds all stocks of a sector', async () => {
    const sectors = getHotSectors()
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
