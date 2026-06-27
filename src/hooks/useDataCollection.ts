import { useCallback } from 'react'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'

/**
 * useDataCollection Hook
 * @description 提供 Widget 数据采集相关的便捷方法
 * @remarks 数据采集任务由 MarketDataProvider 在顶层自动注册和管理，此 Hook 仅提供访问接口
 */
export function useDataCollection() {
  const marketData = useMarketData()

  /**
   * 手动刷新 Widget 数据
   * @param instanceId Widget 实例 ID
   */
  const refreshWidget = useCallback((instanceId: string): void => {
    marketData.refreshWidget(instanceId)
  }, [marketData])

  /**
   * 获取指定 Widget 的数据加载状态
   * @param instanceId Widget 实例 ID
   */
  const isWidgetLoading = useCallback(
    (instanceId: string): boolean => {
      return marketData.loadingMap[instanceId] ?? true
    },
    [marketData.loadingMap]
  )

  /**
   * 获取指定 Widget 的错误信息
   * @param instanceId Widget 实例 ID
   */
  const getWidgetError = useCallback(
    (instanceId: string): string | null => {
      return marketData.errorMap[instanceId] ?? null
    },
    [marketData.errorMap]
  )

  return {
    refreshWidget,
    isWidgetLoading,
    getWidgetError,
    marketData: marketData.data,
  }
}
