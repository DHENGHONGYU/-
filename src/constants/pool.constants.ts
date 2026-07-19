/**
 * 股票池业务常量（三分拆后）。
 *
 * 股票池常量统一入口，所有导入方应使用：
 * `import { ..., type ... } from '@/constants/pool.constants'`
 *
 * @module constants/pool.constants
 * @version v2.0.0（2026-07-13 三分拆迁移）
  * @doc [V9-DOC-BACK-015, V9-DOC-BACK-011, V9-DOC-DATA-045, V9-DOC-PROJ-108, V9-DOC-DATA-024]
*/

import type { PoolType, PoolStatus } from '@/types/modules/pool.types'

/** 默认股票池分组名称 */
export const DEFAULT_POOL_GROUP = '默认分组' as const

/** 股票池类型枚举 */
export const POOL_TYPE = {
  intention: 'intention',
  research: 'research',
  position: 'position',
} as const satisfies Record<string, PoolType>

/** 意向池状态枚举 */
export const INTENTION_STATUS = {
  screening: 'screening',
  watchlist: 'watchlist',
  archived: 'archived',
} as const satisfies Record<string, PoolStatus>

/** 研究池状态枚举 */
export const RESEARCH_STATUS = {
  candidate: 'candidate',
  screened: 'screened',
  deepDive: 'deepDive',
  watching: 'watching',
  archived: 'archived',
} as const satisfies Record<string, PoolStatus>

/** 持仓池状态枚举 */
export const POSITION_STATUS = {
  holding: 'holding',
  partial: 'partial',
  closed: 'closed',
} as const satisfies Record<string, PoolStatus>

/** 默认池类型：新录入标的默认进入研究池 */
export const DEFAULT_POOL_TYPE: PoolType = 'intention'

/** 默认各池初始状态 */
export const DEFAULT_POOL_STATUS: Record<PoolType, PoolStatus> = {
  [POOL_TYPE.intention]: INTENTION_STATUS.screening,
  [POOL_TYPE.research]: RESEARCH_STATUS.candidate,
  [POOL_TYPE.position]: POSITION_STATUS.holding,
} as const

export type {
  PoolType,
  PoolStatus,
  IntentionStatus,
  ResearchStatus,
  PositionStatus,
} from '@/types/modules/pool.types'
