/**
 * 市场宽度因子（MAS Breadth / breadthFactor）
 *
 * 逆向自"分级回踩 v3.2"的 MAS 市场动能（+7.59pp），将全市场涨跌广度折算为 0-100
 * 宽度分，接入 RLES D3 时机成熟度。设计来源：
 * deliverables/strategy-reverse-unified-v3.2.md（"E4市场≈MAS 市场动能分级"）。
 *
 * 数据来源（可切换，默认 mock 兜底）：
 *  - fetchMarketBreadth()      → MockMarketDataProvider（cockpit mock 源，含
 *                                up/down/limitUp/limitDown/totalStocks）
 *  - fetchMarketBreadthLive()  → 后端 /api/collect/breadth（东财 push2 全市场涨跌家数，已落地）
 *  - fetchMarketBreadthResilient() → 优先 live，失败回退 mock（RLES 实际调用入口）
 *
 * 真实源契约（collect_endpoints.py collect_breadth）：
 *  响应 CollectResponse.data = { up, down, flat, totalStocks, limitUp, limitDown, asOf }，
 *  失败时 success=false，前端 resilient 自动回退 mock，保证永远有分。
 */

import { MockMarketDataProvider, type MarketSentiment } from '@/cockpit/data/mockDataProvider'
import { API_COLLECT_BREADTH } from '@/config/apiPaths'

/** 市场宽度计算输入（取自 MarketSentiment 的广度字段） */
export interface MarketBreadthInput {
  up: number
  down: number
  flat?: number
  totalStocks: number
  limitUp: number
  limitDown: number
}

/** 是否启用真实市场宽度源（生产环境在 .env 置 RLES_USE_LIVE_BREADTH=true 生效） */
export const RLES_USE_LIVE_BREADTH =
  (typeof process !== 'undefined' && process.env?.RLES_USE_LIVE_BREADTH === 'true') || false

function clamp100(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/**
 * 将市场广度折算为 0-100 的市场宽度分（MAS 风格）。
 *  - 涨跌比（adv/dec）占 65%：强多头市场 → 接近 100，强空头 → 接近 0
 *  - 涨跌停比（limitUp/limitDown）占 35%：涨停潮 → 100，跌停潮 → 0
 * 该分越高，代表"市场宽度正向变化"（对标对方 MAS +7.59pp 加分）。
 */
export function computeBreadthScore(s: MarketBreadthInput): number {
  const total = Math.max(1, s.up + s.down)
  const advDec = (s.up - s.down) / total // [-1, 1]
  const advDecScore = 50 + advDec * 50

  const limitTotal = s.limitUp + s.limitDown
  const limitScore = limitTotal > 0 ? (s.limitUp / limitTotal) * 100 : 50

  return clamp100(advDecScore * 0.65 + limitScore * 0.35)
}

/** mock 兜底：拉取 cockpit 全市场情绪，折算为市场宽度分输入。无数据返回 null。 */
export async function fetchMarketBreadth(): Promise<MarketBreadthInput | null> {
  try {
    const sentiment: MarketSentiment = await MockMarketDataProvider.getMarketSentiment()
    return {
      up: sentiment.up,
      down: sentiment.down,
      flat: sentiment.flat,
      totalStocks: sentiment.totalStocks,
      limitUp: sentiment.limitUp,
      limitDown: sentiment.limitDown,
    }
  } catch {
    return null
  }
}

/**
 * 真实市场宽度源：后端 /api/collect/breadth（东财 push2 全市场涨跌家数）。
 *
 * 后端 collect_breadth 失败（success=false）或无 totalStocks 时返回 null，
 * 由 resilient 入口回退 cockpit mock，保证 RLES 永远有宽度分（中性兜底由引擎处理）。
 *
 * 启用：前端 .env 置 RLES_USE_LIVE_BREADTH=true（默认 false，使用 mock）。
 */
export async function fetchMarketBreadthLive(): Promise<MarketBreadthInput | null> {
  try {
    const res = await fetch(API_COLLECT_BREADTH)
    if (!res.ok) return null
    const json = (await res.json()) as {
      success?: boolean
      data?: {
        up: number
        down: number
        flat?: number
        totalStocks: number
        limitUp: number
        limitDown: number
      }
    }
    const d = json.data
    if (!d || d.totalStocks <= 0) return null
    return {
      up: d.up,
      down: d.down,
      flat: d.flat ?? 0,
      totalStocks: d.totalStocks,
      limitUp: d.limitUp,
      limitDown: d.limitDown,
    }
  } catch {
    return null
  }
}

/** RLES 实际调用入口：优先真实源，失败（或开关关闭）回退 mock。保证永远有分（中性兜底由引擎处理）。 */
export async function fetchMarketBreadthResilient(): Promise<MarketBreadthInput | null> {
  if (RLES_USE_LIVE_BREADTH) {
    const live = await fetchMarketBreadthLive()
    if (live && live.totalStocks > 0) return live
  }
  return fetchMarketBreadth()
}
