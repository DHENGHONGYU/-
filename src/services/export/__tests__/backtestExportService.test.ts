/**
 * @test_id V9-TEST-ST-077
 * @covers_docs [V9-DOC-DATA-021, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-QA-010, V9-DOC-BACK-006]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { BacktestConfig, BacktestResult } from '@/store/backtestStore'
import {
  buildReportMeta,
  buildExcelSheets,
  exportBacktestReport,
} from '@/services/export/backtestExportService'
import { BACKTEST_STRATEGY_LABELS } from '@/constants/backtest.constants'

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))

const mockOutputBlob = vi.hoisted(() => vi.fn(() => new Blob(['pdf'])))
const mockText = vi.hoisted(() => vi.fn())
const mockSetFontSize = vi.hoisted(() => vi.fn())

const mockJsPDF = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210 } },
    setFontSize: mockSetFontSize,
    text: mockText,
    output: mockOutputBlob,
  })),
)

const mockAutoTable = vi.hoisted(() => vi.fn())

const mockBookNew = vi.hoisted(() => vi.fn(() => ({})))
const mockJsonToSheet = vi.hoisted(() => vi.fn(() => ({})))
const mockBookAppendSheet = vi.hoisted(() => vi.fn())
const mockWrite = vi.hoisted(() => vi.fn(() => new ArrayBuffer(8)))

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

vi.mock('jspdf', () => ({
  jsPDF: mockJsPDF,
}))

vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable,
}))

vi.mock('@e965/xlsx', () => ({
  utils: {
    book_new: mockBookNew,
    json_to_sheet: mockJsonToSheet,
    book_append_sheet: mockBookAppendSheet,
  },
  write: mockWrite,
}))

function createMockResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    totalReturn: 12.34,
    annualizedReturn: 8.5,
    maxDrawdown: 5.2,
    sharpeRatio: 1.23,
    winRate: 55,
    tradeCount: 10,
    profitTrades: 6,
    lossTrades: 4,
    avgProfit: 3.5,
    avgLoss: -2.1,
    pnlCurve: [1, 1.05, 1.1],
    trades: [
      {
        symbol: 'AAPL',
        direction: 'buy',
        price: 100,
        quantity: 10,
        date: '2026-01-01',
        pnl: 0,
        pnlPct: 0,
        reason: '策略信号买入',
      },
      {
        symbol: 'AAPL',
        direction: 'sell',
        price: 110,
        quantity: 10,
        date: '2026-01-02',
        pnl: 100,
        pnlPct: 10,
        reason: '策略信号卖出',
      },
    ],
    positions: [
      {
        symbol: 'AAPL',
        quantity: 0,
        avgCost: 100,
        currentPrice: 110,
        marketValue: 0,
        unrealizedPnL: 0,
      },
    ],
    dailyValues: [
      { date: '2026-01-01', totalValue: 1_000_000, cash: 900_000 },
      { date: '2026-01-02', totalValue: 1_100_000, cash: 1_100_000 },
    ],
    ...overrides,
  }
}

const mockConfig: BacktestConfig = {
  strategy: 'hot_sector',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  initialCapital: 1_000_000,
}

describe('backtestExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('buildReportMeta 使用策略标签与配置生成元数据', () => {
    const meta = buildReportMeta(mockConfig)

    expect(meta.strategy).toBe(BACKTEST_STRATEGY_LABELS.hot_sector)
    expect(meta.startDate).toBe('2026-01-01')
    expect(meta.endDate).toBe('2026-01-31')
    expect(meta.initialCapital).toBe(1_000_000)
    expect(meta.generatedAt).toBeDefined()
  })

  it('buildExcelSheets 生成四个 Sheet 的数据', () => {
    const result = createMockResult()
    const meta = buildReportMeta(mockConfig)
    const sheets = buildExcelSheets(result, meta)

    expect(sheets.summary.length).toBeGreaterThan(0)
    expect(sheets.summary.some((row) => row['项目'] === '策略')).toBe(true)
    expect(sheets.summary.some((row) => row['项目'] === '总收益')).toBe(true)

    expect(sheets.positions).toHaveLength(1)
    expect(sheets.positions[0]!['标的']).toBe('AAPL')

    expect(sheets.trades).toHaveLength(2)
    expect(sheets.trades[0]!['方向']).toBe('买入')
    expect(sheets.trades[1]!['方向']).toBe('卖出')

    expect(sheets.dailyValues).toHaveLength(2)
    expect(sheets.dailyValues[0]!['净值']).toBe(1)
  })

  it('buildExcelSheets 在缺失 positions / dailyValues 时返回空数组', () => {
    const result = createMockResult({ positions: undefined, dailyValues: undefined })
    const meta = buildReportMeta(mockConfig)
    const sheets = buildExcelSheets(result, meta)

    expect(sheets.positions).toEqual([])
    expect(sheets.dailyValues).toEqual([])
  })

  it('exportBacktestReport excel 动态加载 xlsx 并返回成功结果', async () => {
    const result = createMockResult()
    const exportResult = await exportBacktestReport(result, mockConfig, { format: 'excel' })

    expect(exportResult.success).toBe(true)
    expect(exportResult.filename).toContain('.xlsx')
    expect(mockBookNew).toHaveBeenCalled()
    expect(mockJsonToSheet).toHaveBeenCalled()
    expect(mockBookAppendSheet).toHaveBeenCalledTimes(4)
    expect(mockWrite).toHaveBeenCalled()
  })

  it('exportBacktestReport pdf 动态加载 jspdf 并调用 autoTable', async () => {
    const result = createMockResult()
    const exportResult = await exportBacktestReport(result, mockConfig, { format: 'pdf' })

    expect(exportResult.success).toBe(true)
    expect(exportResult.filename).toContain('.pdf')
    expect(mockJsPDF).toHaveBeenCalled()
    expect(mockAutoTable).toHaveBeenCalled()
    expect(mockOutputBlob).toHaveBeenCalledWith('blob')
  })

  it('exportBacktestReport 失败时返回错误信息', async () => {
    mockWrite.mockImplementationOnce(() => {
      throw new Error('xlsx write error')
    })

    const result = createMockResult()
    const exportResult = await exportBacktestReport(result, mockConfig, { format: 'excel' })

    expect(exportResult.success).toBe(false)
    expect(exportResult.error).toContain('xlsx write error')
  })
})
