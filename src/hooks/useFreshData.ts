/**
 * @module useFreshData
 * @description 数据新鲜度自动刷新 Hook。
 *
 * 监听 Store 数据的 lastUpdated 时间戳，
 * 当数据超过 maxStaleMs 时自动触发 refresh。
 * 支持 document.visibilitychange 事件自动检查：
 * 页面重新可见时，检查所有注册的数据源是否过期。
 *
 * 纯 UI 层 Hook，不改变现有 Store 接口。
 *
 * @see src/core/refreshCoordinator.ts -- 跨 Store 刷新协调
 * @see docs/implementation/freshness-alerts.md -- 数据新鲜度告警策略
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface UseFreshDataOptions {
  /** 数据的最后更新时间戳（ms） */
  lastUpdated: number
  /** 最大允许过期时间（ms），超过此值数据被视为过期 */
  maxStaleMs: number
  /** 刷新回调函数 */
  refresh: () => Promise<void>
  /** 是否启用（默认 true） */
  enabled?: boolean
  /** 日志标签，用于调试追踪 */
  label?: string
}

export interface UseFreshDataResult {
  /** 数据是否已过期 */
  isStale: boolean
  /** 距上次更新的秒数 */
  secondsSinceUpdate: number
  /** 强制立即刷新 */
  forceRefresh: () => void
}

// ============================================================
// 全局注册表：收集所有活跃的 useFreshData 实例
// ============================================================

/**
 * visibilitychange 事件处理器注册表。
 * 页面重新可见时，遍历所有注册实例，检查并刷新过期数据。
 */
const visibilityHandlers = new Set<() => void>()
let visibilityListenerAttached = false

/**
 * 添加 visibilitychange 全局监听器（仅首次添加）。
 * 页面重新可见时调用所有注册的检查函数。
 */
function ensureVisibilityListener(): void {
  if (visibilityListenerAttached) return
  visibilityListenerAttached = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return

    logger.info('[useFreshData] 页面重新可见，检查所有数据源新鲜度')
    const handlers = Array.from(visibilityHandlers)
    for (const handler of handlers) {
      try {
        handler()
      } catch (err) {
        logger.error('[useFreshData] visibilitychange handler error', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  })
}

// ============================================================
// Hook 实现
// ============================================================

/**
 * 数据新鲜度自动刷新 Hook。
 *
 * @param options - 配置选项
 * @returns 新鲜度状态与强制刷新方法
 *
 * @example
 * ```tsx
 * // 在组件中使用
 * const lastUpdated = useOrderStore((s) => s.lastUpdated)
 * const refresh = useOrderStore((s) => s.refresh)
 *
 * const { isStale, secondsSinceUpdate, forceRefresh } = useFreshData({
 *   lastUpdated,
 *   maxStaleMs: 60_000, // 60秒
 *   refresh,
 *   label: 'orderStore',
 * })
 * ```
/**
 * useFreshData
 * @param options
 * @returns UseFreshDataResult
 */
export function useFreshData(options: UseFreshDataOptions): UseFreshDataResult {
  const { lastUpdated, maxStaleMs, refresh, enabled = true, label = 'unknown' } = options

  const [now, setNow] = useState(() => Date.now())
  const isRefreshingRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  // 每秒更新当前时间，用于计算 secondsSinceUpdate
  useEffect(() => {
    if (enabled) {
      const timer = setInterval(() => {
        setNow(Date.now())
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [enabled])

  // 计算是否过期
  const isStale = enabled && lastUpdated > 0 && (now - lastUpdated) > maxStaleMs
  const secondsSinceUpdate = lastUpdated > 0 ? Math.floor((now - lastUpdated) / 1000) : 0

  // 强制刷新
  const forceRefresh = useCallback(() => {
    if (isRefreshingRef.current) {
      logger.debug(`[useFreshData:${label}] forceRefresh skipped: already refreshing`)
      return
    }
    isRefreshingRef.current = true
    logger.info(`[useFreshData:${label}] forceRefresh triggered`)
    refresh().finally(() => {
      isRefreshingRef.current = false
    })
  }, [refresh, label])

  // 自动刷新：检测到过期时自动触发一次
  useEffect(() => {
    if (!enabled || !isStale || isRefreshingRef.current) return

    logger.info(`[useFreshData:${label}] 数据过期，自动刷新`, {
      lastUpdated,
      maxStaleMs,
      secondsSinceUpdate,
    })

    isRefreshingRef.current = true
    refresh().finally(() => {
      isRefreshingRef.current = false
    })
  }, [enabled, isStale, lastUpdated, maxStaleMs, refresh, label, secondsSinceUpdate])

  // 注册到 visibilitychange 全局监听
  useEffect(() => {
    if (!enabled) return

    const checkAndRefresh = () => {
      const currentOptions = optionsRef.current
      const currentLastUpdated = currentOptions.lastUpdated
      const currentMaxStaleMs = currentOptions.maxStaleMs

      if (currentLastUpdated <= 0) return
      if (Date.now() - currentLastUpdated <= currentMaxStaleMs) return
      if (!isRefreshingRef.current) {
        logger.info(`[useFreshData:${label}] visibilitychange 触发自动刷新`, {
          lastUpdated: currentLastUpdated,
          maxStaleMs: currentMaxStaleMs,
        })

        isRefreshingRef.current = true
        currentOptions.refresh().finally(() => {
          isRefreshingRef.current = false
        })
      }
    }

    visibilityHandlers.add(checkAndRefresh)
    ensureVisibilityListener()

    return () => {
      visibilityHandlers.delete(checkAndRefresh)
    }
  }, [enabled, label])

  return {
    isStale,
    secondsSinceUpdate,
    forceRefresh,
  }
}
