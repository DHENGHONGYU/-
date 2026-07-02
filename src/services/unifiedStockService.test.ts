/**
 * unifiedStockService 测试
 *
 * 覆盖：
 * - getUnifiedStockView 基础融合（stock 仅基础数据）
 * - getUnifiedStockView 全量数据源融合
 * - getUnifiedStockView stock 不存在
 * - getUnifiedStockView 部分数据源缺失
 * - getUnifiedStockView 异常处理
 * - getUnifiedStockViews 批量融合
 * - getUnifiedStockViews 批量部分失败
 * - getUnifiedStockViewsByStatus 按状态筛选
 * - getScoreView 评分专用视图
 * - getTradingView 交易专用视图
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getUnifiedStockView,
  getUnifiedStockViews,
  getUnifiedStockViewsByStatus,
  getScoreView,
  getTradingView,
} from './unifiedStockService'
import { dataLayer } from '@/data/dataLayer'
import type {
  Stock,
  DailyQuotes,
  V6Score,
  IntelligentScore,
  IndustryScore,
  RotationSectorScore,
  Signal,
} from '@/data/types'

// ============================================================
// Mock dataLayer
// ============================================================

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: {
      get: vi.fn(),
      list: vi.fn(),
    },
    dailyQuotes: {
      get: vi.fn(),
    },
    v6Scores: {
      get: vi.fn(),
    },
    intelligentScores: {
      getLatestBySymbol: vi.fn(),
    },
    industryScores: {
      listByCode: vi.fn(),
    },
    rotationScores: {
      list: vi.fn(),
    },
    signals: {
      listBySymbol: vi.fn(),
    },
  },
}))

// ============================================================
// Mock 工厂函数
// ============================================================

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    price: 1800,
    pe: 35,
    pb: 12,
    roe: 0.30,
    marketCap: 22000,
    researchStatus: 'watching',
    source: 'manual',
    dataVersion: 1,
    sector: '白酒',
    industryCode: 'SW3401',
    updatedAt: 1700000000000,
    ...overrides,
  }
}

function makeQuotes(overrides: Partial<DailyQuotes> = {}): DailyQuotes {
  return {
    symbol: '600519.SH',
    latest: { date: '2026-06-27', open: 1800, high: 1820, low: 1790, close: 1810, volume: 1000000, amount: 1800000000 },
    history: [
      { date: '2026-06-26', open: 1790, high: 1810, low: 1785, close: 1800, volume: 900000, amount: 1620000000 },
      { date: '2026-06-27', open: 1800, high: 1820, low: 1790, close: 1810, volume: 1000000, amount: 1800000000 },
    ],
    period: 'daily',
    adjust: 'qfq',
    updatedAt: 1700000001000,
    ...overrides,
  }
}

function makeV6Score(overrides: Partial<V6Score> = {}): V6Score {
  return {
    symbol: '600519.SH',
    score: 4.2,
    factors: { valuation: 4.0, growth: 3.5, quality: 4.5, momentum: 4.0 },
    algorithmVersion: 'v6.0',
    calculatedAt: 1700000002000,
    dataVersion: 1,
    ...overrides,
  }
}

function makeIntelligentScore(overrides: Partial<IntelligentScore> = {}): IntelligentScore {
  return {
    id: 1,
    symbol: '600519.SH',
    overallScore: 4.0,
    dimensionScores: [],
    summary: '优质标的',
    basis: '财务稳健',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
    configSnapshot: { model: 'deepseek-v4', baseURL: 'https://api.deepseek.com' },
    modelResponse: '评分结果',
    dataVersion: 1,
    scoredAt: 1700000003000,
    ...overrides,
  }
}

function makeIndustryScore(overrides: Partial<IndustryScore> = {}): IndustryScore {
  return {
    id: 1,
    code: 'SW3401',
    name: '白酒',
    overallScore: 3.8,
    dimensionScores: [],
    summary: '行业景气',
    basis: '消费复苏',
    missingFields: [],
    sectorSnapshot: { composite: 3.8, recommendation: '增持', positionPct: '5%', subTracks: [] },
    configSnapshot: { model: 'deepseek-v4', baseURL: 'https://api.deepseek.com' },
    modelResponse: '行业评分',
    scoredAt: 1700000004000,
    ...overrides,
  }
}

function makeRotationScore(overrides: Partial<RotationSectorScore> = {}): RotationSectorScore {
  return {
    id: 'SW3401__2026-06-27',
    sectorCode: 'SW3401',
    sectorName: '白酒',
    scoreDate: '2026-06-27',
    f1Jingqi: 3.5,
    f2Zijin: 4.0,
    f3Guzhi: 3.0,
    f4Beta: 2.5,
    f5Nengliang: 3.5,
    total: 70,
    resonance: 6,
    signal: '关注',
    alertLevel: 'normal',
    declineType: 'none',
    poolStocks: [],
    modelUsed: 'v6',
    createdAt: '2026-06-27T00:00:00Z',
    ...overrides,
  }
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-001',
    symbol: '600519.SH',
    direction: 'buy',
    type: 'hot_sector',
    confidence: 0.85,
    rationale: '动量突破',
    snapshot: {
      pePercentile: 0.5,
    },
    createdAt: 1700000005000,
    strategy: 'hot-sector',
    ...overrides,
  }
}

// ============================================================
// getUnifiedStockView 测试
// ============================================================

describe('getUnifiedStockView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('stock 不存在时返回失败', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(undefined)

    const result = await getUnifiedStockView('000001.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('000001.SZ')
  })

  test('默认选项仅加载 stock + quotes + v6Score', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(makeQuotes())
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(makeV6Score())

    const result = await getUnifiedStockView('600519.SH')

    expect(result.success).toBe(true)
    expect(result.data!.stock.symbol).toBe('600519.SH')
    expect(result.data!.quotes).toBeDefined()
    expect(result.data!.v6Score).toBeDefined()
    // 默认不加载的源应为 undefined
    expect(result.data!.intelligentScore).toBeUndefined()
    expect(result.data!.industryScore).toBeUndefined()
    expect(result.data!.rotationScore).toBeUndefined()
    expect(result.data!.signal).toBeUndefined()
    expect(result.data!.holding).toBeUndefined()
  })

  test('quotes 缺失时记录到 missing 列表', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(undefined)
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(makeV6Score())

    const result = await getUnifiedStockView('600519.SH')

    expect(result.success).toBe(true)
    expect(result.data!.quotes).toBeUndefined()
    expect(result.data!.quality.missing).toContain('quotes')
  })

  test('v6Score 缺失时记录到 missing 列表', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(makeQuotes())
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(undefined)

    const result = await getUnifiedStockView('600519.SH')

    expect(result.success).toBe(true)
    expect(result.data!.v6Score).toBeUndefined()
    expect(result.data!.quality.missing).toContain('v6Score')
  })

  test('全量数据源融合（开启所有选项）', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(makeQuotes())
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(makeV6Score())
    vi.mocked(dataLayer.intelligentScores.getLatestBySymbol).mockResolvedValue(makeIntelligentScore())
    vi.mocked(dataLayer.industryScores.listByCode).mockResolvedValue([makeIndustryScore()])
    vi.mocked(dataLayer.rotationScores.list).mockResolvedValue([makeRotationScore()])
    vi.mocked(dataLayer.signals.listBySymbol).mockResolvedValue([makeSignal()])

    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: true,
      includeV6Score: true,
      includeIntelligentScore: true,
      includeIndustryScore: true,
      includeRotationScore: true,
      includeSignal: true,
      includeHolding: true,
    })

    expect(result.success).toBe(true)
    const view = result.data!
    expect(view.stock.symbol).toBe('600519.SH')
    expect(view.quotes).toBeDefined()
    expect(view.v6Score).toBeDefined()
    expect(view.intelligentScore).toBeDefined()
    expect(view.industryScore).toBeDefined()
    expect(view.rotationScore).toBeDefined()
    expect(view.signal).toBeDefined()
    // holding 暂未实现，应在 missing 中
    expect(view.holding).toBeUndefined()
    expect(view.quality.missing).toContain('holding')
  })

  test('intelligentScore 缺失时记录到 missing', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.intelligentScores.getLatestBySymbol).mockResolvedValue(undefined)

    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: false,
      includeV6Score: false,
      includeIntelligentScore: true,
    })

    expect(result.success).toBe(true)
    expect(result.data!.quality.missing).toContain('intelligentScore')
  })

  test('industryScore 缺失时记录到 missing', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.industryScores.listByCode).mockResolvedValue([])

    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: false,
      includeV6Score: false,
      includeIndustryScore: true,
    })

    expect(result.success).toBe(true)
    expect(result.data!.quality.missing).toContain('industryScore')
  })

  test('rotationScore 未匹配到时记录到 missing', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock({ sector: '白酒' }))
    vi.mocked(dataLayer.rotationScores.list).mockResolvedValue([
      makeRotationScore({ sectorCode: 'SW3402' }),
    ])

    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: false,
      includeV6Score: false,
      includeRotationScore: true,
    })

    expect(result.success).toBe(true)
    expect(result.data!.quality.missing).toContain('rotationScore')
  })

  test('signal 缺失时记录到 missing', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.signals.listBySymbol).mockResolvedValue([])

    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: false,
      includeV6Score: false,
      includeSignal: true,
    })

    expect(result.success).toBe(true)
    expect(result.data!.quality.missing).toContain('signal')
  })

  test('completeness 计算正确', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    // 仅激活 3 个数据源：quotes + v6Score + intelligentScore
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(makeQuotes())       // 成功
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(undefined)            // 缺失
    vi.mocked(dataLayer.intelligentScores.getLatestBySymbol).mockResolvedValue(makeIntelligentScore()) // 成功

    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: true,
      includeV6Score: true,
      includeIntelligentScore: true,
      includeIndustryScore: false,
      includeRotationScore: false,
      includeSignal: false,
      includeHolding: false,
    })

    expect(result.success).toBe(true)
    // 3 个源中 1 个缺失 → completeness = (3-1)/3 * 100 ≈ 66.67
    expect(result.data!.quality.completeness).toBeCloseTo(66.67, 0)
    expect(result.data!.quality.missing).toEqual(['v6Score'])
  })

  test('freshness 取所有源中最新的时间戳', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock({ updatedAt: 1000 }))
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(makeQuotes({ updatedAt: 3000 }))
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(makeV6Score({ calculatedAt: 2000 }))

    const result = await getUnifiedStockView('600519.SH')

    expect(result.success).toBe(true)
    expect(result.data!.quality.freshness).toBe(3000)
  })

  test('dataLayer 抛出异常时返回失败', async () => {
    vi.mocked(dataLayer.stocks.get).mockRejectedValue(new Error('DB 连接失败'))

    const result = await getUnifiedStockView('600519.SH')

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB 连接失败')
  })

  test('fusedAt 是有效时间戳', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())

    const before = Date.now()
    const result = await getUnifiedStockView('600519.SH', {
      includeQuotes: false,
      includeV6Score: false,
    })
    const after = Date.now()

    expect(result.success).toBe(true)
    expect(result.data!.fusedAt).toBeGreaterThanOrEqual(before)
    expect(result.data!.fusedAt).toBeLessThanOrEqual(after)
  })
})

// ============================================================
// getUnifiedStockViews 批量测试
// ============================================================

describe('getUnifiedStockViews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('批量融合多只股票', async () => {
    vi.mocked(dataLayer.stocks.get)
      .mockResolvedValueOnce(makeStock({ symbol: '600519.SH', name: '茅台' }))
      .mockResolvedValueOnce(makeStock({ symbol: '000858.SZ', name: '五粮液' }))
      .mockResolvedValueOnce(makeStock({ symbol: '002304.SZ', name: '洋河' }))

    const result = await getUnifiedStockViews(
      ['600519.SH', '000858.SZ', '002304.SZ'],
      { includeQuotes: false, includeV6Score: false },
    )

    expect(result.success).toBe(true)
    expect(result.data!).toHaveLength(3)
    expect(result.data![0]!.stock.symbol).toBe('600519.SH')
    expect(result.data![1]!.stock.symbol).toBe('000858.SZ')
    expect(result.data![2]!.stock.symbol).toBe('002304.SZ')
  })

  test('批量融合部分失败时返回失败详情', async () => {
    vi.mocked(dataLayer.stocks.get)
      .mockResolvedValueOnce(makeStock({ symbol: '600519.SH' }))
      .mockResolvedValueOnce(undefined) // 第二只失败
      .mockResolvedValueOnce(makeStock({ symbol: '002304.SZ' }))

    const result = await getUnifiedStockViews(
      ['600519.SH', '000858.SZ', '002304.SZ'],
      { includeQuotes: false, includeV6Score: false },
    )

    expect(result.success).toBe(false)
    expect(result.failedCount).toBe(1)
    expect(result.failedSymbols).toContainEqual(expect.objectContaining({ symbol: '000858.SZ' }))
  })

  test('空列表返回成功', async () => {
    const result = await getUnifiedStockViews([], { includeQuotes: false, includeV6Score: false })

    expect(result.success).toBe(true)
    expect(result.data!).toHaveLength(0)
  })
})

// ============================================================
// getUnifiedStockViewsByStatus 测试
// ============================================================

describe('getUnifiedStockViewsByStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('按 researchStatus 筛选股票', async () => {
    vi.mocked(dataLayer.stocks.list).mockResolvedValue([
      makeStock({ symbol: '600519.SH', researchStatus: 'watching' }),
      makeStock({ symbol: '000858.SZ', researchStatus: 'watching' }),
      makeStock({ symbol: '002304.SZ', researchStatus: 'candidate' }),
    ])
    vi.mocked(dataLayer.stocks.get)
      .mockResolvedValueOnce(makeStock({ symbol: '600519.SH', researchStatus: 'watching' }))
      .mockResolvedValueOnce(makeStock({ symbol: '000858.SZ', researchStatus: 'watching' }))

    const result = await getUnifiedStockViewsByStatus('watching', {
      includeQuotes: false,
      includeV6Score: false,
    })

    expect(result.success).toBe(true)
    expect(result.data!).toHaveLength(2)
    expect(result.data![0]!.stock.symbol).toBe('600519.SH')
    expect(result.data![1]!.stock.symbol).toBe('000858.SZ')
  })

  test('无匹配状态时返回空数组', async () => {
    vi.mocked(dataLayer.stocks.list).mockResolvedValue([
      makeStock({ symbol: '600519.SH', researchStatus: 'watching' }),
    ])

    const result = await getUnifiedStockViewsByStatus('archived', {
      includeQuotes: false,
      includeV6Score: false,
    })

    expect(result.success).toBe(true)
    expect(result.data!).toHaveLength(0)
  })
})

// ============================================================
// getScoreView 测试
// ============================================================

describe('getScoreView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('返回评分专用视图（仅评分相关字段）', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(makeV6Score())
    vi.mocked(dataLayer.intelligentScores.getLatestBySymbol).mockResolvedValue(makeIntelligentScore())
    vi.mocked(dataLayer.industryScores.listByCode).mockResolvedValue([makeIndustryScore()])

    const result = await getScoreView('600519.SH')

    expect(result.success).toBe(true)
    const view = result.data!
    expect(view.stock).toBeDefined()
    expect(view.v6Score).toBeDefined()
    expect(view.intelligentScore).toBeDefined()
    expect(view.industryScore).toBeDefined()
    expect(view.completeness).toBeGreaterThan(0)
    // 确保不包含非评分字段
    expect(view).not.toHaveProperty('quotes')
    expect(view).not.toHaveProperty('signal')
    expect(view).not.toHaveProperty('holding')
  })

  test('stock 不存在时返回失败', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(undefined)

    const result = await getScoreView('000001.SZ')

    expect(result.success).toBe(false)
  })
})

// ============================================================
// getTradingView 测试
// ============================================================

describe('getTradingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('返回交易专用视图（仅交易相关字段）', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(makeStock())
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(makeQuotes())
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(makeV6Score())
    vi.mocked(dataLayer.signals.listBySymbol).mockResolvedValue([makeSignal()])

    const result = await getTradingView('600519.SH')

    expect(result.success).toBe(true)
    const view = result.data!
    expect(view.stock).toBeDefined()
    expect(view.quotes).toBeDefined()
    expect(view.v6Score).toBeDefined()
    expect(view.signal).toBeDefined()
    expect(view.completeness).toBeGreaterThan(0)
    // holding 暂未实现，应为 undefined
    expect(view.holding).toBeUndefined()
    // 确保不包含非交易字段
    expect(view).not.toHaveProperty('intelligentScore')
    expect(view).not.toHaveProperty('industryScore')
  })

  test('stock 不存在时返回失败', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(undefined)

    const result = await getTradingView('000001.SZ')

    expect(result.success).toBe(false)
  })
})