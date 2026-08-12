/**
 * @test_id V9-TEST-ST-074
 * @module services/evaluators/evaluators.test
 * @description Batch C 评估体系单元测试
  * @covers_docs []
*/

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  schemaEvaluator,
  rubricEvaluator,
  consistencyEvaluator,
  regressionEvaluator,
} from './index'
import type { SkillResult } from '@/services/skills'

describe('schemaEvaluator', () => {
  const TestSchema = z.object({
    rating: z.enum(['buy', 'hold', 'sell']),
    confidence: z.number().min(0).max(1),
  })

  it('符合 Schema 时应通过', async () => {
    const result = await schemaEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy', confidence: 0.85 },
      params: { schema: TestSchema },
    })

    expect(result.status).toBe('passed')
    expect(result.score).toBe(1)
    expect(result.issues).toHaveLength(0)
    expect(result.metrics?.find(m => m.name === 'schemaErrors')?.value).toBe(0)
  })

  it('不符合 Schema 时应失败并列出错误字段', async () => {
    const result = await schemaEvaluator({
      symbol: 'TEST',
      actual: { rating: 'unknown', confidence: 1.5 },
      params: { schema: TestSchema },
    })

    expect(result.status).toBe('failed')
    expect(result.score).toBe(0)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.metrics?.find(m => m.name === 'schemaErrors')?.value).toBeGreaterThan(0)
  })

  it('未传入 Schema 时应失败降级', async () => {
    const result = await schemaEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy' },
    })

    expect(result.status).toBe('failed')
    expect(result.score).toBe(0)
    expect(result.issues[0]?.message).toContain('缺少 params.schema')
  })
})

describe('rubricEvaluator', () => {
  const criteria = [
    { id: 'confidence', description: '置信度不低于 0.7', weight: 0.5, path: 'confidence', operator: 'gte' as const, threshold: 0.7 },
    { id: 'risks', description: '至少列出 2 条风险', weight: 0.3, path: 'keyRisks', operator: 'lengthGte' as const, threshold: 2 },
    { id: 'summary', description: '必须包含总结', weight: 0.2, path: 'summary', operator: 'notEmpty' as const },
  ]

  it('全部满足时应通过', async () => {
    const result = await rubricEvaluator({
      symbol: 'TEST',
      actual: { confidence: 0.8, keyRisks: ['政策风险', '市场风险'], summary: '看好' },
      params: { criteria, threshold: 0.7 },
    })

    expect(result.status).toBe('passed')
    expect(result.score).toBe(1)
    expect(result.issues).toHaveLength(0)
  })

  it('部分满足时应为 partial', async () => {
    const result = await rubricEvaluator({
      symbol: 'TEST',
      actual: { confidence: 0.6, keyRisks: ['政策风险'], summary: '看好' },
      params: { criteria, threshold: 0.7 },
    })

    expect(result.status).toBe('partial')
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(0.7)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('未传入 criteria 时应失败降级', async () => {
    const result = await rubricEvaluator({
      symbol: 'TEST',
      actual: { confidence: 0.9 },
    })

    expect(result.status).toBe('failed')
    expect(result.score).toBe(0)
    expect(result.issues[0]?.message).toContain('缺少评分细则')
  })
})

describe('consistencyEvaluator', () => {
  it('expected 一致时应通过', async () => {
    const result = await consistencyEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy', confidence: 0.8 },
      expected: { rating: 'buy' },
      params: {
        rules: [
          { id: 'rating-eq', description: '评级一致', sourcePath: 'rating', targetPath: 'rating', targetSource: 'expected', operator: 'eq' },
        ],
        threshold: 0.8,
      },
    })

    expect(result.status).toBe('passed')
    expect(result.score).toBe(1)
    expect(result.issues).toHaveLength(0)
  })

  it('上游 SKILL 评级同向时应通过', async () => {
    const upstreamResults: Record<string, SkillResult> = {
      'v6-model': {
        skillId: 'v6-model',
        status: 'success',
        data: { rating: 'strong_buy', score: 4.5 },
        evidence: [],
        meta: { startedAt: 0, durationMs: 0 },
      },
    }

    const result = await consistencyEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy' },
      upstreamResults,
      params: {
        rules: [
          { id: 'rating-direction', description: '与 V6 评级同向', sourcePath: 'rating', targetPath: 'rating', targetSource: 'upstream', upstreamSkillId: 'v6-model', operator: 'sameDirection' },
        ],
        threshold: 0.8,
      },
    })

    expect(result.status).toBe('passed')
    expect(result.score).toBe(1)
  })

  it('评级矛盾时应失败', async () => {
    const result = await consistencyEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy' },
      expected: { rating: 'sell' },
      params: {
        rules: [
          { id: 'not-contradict', description: '不与预期评级矛盾', sourcePath: 'rating', targetPath: 'rating', targetSource: 'expected', operator: 'notContradict' },
        ],
        threshold: 0.8,
      },
    })

    expect(result.status).toBe('failed')
    expect(result.score).toBe(0)
    expect(result.issues[0]?.message).toContain('不一致')
  })

  it('未传入 rules 时应失败降级', async () => {
    const result = await consistencyEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy' },
    })

    expect(result.status).toBe('failed')
    expect(result.score).toBe(0)
    expect(result.issues[0]?.message).toContain('缺少一致性规则')
  })
})

describe('regressionEvaluator', () => {
  it('actual 与 expected 完全一致时应通过', async () => {
    const result = await regressionEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy', confidence: 0.8 },
      expected: { rating: 'buy', confidence: 0.8 },
    })

    expect(result.status).toBe('passed')
    expect(result.score).toBe(1)
    expect(result.issues).toHaveLength(0)
  })

  it('字段值变更时应 partial', async () => {
    const result = await regressionEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy', confidence: 0.7 },
      expected: { rating: 'buy', confidence: 0.8 },
      params: { threshold: 0.9 },
    })

    expect(result.status).toBe('partial')
    expect(result.score).toBeCloseTo(0.5, 2)
    expect(result.issues.some(i => i.message.includes('值变更'))).toBe(true)
  })

  it('ignorePaths 应忽略指定字段', async () => {
    const result = await regressionEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy', confidence: 0.7, meta: { ts: 1 } },
      expected: { rating: 'buy', confidence: 0.7, meta: { ts: 2 } },
      params: { threshold: 1, ignorePaths: ['meta.ts'] },
    })

    expect(result.status).toBe('passed')
    expect(result.score).toBe(1)
    expect(result.issues).toHaveLength(0)
  })

  it('缺少 expected 时应失败降级', async () => {
    const result = await regressionEvaluator({
      symbol: 'TEST',
      actual: { rating: 'buy' },
    })

    expect(result.status).toBe('failed')
    expect(result.score).toBe(0)
    expect(result.issues[0]?.message).toContain('缺少 expected')
  })
})
