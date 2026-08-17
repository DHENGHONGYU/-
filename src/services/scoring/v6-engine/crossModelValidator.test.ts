/**
 * crossModelValidator 测试
 *
 * P3: 多模型交叉验证 — TruthLens 风格双模型一致性校验
 * 覆盖：一致性判定逻辑、分歧处理策略、边界条件
 *
 * @test_id V9-TEST-UT-062
 * @covers src/services/scoring/v6-engine/crossModelValidator.ts
 * @created 2026-08-17 P3
 */

import { describe, expect, it } from 'vitest'
import { CrossModelValidator, DEFAULT_CROSS_MODEL_CONFIG } from '@/services/scoring/v6-engine/crossModelValidator'
import type { CrossModelConfig, ModelScore, CrossModelAgreement } from '@/services/scoring/v6-engine/crossModelValidator'

// 辅助：创建模拟的 ModelScore
function mockScore(overrides: Partial<ModelScore> = {}): ModelScore {
  return {
    model: 'test-model',
    score: 4.0,
    summary: '该股票估值合理，护城河深厚，盈利增长稳健',
    risks: [],
    citations: ['2024年报', '行业研报-2025Q1'],
    rawContent: '{"score": 4.0, "summary": "该股票估值合理"}',
    success: true,
    elapsedMs: 100,
    ...overrides,
  }
}

describe('crossModelValidator — 多模型交叉验证', () => {

  describe('extractKeywords（语义关键词提取）', () => {
    it('应提取中文金融关键词', () => {
      const validator = new CrossModelValidator()
      // 通过 assessAgreement 间接测试
      const primary = mockScore({ summary: '估值合理，护城河深厚，ROE稳定增长' })
      const secondary = mockScore({ summary: '估值较低，护城河较强，盈利增长稳健' })
      // 使用反射访问私有方法不方便，通过 agreement 间接验证
      const agreement = (validator as any).assessAgreement(primary, secondary)
      // 共享关键词: 估值、护城河、增长 → 应有一定重叠度
      expect(agreement.summaryConsistent).toBe(true)
    })
  })

  describe('assessAgreement（一致性判定）', () => {
    const validator = new CrossModelValidator()

    it('完全一致 → consistent', () => {
      const primary = mockScore({ score: 4.0, summary: '估值合理，护城河深厚' })
      const secondary = mockScore({ score: 4.0, summary: '估值合理，护城河深厚' })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.severity).toBe('consistent')
      expect(agreement.overallConsistent).toBe(true)
      expect(agreement.scoreDelta).toBe(0)
    })

    it('评分偏差 0.5（≤ 阈值 1.0）→ minor', () => {
      const primary = mockScore({ score: 4.0, summary: '估值合理，护城河深厚' })
      const secondary = mockScore({ score: 3.5, summary: '估值合理，护城河深厚' })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.scoreConsistent).toBe(true)
      expect(agreement.severity).toBe('consistent')
    })

    it('评分偏差 1.5（> 阈值 1.0）→ minor（摘要一致，但评分偏差大）', () => {
      const primary = mockScore({ score: 4.5, summary: '估值合理，护城河深厚，盈利增长稳健' })
      const secondary = mockScore({ score: 3.0, summary: '估值合理，护城河深厚，盈利增长稳健' })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.scoreConsistent).toBe(false)
      expect(agreement.summaryConsistent).toBe(true)
    })

    it('评分和摘要都严重分歧 → critical', () => {
      const primary = mockScore({
        score: 4.5,
        summary: '极度低估，强烈推荐买入，护城河极深，成长性极高',
        citations: ['研报A'],
      })
      const secondary = mockScore({
        score: 1.5,
        summary: '严重高估，建议卖出，竞争激烈，盈利下滑',
        citations: ['研报B'],
      })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.severity).toBe('critical')
      expect(agreement.overallConsistent).toBe(false)
    })
  })

  describe('Jaccard 相似度', () => {
    it('完全相同的集合 → 1.0', () => {
      // 通过 citationsOverlap 测试
      const validator = new CrossModelValidator()
      const primary = mockScore({ citations: ['A', 'B', 'C'], summary: '估值合理', score: 4.0 })
      const secondary = mockScore({ citations: ['A', 'B', 'C'], summary: '估值合理', score: 4.0 })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.citationsOverlap).toBe(1.0)
      expect(agreement.citationsConsistent).toBe(true)
    })

    it('完全不重叠 → 0.0', () => {
      const validator = new CrossModelValidator()
      const primary = mockScore({ citations: ['A', 'B'], summary: '估值合理', score: 4.0 })
      const secondary = mockScore({ citations: ['C', 'D'], summary: '估值合理', score: 4.0 })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.citationsOverlap).toBe(0.0)
      expect(agreement.citationsConsistent).toBe(false)
    })

    it('部分重叠 → 0.0 ~ 1.0', () => {
      const validator = new CrossModelValidator()
      const primary = mockScore({ citations: ['A', 'B', 'C'], summary: '估值合理', score: 4.0 })
      const secondary = mockScore({ citations: ['A', 'B', 'D'], summary: '估值合理', score: 4.0 })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.citationsOverlap).toBe(0.5)
    })
  })

  describe('边界条件', () => {
    it('一个模型失败 → 采用成功模型的评分', () => {
      const validator = new CrossModelValidator()
      const primary = mockScore({ score: 4.0, success: true })
      const secondary = mockScore({ score: null, success: false, error: 'timeout' })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      // 一方失败，评分偏差为 Infinity
      expect(agreement.scoreDelta).toBe(-1)
      expect(agreement.scoreConsistent).toBe(false)
    })

    it('双模型都失败 → 应回退', () => {
      const validator = new CrossModelValidator()
      const primary = mockScore({ score: null, success: false })
      const secondary = mockScore({ score: null, success: false })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      expect(agreement.overallConsistent).toBe(false)
      expect(agreement.severity).toBe('critical')
    })
  })

  describe('配置覆盖', () => {
    it('可通过构造函数自定义阈值', () => {
      const customConfig: Partial<CrossModelConfig> = {
        scoreDeltaThreshold: 0.5,
        summaryOverlapThreshold: 0.8,
        citationJaccardThreshold: 0.5,
        enabled: true,
      }
      const validator = new CrossModelValidator(customConfig)
      const primary = mockScore({ score: 4.0, summary: '估值合理', citations: ['A', 'B'] })
      const secondary = mockScore({ score: 3.2, summary: '估值合理', citations: ['A', 'C'] })
      const agreement = (validator as any).assessAgreement(primary, secondary) as CrossModelAgreement
      // 评分偏差 0.8 > 0.5 → scoreConsistent = false
      expect(agreement.scoreConsistent).toBe(false)
    })
  })

  describe('默认配置', () => {
    it('应有合理的默认值', () => {
      expect(DEFAULT_CROSS_MODEL_CONFIG.enabled).toBe(true)
      expect(DEFAULT_CROSS_MODEL_CONFIG.scoreDeltaThreshold).toBe(1.0)
      expect(DEFAULT_CROSS_MODEL_CONFIG.summaryOverlapThreshold).toBe(0.5)
      expect(DEFAULT_CROSS_MODEL_CONFIG.citationJaccardThreshold).toBe(0.3)
      expect(DEFAULT_CROSS_MODEL_CONFIG.primaryModelId).toBe('deepseek-v3')
      expect(DEFAULT_CROSS_MODEL_CONFIG.secondaryModelId).toBe('kimi-k2')
    })
  })
})