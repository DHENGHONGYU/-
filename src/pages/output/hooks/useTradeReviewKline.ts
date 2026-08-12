/**
 * @fileoverview 交易复盘 K 线数据与标记 Hook
 * 封装 fetcherClient 和 buySellPointMarkerBuilder 的调用，作为页面与 Service 之间的防腐层
 */

import { useEffect, useMemo, useState } from 'react'
import { collectKline } from '@/services/fetcher/fetcherClient'
import { ordersToMarkers } from '@/services/trading/buySellPointMarkerBuilder'
import type { KlinePeriod, KlineAdjust } from '@/types/modules/tradeReviewAI.types'
import type { CandlestickChartData } from '@/components/chart'
import type { Order } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export function useTradeReviewKline(
  primarySymbol: string | null,
  orders: Order[],
  adaptKlineResponseToChartData: (history: unknown[]) => CandlestickChartData[],
  generateDemoKlineData: (orders: Order[]) => CandlestickChartData[],
) {
  const [period, setPeriod] = useState<KlinePeriod>('daily')
  const [adjust, setAdjust] = useState<KlineAdjust>('qfq')
  const [klineData, setKlineData] = useState<CandlestickChartData[]>([])
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<'real' | 'demo' | 'loading'>('loading')

  const markers = useMemo(() => ordersToMarkers(orders), [orders])

  useEffect(() => {
    if (!primarySymbol) {
      setKlineData([])
      setDataSource('loading')
      return
    }

    let cancelled = false
    setLoading(true)

    const isDaily = period === 'daily' || period === 'weekly' || period === 'monthly'
    const effectiveAdjust = isDaily ? adjust : ''

    collectKline({
      symbol: primarySymbol,
      period,
      adjust: effectiveAdjust,
      count: 320,
    })
      .then((response) => {
        if (cancelled) return
        if (response.success && response.data?.history && response.data.history.length > 0) {
          const chartData = adaptKlineResponseToChartData(response.data.history)
          setKlineData(chartData)
          setDataSource('real')
        } else {
          setKlineData(generateDemoKlineData(orders))
          setDataSource('demo')
        }
      })
      .catch((err) => {
        if (cancelled) return
        logger.warn('[useTradeReviewKline] K 线数据获取失败，降级到 demo', { error: err })
        setKlineData(generateDemoKlineData(orders))
        setDataSource('demo')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [primarySymbol, period, adjust, orders, adaptKlineResponseToChartData, generateDemoKlineData])

  return {
    period,
    setPeriod,
    adjust,
    setAdjust,
    klineData,
    loading,
    dataSource,
    markers,
  }
}
