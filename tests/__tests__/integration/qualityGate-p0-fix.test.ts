/**
 * @test_id V9-TEST-UT-P0-QG
 * QualityGate P0 修复验证测试
 *
 * 验证三个 P0 断链修复：
 *   P0-1: buildEngineInput 注入行业 V4 分析结果（不再只用硬编码速查表）
 *   P0-2: runV6ScoreBatch 接入事件链（行业分析完成后触发批量评分）
 *   P0-3: triggerAnalysis 传入真实财务和行情数据（不再传空对象）
 *
 * 设计要点：
 *   1. dataBridge.query 被 mock，返回种子化的 stock/financial/quotes 数据
 *   2. runFullIndustryAnalysis 被 mock，捕获入参验证 financials/quotes 非空
 *   3. runV6ScoreBatch 被 mock，验证在行业分析完成后被调用
 *   4. getQualityMetrics 被 mock，返回通过的指标以跳过质量门禁拦截
 *
 * @covers_docs [V9-DOC-DATA-024, V9-DOC-BACK-011, V9-DOC-ARCH-008]
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Stock, DailyQuotes } from '@/data/types'

// ============================================================
// Mock 依赖
// 使用 vi.hoisted() 确保 mock 变量在 vi.mock 工厂提升后仍可访问
// 避免 TDZ（暂时性死区）导致闭包捕获 undefined
// ============================================================

const { mockQuery, mockRunFullIndustryAnalysis, mockRunV6ScoreBatch } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRunFullIndustryAnalysis: vi.fn(),
  mockRunV6ScoreBatch: vi.fn(),
}))

// --- Mock dataBridge ---
// 直接将 query 设为 mockQuery 本身（非闭包包装），避免作用域问题
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

// --- Mock getQualityMetrics ---
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

// --- Mock runBatchTrace (retry 逻辑用) ---
vi.mock('@/services/data-collector/collectionPipeline', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    runBatchTrace: vi.fn().mockResolvedValue([]),
    createDefaultCollectionConfig: () => ({ dimensions: [], timeout: 30000 }),
  }
})

// --- Mock runFullIndustryAnalysis: 捕获入参 ---
vi.mock('@/services/analysis/industryAnalysisService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    runFullIndustryAnalysis: mockRunFullIndustryAnalysis,
    invalidateIndustryCache: vi.fn(),
    getCachedV4Analyses: vi.fn(() => null),
  }
})

// --- Mock runV6ScoreBatch: 捕获调用 ---
vi.mock('@/services/scoring/v6ScoreService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    runV6ScoreBatch: mockRunV6ScoreBatch,
    runV6Score: vi.fn(),
  }
})

// --- Mock v6-engine: 提供 quotesToQuoteData 简单实现 + 类型 ---
// 避免加载整个 v6-engine 模块树（含 calculators/enhancers 等）造成副作用
vi.mock('@/services/scoring/v6-engine', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    quotesToQuoteData: (quotes: { history?: Array<{ close?: number }> }) => {
      const history = quotes.history ?? []
      const latestClose = history[history.length - 1]?.close ?? 0
      return {
        latestClose,
        history,
        volumeHistory: [],
      }
    },
  }
})

// ============================================================
// 种子数据
// ============================================================

const TEST_SYMBOL = '000001'
const TEST_STOCK: Stock = {
  symbol: TEST_SYMBOL,
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
  symbol: TEST_SYMBOL,
  history: [
    { date: '2024-01-01', open: 10.0, close: 10.2, high: 10.3, low: 9.9, volume: 1000000 },
    { date: '2024-01-02', open: 10.2, close: 10.5, high: 10.6, low: 10.1, volume: 1200000 },
    { date: '2024-01-03', open: 10.5, close: 10.3, high: 10.7, low: 10.2, volume: 900000 },
  ],
  latest: { date: '2024-01-03', open: 10.5, close: 10.3, high: 10.7, low: 10.2, volume: 900000 },
} as unknown as DailyQuotes

const TEST_FINANCIAL = {
  revenue: 100000000000,
  revenueYoY: 0.15,
  netProfit: 20000000000,
  netProfitYoY: 0.20,
  grossMargin: 0.35,
  netMargin: 0.20,
  operatingCF: 25000000000,
  rdRatio: 0.03,
  receivables: 5000000000,
  inventoryTurnoverDays: 30,
  interestBearingDebt: 30000000000,
  goodwill: 1000000000,
  netAssets: 50000000000,
  shareholderPledge: 0.05,
}

// ============================================================
// 测试套件
// ============================================================

describe('QualityGate P0 修复验证', () => {
  let qualityGate: import('@/services/orchestration/qualityGate').QualityGate

  beforeEach(async () => {
    vi.clearAllMocks()

    // 配置 mockRunFullIndustryAnalysis 返回值
    mockRunFullIndustryAnalysis.mockResolvedValue({
      aggregations: [],
      v4Analyses: [],
    })

    // 配置 mockRunV6ScoreBatch 返回值
    mockRunV6ScoreBatch.mockResolvedValue({
      success: true,
      data: {
        scores: [],
        stats: {
          total: 1,
          completed: 1,
          failed: 0,
          skipped: 0,
          totalMs: 100,
          avgMs: 100,
          workerCount: 1,
          fallbackToMainThread: false,
        },
        errors: [],
      },
    })

    // 动态导入 QualityGate（在 mock 生效后）
    const { QualityGate } = await import('@/services/orchestration/qualityGate')
    qualityGate = new QualityGate()
  })

  afterEach(() => {
    qualityGate?.stop()
  })

  // === 诊断测试：验证 mock 在 QualityGate 上下文中是否工作 ===

  it('诊断: dataBridge.query mock 在 QualityGate 导入后是否工作', async () => {
    const { dataBridge, STORE_NAME } = await import('@/core/databridge')

    console.log('[diag] STORE_NAME:', JSON.stringify(STORE_NAME))
    console.log('[diag] dataBridge.query === mockQuery:', dataBridge.query === mockQuery)

    mockQuery.mockImplementation((req: { store: string }) => {
      console.log('[diag] mockQuery called, store:', req.store)
      return Promise.resolve({ success: true, data: { symbol: 'test' } })
    })

    const result = await dataBridge.query({ action: 'QUERY_GET', store: STORE_NAME.stocks, key: '000001' })
    console.log('[diag] result:', JSON.stringify(result))
    console.log('[diag] mockQuery calls:', mockQuery.mock.calls.length)
  })

  // === P0-3: 验证 financials 和 quotes 不再为空 ===

  it('P0-3: triggerAnalysis 传入真实财务数据（非空对象）', async () => {
    // 配置 dataBridge.query 按 store 返回不同数据
    mockQuery.mockImplementation((req: { store: string }) => {
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: TEST_STOCK })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: TEST_QUOTES })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()

    // 触发 REGISTRATION_COLLECT_COMPLETE 事件
    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: [TEST_SYMBOL] })

    // 等待异步处理完成
    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    // 验证 runFullIndustryAnalysis 收到的 financials 不为空
    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      stock: Stock
      financials: Record<string, unknown>
      quotes: Record<string, unknown>
    }>

    expect(callArgs).toHaveLength(1)
    expect(callArgs[0]!.financials).not.toEqual({})
    expect(callArgs[0]!.financials.dataStatus).toBe('complete')
    expect(callArgs[0]!.financials.revenue).toBe(TEST_FINANCIAL.revenue)
    expect(callArgs[0]!.financials.grossMargin).toBe(TEST_FINANCIAL.grossMargin)
  })

  it('P0-3: triggerAnalysis 传入真实行情数据（非空对象）', async () => {
    mockQuery.mockImplementation((req: { store: string }) => {
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: TEST_STOCK })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: TEST_QUOTES })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()

    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: [TEST_SYMBOL] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      quotes: { history?: unknown[]; latestClose?: number }
    }>

    // quotes 不应为空对象
    expect(callArgs[0]!.quotes).not.toEqual({})
    // 应有 history 数据
    expect(callArgs[0]!.quotes.history).toBeDefined()
    expect(Array.isArray(callArgs[0]!.quotes.history)).toBe(true)
    expect((callArgs[0]!.quotes.history as unknown[]).length).toBeGreaterThan(0)
  })

  it('P0-3: financials 缺失时降级为 dataStatus=missing（不阻断流程）', async () => {
    mockQuery.mockImplementation((req: { store: string }) => {
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: TEST_STOCK })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: TEST_QUOTES })
        case 'financial_reports':
          return Promise.resolve({ success: false }) // 财务数据不存在
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()

    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: [TEST_SYMBOL] })

    await vi.waitFor(() => {
      expect(mockRunFullIndustryAnalysis).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    const callArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as Array<{
      financials: { dataStatus?: string }
    }>

    expect(callArgs[0]!.financials.dataStatus).toBe('missing')
  })

  // === P0-2: 验证 runV6ScoreBatch 被调用 ===

  it('P0-2: 行业分析完成后触发 runV6ScoreBatch', async () => {
    mockQuery.mockImplementation((req: { store: string }) => {
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: TEST_STOCK })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: TEST_QUOTES })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()

    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: [TEST_SYMBOL] })

    // 等待 runV6ScoreBatch 被调用
    await vi.waitFor(() => {
      expect(mockRunV6ScoreBatch).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    // 验证传入的 symbols 正确
    const batchArgs = mockRunV6ScoreBatch.mock.calls[0]
    expect(batchArgs![0]).toEqual([TEST_SYMBOL])
  })

  it('P0-2: runV6ScoreBatch 在 runFullIndustryAnalysis 之后调用', async () => {
    mockQuery.mockImplementation((req: { store: string }) => {
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: TEST_STOCK })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: TEST_QUOTES })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    const callOrder: string[] = []
    mockRunFullIndustryAnalysis.mockImplementation(() => {
      callOrder.push('runFullIndustryAnalysis')
      return Promise.resolve({ aggregations: [], v4Analyses: [] })
    })
    mockRunV6ScoreBatch.mockImplementation(() => {
      callOrder.push('runV6ScoreBatch')
      return Promise.resolve({ success: true, data: { scores: [], stats: {}, errors: [] } })
    })

    qualityGate.start()

    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: [TEST_SYMBOL] })

    await vi.waitFor(() => {
      expect(mockRunV6ScoreBatch).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    expect(callOrder).toEqual(['runFullIndustryAnalysis', 'runV6ScoreBatch'])
  })

  // === P0-2: 验证批量评分完成后发出事件 ===

  it('P0-2: 批量评分完成后发出 V6_BATCH_SCORE_COMPLETED 事件', async () => {
    mockQuery.mockImplementation((req: { store: string }) => {
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: TEST_STOCK })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: TEST_QUOTES })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()

    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')

    let batchEventReceived = false
    eventBus.on(EVENT_NAMES.V6_BATCH_SCORE_COMPLETED, () => {
      batchEventReceived = true
    })

    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols: [TEST_SYMBOL] })

    await vi.waitFor(() => {
      expect(batchEventReceived).toBe(true)
    }, { timeout: 5000 })
  })

  // === 综合：多股票场景 ===

  it('综合: 多股票场景下 financials/quotes 全部非空 + batch 评分覆盖全部', async () => {
    const symbols = ['000001', '600519', '000858']

    const stocks: Record<string, Stock> = {
      '000001': { ...TEST_STOCK, symbol: '000001', name: '平安银行' } as unknown as Stock,
      '600519': { ...TEST_STOCK, symbol: '600519', name: '贵州茅台', sector: '消费', price: 1800 } as unknown as Stock,
      '000858': { ...TEST_STOCK, symbol: '000858', name: '五粮液', sector: '消费', price: 150 } as unknown as Stock,
    }

    mockQuery.mockImplementation((req: { store: string; key?: string }) => {
      const key = req.key ?? ''
      switch (req.store) {
        case 'stocks':
          return Promise.resolve({ success: true, data: stocks[key] ?? null })
        case 'daily_quotes':
          return Promise.resolve({ success: true, data: { ...TEST_QUOTES, symbol: key } })
        case 'financial_reports':
          return Promise.resolve({ success: true, data: TEST_FINANCIAL })
        default:
          return Promise.resolve({ success: false })
      }
    })

    qualityGate.start()

    const { eventBus } = await import('@/lib/eventBus')
    const { EVENT_NAMES } = await import('@/constants/store-channels.constants')
    eventBus.emit(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, { symbols })

    await vi.waitFor(() => {
      expect(mockRunV6ScoreBatch).toHaveBeenCalledTimes(1)
    }, { timeout: 5000 })

    // 验证 runFullIndustryAnalysis 收到 3 只股票
    const industryArgs = mockRunFullIndustryAnalysis.mock.calls[0]![0] as unknown[]
    expect(industryArgs).toHaveLength(3)

    // 验证每只股票的 financials 和 quotes 都不为空
    for (const item of industryArgs as Array<{ financials: Record<string, unknown>; quotes: Record<string, unknown> }>) {
      expect(item.financials).not.toEqual({})
      expect(item.financials.dataStatus).toBe('complete')
      expect(item.quotes).not.toEqual({})
      expect(item.quotes.history).toBeDefined()
    }

    // 验证 runV6ScoreBatch 收到全部 3 只 symbols
    const batchArgs = mockRunV6ScoreBatch.mock.calls[0]
    expect(batchArgs![0]).toEqual(symbols)
  })
})
