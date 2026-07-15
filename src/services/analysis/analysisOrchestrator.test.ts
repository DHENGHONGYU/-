/**
 * @fileoverview AnalysisOrchestrator 单元测试
 *
 * @module services/analysis/analysisOrchestrator.test
 * @created 2026-07-13 B1/B2 阶段
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { QueryRequest } from '@/core/databridge'

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn(),
    forward: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn(),
    invalidateCache: vi.fn(),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, payload: unknown) => ({ meta, payload })),
  },
}))

vi.mock('@/services/news/newsService', () => ({
  getNewsBySymbol: vi.fn(),
}))

vi.mock('@/services/llm/llmGateway', () => ({
  chat: vi.fn(),
}))

vi.mock('@/core/feedbackOrchestrator', () => ({
  feedbackOrchestrator: {
    checkAndTrigger: vi.fn(),
  },
}))

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getNewsBySymbol } from '@/services/news/newsService'
import { chat as llmChat } from '@/services/llm/llmGateway'
import { feedbackOrchestrator } from '@/core/feedbackOrchestrator'
import { runAnalysis } from '@/services/analysis/analysisOrchestrator'

function mockStock() {
  return { symbol: '600000', name: '浦发银行', sector: '银行', pool: 'research' }
}

function mockV6Score() {
  return {
    symbol: '600000',
    score: 4.2,
    factors: { f1: 0.8, f2: 0.9 },
    algorithmVersion: 'v6.1',
    calculatedAt: Date.now(),
    dataVersion: 1,
    rating: 'buy' as const,
  }
}

function mockNewsArticles() {
  return [
    {
      id: 'n1',
      title: '浦发银行季报超预期',
      content: '浦发银行发布2026年Q2财报，净利润同比增长15%...',
      url: 'https://example.com/n1',
      source: '财经网',
      category: '财报',
      publishTime: '2026-07-13',
      fetchTime: '2026-07-13',
      sentiment: 'positive' as const,
      sentimentConfidence: 0.9,
      relatedStocks: ['600000'],
      keywords: ['银行', '财报'],
      hash: 'test-hash-1',
    },
  ]
}

function mockLlmJsonResponse(rating: string = 'buy') {
  const parsed = {
    rating,
    summary: '基本面良好，估值合理',
    keyRisks: ['宏观经济下行风险'],
    opportunities: ['利率政策利好'],
    confidence: 0.85,
  }
  return {
    content: JSON.stringify(parsed),
    parsed,
    model: 'test-model',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  }
}

function mockLlmNonJsonResponse() {
  return {
    content: '这是一段非JSON格式的分析文本，无法解析。',
    model: 'test-model',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  }
}

function mockFeedbackOk() {
  return {
    success: true,
    symbol: '600000',
    issues: [],
    reScored: false,
    reFetched: false,
    message: '数据质量检查通过',
  }
}

function mockFeedbackWithIssues() {
  return {
    success: false,
    symbol: '600000',
    issues: [
      { type: 'incomplete_score' as const, severity: 'high' as const, symbol: '600000', details: {}, timestamp: Date.now() },
    ],
    reScored: false,
    reFetched: false,
    message: '检测到 1 个问题',
  }
}

function setupDefaultQueryMock() {
  vi.mocked(dataBridge.query).mockImplementation((req: QueryRequest) => {
    if (req.store === 'stocks') {
      return Promise.resolve({ success: true, data: mockStock() })
    }
    if (req.store === 'v6_scores') {
      return Promise.resolve({ success: true, data: mockV6Score() })
    }
    return Promise.resolve({ success: false, error: 'unknown store' })
  })
}

describe('AnalysisOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultQueryMock()
    vi.mocked(getNewsBySymbol).mockResolvedValue({ success: true, data: mockNewsArticles() })
    vi.mocked(feedbackOrchestrator.checkAndTrigger).mockResolvedValue(mockFeedbackOk() as any)
  })

  describe('runAnalysis - happy path', () => {
    it('应返回结构化结论并持久化结果', async () => {
      vi.mocked(llmChat).mockResolvedValue(mockLlmJsonResponse('buy'))

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.success).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data?.symbol).toBe('600000')
      expect(res.data?.conclusion).toBeDefined()
      expect(res.data?.conclusion?.rating).toBe('buy')
      expect(res.data?.conclusion?.consistentWithV6).toBe(true)
      expect(res.data?.reasonableness.passed).toBe(true)
      expect(res.data?.feedbackLoop.triggered).toBe(true)
      expect(res.data?.feedbackLoop.issueCount).toBe(0)
      expect(dataBridge.forward).toHaveBeenCalledTimes(1)
      expect(EnvelopeFactory.create).toHaveBeenCalledTimes(1)
      // P1-5: 反馈后应清除缓存
      expect(dataBridge.invalidateCache).toHaveBeenCalled()
    })
  })

  describe('runAnalysis - non-JSON LLM response', () => {
    it('非JSON响应时应优雅降级且结论为空', async () => {
      vi.mocked(llmChat).mockResolvedValue(mockLlmNonJsonResponse())

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.success).toBe(true)
      expect(res.data?.conclusion).toBeUndefined()
      expect(res.data?.rawLlmText).toBe('这是一段非JSON格式的分析文本，无法解析。')
      expect(res.data?.reasonableness.passed).toBe(false)
    })
  })

  describe('runAnalysis - K=2 rollback cap', () => {
    it('最多调用 K+1 次 checkAndTrigger', async () => {
      vi.mocked(llmChat).mockResolvedValue(mockLlmJsonResponse('sell'))
      vi.mocked(feedbackOrchestrator.checkAndTrigger).mockResolvedValue(mockFeedbackWithIssues() as any)

      const res = await runAnalysis({ symbol: '600000', maxReAnalysis: 2 })

      expect(res.success).toBe(true)
      expect(feedbackOrchestrator.checkAndTrigger).toHaveBeenCalledTimes(3)
      expect(res.data?.reasonableness.passed).toBe(false)
    })
  })

  describe('runAnalysis - feedback throws', () => {
    it('反馈异常时应静默跳过并仍返回结果', async () => {
      vi.mocked(llmChat).mockResolvedValue(mockLlmJsonResponse('buy'))
      vi.mocked(feedbackOrchestrator.checkAndTrigger).mockRejectedValue(new Error('feedback service down'))

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.success).toBe(true)
      expect(res.data?.feedbackLoop.triggered).toBe(false)
      expect(res.data?.feedbackLoop.message).toContain('异常')
      expect(res.data?.reasonableness.passed).toBe(true)
    })
  })

  describe('runAnalysis - Batch A 结构化输出边界用例', () => {
    it('应使用 LLM 返回的 parsed 结构化数据', async () => {
      vi.mocked(llmChat).mockResolvedValue({
        content: JSON.stringify({ rating: 'hold', summary: '中性', keyRisks: [], opportunities: [], confidence: 0.7 }),
        parsed: { rating: 'hold', summary: '中性', keyRisks: [], opportunities: [], confidence: 0.7 },
        model: 'test',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      })

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.data?.conclusion).toBeDefined()
      expect(res.data?.conclusion?.rating).toBe('hold')
      expect(res.data?.conclusion?.summary).toBe('中性')
      expect(res.data?.conclusion?.confidence).toBe(0.7)
    })

    it('parsed 缺失时应降级', async () => {
      vi.mocked(llmChat).mockResolvedValue({
        content: JSON.stringify({ rating: 'sell', summary: '高估', keyRisks: ['估值过高'], opportunities: [] }),
        model: 'test',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      })

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.data?.conclusion).toBeUndefined()
    })

    it('评分值无效导致 Schema 校验失败时应降级', async () => {
      vi.mocked(llmChat).mockResolvedValue({
        content: JSON.stringify({ rating: 'unknown', summary: '', keyRisks: [], opportunities: [] }),
        parsed: { rating: 'unknown', summary: '', keyRisks: [], opportunities: [] },
        model: 'test',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      })

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.data?.conclusion).toBeUndefined()
    })

    it('LLM 返回空时应降级', async () => {
      vi.mocked(llmChat).mockResolvedValue({
        content: '',
        model: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      })

      const res = await runAnalysis({ symbol: '600000' })

      expect(res.data?.conclusion).toBeUndefined()
      expect(res.data?.rawLlmText).toBe('')
    })
  })
})
