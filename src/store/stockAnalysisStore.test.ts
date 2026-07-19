/**
 * @test_id V9-TEST-ST-157
 * @covers_docs [V9-DOC-PROJ-054, V9-DOC-PROJ-053, V9-DOC-PROJ-066, V9-DOC-ARCH-008, V9-DOC-FRONT-012]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Stock, DailyQuotes, V6Score } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockLoadStock = vi.hoisted(() => vi.fn())
const mockLoadQuotes = vi.hoisted(() => vi.fn())
const mockLoadV6Score = vi.hoisted(() => vi.fn())
const mockRunV6Score = vi.hoisted(() => vi.fn())

vi.mock('@/services/analysis/scorePageService', () => ({
  loadStockForAnalysis: mockLoadStock,
  loadDailyQuotesForAnalysis: mockLoadQuotes,
  loadV6ScoreForAnalysis: mockLoadV6Score,
}))

vi.mock('@/services/scoring/v6ScoreService', () => ({
  runV6Score: mockRunV6Score,
}))

// ============================================================
// Imports
// ============================================================

import { useStockAnalysisStore } from './stockAnalysisStore'

// ============================================================
// Helpers
// ============================================================

function createMockStock(symbol: string): Stock {
  return {
    symbol,
    name: symbol,
    pe: 10,
    pb: 1,
    roe: 15,
    marketCap: 1e12,
  } as Stock
}

function createMockQuotes(symbol: string): DailyQuotes {
  return {
    symbol,
    history: [
      { date: '2024-01-01', open: 10, high: 11, low: 9, close: 10.5, volume: 1000 },
    ],
  } as DailyQuotes
}

function createMockV6Score(symbol: string): V6Score {
  return {
    symbol,
    score: 85,
    factors: { momentum: 85, value: 85, quality: 85 },
    algorithmVersion: 'v6.3',
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useStockAnalysisStore.setState({
    selectedSymbol: null,
    stock: null,
    quotes: null,
    v6Score: null,
    loading: false,
    scoreLoading: false,
    error: null,
  })
})

// ============================================================
// useStockAnalysisStore
// ============================================================

describe('useStockAnalysisStore', () => {
  it('初始状态验证', () => {
    const state = useStockAnalysisStore.getState()
    expect(state.selectedSymbol).toBeNull()
    expect(state.stock).toBeNull()
    expect(state.quotes).toBeNull()
    expect(state.v6Score).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.scoreLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadStockAnalysis: 成功加载', async () => {
    mockLoadStock.mockResolvedValue(createMockStock('AAPL'))
    mockLoadQuotes.mockResolvedValue(createMockQuotes('AAPL'))
    mockLoadV6Score.mockResolvedValue(createMockV6Score('AAPL'))

    await useStockAnalysisStore.getState().loadStockAnalysis('AAPL')

    const state = useStockAnalysisStore.getState()
    expect(state.selectedSymbol).toBe('AAPL')
    expect(state.stock).not.toBeNull()
    expect(state.stock!.symbol).toBe('AAPL')
    expect(state.quotes).not.toBeNull()
    expect(state.v6Score).not.toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadStockAnalysis: 部分数据缺失时应设置为 null', async () => {
    mockLoadStock.mockResolvedValue(undefined)
    mockLoadQuotes.mockResolvedValue(undefined)
    mockLoadV6Score.mockResolvedValue(undefined)

    await useStockAnalysisStore.getState().loadStockAnalysis('UNKNOWN')

    const state = useStockAnalysisStore.getState()
    expect(state.selectedSymbol).toBe('UNKNOWN')
    expect(state.stock).toBeNull()
    expect(state.quotes).toBeNull()
    expect(state.v6Score).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadStockAnalysis: 异常应设置 error', async () => {
    mockLoadStock.mockRejectedValue(new Error('Network error'))

    await useStockAnalysisStore.getState().loadStockAnalysis('AAPL')

    const state = useStockAnalysisStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('Network error')
  })

  it('loadStockAnalysis: 非 Error 异常应转为字符串', async () => {
    mockLoadStock.mockRejectedValue('timeout')

    await useStockAnalysisStore.getState().loadStockAnalysis('AAPL')

    expect(useStockAnalysisStore.getState().error).toBe('timeout')
  })

  it('refreshScore: 成功重新计算评分', async () => {
    mockRunV6Score.mockResolvedValue({ success: true, data: createMockV6Score('AAPL') })
    mockLoadV6Score.mockResolvedValue(createMockV6Score('AAPL'))

    await useStockAnalysisStore.getState().refreshScore('AAPL')

    const state = useStockAnalysisStore.getState()
    expect(state.scoreLoading).toBe(false)
    expect(state.v6Score).not.toBeNull()
    expect(state.error).toBeNull()
  })

  it('refreshScore: runV6Score 返回失败应设置 error', async () => {
    mockRunV6Score.mockResolvedValue({ success: false, error: '计算失败' })

    await useStockAnalysisStore.getState().refreshScore('AAPL')

    const state = useStockAnalysisStore.getState()
    expect(state.scoreLoading).toBe(false)
    expect(state.error).toBe('计算失败')
  })

  it('refreshScore: runV6Score 返回无数据应设置 error', async () => {
    mockRunV6Score.mockResolvedValue({ success: true, data: null })

    await useStockAnalysisStore.getState().refreshScore('AAPL')

    expect(useStockAnalysisStore.getState().error).toBe('评分计算失败')
  })

  it('refreshScore: 异常应设置 error', async () => {
    mockRunV6Score.mockRejectedValue(new Error('Score error'))

    await useStockAnalysisStore.getState().refreshScore('AAPL')

    expect(useStockAnalysisStore.getState().scoreLoading).toBe(false)
    expect(useStockAnalysisStore.getState().error).toBe('Score error')
  })

  it('clear: 重置到初始状态', () => {
    useStockAnalysisStore.setState({
      selectedSymbol: 'AAPL',
      stock: createMockStock('AAPL'),
      quotes: createMockQuotes('AAPL'),
      v6Score: createMockV6Score('AAPL'),
      loading: true,
      scoreLoading: true,
      error: 'err',
    })

    useStockAnalysisStore.getState().clear()

    const state = useStockAnalysisStore.getState()
    expect(state.selectedSymbol).toBeNull()
    expect(state.stock).toBeNull()
    expect(state.quotes).toBeNull()
    expect(state.v6Score).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.scoreLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('setLoading: 更新 loading 状态', () => {
    useStockAnalysisStore.getState().setLoading(true)
    expect(useStockAnalysisStore.getState().loading).toBe(true)

    useStockAnalysisStore.getState().setLoading(false)
    expect(useStockAnalysisStore.getState().loading).toBe(false)
  })

  it('setError: 设置/清除 error', () => {
    useStockAnalysisStore.getState().setError('some error')
    expect(useStockAnalysisStore.getState().error).toBe('some error')

    useStockAnalysisStore.getState().setError(null)
    expect(useStockAnalysisStore.getState().error).toBeNull()
  })
})
