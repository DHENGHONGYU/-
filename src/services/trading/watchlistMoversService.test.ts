/**
 * @test_id V9-TEST-ST-126
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-BACK-025]
 */
import { describe, it, expect } from 'vitest'
import { computeWatchlistMovers, DEFAULT_TOP_N } from './watchlistMoversService'
import type { WatchlistData } from '@/types/modules/widget.types'

function makeStock(code: string, name: string, price: number, changePercent: number): WatchlistData {
  return { code, name, price, changePercent }
}

describe('computeWatchlistMovers', () => {
  it('returns empty lists for empty watchlist', () => {
    const result = computeWatchlistMovers([])
    expect(result.gainers).toEqual([])
    expect(result.losers).toEqual([])
    expect(result.mostActive).toEqual([])
  })

  it('ranks gainers descending and losers ascending', () => {
    const watchlist = [
      makeStock('A', 'A股', 10, 5.2),
      makeStock('B', 'B股', 20, 1.2),
      makeStock('C', 'C股', 30, -2.1),
      makeStock('D', 'D股', 40, -0.5),
      makeStock('E', 'E股', 50, 0),
    ]
    const result = computeWatchlistMovers(watchlist, 10)
    expect(result.gainers.map((s) => s.code)).toEqual(['A', 'B'])
    expect(result.losers.map((s) => s.code)).toEqual(['C', 'D'])
  })

  it('limits results to topN', () => {
    const watchlist = Array.from({ length: 10 }, (_, i) =>
      makeStock(`S${i}`, `Stock${i}`, i + 1, i + 1),
    )
    const result = computeWatchlistMovers(watchlist, DEFAULT_TOP_N)
    expect(result.gainers).toHaveLength(DEFAULT_TOP_N)
    expect(result.mostActive).toHaveLength(DEFAULT_TOP_N)
  })

  it('mostActive ranks by absolute change percent', () => {
    const watchlist = [
      makeStock('UP', '大涨', 100, 3.0),
      makeStock('DOWN', '大跌', 100, -5.5),
      makeStock('FLAT', '平盘', 100, 0.1),
    ]
    const result = computeWatchlistMovers(watchlist, 2)
    expect(result.mostActive.map((s) => s.code)).toEqual(['DOWN', 'UP'])
  })

  it('filters out invalid price entries', () => {
    const watchlist = [
      makeStock('A', 'A股', 10, 1.0),
      { code: 'B', name: 'B股', price: Number.NaN, changePercent: 2.0 },
    ] as WatchlistData[]
    const result = computeWatchlistMovers(watchlist)
    expect(result.gainers).toHaveLength(1)
    expect(result.gainers[0]?.code).toBe('A')
  })
})
