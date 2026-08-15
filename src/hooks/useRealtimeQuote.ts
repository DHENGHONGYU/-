/**
 * @fileoverview 实时行情 Hook
 * 封装实时行情数据获取、自动刷新和状态管理
 *
 * @module hooks/useRealtimeQuote
 * @doc [V9-DOC-FRONT-020]
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchBasicData, type BasicData } from '@/services/collect'
import { useFreshData } from './useFreshData'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface UseRealtimeQuoteOptions {
  /** 股票代码 */
  symbol: string
  /** 自动刷新间隔（毫秒），默认 30 秒 */
  refreshIntervalMs?: number
  /** 是否启用自动刷新，默认 true */
  enabled?: boolean
}

export interface UseRealtimeQuoteResult {
  /** 行情数据 */
  data: BasicData | null
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
  /** 强制刷新 */
  refresh: () => Promise<void>
}

// ============================================================
// Hook 实现
// ============================================================

/**
 * 实时行情 Hook
 *
 * 自动获取并实时刷新股票行情数据，支持页面可见性变化时的智能刷新。
 *
 * @param options - 配置选项
 * @returns 行情状态与操作方法
 *
 * @example
 * ```tsx
 * const { data, loading, error, refresh } = useRealtimeQuote({
 *   symbol: '600519',
 *   refreshIntervalMs: 30_000,
 * })
 * ```
 */
export function useRealtimeQuote(options: UseRealtimeQuoteOptions): UseRealtimeQuoteResult {
  const { symbol, refreshIntervalMs = 30_000, enabled = true } = options

  const [data, setData] = useState<BasicData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(0)

  const isRefreshingRef = useRef(false)

  // 刷新函数
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return

    isRefreshingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const result = await fetchBasicData(symbol)

      if (result) {
        setData(result)
        setLastUpdated(Date.now())
        logger.info(`[useRealtimeQuote:${symbol}] 行情刷新成功: price=${result.price}`)
      } else {
        setError('获取行情失败')
        logger.warn(`[useRealtimeQuote:${symbol}] 行情刷新失败`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setError(errorMsg)
      logger.error(`[useRealtimeQuote:${symbol}] 行情刷新异常`, { error: errorMsg })
    } finally {
      setLoading(false)
      isRefreshingRef.current = false
    }
  }, [symbol])

  // 初始加载
  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  // 定时自动刷新
  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      void refresh()
    }, refreshIntervalMs)

    return () => clearInterval(timer)
  }, [enabled, refresh, refreshIntervalMs])

  // 使用 useFreshData 实现智能刷新
  const { isStale, secondsSinceUpdate, forceRefresh } = useFreshData({
    lastUpdated,
    maxStaleMs: refreshIntervalMs,
    refresh,
    enabled,
    label: `quote:${symbol}`,
  })

  return {
    data,
    loading,
    error,
    lastUpdated,
    secondsSinceUpdate,
    isStale,
    refresh: forceRefresh,
  }
}
