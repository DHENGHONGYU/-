/**
 * 图表缩放控制 Hook
 *
 * 提供：
 * - 复位缩放（双击或按钮）
 * - 缩放级别显示
 * - 键盘快捷键（←→ 平移，+/- 缩放，R 复位）
 * - 自适应降采样触发
 *
 * 对标 TradingView 缩放交互体验。
 *
 * @module components/chart/hooks/useChartZoom
 * @created 2026-08-15
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import type { IChartApi, Time } from 'lightweight-charts'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 缩放控制 Hook 参数 */
export interface UseChartZoomOptions {
  /** 图表实例 */
  chart: IChartApi | null
  /** 是否启用键盘快捷键 */
  enableKeyboard?: boolean
  /** 是否启用双击复位 */
  enableDoubleClickReset?: boolean
  /** 自适应降采样回调 */
  onVisibleRangeChange?: (visibleBars: number) => void
  /** 可选：总 K 线数（替代 lightweight-charts v5 已移除的 chart.series() API；若未提供则仅显示估算值不做 % 计算） */
  totalBars?: number
}

/** 缩放控制 Hook 返回值 */
export interface UseChartZoomReturn {
  /** 可见 K 线数量 */
  visibleBars: number
  /** 缩放级别 (0-100) */
  zoomLevel: number
  /** 是否已缩放到最大 */
  isMaxZoomed: boolean
  /** 是否已缩放到最小（全览） */
  isMinZoomed: boolean
  /** 复位缩放 */
  resetZoom: () => void
  /** 缩放到指定范围 */
  zoomToRange: (from: number, to: number) => void
  /** 缩放步进 */
  zoomIn: () => void
  zoomOut: () => void
  /** 平移 */
  panLeft: () => void
  panRight: () => void
}

/**
 * 图表缩放控制 Hook
 */
export function useChartZoom(options: UseChartZoomOptions): UseChartZoomReturn {
  const {
    chart,
    enableKeyboard = true,
    enableDoubleClickReset = true,
    onVisibleRangeChange,
    totalBars,
  } = options

  const [visibleBars, setVisibleBars] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(50)
  const [isMaxZoomed, setIsMaxZoomed] = useState(false)
  const [isMinZoomed, setIsMinZoomed] = useState(false)
  const totalBarsRef = useRef(0)

  // 同步外部传入的总 K 线数（替代 v5 移除的 chart.series() API）
  useEffect(() => {
    if (typeof totalBars === 'number' && totalBars > 0) {
      totalBarsRef.current = totalBars
    }
  }, [totalBars])

  // 监听可视范围变化
  useEffect(() => {
    if (!chart) return

    const timeScale = chart.timeScale()

    const updateVisibleRange = () => {
      const range = timeScale.getVisibleRange()
      if (!range) return

      const from = typeof range.from === 'number' ? range.from : 0
      const to = typeof range.to === 'number' ? range.to : 0
      const barSpacing = timeScale.options().barSpacing ?? 6
      const estimatedBars = Math.max(1, Math.floor((to - from) / (86400 / barSpacing)))

      setVisibleBars(estimatedBars)

      // 计算缩放级别
      if (totalBarsRef.current > 0) {
        const level = Math.min(
          100,
          Math.max(0, Math.round((estimatedBars / totalBarsRef.current) * 100)),
        )
        setZoomLevel(level)
        setIsMaxZoomed(estimatedBars <= 5)
        setIsMinZoomed(level >= 95)
      }

      if (onVisibleRangeChange) {
        onVisibleRangeChange(estimatedBars)
      }
    }

    // lightweight-charts v5 订阅 API：subscribe 返回 void；解绑需保存 handler 引用后调用 unsubscribeVisibleTimeRangeChange(handler)
    // 参照 drawing/engine.ts 的 unsubscribeClick 模式 & multiPaneChart.utils.ts 的用法
    const handler = () => {
      updateVisibleRange()
    }
    timeScale.subscribeVisibleTimeRangeChange(handler)

    updateVisibleRange()

    return () => {
      const ts = chart?.timeScale()
      if (ts) {
        ts.unsubscribeVisibleTimeRangeChange(handler)
      }
    }
  }, [chart, onVisibleRangeChange])

  // 设置总 K 线数（从第一个 series 读取 — v5 移除了 chart.series()，此处保留空实现；调用方应通过 totalBars prop 注入）
  // TODO: 若后续新增主系列引用注入，可在此处重新同步 totalBarsRef
  useEffect(() => {
    if (!chart) return
    // chart.series() 在 v5 不存在；总 K 线数通过 options.totalBars 传入
  }, [chart])

  // 复位缩放
  const resetZoom = useCallback(() => {
    if (!chart) return
    chart.timeScale().fitContent()
    logger.info('[Zoom] 复位缩放')
  }, [chart])

  // 缩放到指定范围
  const zoomToRange = useCallback((from: number, to: number) => {
    if (!chart) return
    chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time })
  }, [chart])

  // 缩放步进
  const zoomIn = useCallback(() => {
    if (!chart) return
    const timeScale = chart.timeScale()
    const range = timeScale.getVisibleRange()
    if (!range) return
    const from = typeof range.from === 'number' ? range.from : 0
    const to = typeof range.to === 'number' ? range.to : 0
    const mid = (from + to) / 2
    const half = (to - from) * 0.35
    zoomToRange(mid - half, mid + half)
  }, [chart, zoomToRange])

  const zoomOut = useCallback(() => {
    if (!chart) return
    const timeScale = chart.timeScale()
    const range = timeScale.getVisibleRange()
    if (!range) return
    const from = typeof range.from === 'number' ? range.from : 0
    const to = typeof range.to === 'number' ? range.to : 0
    const mid = (from + to) / 2
    const half = (to - from) * 0.7
    zoomToRange(mid - half, mid + half)
  }, [chart, zoomToRange])

  // 平移
  const panLeft = useCallback(() => {
    if (!chart) return
    const timeScale = chart.timeScale()
    const range = timeScale.getVisibleRange()
    if (!range) return
    const shift = (typeof range.to === 'number' ? range.to : 0) -
      (typeof range.from === 'number' ? range.from : 0)
    const newFrom = (typeof range.from === 'number' ? range.from : 0) - shift * 0.3
    const newTo = (typeof range.to === 'number' ? range.to : 0) - shift * 0.3
    zoomToRange(newFrom, newTo)
  }, [chart, zoomToRange])

  const panRight = useCallback(() => {
    if (!chart) return
    const timeScale = chart.timeScale()
    const range = timeScale.getVisibleRange()
    if (!range) return
    const shift = (typeof range.to === 'number' ? range.to : 0) -
      (typeof range.from === 'number' ? range.from : 0)
    const newFrom = (typeof range.from === 'number' ? range.from : 0) + shift * 0.3
    const newTo = (typeof range.to === 'number' ? range.to : 0) + shift * 0.3
    zoomToRange(newFrom, newTo)
  }, [chart, zoomToRange])

  // 键盘快捷键
  useEffect(() => {
    if (!enableKeyboard || !chart) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          panLeft()
          break
        case 'ArrowRight':
          e.preventDefault()
          panRight()
          break
        case '+':
        case '=':
          e.preventDefault()
          zoomIn()
          break
        case '-':
          e.preventDefault()
          zoomOut()
          break
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            resetZoom()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enableKeyboard, chart, resetZoom, zoomIn, zoomOut, panLeft, panRight])

  // 双击复位
  useEffect(() => {
    if (!enableDoubleClickReset || !chart) return

    const handleDblClick = () => {
      resetZoom()
    }

    const chartEl = (chart as unknown as { _chartElement?: HTMLElement })._chartElement
    if (chartEl) {
      chartEl.addEventListener('dblclick', handleDblClick)
      return () => {
        chartEl.removeEventListener('dblclick', handleDblClick)
      }
    }
  }, [enableDoubleClickReset, chart, resetZoom])

  return {
    visibleBars,
    zoomLevel,
    isMaxZoomed,
    isMinZoomed,
    resetZoom,
    zoomToRange,
    zoomIn,
    zoomOut,
    panLeft,
    panRight,
  }
}