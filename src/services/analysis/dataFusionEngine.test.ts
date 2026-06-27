import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  fuseStockData,
  fuseStockDataBatch,
  type FusionOptions,
} from './dataFusionEngine'
// ============================================================
// Mock dataLayer
// ============================================================

const mockStock = {
  symbol: '600519',
  name: '贵州茅台',
  price: 1800,
  pe: 35,
  pb: 12,
  roe: 30,
  marketCap: 2200000000000,
  sector: '白酒',
  industryCode: 'SW_白酒',
}

const mockQuotes = {
  symbol: '600519',
  latest: { date: '2026-06-26', open: 1790, high: 1815, low: 1785, close: 1805, volume: 5000000, amount: 9000000000 },
  history: Array.from({ length: 60 }, (_, i) => ({
    date: `2026-0${Math.floor(i / 20) + 4}-${String((i % 20) + 1).padStart(2, '0')}`,
    open: 1750 + i * 0.5,
    high: 1760 + i * 0.5,
    low: 1740 + i * 0.5,
    close: 1755 + i * 0.5,
    volume: 4500000 + i * 10000,
    amount: 8000000000 + i * 1000000,
  })),
  period: 'daily',
  adjust: 'qfq',
  updatedAt: Date.now(),
}

const mockV6Score = {
  symbol: '600519',
  score: 4.2,
  factors: { 动量: 3.8, 估值: 4.5, 质量: 4.0, 情绪: 4.1 },
  algorithmVersion: 'v6.3',
  calculatedAt: Date.now(),
  dataVersion: 1,
}

const mockIntelligentScore = {
  id: 1,
  symbol: '600519',
  overallScore: 4.5,
  dimensionScores: [],
  summary: '优质标的',
  basis: '基本面强劲',
  missingFields: [],
  sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
  configSnapshot: { model: 'gpt-4', baseURL: 'http://localhost' },
  modelResponse: '',
  dataVersion: 1,
  scoredAt: Date.now(),
}

const mockSignals = [
  {
    id: 'sig-1',
    symbol: '600519',
    direction: 'buy' as const,
    type: 'technical',
    confidence: 0.85,
    rationale: '均线金叉突破',
    snapshot: {},
    createdAt: Date.now() - 86400000,
  },
]

const mockStockStore = {
  get: vi.fn().mockResolvedValue(mockStock),
}

const mockDailyQuotesStore = {
  get: vi.fn().mockResolvedValue(mockQuotes),
}

const mockV6ScoreStore = {
  get: vi.fn().mockResolvedValue(mockV6Score),
}

const mockIntelligentScoreStore = {
  getLatestBySymbol: vi.fn().mockResolvedValue(mockIntelligentScore),
}

const mockIndustryScoreStore = {
  getLatestByCode: vi.fn().mockResolvedValue(undefined),
}

const mockSignalStore = {
  listBySymbol: vi.fn().mockResolvedValue(mockSignals),
}

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: {
      get: (symbol: string) => mockStockStore.get(symbol),
    },
    dailyQuotes: {
      get: (symbol: string) => mockDailyQuotesStore.get(symbol),
    },
    v6Scores: {
      get: (symbol: string) => mockV6ScoreStore.get(symbol),
    },
    intelligentScores: {
      getLatestBySymbol: (symbol: string) => mockIntelligentScoreStore.getLatestBySymbol(symbol),
    },
    industryScores: {
      getLatestByCode: (code: string) => mockIndustryScoreStore.getLatestByCode(code),
    },
    signals: {
      listBySymbol: (symbol: string) => mockSignalStore.listBySymbol(symbol),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ============================================================
// fuseStockData 测试
// ============================================================

describe('fuseStockData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStockStore.get.mockResolvedValue(mockStock)
    mockDailyQuotesStore.get.mockResolvedValue(mockQuotes)
    mockV6ScoreStore.get.mockResolvedValue(mockV6Score)
    mockIntelligentScoreStore.getLatestBySymbol.mockResolvedValue(mockIntelligentScore)
    mockIndustryScoreStore.getLatestByCode.mockResolvedValue(undefined)
    mockSignalStore.listBySymbol.mockResolvedValue(mockSignals)
  })

  test('basic fusion: stock + quotes (default options)', async () => {
    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    const data = result.data!
    expect(data.symbol).toBe('600519')
    expect(data.name).toBe('贵州茅台')
    expect(data.price).toBe(1805)
    expect(data.pe).toBe(35)
    expect(data.pb).toBe(12)
    expect(data.roe).toBe(30)
    expect(data.marketCap).toBe(2200000000000)
    expect(data.sectorName).toBe('白酒')
  })

  test('computes technical indicators from kline', async () => {
    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    const data = result.data!
    expect(data.ma5).not.toBeNull()
    expect(data.ma10).not.toBeNull()
    expect(data.ma20).not.toBeNull()
    expect(data.rsi6).not.toBeNull()
    expect(data.rsi12).not.toBeNull()
    expect(data.rsi24).not.toBeNull()
    expect(data.macd).not.toBeNull()
    expect(data.k).not.toBeNull()
    expect(data.d).not.toBeNull()
    expect(data.j).not.toBeNull()
    expect(data.bollUpper).not.toBeNull()
    expect(data.bollMid).not.toBeNull()
    expect(data.bollLower).not.toBeNull()
    expect(data.atr).not.toBeNull()
  })

  test('computes signal interpretations from indicators', async () => {
    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    const data = result.data!
    // 上升趋势中 MA5 > MA20
    expect(data.maSignal).toBe('golden_cross')
    // 持续上升无回调 → RSI 超买
    expect(data.rsiSignal).toBe('overbought')
    // MACD 柱判断
    expect(data.macdSignal).not.toBeNull()
  })

  test('pulls V6 score factors into unified view', async () => {
    const result = await fuseStockData('600519')

    const data = result.data!
    expect(data.totalScore).toBe(4.2)
    expect(data.trendScore).toBe(3.8)
    expect(data.valueScore).toBe(4.5)
    expect(data.fundScore).toBe(4.0)
    expect(data.sentimentFactorScore).toBe(4.1)
  })

  test('returns error when stock not found', async () => {
    mockStockStore.get.mockResolvedValue(undefined)

    const result = await fuseStockData('000001')

    expect(result.success).toBe(false)
    expect(result.error).toContain('不存在')
  })

  test('graceful degradation when kline is missing', async () => {
    mockDailyQuotesStore.get.mockResolvedValue(undefined)

    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    const data = result.data!
    expect(data.ma5).toBeNull()
    expect(data.rsi6).toBeNull()
    // price falls back to stock.price
    expect(data.price).toBe(1800)
    expect(data.dataSource).toContain('completeness=')
  })

  test('computes change and changePct correctly', async () => {
    const result = await fuseStockData('600519')

    const data = result.data!
    // last close 1805, prev close = history[-2].close
    const expectedPrevClose = mockQuotes.history[mockQuotes.history.length - 2]!.close
    expect(data.prevClose).toBe(expectedPrevClose)
    expect(data.change).toBe(1805 - expectedPrevClose)
    expect(data.changePct).toBeCloseTo(((1805 - expectedPrevClose) / expectedPrevClose) * 100, 2)
  })

  test('disable indicators via FusionOptions', async () => {
    const options: FusionOptions = { computeIndicators: false }
    const result = await fuseStockData('600519', options)

    const data = result.data!
    expect(data.ma5).toBeNull()
    expect(data.macd).toBeNull()
    expect(data.rsi6).toBeNull()
    // basic data still present
    expect(data.price).toBe(1805)
  })

  test('includeIntelligentScore loads LLM score', async () => {
    const options: FusionOptions = { includeIntelligentScore: true }
    const result = await fuseStockData('600519', options)

    const data = result.data!
    expect(data.sentimentScore).toBe(4.5)
    expect(mockIntelligentScoreStore.getLatestBySymbol).toHaveBeenCalledWith('600519')
  })

  test('includeSignals loads and interprets trading signals', async () => {
    const options: FusionOptions = { includeSignals: true }
    const result = await fuseStockData('600519', options)

    const data = result.data!
    expect(data.signalType).toBe('strong_buy')
    expect(data.signalReason).toBe('均线金叉突破')
    expect(mockSignalStore.listBySymbol).toHaveBeenCalledWith('600519')
  })

  test('signal with low confidence → buy (not strong_buy)', async () => {
    mockSignalStore.listBySymbol.mockResolvedValue([
      { ...mockSignals[0], direction: 'buy' as const, confidence: 0.55 },
    ])

    const options: FusionOptions = { includeSignals: true }
    const result = await fuseStockData('600519', options)

    expect(result.data!.signalType).toBe('buy')
  })

  test('hold signal mapped correctly', async () => {
    mockSignalStore.listBySymbol.mockResolvedValue([
      { ...mockSignals[0], direction: 'hold' as const, confidence: 0.5 },
    ])

    const options: FusionOptions = { includeSignals: true }
    const result = await fuseStockData('600519', options)

    expect(result.data!.signalType).toBe('hold')
  })

  test('watch signal mapped correctly', async () => {
    mockSignalStore.listBySymbol.mockResolvedValue([
      { ...mockSignals[0], direction: 'watch' as const, confidence: 0.3 },
    ])

    const options: FusionOptions = { includeSignals: true }
    const result = await fuseStockData('600519', options)

    expect(result.data!.signalType).toBe('watch')
  })

  test('empty kline history → no indicators', async () => {
    mockDailyQuotesStore.get.mockResolvedValue({
      ...mockQuotes,
      history: [],
      latest: null,
    })

    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    expect(result.data!.ma5).toBeNull()
  })

  test('dataSource field encodes completeness', async () => {
    const result = await fuseStockData('600519')

    const ds = result.data!.dataSource
    expect(ds).toContain('fusion:v1')
    expect(ds).toContain('completeness=')
  })
})

// ============================================================
// fuseStockDataBatch 测试
// ============================================================

describe('fuseStockDataBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStockStore.get.mockResolvedValue(mockStock)
    mockDailyQuotesStore.get.mockResolvedValue(mockQuotes)
    mockV6ScoreStore.get.mockResolvedValue(mockV6Score)
    mockIntelligentScoreStore.getLatestBySymbol.mockResolvedValue(mockIntelligentScore)
    mockSignalStore.listBySymbol.mockResolvedValue(mockSignals)
  })

  test('batch fuses multiple symbols', async () => {
    const results = await fuseStockDataBatch(['600519', '600519', '600519'])

    expect(results).toHaveLength(3)
    expect(results[0]!.symbol).toBe('600519')
    expect(results[1]!.symbol).toBe('600519')
  })

  test('single failure does not affect others', async () => {
    mockStockStore.get
      .mockResolvedValueOnce(mockStock)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(mockStock)

    const results = await fuseStockDataBatch(['a', 'b', 'c'])

    expect(results).toHaveLength(2)
    expect(results[0]!.symbol).toBe('600519')
    expect(results[1]!.symbol).toBe('600519')
  })

  test('empty array returns empty', async () => {
    const results = await fuseStockDataBatch([])
    expect(results).toHaveLength(0)
  })

  test('all failures returns empty', async () => {
    mockStockStore.get.mockResolvedValue(undefined)

    const results = await fuseStockDataBatch(['a', 'b'])

    expect(results).toHaveLength(0)
  })
})

// ============================================================
// 技术指标边界测试
// ============================================================

describe('fuseStockData edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStockStore.get.mockResolvedValue(mockStock)
    mockV6ScoreStore.get.mockResolvedValue(mockV6Score)
    mockIntelligentScoreStore.getLatestBySymbol.mockResolvedValue(mockIntelligentScore)
    mockSignalStore.listBySymbol.mockResolvedValue(mockSignals)
  })

  test('insufficient kline data → indicators null', async () => {
    mockDailyQuotesStore.get.mockResolvedValue({
      ...mockQuotes,
      history: mockQuotes.history.slice(0, 3), // only 3 bars
    })

    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    expect(result.data!.ma5).toBeNull()
    expect(result.data!.ma20).toBeNull()
    expect(result.data!.rsi6).toBeNull()
  })

  test('RSI oversold when price drops sharply', async () => {
    // 构造暴跌：前30天平稳，最后几天暴跌
    const dropsBars = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      open: 100 + i * 0.2,
      high: 102 + i * 0.2,
      low: 98 + i * 0.2,
      close: 101 + i * 0.2,
      volume: 1000000,
      amount: 100000000,
    }))
    // 最后7天连续暴跌
    for (let i = 0; i < 7; i++) {
      dropsBars.push({
        date: `2026-07-${String(i + 1).padStart(2, '0')}`,
        open: 100 - i * 5,
        high: 100 - i * 5 + 1,
        low: 100 - i * 5 - 2,
        close: 100 - i * 5 - 1,
        volume: 1000000,
        amount: 100000000,
      })
    }

    mockDailyQuotesStore.get.mockResolvedValue({
      ...mockQuotes,
      history: dropsBars,
      latest: dropsBars[dropsBars.length - 1],
    })

    const result = await fuseStockData('600519')

    expect(result.success).toBe(true)
    expect(result.data!.rsiSignal).toBe('oversold')
  })

  test('V6 score missing → score fields null', async () => {
    mockV6ScoreStore.get.mockResolvedValue(undefined)

    const result = await fuseStockData('600519')

    expect(result.data!.totalScore).toBeNull()
    expect(result.data!.trendScore).toBeNull()
    expect(result.data!.valueScore).toBeNull()
  })
})