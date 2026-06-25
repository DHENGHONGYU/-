import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { getCompositeScore } from '@/services/trading/scoringAdapter'
import type { IndustryScore, IntelligentScore, Stock, V6Score } from '@/data/types'

async function seedV6Score(score: V6Score): Promise<void> {
  await dataLayer.v6Scores.save(score)
}

async function seedIntelligentScore(score: IntelligentScore): Promise<void> {
  await dataLayer.intelligentScores.save(score)
}

async function seedIndustryScore(score: IndustryScore): Promise<void> {
  await dataLayer.industryScores.save(score)
}

function buildStock(symbol: string, sector?: string): Stock {
  return {
    symbol,
    name: `${symbol} 测试`,
    researchStatus: 'candidate',
    source: 'manual',
    dataVersion: 1,
    sector,
  }
}

describe('scoringAdapter', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
  })

  it('should aggregate v6, intelligent and industry scores', async () => {
    const stock = buildStock('000001.SZ', '半导体')

    await seedV6Score({
      symbol: '000001.SZ',
      score: 4.2,
      factors: {},
      algorithmVersion: 'v6',
      calculatedAt: 1_000_000,
      dataVersion: 1,
    })

    await seedIntelligentScore({
      symbol: '000001.SZ',
      overallScore: 4.5,
      dimensionScores: [],
      summary: '',
      basis: '',
      missingFields: [],
      sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
      configSnapshot: { model: 'gpt-4', baseURL: '' },
      modelResponse: '',
      dataVersion: 1,
      scoredAt: 2_000_000,
    })

    await seedIndustryScore({
      code: 'semi',
      name: '半导体',
      overallScore: 4.0,
      dimensionScores: [],
      summary: '',
      basis: '',
      missingFields: [],
      sectorSnapshot: { composite: 4.3, recommendation: '超配', positionPct: '15-20%', subTracks: [] },
      configSnapshot: { model: 'gpt-4', baseURL: '' },
      modelResponse: '',
      scoredAt: 3_000_000,
    })

    const view = await getCompositeScore(stock)

    expect(view.symbol).toBe('000001.SZ')
    expect(view.v6Score).toBe(4.2)
    expect(view.intelligentScore).toBe(4.5)
    expect(view.industryScore).toBe(4.3)
    expect(view.composite).toBeGreaterThan(0)
    expect(view.rationale).toContain('V6自动评分 4.2')
    expect(view.rationale).toContain('智能评分 4.5')
    expect(view.rationale).toContain('行业评分 4.3')
  })

  it('should fallback to v6 score when other scores are missing', async () => {
    const stock = buildStock('000002.SZ')

    await seedV6Score({
      symbol: '000002.SZ',
      score: 3.8,
      factors: {},
      algorithmVersion: 'v6',
      calculatedAt: 1_000_000,
      dataVersion: 1,
    })

    const view = await getCompositeScore(stock)

    expect(view.v6Score).toBe(3.8)
    expect(view.intelligentScore).toBeNull()
    expect(view.industryScore).toBeNull()
    expect(view.composite).toBe(3.8)
  })

  it('should return null composite when no scores available', async () => {
    const stock = buildStock('000003.SZ')

    const view = await getCompositeScore(stock)

    expect(view.composite).toBeNull()
    expect(view.rationale).toBe('暂无评分数据')
  })

  it('should expose valuationScore from v6 factor', async () => {
    const stock = buildStock('000004.SZ')

    await seedV6Score({
      symbol: '000004.SZ',
      score: 4.0,
      factors: { 估值: 4.5, 成长: 3.5 },
      algorithmVersion: 'v6',
      calculatedAt: 1_000_000,
      dataVersion: 1,
    })

    const view = await getCompositeScore(stock)

    expect(view.valuationScore).toBe(4.5)
    expect(view.rationale).toContain('估值分 4.5')
  })
})
