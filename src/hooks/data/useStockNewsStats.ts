/**
 * @fileoverview 个股资讯统计数据 Hook
 * 封装 newsStatsService 调用，作为组件与 Service 之间的防腐层
 */

import { useEffect, useState } from 'react'
import {
  getStockNewsStats,
  type StockNewsStats as StatsType,
} from '@/services/pool/newsStatsService'

export function useStockNewsStats(symbol: string): {
  stats: StatsType | null
  loading: boolean
} {
  const [stats, setStats] = useState<StatsType | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const result = await getStockNewsStats(symbol)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!cancelled) {
        setStats(result)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [symbol])

  return { stats, loading }
}
