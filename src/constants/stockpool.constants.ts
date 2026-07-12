/**
 * 股票池业务常量（从 config/dbConfig 迁移，消除 services→config 跨层违规）
 *
 * @module constants/stockpool.constants
 * @version v1.0.0（2026-07-12 迁移）
 */

/** 默认股票池分组名称 */
export const DEFAULT_POOL_GROUP = '默认分组' as const

/** 股票研究状态枚举 */
export const RESEARCH_STATUS = {
  candidate: 'candidate',
  screened: 'screened',
  deepDive: 'deepDive',
  watching: 'watching',
  archived: 'archived',
} as const

export type ResearchStatus =
  (typeof RESEARCH_STATUS)[keyof typeof RESEARCH_STATUS]
