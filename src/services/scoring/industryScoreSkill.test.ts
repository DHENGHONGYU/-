import { describe, it, expect } from 'vitest'
import { INDUSTRY_SCORE_SKILL } from './industryScoreSkill'

describe('INDUSTRY_SCORE_SKILL', () => {
  it('是非空字符串', () => {
    expect(typeof INDUSTRY_SCORE_SKILL).toBe('string')
    expect(INDUSTRY_SCORE_SKILL.length).toBeGreaterThan(0)
  })

  it('包含关键词 V6 或 V9', () => {
    expect(
      INDUSTRY_SCORE_SKILL.includes('V6') || INDUSTRY_SCORE_SKILL.includes('V9'),
    ).toBe(true)
  })

  it('包含关键词 "行业" 或 "sector"', () => {
    expect(
      INDUSTRY_SCORE_SKILL.includes('行业') || INDUSTRY_SCORE_SKILL.toLowerCase().includes('sector'),
    ).toBe(true)
  })

  it('包含关键词 "评分" 或 "score"', () => {
    expect(
      INDUSTRY_SCORE_SKILL.includes('评分') || INDUSTRY_SCORE_SKILL.toLowerCase().includes('score'),
    ).toBe(true)
  })

  it('包含关键词 "估值" 或 "valuation"', () => {
    expect(
      INDUSTRY_SCORE_SKILL.includes('估值') || INDUSTRY_SCORE_SKILL.toLowerCase().includes('valuation'),
    ).toBe(true)
  })

  it('包含 JSON 输出格式说明', () => {
    // 检查是否存在 JSON 相关关键词（JSON、dimensions、rationale 等）
    const hasJson =
      INDUSTRY_SCORE_SKILL.includes('JSON') ||
      INDUSTRY_SCORE_SKILL.includes('json') ||
      (INDUSTRY_SCORE_SKILL.includes('"dimensions"') &&
        INDUSTRY_SCORE_SKILL.includes('"score"') &&
        INDUSTRY_SCORE_SKILL.includes('"rationale"'))
    expect(hasJson).toBe(true)
  })
})
