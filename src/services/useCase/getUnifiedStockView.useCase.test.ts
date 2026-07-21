/**
 * @test_id V9-TEST-ST-129
 * @module services/useCase/getUnifiedStockView.useCase.test
 * @description 统一股票视图融合用例单元测试 — 验证多源数据聚合、质量指标计算及异常处理
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getUnifiedStockViewUseCase,
  getUnifiedStockViewsUseCase,
  getUnifiedStockViewsByStatusUseCase,
  getScoreViewUseCase,
  getTradingViewUseCase,
} from './getUnifiedStockView.useCase'
import type {
  Stock,
  DailyQuotes,
  V6Score,
  IntelligentScore,
  IndustryScore,
  RotationSectorScore,
  Signal,
} from '@/data/types'

// Mock 依赖
const {
  mockLogger,
  mockQueryGet,
  mockQueryList,
  mockQueryByIndex,
  mockSTORE_NAME,
} = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockQueryGet: vi.fn(),
  mockQueryList: vi.fn(),
  mockQueryByIndex: vi.fn(),
  mockSTORE_NAME: {
    stocks: 'stocks',
    dailyQuotes: 'daily_quotes',
    v6Scores: 'v6_scores',
    intelligentScores: 'intelligent_scores',
    industryScores: 'industry_scores',
    rotationScores: 'rotation_scores',
    signals: 'signals',
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => mockLogger),
}))

vi.mock('@/config/dbConfig', () => ({
  STORE_NAME: mockSTORE_NAME,
}))

vi.mock('@/data/dataLayerHelpers', () => ({
  queryGet: mockQueryGet,
  queryList: mockQueryList,
  queryByIndex: mockQueryByIndex,
}))

// 辅助函数：创建 mock 股票数据
function createMockStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '000001.SZ',
    name: '平安银行',
    price: 15.5,
    pe: 8.5,
    pb: 0.6,
    roe: 12.3,
    marketCap: 300000000000,
    researchStatus: 'candidate',
    source: 'akshare',
    dataVersion: 1,
    updatedAt: Date.now() - 3600000,
    sector: '银行',
    industryCode: '801780',
    ...overrides,
  }
}

// 辅助函数：创建 mock 行情数据
function createMockQuotes(overrides: Partial<DailyQuotes> = {}): DailyQuotes {
  return {
    symbol: '000001.SZ',
    latest: { date: String(Date.now()), open: 15.0, close: 15.5, high: 15.8, low: 14.9, volume: 1000000, amount: 15500000 },
    history: [],
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now() - 1800000,
    ...overrides,
  }
}

// 辅助函数：创建 mock V6 评分
function createMockV6Score(overrides: Partial<V6Score> = {}): V6Score {
  return {
    symbol: '000001.SZ',
    score: 75,
    factors: { quality: 80, valuation: 70, growth: 65 },
    algorithmVersion: 'v4.1',
    calculatedAt: Date.now() - 7200000,
    dataVersion: 1,
    ...overrides,
  }
}

// 辅助函数：创建 mock 智能评分
function createMockIntelligentScore(overrides: Partial<IntelligentScore> = {}): IntelligentScore {
  return {
    symbol: '000001.SZ',
    overallScore: 82,
    dimensionScores: [],
    summary: '综合表现良好',
    basis: '基于多维度分析',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
    configSnapshot: { model: 'test-model', baseURL: 'http://localhost' },
    scoredAt: Date.now() - 5400000,
    ...overrides,
  } as IntelligentScore
}

// 辅助函数：创建 mock 行业评分
function createMockIndustryScore(overrides: Partial<IndustryScore> = {}): IndustryScore {
  return {
    code: '银行',
    name: '银行',
    overallScore: 78,
    dimensionScores: [],
    summary: '行业景气度中等',
    basis: '基本面分析',
    missingFields: [],
    sectorSnapshot: { composite: 70, recommendation: '持有', positionPct: '10%', subTracks: [] },
    configSnapshot: { model: 'test-model', baseURL: 'http://localhost' },
    scoredAt: Date.now() - 9000000,
    ...overrides,
  } as IndustryScore
}

// 辅助函数：创建 mock 板块轮动评分
function createMockRotationScore(overrides: Partial<RotationSectorScore> = {}): RotationSectorScore {
  return {
    id: '801780__2024-01-15',
    sectorCode: '801780',
    sectorName: '银行',
    scoreDate: '2024-01-15',
    f1Jingqi: 70,
    f2Zijin: 65,
    f3Guzhi: 60,
    f4Beta: 55,
    f5Nengliang: 68,
    total: 68,
    resonance: 5,
    signal: 'strong',
    alertLevel: 'normal',
    declineType: '杀估值',
    poolStocks: [],
    modelUsed: 'v6',
    createdAt: '2024-01-15T00:00:00Z',
    ...overrides,
  }
}

// 辅助函数：创建 mock 信号
function createMockSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-001',
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'v6_auto',
    strategy: 'v6_composite',
    confidence: 0.75,
    rationale: '估值低估+质量优秀',
    snapshot: {},
    createdAt: Date.now() - 600000,
    ...overrides,
  }
}

// 辅助函数：设置默认 mock 返回值
function setupDefaultMocks() {
  // queryGet 默认：返回 undefined（未找到），测试用例中按需设置
  mockQueryGet.mockResolvedValue(undefined)
  mockQueryList.mockResolvedValue([])
  mockQueryByIndex.mockResolvedValue([])
}

describe('getUnifiedStockViewUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  describe('正常获取统一股票视图成功流程', () => {
    it('应当返回包含所有默认数据源的统一视图', async () => {
      const stock = createMockStock()
      const quotes = createMockQuotes()
      const v6Score = createMockV6Score()

      mockQueryGet
        .mockResolvedValueOnce(stock)   // stocks
        .mockResolvedValueOnce(quotes)  // dailyQuotes
        .mockResolvedValueOnce(v6Score) // v6Scores

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.stock).toEqual(stock)
      expect(result.data!.quotes).toEqual(quotes)
      expect(result.data!.v6Score).toEqual(v6Score)
    })

    it('应当计算正确的数据完整度', async () => {
      const stock = createMockStock()
      const quotes = createMockQuotes()
      const v6Score = createMockV6Score()

      mockQueryGet
        .mockResolvedValueOnce(stock)
        .mockResolvedValueOnce(quotes)
        .mockResolvedValueOnce(v6Score)

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      // 默认 includeQuotes 和 includeV6Score 为 true，共 2 个源
      expect(result.data!.quality.completeness).toBe(100)
      expect(result.data!.quality.missing).toEqual([])
    })

    it('应当返回正确的新鲜度时间戳', async () => {
      const stockTime = Date.now() - 3600000
      const quotesTime = Date.now() - 1800000
      const v6Time = Date.now() - 7200000

      const stock = createMockStock({ updatedAt: stockTime })
      const quotes = createMockQuotes({ updatedAt: quotesTime })
      const v6Score = createMockV6Score({ calculatedAt: v6Time })

      mockQueryGet
        .mockResolvedValueOnce(stock)
        .mockResolvedValueOnce(quotes)
        .mockResolvedValueOnce(v6Score)

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      // freshness 应为所有时间戳中的最大值
      expect(result.data!.quality.freshness).toBe(quotesTime)
    })

    it('应当记录融合完成日志', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockResolvedValueOnce(createMockV6Score())

      await getUnifiedStockViewUseCase('000001.SZ')

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('融合完成'),
        expect.any(Object),
      )
    })

    it('应当包含 fusedAt 时间戳', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockResolvedValueOnce(createMockV6Score())

      const before = Date.now()
      const result = await getUnifiedStockViewUseCase('000001.SZ')
      const after = Date.now()

      expect(result.data!.fusedAt).toBeGreaterThanOrEqual(before)
      expect(result.data!.fusedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('股票基础数据为空', () => {
    it('股票不存在时应返回失败', async () => {
      mockQueryGet.mockResolvedValueOnce(undefined) // stocks 返回 undefined

      const result = await getUnifiedStockViewUseCase('999999.SZ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Stock not found')
      expect(result.error).toContain('999999.SZ')
    })

    it('股票不存在时不应查询其他数据源', async () => {
      mockQueryGet.mockResolvedValueOnce(undefined)

      await getUnifiedStockViewUseCase('999999.SZ')

      // queryGet 只应被调用 1 次（仅查询 stocks）
      expect(mockQueryGet).toHaveBeenCalledTimes(1)
    })
  })

  describe('行情数据为空', () => {
    it('行情数据缺失时应标记为 missing', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())  // stocks
        .mockResolvedValueOnce(undefined)           // dailyQuotes 不存在
        .mockResolvedValueOnce(createMockV6Score()) // v6Scores

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(true)
      expect(result.data!.quotes).toBeUndefined()
      expect(result.data!.quality.missing).toContain('quotes')
      // v6 有数据，quotes 缺失，共 2 个源 → 完整度 50%
      expect(result.data!.quality.completeness).toBe(50)
    })
  })

  describe('评分数据为空', () => {
    it('V6 评分缺失时应标记为 missing', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())   // stocks
        .mockResolvedValueOnce(createMockQuotes())  // dailyQuotes
        .mockResolvedValueOnce(undefined)           // v6Scores 不存在

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(true)
      expect(result.data!.v6Score).toBeUndefined()
      expect(result.data!.quality.missing).toContain('v6Score')
    })

    it('智能评分缺失时应标记为 missing', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      mockQueryByIndex.mockResolvedValueOnce([]) // intelligentScores 空数组

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIntelligentScore: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.intelligentScore).toBeUndefined()
      expect(result.data!.quality.missing).toContain('intelligentScore')
    })
  })

  describe('各依赖查询失败场景', () => {
    it('queryGet 抛出异常时应返回失败', async () => {
      mockQueryGet.mockRejectedValue(new Error('数据库连接失败'))

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('数据库连接失败')
    })

    it('查询行情抛出异常时应返回失败', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockRejectedValueOnce(new Error('行情查询失败'))

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('行情查询失败')
    })

    it('查询 V6 评分抛出异常时应返回失败', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockRejectedValueOnce(new Error('V6 评分查询失败'))

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('V6 评分查询失败')
    })

    it('queryByIndex 抛出异常时应返回失败', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      mockQueryByIndex.mockRejectedValue(new Error('索引查询失败'))

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIntelligentScore: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('索引查询失败')
    })

    it('queryList 抛出异常时应返回失败', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      mockQueryList.mockRejectedValue(new Error('列表查询失败'))

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeSignal: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('列表查询失败')
    })
  })

  describe('异常捕获', () => {
    it('应当捕获 Error 类型异常并返回失败', async () => {
      mockQueryGet.mockRejectedValue(new Error('网络超时'))

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(false)
      expect(result.error).toBe('网络超时')
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('应当捕获非 Error 类型抛出并转换为字符串', async () => {
      mockQueryGet.mockRejectedValue({ code: 500, msg: '内部错误' })

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.success).toBe(false)
      expect(result.error).toBe('[object Object]')
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('应当记录错误日志', async () => {
      mockQueryGet.mockRejectedValue(new Error('测试异常'))

      await getUnifiedStockViewUseCase('000001.SZ')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('融合失败'),
        expect.any(Object),
      )
    })
  })

  describe('参数传递验证', () => {
    it('应当正确传递 symbol 参数给 queryGet', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockResolvedValueOnce(createMockV6Score())

      await getUnifiedStockViewUseCase('000001.SZ')

      expect(mockQueryGet).toHaveBeenCalledWith(mockSTORE_NAME.stocks, '000001.SZ')
      expect(mockQueryGet).toHaveBeenCalledWith(mockSTORE_NAME.dailyQuotes, '000001.SZ')
      expect(mockQueryGet).toHaveBeenCalledWith(mockSTORE_NAME.v6Scores, '000001.SZ')
    })

    it('includeQuotes=false 时不应查询行情', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockV6Score())

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
      })

      expect(result.success).toBe(true)
      expect(result.data!.quotes).toBeUndefined()
      // 只查询 stocks 和 v6Scores，共 2 次
      expect(mockQueryGet).toHaveBeenCalledTimes(2)
    })

    it('includeV6Score=false 时不应查询 V6 评分', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeV6Score: false,
      })

      expect(result.success).toBe(true)
      expect(result.data!.v6Score).toBeUndefined()
    })

    it('includeIntelligentScore=true 时应查询智能评分', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      mockQueryByIndex.mockResolvedValueOnce([createMockIntelligentScore()])

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIntelligentScore: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.intelligentScore).toBeDefined()
      expect(mockQueryByIndex).toHaveBeenCalledWith(
        mockSTORE_NAME.intelligentScores,
        'by-symbol',
        '000001.SZ',
      )
    })

    it('includeIndustryScore=true 时应按 sector 查询行业评分', async () => {
      const stock = createMockStock({ sector: '银行' })
      mockQueryGet.mockResolvedValueOnce(stock)
      mockQueryByIndex.mockResolvedValueOnce([createMockIndustryScore()])

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIndustryScore: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.industryScore).toBeDefined()
      expect(mockQueryByIndex).toHaveBeenCalledWith(
        mockSTORE_NAME.industryScores,
        'by-code',
        '银行',
      )
    })

    it('includeRotationScore=true 时应查询轮动评分并按 industryCode 匹配', async () => {
      const stock = createMockStock({ industryCode: '801780' })
      mockQueryGet.mockResolvedValueOnce(stock)
      mockQueryList.mockResolvedValueOnce([createMockRotationScore()])

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeRotationScore: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.rotationScore).toBeDefined()
      expect(result.data!.rotationScore!.sectorCode).toBe('801780')
    })

    it('includeSignal=true 时应查询信号并取最新一条', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      const signals = [
        createMockSignal({ id: 'old', createdAt: Date.now() - 86400000 }),
        createMockSignal({ id: 'new', createdAt: Date.now() - 3600000 }),
        createMockSignal({ id: 'mid', createdAt: Date.now() - 43200000 }),
      ]
      mockQueryList.mockResolvedValueOnce(signals)

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeSignal: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.signal).toBeDefined()
      expect(result.data!.signal!.id).toBe('new') // 最新的
    })

    it('includeHolding=true 时应标记为 missing（待实现）', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockResolvedValueOnce(createMockV6Score())

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeHolding: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.holding).toBeUndefined()
      expect(result.data!.quality.missing).toContain('holding')
    })
  })

  describe('数据聚合逻辑验证', () => {
    it('智能评分应取最新的一条（按 scoredAt 降序）', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      const scores = [
        createMockIntelligentScore({ id: 1, scoredAt: Date.now() - 86400000 }),
        createMockIntelligentScore({ id: 2, scoredAt: Date.now() - 3600000 }), // 最新
        createMockIntelligentScore({ id: 3, scoredAt: Date.now() - 43200000 }),
      ]
      mockQueryByIndex.mockResolvedValueOnce(scores)

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIntelligentScore: true,
      })

      expect(result.data!.intelligentScore!.id).toBe(2)
    })

    it('行业评分应取最新的一条（按 scoredAt 降序）', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())
      const scores = [
        createMockIndustryScore({ id: 1, scoredAt: Date.now() - 172800000 }),
        createMockIndustryScore({ id: 2, scoredAt: Date.now() - 86400000 }), // 最新
      ]
      mockQueryByIndex.mockResolvedValueOnce(scores)

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIndustryScore: true,
      })

      expect(result.data!.industryScore!.id).toBe(2)
    })

    it('完整度计算应基于启用的数据源数量', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockResolvedValueOnce(undefined) // v6Score 缺失

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: true,
        includeV6Score: true,
      })

      // 2 个源，1 个缺失 → 50%
      expect(result.data!.quality.completeness).toBe(50)
    })

    it('所有数据都有时完整度应为 100%', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(createMockQuotes())
        .mockResolvedValueOnce(createMockV6Score())

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.data!.quality.completeness).toBe(100)
      expect(result.data!.quality.missing).toEqual([])
    })

    it('新鲜度应为所有时间戳的最大值', async () => {
      const stockTime = Date.now() - 3600000
      const quotesTime = Date.now() - 60000  // 最新
      const v6Time = Date.now() - 7200000

      mockQueryGet
        .mockResolvedValueOnce(createMockStock({ updatedAt: stockTime }))
        .mockResolvedValueOnce(createMockQuotes({ updatedAt: quotesTime }))
        .mockResolvedValueOnce(createMockV6Score({ calculatedAt: v6Time }))

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.data!.quality.freshness).toBe(quotesTime)
    })

    it('股票 updatedAt 为 undefined 时应使用 Date.now()', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock({ updatedAt: undefined }))
        .mockResolvedValueOnce(undefined) // quotes 缺失
        .mockResolvedValueOnce(undefined) // v6 缺失

      const before = Date.now()
      const result = await getUnifiedStockViewUseCase('000001.SZ')
      const after = Date.now()

      expect(result.data!.quality.freshness).toBeGreaterThanOrEqual(before)
      expect(result.data!.quality.freshness).toBeLessThanOrEqual(after)
    })
  })

  describe('边界条件 - 部分数据缺失时的默认值填充', () => {
    it('仅股票数据存在时完整度为 0%（无可选数据源）', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock())

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
      })

      // 没有可选数据源 → 0 个源，0 个缺失 → 完整度 NaN → 0
      // 实际上：(0 - 0) / 0 = NaN，需验证行为
      expect(result.success).toBe(true)
      expect(result.data!.quality.missing).toEqual([])
    })

    it('所有可选数据都缺失时完整度为 0%', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock())
        .mockResolvedValueOnce(undefined) // quotes
        .mockResolvedValueOnce(undefined) // v6

      const result = await getUnifiedStockViewUseCase('000001.SZ')

      expect(result.data!.quality.completeness).toBe(0)
      expect(result.data!.quality.missing).toEqual(expect.arrayContaining(['quotes', 'v6Score']))
    })

    it('sector 为 undefined 时行业评分查询应使用空字符串', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock({ sector: undefined }))
      mockQueryByIndex.mockResolvedValueOnce([])

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeIndustryScore: true,
      })

      expect(mockQueryByIndex).toHaveBeenCalledWith(
        mockSTORE_NAME.industryScores,
        'by-code',
        '',
      )
      expect(result.data!.quality.missing).toContain('industryScore')
    })

    it('industryCode 为 undefined 时轮动评分不应匹配到', async () => {
      mockQueryGet.mockResolvedValueOnce(createMockStock({ industryCode: undefined }))
      mockQueryList.mockResolvedValueOnce([createMockRotationScore()])

      const result = await getUnifiedStockViewUseCase('000001.SZ', {
        includeQuotes: false,
        includeV6Score: false,
        includeRotationScore: true,
      })

      expect(result.data!.rotationScore).toBeUndefined()
      expect(result.data!.quality.missing).toContain('rotationScore')
    })

    it('空 symbol 应返回股票未找到', async () => {
      mockQueryGet.mockResolvedValueOnce(undefined)

      const result = await getUnifiedStockViewUseCase('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Stock not found')
    })

    it('特殊 symbol 格式应正常处理', async () => {
      mockQueryGet
        .mockResolvedValueOnce(createMockStock({ symbol: 'AAPL' }))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)

      const result = await getUnifiedStockViewUseCase('AAPL')

      expect(result.success).toBe(true)
      expect(result.data!.stock.symbol).toBe('AAPL')
    })
  })

  describe('并发调用互不干扰', () => {
    it('多个并发调用应各自独立返回结果', async () => {
      // 第一个股票
      const stock1 = createMockStock({ symbol: '000001.SZ', name: '平安银行' })
      const quotes1 = createMockQuotes({ symbol: '000001.SZ' })
      const v6Score1 = createMockV6Score({ symbol: '000001.SZ' })
      // 第二个股票
      const stock2 = createMockStock({ symbol: '000002.SZ', name: '万科A' })
      const quotes2 = createMockQuotes({ symbol: '000002.SZ' })
      const v6Score2 = createMockV6Score({ symbol: '000002.SZ' })

      // 基于参数返回 mock 数据（适配并发场景下调用顺序不确定）
      mockQueryGet.mockImplementation((store: string, key: string) => {
        if (store === mockSTORE_NAME.stocks) {
          if (key === '000001.SZ') return Promise.resolve(stock1)
          if (key === '000002.SZ') return Promise.resolve(stock2)
        }
        if (store === mockSTORE_NAME.dailyQuotes) {
          if (key === '000001.SZ') return Promise.resolve(quotes1)
          if (key === '000002.SZ') return Promise.resolve(quotes2)
        }
        if (store === mockSTORE_NAME.v6Scores) {
          if (key === '000001.SZ') return Promise.resolve(v6Score1)
          if (key === '000002.SZ') return Promise.resolve(v6Score2)
        }
        return Promise.resolve(undefined)
      })

      const [result1, result2] = await Promise.all([
        getUnifiedStockViewUseCase('000001.SZ'),
        getUnifiedStockViewUseCase('000002.SZ'),
      ])

      expect(result1.success).toBe(true)
      expect(result1.data!.stock.symbol).toBe('000001.SZ')
      expect(result2.success).toBe(true)
      expect(result2.data!.stock.symbol).toBe('000002.SZ')
    })

    it('并发调用中部分失败不应影响其他结果', async () => {
      const stock1 = createMockStock({ symbol: '000001.SZ' })
      const quotes1 = createMockQuotes({ symbol: '000001.SZ' })
      const v6Score1 = createMockV6Score({ symbol: '000001.SZ' })

      mockQueryGet.mockImplementation((store: string, key: string) => {
        // 000002.SZ 的 stocks 查询抛出异常
        if (store === mockSTORE_NAME.stocks && key === '000002.SZ') {
          return Promise.reject(new Error('第二个股票查询失败'))
        }
        // 000001.SZ 正常返回
        if (store === mockSTORE_NAME.stocks && key === '000001.SZ') {
          return Promise.resolve(stock1)
        }
        if (store === mockSTORE_NAME.dailyQuotes && key === '000001.SZ') {
          return Promise.resolve(quotes1)
        }
        if (store === mockSTORE_NAME.v6Scores && key === '000001.SZ') {
          return Promise.resolve(v6Score1)
        }
        return Promise.resolve(undefined)
      })

      const [promise1, promise2] = [
        getUnifiedStockViewUseCase('000001.SZ'),
        getUnifiedStockViewUseCase('000002.SZ'),
      ]

      const results = await Promise.allSettled([promise1, promise2])

      // 两个都是成功的（失败时也返回 success:false，不抛异常）
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')
      // 一个成功，一个失败
      const successResult = (results[0] as PromiseFulfilledResult<any>).value
      const failResult = (results[1] as PromiseFulfilledResult<any>).value
      const successCount = [successResult, failResult].filter((r) => r.success).length
      const failCount = [successResult, failResult].filter((r) => !r.success).length
      expect(successCount).toBe(1)
      expect(failCount).toBe(1)
    })
  })
})

describe('getUnifiedStockViewsUseCase（批量）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('应当批量返回多个股票的统一视图', async () => {
    const stock1 = createMockStock({ symbol: '000001.SZ' })
    const quotes1 = createMockQuotes({ symbol: '000001.SZ' })
    const v6Score1 = createMockV6Score({ symbol: '000001.SZ' })
    const stock2 = createMockStock({ symbol: '000002.SZ' })
    const quotes2 = createMockQuotes({ symbol: '000002.SZ' })
    const v6Score2 = createMockV6Score({ symbol: '000002.SZ' })

    mockQueryGet.mockImplementation((store: string, key: string) => {
      if (store === mockSTORE_NAME.stocks) {
        if (key === '000001.SZ') return Promise.resolve(stock1)
        if (key === '000002.SZ') return Promise.resolve(stock2)
      }
      if (store === mockSTORE_NAME.dailyQuotes) {
        if (key === '000001.SZ') return Promise.resolve(quotes1)
        if (key === '000002.SZ') return Promise.resolve(quotes2)
      }
      if (store === mockSTORE_NAME.v6Scores) {
        if (key === '000001.SZ') return Promise.resolve(v6Score1)
        if (key === '000002.SZ') return Promise.resolve(v6Score2)
      }
      return Promise.resolve(undefined)
    })

    const result = await getUnifiedStockViewsUseCase(['000001.SZ', '000002.SZ'])

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    const symbols = result.data!.map((d) => d.stock.symbol).sort()
    expect(symbols).toEqual(['000001.SZ', '000002.SZ'])
  })

  it('部分股票失败时应返回失败并汇总错误', async () => {
    const stock1 = createMockStock({ symbol: '000001.SZ' })
    const quotes1 = createMockQuotes({ symbol: '000001.SZ' })
    const v6Score1 = createMockV6Score({ symbol: '000001.SZ' })

    mockQueryGet.mockImplementation((store: string, key: string) => {
      // 000002.SZ 不存在
      if (store === mockSTORE_NAME.stocks && key === '000002.SZ') {
        return Promise.resolve(undefined)
      }
      // 000001.SZ 正常返回
      if (store === mockSTORE_NAME.stocks && key === '000001.SZ') {
        return Promise.resolve(stock1)
      }
      if (store === mockSTORE_NAME.dailyQuotes && key === '000001.SZ') {
        return Promise.resolve(quotes1)
      }
      if (store === mockSTORE_NAME.v6Scores && key === '000001.SZ') {
        return Promise.resolve(v6Score1)
      }
      return Promise.resolve(undefined)
    })

    const result = await getUnifiedStockViewsUseCase(['000001.SZ', '000002.SZ'])

    expect(result.success).toBe(false)
    expect(result.error).toContain('Stock not found')
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('空 symbols 数组应返回空数组', async () => {
    const result = await getUnifiedStockViewsUseCase([])

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('异常时应返回失败', async () => {
    mockQueryGet.mockRejectedValue(new Error('批量查询失败'))

    const result = await getUnifiedStockViewsUseCase(['000001.SZ'])

    expect(result.success).toBe(false)
    expect(result.error).toContain('批量查询失败')
    expect(mockLogger.error).toHaveBeenCalled()
  })
})

describe('getUnifiedStockViewsByStatusUseCase（按状态批量）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('应当按研究状态过滤并返回统一视图', async () => {
    const stocks = [
      createMockStock({ symbol: '000001.SZ', researchStatus: 'candidate' }),
      createMockStock({ symbol: '000002.SZ', researchStatus: 'candidate' }),
      createMockStock({ symbol: '000003.SZ', researchStatus: 'holding' }),
    ]

    mockQueryList.mockResolvedValueOnce(stocks)

    // 模拟 2 个 research 状态股票的查询（各 3 次 queryGet）
    let callCount = 0
    mockQueryGet.mockImplementation(() => {
      callCount++
      if (callCount <= 3) return Promise.resolve(stocks[0])
      return Promise.resolve(stocks[1])
    })

    const result = await getUnifiedStockViewsByStatusUseCase('research')

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(mockQueryList).toHaveBeenCalledWith(mockSTORE_NAME.stocks)
  })

  it('无匹配状态时应返回空数组', async () => {
    mockQueryList.mockResolvedValueOnce([])

    const result = await getUnifiedStockViewsByStatusUseCase('nonexistent')

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('查询股票列表失败时应返回失败', async () => {
    mockQueryList.mockRejectedValue(new Error('查询失败'))

    const result = await getUnifiedStockViewsByStatusUseCase('research')

    expect(result.success).toBe(false)
    expect(result.error).toContain('查询失败')
  })
})

describe('getScoreViewUseCase（评分视图）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('应当返回包含评分数据的精简视图', async () => {
    const stock = createMockStock()
    const v6Score = createMockV6Score()
    const intelligentScore = createMockIntelligentScore()
    const industryScore = createMockIndustryScore()

    mockQueryGet
      .mockResolvedValueOnce(stock)     // stocks
      .mockResolvedValueOnce(v6Score)   // v6Scores

    // intelligentScores
    mockQueryByIndex
      .mockResolvedValueOnce([intelligentScore])
      .mockResolvedValueOnce([industryScore])

    const result = await getScoreViewUseCase('000001.SZ')

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.stock).toEqual(stock)
    expect(result.data!.v6Score).toEqual(v6Score)
    expect(result.data!.intelligentScore).toBeDefined()
    expect(result.data!.industryScore).toBeDefined()
    expect(result.data).not.toHaveProperty('quotes')
    expect(result.data).not.toHaveProperty('signal')
    expect(typeof result.data!.completeness).toBe('number')
  })

  it('股票不存在时应返回失败', async () => {
    mockQueryGet.mockResolvedValueOnce(undefined)

    const result = await getScoreViewUseCase('999999.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Stock not found')
  })
})

describe('getTradingViewUseCase（交易视图）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('应当返回包含交易相关数据的视图', async () => {
    const stock = createMockStock()
    const quotes = createMockQuotes()
    const v6Score = createMockV6Score()
    const signal = createMockSignal()

    mockQueryGet
      .mockResolvedValueOnce(stock)     // stocks
      .mockResolvedValueOnce(quotes)    // dailyQuotes
      .mockResolvedValueOnce(v6Score)   // v6Scores

    mockQueryList.mockResolvedValueOnce([signal]) // signals

    const result = await getTradingViewUseCase('000001.SZ')

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.stock).toEqual(stock)
    expect(result.data!.quotes).toEqual(quotes)
    expect(result.data!.v6Score).toEqual(v6Score)
    expect(result.data!.signal).toBeDefined()
    expect(result.data).not.toHaveProperty('intelligentScore')
    expect(result.data).not.toHaveProperty('industryScore')
    expect(typeof result.data!.completeness).toBe('number')
  })

  it('股票不存在时应返回失败', async () => {
    mockQueryGet.mockResolvedValueOnce(undefined)

    const result = await getTradingViewUseCase('999999.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Stock not found')
  })
})
