/**
 * @test_id V9-TEST-ST-113
 * @module services/skills/selfPurificationSkill.test
 * @description S-16 SKILL 自我净化/迭代 SKILL 单元测试
  * @covers_docs [V9-DOC-AI-017, V9-DOC-AI-033]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/llm/llmGateway', () => ({
  chat: vi.fn(),
}))

import { chat as llmChat } from '@/services/llm/llmGateway'
import { SkillRegistry } from './skillRegistry'
import { selfPurificationSkill, type SelfPurificationOutput } from './selfPurificationSkill'

function buildMockResponse(overrides: Partial<SelfPurificationOutput> = {}): SelfPurificationOutput {
  return {
    iterationCount: 1,
    stopReason: 'no_issue',
    critique: '原始输出基本合理',
    issues: [],
    refinedOutput: { rating: 'buy', confidence: 0.85 },
    confidence: 0.85,
    rationale: '未发现明显问题',
    ...overrides,
  }
}

describe('selfPurificationSkill', () => {
  const registry = new SkillRegistry()
  registry.register(selfPurificationSkill)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应成功执行自净并返回修正后输出', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify(buildMockResponse()),
      parsed: buildMockResponse({
        critique: '缺少风险披露',
        issues: [
          { severity: 'medium', description: '未列出关键风险', suggestion: '补充行业政策风险' },
        ],
        refinedOutput: { rating: 'hold', confidence: 0.6 },
        confidence: 0.7,
        rationale: '降低评级以反映风险',
      }),
      model: 'test-model',
      usage: { promptTokens: 20, completionTokens: 20, totalTokens: 40 },
    })

    const result = await registry.execute<SelfPurificationOutput>('self-purification', {
      symbol: '600000',
      stockName: '浦发银行',
      params: {
        originalOutput: { rating: 'buy', confidence: 0.9 },
        originalSkillId: 'analysis-conclusion',
        originalEvidence: ['V6评分: buy', '最新财报超预期'],
      },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.issues.length).toBe(1)
    expect(result.data!.refinedOutput.rating).toBe('hold')
    expect(result.data!.confidence).toBe(0.7)
    expect(result.evidence).toContain('self-refine:iterationCount=1')
  })

  it('LLM 未返回结构化结果时应失败降级', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: '非结构化文本',
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    })

    const result = await registry.execute<SelfPurificationOutput>('self-purification', {
      symbol: '600000',
      params: {
        originalOutput: { rating: 'buy' },
      },
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('未返回结构化自净结果')
  })

  it('issues 为空时应以 no_issue 终止并只执行一轮', async () => {
    vi.mocked(llmChat).mockResolvedValue({
      content: JSON.stringify(buildMockResponse()),
      parsed: buildMockResponse({
        issues: [],
        stopReason: 'max_iterations',
      }),
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    })

    const result = await registry.execute<SelfPurificationOutput>('self-purification', {
      symbol: '600000',
      params: {
        originalOutput: { rating: 'buy' },
        maxIterations: 2,
      },
    })

    expect(result.status).toBe('success')
    expect(result.data!.stopReason).toBe('no_issue')
    expect(result.data!.iterationCount).toBe(1)
    expect(llmChat).toHaveBeenCalledTimes(1)
  })

  it('达到 maxIterations 时应以 max_iterations 终止', async () => {
    vi.mocked(llmChat)
      .mockResolvedValueOnce({
        content: JSON.stringify(buildMockResponse()),
        parsed: buildMockResponse({
          stopReason: 'max_iterations',
          issues: [
            { severity: 'low', description: '措辞可优化', suggestion: '使用更中性的表达' },
          ],
          refinedOutput: { rating: 'buy', confidence: 0.85 },
        }),
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(buildMockResponse()),
        parsed: buildMockResponse({
          stopReason: 'max_iterations',
          issues: [
            { severity: 'low', description: '仍可优化', suggestion: '继续打磨措辞' },
          ],
          refinedOutput: { rating: 'buy', confidence: 0.9 },
        }),
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      })

    const result = await registry.execute<SelfPurificationOutput>('self-purification', {
      symbol: '600000',
      params: {
        originalOutput: { rating: 'buy', confidence: 0.8 },
        maxIterations: 2,
      },
    })

    expect(result.status).toBe('success')
    expect(result.data!.stopReason).toBe('max_iterations')
    expect(result.data!.iterationCount).toBe(2)
    expect(llmChat).toHaveBeenCalledTimes(2)
  })
})
