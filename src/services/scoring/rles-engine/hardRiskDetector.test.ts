import { describe, it, expect } from 'vitest'
import { matchForbidden, detectHardRisks, FORBIDDEN_STOCKS } from './hardRiskDetector'

const SAMPLE_LIST = {
  '600000': { reason: '已公告终止上市', category: 'delisting' as const },
  '000001': { reason: '被实施其他风险警示', category: 'st' as const },
}

describe('hardRiskDetector（三条禁令）', () => {
  it('命中返回 category:reason 标签', () => {
    expect(matchForbidden('600000', SAMPLE_LIST)).toEqual(['delisting:已公告终止上市'])
  })

  it('未命中返回空数组', () => {
    expect(matchForbidden('300750', SAMPLE_LIST)).toEqual([])
  })

  it('detectHardRisks 基于 FORBIDDEN_STOCKS（当前为空占位，不误伤）', () => {
    expect(detectHardRisks('600000')).toEqual([])
    expect(Object.keys(FORBIDDEN_STOCKS).length).toBe(0)
  })
})
