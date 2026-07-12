import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import type { DataBridgeAdapterStats, BridgeQueryResult } from '@/types/modules/databridge.types'

interface DataBridgeState {
  pendingCount: number
  stats: DataBridgeAdapterStats
  lastError: string | null
  lastTraceId: string | null
  setPendingCount: (count: number) => void
  setStats: (stats: Partial<DataBridgeAdapterStats>) => void
  recordResult: (result: BridgeQueryResult) => void
  reset: () => void
}

const defaultStats: DataBridgeAdapterStats = {
  pendingQueries: 0,
  enableFallbackQueue: true,
}

/**
 * useDataBridgeStore
 */
export const useDataBridgeStore = create<DataBridgeState>((set) => ({
  pendingCount: 0,
  stats: defaultStats,
  lastError: null,
  lastTraceId: null,
  setPendingCount: (count) => {
    set({ pendingCount: count })
    eventBus.emit('DATABRIDGE_PENDING_CHANGED', { count })
  },
  setStats: (stats) => set((state) => ({ stats: { ...state.stats, ...stats } })),
  recordResult: (result) => {
    set({
      lastError: result.success ? null : (result.error ?? null),
      lastTraceId: result.traceId,
    })
    if (!result.success) {
      eventBus.emit('DATABRIDGE_QUERY_FAILED', { error: result.error, traceId: result.traceId })
    }
  },
  reset: () => set({ pendingCount: 0, stats: defaultStats, lastError: null, lastTraceId: null }),
}))
