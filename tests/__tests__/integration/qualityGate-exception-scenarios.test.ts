/**
 * @test_id V9-TEST-UT-P0-QG-EX
 * QualityGate P0-3 异常场景测试
 *
 * 验证 loadStocksWithData 在各种异常场景下的降级行为：
 *   EX-1: 财务数据 query 返回 success=false → dataStatus='missing'，不阻断
 *   EX-2: 财务数据 query 抛出异常 → dataStatus='missing'，不阻断
 *   EX-3: 行情数据缺失而财务数据正常 → quotes={}，financials.dataStatus='complete'
 *   EX-4: 财务和行情同时缺失 → 均降级，不阻断
 *   EX-5: 股票本身不存在于DB → 跳过该股票，不影响其他股票
 *   EX-6: 所有数据源均抛异常 → 返回空 results，triggerAnalysis 输出 warn
 *   EX-7: 混合场景：多只股票中部分正常、部分部分缺失、部分全缺失
 *   EX-8: 行情 query 抛异常而财务正常 → quotes 降级为 {}，financials 正常
 *
 * @covers_docs [V9-DOC-DATA-024, V9-DOC-BACK-011]
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Stock, DailyQuotes } from '@/data/types'

// ============================================================
// Mock 依赖 — 与 qualityGate-p0-fix.test.ts 保持一致
// ============================================================

const { mockQuery, mockRunFullIndustryAnalysis, mockRunV6ScoreBatch } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRunFullIndustryAnalysis: vi.fn(),
  mockRunV6ScoreBatch: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: vi.fn().mockResolvedValue({ success: true }),
    invalidateAll: vi.fn(),
  },
  ENVELOPE_ACTION: {
    queryGet: 'queryGet',
    queryList: 'queryList',
    queryByIndex: 'queryByIndex',
  },
  STORE_NAME: {
    stocks: 'stocks',
    dailyQuotes: 'daily_quotes',
    financialReports: 'financial_reports',
    v6Scores: 'v6_scores',
    industryScores: 'industry_scores',
  },
}))

vi.mock('@/services/data-collector/qualityMetricsCollector', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    getQualityMetrics: () => ({
      snapshot: () => ({
        successRate: 1.0,
        completeness: 1.0,
        writeRate: 1.0,
        totalTasks: 8,
        completedTasks: 8,
        failedTasks: 0,
        dimensionStats: {},
      }),
    }),
  }
})

vi.mock('@/services/data-collector/collectionPipeline', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    runBatchTrace: vi.fn().mockResolvedValue([]),
    createDefaultCollectionConfig: () => ({ dimensions: [], timeout: 30000 }),
  }
})

vi.mock('@/services/analysis/industryAnalysisService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    runFullIndustryAnalysis: mockRunFullIndustryAnalysis,
    invalidateIndustryCache: vi.fn(),
    getCachedV4Analyses: vi.fn(() => null),
  }
})

vi.mock('@/services/scoring/v6ScoreService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    runV6ScoreBatch: mockRunV6ScoreBatch,
    runV6Score: vi.fn(),
  }
})

vi.mock('@/services/scoring/v6-engine', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    quotesToQuoteData: (quotes: { history?: Array<{ close?: number }> }) => {
      const history = quotes.history ?? []
      const latestClose = history[history.length - 1]?.close ?? 0
      return { latestClose, history, volumeHistory: [] }
    },
  }
})

// ============================================================
// 种子数据
// ============================================================

const TEST_STOCK: Stock = {
  symbol: '000001',
  name: '平安银行',
  price: 10.5,
  pe: 8.2,
  pb: 0.7,
  roe: 12.5,
  marketCap: 200000000000,
  sector: '金融',
  industryCode: 'JR',
  pool: 'intention',
  researchStatus: 'researching',
} as unknown as Stock

const TEST_QUOTES: DailyQuotes = {
  symbol: '000001',
  history: [
    { date: '2024-01-01', open: 10.0, close: 10.2, high: 10.3, low: 9.9, volume: 1000000 },
    { date: '2024-01-02', open: 10.2, close: 10.5, high: 10.6, low: 10.1, volume: 1200000 },
  ],
  latest: { date: '2024-01-02', open: 10.2, close: 10.5, high: 10.6, low: 10.1, volume: 1200000 },
} as unknown as DailyQuotes

const TEST_FINANCIAL = {
  revenue: 100000000000,
  revenueYoY: 0.15,
  netProfit: 20000000000,
  grossMargin: 0.35,
  netMargin: 0.20,
}

// ============================================================
// 辅助函数：按 store + key 构造 mock 响应
// ============================================================

/**
 * 创建一个按 {store, key} 路由的 mockQuery 实现
 * behavior 参数定义每个 store 的返回行为：
 *   - 'normal' → 返回正常数据
 *   - 'missing' → 返回 { success: false }
 *   - 'throw' → 抛出异常
 *   - 'notfound' → 仅用于 stocks，返回 { success: false } 使股票被跳过
 */
type StoreBehavior = 'normal' | 'missing' | 'throw' | 'notfound'

function makeMockImpl(
  behaviors: { stocks: StoreBehavior; dailyQuotes: StoreBehavior; financialReports: StoreBehavior },
  stockOverrides?: Record<string, Stock>,
) {
  return (req: { store: string; key?: string }) => {
    const key = req.key ?? ''
    const behavior = (() => {
      switch (req.store) {
        case 'stocks': return behaviors.stocks
        case 'daily_quotes': return behaviors.dailyQuotes
        case 'financial_reports': return behaviors.financialReports
        default: return 'missing'
      }
    })()

    if (behavior === 'throw') {
      return Promise.reject(new Error(`mock throw: ${req.store}/${key}`))
    }
    if (behavior === 'missing' || behavior === 'notfound') {
      return Promise.resolve({ success: false, data: null })
    }

    // normal
    switch (req.store) {
      case 'stocks':
        return Promise.resolve({
          success: true,
          data: stockOverrides?.[key] ?? { ...TEST_STOCK, symbol: key },
        })
      case 'daily_quotes':
        return Promise.resolve({ success: true, data: { ...TEST_QUOTES, symbol: key } })
      case 'financial_reports':
        return Promise.resolve({ success: true, data: TEST_FINANCIAL })
      default:
        return Promise.resolve({ success: false })
    }
  }
}

// ============================================================
// 测试套件
// ============================================================

describe('QualityGate P0-3 异常场景', () => {
  let qualityGate: import('@/services/orchestration/qualityGate').QualityGate
  let eventBus: typeof import('@/lib/eventBus').eventBus
  let EVENT_NAMES: typeof import('@/constants/store-channels.constants').EVENT_NAMES

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRunFullIndustryAnalysis.mockResolvedValue({ aggregations: [], v4Analyses: [] })
    mockRunV6ScoreBatch.mockResolvedValue({
      success: true,
      data: { scores: [], stats: { total: 1, completed: 1, failed: 0, skipped: 0, totalMs: 100, avgMs: 100, workerCount: 1, fallbackToMainThread: false }, errors: [] },
    })

    const mod = await import('@/services/orchestration/qualityGate')
    qualityGate = new mod.QualityGate()
    const eb = await import('@/lib/eventBus')
    eventBus = eb.eventBus
    const en = await import('@/constants/store-channels.constants')
    EVENT_NAMES = en.EVENT_NAMES
  })

  afterEach(() => {
    qualityGate?.stop()
  })

  // === EX-1: 财务数据 query 返回 success=false ===

  it('EX-1: 财务数据返回 success=false 时 dataStatus=missing，流程不中断', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'normal',
      dailyQuotes: 'normal',
      financialReports: 'missing',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['000001'] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      financials: { dataStatus?: string }
      quotes: Record<string, unknown>
    }>

    expect(callArgs).toHaveLength(1)
    expect(callArgs[0]!.financials.dataStatus).toBe('missing')
    // 行情数据仍正常
    expect(callArgs[0]!.quotes.history).toBeDefined()
  })

  // === EX-2: 财务数据 query 抛出异常 ===

  it('EX-2: 财务数据 query 抛异常时 dataStatus=missing，流程不中断', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'normal',
      dailyQuotes: 'normal',
      financialReports: 'throw',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['000001'] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      financials: { dataStatus?: string }
      quotes: Record<string, unknown>
    }>

    expect(callArgs).toHaveLength(1)
    expect(callArgs[0]!.financials.dataStatus).toBe('missing')
    expect(callArgs[0]!.quotes.history).toBeDefined()
  })

  // === EX-3: 行情缺失而财务正常 ===

  it('EX-3: 行情数据缺失而财务正常 → quotes={} 但 financials.dataStatus=complete', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'normal',
      dailyQuotes: 'missing',
      financialReports: 'normal',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['000001'] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      financials: { dataStatus?: string; revenue?: number }
      quotes: Record<string, unknown>
    }>

    expect(callArgs).toHaveLength(1)
    expect(callArgs[0]!.quotes).toEqual({})
    expect(callArgs[0]!.financials.dataStatus).toBe('complete')
    expect(callArgs[0]!.financials.revenue).toBe(TEST_FINANCIAL.revenue)
  })

  // === EX-4: 财务和行情同时缺失 ===

  it('EX-4: 财务和行情同时缺失 → 均降级，股票仍进入分析', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'normal',
      dailyQuotes: 'missing',
      financialReports: 'missing',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['000001'] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      financials: { dataStatus?: string }
      quotes: Record<string, unknown>
    }>

    expect(callArgs).toHaveLength(1)
    expect(callArgs[0]!.financials.dataStatus).toBe('missing')
    expect(callArgs[0]!.quotes).toEqual({})
  })

  // === EX-5: 股票本身不存在于DB ===

  it('EX-5: 股票不存在于DB → 跳过该股票，runFullIndustryAnalysis 不被调用', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'notfound',
      dailyQuotes: 'normal',
      financialReports: 'normal',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['999999'] })

    // 等待足够时间确认 runFullIndustryAnalysis 未被调用
    await new Promise((r) => setTimeout(r, 1500))

    expect(mockRunFullIndustryAnalysis).not.toHaveBeenCalled()
    expect(mockRunV6ScoreBatch).not.toHaveBeenCalled()
  })

  // === EX-6: 所有数据源均抛异常 ===

  it('EX-6: 所有数据源均抛异常 → triggerAnalysis 输出 warn，不调用分析引擎', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'throw',
      dailyQuotes: 'throw',
      financialReports: 'throw',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['000001'] })

    await new Promise((r) => setTimeout(r, 1500))

    // stocks 查询抛异常 → catch 块吞掉 → results 为空 → 不调用分析
    expect(mockRunFullIndustryAnalysis).not.toHaveBeenCalled()
    expect(mockRunV6ScoreBatch).not.toHaveBeenCalled()
  })

  // === EX-7: 混合场景 — 多只股票部分正常/部分缺失/部分跳过 ===

  it('EX-7: 混合场景 3只股票(正常+部分缺失+不存在) → 仅正常和部分缺失的进入分析', async () => {
    const symbols = ['000001', '600519', '999999']

    mockQuery.mockImplementation((req: { store: string; key?: string }) => {
      const key = req.key ?? ''
      // 999999 模拟股票不存在
      if (key === '999999' && req.store === 'stocks') {
        return Promise.resolve({ success: false, data: null })
      }
      // 600519 模拟财务数据抛异常
      if (key === '600519' && req.store === 'financial_reports') {
        return Promise.reject(new Error('财务数据查询超时'))
      }
      // 600519 模拟行情缺失
      if (key === '600519' && req.store === 'daily_quotes') {
        return Promise.resolve({ success: false, data: null })
      }

      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: { ...TEST_STOCK, symbol: key, name: key === '000001' ? '平安银行' : '贵州茅台' } })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: { ...TEST_QUOTES, symbol: key } })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      stock: { symbol?: string }
      financials: { dataStatus?: string }
      quotes: Record<string, unknown>
    }>

    // 999999 被跳过，只有 000001 和 600519 进入分析
    expect(callArgs).toHaveLength(2)
    const symbolsInAnalysis = callArgs.map((c) => c.stock.symbol)
    expect(symbolsInAnalysis).toContain('000001')
    expect(symbolsInAnalysis).toContain('600519')
    expect(symbolsInAnalysis).not.toContain('999999')

    // 000001 完整数据
    const stock001 = callArgs.find((c) => c.stock.symbol === '000001')!
    expect(stock001.financials.dataStatus).toBe('complete')
    expect(stock001.quotes.history).toBeDefined()

    // 600519 财务缺失 + 行情缺失
    const stock519 = callArgs.find((c) => c.stock.symbol === '600519')!
    expect(stock519.financials.dataStatus).toBe('missing')
    expect(stock519.quotes).toEqual({})

    // runV6ScoreBatch 仍收到全部 3 个 symbols
    await vi.waitFor(() => {
      expect(mockRunV6ScoreBatch).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })
    expect(mockRunV6ScoreBatch.mock.calls[0]![0]).toEqual(symbols)
  })

  // === EX-8: 行情 query 抛异常而财务正常 ===

  it('EX-8: 行情 query 抛异常而财务正常 → quotes 降级为 {}，financials 正常', async () => {
    mockQuery.mockImplementation(makeMockImpl({
      stocks: 'normal',
      dailyQuotes: 'throw',
      financialReports: 'normal',
    }))

    qualityGate.start()
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: ['000001'] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      financials: { dataStatus?: string; revenue?: number }
      quotes: Record<string, unknown>
    }>

    expect(callArgs).toHaveLength(1)
    expect(callArgs[0]!.quotes).toEqual({})
    expect(callArgs[0]!.financials.dataStatus).toBe('complete')
    expect(callArgs[0]!.financials.revenue).toBe(TEST_FINANCIAL.revenue)
  })
})
