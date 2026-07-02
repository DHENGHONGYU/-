/**
 * @module store/helpers/withBroadcast
 * @lifecycle @Global
 * @description Store 写操作广播工具
 *
 * 为 Zustand Store 提供统一的 EventBus 广播能力，避免每个 Store 手写 emit。
 * 使用方式：
 *
 * ```ts
 * import { create } from 'zustand'
 * import { withBroadcast } from '@/store/helpers/withBroadcast'
 *
 * export const useFooStore = create<FooState>((set, get) => ({
 *   items: [],
 *   addItem: (item) => {
 *     set((s) => ({ items: [...s.items, item] }))
 *     withBroadcast('FOO_CHANGED', { item })
 *   },
 * }))
 * ```
 *
 * Channel 常量应从 `@/constants/store-channels.constants` 的 EVENT_NAMES 引用。
 */

import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 在 Store 写操作完成后广播事件
 *
 * @param eventName 事件名称（建议从 EVENT_NAMES 常量引用）
 * @param payload 事件载荷（可选）
 *
 * 使用示例：
 * ```ts
 * set((s) => ({ stocks: [...s.stocks, stock] }))
 * withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { symbol: stock.symbol })
 * ```
 */
export function withBroadcast(eventName: string, payload?: unknown): void {
  try {
    eventBus.emit(eventName, payload)
  } catch (err) {
    // 广播失败不应影响 Store 写操作本身
    logger.error(`[withBroadcast] emit failed: event="${eventName}", error=${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * 创建带广播的 setter 工具函数
 *
 * 适用于简单的「set + broadcast」场景，减少样板代码。
 *
 * @param eventName 广播事件名
 * @returns 一个函数，接收 set 函数和 payload，执行 set 后广播
 *
 * 使用示例：
 * ```ts
 * const broadcastStocks = createBroadcaster(EVENT_NAMES.STOCKS_CHANGED)
 * addItem: (item) => {
 *   set((s) => ({ items: [...s.items, item] }))
 *   broadcastStocks({ item })
 * }
 * ```
 */
export function createBroadcaster(eventName: string): (payload?: unknown) => void {
  return (payload?: unknown) => withBroadcast(eventName, payload)
}
