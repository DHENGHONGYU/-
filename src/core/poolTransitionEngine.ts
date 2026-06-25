import { getLogger } from '@/lib/logger'
import {
  RESEARCH_STATUS,
  type ResearchStatus,
} from '@/config/dbConfig'

const logger = getLogger()

export const POOL_TRANSITIONS: Record<
  ResearchStatus,
  { next: ResearchStatus[]; label: string }
> = {
  [RESEARCH_STATUS.candidate]: {
    next: [RESEARCH_STATUS.screened, RESEARCH_STATUS.archived],
    label: '意向候选池',
  },
  [RESEARCH_STATUS.screened]: {
    next: [RESEARCH_STATUS.deepDive, RESEARCH_STATUS.archived],
    label: '研究精选池',
  },
  [RESEARCH_STATUS.deepDive]: {
    next: [RESEARCH_STATUS.watching, RESEARCH_STATUS.archived],
    label: '深度研究池',
  },
  [RESEARCH_STATUS.watching]: {
    next: [RESEARCH_STATUS.archived],
    label: '观察池',
  },
  [RESEARCH_STATUS.archived]: {
    next: [RESEARCH_STATUS.candidate],
    label: '归档池',
  },
}

export function getNextStatuses(status: ResearchStatus): ResearchStatus[] {
  const nextStatuses = POOL_TRANSITIONS[status].next
  logger.debug(`[PoolTransition] getNextStatuses: current="${status}", next=${JSON.stringify(nextStatuses)}`)
  return nextStatuses
}

export function getPoolLabel(status: ResearchStatus): string {
  const label = POOL_TRANSITIONS[status].label
  logger.debug(`[PoolTransition] getPoolLabel: status="${status}", label="${label}"`)
  return label
}

export function isValidTransition(
  from: ResearchStatus,
  to: ResearchStatus,
): boolean {
  const isValid = POOL_TRANSITIONS[from].next.includes(to)
  if (isValid) {
    logger.info(`[PoolTransition] isValidTransition: valid, from="${from}" → to="${to}"`)
  } else {
    logger.warn(`[PoolTransition] isValidTransition: invalid, from="${from}" → to="${to}", allowed=${JSON.stringify(POOL_TRANSITIONS[from].next)}`)
  }
  return isValid
}

export function getTransitionLabel(
  from: ResearchStatus,
  to: ResearchStatus,
): string {
  const labels: Record<ResearchStatus, string> = {
    [RESEARCH_STATUS.candidate]: '退回候选',
    [RESEARCH_STATUS.screened]: '精选研究',
    [RESEARCH_STATUS.deepDive]: '深度研究',
    [RESEARCH_STATUS.watching]: '加入观察',
    [RESEARCH_STATUS.archived]: '归档',
  }
  const label = labels[to] ?? '流转'
  logger.debug(`[PoolTransition] getTransitionLabel: from="${from}" → to="${to}", label="${label}"`)
  return label
}

export function transitionStatus(
  from: ResearchStatus,
  to: ResearchStatus,
): ResearchStatus | null {
  logger.debug(`[PoolTransition] transitionStatus() called: from="${from}", to="${to}"`)

  if (!isValidTransition(from, to)) {
    logger.error(`[PoolTransition] transitionStatus() failed: Invalid transition from="${from}" to="${to}"`)
    return null
  }

  logger.info(`[PoolTransition] transitionStatus() success: from="${from}" → to="${to}"`)
  return to
}
