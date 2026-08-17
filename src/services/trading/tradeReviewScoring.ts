/**
 * @fileoverview 交易复盘评分计算
 *
 * 职责：
 * - 将交易复盘相关的评分计算（如纪律分）从采集层/Mock 数据生成器中提取到分析层
 * - 支持注入评分策略，便于生产环境接入真实复盘分析服务
 *
 * 架构变更（P5-7）：
 * - disciplineScore 等评分不再在 mockDataCollection.ts 中硬编码生成
 * - 通过 ScoreCalculator 接口统一计算入口
 *
 * @see src/services/data-collector/mockDataCollection.ts — 消费方
 */
import type { Order } from '@/data/types'

/**
 * 同步订单数据源（注入式）。
 * 解决「引擎层(services)禁止直接依赖 store 层」的架构约束：本模块不直接 import useOrderStore，
 * 而由 store 层（disciplineStore，本就允许读取 useOrderStore）在初始化时注入同步快照读取器。
 * 默认返回空数组（未注入时视为无纪律信号）。
 */
type OrderDataSource = () => Order[]
let orderDataSource: OrderDataSource = () => []
export function setOrderDataSource(fn: OrderDataSource): void {
  orderDataSource = fn
}

/**
 * 交易复盘评分计算器接口
  * @doc [V9-DOC-BACK-008, V9-DOC-BACK-012, V9-DOC-BACK-005, V9-DOC-BACK-013, V9-DOC-ARCH-008]
*/
export interface TradeReviewScoreCalculator {
  /** 计算交易纪律分（0-100） */
  calculateDisciplineScore(): number
}

/**
 * Mock 交易复盘评分计算器
 * @description 仅用于测试/特殊场景的显式注入（setTradeReviewScoreCalculator(new Mock…)）。
 *   生产环境默认使用 RealTradeReviewScoreCalculator（基于真实订单数据计算纪律分）。
 */
export class MockTradeReviewScoreCalculator implements TradeReviewScoreCalculator {
  calculateDisciplineScore(): number {
    // Mock 环境返回 50-100 之间的随机纪律分
    return Math.floor(Math.random() * 51) + 50
  }
}

/**
 * 真实交易复盘评分计算器（v34 落地：基于真实订单数据计算纪律分）
 * @description 从 useOrderStore 的实时订单流水（同步快照，disciplineStore 同模式，@see src/store/disciplineStore.ts:191）
 *   计算透明可解释的纪律分（0-100）：胜率(50%) + 执行完成度(25%) + 仓位纪律(25%)。
 *   无真实订单数据时返回 0（无纪律信号），由调用方决定兜底；
 *   标注为 v1 启发式，待接入专用交易复盘分析服务后替换。
 */
export class RealTradeReviewScoreCalculator implements TradeReviewScoreCalculator {
  calculateDisciplineScore(): number {
    // 通过注入式同步数据源读取实时订单快照（由 disciplineStore 注入 useOrderStore 读取器）
    const orders = orderDataSource()
    if (!orders || orders.length === 0) {
      return 0
    }

    const winRate = computeWinRate(orders)
    const fillRate = computeFillRate(orders)
    const amountDiscipline = computeAmountDiscipline(orders)

    const score = Math.round(winRate * 50 + fillRate * 25 + amountDiscipline * 25)
    return Math.max(0, Math.min(100, score))
  }
}

/** 按标的聚合买卖金额，计算盈利标的占比（近似胜率） */
function computeWinRate(orders: Order[]): number {
  const bySymbol = new Map<string, { buy: number; sell: number }>()
  for (const o of orders) {
    const entry = bySymbol.get(o.symbol) ?? { buy: 0, sell: 0 }
    if (o.direction === 'sell') entry.sell += o.amount
    else entry.buy += o.amount
    bySymbol.set(o.symbol, entry)
  }
  let wins = 0
  let total = 0
  for (const { buy, sell } of bySymbol.values()) {
    if (buy <= 0) continue
    total += 1
    if (sell > buy) wins += 1
  }
  return total === 0 ? 0 : wins / total
}

/** 成交完成度：filled 订单占比 */
function computeFillRate(orders: Order[]): number {
  const filled = orders.filter((o) => o.status === 'filled').length
  return orders.length === 0 ? 0 : filled / orders.length
}

/** 仓位纪律：成交金额离散度（变异系数），越低越纪律 */
function computeAmountDiscipline(orders: Order[]): number {
  const amounts = orders.map((o) => o.amount).filter((a) => a > 0)
  if (amounts.length < 2) return 1
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
  if (mean === 0) return 1
  const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length
  const cv = Math.sqrt(variance) / mean
  return Math.max(0, Math.min(1, 1 - cv))
}

let injectedCalculator: TradeReviewScoreCalculator | undefined

/**
 * 注入交易复盘评分计算器
 */
export function setTradeReviewScoreCalculator(calculator: TradeReviewScoreCalculator): void {
  injectedCalculator = calculator
}

/**
 * 获取当前评分计算器
 */
export function getTradeReviewScoreCalculator(): TradeReviewScoreCalculator {
  // v34 复盘评分真实化落地：默认返回「真实订单驱动」的计算器，
  // Mock 仅作为测试/特殊场景的显式注入（setTradeReviewScoreCalculator(new Mock…)）。
  injectedCalculator ??= new RealTradeReviewScoreCalculator()
  return injectedCalculator
}

/**
 * 重置为默认（真实订单驱动）评分计算器
 */
export function resetTradeReviewScoreCalculator(): void {
  injectedCalculator = new RealTradeReviewScoreCalculator()
}
