/**
 * @module pool.types
 * @description 股票池模块类型定义
 */

import type { ResearchStatus } from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import type { PoolTransitionOption } from '@/core/poolTransitionEngine'

/** 股票池分组 */
export interface PoolGroup {
  status: ResearchStatus
  label: string
  stocks: Stock[]
  options: PoolTransitionOption[]
}
