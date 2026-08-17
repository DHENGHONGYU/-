/**
 * 三条禁令硬风险检测器（hardRisks）
 *
 * V9 无现成的「退市 / ST / 违规 / 处罚 / 立案」黑名单数据源。本模块维护显式黑名单
 * FORBIDDEN_STOCKS，由调用方传入 RLES 的 hardRisks 字段触发风险降级（×0.73，
 * 对标对方策略中对紫光「砍仓至 22%」的惩罚语义）。
 *
 * 职责分工：
 *  - V6 的 allRisks 已由 RLES 引擎内部正则（/退市|ST|违规|处罚|立案/）自动降级；
 *  - 本模块是「额外显式禁令」扩展点，用于维护 V6 未覆盖的权威黑名单；同时提供
 *    「名称弱判断」（名称含 *ST/ST 直接判 ST）作为无权威源时的兜底。
 *
 * 数据来源（可切换，默认显式表 + 名称兜底）：
 *  - detectHardRisks(symbol)            → 仅查 FORBIDDEN_STOCKS 显式黑名单
 *  - detectHardRisksByName(symbol,name) → 显式表 + 名称含 ST 弱判断
 *  - fetchStockRiskFlagsLive(symbol)    → 后端 /api/collect/risk 真实源（已落地）
 *  - detectHardRisksResilient(...)      → 组合三者（RLES 实际调用入口）
 */

import { API_COLLECT_RISK } from '@/config/apiPaths'

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

/** 名称弱判断：A股名称含 *ST / ST 即为风险警示，直接判 ST 类禁令。 */
export function isStByName(name: string | undefined): boolean {
  if (!name) return false
  return /(^\*?ST\b|\*?ST)/.test(name.toUpperCase())
}

/**
 * 真实风险源：后端 /api/collect/risk（BACKEND_FORBIDDEN_STOCKS + 腾讯名称推导 ST/退市）。
 *
 * 后端 collect_risk 返回 CollectResponse.data.flags（category:reason 标签数组）；
 * 失败（success=false）或无 flags 时返回 null，由 resilient 入口走显式表 + 名称兜底。
 */
export async function fetchStockRiskFlagsLive(symbol: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${API_COLLECT_RISK}?symbol=${encodeURIComponent(symbol)}`)
    if (!res.ok) return null
    const json = (await res.json()) as {
      success?: boolean
      data?: { flags?: string[] }
    }
    const flags = json.data?.flags
    return Array.isArray(flags) ? flags : null
  } catch {
    return null
  }
}

/** 检测器入口：返回该股票命中的三条禁令标签（空数组表示未命中，仅查显式表）。 */
export function detectHardRisks(symbol: string): string[] {
  return matchForbidden(symbol, FORBIDDEN_STOCKS)
}

/**
 * 组合检测入口：显式表 + 名称弱判断（无权威源时的稳健兜底）。
 * 名称含 ST 即补一条 st 标签。纯函数，便于单测。
 */
export function detectHardRisksByName(symbol: string, name?: string): string[] {
  const tags = matchForbidden(symbol, FORBIDDEN_STOCKS)
  if (isStByName(name)) tags.push('st:名称含ST风险警示')
  return tags
}

/**
 * RLES 实际调用入口（resilient）：显式表 + 名称兜底 + 真实源（若可用）。
 * live 源返回非空则叠加其标签；任意来源命中即触发风险降级。
 */
export async function detectHardRisksResilient(symbol: string, name?: string): Promise<string[]> {
  const tags = detectHardRisksByName(symbol, name)
  const live = await fetchStockRiskFlagsLive(symbol)
  if (live && live.length > 0) tags.push(...live)
  return tags
}
