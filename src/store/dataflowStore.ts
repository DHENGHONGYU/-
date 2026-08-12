/** @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。  * @doc [V9-DOC-DATA-018, V9-DOC-DATA-002, V9-DOC-DATA-021, V9-DOC-DATA-008, V9-DOC-DATA-006]
*/
import { create } from 'zustand'
import { dataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { eventBus } from '@/lib/eventBus'

interface DataflowState {
  connected: boolean
  channels: Map<string, { subscribers: number; lastPublish: number }>
  cache: Map<string, unknown>
  stats: ReturnType<typeof dataFlowEngine.getStats>
  setConnected: (connected: boolean) => void
  updateChannelSubscribers: (channel: string, count: number) => void
  updateCache: (channel: string, data: unknown) => void
  refreshStats: () => void
  /** 重置 Store 到初始状态 */
  reset: () => void
}

/**
 * useDataflowStore
 */
export const useDataflowStore = create<DataflowState>((set) => ({
  connected: false,
  channels: new Map(),
  cache: new Map(),
  stats: dataFlowEngine.getStats(),
  setConnected: (connected) => set({ connected }),
  updateChannelSubscribers: (channel, count) => set((state) => {
    const channels = new Map(state.channels)
    channels.set(channel, { ...channels.get(channel), subscribers: count, lastPublish: Date.now() })
    return { channels }
  }),
  updateCache: (channel, data) => set((state) => {
    const cache = new Map(state.cache)
    cache.set(channel, data)
    return { cache }
  }),
  refreshStats: () => set({ stats: dataFlowEngine.getStats() }),
  reset: () => set({
    connected: false,
    channels: new Map(),
    cache: new Map(),
    stats: dataFlowEngine.getStats(),
  }),
}))

const dataflowSubscriptions: Array<() => void> = []

/**
 * initDataflowSubscriptions
 */
export function initDataflowSubscriptions(): () => void {
  destroyDataflowSubscriptions()
  dataflowSubscriptions.push(
    eventBus.on('DATAFLOW_CONNECTED', () => {
      useDataflowStore.getState().setConnected(true)
      useDataflowStore.getState().refreshStats()
    }),
    eventBus.on('DATAFLOW_DISCONNECTED', () => {
      useDataflowStore.getState().setConnected(false)
      useDataflowStore.getState().refreshStats()
    }),
    eventBus.on('DATAFLOW_PACKET_PUBLISHED', (payload) => {
      const { channel } = payload as { channel: string }
      const cached = dataFlowEngine.getStats().subscribers.find((s) => s.channel === channel)
      if (cached) {
        useDataflowStore.getState().updateChannelSubscribers(channel, cached.count)
      }
    }),
  )
  return () => destroyDataflowSubscriptions()
}

/**
 * destroyDataflowSubscriptions
 * @returns void
 */
export function destroyDataflowSubscriptions(): void {
  dataflowSubscriptions.forEach((unsubscribe) => unsubscribe())
  dataflowSubscriptions.length = 0
}

initDataflowSubscriptions()