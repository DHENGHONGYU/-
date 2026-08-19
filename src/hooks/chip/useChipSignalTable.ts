/**
 * useChipSignalTable — 筹码信号筛选表业务逻辑 Hook
 *
 * 从 ChipStrategyReviewPage 提取，封装：
 * - 信号筛选（按交易动作类型过滤）
 * - 各类型计数
 * - Excel 导出
 * - debug.log 下载与清空
 *
 * @see src/pages/output/ChipStrategyReviewPage.tsx — 原消费方
 */

import { useState, useMemo, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { CHIP_SIGNALS, type FilterType, type ChipSignalRow } from '@/domain/chip/types'
import { exportChipStrategyExcel } from '@/domain/chip/analysis'
import { downloadDebugLogFile, clearDebugLog, getDebugLogCount } from '@/domain/chip/debugLog'

export function useChipSignalTable() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<FilterType>('all')
  const [debugLogCount, setDebugLogCount] = useState<number>(0)

  const filteredSignals = useMemo<ChipSignalRow[]>(() => {
    if (filter === 'all') return CHIP_SIGNALS
    return CHIP_SIGNALS.filter((s) => {
      if (filter === 'buy') return s.tradeAction === 'buy'
      if (filter === 'sell') return s.tradeAction === 'sell'
      if (filter === 'hold') return s.tradeAction === 'hold'
       
      if (filter === 'escape') return s.tradeAction === 'escape'
      return true
    })
  }, [filter])

  const signalCounts = useMemo(
    () => ({
      buy: CHIP_SIGNALS.filter((s) => s.tradeAction === 'buy').length,
      sell: CHIP_SIGNALS.filter((s) => s.tradeAction === 'sell').length,
      hold: CHIP_SIGNALS.filter((s) => s.tradeAction === 'hold').length,
      escape: CHIP_SIGNALS.filter((s) => s.tradeAction === 'escape').length,
    }),
    [],
  )

  const handleExportExcel = useCallback(async () => {
    try {
      const { count, filename } = await exportChipStrategyExcel(filteredSignals)
      toast({ title: '导出成功', description: `已导出 ${count} 条信号到 ${filename}` })
    } catch (err) {
      toast({
        title: '导出失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'error',
      })
    }
  }, [filteredSignals, toast])

  const handleDownloadDebugLog = useCallback(() => {
    try {
      const count = getDebugLogCount()
      if (count === 0) {
        toast({
          title: '暂无日志',
          description: '还没有灰色地带判定日志，请先分析个股后重试',
          variant: 'warning',
        })
        return
      }
      downloadDebugLogFile()
      toast({ title: '下载成功', description: `已下载 ${count} 条灰色地带判定日志` })
    } catch (err) {
      toast({
        title: '下载失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'error',
      })
    }
  }, [toast])

  const handleClearDebugLog = useCallback(() => {
    const count = getDebugLogCount()
    clearDebugLog()
    setDebugLogCount(0)
    toast({ title: '已清空', description: `已清空 ${count} 条灰色地带判定日志` })
  }, [toast])

  return {
    filter,
    setFilter,
    filteredSignals,
    signalCounts,
    debugLogCount,
    setDebugLogCount,
    handleExportExcel,
    handleDownloadDebugLog,
    handleClearDebugLog,
  }
}
