/**
 * @test_id V9-TEST-ST-131
 * @module services/useCase/fetchIndustryDashboard.useCase.test
 * @description 行业仪表盘用例单元测试 — 验证数据加载、分析引擎调用与异常处理
 * @covers_docs [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchIndustryDashboardUseCase } from './fetchIndustryDashboard.useCase'
import type { Stock } from '@/data/types/types.stock'
import type { FinancialData, QuoteData } from '@/services/scoring/v6-engine/types'
import type {
  IndustryV4AnalysisEnhanced,
  IndustryRotationSignal,
} from '@/data/types/types.sector'

// Mock 依赖
const {
  mockQuery,
  mockRunFullIndustryAnalysisEnhanced,
  mockGenerateRotationSignals,
  mockLogger,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRunFullIndustryAnalysisEnhanced: vi.fn(),
  mockGenerateRotationSignals: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: vi.fn(),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/services/analysis/industryAnalysisService', () => ({
  runFullIndustryAnalysisEnhanced: mockRunFullIndustryAnalysisEnhanced,
}))

vi.mock('@/services/analysis/industryV4Analyzer', () => ({
  generateRotationSignals: mockGenerateRotationSignals,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// ============================================================
// 辅助函数
// ============================================================

function createMockStock(symbol: string, name: string, industryCode?: string): Stock {
  return {
    symbol,
    name,
    price: 10.5,
    pe: 15.2,
    pb: 1.8,
    roe: 12.5,
    marketCap: 10000000000,
    researchStatus: 'candidate',
    source: 'manual',
    dataVersion: 1,
    industryCode,
  }
}

function createMockFinancials(symbol: string): FinancialData {
  return {
    symbol,
    revenue: 100,
    revenueGrowth: 0.15,
    profit: 20,
    profitGrowth: 0.2,
    grossMargin: 0.4,
    netMargin: 0.2,
    roe: 0.12,
  } as unknown as FinancialData
}

function createMockQuotes(symbol: string): QuoteData {
  return {
    symbol,
    close: 10.5,
    open: 10.2,
    high: 10.8,
    low: 10.0,
    volume: 1000000,
    turnover: 10500000,
    change: 0.3,
    changePercent: 0.029,
    periodReturn: 0.05,
    periodReturn1w: 0.03,
    periodReturn1m: 0.08,
    periodReturn3m: 0.12,
    periodReturn6m: 0.15,
    periodReturn1y: 0.25,
  } as unknown as QuoteData
}

function createMockV4Analysis(
  industryCode: string,
  industryName: string,
): IndustryV4AnalysisEnhanced {
  return {
    industryCode,
    industryName,
    tier: 'tier2',
    v4Composite: 3.5,
    dimensions: {
      prosperity: { score: 3.5, detail: '景气度良好' } as unknown as any,
      competition: { score: 3.0, detail: '竞争格局一般' } as unknown as any,
      policy: { score: 4.0, detail: '政策支持力度大' } as unknown as any,
      technology: { score: 3.8, detail: '技术迭代快' } as unknown as any,
    },
    constituentCount: 10,
    dataCompleteness: 0.8,
    dataSources: ['manual', 'financial_report'],
    analyzedAt: Date.now(),
    subIndicators: {} as any,
    valuation: {
      peMedian: 15.0,
      pbMedian: 1.8,
      valuationScore: 3.0,
      summary: '估值合理',
      analyzedAt: Date.now(),
    } as any,
  }
}

function createMockRotationSignal(
  industryCode: string,
  industryName: string,
): IndustryRotationSignal {
  return {
    industryCode,
    industryName,
    signal: 'buy',
    signalStrength: 0.7,
    compositeScore: 3.5,
    scores: {
      v4: 3.5,
      trend: 0.5,
      valuation: 3.0,
      momentum: 0.6,
    },
    rationale: '行业景气度上行，估值合理',
    risks: ['宏观经济下行风险', '政策变动风险'],
    generatedAt: Date.now(),
  }
}

/**
 * 设置 mockQuery 的三次并行调用结果（stocks / financials / quotes）
 */
function mockParallelQueryResults(
  stocks: Stock[],
  financials: Array<Record<string, unknown>>,
  quotes: Array<Record<string, unknown>>,
) {
  // Promise.all 顺序：stocks, financials, quotes
  mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
  mockQuery.mockResolvedValueOnce({ success: true, data: financials })
  mockQuery.mockResolvedValueOnce({ success: true, data: quotes })
}

function mockDefaultAnalysis() {
  const v4Analyses = [
    createMockV4Analysis('I001', '人工智能'),
    createMockV4Analysis('I002', '新能源'),
  ]
  mockRunFullIndustryAnalysisEnhanced.mockResolvedValue({
    aggregations: [],
    v4Analyses,
  })

  const rotationSignals = [
    createMockRotationSignal('I001', '人工智能'),
    createMockRotationSignal('I002', '新能源'),
  ]
  mockGenerateRotationSignals.mockReturnValue(rotationSignals)

  return { v4Analyses, rotationSignals }
}

// ============================================================
// 测试主体
// ============================================================

describe('fetchIndustryDashboardUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ success: false, data: [], error: '未设置 mock' })
    mockRunFullIndustryAnalysisEnhanced.mockResolvedValue({ aggregations: [], v4Analyses: [] })
    mockGenerateRotationSignals.mockReturnValue([])
  })

  describe('正常流程', () => {
    it('应当成功加载并分析数据：完整流程', async () => {
      // 准备
      const stocks = [
        createMockStock('000001.SZ', '平安银行', 'I001'),
        createMockStock('000002.SZ', '万科A', 'I002'),
      ]
      const financials = [
        createMockFinancials('000001.SZ'),
        createMockFinancials('000002.SZ'),
      ] as unknown as Array<Record<string, unknown>>
      const quotes = [
        createMockQuotes('000001.SZ'),
        createMockQuotes('000002.SZ'),
      ] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      const { v4Analyses, rotationSignals } = mockDefaultAnalysis()

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.v4Analyses).toHaveLength(2)
      expect(result.rotationSignals).toHaveLength(2)
      expect(result.v4Analyses).toEqual(v4Analyses)
      expect(result.rotationSignals).toEqual(rotationSignals)
      expect(result.error).toBeUndefined()
      expect(result.emptyReason).toBeUndefined()

      // 验证 dataBridge.query 被调用了 3 次（stocks / financials / quotes）
      expect(mockQuery).toHaveBeenCalledTimes(3)
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledTimes(1)
      expect(mockGenerateRotationSignals).toHaveBeenCalledTimes(1)
    })
  })

  describe('空数据场景', () => {
    it('应当返回 emptyReason：股票数据为空', async () => {
      // 准备：股票列表为空
      mockParallelQueryResults([], [], [])

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.v4Analyses).toHaveLength(0)
      expect(result.rotationSignals).toHaveLength(0)
      expect(result.emptyReason).toBe('暂无股票数据，请先导入股票池')
      expect(result.error).toBeUndefined()

      // 验证分析引擎未被调用
      expect(mockRunFullIndustryAnalysisEnhanced).not.toHaveBeenCalled()
      expect(mockGenerateRotationSignals).not.toHaveBeenCalled()
    })

    it('应当返回 emptyReason：行业分析结果为空', async () => {
      // 准备：有股票数据，但分析结果为空
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockRunFullIndustryAnalysisEnhanced.mockResolvedValue({
        aggregations: [],
        v4Analyses: [],
      })

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.v4Analyses).toHaveLength(0)
      expect(result.rotationSignals).toHaveLength(0)
      expect(result.emptyReason).toBe('行业分析数据为空，请检查股票数据完整性')
      expect(result.error).toBeUndefined()

      // 验证轮动信号未被调用
      expect(mockGenerateRotationSignals).not.toHaveBeenCalled()
    })
  })

  describe('数据查询失败场景', () => {
    it('应当返回失败：股票数据查询失败', async () => {
      // 准备：第一次 query（stocks）失败
      mockQuery.mockResolvedValueOnce({ success: false, error: '股票数据库连接超时' })
      // 另外两个 query 也会被调用（Promise.all 并行）
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.v4Analyses).toHaveLength(0)
      expect(result.rotationSignals).toHaveLength(0)
      expect(result.error).toBe('股票数据库连接超时')
      expect(result.emptyReason).toBeUndefined()
    })

    it('应当返回失败：财报数据查询失败', async () => {
      // 准备：financials 查询失败
      mockQuery.mockResolvedValueOnce({ success: true, data: [createMockStock('000001.SZ', '平安银行')] })
      mockQuery.mockResolvedValueOnce({ success: false, error: '财报表损坏' })
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('财报表损坏')
    })

    it('应当返回失败：行情数据查询失败', async () => {
      // 准备：quotes 查询失败
      mockQuery.mockResolvedValueOnce({ success: true, data: [createMockStock('000001.SZ', '平安银行')] })
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })
      mockQuery.mockResolvedValueOnce({ success: false, error: '行情数据源不可用' })

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('行情数据源不可用')
    })

    it('应当返回默认错误信息：查询失败但 error 字段为空', async () => {
      // 准备：stocks 查询失败但没有 error 字段
      mockQuery.mockResolvedValueOnce({ success: false, data: [] })
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('股票数据查询失败')
    })
  })

  describe('分析引擎异常场景', () => {
    it('应当捕获异常：分析引擎抛出错误', async () => {
      // 准备
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockRunFullIndustryAnalysisEnhanced.mockRejectedValue(new Error('分析引擎内存溢出'))

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.v4Analyses).toHaveLength(0)
      expect(result.rotationSignals).toHaveLength(0)
      expect(result.error).toContain('分析引擎内存溢出')
    })

    it('应当捕获异常：dataBridge.query 抛出异常', async () => {
      // 准备：query 直接抛出异常
      mockQuery.mockRejectedValue(new Error('IndexedDB 未初始化'))

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toContain('IndexedDB 未初始化')
    })

    it('应当处理非 Error 类型异常', async () => {
      // 准备：抛出字符串异常
      mockQuery.mockRejectedValue('网络中断')

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('网络中断')
    })
  })

  describe('参数传递', () => {
    it('应当正确传递 forceRefresh 参数', async () => {
      // 准备
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      await fetchIndustryDashboardUseCase({ forceRefresh: true })

      // 验证
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          forceRefresh: true,
        }),
      )
    })

    it('应当正确传递 hs300Pe 和 hs300Pb 参数', async () => {
      // 准备
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      await fetchIndustryDashboardUseCase({ hs300Pe: 12.5, hs300Pb: 1.3 })

      // 验证
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          hs300Pe: 12.5,
          hs300Pb: 1.3,
        }),
      )
    })

    it('不传参数时应使用默认值', async () => {
      // 准备
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      await fetchIndustryDashboardUseCase()

      // 验证
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          forceRefresh: undefined,
          hs300Pe: undefined,
          hs300Pb: undefined,
        }),
      )
    })
  })

  describe('默认值填充', () => {
    it('应当填充默认值：部分股票缺失财报数据', async () => {
      // 准备：2 只股票，只有 1 只有财报
      const stocks = [
        createMockStock('000001.SZ', '平安银行', 'I001'),
        createMockStock('000002.SZ', '万科A', 'I002'),
      ]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [
        createMockQuotes('000001.SZ'),
        createMockQuotes('000002.SZ'),
      ] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      await fetchIndustryDashboardUseCase()

      // 验证：分析引擎被调用，且参数正确
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledTimes(1)
      const callArgs = mockRunFullIndustryAnalysisEnhanced.mock.calls[0]!
      const stockDataList = callArgs[0] as Array<{
        stock: Stock
        financials: FinancialData & Record<string, unknown>
        quotes: QuoteData & Record<string, unknown>
      }>

      expect(stockDataList).toHaveLength(2)

      // 第一只股票：有财报数据
      const stock1 = stockDataList.find((s) => s.stock.symbol === '000001.SZ')!
      expect(stock1).toBeDefined()
      expect(stock1.financials.revenue).toBe(100)
      expect(stock1.quotes.close).toBe(10.5)

      // 第二只股票：缺失财报，应为默认 null 值
      const stock2 = stockDataList.find((s) => s.stock.symbol === '000002.SZ')!
      expect(stock2).toBeDefined()
      expect(stock2.financials.revenueGrowth).toBeNull()
      expect(stock2.financials.profitGrowth).toBeNull()
      expect(stock2.financials.grossMargin).toBeNull()
      expect(stock2.financials.netMargin).toBeNull()
      expect(stock2.financials.roe).toBeNull()
      expect(stock2.financials.revenue).toBeNull()
      expect(stock2.financials.profit).toBeNull()
      // 行情数据仍然存在
      expect(stock2.quotes.close).toBe(10.5)
    })

    it('应当填充默认值：部分股票缺失行情数据', async () => {
      // 准备：2 只股票，只有 1 只有行情
      const stocks = [
        createMockStock('000001.SZ', '平安银行', 'I001'),
        createMockStock('000002.SZ', '万科A', 'I002'),
      ]
      const financials = [
        createMockFinancials('000001.SZ'),
        createMockFinancials('000002.SZ'),
      ] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      await fetchIndustryDashboardUseCase()

      // 验证
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledTimes(1)
      const callArgs = mockRunFullIndustryAnalysisEnhanced.mock.calls[0]!
      const stockDataList = callArgs[0] as Array<{
        stock: Stock
        financials: FinancialData & Record<string, unknown>
        quotes: QuoteData & Record<string, unknown>
      }>

      expect(stockDataList).toHaveLength(2)

      // 第一只股票：有行情数据
      const stock1 = stockDataList.find((s) => s.stock.symbol === '000001.SZ')!
      expect(stock1.quotes.close).toBe(10.5)
      expect(stock1.financials.revenue).toBe(100)

      // 第二只股票：缺失行情，应为默认 null 值
      const stock2 = stockDataList.find((s) => s.stock.symbol === '000002.SZ')!
      expect(stock2.quotes.close).toBeNull()
      expect(stock2.quotes.open).toBeNull()
      expect(stock2.quotes.high).toBeNull()
      expect(stock2.quotes.low).toBeNull()
      expect(stock2.quotes.volume).toBeNull()
      expect(stock2.quotes.turnover).toBeNull()
      expect(stock2.quotes.change).toBeNull()
      expect(stock2.quotes.changePercent).toBeNull()
      // 财报数据仍然存在
      expect(stock2.financials.revenue).toBe(100)
    })

    it('应当填充默认值：所有股票都缺失财报和行情', async () => {
      // 准备：有股票但没有任何财报和行情
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]

      mockParallelQueryResults(stocks, [], [])
      mockDefaultAnalysis()

      // 执行
      await fetchIndustryDashboardUseCase()

      // 验证
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledTimes(1)
      const callArgs = mockRunFullIndustryAnalysisEnhanced.mock.calls[0]!
      const stockDataList = callArgs[0] as Array<{
        stock: Stock
        financials: FinancialData & Record<string, unknown>
        quotes: QuoteData & Record<string, unknown>
      }>

      expect(stockDataList).toHaveLength(1)
      expect(stockDataList[0]!.financials.revenueGrowth).toBeNull()
      expect(stockDataList[0]!.financials.profitGrowth).toBeNull()
      expect(stockDataList[0]!.quotes.close).toBeNull()
      expect(stockDataList[0]!.quotes.open).toBeNull()
      expect(stockDataList[0]!.stock.symbol).toBe('000001.SZ')
    })
  })

  describe('并发请求', () => {
    it('并发多次调用应互不干扰', async () => {
      // 准备：模拟两次并发调用
      const stocks1 = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const stocks2 = [createMockStock('000002.SZ', '万科A', 'I002')]

      const financials1 = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const financials2 = [createMockFinancials('000002.SZ')] as unknown as Array<Record<string, unknown>>

      const quotes1 = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes2 = [createMockQuotes('000002.SZ')] as unknown as Array<Record<string, unknown>>

      // 第一次调用的 3 个 query
      mockQuery.mockResolvedValueOnce({ success: true, data: stocks1 })
      mockQuery.mockResolvedValueOnce({ success: true, data: financials1 })
      mockQuery.mockResolvedValueOnce({ success: true, data: quotes1 })
      // 第二次调用的 3 个 query
      mockQuery.mockResolvedValueOnce({ success: true, data: stocks2 })
      mockQuery.mockResolvedValueOnce({ success: true, data: financials2 })
      mockQuery.mockResolvedValueOnce({ success: true, data: quotes2 })

      // 分析引擎返回不同结果
      const v4Analyses1 = [createMockV4Analysis('I001', '人工智能')]
      const v4Analyses2 = [createMockV4Analysis('I002', '新能源')]

      mockRunFullIndustryAnalysisEnhanced
        .mockResolvedValueOnce({ aggregations: [], v4Analyses: v4Analyses1 })
        .mockResolvedValueOnce({ aggregations: [], v4Analyses: v4Analyses2 })

      const rotationSignals1 = [createMockRotationSignal('I001', '人工智能')]
      const rotationSignals2 = [createMockRotationSignal('I002', '新能源')]

      mockGenerateRotationSignals
        .mockReturnValueOnce(rotationSignals1)
        .mockReturnValueOnce(rotationSignals2)

      // 执行：并发调用
      const [result1, result2] = await Promise.all([
        fetchIndustryDashboardUseCase({ forceRefresh: true }),
        fetchIndustryDashboardUseCase({ forceRefresh: false }),
      ])

      // 验证：两个结果互不干扰
      expect(result1.success).toBe(true)
      expect(result1.v4Analyses).toHaveLength(1)
      expect(result1.v4Analyses[0]!.industryCode).toBe('I001')
      expect(result1.rotationSignals[0]!.industryCode).toBe('I001')

      expect(result2.success).toBe(true)
      expect(result2.v4Analyses).toHaveLength(1)
      expect(result2.v4Analyses[0]!.industryCode).toBe('I002')
      expect(result2.rotationSignals[0]!.industryCode).toBe('I002')

      // 验证 query 总共被调用 6 次（2次调用 × 3张表）
      expect(mockQuery).toHaveBeenCalledTimes(6)
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledTimes(2)
      expect(mockGenerateRotationSignals).toHaveBeenCalledTimes(2)
    })
  })

  describe('边界条件', () => {
    it('应当处理单只股票的场景', async () => {
      // 准备
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(mockRunFullIndustryAnalysisEnhanced).toHaveBeenCalledTimes(1)
      const callArg = mockRunFullIndustryAnalysisEnhanced.mock.calls[0]![0]
      expect(callArg).toHaveLength(1)
    })

    it('应当处理大量股票数据', async () => {
      // 准备：100 只股票
      const stocks: Stock[] = Array.from({ length: 100 }, (_, i) =>
        createMockStock(`${String(i + 1).padStart(6, '0')}.SZ`, `股票${i + 1}`, `I${String(i % 10).padStart(3, '0')}`)
      )
      const financials = stocks.map((s) => createMockFinancials(s.symbol)) as unknown as Array<Record<string, unknown>>
      const quotes = stocks.map((s) => createMockQuotes(s.symbol)) as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)
      mockDefaultAnalysis()

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(true)
      const callArg = mockRunFullIndustryAnalysisEnhanced.mock.calls[0]![0]
      expect(callArg).toHaveLength(100)
    })

    it('轮动信号应为空数组：generateRotationSignals 返回空', async () => {
      // 准备
      const stocks = [createMockStock('000001.SZ', '平安银行', 'I001')]
      const financials = [createMockFinancials('000001.SZ')] as unknown as Array<Record<string, unknown>>
      const quotes = [createMockQuotes('000001.SZ')] as unknown as Array<Record<string, unknown>>

      mockParallelQueryResults(stocks, financials, quotes)

      const v4Analyses = [createMockV4Analysis('I001', '人工智能')]
      mockRunFullIndustryAnalysisEnhanced.mockResolvedValue({
        aggregations: [],
        v4Analyses,
      })
      mockGenerateRotationSignals.mockReturnValue([])

      // 执行
      const result = await fetchIndustryDashboardUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.v4Analyses).toHaveLength(1)
      expect(result.rotationSignals).toHaveLength(0)
    })
  })
})
