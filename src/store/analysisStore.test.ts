/**
 * @test_id V9-TEST-ST-201
 * analysisStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. reset: 填充数据后重置回到初始值
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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
import { listStocks, listV6Scores } from '@/services/analysis/analysisService'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { loadIndustryScoreTrend, loadStockScoreTrend } from '@/services/analysis/scoreTrendService'
import { withBroadcast } from '@/store/helpers/withBroadcast'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useAnalysisStore.getState().reset()
})

// 清理订阅与 mock 残留，避免跨测试污染
afterEach(() => {
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

  // ---------- loadStocks 异常与边界分支 ----------

  it('loadStocks: 抛出 Error 异常时设置 error', async () => {
    vi.mocked(listStocks).mockRejectedValue(new Error('网络异常'))

    await useAnalysisStore.getState().loadStocks()

    const state = useAnalysisStore.getState()
    expect(state.stocks).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBe('网络异常')
  })

  it('loadStocks: 抛出非 Error 对象时使用默认 error 消息', async () => {
    vi.mocked(listStocks).mockRejectedValue('字符串错误')

    await useAnalysisStore.getState().loadStocks()

    const state = useAnalysisStore.getState()
    expect(state.loading).toBe(false)
    // 非 Error 走 fallback 分支
    expect(state.error).toBe('无法加载标的列表')
  })

  it('loadStocks: success=true 但 data 为空时走失败分支并使用默认消息', async () => {
    vi.mocked(listStocks).mockResolvedValue({ success: true } as any)

    await useAnalysisStore.getState().loadStocks()

    const state = useAnalysisStore.getState()
    expect(state.stocks).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBe('无法加载标的列表')
  })

  it('loadStocks: 失败且无 error 字段时使用默认消息', async () => {
    vi.mocked(listStocks).mockResolvedValue({ success: false } as any)

    await useAnalysisStore.getState().loadStocks()

    const state = useAnalysisStore.getState()
    expect(state.error).toBe('无法加载标的列表')
  })

  // ---------- handleScore 失败与异常分支 ----------

  it('handleScore: service 返回失败时设置 error', async () => {
    vi.mocked(runV6Score).mockResolvedValue({ success: false, error: '评分失败' })

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('评分失败')
    expect(state.scores).toEqual([])
  })

  it('handleScore: service 返回失败且无 error 时使用默认消息', async () => {
    vi.mocked(runV6Score).mockResolvedValue({ success: false } as any)

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.error).toBe('无法对 600519.SH 运行评分')
  })

  it('handleScore: 抛出 Error 异常时设置 error', async () => {
    vi.mocked(runV6Score).mockRejectedValue(new Error('评分异常'))

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('评分异常')
  })

  it('handleScore: 抛出非 Error 对象时使用默认消息', async () => {
    vi.mocked(runV6Score).mockRejectedValue('字符串错误')

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.error).toBe('无法对 600519.SH 运行评分')
  })

  it('handleScore: 已有其他评分时追加新评分而非替换', async () => {
    useAnalysisStore.setState({
      scores: [{ symbol: '000858.SZ', score: 70 } as any],
    })
    const newScore = { symbol: '600519.SH', score: 90 }
    vi.mocked(runV6Score).mockResolvedValue({ success: true, data: newScore as any })

    await useAnalysisStore.getState().handleScore('600519.SH')

    const state = useAnalysisStore.getState()
    expect(state.scores).toHaveLength(2)
    expect(state.scores.find((s) => s.symbol === '600519.SH')?.score).toBe(90)
    expect(state.scores.find((s) => s.symbol === '000858.SZ')?.score).toBe(70)
  })

  it('handleScore: 成功时调用 withBroadcast 广播事件', async () => {
    const mockScore = { symbol: '600519.SH', score: 85 }
    vi.mocked(runV6Score).mockResolvedValue({ success: true, data: mockScore as any })

    await useAnalysisStore.getState().handleScore('600519.SH')

    expect(withBroadcast).toHaveBeenCalledTimes(1)
  })

  // ---------- loadScores ----------

  it('loadScores: 成功时更新 scores 并广播事件', async () => {
    const mockScores = [
      { symbol: '600519.SH', score: 85 },
      { symbol: '000858.SZ', score: 80 },
    ]
    vi.mocked(listV6Scores).mockResolvedValue({ success: true, data: mockScores as any })

    await useAnalysisStore.getState().loadScores()

    const state = useAnalysisStore.getState()
    expect(state.scores).toHaveLength(2)
    expect(state.scores[0].symbol).toBe('600519.SH')
    expect(withBroadcast).toHaveBeenCalledTimes(1)
  })

  it('loadScores: 空数组数据时正常更新并广播', async () => {
    vi.mocked(listV6Scores).mockResolvedValue({ success: true, data: [] })

    await useAnalysisStore.getState().loadScores()

    const state = useAnalysisStore.getState()
    expect(state.scores).toEqual([])
    expect(withBroadcast).toHaveBeenCalledTimes(1)
  })

  it('loadScores: success=true 但 data 为空时不更新不广播', async () => {
    useAnalysisStore.setState({ scores: [{ symbol: '600519.SH', score: 85 } as any] })
    vi.mocked(listV6Scores).mockResolvedValue({ success: true } as any)

    await useAnalysisStore.getState().loadScores()

    const state = useAnalysisStore.getState()
    expect(state.scores).toHaveLength(1)
    expect(withBroadcast).not.toHaveBeenCalled()
  })

  it('loadScores: service 返回失败时不更新 scores 也不广播', async () => {
    useAnalysisStore.setState({ scores: [{ symbol: '600519.SH', score: 85 } as any] })
    vi.mocked(listV6Scores).mockResolvedValue({ success: false, error: '加载失败' })

    await useAnalysisStore.getState().loadScores()

    const state = useAnalysisStore.getState()
    expect(state.scores).toHaveLength(1)
    expect(state.error).toBeNull()
    expect(withBroadcast).not.toHaveBeenCalled()
  })

  it('loadScores: 抛出 Error 异常时不崩溃且不设置 error', async () => {
    vi.mocked(listV6Scores).mockRejectedValue(new Error('网络异常'))

    await useAnalysisStore.getState().loadScores()

    const state = useAnalysisStore.getState()
    expect(state.error).toBeNull()
  })

  it('loadScores: 抛出非 Error 异常时转为字符串不崩溃', async () => {
    vi.mocked(listV6Scores).mockRejectedValue('字符串错误')

    await useAnalysisStore.getState().loadScores()

    // loadScores 异常时只记录日志，不设置 error
    expect(useAnalysisStore.getState().error).toBeNull()
  })

  // ---------- setTrendPeriod ----------

  it('setTrendPeriod: 更新趋势周期为 quarter', () => {
    useAnalysisStore.getState().setTrendPeriod('quarter')
    expect(useAnalysisStore.getState().trendPeriod).toBe('quarter')
  })

  it('setTrendPeriod: 更新趋势周期为 week', () => {
    useAnalysisStore.getState().setTrendPeriod('week')
    expect(useAnalysisStore.getState().trendPeriod).toBe('week')
  })

  // ---------- loadTrend ----------

  it('loadTrend: industry 类型成功加载趋势数据', async () => {
    const mockTrendData = {
      entityId: 'AI',
      entityType: 'industry',
      period: 'month',
      points: [{ period: '2026-07', composite: 4.5, count: 3, dimensions: {} }],
    }
    vi.mocked(loadIndustryScoreTrend).mockResolvedValue({ success: true, data: mockTrendData as any })

    await useAnalysisStore.getState().loadTrend('AI', 'industry')

    const state = useAnalysisStore.getState()
    expect(state.trendData).toEqual(mockTrendData)
    expect(state.trendLoading).toBe(false)
    expect(state.trendError).toBeNull()
    expect(state.trendPeriod).toBe('month')
  })

  it('loadTrend: stock 类型成功加载趋势数据', async () => {
    const mockTrendData = {
      entityId: '600519.SH',
      entityType: 'stock',
      period: 'week',
      points: [{ period: '2026-W27', composite: 4.0, count: 2, dimensions: {} }],
    }
    vi.mocked(loadStockScoreTrend).mockResolvedValue({ success: true, data: mockTrendData as any })

    await useAnalysisStore.getState().loadTrend('600519.SH', 'stock', 'week')

    const state = useAnalysisStore.getState()
    expect(state.trendData).toEqual(mockTrendData)
    expect(state.trendLoading).toBe(false)
    expect(state.trendPeriod).toBe('week')
  })

  it('loadTrend: 未传 period 时使用当前 trendPeriod', async () => {
    useAnalysisStore.getState().setTrendPeriod('quarter')
    const mockTrendData = {
      entityId: '600519.SH',
      entityType: 'stock',
      period: 'quarter',
      points: [],
    }
    vi.mocked(loadStockScoreTrend).mockResolvedValue({ success: true, data: mockTrendData as any })

    await useAnalysisStore.getState().loadTrend('600519.SH', 'stock')

    // 验证使用当前 trendPeriod 调用 service
    expect(vi.mocked(loadStockScoreTrend)).toHaveBeenCalledWith('600519.SH', 'quarter')
    const state = useAnalysisStore.getState()
    expect(state.trendData).toEqual(mockTrendData)
    expect(state.trendPeriod).toBe('quarter')
  })

  it('loadTrend: 返回失败时设置 trendError', async () => {
    vi.mocked(loadIndustryScoreTrend).mockResolvedValue({ success: false, error: '趋势加载失败' })

    await useAnalysisStore.getState().loadTrend('AI', 'industry')

    const state = useAnalysisStore.getState()
    expect(state.trendData).toBeUndefined()
    expect(state.trendLoading).toBe(false)
    expect(state.trendError).toBe('趋势加载失败')
  })

  it('loadTrend: 返回失败且无 error 时使用默认消息', async () => {
    // 模拟既无 data 也无 error 的边界情况
    vi.mocked(loadIndustryScoreTrend).mockResolvedValue({ success: false } as any)

    await useAnalysisStore.getState().loadTrend('AI', 'industry')

    const state = useAnalysisStore.getState()
    expect(state.trendError).toBe('无法加载趋势数据')
  })

  it('loadTrend: 抛出 Error 异常时设置 trendError', async () => {
    vi.mocked(loadStockScoreTrend).mockRejectedValue(new Error('网络异常'))

    await useAnalysisStore.getState().loadTrend('600519.SH', 'stock')

    const state = useAnalysisStore.getState()
    expect(state.trendLoading).toBe(false)
    expect(state.trendError).toBe('网络异常')
  })

  it('loadTrend: 抛出非 Error 异常时使用默认 trendError', async () => {
    vi.mocked(loadStockScoreTrend).mockRejectedValue('字符串错误')

    await useAnalysisStore.getState().loadTrend('600519.SH', 'stock')

    const state = useAnalysisStore.getState()
    expect(state.trendError).toBe('无法加载趋势数据')
  })

  // ---------- clearTrendError ----------

  it('clearTrendError: 清空趋势错误', () => {
    useAnalysisStore.setState({ trendError: '某趋势错误' })
    expect(useAnalysisStore.getState().trendError).toBe('某趋势错误')

    useAnalysisStore.getState().clearTrendError()

    expect(useAnalysisStore.getState().trendError).toBeNull()
  })
})
