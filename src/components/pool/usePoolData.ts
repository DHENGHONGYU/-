import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ResearchStatus } from '@/config/dbConfig'
import {
  DEFAULT_POOL_GROUP,
  getAllPoolGroups,
  getPoolGroups,
  transitionStock,
  updateStockGroup,
  type PoolGroup,
} from '@/services/stockpool/stockpoolService'

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

export function usePoolData(): UsePoolDataResult {
  const [groups, setGroups] = useState<PoolGroup[]>([])
  const [allGroups, setAllGroups] = useState<string[]>([DEFAULT_POOL_GROUP])
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [poolResult, groupsResult] = await Promise.all([
        getAllPoolGroups(),
        getPoolGroups(),
      ])

      if (poolResult.success && poolResult.data) {
        setGroups(poolResult.data)
      } else {
        setError(poolResult.error ?? '加载股票池失败')
      }

      if (groupsResult.success && groupsResult.data) {
        setAllGroups(groupsResult.data)
        setSelectedGroup((prev) => {
          if (prev && groupsResult.data!.includes(prev)) return prev
          return ''
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTransition = useCallback(
    async (symbol: string, toStatus: ResearchStatus): Promise<void> => {
      const result = await transitionStock(symbol, toStatus)
      if (!result.success) {
        setError(result.error ?? '流转失败')
      }
      await refresh()
    },
    [refresh],
  )

  const handleChangeGroup = useCallback(
    async (symbol: string, group: string): Promise<void> => {
      const result = await updateStockGroup(symbol, group)
      if (!result.success) {
        setError(result.error ?? '切换分组失败')
      }
      await refresh()
    },
    [refresh],
  )

  const filteredGroups = useMemo<PoolGroup[]>(() => {
    if (!selectedGroup) return groups
    return groups.map((g) => ({
      ...g,
      stocks: g.stocks.filter(
        (s) => (s.group ?? DEFAULT_POOL_GROUP) === selectedGroup,
      ),
    }))
  }, [groups, selectedGroup])

  useEffect(() => {
    refresh()
  }, [refresh])

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
