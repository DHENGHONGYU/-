/**
 * @module useStockPoolBoard
 * @description 股票池看板页面逻辑 Hook。
 *
 * 将原 `InputDashboard` 中的股票池看板相关状态与操作抽离，
 * 供分析舱独立页面 `StockPoolBoardPage` 复用。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePoolStore } from '@/store/poolStore'
import { transitionStock, updateStockGroup } from '@/services/stockpool/stockpoolService'
import { refreshSymbolKline } from '@/services/fetcher/fetcherService'
import { RESEARCH_STATUS, DEFAULT_POOL_GROUP, type ResearchStatus } from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import type { PoolViewMode } from '@/components/organisms/pool/PoolBoard'

const logger = getLogger()

type QualityFilter = 'all' | 'missingBasic' | 'missingKline' | 'missingFinance'

const ALL_GROUPS_VALUE = '__all__'

/**
 * useStockPoolBoard
 */
export function useStockPoolBoard() {
  const navigate = useNavigate()

  const stocks = usePoolStore((s) => s.stocks)
  const loading = usePoolStore((s) => s.loading)
  const error = usePoolStore((s) => s.error)
  const refresh = usePoolStore((s) => s.refresh)

  const [viewMode, setViewMode] = useState<PoolViewMode>('kanban')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    logger.info('[StockPoolBoard] 初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  const allGroups = useMemo(() => {
    const groups = new Set<string>()
    for (const stock of stocks) {
      groups.add(stock.group ?? DEFAULT_POOL_GROUP)
    }
    return Array.from(groups).sort()
  }, [stocks])

  const filteredStocks = useMemo(() => {
    let result = stocks
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
  }, [stocks, selectedGroup, qualityFilter])

  const handleSelectToggle = useCallback((targetSymbol: string): void => {
    setSelectedSymbols((prev) =>
      prev.includes(targetSymbol)
        ? prev.filter((s) => s !== targetSymbol)
        : [...prev, targetSymbol],
    )
  }, [])

  const handleTransition = useCallback(
    async (symbol: string, toStatus: ResearchStatus): Promise<void> => {
      const result = await transitionStock(symbol, toStatus)
      await refresh()
      if (!result.success) {
        setMessage(`${symbol} 流转失败：${result.error ?? '未知错误'}`)
      }
    },
    [refresh],
  )

  const handleChangeGroup = useCallback(
    async (symbol: string, group: string): Promise<void> => {
      const result = await updateStockGroup(symbol, group)
      await refresh()
      if (!result.success) {
        setMessage(`${symbol} 移入分组失败：${result.error ?? '未知错误'}`)
      }
    },
    [refresh],
  )

  const handleRefreshKline = useCallback(
    async (stock: Stock): Promise<void> => {
      const result = await refreshSymbolKline(stock.symbol)
      if (result.success) {
        setMessage(`已刷新 ${stock.symbol} 行情`)
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
      const targets = stocks.filter((s) => selectedSymbols.includes(s.symbol))
      const results: string[] = []
      for (const stock of targets) {
        const result = await transitionStock(stock.symbol, toStatus)
        if (!result.success) {
          results.push(`${stock.symbol}: ${result.error ?? '失败'}`)
        }
      }
      setSelectedSymbols([])
      await refresh()
      if (results.length > 0) {
        setMessage(`批量流转完成，部分失败：${results.join('；')}`)
      } else {
        setMessage(`已批量流转 ${targets.length} 只标的到 ${toStatus}`)
      }
    },
    [stocks, selectedSymbols, refresh],
  )

  const runBulkChangeGroup = useCallback(
    async (targetGroup: string): Promise<void> => {
      const targets = stocks.filter((s) => selectedSymbols.includes(s.symbol))
      const results: string[] = []
      for (const stock of targets) {
        const result = await updateStockGroup(stock.symbol, targetGroup)
        if (!result.success) {
          results.push(`${stock.symbol}: ${result.error ?? '失败'}`)
        }
      }
      setSelectedSymbols([])
      await refresh()
      if (results.length > 0) {
        setMessage(`批量移入分组完成，部分失败：${results.join('；')}`)
      } else {
        setMessage(`已批量移入 ${targets.length} 只标的到 ${targetGroup}`)
      }
    },
    [stocks, selectedSymbols, refresh],
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
    stocks,
    loading,
    error,
    message,
    refresh,
    allGroups,
    filteredStocks,
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
