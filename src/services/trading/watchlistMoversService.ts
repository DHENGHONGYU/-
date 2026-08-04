/**
 * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
 */
import type { WatchlistData } from '@/types/modules/widget.types'

export interface WatchlistMover {
  name: string
  code: string
  price: number
  changePercent: number
}

export interface WatchlistMoversResult {
  gainers: WatchlistMover[]
  losers: WatchlistMover[]
  mostActive: WatchlistMover[]
}

/**
 * DEFAULT_TOP_N
 */
export const DEFAULT_TOP_N = 5

/**
 * 计算自选股异动榜：涨幅榜 / 跌幅榜 / 振幅榜。
 * 纯函数，不依赖外部状态，便于单测。
 *
 * @param watchlist 自选股行情数据
 * @param topN 每个榜单最多返回条目数
 * @returns 分类后的异动榜
 */
export function computeWatchlistMovers(
  watchlist: WatchlistData[],
  topN = DEFAULT_TOP_N,
): WatchlistMoversResult {
  const valid = watchlist.filter(
    (s): s is WatchlistData & { price: number; changePercent: number } =>
      typeof s.price === 'number' && !Number.isNaN(s.price)
      && typeof s.changePercent === 'number' && !Number.isNaN(s.changePercent),
  )

  const sortedByChange = [...valid].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
  const gainers = sortedByChange
    .filter((s) => (s.changePercent ?? 0) > 0)
    .slice(0, topN)
    .map(toMover)
  const losers = sortedByChange
    .filter((s) => (s.changePercent ?? 0) < 0)
    .slice(-topN)
    .reverse()
    .map(toMover)

  const sortedByAbsChange = [...valid].sort(
    (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0),
  )
  const mostActive = sortedByAbsChange.slice(0, topN).map(toMover)

  return { gainers, losers, mostActive }
}

function toMover(stock: WatchlistData): WatchlistMover {
  return {
    name: stock.name,
    code: stock.code,
    price: (stock.price ?? 0),
    changePercent: (stock.changePercent ?? 0),
  }
}
