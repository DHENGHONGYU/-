/**
 * @fileoverview 个股采集进度数据 Hook
 * 封装 collectionProgressService 调用，作为组件与 Service 之间的防腐层
 */

import { useEffect, useState } from 'react'
import {
  getCollectionProgress,
  type CollectionProgress as ProgressType,
} from '@/services/pool/collectionProgressService'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import { PROGRESS_REFRESH_EVENT } from '@/hooks/pool/usePoolBoardCollect'

export interface CollectionProgressData {
  progress: ProgressType | null
  loading: boolean
  collecting: boolean
}

export function useCollectionProgressData(symbol: string): CollectionProgressData {
  const [progress, setProgress] = useState<ProgressType | null>(null)
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      const result = await getCollectionProgress(symbol)
      if (!cancelled) {
        setProgress(result)
        setLoading(false)
      }
    }

    void load()

    const offComplete = eventBus.on(COLLECTION_EVENTS.COMPLETE, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        setCollecting(false)
        void load()
      }
    })

    const offTriggered = eventBus.on(COLLECTION_EVENTS.TRIGGERED, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        setCollecting(true)
        void load()
      }
    })

    const offGlobalRefresh = eventBus.on(PROGRESS_REFRESH_EVENT, () => {
      void load()
    })

    return () => {
      cancelled = true
      offComplete()
      offTriggered()
      offGlobalRefresh()
    }
  }, [symbol])

  return { progress, loading, collecting }
}
