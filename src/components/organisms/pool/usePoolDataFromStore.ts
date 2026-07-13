/**
 * @module usePoolDataFromStore
 * @description 桥接 hook：从 poolStore 读取数据，返回与 usePoolData 相同的接口。
 * 用于将 InputDashboard/HotSectorPanel/BulkImportPanel 从 usePoolData（内部 useState）
 * 迁移到 poolStore（Zustand），同时保持接口兼容性，无需修改面板组件。
 *
 * @migration
 * - 替代 usePoolData hook，统一数据源到 poolStore
 * - 将 poolStore.stocks 转换为 PoolGroup[] 格式
 * - 保持 selectedGroup/refresh/handleTransition/handleChangeGroup 接口不变
 */

import { useCallback, useMemo, useState } from 'react'
import { usePoolStore } from '@/store/poolStore'
import { getLogger } from '@/lib/logger'
import { RESEARCH_STATUS, type ResearchStatus } from '@/constants/stockpool.constants'
import { getPoolLabel, getNextStatuses, getTransitionLabel, type PoolTransitionOption } from '@/core/poolTransitionEngine'
import type { PoolGroup } from '@/services/stockpool/stockpoolService'

const logger = getLogger()

export interface UsePoolDataResult {
  groups: PoolGroup[]
  allGroups: string[]
  selectedGroup: string
  setSelectedGroup: (group: string) => void
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  handleTransition: (symbol: string, toStatus: ResearchStatus) => Promise<void>
  handleChangeGroup: (symbol: string, group: string) => Promise<void>
}

/**
 * 从 poolStore 读取股票池数据，返回与 usePoolData 相同的接口。
 *
 * @returns 股票池数据及操作方法
 */
export function usePoolDataFromStore(): UsePoolDataResult {
  const {
    stocks,
    loading,
    error,
    refresh: storeRefresh,
    updateStatus,
    updateGroup,
  } = usePoolStore()

  const [selectedGroup, setSelectedGroup] = useState<string>('')

  // 将 poolStore.stocks 转换为 PoolGroup[] 格式
  const groups = useMemo<PoolGroup[]>(() => {
    logger.debug('[usePoolDataFromStore] 转换 stocks → PoolGroup[]', { stockCount: stocks.length })

    const allStatuses = Object.values(RESEARCH_STATUS) as ResearchStatus[]
    return allStatuses.map((status) => {
      const statusStocks = stocks.filter((s) => s.researchStatus === status)
      const nextStatuses = getNextStatuses(status)
      const options: PoolTransitionOption[] = nextStatuses.map((value) => ({
        value,
        label: getTransitionLabel(status, value),
      }))
      return {
        status,
        label: getPoolLabel(status),
        stocks: statusStocks,
        options,
      }
    })
  }, [stocks])

  // 获取所有分组名称
  const allGroups = useMemo<string[]>(() => {
    const groupSet = new Set<string>()
    for (const stock of stocks) {
      groupSet.add(stock.group ?? '默认')
    }
    const sorted = Array.from(groupSet).sort()
    logger.debug('[usePoolDataFromStore] 提取分组名称', { groupCount: sorted.length, groups: sorted })
    return sorted
  }, [stocks])

  // 按选中分组筛选
  const filteredGroups = useMemo<PoolGroup[]>(() => {
    if (!selectedGroup) {
      logger.debug('[usePoolDataFromStore] 未选择分组，返回全部')
      return groups
    }
    const filtered = groups.map((g) => ({
      ...g,
      stocks: g.stocks.filter((s) => (s.group ?? '默认') === selectedGroup),
    }))
    logger.debug('[usePoolDataFromStore] 按分组筛选', { selectedGroup, filteredCount: filtered.reduce((sum, g) => sum + g.stocks.length, 0) })
    return filtered
  }, [groups, selectedGroup])

  // 刷新方法
  const refresh = useCallback(async (): Promise<void> => {
    logger.info('[usePoolDataFromStore] refresh 调用 poolStore.refresh')
    await storeRefresh()
  }, [storeRefresh])

  const logUpdateOutcome = (
    op: string,
    symbol: string,
    target: string,
    ok: boolean,
  ): void => {
    if (!ok) {
      logger.error(`[usePoolDataFromStore] ${op} 失败: ${symbol} → ${target}`)
    } else {
      logger.info(`[usePoolDataFromStore] ${op} 成功: ${symbol} → ${target}`)
    }
  }

  // 状态流转方法
  const handleTransition = useCallback(
    async (symbol: string, toStatus: ResearchStatus): Promise<void> => {
      logger.info(`[usePoolDataFromStore] handleTransition: ${symbol} → ${toStatus}`)
      const success = await updateStatus(symbol, toStatus)
      logUpdateOutcome('handleTransition', symbol, toStatus, success)
    },
    [updateStatus],
  )

  // 分组变更方法
  const handleChangeGroup = useCallback(
    async (symbol: string, group: string): Promise<void> => {
      logger.info(`[usePoolDataFromStore] handleChangeGroup: ${symbol} → ${group}`)
      const success = await updateGroup(symbol, group)
      logUpdateOutcome('handleChangeGroup', symbol, group, success)
    },
    [updateGroup],
  )

  return {
    groups: filteredGroups,
    allGroups,
    selectedGroup,
    setSelectedGroup,
    loading,
    error,
    refresh,
    handleTransition,
    handleChangeGroup,
  }
}
