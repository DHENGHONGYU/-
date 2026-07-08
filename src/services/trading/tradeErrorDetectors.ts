/**
 * @module tradeErrorDetectors
 * @description 12 类交易错误检测器（PR-7 步骤 7.3 提取）。
 *
 * 从 tradeErrorClassifier.ts 拆分（PR-7 方案 A），包含全部 12 个检测器函数：
 *  #1  detectChaseHighSellLow     追涨杀跌      critical  依赖 groupOrdersByDay（通过参数）
 *  #2  detectEarlyProfitTaking    提前止盈      major     依赖 buildTradePairs
 *  #3  detectNoStopLoss           扛单不止损    critical  依赖 buildTradePairs
 *  #4  detectAgainstTrendAdding   逆势加仓      critical  独立
 *  #5  detectGreedyTailChasing    贪鱼尾        major     依赖 buildTradePairs
 *  #6  detectPlanViolation        违反计划      critical  独立
 *  #7  detectHeavyGambling        重仓豪赌      critical  独立
 *  #8  detectRevengeTrading       报复性交易    major     独立
 *  #9  detectFomoEntry            FOMO入场      major     依赖 buildTradePairs
 *  #10 detectIgnoreStopLoss       忽视止损      critical  依赖 buildTradePairs
 *  #11 detectHesitationMiss       犹豫错过      minor     独立
 *  #12 detectOvertrading          过度交易      minor     依赖 groupOrdersByDay（通过参数）
 *
 * 依赖方向：
 *   - tradeErrorDefinitions（类型 + SEVERITY_PENALTY 常量）
 *   - tradeErrorUtils（buildTradePairs 函数）
 *   - @/data/types（Order 类型）
 *
 * 行为等价性：本模块所有函数均为原 tradeErrorClassifier.ts 行 227-595 的 1:1 迁移，
 * 不改任何算法、不调整阈值、不重命名。原文件中函数未导出（仅模块内可见），
 * 此处导出以供主入口 classifyErrors 调用。
 *
 * @see tradeErrorClassifier.ts — 主入口（re-export 本模块函数）
 * @see tradeErrorDefinitions.ts — 类型与常量
 * @see tradeErrorUtils.ts — 辅助函数
 */

import type { Order } from '@/data/types'
import type { DetectedError } from './tradeErrorDefinitions'
import { TradeErrorType, SEVERITY_PENALTY } from './tradeErrorDefinitions'
import { buildTradePairs } from './tradeErrorUtils'

// ============================================================
// 12 类错误检测器
// ============================================================

/**
 * 检测追涨杀跌
 * 逻辑：买入后价格回落较大，或卖出后价格反弹较大
 */
export function detectChaseHighSellLow(orders: Order[], _map: Map<string, Order[]>): DetectedError | null {
  const relatedIds: string[] = []
  const buyOrders = orders.filter((o) => o.direction === 'buy')
  const sellOrders = orders.filter((o) => o.direction === 'sell')

  // 简化检测：比较同 symbol 的买卖价格
  for (const buy of buyOrders) {
    const sameSymbolSells = sellOrders.filter(
      (s) => s.symbol === buy.symbol && s.createdAt > buy.createdAt,
    )
    const nearSells = sameSymbolSells.filter(
      (s) => s.createdAt - buy.createdAt < 24 * 60 * 60 * 1000,
    )
    // 买入后一天内卖出且亏损 >5%
    for (const sell of nearSells) {
      if (sell.price < buy.price * 0.95) {
        relatedIds.push(buy.id, sell.id)
      }
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.CHASE_HIGH_SELL_LOW,
    name: '追涨杀跌',
    severity: 'critical',
    psychologicalRoot: '贪婪与恐惧交替，缺乏独立判断，从众心理',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测提前止盈
 * 逻辑：盈利交易收益率 < 3%，且卖出后股价继续上涨
 */
export function detectEarlyProfitTaking(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct > 0 && pair.profitPct < 3) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.EARLY_PROFIT_TAKING,
    name: '提前止盈',
    severity: 'major',
    psychologicalRoot: '对利润的恐惧，害怕回吐浮盈，缺乏持仓信心',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测扛单不止损
 * 逻辑：持仓亏损超过 -10%
 */
export function detectNoStopLoss(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -10) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.NO_STOP_LOSS,
    name: '扛单不止损',
    severity: 'critical',
    psychologicalRoot: '损失厌恶，不愿承认错误，赌徒心理',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测逆势加仓
 * 逻辑：同 symbol 连续买入且价格递减
 */
export function detectAgainstTrendAdding(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const buyOrders = orders.filter((o) => o.direction === 'buy')

  // 按 symbol 分组
  const bySymbol = new Map<string, typeof buyOrders>()
  for (const order of buyOrders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  for (const [, symOrders] of bySymbol) {
    symOrders.sort((a, b) => a.createdAt - b.createdAt)
    let consecutiveCount = 0
    let prevPrice = 0
    for (const order of symOrders) {
      if (prevPrice > 0 && order.price < prevPrice) {
        consecutiveCount++
        if (consecutiveCount >= 2) {
          relatedIds.push(order.id)
        }
      } else {
        consecutiveCount = 0
      }
      prevPrice = order.price
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.AGAINST_TREND_ADDING,
    name: '逆势加仓',
    severity: 'critical',
    psychologicalRoot: '过度自信，想摊平成本，拒绝接受失败',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测贪鱼尾
 * 逻辑：买入后短期（3天内）价格开始下跌且跌幅 >3%
 */
export function detectGreedyTailChasing(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -3 && pair.holdDays <= 3) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.GREEDY_TAIL_CHASING,
    name: '贪鱼尾',
    severity: 'major',
    psychologicalRoot: '贪婪，追求完美，想抓住最后一段利润',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测违反计划（简化版：基于仓位和频次异常）
 */
export function detectPlanViolation(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []

  // 检测单笔仓位过大（> 30% 总资金）
  const totalValue = orders.reduce((sum, o) => sum + o.amount, 0)
  for (const order of orders) {
    if (totalValue > 0 && order.amount / totalValue > 0.3) {
      relatedIds.push(order.id)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.PLAN_VIOLATION,
    name: '违反计划',
    severity: 'critical',
    psychologicalRoot: '缺乏纪律，自我控制力弱，临场冲动',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测重仓豪赌
 * 逻辑：单笔仓位 > 30% 或单标的集中度 > 50%
 */
export function detectHeavyGambling(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const totalValue = orders.reduce((sum, o) => sum + o.amount, 0)

  if (totalValue === 0) return null

  // 按 symbol 汇总
  const bySymbol = new Map<string, number>()
  for (const order of orders) {
    const current = bySymbol.get(order.symbol) ?? 0
    bySymbol.set(order.symbol, current + order.amount)
  }

  for (const [symbol, amount] of bySymbol) {
    if (amount / totalValue > 0.5) {
      const symOrders = orders.filter((o) => o.symbol === symbol)
      relatedIds.push(...symOrders.map((o) => o.id))
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.HEAVY_GAMBLING,
    name: '重仓豪赌',
    severity: 'critical',
    psychologicalRoot: '急功近利，想快速翻本或暴富，风险意识不足',
    relatedOrderIds: relatedIds,
    count: 1,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测报复性交易
 * 逻辑：亏损后 30 分钟内频繁开仓
 */
export function detectRevengeTrading(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const sortedOrders = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const THIRTY_MIN = 30 * 60 * 1000

  for (let i = 1; i < sortedOrders.length; i++) {
    const prev = sortedOrders[i - 1]!
    const curr = sortedOrders[i]!
    const timeDiff = curr.createdAt - prev.createdAt

    // 前一笔亏损，后一笔在 30 分钟内开仓
    if (timeDiff < THIRTY_MIN && curr.direction === 'buy') {
      relatedIds.push(curr.id)
    }
  }

  if (relatedIds.length < 3) return null

  return {
    type: TradeErrorType.REVENGE_TRADING,
    name: '报复性交易',
    severity: 'major',
    psychologicalRoot: '愤怒、不甘心，想立刻挽回损失',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测 FOMO 入场
 * 逻辑：高频交易且无明显盈利逻辑（简化：买入后亏损 >3%）
 */
export function detectFomoEntry(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -3 && pair.holdDays <= 1) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.FOMO_ENTRY,
    name: 'FOMO入场',
    severity: 'major',
    psychologicalRoot: '害怕错过，跟风心理，同伴压力',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测忽视止损
 * 逻辑：亏损交易中无止损行为（简化：亏损 > 8% 的交易）
 */
export function detectIgnoreStopLoss(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -8) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.IGNORE_STOP_LOSS,
    name: '忽视止损',
    severity: 'critical',
    psychologicalRoot: '侥幸心理，过度自信，不愿接受小损失',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测犹豫错过
 * 逻辑：长时间无交易但存在明显机会（简化：交易间隔时间过长）
 */
export function detectHesitationMiss(orders: Order[]): DetectedError | null {
  if (orders.length < 2) return null

  const relatedIds: string[] = []
  const sortedOrders = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

  for (let i = 1; i < sortedOrders.length; i++) {
    const prev = sortedOrders[i - 1]!
    const curr = sortedOrders[i]!
    if (curr.createdAt - prev.createdAt > ONE_WEEK) {
      relatedIds.push(curr.id)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.HESITATION_MISS,
    name: '犹豫错过',
    severity: 'minor',
    psychologicalRoot: '过度谨慎，完美主义，害怕犯错',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.minor,
  }
}

/**
 * 检测过度交易
 * 逻辑：单日交易次数 > 10 笔
 */
export function detectOvertrading(_orders: Order[], dayGroups: Map<string, Order[]>): DetectedError | null {
  const relatedIds: string[] = []

  for (const [, dayOrders] of dayGroups) {
    if (dayOrders.length > 10) {
      relatedIds.push(...dayOrders.map((o) => o.id))
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.OVERTRADING,
    name: '过度交易',
    severity: 'minor',
    psychologicalRoot: '交易成瘾，无聊，寻求刺激',
    relatedOrderIds: relatedIds,
    count: 1,
    penalty: SEVERITY_PENALTY.minor,
  }
}
