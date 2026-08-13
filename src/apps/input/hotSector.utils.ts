import type { HotSector } from '@/services/input/hotSectorService'
import type { RankedSector } from './hotSector.types'
import { DYNAMIC_SCORE_WEIGHTS, MOMENTUM_WEIGHTS } from './hotSector.config'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 及时性窗口：近一周（7 天）内的评分视为及时 */
export const TIMELY_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** 及时性判定结果 */
export interface Timeliness {
  /** 是否在近一周内（评分及时） */
  timely: boolean
  /** 距今天数；无评分日期时为 null */
  daysAgo: number | null
}

/**
 * 评分及时性判定（考核标准·及时性要求）：近一周内（<=7 天）视为及时。
 * 无评分日期或日期非法时 daysAgo 为 null（timely=false，UI 显示"未标注"）。
 */
export function getTimeliness(scoreDate?: string, now: number = Date.now()): Timeliness {
  if (!scoreDate) return { timely: false, daysAgo: null }
  const t = new Date(scoreDate).getTime()
  if (Number.isNaN(t)) return { timely: false, daysAgo: null }
  const daysAgo = Math.floor((now - t) / DAY_MS)
  return { timely: daysAgo <= TIMELY_WINDOW_DAYS, daysAgo }
}

/** 抽取出的代表股（含板块归属与及时性信息） */
export interface RepresentativePick {
  symbol: string
  name: string
  sectorCode: string
  sectorName: string
  /** 所属板块综合评分（用于排序） */
  sectorScore: number
  timely: boolean
  daysAgo: number | null
}

/**
 * 抽取代表股（来源一·热门赛道）：按板块综合评分降序，跨板块去重，
 * 抽取前 limit（默认 20）只作为候选筛选清单。
 *
 * @param sectors 按动态分降序的板块列表（通常传 rankedSectors）
 * @param options.limit 抽取数量上限（默认 20，符合"15-20 只"要求）
 * @param options.timelyOnly 是否仅抽取近一周内有评分的板块代表股
 */
export function extractRepresentativeStocks(
  sectors: HotSector[],
  options: { limit?: number; timelyOnly?: boolean } = {},
): RepresentativePick[] {
  const limit = options.limit ?? 20
  const picked = new Map<string, RepresentativePick>()
  for (const sector of sectors) {
    const { timely, daysAgo } = getTimeliness(sector.scoreDate)
    if (options.timelyOnly && !timely) continue
    for (const stock of sector.stocks) {
      if (picked.has(stock.symbol)) continue
      picked.set(stock.symbol, {
        symbol: stock.symbol,
        name: stock.name,
        sectorCode: sector.code,
        sectorName: sector.name,
        sectorScore: sector.score,
        timely,
        daysAgo,
      })
    }
  }
  return Array.from(picked.values())
    .sort((a, b) => b.sectorScore - a.sectorScore)
    .slice(0, limit)
}

/**
 * 动态权重排序：综合原始评分(60%) + 资金热度(30%) + 动量强度(10%)
 *
 * - 资金权重：资金因子(fundFlow) 与 动量因子(momentum) 的加权均值
 * - 动量权重：情绪因子(sentiment) 60% + 估值因子(valuation) 40%
 *
 * @param sectors 原始板块列表
 * @returns 按 dynamicScore 降序排列的板块列表
 */
export function rankSectorsByDynamicScore(sectors: HotSector[]): RankedSector[] {
  const ranked = sectors.map((sector) => {
    // 资金权重：资金因子(fundFlow) 与 动量因子(momentum) 的加权均值
    const capitalWeight = (sector.factors.fundFlow + sector.factors.momentum) / 2
    // 动量权重：情绪因子(sentiment) 与 估值因子(valuation) 的加权
    const momentumWeight =
      sector.factors.sentiment * MOMENTUM_WEIGHTS.sentiment +
      sector.factors.valuation * MOMENTUM_WEIGHTS.valuation
    // 动态综合评分
    const dynamicScore =
      sector.score * DYNAMIC_SCORE_WEIGHTS.original +
      capitalWeight * DYNAMIC_SCORE_WEIGHTS.capital +
      momentumWeight * DYNAMIC_SCORE_WEIGHTS.momentum

    logger.info('[HotSectorSection][动态权重]', {
      sectorCode: sector.code,
      sectorName: sector.name,
      originalScore: sector.score,
      capitalWeight: capitalWeight.toFixed(2),
      momentumWeight: momentumWeight.toFixed(2),
      dynamicScore: dynamicScore.toFixed(2),
    })

    return { ...sector, dynamicScore }
  })

  return ranked.sort((a, b) => b.dynamicScore - a.dynamicScore)
}
