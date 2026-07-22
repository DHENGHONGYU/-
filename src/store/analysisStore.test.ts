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
})
