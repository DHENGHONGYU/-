import { describe, test, expect, vi, beforeEach } from 'vitest'
import { FeedbackOrchestrator } from './feedbackOrchestrator'
import { dataLayer } from '@/data/dataLayer'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { fetchStockBasic, fetchStockKline, fetchFinancial } from '@/services/fetcher/fetcherService'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    v6Scores: {
      get: vi.fn(),
      list: vi.fn(),
    },
    dailyQuotes: {
      get: vi.fn(),
    },
    stocks: {
      list: vi.fn(),
    },
  },
}))

vi.mock('@/services/scoring/v6ScoreService', () => ({
  runV6Score: vi.fn(),
  getV6ScoreQuality: vi.fn((_symbol: string, factors: Record<string, number>) => ({
    dataCompleteness: Object.keys(factors).length * 10,
    hasQuotes: true,
    hasBasicData: Object.keys(factors).length >= 3,
    missingLayers: [],
  })),
}))

vi.mock('@/services/fetcher/fetcherService', () => ({
  fetchStockBasic: vi.fn().mockResolvedValue({ success: true }),
  fetchStockKline: vi.fn().mockResolvedValue({ success: true }),
  fetchFinancial: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('./databridge', () => ({
  dataBridge: {
    broadcast: vi.fn(),
  },
}))

describe('FeedbackOrchestrator', () => {
  let orchestrator: FeedbackOrchestrator

  beforeEach(() => {
    vi.clearAllMocks()
    orchestrator = new FeedbackOrchestrator({ autoTrigger: true })
  })

  describe('detectIssues', () => {
    test('评分不存在时检测到 critical 问题', async () => {
      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(undefined)

      const issues = await (orchestrator as any).detectIssues('600519.SH')

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('incomplete_score')
      expect(issues[0].severity).toBe('critical')
    })

    test('数据完整度低于阈值时检测到问题', async () => {
      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4 },
        calculatedAt: Date.now(),
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
      })

      const issues = await (orchestrator as any).detectIssues('600519.SH')

      expect(issues.some((i: any) => i.type === 'incomplete_score')).toBe(true)
    })

    test('数据完整度达标时未检测到问题', async () => {
      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
        calculatedAt: Date.now(),
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
      })

      const issues = await (orchestrator as any).detectIssues('600519.SH')

      expect(issues.length).toBe(0)
    })

    test('新鲜度违规时检测到 stale_data 问题', async () => {
      const scoreTime = Date.now() - 3600000
      const quotesTime = Date.now()

      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
        calculatedAt: scoreTime,
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
      })

      vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue({
        symbol: '600519.SH',
        latest: { date: '2026-01-01', open: 0, high: 0, low: 0, close: 0, volume: 0 } as any,
        history: [],
        period: 'daily',
        adjust: 'qfq',
        updatedAt: quotesTime,
      } as any)

      const issues = await (orchestrator as any).detectIssues('600519.SH')

      expect(issues.some((i: any) => i.type === 'stale_data')).toBe(true)
    })

    test('存在 qualityWarning 时检测到问题', async () => {
      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
        calculatedAt: Date.now(),
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
        qualityWarning: '数据完整度 70%',
      })

      const issues = await (orchestrator as any).detectIssues('600519.SH')

      expect(issues.some((i: any) => i.type === 'quality_warning')).toBe(true)
    })
  })

  describe('checkAndTrigger', () => {
    test('无问题时返回成功', async () => {
      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
        calculatedAt: Date.now(),
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
      })

      const result = await orchestrator.checkAndTrigger('600519.SH')

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.reFetched).toBe(false)
      expect(result.reScored).toBe(false)
    })

    test('检测到问题时自动触发反馈循环', async () => {
      vi.mocked(dataLayer.v6Scores.get)
        .mockResolvedValueOnce({
          symbol: '600519.SH',
          score: 3.5,
          factors: { l0: 3, l1: 4 },
          calculatedAt: Date.now(),
          algorithmVersion: 'v6-engine-1.0',
          dataVersion: 1,
        })
        .mockResolvedValueOnce({
          symbol: '600519.SH',
          score: 4.0,
          factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
          calculatedAt: Date.now(),
          algorithmVersion: 'v6-engine-1.0',
          dataVersion: 1,
        })

      vi.mocked(runV6Score).mockResolvedValue({
        success: true,
        data: {
          symbol: '600519.SH',
          score: 4.0,
          factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
          calculatedAt: Date.now(),
          algorithmVersion: 'v6-engine-1.0',
          dataVersion: 1,
        },
      })

      const result = await orchestrator.checkAndTrigger('600519.SH')

      expect(result.reFetched).toBe(true)
      expect(result.reScored).toBe(true)
      expect(fetchStockBasic).toHaveBeenCalled()
      expect(fetchStockKline).toHaveBeenCalled()
      expect(fetchFinancial).toHaveBeenCalled()
      expect(runV6Score).toHaveBeenCalled()
    })

    test('autoTrigger=false 时不触发修复', async () => {
      const orchestratorNoAuto = new FeedbackOrchestrator({ autoTrigger: false })

      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4 },
        calculatedAt: Date.now(),
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
      })

      const result = await orchestratorNoAuto.checkAndTrigger('600519.SH')

      expect(result.reFetched).toBe(false)
      expect(result.reScored).toBe(false)
      expect(fetchStockBasic).not.toHaveBeenCalled()
      expect(runV6Score).not.toHaveBeenCalled()
    })

    test('并行处理同一 symbol 时跳过', async () => {
      vi.mocked(dataLayer.v6Scores.get).mockResolvedValue({
        symbol: '600519.SH',
        score: 3.5,
        factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
        calculatedAt: Date.now(),
        algorithmVersion: 'v6-engine-1.0',
        dataVersion: 1,
      })

      orchestrator.checkAndTrigger('600519.SH')
      const result2 = await orchestrator.checkAndTrigger('600519.SH')

      expect(result2.success).toBe(false)
      expect(result2.message).toBe('正在处理中')
    })
  })

  describe('checkAllStocks', () => {
    test('批量检查所有股票', async () => {
      vi.mocked(dataLayer.stocks.list).mockResolvedValue([
        { symbol: '600519.SH', name: '贵州茅台', researchStatus: 'pending', source: 'manual', dataVersion: 1 } as any,
        { symbol: '000001.SZ', name: '平安银行', researchStatus: 'pending', source: 'manual', dataVersion: 1 } as any,
      ])

      vi.mocked(dataLayer.v6Scores.get)
        .mockResolvedValueOnce({
          symbol: '600519.SH',
          score: 3.5,
          factors: { l0: 3, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4, lMinus1: 4 },
          calculatedAt: Date.now(),
          algorithmVersion: 'v6-engine-1.0',
          dataVersion: 1,
        })
        .mockResolvedValueOnce({
          symbol: '000001.SZ',
          score: 2.5,
          factors: { l0: 2 },
          calculatedAt: Date.now(),
          algorithmVersion: 'v6-engine-1.0',
          dataVersion: 1,
        })

      const results = await orchestrator.checkAllStocks()

      expect(results).toHaveProperty('600519.SH')
      expect(results).toHaveProperty('000001.SZ')
    })
  })
})