/**
 * @test_id V9-TEST-UT-053
 * @covers_docs [V9-DOC-PROJ-066, V9-DOC-PROJ-054, V9-DOC-FRONT-012, V9-DOC-ARCH-008]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { runScreening, screenSingleStock } from '@/services/analysis/screeningEngine'
import type { Stock, V6Score } from '@/data/types'

async function seedCandidate(symbol: string, score: number, dataQuality?: Stock['dataQuality']): Promise<Stock> {
  await dataLayer.stocks.add({
    symbol,
    name: `${symbol} 测试`,
    pool: 'research',
    researchStatus: 'candidate',
    source: 'manual',
    dataQuality,
  })

  const v6Score: V6Score = {
    symbol,
    score,
    factors: { 估值: score },
    algorithmVersion: 'v9-auto',
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
  await dataLayer.v6Scores.save(v6Score)
  return (await dataLayer.stocks.get(symbol))!
}

async function seedScreened(symbol: string, score: number, dataQuality?: Stock['dataQuality']): Promise<Stock> {
  await dataLayer.stocks.add({
    symbol,
    name: `${symbol} 测试`,
    pool: 'research',
    researchStatus: 'screened',
    source: 'manual',
    dataQuality,
  })

  const v6Score: V6Score = {
    symbol,
    score,
    factors: { 估值: score },
    algorithmVersion: 'v9-auto',
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
  await dataLayer.v6Scores.save(v6Score)
  return (await dataLayer.stocks.get(symbol))!
}

describe('ScreeningEngine', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
  })

  it('promotes candidate to screened when v6 score and data quality meet thresholds', async () => {
    await seedCandidate('600101.SH', 3.5, { basic: true, kline: true, finance: false })

    const result = await runScreening()
    expect(result.success).toBe(true)
    expect(result.data?.promotedToScreened).toContain('600101.SH')

    const updated = await dataLayer.stocks.get('600101.SH')
    expect(updated?.researchStatus).toBe('screened')
  })

  it('does not promote candidate when v6 score is too low', async () => {
    await seedCandidate('600102.SH', 2.0, { basic: true, kline: true, finance: false })

    const result = await runScreening()
    expect(result.success).toBe(true)
    expect(result.data?.promotedToScreened).toHaveLength(0)

    const updated = await dataLayer.stocks.get('600102.SH')
    expect(updated?.researchStatus).toBe('candidate')
  })

  it('does not promote candidate when data quality is insufficient', async () => {
    await seedCandidate('600103.SH', 4.0, { basic: true, kline: false, finance: false })

    const result = await runScreening()
    expect(result.success).toBe(true)
    expect(result.data?.promotedToScreened).toHaveLength(0)
  })

  it('promotes screened to deepDive when v6 score and finance quality meet thresholds', async () => {
    await seedScreened('600104.SH', 4.5, { basic: true, kline: true, finance: true })

    const result = await runScreening()
    expect(result.success).toBe(true)
    expect(result.data?.promotedToDeepDive).toContain('600104.SH')

    const updated = await dataLayer.stocks.get('600104.SH')
    expect(updated?.researchStatus).toBe('deepDive')
  })

  it('screenSingleStock promotes a specific candidate', async () => {
    await seedCandidate('600105.SH', 3.5, { basic: true, kline: true, finance: false })

    const result = await screenSingleStock('600105.SH')
    expect(result.success).toBe(true)
    expect(result.data?.promotedToScreened).toContain('600105.SH')
  })
})
