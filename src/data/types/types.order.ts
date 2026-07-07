/**
 * @fileoverview 订单/观察列表域类型（L1 交易业务域）
 *
 * 包含订单和观察列表类型。
 *
 * @module data/types/types.order
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 */

import type { AccountType, OrderDirection, OrderStatus } from '@/config/dbConfig'

/** 交易订单 */
export interface Order {
  id: string
  symbol: string
  direction: OrderDirection
  quantity: number
  price: number
  amount: number
  status: OrderStatus
  accountType: AccountType
  createdAt: number
}

/** 观察列表 */
export interface Watchlist {
  id: string
  name: string
  items: string[]
  createdAt: number
  updatedAt: number
}
