import { describe, expect, it } from 'vitest'
import {
  getNextStatuses,
  getPoolLabel,
  getTransitionLabel,
  isValidTransition,
} from '@/core/poolTransitionEngine'
import { RESEARCH_STATUS } from '@/config/dbConfig'

describe('poolTransitionEngine', () => {
  it('应该返回 correct next statuses for candidate', () => {
    const next = getNextStatuses(RESEARCH_STATUS.candidate)
    expect(next).toContain(RESEARCH_STATUS.screened)
    expect(next).toContain(RESEARCH_STATUS.archived)
    expect(next).not.toContain(RESEARCH_STATUS.deepDive)
  })

  it('应该验证 allowed transitions', () => {
    expect(isValidTransition(RESEARCH_STATUS.candidate, RESEARCH_STATUS.screened)).toBe(true)
    expect(isValidTransition(RESEARCH_STATUS.screened, RESEARCH_STATUS.deepDive)).toBe(true)
    expect(isValidTransition(RESEARCH_STATUS.deepDive, RESEARCH_STATUS.watching)).toBe(true)
    expect(isValidTransition(RESEARCH_STATUS.archived, RESEARCH_STATUS.candidate)).toBe(true)
  })

  it('应该reject invalid transitions', () => {
    expect(isValidTransition(RESEARCH_STATUS.candidate, RESEARCH_STATUS.watching)).toBe(false)
    expect(isValidTransition(RESEARCH_STATUS.watching, RESEARCH_STATUS.deepDive)).toBe(false)
    expect(isValidTransition(RESEARCH_STATUS.archived, RESEARCH_STATUS.watching)).toBe(false)
  })

  it('应该返回 labels', () => {
    expect(getPoolLabel(RESEARCH_STATUS.candidate)).toBe('意向候选池')
    expect(getPoolLabel(RESEARCH_STATUS.watching)).toBe('观察池')
    expect(getTransitionLabel(RESEARCH_STATUS.candidate, RESEARCH_STATUS.screened)).toBe('精选研究')
    expect(getTransitionLabel(RESEARCH_STATUS.archived, RESEARCH_STATUS.candidate)).toBe('退回候选')
  })
})
