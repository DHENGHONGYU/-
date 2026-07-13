import { describe, expect, it, vi, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { dataLayer } from '@/data/dataLayer'
import { STORE_NAME } from '@/config/dbConfig'
import { RESEARCH_STATUS } from '@/constants/pool.constants'
import { runIntelligentScore } from '@/services/scoring/intelligentScoreService'

vi.mock('@/services/llm/llmClient', () => ({
  chat: vi.fn(),
  LlmApiError: class LlmApiError extends Error {},
  LlmConfigError: class LlmConfigError extends Error {},
}))

import { chat } from '@/services/llm/llmClient'

const MOCK_LLM_CONFIG = {
  baseURL: 'https://api.test.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
}

function mockValidResponse() {
  return JSON.stringify({
    dimensions: [
      { name: '估值', score: 4.0, rationale: 'PE合理', evidence: ['基础数据: pe=15'] },
      { name: '成长', score: null, rationale: '数据缺失，未参与评分', evidence: [] },
      { name: '盈利', score: 3.5, rationale: 'ROE尚可', evidence: [] },
      { name: '质量', score: 3.0, rationale: '质量一般', evidence: [] },
      { name: '动量', score: 2.5, rationale: '动量偏弱', evidence: [] },
      { name: '波动', score: 2.0, rationale: '波动正常', evidence: [] },
      { name: '流动性', score: 4.5, rationale: '流动性好', evidence: [] },
      { name: '行业', score: null, rationale: '数据缺失，未参与评分', evidence: [] },
      { name: '情绪', score: 4.0, rationale: '情绪积极', evidence: [] },
    ],
    summary: '整体中性',
    basis: '基于基础数据和报告',
    missingFields: ['成长', '行业'],
  })
}

describe('intelligent score service', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.intelligentScores)
  })

  it('应该计算 overall score only from valid dimensions and save result', async () => {

    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      price: 12.5,
      pe: 15,
      pb: 1.2,
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    vi.mocked(chat).mockResolvedValueOnce({
      content: mockValidResponse(),
      model: 'test-model',
    })

    const file = new File(['季度营收增长 5%'], 'report.txt', { type: 'text/plain' })

    const result = await runIntelligentScore({
      symbol: '000001.SZ',
      files: [file],
      reportText: '银行业景气度平稳',
      llmConfig: MOCK_LLM_CONFIG,
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.overallScore).toBeCloseTo((4.0 + 3.5 + 3.0 + 2.5 + 2.0 + 4.5 + 4.0) / 7, 2)

    const saved = await dataLayer.intelligentScores.getLatestBySymbol('000001.SZ')
    expect(saved).toBeDefined()
    expect(saved?.symbol).toBe('000001.SZ')

    const nullDimensions = result.data?.dimensionScores.filter((d) => d.score === null) ?? []
    expect(nullDimensions.length).toBeGreaterThan(0)
  })

  it('应该返回 error when LLM config is missing', async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error('config missing'))

    const result = await runIntelligentScore({
      symbol: '000001.SZ',
      files: [],
      reportText: '',
      llmConfig: { baseURL: '', apiKey: '', model: '' },
    })

    expect(result.success).toBe(false)
  })
})
