import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runStrategy } from '@/services/trading/strategyEngine'
import * as scoringAdapter from '@/services/trading/scoringAdapter'
import * as hotSectorService from '@/services/input/hotSectorService'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import type { Stock } from '@/data/types'
import type { CompositeScoreView } from '@/services/trading/scoringAdapter'

const mockStocks: Stock[] = [
  { symbol: '002371.SZ', name: '北方华创', researchStatus: 'watching', source: 'manual', dataVersion: 1, price: 300, sector: '半导体设备' },
  { symbol: '601138.SH', name: '工业富联', researchStatus: 'watching', source: 'manual', dataVersion: 1, price: 25, sector: 'AI服务器' },
  { symbol: '000001.SZ', name: '平安银行', researchStatus: 'watching', source: 'manual', dataVersion: 1, price: 12, sector: '银行' },
  { symbol: '002230.SZ', name: '科大讯飞', researchStatus: 'watching', source: 'manual', dataVersion: 1, price: 50, sector: '人工智能' },
  { symbol: '600519.SH', name: '贵州茅台', researchStatus: 'watching', source: 'manual', dataVersion: 1, price: 1700, sector: '白酒' },
]

function makeScoreView(overrides: Partial<CompositeScoreView> = {}): CompositeScoreView {
  return {
    symbol: '000001.SZ',
    v6Score: 4.0,
    intelligentScore: null,
    industryScore: null,
    valuationScore: 4.0,
    composite: 4.0,
    rationale: 'test',
    scoredAt: Date.now(),
    ...overrides,
  }
}

describe('strategyEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    vi.spyOn(hotSectorService, 'getHotSectors').mockReturnValue([
      {
        code: 'ai',
        name: '人工智能',
        score: 90,
        trend: 'up',
        factors: { momentum: 90, fundFlow: 80, valuation: 70, sentiment: 85 },
        stocks: [],
      },
      {
        code: 'semiconductor',
        name: '半导体',
        score: 80,
        trend: 'up',
        factors: { momentum: 80, fundFlow: 75, valuation: 70, sentiment: 80 },
        stocks: [],
      },
    ])
  })

  it('returns empty result for empty stock list', async () => {
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue([])
    const result = await runStrategy([], { theme: CORE_RESOURCE_THEME })
    expect(result.summary.total).toBe(0)
    expect(result.selected).toHaveLength(0)
  })

  it('classifies core-scarce stocks matching theme with high composite', async () => {
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue([
      makeScoreView({ symbol: '002371.SZ', composite: 4.2, valuationScore: 4.1 }),
      makeScoreView({ symbol: '601138.SH', composite: 4.0, valuationScore: 4.3 }),
      makeScoreView({ symbol: '000001.SZ', composite: 3.8, valuationScore: 4.0 }),
    ])

    const result = await runStrategy(mockStocks.slice(0, 3), {
      theme: CORE_RESOURCE_THEME,
      momentumMap: { '002371.SZ': 0.06, '601138.SH': 0.04, '000001.SZ': 0.02 },
    })

    expect(result.coreScarce).toHaveLength(2)
    expect(result.coreScarce.map((c) => c.symbol)).toContain('002371.SZ')
    expect(result.coreScarce.map((c) => c.symbol)).toContain('601138.SH')
    expect(result.summary.coreScarceCount).toBe(2)
  })

  it('classifies value-bargain stocks with high valuation but moderate composite', async () => {
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue([
      makeScoreView({ symbol: '000001.SZ', composite: 3.7, valuationScore: 4.2 }),
      makeScoreView({ symbol: '600519.SH', composite: 4.1, valuationScore: 4.5 }),
    ])

    const result = await runStrategy(
      [
        { ...mockStocks[2]!, sector: '银行' },
        { ...mockStocks[4]!, sector: '白酒' },
      ],
      {
        theme: CORE_RESOURCE_THEME,
        momentumMap: { '000001.SZ': 0.01, '600519.SH': 0.02 },
      },
    )

    expect(result.valueBargain.map((c) => c.symbol)).toContain('000001.SZ')
    // 600519 综合分 4.1 但主题不匹配，估值高，应被标为价值洼地
    expect(result.valueBargain.map((c) => c.symbol)).toContain('600519.SH')
  })

  it('classifies hot-momentum stocks in hot sectors with positive momentum', async () => {
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue([
      makeScoreView({ symbol: '002230.SZ', composite: 3.8, valuationScore: 3.5 }),
      makeScoreView({ symbol: '002371.SZ', composite: 3.9, valuationScore: 3.6 }),
    ])

    const result = await runStrategy(
      [
        { ...mockStocks[3]!, sector: '人工智能' },
        { ...mockStocks[0]!, sector: '半导体设备' },
      ],
      {
        theme: CORE_RESOURCE_THEME,
        momentumMap: { '002230.SZ': 0.06, '002371.SZ': 0.08 },
      },
    )

    expect(result.hotMomentum.map((c) => c.symbol)).toContain('002230.SZ')
    // 002371 匹配主题且综合分 3.9 < 4.0，但满足热门追涨条件
    expect(result.hotMomentum.map((c) => c.symbol)).toContain('002371.SZ')
  })

  it('applies 20 into 13 selection and filters low valuation with moderate composite', async () => {
    const stocks: Stock[] = Array.from({ length: 20 }, (_, i) => ({
      symbol: `STK${i.toString().padStart(2, '0')}.SZ`,
      name: `股票${i}`,
      researchStatus: 'watching',
      source: 'manual',
      dataVersion: 1,
      price: 10 + i,
      sector: i % 2 === 0 ? '人工智能' : '银行',
    }))

    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue(
      stocks.map((s, i) =>
        makeScoreView({
          symbol: s.symbol,
          composite: 3.6 + i * 0.02,
          valuationScore: i === 0 ? 2.0 : 4.0,
        }),
      ),
    )

    const momentumMap: Record<string, number> = {}
    stocks.forEach((s) => (momentumMap[s.symbol] = 0.06))

    const result = await runStrategy(stocks, {
      theme: CORE_RESOURCE_THEME,
      momentumMap,
    })

    expect(result.summary.total).toBe(20)
    expect(result.selected).toHaveLength(13)
    expect(result.rejected.some((c) => c.symbol === 'STK00.SZ')).toBe(true)
    expect(result.selected[0]?.symbol).toBe('STK19.SZ')
  })

  it('excludes stocks below composite threshold', async () => {
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue([
      makeScoreView({ symbol: '000001.SZ', composite: 3.5, valuationScore: 4.2 }),
    ])

    const result = await runStrategy([mockStocks[2]!], {
      theme: CORE_RESOURCE_THEME,
      momentumMap: { '000001.SZ': 0.1 },
    })

    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.reasons.some((r) => r.includes('综合分'))).toBe(true)
  })
})
