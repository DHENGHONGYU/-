/**
 * @module services/skills/batchDSkills.test
 * @description Batch D LLM 层 SKILL 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/llm/llmGateway', () => ({
  chat: vi.fn(),
}))

import { chat as llmChat } from '@/services/llm/llmGateway'
import { SkillRegistry } from './skillRegistry'
import {
  macroScanSkill,
  moatAnalysisSkill,
  peerCompetitionSkill,
  scenarioForecastingSkill,
  techMarketMatrixSkill,
  hypeCycleSkill,
  secondCurveSkill,
  sentimentAnalysisSkill,
  bullBearDebateSkill,
} from './index'
import type { LayerAnalysisOutput } from './layerAnalysisSkillFactory'
import type { SentimentAnalysisOutput } from './sentimentAnalysisSkill'
import type { BullBearDebateOutput } from './bullBearDebateSkill'

function buildLayerOutput(overrides: Partial<LayerAnalysisOutput> = {}): LayerAnalysisOutput {
  return {
    layerId: 'l0',
    score: 3.5,
    summary: '测试总结',
    keyPoints: ['要点1'],
    risks: ['风险1'],
    opportunities: ['机会1'],
    confidence: 0.8,
    citations: [{ source: '测试', content: '引用' }],
    ...overrides,
  }
}

function buildSentimentOutput(): SentimentAnalysisOutput {
  return {
    sentimentScore: 0.3,
    bullishIntensity: 0.6,
    bearishIntensity: 0.2,
    heatScore: 0.5,
    summary: '情绪中性偏多',
    keyTopics: ['AI', '财报'],
    risks: ['估值偏高'],
    opportunities: ['业绩超预期'],
    confidence: 0.75,
    citations: [{ source: '新闻', content: '某AI公司财报超预期' }],
  }
}

function buildDebateOutput(): BullBearDebateOutput {
  return {
    bullArgument: {
      side: 'bull',
      thesis: '业绩高增',
      keyPoints: ['营收翻倍'],
      evidence: ['财报超预期'],
      risks: ['估值贵'],
      confidence: 0.7,
      citations: [{ source: '财报', content: '营收翻倍' }],
    },
    bearArgument: {
      side: 'bear',
      thesis: '竞争加剧',
      keyPoints: ['毛利率下滑'],
      evidence: ['行业价格战'],
      risks: ['份额流失'],
      confidence: 0.6,
      citations: [{ source: '研报', content: '价格战' }],
    },
    verdict: 'neutral',
    reasoning: '多空因素相对均衡',
    confidence: 0.65,
  }
}

describe('Batch D LLM layer skills', () => {
  const registry = new SkillRegistry()
  const skills = [
    macroScanSkill,
    moatAnalysisSkill,
    peerCompetitionSkill,
    scenarioForecastingSkill,
    techMarketMatrixSkill,
    hypeCycleSkill,
    secondCurveSkill,
    sentimentAnalysisSkill,
    bullBearDebateSkill,
  ]
  registry.registerAll(skills)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应注册全部 9 个 Batch D SKILL', () => {
    const list = registry.list()
    expect(list).toContain('macro-scan')
    expect(list).toContain('moat-analysis')
    expect(list).toContain('peer-competition')
    expect(list).toContain('scenario-forecasting')
    expect(list).toContain('tech-market-matrix')
    expect(list).toContain('hype-cycle')
    expect(list).toContain('second-curve')
    expect(list).toContain('sentiment-analysis')
    expect(list).toContain('bull-bear-debate')
  })

  it('macro-scan 应返回结构化层分析结果', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify(buildLayerOutput({ layerId: 'l0' })),
      parsed: buildLayerOutput({ layerId: 'l0' }),
      model: 'test-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })

    const result = await registry.execute<LayerAnalysisOutput>('macro-scan', {
      symbol: '600000',
      stockName: '浦发银行',
      params: { baseScore: 3.0, evidence: ['GDP 增速稳定'], newsTitles: ['降准落地'] },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.layerId).toBe('l0')
    expect(result.data!.score).toBeGreaterThanOrEqual(0)
    expect(result.data!.score).toBeLessThanOrEqual(5)
    expect(result.evidence).toContain('llm-layer:l0')
  })

  it('second-curve 应正确绑定 layerId', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify(buildLayerOutput({ layerId: 'l7', score: 4.0 })),
      parsed: buildLayerOutput({ layerId: 'l7', score: 4.0 }),
      model: 'test-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })

    const result = await registry.execute<LayerAnalysisOutput>('second-curve', {
      symbol: '300750',
      params: { baseScore: 4.0, evidence: ['在手订单覆盖 2x 营收'] },
    })

    expect(result.status).toBe('success')
    expect(result.data!.layerId).toBe('l7')
    expect(result.data!.score).toBe(4.0)
  })

  it('sentiment-analysis 应返回情绪结构', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify(buildSentimentOutput()),
      parsed: buildSentimentOutput(),
      model: 'test-model',
      usage: { promptTokens: 80, completionTokens: 40, totalTokens: 120 },
    })

    const result = await registry.execute<SentimentAnalysisOutput>('sentiment-analysis', {
      symbol: '300750',
      params: {
        newsTitles: ['某公司发布超预期财报'],
        socialSnippets: ['机构看好'],
      },
    })

    expect(result.status).toBe('success')
    expect(result.data!.sentimentScore).toBe(0.3)
    expect(result.data!.citations.length).toBeGreaterThan(0)
    expect(result.evidence).toContain('llm-sentiment')
  })

  it('bull-bear-debate 应返回多空双方论证与裁决', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify(buildDebateOutput()),
      parsed: buildDebateOutput(),
      model: 'test-model',
      usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
    })

    const result = await registry.execute<BullBearDebateOutput>('bull-bear-debate', {
      symbol: '600000',
      params: {
        newsTitles: ['降准利好银行', '息差承压'],
        bullPoints: ['估值低'],
        bearPoints: ['资产质量隐忧'],
      },
    })

    expect(result.status).toBe('success')
    expect(result.data!.verdict).toBe('neutral')
    expect(result.data!.bullArgument.side).toBe('bull')
    expect(result.data!.bearArgument.side).toBe('bear')
    expect(result.evidence).toContain('llm-bull-bear-debate')
  })

  it('LLM 未返回结构化结果时应失败降级', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: '非结构化文本',
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    })

    const result = await registry.execute<LayerAnalysisOutput>('macro-scan', {
      symbol: '600000',
      params: {},
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('未返回结构化')
  })
})
