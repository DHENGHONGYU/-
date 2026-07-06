/**
 * L3 工具函数单元测试
 * 
 * 覆盖：
 * - matchIndustryBenchmark
 * - clamp
 */

import { describe, it, expect } from 'vitest'
import { matchIndustryBenchmark, clamp } from './utils'

describe('matchIndustryBenchmark', () => {
  it('半导体行业 → 匹配半导体基准', () => {
    const result = matchIndustryBenchmark('半导体')
    expect(result).not.toBeNull()
    expect(result?.sector).toBe('半导体')
    expect(result?.peLow).toBe(30)
    expect(result?.peHigh).toBe(50)
  })

  it('芯片行业 → 匹配半导体基准（关键词匹配）', () => {
    const result = matchIndustryBenchmark('芯片制造')
    expect(result).not.toBeNull()
    expect(result?.sector).toBe('半导体')
  })

  it('白酒行业 → 匹配消费基准', () => {
    const result = matchIndustryBenchmark('白酒')
    expect(result).not.toBeNull()
    expect(result?.sector).toBe('消费')
    expect(result?.peLow).toBe(20)
    expect(result?.peHigh).toBe(35)
  })

  it('医药行业 → 匹配医药基准', () => {
    const result = matchIndustryBenchmark('医药生物')
    expect(result).not.toBeNull()
    expect(result?.sector).toBe('医药')
  })

  it('AI行业 → 匹配AI/TMT基准', () => {
    const result = matchIndustryBenchmark('AI')
    expect(result).not.toBeNull()
    expect(result?.sector).toBe('AI/TMT')
  })

  it('未知行业 → 返回 null', () => {
    const result = matchIndustryBenchmark('未知行业')
    expect(result).toBeNull()
  })

  it('空字符串 → 返回 null', () => {
    const result = matchIndustryBenchmark('')
    expect(result).toBeNull()
  })

  it('undefined → 返回 null', () => {
    const result = matchIndustryBenchmark(undefined)
    expect(result).toBeNull()
  })

  it('半导体关键词：集成电路 → 匹配半导体', () => {
    const result = matchIndustryBenchmark('集成电路')
    expect(result).not.toBeNull()
    expect(result?.sector).toBe('半导体')
  })
})

describe('clamp', () => {
  it('正常值：3.5 → 3.5', () => {
    expect(clamp(3.5)).toBe(3.5)
  })

  it('边界值：0 → 0', () => {
    expect(clamp(0)).toBe(0)
  })

  it('边界值：5 → 5', () => {
    expect(clamp(5)).toBe(5)
  })

  it('超范围：6 → 截断为 5', () => {
    expect(clamp(6)).toBe(5)
  })

  it('超范围：10 → 截断为 5', () => {
    expect(clamp(10)).toBe(5)
  })

  it('负数：-1 → 截断为 0', () => {
    expect(clamp(-1)).toBe(0)
  })

  it('负数：-10 → 截断为 0', () => {
    expect(clamp(-10)).toBe(0)
  })

  it('小数：2.7 → 2.7', () => {
    expect(clamp(2.7)).toBe(2.7)
  })

  it('小数：4.3 → 4.3', () => {
    expect(clamp(4.3)).toBe(4.3)
  })
})
