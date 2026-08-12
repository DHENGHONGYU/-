/**
 * @fileoverview PoolBoardPage 数据管理 Hook
 * 封装研究池数据的获取、刷新、进度汇总以及事件订阅逻辑
 */

import { useCallback, useEffect, useState } from 'react'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { getBatchCollectionProgress, type CollectionProgress as ProgressType } from '@/services/pool/collectionProgressService'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type { PoolItem } from '@/types/modules/pool.types'

export interface PoolCollectionSummary {
  avgPercent: number
  collectedCount: number
  ratingCounts: Record<string, number>
}

function buildSummary(progressMap: Map<string, ProgressType>): PoolCollectionSummary {
  const valid = Array.from(progressMap.values())
  const ratingCounts: Record<string, number> = {}
  let percentSum = 0
  for (const p of valid) {
    percentSum += p.completionPercent
    ratingCounts[p.qualityRating] = (ratingCounts[p.qualityRating] ?? 0) + 1
  }
  return {
    avgPercent: valid.length > 0 ? Math.round(percentSum / valid.length) : 0,
    collectedCount: valid.length,
    ratingCounts,
  }
}

export function usePoolBoardData() {
  const items = useResearchPoolStore((s) => s.items)
  const loading = useResearchPoolStore((s) => s.loading)
  const refresh = useResearchPoolStore((s) => s.refresh)
  
  const [summary, setSummary] = useState<PoolCollectionSummary | null>(null)

  const loadSummary = useCallback(async (items: PoolItem[]) => {
    if (items.length === 0) {
      setSummary(null)
      return
    }
    const progressMap = await getBatchCollectionProgress(items.map((i) => i.symbol))
    setSummary(buildSummary(progressMap))
  }, [])

  // 挂载时加载数据并订阅事件
  useEffect(() => {
    void refresh()
    void loadSummary(items)

    const onChanged = (): void => {
      void refresh()
      void loadSummary(useResearchPoolStore.getState().items)
    }
    const offPool = eventBus.on(EVENT_NAMES.POOL_CHANGED, onChanged)
    const offBatch = eventBus.on('BATCH_IMPORT_COMPLETED', onChanged)
    return () => {
      offPool()
      offBatch()
    }
  }, [refresh, loadSummary])

  return { items, loading, summary, refresh, loadSummary }
}
