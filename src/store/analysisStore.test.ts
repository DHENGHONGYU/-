/**
 * @test_id V9-TEST-ST-201
 * analysisStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. reset: 填充数据后重置回到初始值
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

vi.mock('@/services/analysis/analysisService', () => ({
  listStocks: vi.fn(),
  listV6Scores: vi.fn(),
}))

vi.mock('@/services/scoring/v6ScoreService', () => ({
  runV6Score: vi.fn(),
}))

vi.mock('@/services/analysis/scoreTrendService', () => ({
  loadIndustryScoreTrend: vi.fn(),
  loadStockScoreTrend: vi.fn(),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {},
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

// ============================================================
// Imports
// ============================================================

import { useAnalysisStore } from './analysisStore'
import { listStocks } from '@/services/analysis/analysisService'
import { runV6Score } from '@/services/scoring/v6ScoreService'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useAnalysisStore.getState().reset()
})

// ============================================================
// useAnalysisStore
// ============================================================

describe('useAnalysisStore', () => {
  // ---------- 初始状态 ----------

  it('初始状态验证', () => {
    const state = useAnalysisStore.getState()
    expect(state.stocks).toEqual([])
    expect(state.scores).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.trendData).toBeUndefined()
    expect(state.trendLoading).toBe(false)
    expect(state.trendError).toBeNull()
    expect(state.trendPeriod).toBe('month')
  })

  // ---------- reset ----------

  it('reset: 填充 stocks/scores/trendData 后重置回到初始值', () => {
    useAnalysisStore.setState({
      stocks: [{ symbol: '600519.SH', name: '贵州茅台' } as any],
      scores: [{ symbol: '600519.SH', score: 85 } as any],
      loading: true,
      error: '测试错误',
      trendData: { points: [], entityId: 'test', entityType: 'stock', period: 'month' } as any,
      trendLoading: true,
      trendError: '趋势错误',
      trendPeriod: 'quarter',
    })

    useAnalysisStore.getState().reset()

    const state = useAnalysisStore.getState()
    expect(state.stocks).toEqual([])
    expect(state.scores).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.trendData).toBeUndefined()
    expect(state.trendLoading).toBe(false)
    expect(state.trendError).toBeNull()
    expect(state.trendPeriod).toBe('month')
  })

  // ---------- loadStocks ----------

  it('loadStocks: mock 返回数据后 stocks 填充', async () => {
    const mockStocks = [
      { symbol: '600519.SH', name: '贵州茅台' },
      { symbol: '000858.SZ', name: '五粮液' },
    ]
    vi.mocked(listStocks).mockResolvedValue({ success: true, data: mockStocks as any })

    await useAnalysisStore.getState().loadStocks()

    const state = useAnalysisStore.getState()
    expect(state.stocks).toHaveLength(2)
    expect(state.stocks[0].symbol).toBe('600519.SH')
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadStocks: 失败时设置 error', async () => {
    vi.mocked(listStocks).mockResolvedValue({ success: false, error: '加载失败' })

    await useAnalysisStore.getState().loadStocks()

    const state = useAnalysisStore.getState()
    expect(state.stocks).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBe('加载失败')
  })

  // ---------- handleScore ----------

  it('handleScore: mock 返回评分后 scores 填充', async () => {
    const mockScore = { symbol: '600519.SH', score: 85, l1: 8, l2: 7 }
    vi.mocked(runV6Score).mockResolvedValue({ success: true, data: mockScore as any })

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.scores).toHaveLength(1)
    expect(state.scores[0].symbol).toBe('600519.SH')
    expect(state.loading).toBe(false)
  })

  it('handleScore: 已有评分时更新而非追加', async () => {
    useAnalysisStore.setState({
      scores: [{ symbol: '600519.SH', score: 70 } as any],
    })

    const updatedScore = { symbol: '600519.SH', score: 90 }
    vi.mocked(runV6Score).mockResolvedValue({ success: true, data: updatedScore as any })

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.scores).toHaveLength(1)
    expect(state.scores[0].score).toBe(90)
  })

  // ---------- clearError ----------

  it('clearError: 设置 error 后 clearError 断言 error=null', () => {
    useAnalysisStore.setState({ error: '测试错误' })
    expect(useAnalysisStore.getState().error).toBe('测试错误')

    useAnalysisStore.getState().clearError()

    expect(useAnalysisStore.getState().error).toBeNull()
  })
})
