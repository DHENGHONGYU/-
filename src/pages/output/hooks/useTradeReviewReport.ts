/**
 * @fileoverview 交易复盘报告数据 Hook
 * 封装订单加载、报告生成、下载报告和深色模式闪烁检测逻辑
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Order } from '@/data/types'
import type { TradeReviewReport } from '@/types/modules/tradeReviewAI.types'
import { useToast } from '@/hooks/useToast'
import { useDisciplineStore } from '@/store/disciplineStore'
import { useThemeStore } from '@/store/themeStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 颜色令牌切换闪烁检测阈值（ms） */
const FLICKER_THRESHOLD_MS = 50

export interface ReviewData {
  report: TradeReviewReport
  generatedAt: string
}

export function useTradeReviewReport() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  const latestReport = useDisciplineStore((s) => s.latestReport)
  const loadOrdersFromStore = useDisciplineStore((s) => s.loadOrders)
  const generateReviewReport = useDisciplineStore((s) => s.generateReviewReport)
  const refreshReport = useDisciplineStore((s) => s.refresh)

  const resolvedMode = useThemeStore((s) => s.resolvedMode)
  const prevResolvedModeRef = useRef(resolvedMode)

  // 深色模式颜色令牌切换闪烁检测
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    const prevMode = prevResolvedModeRef.current
    prevResolvedModeRef.current = resolvedMode
    if (prevMode === resolvedMode) return

    const root = document.documentElement
    const expectedHasDark = resolvedMode === 'dark'
    let classChangeCount = 0
    const startTime = performance.now()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          classChangeCount++
          const elapsed = performance.now() - startTime
          const hasDarkClass = root.classList.contains('dark')
          const dataTheme = root.getAttribute('data-theme')

          if (classChangeCount > 1) {
            logger.warn('[TradeReviewPage] 深色模式颜色令牌切换检测到多次 class 变化，存在视觉闪烁', {
              resolvedMode, classChangeCount, elapsedMs: elapsed, hasDarkClass, dataTheme,
            })
          }

          if (elapsed > FLICKER_THRESHOLD_MS) {
            logger.warn('[TradeReviewPage] 深色模式颜色令牌切换耗时过长，可能存在视觉闪烁', {
              resolvedMode, elapsedMs: elapsed, threshold: FLICKER_THRESHOLD_MS, hasDarkClass, dataTheme,
            })
          }

          if (hasDarkClass !== expectedHasDark) {
            logger.warn('[TradeReviewPage] 颜色令牌 class 与预期主题不一致', {
              resolvedMode, expectedHasDark, actualHasDarkClass: hasDarkClass, dataTheme,
            })
          }

          observer.disconnect()
          return
        }
      }
    })

    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    const timeoutId = window.setTimeout(() => {
      observer.disconnect()
      if (classChangeCount === 0) {
        logger.debug('[TradeReviewPage] 颜色令牌已同步，无需切换 class', { resolvedMode })
      }
    }, 200)

    return () => {
      observer.disconnect()
      window.clearTimeout(timeoutId)
    }
  }, [resolvedMode])

  const review: ReviewData | null = useMemo(
    () => latestReport
      ? { report: latestReport, generatedAt: new Date().toISOString() }
      : null,
    [latestReport],
  )

  const loadOrders = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const ordersList = await loadOrdersFromStore()
      setOrders(ordersList)
      if (ordersList.length > 0 && !useDisciplineStore.getState().latestReport) {
        generateReviewReport(ordersList)
      }
    } catch (error) {
      toast({
        variant: 'error',
        title: '加载交易记录失败',
        description: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }, [loadOrdersFromStore, toast, generateReviewReport])

  const generateReport = useCallback((): void => {
    if (orders.length === 0) {
      toast({
        variant: 'error',
        title: '无交易记录',
        description: '请先添加交易记录再生成复盘报告',
      })
      return
    }

    setGenerating(true)
    try {
      generateReviewReport(orders)
      toast({
        title: '复盘报告生成成功',
        description: `已分析 ${orders.length} 笔交易记录`,
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '生成复盘报告失败',
        description: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setGenerating(false)
    }
  }, [orders, toast, generateReviewReport])

  const downloadReport = useCallback((): void => {
    if (!review) return

    const content = buildReportMarkdown(review.report)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `交易复盘报告_${new Date(review.generatedAt).toLocaleDateString('zh-CN')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({
      title: '下载成功',
      description: '交易复盘报告已下载',
    })
  }, [review, toast])

  // 自动加载
  useEffect(() => {
    void loadOrders()
    void refreshReport()
  }, [loadOrders, refreshReport])

  return {
    orders,
    loading,
    generating,
    review,
    loadOrders,
    generateReport,
    downloadReport,
  }
}

function buildReportMarkdown(report: TradeReviewReport): string {
  const lines: string[] = []
  lines.push('# 交易复盘报告')
  lines.push(`- 生成时间：${new Date(report.generatedAt).toLocaleString('zh-CN')}`)
  lines.push('')

  lines.push('## 交易摘要')
  lines.push(`- 总交易笔数：${report.summary.totalTrades}`)
  lines.push(`- 盈利笔数：${report.summary.profitableTrades}`)
  lines.push(`- 亏损笔数：${report.summary.losingTrades}`)
  lines.push(`- 胜率：${report.summary.winRate.toFixed(1)}%`)
  lines.push(`- 盈亏比：${report.summary.profitLossRatio.toFixed(2)}`)
  lines.push(`- 平均盈利：${report.summary.avgProfit.toFixed(2)}%`)
  lines.push(`- 平均亏损：${report.summary.avgLoss.toFixed(2)}%`)
  lines.push(`- 总盈亏：${report.summary.totalPnL.toFixed(2)} (${report.summary.totalPnLPercent.toFixed(2)}%)`)
  lines.push(`- 纪律评分：${report.summary.disciplineScore.toFixed(1)}`)
  lines.push(`- 错误总数：${report.summary.totalErrors}`)
  lines.push('')

  lines.push('## 心理画像')
  lines.push(`- 类型：${report.errorAnalysis.psychologicalProfile.name}`)
  lines.push(`- 心理根源：${report.errorAnalysis.psychologicalProfile.rootCause}`)
  lines.push('- 特征：')
  for (const char of report.errorAnalysis.psychologicalProfile.characteristics) {
    lines.push(`  - ${char}`)
  }
  lines.push(`- 改进方向：${report.errorAnalysis.psychologicalProfile.improvementDirection}`)
  lines.push('')

  lines.push('## 纪律分析')
  lines.push(`- 计划遵守率：${report.disciplineAnalysis.planAdherenceRate.toFixed(1)}%`)
  lines.push(`- 止损执行率：${report.disciplineAnalysis.stopLossExecutionRate.toFixed(1)}%`)
  lines.push(`- 仓位管理评分：${report.disciplineAnalysis.positionManagementScore.toFixed(1)}`)
  lines.push(`- 情绪控制评分：${report.disciplineAnalysis.emotionControlScore.toFixed(1)}`)
  lines.push(`- 综合纪律评分：${report.disciplineAnalysis.overallScore.toFixed(1)}`)
  if (report.disciplineAnalysis.improvements.length > 0) {
    lines.push('- 改善建议：')
    for (const imp of report.disciplineAnalysis.improvements) {
      lines.push(`  - ${imp}`)
    }
  }
  lines.push('')

  lines.push('## 行动计划')
  if (report.actionPlan.immediate.length > 0) {
    lines.push('### 立即执行')
    for (const item of report.actionPlan.immediate) {
      lines.push(`- ${item}`)
    }
  }
  if (report.actionPlan.shortTerm.length > 0) {
    lines.push('### 短期（1个月）')
    for (const item of report.actionPlan.shortTerm) {
      lines.push(`- ${item}`)
    }
  }
  if (report.actionPlan.longTerm.length > 0) {
    lines.push('### 长期（3个月）')
    for (const item of report.actionPlan.longTerm) {
      lines.push(`- ${item}`)
    }
  }

  return lines.join('\n')
}
