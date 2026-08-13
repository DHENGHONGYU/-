/**
 * @fileoverview PoolBoardPage 批量采集控制 Hook
 * 封装批量采集状态管理、进度刷新、防断连机制与流程控制
 */

import { useCallback, useRef, useState } from 'react'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { getBatchCollectionProgress, type CollectionProgress as ProgressType } from '@/services/pool/collectionProgressService'
import { collectPoolSymbols } from '@/services/pool/collectionService'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { STRATEGY_TEMPLATES, DEFAULT_DIMENSIONS } from '@/config/collectConfig'
import { upgradeDimensionsToPipeline } from '@/domain/collection/pipeline'
import type { PoolItem } from '@/types/modules/pool.types'
import type { CollectionConfig, DimensionPipelineConfig } from '@/types/modules/collection.types'

const logger = getLogger()

export const PROGRESS_REFRESH_EVENT = 'pool:progress-refresh'

// 扩展 Window 类型以支持调试钩子
declare global {
  interface Window {
    __SIMULATE_DISCONNECT__?: () => void
    __SIMULATE_RESET__?: () => void
  }
}

export function usePoolBoardCollect(
  items: PoolItem[],
  onProgressUpdate: (progressMap: Map<string, ProgressType>) => void
) {
  const [collecting, setCollecting] = useState(false)
  const [collectError, setCollectError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  
  const consecutiveFailuresRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const forceStoppedRef = useRef(false)
  const simFailRef = useRef(false)
  const simCallCountRef = useRef(0)
  const collectErrorRef = useRef<string | null>(null) // 追踪最新的 collectError

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleCollect = useCallback(async (): Promise<void> => {
    if (collecting || items.length === 0) return
    
    let forceDemoFlag = false
    try { forceDemoFlag = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_FORCE_DEMO') === '1' } catch { /* noop */ }
    
    logger.info('[usePoolBoardCollect] 批量采集启动', {
      symbolCount: items.length,
      symbols: items.map((i) => i.symbol),
      mode: forceDemoFlag ? 'DEMO' : 'REAL',
    })
    
    setCollecting(true)
    setCollectError(null)
    setRefreshError(null)
    collectErrorRef.current = null // Reset error ref

    // Reset state
    consecutiveFailuresRef.current = 0
    forceStoppedRef.current = false
    simFailRef.current = false
    simCallCountRef.current = 0

    // Setup debug hooks
    if (typeof window !== 'undefined') {
      window.__SIMULATE_DISCONNECT__ = () => {
        logger.warn('[usePoolBoardCollect] ⚡ 采集中途断连模拟已启用')
        simFailRef.current = true
        try { sessionStorage.setItem('POOL_SIMULATE_DISCONNECT', '1') } catch { /* noop */ }
      }
      window.__SIMULATE_RESET__ = () => {
        logger.info('[usePoolBoardCollect] 断连模拟已重置')
        simFailRef.current = false
        simCallCountRef.current = 0
        try { sessionStorage.removeItem('POOL_SIMULATE_DISCONNECT') } catch { /* noop */ }
      }
    }

    const REFRESH_FAILURE_THRESHOLD = 3

    // Start progress refresh loop
    timerRef.current = setInterval(() => {
      if (forceStoppedRef.current) return
      eventBus.emit(PROGRESS_REFRESH_EVENT, {})
      
      void (async () => {
        try {
          const checkSimFlag = () => {
            if (simFailRef.current) return true
            try {
              if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_SIMULATE_DISCONNECT') === '1') {
                simFailRef.current = true
              }
            } catch { /* noop */ }
            return simFailRef.current
          }
          
          if (checkSimFlag()) {
            simCallCountRef.current++
            const errMsg = `IndexedDB 读取失败：transaction aborted (模拟网络断连 #${simCallCountRef.current})`
            throw new Error(errMsg)
          }
          
          const progressMap = await getBatchCollectionProgress(items.map((i) => i.symbol))
          onProgressUpdate(progressMap)
          consecutiveFailuresRef.current = 0
          setRefreshError(null)
        } catch (err) {
          consecutiveFailuresRef.current++
          const msg = err instanceof Error ? err.message : String(err)
          logger.warn('[usePoolBoardCollect] 进度刷新失败', {
            attempt: consecutiveFailuresRef.current,
            threshold: REFRESH_FAILURE_THRESHOLD,
            error: msg,
          })
          setRefreshError(msg)
          if (consecutiveFailuresRef.current >= REFRESH_FAILURE_THRESHOLD) {
            forceStoppedRef.current = true
            stopTimer()
            const stopMsg = `⚠ 采集中途断连：进度刷新连续 ${REFRESH_FAILURE_THRESHOLD} 次失败 (${msg})，已停止更新。`
            logger.error('[usePoolBoardCollect] ' + stopMsg)
            setCollectError(stopMsg)
            collectErrorRef.current = stopMsg
          }
        }
      })()
    }, 1000)

    try {
      const cfgState = useSevenDimConfigStore.getState()
      
      let dims = cfgState.dimensions
      if (!Array.isArray(dims) || dims.length === 0 || dims.every((d) => !d.enabled)) {
        const defaultTemplate = STRATEGY_TEMPLATES.find((t) => t.id === 'value') ?? STRATEGY_TEMPLATES[0]
        if (!defaultTemplate) {
          throw new Error('未找到任何策略模板，无法构建默认维度配置')
        }
        const fallbackDims = upgradeDimensionsToPipeline(
          DEFAULT_DIMENSIONS.map((d) => ({
            ...d,
            enabled: defaultTemplate.dimensions.includes(d.code),
            frequency: defaultTemplate.updateInterval,
            sources: defaultTemplate.sources,
          })) as DimensionPipelineConfig[],
        )
        dims = fallbackDims
        logger.warn('[usePoolBoardCollect] 维度配置为空，已回退到默认策略模板', { activeTemplate: defaultTemplate.id })
        try {
          useSevenDimConfigStore.setState({ dimensions: fallbackDims, activeTemplate: defaultTemplate.id, isDirty: true })
        } catch { /* noop */ }
      }

      const activeTemplate = cfgState.activeTemplate ?? 'value'
      const config: CollectionConfig = {
        version: '1.0.0',
        activeTemplate,
        dimensions: dims,
        global: cfgState.global,
        symbolCount: items.length,
        historyDays: cfgState.historyDays ?? 252,
        updatedAt: Date.now(),
      }

      logger.info('[usePoolBoardCollect] 采集配置构建完成', { activeTemplate, dimensionCount: dims.length })

      try {
        logger.info('[usePoolBoardCollect] collectPoolSymbols 开始执行', { symbolCount: items.length })
        await collectPoolSymbols(items.map((i) => i.symbol), config)
        logger.info('[usePoolBoardCollect] collectPoolSymbols 执行完成')
      } catch (collectErr) {
        const msg = collectErr instanceof Error ? collectErr.message : String(collectErr)
        logger.error('[usePoolBoardCollect] 批量采集主流程异常', { error: msg })
        setCollectError(msg)
        collectErrorRef.current = msg
      }

      // Final progress update
      const progressMap = await getBatchCollectionProgress(items.map((i) => i.symbol))
      onProgressUpdate(progressMap)
      eventBus.emit(PROGRESS_REFRESH_EVENT, {})
      
      // Log final status using ref to read latest error state
      const progressValues = progressMap ? Array.from(progressMap.values()) : []
      const avgPercent = progressValues.length > 0
        ? Math.round(progressValues.reduce((sum, p) => sum + p.completionPercent, 0) / progressValues.length)
        : 0
      const status = collectErrorRef.current ? 'ERROR' : forceStoppedRef.current ? 'DISCONNECTED' : 'SUCCESS'
      logger.info('[usePoolBoardCollect] 批量采集结束 — 最终结果摘要', {
        avgPercent,
        totalSymbols: items.length,
        status,
      })
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[usePoolBoardCollect] 批量采集全局异常', { error: msg })
      setCollectError(msg)
      collectErrorRef.current = msg
    } finally {
      stopTimer()
      // Cleanup debug hooks
      if (typeof window !== 'undefined') {
        try { delete (window as unknown as Record<string, unknown>).__SIMULATE_DISCONNECT__ } catch { /* noop */ }
        try { delete (window as unknown as Record<string, unknown>).__SIMULATE_RESET__ } catch { /* noop */ }
      }
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('POOL_FORCE_DEMO')
          sessionStorage.removeItem('POOL_SIMULATE_DISCONNECT')
        }
      } catch { /* noop */ }
      logger.info('[usePoolBoardCollect] 批量采集流程收尾完成', {
        hadCollectError: Boolean(collectErrorRef.current),
        wasForceStopped: forceStoppedRef.current,
      })
      setCollecting(false)
    }
  }, [collecting, items, onProgressUpdate, stopTimer])

  return { collecting, collectError, refreshError, handleCollect }
}
