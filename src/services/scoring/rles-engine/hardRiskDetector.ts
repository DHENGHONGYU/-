/**
 * 三条禁令硬风险检测器（hardRisks）
 *
 * V9 无现成的"退市 / ST / 违规 / 处罚 / 立案"黑名单数据源。本模块维护显式黑名单
 * FORBIDDEN_STOCKS，由调用方传入 RLES 的 hardRisks 字段触发风险降级（×0.73，
 * 对标对方策略中对紫光"砍仓至 22%"的惩罚语义）。
 *
 * 职责分工：
 *  - V6 的 allRisks 已由 RLES 引擎内部正则（/退市|ST|违规|处罚|立案/）自动降级；
 *  - 本模块是"额外显式禁令"扩展点，用于维护 V6 未覆盖的权威黑名单（如交易所退市预警、
 *    ST 列表、监管处罚公告同步表），命中即叠加触发风险降级。
 */

export type ForbiddenCategory = 'delisting' | 'st' | 'violation' | 'penalty' | 'investigation'

export interface ForbiddenEntry {
  reason: string
  category: ForbiddenCategory
}

/**
 * 三条禁令黑名单（symbol → 命中原因）。
 *
 * 当前为空占位——生产环境应从权威源（交易所退市预警 / ST 特别处理列表 / 监管处罚公告 /
 * 立案调查公告）每日同步维护此表。命中任一条即触发 RLES 风险降级 ×0.73。
 *
 * 示例（仅演示结构，切勿直接填入真实股票）：
 *   '999999': { reason: '已公告终止上市', category: 'delisting' }
 */
export const FORBIDDEN_STOCKS: Record<string, ForbiddenEntry> = {}

/** 在黑名单中匹配给定股票，返回命中的原因标签数组。纯函数，便于单测。 */
export function matchForbidden(symbol: string, list: Record<string, ForbiddenEntry>): string[] {
  const hit = list[symbol]
  if (!hit) return []
  return [`${hit.category}:${hit.reason}`]
}

/** 检测器入口：返回该股票命中的三条禁令标签（空数组表示未命中）。 */
export function detectHardRisks(symbol: string): string[] {
  return matchForbidden(symbol, FORBIDDEN_STOCKS)
}
