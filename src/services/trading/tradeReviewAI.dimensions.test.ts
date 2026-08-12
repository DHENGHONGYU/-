/**
 * @test_id V9-TEST-ST-119
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-QA-080]
 */
import { describe, it, expect } from 'vitest'
import { SKILL_DIMENSIONS, scoreToSkillLevel, getTargetLevel, getTargetScore } from './tradeReviewAI.dimensions'
import type { SkillLevel } from './tradeReviewAI.types'

describe('tradeReviewAI.dimensions', () => {
  describe('SKILL_DIMENSIONS', () => {
    it('应包含 10 个技能维度', () => {
      expect(SKILL_DIMENSIONS).toHaveLength(10)
    })

    it('每个维度应包含必要字段', () => {
      for (const dim of SKILL_DIMENSIONS) {
        expect(dim.code).toBeDefined()
        expect(dim.name).toBeDefined()
        expect(dim.description).toBeDefined()
        expect(dim.relatedErrors).toBeDefined()
        expect(Array.isArray(dim.relatedErrors)).toBe(true)
      }
    })

    it('维度代码应唯一', () => {
      const codes = SKILL_DIMENSIONS.map((d) => d.code)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })
  })

  describe('scoreToSkillLevel', () => {
    it('应正确映射分数到技能等级', () => {
      expect(scoreToSkillLevel(90)).toBe('expert')
      expect(scoreToSkillLevel(75)).toBe('advanced')
      expect(scoreToSkillLevel(55)).toBe('intermediate')
      expect(scoreToSkillLevel(35)).toBe('beginner')
      expect(scoreToSkillLevel(0)).toBe('beginner')
    })

    it('边界值应正确处理', () => {
      // 阈值: expert>=85, advanced>=70, intermediate>=55, beginner>=35
      expect(scoreToSkillLevel(100)).toBe('expert')
      expect(scoreToSkillLevel(85)).toBe('expert')
      expect(scoreToSkillLevel(84)).toBe('advanced')
      expect(scoreToSkillLevel(70)).toBe('advanced')
      expect(scoreToSkillLevel(69)).toBe('intermediate')
      expect(scoreToSkillLevel(55)).toBe('intermediate')
      expect(scoreToSkillLevel(54)).toBe('beginner')
      expect(scoreToSkillLevel(35)).toBe('beginner')
      expect(scoreToSkillLevel(34)).toBe('beginner')
    })
  })

  describe('getTargetLevel', () => {
    it('应返回下一个技能等级', () => {
      expect(getTargetLevel('beginner')).toBe('intermediate')
      expect(getTargetLevel('intermediate')).toBe('advanced')
      expect(getTargetLevel('advanced')).toBe('expert')
      expect(getTargetLevel('expert')).toBe('master')
    })

    it('master 等级应返回自身', () => {
      expect(getTargetLevel('master')).toBe('master')
    })
  })

  describe('getTargetScore', () => {
    it('应返回目标等级对应的分数', () => {
      const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert', 'master']
      for (const level of levels) {
        const score = getTargetScore(level)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }
    })

    it('目标分数应递增', () => {
      const beginner = getTargetScore('beginner')
      const intermediate = getTargetScore('intermediate')
      const advanced = getTargetScore('advanced')
      const expert = getTargetScore('expert')
      const master = getTargetScore('master')

      expect(beginner).toBeLessThan(intermediate)
      expect(intermediate).toBeLessThan(advanced)
      expect(advanced).toBeLessThan(expert)
      expect(expert).toBeLessThanOrEqual(master)
    })
  })
})
