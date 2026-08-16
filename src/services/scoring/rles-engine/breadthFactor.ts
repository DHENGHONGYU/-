/**
 * 市场宽度因子（MAS Breadth / breadthFactor）
 *
 * 逆向自"分级回踩 v3.2"的 MAS 市场动能（+7.59pp），将全市场涨跌广度折算为 0-100
 * 宽度分，接入 RLES D3 时机成熟度。设计来源：
 * deliverables/strategy-reverse-unified-v3.2.md（"E4市场≈MAS 市场动能分级"）。
 *
 * 数据来源：MockMarketDataProvider.getMarketSentiment()（cockpit mock 源，含
 * up/down/limitUp/limitDown/totalStocks）。生产环境可替换为真实市场宽度接口。
 */

import { MockMarketDataProvider, type MarketSentiment } from '@/cockpit/data/mockDataProvider'

/** 市场宽度计算输入（取自 MarketSentiment 的广度字段） */
export interface MarketBreadthInput {
  up: number
  down: number
  flat?: number
  totalStocks: number
  limitUp: number
  limitDown: number
}

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

/** 拉取全市场情绪（涨跌家数/涨跌停），折算为市场宽度分。无数据返回 null（RLES 中性降级）。 */
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
