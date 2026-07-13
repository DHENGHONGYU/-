import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  FeedbackOrchestrator,
  setFeedbackServices,
  type FeedbackIssue,
} from './feedbackOrchestrator'
import { STORE_NAME } from '@/config/dbConfig'
import { RESEARCH_STATUS } from '@/constants/stockpool.constants'
import type { V6Score, Stock } from '@/data/types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// dataBridge 已被实现切换为 query 风格（原测试 mock 的 dataLayer 不再被使用）
const mockQuery = vi.hoisted(() => vi.fn())
const mockBroadcast = vi.hoisted(() => vi.fn())
vi.mock('./databridge', () => ({
  dataBridge: {
    query: mockQuery,
    broadcast: mockBroadcast,
  },
}))

// orchestrator 通过 setFeedbackServices 注入服务，不直接 import 业务模块
const mockGetV6ScoreQuality = vi.hoisted(() => vi.fn())
const mockRunV6Score = vi.hoisted(() => vi.fn())
const mockFetchBasic = vi.hoisted(() => vi.fn())
const mockFetchKline = vi.hoisted(() => vi.fn())
const mockFetchFinancial = vi.hoisted(() => vi.fn())

function makeScore(factors: Record<string, number>, extra: Partial<V6Score> = {}): V6Score {
  return {
    symbol: '600519.SH',
    score: 3.5,
    factors,
    calculatedAt: Date.now(),
    algorithmVersion: 'v6-engine-1.0',
    dataVersion: 1,
    ...extra,
  } as V6Score
}

function makeQuotes(updatedAt: number) {
  return {
    symbol: '600519.SH',
    latest: { date: '2026-01-01', open: 0, high: 0, low: 0, close: 0, volume: 0, amount: 0 },
    history: [],
    period: 'daily',
    adjust: 'qfq',
    updatedAt,
  }
}

describe('FeedbackOrchestrator', () => {
  let orchestrator: FeedbackOrchestrator

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
    mockBroadcast.mockReset()
    mockGetV6ScoreQuality.mockReset()
    mockRunV6Score.mockReset()
    mockFetchBasic.mockReset()
    mockFetchKline.mockReset()
    mockFetchFinancial.mockReset()

    // 默认质量计算：factor 数 * 10 作为 dataCompleteness（与真实实现口径一致）
    mockGetV6ScoreQuality.mockImplementation((_symbol: string, factors: Record<string, number>) => ({
      dataCompleteness: Object.keys(factors).length * 10,
      missingLayers: [],
      hasBasicData: Object.keys(factors).length >= 3,
    }))

    mockFetchBasic.mockResolvedValue({ success: true })
    mockFetchKline.mockResolvedValue({ success: true })
    mockFetchFinancial.mockResolvedValue({ success: true })
    mockRunV6Score.mockResolvedValue({
      success: true,
      data: makeScore({ l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 }),
    })

    setFeedbackServices({
      getV6ScoreQuality: mockGetV6ScoreQuality,
      runV6Score: mockRunV6Score,
      fetchStockBasic: mockFetchBasic,
      fetchStockKline: mockFetchKline,
      fetchFinancial: mockFetchFinancial,
    })

    // 默认 query 分流：按 store 返回合理数据
    mockQuery.mockImplementation((req: { store: string }) => {
      if (req.store === STORE_NAME.dailyQuotes) {
        // 行情时间早于评分时间，保证默认场景 freshness 校验通过
        return Promise.resolve({ success: true, data: makeQuotes(Date.now() - 3600000) })
      }
      if (req.store === STORE_NAME.stocks) {
        return Promise.resolve({ success: true, data: [] as Stock[] })
      }
      // v6Scores（默认返回完整因子，数据完整度达标）
      return Promise.resolve({
        success: true,
        data: makeScore({ l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 }),
      })
    })

    orchestrator = new FeedbackOrchestrator({ autoTrigger: true })
  })

  describe('detectIssues', () => {
    test('评分不存在时检测到 critical 问题', async () => {
      mockQuery.mockResolvedValue({ success: false, error: 'not found' })

      const issues = await orchestrator.detectIssues('600519.SH')

      expect(issues).toHaveLength(1)
      expect(issues[0]!.type).toBe('incomplete_score')
      expect(issues[0]!.severity).toBe('critical')
    })

    test('数据完整度低于阈值时检测到问题', async () => {
      mockQuery
        .mockResolvedValueOnce({ success: true, data: makeScore({ l0: 3, l1: 4 }) })
        .mockResolvedValueOnce({ success: true, data: makeQuotes(Date.now() - 3600000) })

      const issues = await orchestrator.detectIssues('600519.SH')

      expect(issues.some((i: FeedbackIssue) => i.type === 'incomplete_score')).toBe(true)
    })

    test('数据完整度达标时未检测到问题', async () => {
      mockQuery
        .mockResolvedValueOnce({
          success: true,
          data: makeScore({ l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 }),
        })
        .mockResolvedValueOnce({ success: true, data: makeQuotes(Date.now() - 3600000) })

      const issues = await orchestrator.detectIssues('600519.SH')

      expect(issues).toEqual([])
    })

    test('新鲜度违规时检测到 stale_data 问题', async () => {
      const scoreTime = Date.now() - 3600000
      const quotesTime = Date.now()
      mockQuery
        .mockResolvedValueOnce({
          success: true,
          data: makeScore({ l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 }, { calculatedAt: scoreTime }),
        })
        .mockResolvedValueOnce({ success: true, data: makeQuotes(quotesTime) })

      const issues = await orchestrator.detectIssues('600519.SH')

      expect(issues.some((i: FeedbackIssue) => i.type === 'stale_data')).toBe(true)
    })

    test('存在 qualityWarning 时检测到问题', async () => {
      mockQuery
        .mockResolvedValueOnce({
          success: true,
          data: makeScore({ l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 }, { qualityWarning: '数据完整度 70%' }),
        })
        .mockResolvedValueOnce({ success: true, data: makeQuotes(Date.now() - 3600000) })

      const issues = await orchestrator.detectIssues('600519.SH')

      expect(issues.some((i: FeedbackIssue) => i.type === 'quality_warning')).toBe(true)
    })
  })

  describe('checkAndTrigger', () => {
    test('无问题时返回成功', async () => {
      const result = await orchestrator.checkAndTrigger('600519.SH')

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.reFetched).toBe(false)
      expect(result.reScored).toBe(false)
    })

    test('检测到问题时自动触发反馈循环', async () => {
      // detectIssues 第一次（v6Scores）返回不完整因子触发问题，dailyQuotes 正常；
      // executeFeedbackLoop 内二次检测使用 beforeEach 默认实现（完整因子）
      mockQuery
        .mockResolvedValueOnce({ success: true, data: makeScore({ l0: 3, l1: 4 }) })
        .mockResolvedValueOnce({ success: true, data: makeQuotes(Date.now()) })

      const result = await orchestrator.checkAndTrigger('600519.SH')

      expect(result.reFetched).toBe(true)
      expect(result.reScored).toBe(true)
      expect(mockFetchBasic).toHaveBeenCalled()
      expect(mockFetchKline).toHaveBeenCalled()
      expect(mockFetchFinancial).toHaveBeenCalled()
      expect(mockRunV6Score).toHaveBeenCalled()
    })

    test('autoTrigger=false 时不触发修复', async () => {
      const orchestratorNoAuto = new FeedbackOrchestrator({ autoTrigger: false })
      mockQuery.mockResolvedValue({ success: true, data: makeScore({ l0: 3, l1: 4 }) })

      const result = await orchestratorNoAuto.checkAndTrigger('600519.SH')

      expect(result.reFetched).toBe(false)
      expect(result.reScored).toBe(false)
      expect(mockFetchBasic).not.toHaveBeenCalled()
      expect(mockRunV6Score).not.toHaveBeenCalled()
    })

    test('并行处理同一 symbol 时跳过', async () => {
      orchestrator.checkAndTrigger('600519.SH')
      const result2 = await orchestrator.checkAndTrigger('600519.SH')

      expect(result2.success).toBe(false)
      expect(result2.message).toBe('正在处理中')
    })
  })

  describe('checkAllStocks', () => {
    test('批量检查所有股票', async () => {
      mockQuery.mockResolvedValueOnce({
        success: true,
        data: [
          { symbol: '600519.SH', name: '贵州茅台', researchStatus: RESEARCH_STATUS.candidate, source: 'manual', dataVersion: 1 } as unknown as Stock,
          { symbol: '000001.SZ', name: '平安银行', researchStatus: RESEARCH_STATUS.candidate, source: 'manual', dataVersion: 1 } as unknown as Stock,
        ],
      })

      const results = await orchestrator.checkAllStocks()

      expect(results).toHaveProperty('600519.SH')
      expect(results).toHaveProperty('000001.SZ')
    })
  })
})
