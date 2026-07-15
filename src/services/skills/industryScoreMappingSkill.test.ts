/**
 * @module services/skills/industryScoreMappingSkill.test
 * @description S-06 行业评分映射 SKILL 单元测试
 */

import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './skillRegistry'
import { industryScoreMappingSkill, type IndustryScoreMappingOutput } from './industryScoreMappingSkill'

describe('industryScoreMappingSkill', () => {
  const registry = new SkillRegistry()
  registry.register(industryScoreMappingSkill)

  it('应通过关键词匹配到 AI 赛道并计算 L-1 得分', async () => {
    const result = await registry.execute<IndustryScoreMappingOutput>('industry-score-mapping', {
      symbol: 'UNKNOWN',
      stockName: '某AI公司',
      params: { keywords: ['大模型', '算力'] },
    })

    expect(result.status).toBe('success')
    expect(result.data!.matched).toBe(true)
    expect(result.data!.sectorCode).toBe('AI')
    expect(result.data!.matchSource).toBe('keyword')
    expect(result.data!.relevance).toBeGreaterThan(0)
    expect(result.data!.l1Score).toBeDefined()
    expect(result.data!.l1Weight).toBe(0.10)
  })

  it('应通过申万行业匹配到新能源赛道', async () => {
    const result = await registry.execute<IndustryScoreMappingOutput>('industry-score-mapping', {
      symbol: '000001.SZ',
      stockName: '某新能源公司',
      params: { swLevel1: '电力设备' },
    })

    expect(result.status).toBe('success')
    expect(result.data!.matched).toBe(true)
    expect(result.data!.matchSource).toBe('sector')
    expect(result.data!.relevance).toBe(0.7)
  })

  it('无匹配时应返回 matched=false', async () => {
    const result = await registry.execute<IndustryScoreMappingOutput>('industry-score-mapping', {
      symbol: '999999.XX',
      stockName: '未知公司',
      params: { keywords: ['不存在的关键词'] },
    })

    expect(result.status).toBe('success')
    expect(result.data!.matched).toBe(false)
    expect(result.data!.matchSource).toBe('none')
    expect(result.data!.relevance).toBe(0)
  })

  it('forceKeywordMatch 为 true 时应忽略精确代码匹配', async () => {
    const result = await registry.execute<IndustryScoreMappingOutput>('industry-score-mapping', {
      symbol: '002156.SZ',
      stockName: '通富微电',
      params: { forceKeywordMatch: true, keywords: ['锂电池'] },
    })

    expect(result.status).toBe('success')
    expect(result.data!.matchSource).toBe('keyword')
    expect(result.data!.sectorCode).toBe('NEV')
  })
})
