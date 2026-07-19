/**
 * @test_id V9-TEST-ST-104
 * L-1 行业评分估值 —— 单元测试
 *
 * 覆盖：matchIndustry、calcSkillNBonus、LMinus1Calculator.calculate
  * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066]
*/

import { describe, test, expect, vi } from 'vitest'
import { matchIndustry, calcSkillNBonus, LMinus1Calculator } from './lMinus1'
import type { LayerInput, IndustryScoreData } from '../types'

// ============================================================
// Mock logger
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// 测试辅助函数
// ============================================================

function createBaseInput(overrides?: Partial<LayerInput>): LayerInput {
  return {
    stock: { symbol: 'TEST', name: '测试股' },
    financials: {},
    quotes: {},
    config: { weights: { lMinus1: 0.10 } } as any,
    ...overrides,
  }
}

// ============================================================
// matchIndustry 行业匹配
// ============================================================

describe('matchIndustry 行业匹配', () => {
  test('核心标的精确匹配', () => {
    const result = matchIndustry('688256')
    expect(result).toEqual({ sectorName: '芯片设计', relevance: 1.0 })
  })

  test('关键词匹配', () => {
    const result = matchIndustry('UNKNOWN', '半导体设计', '某芯片公司')
    expect(result).toEqual({ sectorName: '芯片设计', relevance: 0.9 })
  })

  test('未匹配', () => {
    const result = matchIndustry('UNKNOWN', '某未知行业', '某未知公司')
    expect(result).toBeNull()
  })

  test('大小写不敏感', () => {
    const result1 = matchIndustry('UNKNOWN', 'ai应用', '某AI公司')
    expect(result1).toEqual({ sectorName: 'AI应用及平台', relevance: 0.7 })

    const result2 = matchIndustry('UNKNOWN', 'AI应用', '某ai公司')
    expect(result2).toEqual({ sectorName: 'AI应用及平台', relevance: 0.7 })
  })
})

// ============================================================
// calcSkillNBonus SKILL-N加分
// ============================================================

describe('calcSkillNBonus SKILL-N加分', () => {
  test('极度超配 → 0.30', () => {
    expect(calcSkillNBonus('极度超配')).toBe(0.30)
  })

  test('超配 → 0.15', () => {
    expect(calcSkillNBonus('超配')).toBe(0.15)
    expect(calcSkillNBonus('超配(择机)')).toBe(0.15)
  })

  test('标配 → 0.00', () => {
    expect(calcSkillNBonus('标配')).toBe(0.00)
  })

  test('空字符串 → 0.00', () => {
    expect(calcSkillNBonus('')).toBe(0.00)
  })
})

// ============================================================
// LMinus1Calculator.calculate
// ============================================================

describe('LMinus1Calculator.calculate', () => {
  test('外部传入 industryScore → 直接使用', async () => {
    const industryScore: IndustryScoreData = {
      sectorName: 'AI应用及平台',
      skillCScore: 4.0,
      skillCRating: 'A级',
      skillNScore: 3.8,
      relevance: 0.9,
      allocationBias: '超配',
    }
    const result = await LMinus1Calculator.calculate(createBaseInput({
      stock: { symbol: 'TEST', name: '测试' },
      industryScore,
    }))
    expect(result.score).toBe(3.75) // min(5, 4.0*0.9 + 0.15)
    expect(result.summary).toContain('AI应用及平台')
    expect(result.summary).toContain('A级')
    expect(result.evidence).toContain('SKILL-C: A级(4)')
    expect(result.evidence).toContain('SKILL-N: 3.8')
    expect(result.evidence).toContain('关联度: 0.9')
  })

  test('核心标的匹配', async () => {
    const result = await LMinus1Calculator.calculate(createBaseInput({
      stock: { symbol: '6160.HK', name: '百济神州', sector: '创新药' },
    }))
    expect(result.score).toBe(3.88) // 创新药 skillC=3.73 + 0.15(超配)
    expect(result.summary).toContain('创新药')
  })

  test('关键词匹配', async () => {
    const result = await LMinus1Calculator.calculate(createBaseInput({
      stock: { symbol: 'UNKNOWN', name: '某光模块公司', sector: '光通信' },
    }))
    expect(result.score).toBe(4.71) // CoWoS skillC=4.90*0.9 + 0.30(极度超配)
    expect(result.summary).toContain('CoWoS先进封装')
  })

  test('未匹配 → 不参与评分（score=NaN, participated=false）', async () => {
    const result = await LMinus1Calculator.calculate(createBaseInput({
      stock: { symbol: 'UNKNOWN', name: '某未知公司', sector: '某未知行业' },
    }))
    expect(Number.isNaN(result.score)).toBe(true)
    expect(result.participated).toBe(false)
    expect(result.summary).toContain('未匹配到行业评分覆盖范围')
  })

  test('匹配但无数据 → 不参与评分（score=NaN, participated=false）', async () => {
    const spy = vi.spyOn(LMinus1Calculator, 'matchIndustry').mockReturnValue({ sectorName: '不存在的行业', relevance: 1.0 })

    const result = await LMinus1Calculator.calculate(createBaseInput({
      stock: { symbol: 'TEST', name: '测试', sector: '某某' },
    }))

    expect(Number.isNaN(result.score)).toBe(true)
    expect(result.participated).toBe(false)
    expect(result.summary).toContain('匹配到行业 不存在的行业 但无评分数据')

    spy.mockRestore()
  })
})
