/**
 * @module usePoolBoard
 * @description 股票池看板页面逻辑 Hook（三分拆后）。
 *
 * 供分析舱独立页面 `PoolBoardPage` 复用，操作研究池（research）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { transitionPoolItem, updatePoolItemGroup } from '@/services/pool/poolService'
import { refreshSymbolKline } from '@/services/fetcher/fetcherService'
import { RESEARCH_STATUS, DEFAULT_POOL_GROUP, type ResearchStatus } from '@/constants/pool.constants'
import { POOL_TYPE } from '@/constants/pool.constants'
import type { PoolItem } from '@/types/modules/pool.types'
import { getLogger } from '@/lib/logger'
import type { PoolViewMode } from '@/components/organisms/pool/PoolBoard'

const logger = getLogger()

type QualityFilter = 'all' | 'missingBasic' | 'missingKline' | 'missingFinance'

const ALL_GROUPS_VALUE = '__all__'

/**
 * usePoolBoard
 */
export function usePoolBoard() {
  const navigate = useNavigate()

  const items = useResearchPoolStore((s) => s.items)
  const loading = useResearchPoolStore((s) => s.loading)
  const error = useResearchPoolStore((s) => s.error)
  const refresh = useResearchPoolStore((s) => s.refresh)

  const [viewMode, setViewMode] = useState<PoolViewMode>('kanban')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    logger.info('[PoolBoard] 初始化，加载研究池数据')
    void refresh()
  }, [refresh])

  const allGroups = useMemo(() => {
    const groups = new Set<string>()
    for (const item of items) {
      groups.add(item.group ?? DEFAULT_POOL_GROUP)
    }
    return Array.from(groups).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    let result = items
    if (selectedGroup) {
      result = result.filter((s) => s.group === selectedGroup)
    }
    if (qualityFilter === 'all') return result
    return result.filter((s) => {
      const q = s.dataQuality
      switch (qualityFilter) {
        case 'missingBasic':
          return q?.basic !== true
        case 'missingKline':
          return q?.kline !== true
        case 'missingFinance':
          return q?.finance !== true
        default:
          return true
      }
    })
  }, [items, selectedGroup, qualityFilter])

  const handleSelectToggle = useCallback((targetSymbol: string): void => {
    setSelectedSymbols((prev) =>
      prev.includes(targetSymbol)
        ? prev.filter((s) => s !== targetSymbol)
        : [...prev, targetSymbol],
    )
  }, [])

  const handleResultFailure = (
    result: { success: boolean; error?: string },
    onFail: () => void,
  ): void => {
    if (!result.success) onFail()
  }

  const reportBulkResult = (results: string[], targetCount: number, op: string): void => {
    if (results.length > 0) {
      setMessage(`批量${op}完成，部分失败：${results.join('；')}`)
    } else {
      setMessage(`已批量${op} ${targetCount} 只标的`)
    }
  }

  const handleTransition = useCallback(
    async (symbol: string, toStatus: ResearchStatus): Promise<void> => {
      const result = await transitionPoolItem(symbol, {
        pool: POOL_TYPE.research,
        status: toStatus,
        label: '状态流转',
      })
      await refresh()
      handleResultFailure(result, () =>
        setMessage(`${symbol} 流转失败：${result.error ?? '未知错误'}`),
      )
    },
    [refresh, handleResultFailure],
  )

  const handleChangeGroup = useCallback(
    async (symbol: string, group: string): Promise<void> => {
      const result = await updatePoolItemGroup(symbol, group)
      await refresh()
      handleResultFailure(result, () =>
        setMessage(`${symbol} 移入分组失败：${result.error ?? '未知错误'}`),
      )
    },
    [refresh, handleResultFailure],
  )

  const handleRefreshKline = useCallback(
    async (item: PoolItem): Promise<void> => {
      const result = await refreshSymbolKline(item.symbol)
      if (result.success) {
        setMessage(`已刷新 ${item.symbol} 行情`)
        await refresh()
      } else {
        setMessage(result.error ?? '刷新行情失败')
      }
    },
    [refresh],
  )

  const handleAnalyze = useCallback(
    (symbolToAnalyze: string): void => {
      void navigate(`/analysis/stock-score/${symbolToAnalyze}`)
    },
    [navigate],
  )

  const runBulkTransition = useCallback(
    async (toStatus: ResearchStatus): Promise<void> => {
      const targets = items.filter((s) => selectedSymbols.includes(s.symbol))
      const results: string[] = []
      for (const item of targets) {
        const result = await transitionPoolItem(item.symbol, {
          pool: POOL_TYPE.research,
          status: toStatus,
          label: '批量流转',
        })
        handleResultFailure(result, () =>
          results.push(`${item.symbol}: ${result.error ?? '失败'}`),
        )
      }
      setSelectedSymbols([])
      await refresh()
      reportBulkResult(results, targets.length, '流转')
    },
    [items, selectedSymbols, refresh, handleResultFailure, reportBulkResult],
  )

  const runBulkChangeGroup = useCallback(
    async (targetGroup: string): Promise<void> => {
      const targets = items.filter((s) => selectedSymbols.includes(s.symbol))
      const results: string[] = []
      for (const item of targets) {
        const result = await updatePoolItemGroup(item.symbol, targetGroup)
        handleResultFailure(result, () =>
          results.push(`${item.symbol}: ${result.error ?? '失败'}`),
        )
      }
      setSelectedSymbols([])
      await refresh()
      reportBulkResult(results, targets.length, '移入分组')
    },
    [items, selectedSymbols, refresh, handleResultFailure, reportBulkResult],
  )

  const handleBulkArchive = useCallback((): Promise<void> => {
    return runBulkTransition(RESEARCH_STATUS.archived)
  }, [runBulkTransition])

  const handleCreateGroup = useCallback((): void => {
    const trimmed = newGroupName.trim()
    if (!trimmed) {
      setMessage('分组名称不能为空')
      return
    }
    if (allGroups.includes(trimmed)) {
      setMessage('分组名称已存在')
      return
    }
    setSelectedGroup(trimmed)
    setNewGroupName('')
    setNewGroupDialogOpen(false)
    setMessage(`已创建分组「${trimmed}」（添加股票时生效）`)
  }, [allGroups, newGroupName])

  return {
    items,
    loading,
    error,
    message,
    refresh,
    allGroups,
    filteredItems,
    viewMode,
    setViewMode,
    selectedGroup,
    setSelectedGroup,
    qualityFilter,
    setQualityFilter,
    selectedSymbols,
    setSelectedSymbols,
    newGroupDialogOpen,
    setNewGroupDialogOpen,
    newGroupName,
    setNewGroupName,
    handleSelectToggle,
    handleTransition,
    handleChangeGroup,
    handleRefreshKline,
    handleAnalyze,
    handleBulkArchive,
    runBulkChangeGroup,
    handleCreateGroup,
    ALL_GROUPS_VALUE,
  }
}
