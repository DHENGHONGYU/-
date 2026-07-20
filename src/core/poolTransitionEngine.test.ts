import { describe, it, expect } from 'vitest'
import {
  getPoolTransitionOptions,
  getPoolLabel,
  isValidTransition,
  getTransitionLabel,
  transitionStatus,
  POOL_TRANSITIONS,
} from './poolTransitionEngine'
import { POOL_TYPE, INTENTION_STATUS, RESEARCH_STATUS, POSITION_STATUS } from '@/constants/pool.constants'

describe('poolTransitionEngine', () => {
  describe('POOL_TRANSITIONS 结构完整性', () => {
    it('包含三个池类型', () => {
      expect(POOL_TRANSITIONS[POOL_TYPE.intention]).toBeDefined()
      expect(POOL_TRANSITIONS[POOL_TYPE.research]).toBeDefined()
      expect(POOL_TRANSITIONS[POOL_TYPE.position]).toBeDefined()
    })
  })

  describe('getPoolTransitionOptions()', () => {
    it('intention.screening 有 3 个选项', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.intention, INTENTION_STATUS.screening)
      expect(options.length).toBe(3)
      expect(options.map(o => o.label)).toContain('加入观察')
      expect(options.map(o => o.label)).toContain('归档')
      expect(options.map(o => o.label)).toContain('晋升研究')
    })

    it('intention.watchlist 有 2 个选项', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.intention, INTENTION_STATUS.watchlist)
      expect(options.length).toBe(2)
    })

    it('intention.archived 可恢复筛选', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.intention, INTENTION_STATUS.archived)
      expect(options.length).toBe(1)
      expect(options[0]!.status).toBe(INTENTION_STATUS.screening)
    })

    it('research.candidate 有 2 个选项', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.research, RESEARCH_STATUS.candidate)
      expect(options.length).toBe(2)
      expect(options.map(o => o.status)).toContain(RESEARCH_STATUS.screened)
      expect(options.map(o => o.status)).toContain(RESEARCH_STATUS.archived)
    })

    it('research.watching 可买入持仓（跨池）', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.research, RESEARCH_STATUS.watching)
      const toPosition = options.find(o => o.pool === POOL_TYPE.position)
      expect(toPosition).toBeDefined()
      expect(toPosition?.status).toBe(POSITION_STATUS.holding)
    })

    it('position.holding 可减仓或清仓', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.position, POSITION_STATUS.holding)
      expect(options.length).toBe(2)
      expect(options.map(o => o.status)).toContain(POSITION_STATUS.partial)
      expect(options.map(o => o.status)).toContain(POSITION_STATUS.closed)
    })

    it('position.closed 归档到 research', () => {
      const options = getPoolTransitionOptions(POOL_TYPE.position, POSITION_STATUS.closed)
      expect(options.length).toBe(1)
      expect(options[0]!.pool).toBe(POOL_TYPE.research)
      expect(options[0]!.status).toBe(RESEARCH_STATUS.archived)
    })

    it('不存在的池/状态返回空数组', () => {
      const options = getPoolTransitionOptions('nonexistent' as any, 'unknown' as any)
      expect(options).toEqual([])
    })
  })

  describe('getPoolLabel()', () => {
    it('返回状态标签', () => {
      expect(getPoolLabel(POOL_TYPE.intention, INTENTION_STATUS.screening)).toBe('初步筛选')
      expect(getPoolLabel(POOL_TYPE.research, RESEARCH_STATUS.candidate)).toBe('研究候选')
      expect(getPoolLabel(POOL_TYPE.position, POSITION_STATUS.holding)).toBe('持仓中')
    })

    it('找不到时返回 pool:status', () => {
      const result = getPoolLabel('invalid' as any, 'unknown' as any)
      expect(result).toBe('invalid:unknown')
    })
  })

  describe('isValidTransition()', () => {
    it('合法流转返回 true', () => {
      expect(isValidTransition(
        POOL_TYPE.intention, INTENTION_STATUS.screening,
        POOL_TYPE.intention, INTENTION_STATUS.watchlist
      )).toBe(true)

      expect(isValidTransition(
        POOL_TYPE.research, RESEARCH_STATUS.watching,
        POOL_TYPE.position, POSITION_STATUS.holding
      )).toBe(true)
    })

    it('非法流转返回 false', () => {
      expect(isValidTransition(
        POOL_TYPE.intention, INTENTION_STATUS.screening,
        POOL_TYPE.position, POSITION_STATUS.holding
      )).toBe(false)
    })

    it('反向流转返回 false', () => {
      expect(isValidTransition(
        POOL_TYPE.intention, INTENTION_STATUS.watchlist,
        POOL_TYPE.intention, INTENTION_STATUS.screening
      )).toBe(false)
    })
  })

  describe('getTransitionLabel()', () => {
    it('合法流转返回标签', () => {
      const label = getTransitionLabel(
        POOL_TYPE.intention, INTENTION_STATUS.screening,
        POOL_TYPE.intention, INTENTION_STATUS.watchlist
      )
      expect(label).toBe('加入观察')
    })

    it('非法流转返回默认"流转"', () => {
      const label = getTransitionLabel(
        POOL_TYPE.intention, INTENTION_STATUS.screening,
        POOL_TYPE.position, POSITION_STATUS.holding
      )
      expect(label).toBe('流转')
    })
  })

  describe('transitionStatus()', () => {
    it('合法流转返回目标状态', () => {
      const result = transitionStatus(
        POOL_TYPE.intention, INTENTION_STATUS.screening,
        POOL_TYPE.intention, INTENTION_STATUS.watchlist
      )
      expect(result).toEqual({
        pool: POOL_TYPE.intention,
        status: INTENTION_STATUS.watchlist,
      })
    })

    it('跨池流转也能正确返回', () => {
      const result = transitionStatus(
        POOL_TYPE.research, RESEARCH_STATUS.watching,
        POOL_TYPE.position, POSITION_STATUS.holding
      )
      expect(result).toEqual({
        pool: POOL_TYPE.position,
        status: POSITION_STATUS.holding,
      })
    })

    it('非法流转返回 null', () => {
      const result = transitionStatus(
        POOL_TYPE.intention, INTENTION_STATUS.archived,
        POOL_TYPE.position, POSITION_STATUS.holding
      )
      expect(result).toBeNull()
    })
  })
})
