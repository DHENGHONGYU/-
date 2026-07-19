/** @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。 */
import { create } from 'zustand'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { eventBus } from '@/lib/eventBus'
import type { WidgetConfig, WidgetRuntimeState } from '@/types/modules/widget.types'

interface WidgetState {
  instances: Map<string, WidgetConfig>
  runtimeStates: Map<string, WidgetRuntimeState>
  stats: ReturnType<typeof widgetRegistry.getStats>
  dataHashes: Map<string, string>
  addInstance: (config: WidgetConfig) => void
  removeInstance: (instanceId: string) => void
  updateInstance: (instanceId: string, updates: Partial<WidgetConfig>) => void
  updateRuntimeState: (instanceId: string, state: Partial<WidgetRuntimeState>) => void
  refreshStats: () => void
  refreshInstance: (instanceId: string, newData?: unknown) => boolean
}

/**
 * useWidgetStore
 */
export const useWidgetStore = create<WidgetState>((set) => ({
  instances: new Map(),
  runtimeStates: new Map(),
  stats: widgetRegistry.getStats(),
  dataHashes: new Map(),
  addInstance: (config) => set((state) => {
    const instances = new Map(state.instances)
    instances.set(config.instanceId, config)
    return { instances }
  }),
  removeInstance: (instanceId) => set((state) => {
    const instances = new Map(state.instances)
    const runtimeStates = new Map(state.runtimeStates)
    const dataHashes = new Map(state.dataHashes)
    instances.delete(instanceId)
    runtimeStates.delete(instanceId)
    dataHashes.delete(instanceId)
    return { instances, runtimeStates, dataHashes }
  }),
  updateInstance: (instanceId, updates) => set((state) => {
    const instances = new Map(state.instances)
    const existing = instances.get(instanceId)
    if (existing) {
      instances.set(instanceId, { ...existing, ...updates })
    }
    return { instances }
  }),
  updateRuntimeState: (instanceId, state) => set((prev) => {
    const runtimeStates = new Map(prev.runtimeStates)
    const existing = runtimeStates.get(instanceId)
    runtimeStates.set(instanceId, { ...existing, ...state, instanceId } as WidgetRuntimeState)
    return { runtimeStates }
  }),
  refreshStats: () => set({ stats: widgetRegistry.getStats() }),
  refreshInstance: (instanceId, newData) => {
    const state = useWidgetStore.getState()
    const prevHash = state.dataHashes.get(instanceId)
    
    const newHash = newData !== undefined 
      ? JSON.stringify(newData)
      : Date.now().toString()

    if (prevHash === newHash) {
      return false
    }

    set((prev) => {
      const dataHashes = new Map(prev.dataHashes)
      dataHashes.set(instanceId, newHash)
      const runtimeStates = new Map(prev.runtimeStates)
      const existing = runtimeStates.get(instanceId)
      runtimeStates.set(instanceId, { 
        ...existing, 
        status: 'ready', 
        lastRefresh: Date.now() 
      } as WidgetRuntimeState)
      return { dataHashes, runtimeStates }
    })

    eventBus.emit('WIDGET_REFRESH_SUCCESS', { instanceId })
    return true
  },
}))

const widgetSubscriptions: Array<() => void> = []

/**
 * initWidgetSubscriptions
 */
export function initWidgetSubscriptions(): () => void {
  destroyWidgetSubscriptions()
  widgetSubscriptions.push(
    eventBus.on('WIDGET_MOUNT_SUCCESS', (payload) => {
      const { instanceId } = payload as { instanceId: string }
      const config = widgetRegistry.getInstance(instanceId)
      if (config) {
        useWidgetStore.getState().addInstance(config)
        useWidgetStore.getState().updateRuntimeState(instanceId, { status: 'ready', lastRefresh: Date.now() })
      }
      useWidgetStore.getState().refreshStats()
    }),
    eventBus.on('WIDGET_UNMOUNT', (payload) => {
      const { instanceId } = payload as { instanceId: string }
      useWidgetStore.getState().removeInstance(instanceId)
      useWidgetStore.getState().refreshStats()
    }),
    eventBus.on('WIDGET_REFRESH_SUCCESS', (payload) => {
      const { instanceId } = payload as { instanceId: string }
      useWidgetStore.getState().updateRuntimeState(instanceId, { status: 'ready', lastRefresh: Date.now() })
    }),
    eventBus.on('WIDGET_MOUNT_ERROR', (payload) => {
      const { instanceId, error } = payload as { instanceId: string; error: string }
      useWidgetStore.getState().updateRuntimeState(instanceId, { status: 'error', error })
    }),
  )
  return () => destroyWidgetSubscriptions()
}

/**
 * destroyWidgetSubscriptions
 * @returns void
 */
export function destroyWidgetSubscriptions(): void {
  widgetSubscriptions.forEach((unsubscribe) => unsubscribe())
  widgetSubscriptions.length = 0
}

initWidgetSubscriptions()