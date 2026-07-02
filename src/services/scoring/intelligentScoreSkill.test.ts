import { describe, it, expect } from 'vitest'
import { INTELLIGENT_SCORE_SKILL } from './intelligentScoreSkill'

describe('INTELLIGENT_SCORE_SKILL', () => {
  it('是非空字符串', () => {
    expect(typeof INTELLIGENT_SCORE_SKILL).toBe('string')
    expect(INTELLIGENT_SCORE_SKILL.length).toBeGreaterThan(0)
  })

  it('包含 V6 或 V9', () => {
    expect(
      INTELLIGENT_SCORE_SKILL.includes('V6') || INTELLIGENT_SCORE_SKILL.includes('V9'),
    ).toBe(true)
  })

  it('包含 "个股" 或 "stock"', () => {
    expect(
      INTELLIGENT_SCORE_SKILL.includes('个股') ||
        INTELLIGENT_SCORE_SKILL.toLowerCase().includes('stock'),
    ).toBe(true)
  })

  it('包含 "评分" 或 "score"', () => {
    expect(
      INTELLIGENT_SCORE_SKILL.includes('评分') ||
        INTELLIGENT_SCORE_SKILL.toLowerCase().includes('score'),
    ).toBe(true)
  })

  it('包含 9 个评分维度名称', () => {
    const dimensions = ['估值', '成长', '盈利', '质量', '动量', '波动', '流动性', '行业', '情绪']
    for (const dim of dimensions) {
      expect(INTELLIGENT_SCORE_SKILL.includes(dim), `缺少维度: ${dim}`).toBe(true)
    }
  })

  it('包含 JSON 输出格式', () => {
    const hasJson =
      INTELLIGENT_SCORE_SKILL.includes('JSON') ||
      INTELLIGENT_SCORE_SKILL.includes('json') ||
      (INTELLIGENT_SCORE_SKILL.includes('"dimensions"') &&
        INTELLIGENT_SCORE_SKILL.includes('"score"') &&
        INTELLIGENT_SCORE_SKILL.includes('"rationale"'))
    expect(hasJson).toBe(true)
  })

  it('包含 "null" 或 "数据缺失" 的规则', () => {
    expect(
      INTELLIGENT_SCORE_SKILL.includes('null') || INTELLIGENT_SCORE_SKILL.includes('数据缺失'),
    ).toBe(true)
  })

  it('包含 "禁止杜撰" 或 "禁止给默认值" 的规则', () => {
    expect(
      INTELLIGENT_SCORE_SKILL.includes('禁止杜撰') ||
        INTELLIGENT_SCORE_SKILL.includes('禁止给默认值'),
    ).toBe(true)
  })
})
