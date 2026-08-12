/**
 * @test_id V9-TEST-UT-042
 * @covers_docs [V9-DOC-DATA-024, V9-DOC-PROJ-108, V9-DOC-BACK-011]
 */
import { describe, expect, it } from 'vitest'
import {
  getPoolLabel,
  getPoolTransitionOptions,
  getTransitionLabel,
  isValidTransition,
  transitionStatus,
} from '@/core/poolTransitionEngine'
import { POOL_TYPE, RESEARCH_STATUS } from '@/constants/pool.constants'

describe('poolTransitionEngine', () => {
  it('应该返回 correct next transition options for research candidate', () => {
    const next = getPoolTransitionOptions(POOL_TYPE.research, RESEARCH_STATUS.candidate)
    const statuses = next.map((option) => option.status)
    expect(statuses).toContain(RESEARCH_STATUS.screened)
    expect(statuses).toContain(RESEARCH_STATUS.archived)
    expect(statuses).not.toContain(RESEARCH_STATUS.deepDive)
  })

  it('应该验证 allowed transitions', () => {
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
      POOL_TYPE.research, RESEARCH_STATUS.screened,
    )).toBe(true)
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.screened,
      POOL_TYPE.research, RESEARCH_STATUS.deepDive,
    )).toBe(true)
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.deepDive,
      POOL_TYPE.research, RESEARCH_STATUS.watching,
    )).toBe(true)
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.archived,
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
    )).toBe(true)
  })

  it('应该reject invalid transitions', () => {
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
      POOL_TYPE.research, RESEARCH_STATUS.watching,
    )).toBe(false)
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.watching,
      POOL_TYPE.research, RESEARCH_STATUS.deepDive,
    )).toBe(false)
    expect(isValidTransition(
      POOL_TYPE.research, RESEARCH_STATUS.archived,
      POOL_TYPE.research, RESEARCH_STATUS.watching,
    )).toBe(false)
  })

  it('应该返回 labels', () => {
    expect(getPoolLabel(POOL_TYPE.research, RESEARCH_STATUS.candidate)).toBe('研究候选')
    expect(getPoolLabel(POOL_TYPE.research, RESEARCH_STATUS.watching)).toBe('观察池')
    expect(getTransitionLabel(
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
      POOL_TYPE.research, RESEARCH_STATUS.screened,
    )).toBe('精选研究')
    expect(getTransitionLabel(
      POOL_TYPE.research, RESEARCH_STATUS.archived,
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
    )).toBe('恢复候选')
  })

  it('应该执行合法的状态流转', () => {
    expect(transitionStatus(
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
      POOL_TYPE.research, RESEARCH_STATUS.screened,
    )).toEqual({ pool: POOL_TYPE.research, status: RESEARCH_STATUS.screened })

    expect(transitionStatus(
      POOL_TYPE.research, RESEARCH_STATUS.candidate,
      POOL_TYPE.research, RESEARCH_STATUS.watching,
    )).toBeNull()
  })
})
