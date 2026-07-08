/**
 * @module tradeErrorUtils
 * @description 交易错误检测辅助函数（PR-7 步骤 7.2 提取）。
 *
 * 从 tradeErrorClassifier.ts 拆分（PR-7 方案 A），负责：
 * - TradePair 接口（买卖配对结构）
 * - buildTradePairs() 买卖配对辅助函数（被 5 个检测器调用：#2 #3 #5 #9 #10）
 * - groupOrdersByDay() 按日分组辅助函数（被 #1 和 #12 通过主入口传参使用）
 *
 * 依赖方向：本模块依赖 tradeErrorDefinitions（无）+ @/data/types（Order 类型）+
 *   @/constants/trade.constants（PERCENTAGE_BASE 常量）。
 *
 * 行为等价性：本模块所有内容均为原 tradeErrorClassifier.ts 行 211-221 和
 * 行 601-647 的 1:1 迁移，不改任何算法、不调整字段、不重命名。
 *
 * ⚠️ 重复代码说明：tradeReviewAI.utils.ts:13 也有一份 buildTradePairs 实现，
 *   逻辑相同但字段少了 buyPrice/sellPrice。PR-7 采用策略 A（保守，不去重），
 *   保留本模块的 buyPrice/sellPrice 字段以维持接口完整性，
 *   去重任务由后续 PR-8 接管。
 *
 * @see tradeErrorDetectors.ts — 检测器（import 本模块函数）
 * @see tradeErrorClassifier.ts — 主入口（re-export 本模块函数）
 */

import type { Order } from '@/data/types'
import { PERCENTAGE_BASE } from '@/constants/trade.constants'

// ============================================================
// 买卖配对类型
// ============================================================

export interface TradePair {
  buyId: string
  sellId: string
  buyPrice: number
  sellPrice: number
  profitPct: number
  holdDays: number
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 构建买卖配对
 * 简化逻辑：按 symbol 和日期排序，pair 买入和卖出
 *
 * 行为契约：FIFO 配对，profitPct 用 PERCENTAGE_BASE 取整。
 */
export function buildTradePairs(orders: Order[]): TradePair[] {
  const pairs: TradePair[] = []
  const bySymbol = new Map<string, Order[]>()

  for (const order of orders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  for (const [, symOrders] of bySymbol) {
    symOrders.sort((a, b) => a.createdAt - b.createdAt)
    const buys: Order[] = []
    for (const order of symOrders) {
      if (order.direction === 'buy') {
        buys.push(order)
      } else if (buys.length > 0) {
        const buy = buys.shift()!
        const profitPct = ((order.price - buy.price) / buy.price) * 100
        const holdDays = Math.round((order.createdAt - buy.createdAt) / (24 * 60 * 60 * 1000))
        pairs.push({
          buyId: buy.id,
          sellId: order.id,
          buyPrice: buy.price,
          sellPrice: order.price,
          profitPct: Math.round(profitPct * PERCENTAGE_BASE) / PERCENTAGE_BASE,
          holdDays,
        })
      }
    }
  }

  return pairs
}

/**
 * 订单分组：按 symbol 和日期分组
 *
 * 行为契约：返回 Map<`${symbol}_${date}`, Order[]>。
 */
export function groupOrdersByDay(orders: Order[]): Map<string, Order[]> {
  const groups = new Map<string, Order[]>()
  for (const order of orders) {
    const date = new Date(order.createdAt).toISOString().slice(0, 10)
    const key = `${order.symbol}_${date}`
    const existing = groups.get(key) ?? []
    existing.push(order)
    groups.set(key, existing)
  }
  return groups
}
