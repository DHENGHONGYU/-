/**
 * @fileoverview K线数据 Hook
 * 封装K线数据获取、自动刷新和状态管理
 *
 * @module hooks/useKline
 * @doc [V9-DOC-FRONT-020]
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchKlineData, type KlineData } from '@/services/collect'
import { useFreshData } from './useFreshData'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export type KlinePeriod = '1min' | '5min' | '15min' | '30min' | '60min' | 'daily' | 'weekly' | 'monthly'

export interface UseKlineOptions {
  /** 股票代码 */
  symbol: string
  /** K线周期，默认 daily */
  period?: KlinePeriod
  /** 复权方式，默认 qfq（前复权） */
  adjust?: 'qfq' | 'hfq' | ''
  /** K线数量，默认 60 */
  count?: number
  /** 自动刷新间隔（毫秒），默认 60 秒 */
  refreshIntervalMs?: number
  /** 是否启用自动刷新，默认 true */
  enabled?: boolean
}

export interface UseKlineResult {
  /** K线数据 */
  data: KlineData | null
  /** 加载中状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳（ms） */
  lastUpdated: number
  /** 距上次更新的秒数 */
  secondsSinceUpdate: number
  /** 是否数据已过期 */
  isStale: boolean
  /** 当前周期 */
  period: KlinePeriod
  /** 更新周期 */
  setPeriod: (period: KlinePeriod) => void
  /** 强制刷新 */
  refresh: () => Promise<void>
}

// ============================================================
// Hook 实现
// ============================================================

/**
 * K线数据 Hook
 *
 * 自动获取并实时刷新股票K线数据，支持周期切换和智能刷新。
 *
 * @param options - 配置选项
 * @returns K线状态与操作方法
 *
 * @example
 * ```tsx
 * const { data, loading, period, setPeriod, refresh } = useKline({
 *   symbol: '600519',
 *   period: 'daily',
 *   count: 60,
 * })
 * ```
 */
export function useKline(options: UseKlineOptions): UseKlineResult {
  const {
    symbol,
    period: initialPeriod = 'daily',
    adjust = 'qfq',
    count = 60,
    refreshIntervalMs = 60_000,
    enabled = true,
  } = options

  const [data, setData] = useState<KlineData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(0)
  const [period, setPeriod] = useState<KlinePeriod>(initialPeriod)

  const isRefreshingRef = useRef(false)

  // 刷新函数
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return

    isRefreshingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const result = await fetchKlineData({
        symbol,
        period,
        adjust,
        count,
      })

      if (result) {
        setData(result)
        setLastUpdated(Date.now())
        logger.info(`[useKline:${symbol}] K线刷新成功: period=${period} bars=${result.history.length}`)
      } else {
        setError('获取K线失败')
        logger.warn(`[useKline:${symbol}] K线刷新失败: period=${period}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setError(errorMsg)
      logger.error(`[useKline:${symbol}] K线刷新异常`, { error: errorMsg })
    } finally {
      setLoading(false)
      isRefreshingRef.current = false
    }
  }, [symbol, period, adjust, count])

  // 初始加载和周期变化时重新加载
  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  // 使用 useFreshData 实现智能刷新
  const { isStale, secondsSinceUpdate, forceRefresh } = useFreshData({
    lastUpdated,
    maxStaleMs: refreshIntervalMs,
    refresh,
    enabled,
    label: `kline:${symbol}:${period}`,
  })

  return {
    data,
    loading,
    error,
    lastUpdated,
    secondsSinceUpdate,
    isStale,
    period,
    setPeriod,
    refresh: forceRefresh,
  }
}
