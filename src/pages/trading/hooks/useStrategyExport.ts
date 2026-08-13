/**
 * @fileoverview 策略快照导出 Hook
 * 封装 strategySnapshotExport 服务的调用，作为页面与 Service 之间的防腐层
 */

import { useCallback, useState } from 'react'
import {
  exportGroupToExcel,
  exportAllGroupsToExcel,
  exportSnapshotToJson,
  exportBatchSnapshotsToExcel,
} from '@/domain/export/strategySnapshotExport'
import { getLogger } from '@/lib/logger'
import type { StrategySnapshot, StrategyGroupItem } from '@/data/types'

const logger = getLogger()

interface StrategyItems {
  core: StrategyGroupItem[]
  hot: StrategyGroupItem[]
  value: StrategyGroupItem[]
}

export function useStrategyExport() {
  const [exporting, setExporting] = useState<string | null>(null)

  const handleExportGroup = useCallback(async (items: StrategyGroupItem[], title: string) => {
    setExporting('group')
    try {
      const result = await exportGroupToExcel(items, title)
      if (!result.success) {
        logger.error('[useStrategyExport] 导出分组失败', { error: result.error })
      }
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[useStrategyExport] 导出分组异常', { error: msg })
      return { success: false, error: msg }
    } finally {
      setExporting(null)
    }
  }, [])

  const handleExportAll = useCallback(async (items: StrategyItems) => {
    setExporting('all')
    try {
      const result = await exportAllGroupsToExcel(items)
      if (!result.success) {
        logger.error('[useStrategyExport] 导出全部失败', { error: result.error })
      }
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[useStrategyExport] 导出全部异常', { error: msg })
      return { success: false, error: msg }
    } finally {
      setExporting(null)
    }
  }, [])

  const handleExportSnapshotJson = useCallback((snapshot: StrategySnapshot) => {
    setExporting('json')
    try {
      const result = exportSnapshotToJson(snapshot)
      return result
    } finally {
      setExporting(null)
    }
  }, [])

  const handleExportBatchSnapshots = useCallback(async (snapshots: StrategySnapshot[]) => {
    setExporting('batch')
    try {
      const result = await exportBatchSnapshotsToExcel(snapshots)
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[useStrategyExport] 批量导出异常', { error: msg })
      return { success: false, error: msg }
    } finally {
      setExporting(null)
    }
  }, [])

  return {
    exporting,
    handleExportGroup,
    handleExportAll,
    handleExportSnapshotJson,
    handleExportBatchSnapshots,
  }
}
