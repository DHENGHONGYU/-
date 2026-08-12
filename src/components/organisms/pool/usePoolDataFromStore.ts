/**
 * @module usePoolDataFromStore
 * @description 桥接 hook：从 researchPoolStore 读取数据，返回 PoolLane[] 接口。
 *
 * 用于将 PoolBoard 从本地 useState 迁移到 Zustand Store，同时保持看板接口兼容性。
  * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-031, V9-DOC-DATA-032]
*/

import { useCallback, useMemo, useState } from 'react'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { getLogger } from '@/lib/logger'
import type { ResearchStatus } from '@/constants/pool.constants'
import { getPoolLabel, getPoolTransitionOptions } from '@/core/poolTransitionEngine'
import { POOL_TYPE } from '@/constants/pool.constants'
import type { PoolItem, PoolLane, PoolTransitionTarget } from '@/types/modules/pool.types'

const logger = getLogger()

export interface UsePoolDataResult {
  lanes: PoolLane[]
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
 * 从 researchPoolStore 读取研究池数据，返回看板所需接口。
 */
export function usePoolDataFromStore(): UsePoolDataResult {
  const {
    items,
    loading,
    error,
    refresh: storeRefresh,
    updateStatus,
    updateGroup,
  } = useResearchPoolStore()

  const [selectedGroup, setSelectedGroup] = useState<string>('')

  const lanes = useMemo<PoolLane[]>(() => {
    logger.debug('[usePoolDataFromStore] 转换 items → PoolLane[]', { itemCount: items.length })

    const grouped = new Map<ResearchStatus, PoolItem[]>()
    for (const item of items) {
      if (item.pool !== POOL_TYPE.research) continue
      const list = grouped.get(item.status) ?? []
      list.push(item)
      grouped.set(item.status, list)
    }

    return Array.from(grouped.entries()).map(([status, statusItems]) => {
      const options: PoolTransitionTarget[] = getPoolTransitionOptions(
        POOL_TYPE.research,
        status,
      )
      return {
        status,
        label: getPoolLabel(POOL_TYPE.research, status),
        items: statusItems,
        options,
      }
    })
  }, [items])

  const allGroups = useMemo<string[]>(() => {
    const groupSet = new Set<string>()
    for (const item of items) {
      groupSet.add(item.group ?? '默认')
    }
    const sorted = Array.from(groupSet).sort()
    logger.debug('[usePoolDataFromStore] 提取分组名称', { groupCount: sorted.length, groups: sorted })
    return sorted
  }, [items])

  const filteredLanes = useMemo<PoolLane[]>(() => {
    if (!selectedGroup) {
      logger.debug('[usePoolDataFromStore] 未选择分组，返回全部')
      return lanes
    }
    const filtered = lanes.map((lane) => ({
      ...lane,
      items: lane.items.filter((s) => (s.group ?? '默认') === selectedGroup),
    }))
    logger.debug('[usePoolDataFromStore] 按分组筛选', { selectedGroup, filteredCount: filtered.reduce((sum, g) => sum + g.items.length, 0) })
    return filtered
  }, [lanes, selectedGroup])

  const refresh = useCallback(async (): Promise<void> => {
    logger.info('[usePoolDataFromStore] refresh 调用 researchPoolStore.refresh')
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

  const handleTransition = useCallback(
    async (symbol: string, toStatus: ResearchStatus): Promise<void> => {
      logger.info(`[usePoolDataFromStore] handleTransition: ${symbol} → ${toStatus}`)
      const success = await updateStatus(symbol, toStatus)
      logUpdateOutcome('handleTransition', symbol, toStatus, success)
    },
    [updateStatus],
  )

  const handleChangeGroup = useCallback(
    async (symbol: string, group: string): Promise<void> => {
      logger.info(`[usePoolDataFromStore] handleChangeGroup: ${symbol} → ${group}`)
      const success = await updateGroup(symbol, group)
      logUpdateOutcome('handleChangeGroup', symbol, group, success)
    },
    [updateGroup],
  )

  return {
    lanes: filteredLanes,
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
