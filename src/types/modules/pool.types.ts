/**
 * @module pool.types
 * @description 股票池三分拆类型定义。
 *
 * 将原有单一股票池拆分为：
 * - IntentionPool（意向候选池）：初步筛选，候选标的较多
 * - ResearchPool（研究精选池）：深度研究标的
 * - PositionPool（持仓池）：实际持仓
 *
 * 物理存储仍使用 IndexedDB `stocks` store，通过 `pool` 字段区分。
 *
 * @version v1.0.0
  * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-BACK-015, V9-DOC-QA-066]
*/

import type { DataSource } from '@/config/dbConfig'
import type { StockDataQuality } from '@/data/types/types.stock'

// ============================================================
// Pool 类型
// ============================================================

/** 股票池类型 */
export const POOL_TYPE = {
  intention: 'intention',
  research: 'research',
  position: 'position',
} as const

export type PoolType = (typeof POOL_TYPE)[keyof typeof POOL_TYPE]

// ============================================================
// Pool 状态
// ============================================================

/** 意向池状态 */
export const INTENTION_STATUS = {
  screening: 'screening',
  watchlist: 'watchlist',
  archived: 'archived',
} as const

export type IntentionStatus =
  (typeof INTENTION_STATUS)[keyof typeof INTENTION_STATUS]

/** 研究池状态（兼容原 RESEARCH_STATUS 语义） */
export const RESEARCH_STATUS = {
  candidate: 'candidate',
  screened: 'screened',
  deepDive: 'deepDive',
  watching: 'watching',
  archived: 'archived',
} as const

export type ResearchStatus =
  (typeof RESEARCH_STATUS)[keyof typeof RESEARCH_STATUS]

/** 持仓池状态 */
export const POSITION_STATUS = {
  holding: 'holding',
  partial: 'partial',
  closed: 'closed',
} as const

export type PositionStatus =
  (typeof POSITION_STATUS)[keyof typeof POSITION_STATUS]

/** 全量池状态联合类型 */
export type PoolStatus = IntentionStatus | ResearchStatus | PositionStatus

// ============================================================
// Pool 条目
// ============================================================

/** 股票池条目基础字段 */
export interface PoolItemBase {
  symbol: string
  name: string
  pool: PoolType
  status: PoolStatus
  price?: number
  pe?: number
  pb?: number
  roe?: number
  marketCap?: number
  source: DataSource
  dataVersion: number
  dataQuality?: StockDataQuality
  ingestedAt?: number
  updatedAt?: number
  industryCode?: string
  theme?: string[]
  sector?: string
  group?: string
}

/** 意向池条目 */
export interface IntentionPoolItem extends PoolItemBase {
  pool: 'intention'
  status: IntentionStatus
  screenReason?: string
}

/** 研究池条目 */
export interface ResearchPoolItem extends PoolItemBase {
  pool: 'research'
  status: ResearchStatus
  researchNote?: string
}

/** 持仓池条目 */
export interface PositionPoolItem extends PoolItemBase {
  pool: 'position'
  status: PositionStatus
  quantity: number
  avgCost: number
  currentPrice: number
}

/** 股票池条目联合类型 */
export type PoolItem = IntentionPoolItem | ResearchPoolItem | PositionPoolItem

// ============================================================
// 流转相关
// ============================================================

/** 流转目标（跨池 + 状态） */
export interface PoolTransitionTarget {
  pool: PoolType
  status: PoolStatus
  label: string
}

/** 分组/列元数据 */
export interface PoolLane {
  status: PoolStatus
  label: string
  items: PoolItem[]
  options: PoolTransitionTarget[]
}
