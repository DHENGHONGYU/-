/**
 * @module services/skills/analysisConclusionSkill.test
 * @description analysisConclusionSkill 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/llm/llmGateway', () => ({
  chat: vi.fn(),
}))

import { chat as llmChat } from '@/services/llm/llmGateway'
import { skillRegistry, analysisConclusionSkill, type AnalysisConclusionOutput } from './index'

skillRegistry.register(analysisConclusionSkill)

describe('analysisConclusionSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应成功执行并返回结构化结论', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify({
        rating: 'buy',
        summary: '基本面良好',
        keyRisks: ['风险1'],
        opportunities: ['机会1'],
        confidence: 0.85,
      }),
      parsed: {
        rating: 'buy',
        summary: '基本面良好',
        keyRisks: ['风险1'],
        opportunities: ['机会1'],
        confidence: 0.85,
      },
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    })

    const result = await skillRegistry.execute<AnalysisConclusionOutput>('analysis-conclusion', {
      symbol: '600000',
      stockName: '浦发银行',
      params: {
        v6Score: 4.2,
        v6Rating: 'buy',
        newsTitles: ['季报超预期'],
      },
    })

    expect(result.status).toBe('success')
    expect(result.data?.rating).toBe('buy')
    expect(result.data?.consistentWithV6).toBe(true)
  })

  it('parsed 缺失时应返回 failed', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: '非结构化文本',
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    })

    const result = await skillRegistry.execute<AnalysisConclusionOutput>('analysis-conclusion', {
      symbol: '600000',
      stockName: '浦发银行',
      params: {
        v6Score: 4.2,
        v6Rating: 'buy',
        newsTitles: ['季报超预期'],
      },
    })

    expect(result.status).toBe('failed')
    expect(result.rawText).toBe('非结构化文本')
  })
})
