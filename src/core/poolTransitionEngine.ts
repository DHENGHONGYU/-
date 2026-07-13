import { getLogger } from '@/lib/logger'
import {
  INTENTION_STATUS,
  POSITION_STATUS,
  RESEARCH_STATUS,
  POOL_TYPE,
  type PoolType,
  type PoolStatus,
} from '@/constants/pool.constants'
import type { PoolTransitionTarget } from '@/types/modules/pool.types'

const logger = getLogger()

/**
 * POOL_TRANSITIONS
 *
 * 三分拆后流转规则：
 * - intention: screening → watchlist → archived
 * - research: candidate → screened → deepDive → watching → archived
 * - position: holding → partial → closed
 * - 跨池：research.watching → position.holding（买入）
 *        position.closed → research.archived（清仓后归档）
 */
export const POOL_TRANSITIONS: Record<
  PoolType,
  Partial<Record<PoolStatus, { next: PoolTransitionTarget[]; label: string }>>
> = {
  [POOL_TYPE.intention]: {
    [INTENTION_STATUS.screening]: {
      next: [
        { pool: POOL_TYPE.intention, status: INTENTION_STATUS.watchlist, label: '加入观察' },
        { pool: POOL_TYPE.intention, status: INTENTION_STATUS.archived, label: '归档' },
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.candidate, label: '晋升研究' },
      ],
      label: '初步筛选',
    },
    [INTENTION_STATUS.watchlist]: {
      next: [
        { pool: POOL_TYPE.intention, status: INTENTION_STATUS.archived, label: '归档' },
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.candidate, label: '晋升研究' },
      ],
      label: '观察列表',
    },
    [INTENTION_STATUS.archived]: {
      next: [
        { pool: POOL_TYPE.intention, status: INTENTION_STATUS.screening, label: '恢复筛选' },
      ],
      label: '已归档',
    },
  },
  [POOL_TYPE.research]: {
    [RESEARCH_STATUS.candidate]: {
      next: [
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.screened, label: '精选研究' },
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.archived, label: '归档' },
      ],
      label: '研究候选',
    },
    [RESEARCH_STATUS.screened]: {
      next: [
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.deepDive, label: '深度研究' },
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.archived, label: '归档' },
      ],
      label: '精选研究',
    },
    [RESEARCH_STATUS.deepDive]: {
      next: [
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.watching, label: '加入观察' },
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.archived, label: '归档' },
      ],
      label: '深度研究',
    },
    [RESEARCH_STATUS.watching]: {
      next: [
        { pool: POOL_TYPE.position, status: POSITION_STATUS.holding, label: '买入持仓' },
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.archived, label: '归档' },
      ],
      label: '观察池',
    },
    [RESEARCH_STATUS.archived]: {
      next: [
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.candidate, label: '恢复候选' },
      ],
      label: '已归档',
    },
  },
  [POOL_TYPE.position]: {
    [POSITION_STATUS.holding]: {
      next: [
        { pool: POOL_TYPE.position, status: POSITION_STATUS.partial, label: '减仓' },
        { pool: POOL_TYPE.position, status: POSITION_STATUS.closed, label: '清仓' },
      ],
      label: '持仓中',
    },
    [POSITION_STATUS.partial]: {
      next: [
        { pool: POOL_TYPE.position, status: POSITION_STATUS.closed, label: '清仓' },
      ],
      label: '部分减仓',
    },
    [POSITION_STATUS.closed]: {
      next: [
        { pool: POOL_TYPE.research, status: RESEARCH_STATUS.archived, label: '归档研究' },
      ],
      label: '已清仓',
    },
  },
}

/**
 * 获取指定池/状态的下一跳选项。
 */
export function getPoolTransitionOptions(
  pool: PoolType,
  status: PoolStatus,
): PoolTransitionTarget[] {
  const transitions = POOL_TRANSITIONS[pool]?.[status]
  if (!transitions) {
    logger.warn(`[PoolTransition] 未找到流转定义: pool="${pool}", status="${status}"`)
    return []
  }
  return transitions.next
}

/**
 * 获取池/状态标签。
 */
export function getPoolLabel(pool: PoolType, status: PoolStatus): string {
  const label = POOL_TRANSITIONS[pool]?.[status]?.label
  if (!label) {
    logger.warn(`[PoolTransition] 未找到标签: pool="${pool}", status="${status}"`)
    return `${pool}:${status}`
  }
  return label
}

/**
 * 校验流转是否合法。
 */
export function isValidTransition(
  fromPool: PoolType,
  fromStatus: PoolStatus,
  toPool: PoolType,
  toStatus: PoolStatus,
): boolean {
  const options = getPoolTransitionOptions(fromPool, fromStatus)
  const isValid = options.some(
    (opt) => opt.pool === toPool && opt.status === toStatus,
  )
  if (isValid) {
    logger.info(
      `[PoolTransition] isValidTransition: valid, from="${fromPool}:${fromStatus}" → to="${toPool}:${toStatus}"`,
    )
  } else {
    logger.warn(
      `[PoolTransition] isValidTransition: invalid, from="${fromPool}:${fromStatus}" → to="${toPool}:${toStatus}", allowed=${JSON.stringify(options)}`,
    )
  }
  return isValid
}

/**
 * 获取流转标签。
 */
export function getTransitionLabel(
  fromPool: PoolType,
  fromStatus: PoolStatus,
  toPool: PoolType,
  toStatus: PoolStatus,
): string {
  const options = getPoolTransitionOptions(fromPool, fromStatus)
  const match = options.find(
    (opt) => opt.pool === toPool && opt.status === toStatus,
  )
  return match?.label ?? '流转'
}

/**
 * 执行状态流转（纯计算函数）。
 */
export function transitionStatus(
  fromPool: PoolType,
  fromStatus: PoolStatus,
  toPool: PoolType,
  toStatus: PoolStatus,
): { pool: PoolType; status: PoolStatus } | null {
  logger.debug(
    `[PoolTransition] transitionStatus() called: from="${fromPool}:${fromStatus}" → to="${toPool}:${toStatus}"`,
  )

  if (!isValidTransition(fromPool, fromStatus, toPool, toStatus)) {
    logger.error(
      `[PoolTransition] transitionStatus() failed: Invalid transition from="${fromPool}:${fromStatus}" to="${toPool}:${toStatus}"`,
    )
    return null
  }

  logger.info(
    `[PoolTransition] transitionStatus() success: from="${fromPool}:${fromStatus}" → to="${toPool}:${toStatus}"`,
  )
  return { pool: toPool, status: toStatus }
}
