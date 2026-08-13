/**
 * @fileoverview InputDashboard 数据层 Hook — 状态管理、副作用、回调逻辑
 * @module apps/input/hooks/useInputDashboardData
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { fetchBasicDataUseCase } from '@/services/useCase/fetcherOrchestrator.useCase'
import { useIntentionPoolStore, getIntentionPoolGroups } from '@/store/intentionPoolStore'
import { getLogger } from '@/lib/logger'
import { createDebugLogger } from '@/lib/debugToolkit'
import { eventBus } from '@/lib/eventBus'
import type { PoolItem } from '@/types/modules/pool.types'

const logger = getLogger()
/** 采集状态 Badge 三态切换的 Debug 日志（控制台筛选 [CollectBadge]） */
const debug = createDebugLogger('CollectBadge')

/** 统计概览数据 */
export interface DashboardStats {
  total: number
  withPrice: number
  coverage: number
}

/**
 * InputDashboard 数据层 Hook
 *
 * 封装意向候选池的状态读取、采集/删除/勾选等业务回调，
 * 使主组件聚焦于 UI 渲染。
 */
export function useInputDashboardData() {
  // 从 intentionPoolStore 获取状态
  const items = useIntentionPoolStore((s) => s.items)
  const loading = useIntentionPoolStore((s) => s.loading)
  const error = useIntentionPoolStore((s) => s.error)
  const refresh = useIntentionPoolStore((s) => s.refresh)

  // 本地 UI 状态
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [collectingSymbols, setCollectingSymbols] = useState<Set<string>>(new Set())

  // 勾选状态：已选中的标的代码集合（用于批量删除）
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const selectAllRef = useRef<HTMLInputElement>(null)

  // 初始化加载
  useEffect(() => {
    logger.info('[InputDashboard] 初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  // 批量导入完成后自动刷新清单，确保页面完整覆盖所有已输入数据
  useEffect(() => {
    const off = eventBus.on('BATCH_IMPORT_COMPLETED', () => {
      logger.info('[InputDashboard] 收到 BATCH_IMPORT_COMPLETED，刷新清单')
      void refresh()
    })
    return off
  }, [refresh])

  // 分组列表：依赖 items，items 变化时重新计算
  const allGroups = useMemo(() => getIntentionPoolGroups(), [items])
  const allStocks: PoolItem[] = items

  // 全选框的半选（indeterminate）状态
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedSymbols.length > 0 && selectedSymbols.length < allStocks.length
    }
  }, [selectedSymbols.length, allStocks.length])

  const handleCollectStock = useCallback(async (symbol: string): Promise<void> => {
    debug.log('handleCollectStock 开始', {
      symbol,
      timestamp: Date.now(),
      currentCollecting: Array.from(collectingSymbols),
    })
    setCollectingSymbols((prev) => {
      const next = new Set(prev).add(symbol)
      debug.log('setCollectingSymbols ADD', {
        symbol,
        newSet: Array.from(next),
        size: next.size,
      })
      return next
    })
    try {
      const result = await fetchBasicDataUseCase({ symbol })
      debug.log('handleCollectStock 采集结果', {
        symbol,
        success: result.success,
        error: result.error,
        hasPrice: result.data?.price,
        elapsedMs: result.data ? 'completed' : 'n/a',
      })
      if (!result.success) {
        logger.warn('[InputDashboard] 采集失败', { symbol, error: result.error })
      }
      debug.log('handleCollectStock 刷新前', { symbol })
      await refresh()
      const updated = useIntentionPoolStore.getState().items.find((s) => s.symbol === symbol)
      debug.log('handleCollectStock 刷新后', {
        symbol,
        hasPrice: updated?.price !== undefined,
        price: updated?.price,
      })
    } catch (err) {
      logger.error('[InputDashboard] 采集异常', {
        symbol,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCollectingSymbols((prev) => {
        const next = new Set(prev)
        next.delete(symbol)
        debug.log('setCollectingSymbols REMOVE', {
          symbol,
          newSet: Array.from(next),
          size: next.size,
        })
        return next
      })
    }
  }, [refresh, collectingSymbols])

  const handleCollectAll = useCallback(async (): Promise<void> => {
    const toCollect = allStocks.filter((s) => s.price === undefined)
    if (toCollect.length === 0) {
      debug.log('handleCollectAll 无待采集标的')
      return
    }

    const symbolsToCollect = toCollect.map((s) => s.symbol)
    debug.log('handleCollectAll 开始并发采集', {
      totalToCollect: toCollect.length,
      symbols: symbolsToCollect,
      timestamp: Date.now(),
    })

    // 并行采集：使用 Promise.allSettled 并发执行
    setCollectingSymbols(new Set(symbolsToCollect))
    debug.log('handleCollectAll 已设置 collectingSymbols', {
      count: symbolsToCollect.length,
    })

    try {
      const results = await Promise.allSettled(
        toCollect.map(async (item, idx) => {
          debug.log('并发采集子任务启动', {
            symbol: item.symbol,
            taskIndex: idx,
            timestamp: Date.now(),
          })
          const result = await fetchBasicDataUseCase({ symbol: item.symbol })
          debug.log('并发采集子任务完成', {
            symbol: item.symbol,
            taskIndex: idx,
            success: result.success,
            elapsedMs: Date.now(),
          })
          // 立即移除该 symbol，让 Badge 从「采集中」及时切换为「已采/待采」，
          // 避免先完成的股票被卡在「采集中」状态等待最慢的子任务。
          setCollectingSymbols((prev) => {
            const next = new Set(prev)
            next.delete(item.symbol)
            debug.log('子任务完成即移除 collectingSymbol', {
              symbol: item.symbol,
              remaining: next.size,
            })
            return next
          })
          return { symbol: item.symbol, result }
        }),
      )
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.result.success,
      ).length
      const failCount = results.length - successCount
      const detail = results.map((r, i) => ({
        symbol: symbolsToCollect[i],
        status: r.status,
        success: r.status === 'fulfilled' ? r.value.result.success : false,
        error: r.status === 'rejected' ? String(r.reason) : r.status === 'fulfilled' ? r.value.result.error : null,
      }))
      debug.log('handleCollectAll 并发采集汇总', {
        total: toCollect.length,
        successCount,
        failCount,
        detail,
      })
      logger.info('[InputDashboard] 批量采集完成', { successCount, failCount, total: toCollect.length })
      debug.log('handleCollectAll 刷新前候选池', {
        poolSize: allStocks.length,
      })
      await refresh()
      debug.log('handleCollectAll 刷新后候选池', {
        poolSize: useIntentionPoolStore.getState().items.length,
        withPrice: useIntentionPoolStore.getState().items.filter((s) => s.price !== undefined).length,
      })
    } catch (err) {
      logger.error('[InputDashboard] 批量采集异常', {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCollectingSymbols(new Set())
      debug.log('handleCollectAll 已清除 collectingSymbols')
    }
  }, [allStocks, refresh])

  const handleDeleteStock = useCallback(async (symbol: string): Promise<void> => {
    const store = useIntentionPoolStore.getState()
    try {
      const deleted = await store.deleteItem(symbol)
      if (deleted) {
        setSelectedSymbols((prev) => prev.filter((s) => s !== symbol))
        await refresh()
      }
    } catch (err) {
      logger.error('[InputDashboard] 移除异常', {
        symbol,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [refresh])

  // ── 勾选 / 批量删除 ──
  const handleToggleSelect = useCallback((symbol: string): void => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    )
  }, [])

  const handleToggleSelectAll = useCallback((checked: boolean): void => {
    setSelectedSymbols(checked ? allStocks.map((s) => s.symbol) : [])
  }, [allStocks])

  const handleBatchDelete = useCallback(async (): Promise<void> => {
    if (selectedSymbols.length === 0) return
    const store = useIntentionPoolStore.getState()
    try {
      const count = await store.deleteItems(selectedSymbols)
      setSelectedSymbols([])
      if (count === 0) {
        logger.warn('[InputDashboard] 批量删除失败', { symbols: selectedSymbols })
      }
    } catch (err) {
      logger.error('[InputDashboard] 批量删除异常', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [selectedSymbols])

  const handleRefreshHealth = useCallback(async (): Promise<void> => {
    setFetcherOk(null)
    try {
      const result = await checkFetcherHealth()
      setFetcherOk(result.ok)
    } catch (err) {
      setFetcherOk(false)
      logger.error('[InputDashboard] 采集服务检查异常', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [])

  const stats = useMemo<DashboardStats>(() => {
    const total = allStocks.length
    const withPrice = allStocks.filter((s) => s.price !== undefined).length
    const coverage = total > 0 ? Math.round((withPrice / total) * 100) : 0
    return { total, withPrice, coverage }
  }, [allStocks])

  return {
    items,
    loading,
    error,
    refresh,
    allGroups,
    allStocks,
    fetcherOk,
    collectingSymbols,
    selectedSymbols,
    selectAllRef,
    stats,
    handleCollectStock,
    handleCollectAll,
    handleDeleteStock,
    handleToggleSelect,
    handleToggleSelectAll,
    handleBatchDelete,
    handleRefreshHealth,
  }
}
