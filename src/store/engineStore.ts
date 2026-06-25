import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import type { EngineConfig, EngineStats } from '@/types/modules/engine.types'

interface EngineState {
  started: boolean
  stats: EngineStats
  config: EngineConfig
  setStarted: (started: boolean) => void
  setConfig: (config: Partial<EngineConfig>) => void
  updateStats: (stats: { dataflow?: Partial<EngineStats['dataflow']>; agents?: Partial<EngineStats['agents']> }) => void
  reset: () => void
}

const defaultStats: EngineStats = {
  dataflow: { channels: 0, subscriberChannels: 0, connected: false },
  agents: { totalAgents: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0 },
}

export const useEngineStore = create<EngineState>((set) => ({
  started: false,
  stats: defaultStats,
  config: {},
  setStarted: (started) => {
    set({ started })
    eventBus.emit('ENGINE_STORE_STARTED_CHANGED', { started })
  },
  setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
  updateStats: (stats) => set((state) => ({
    stats: {
      dataflow: { ...state.stats.dataflow, ...stats.dataflow },
      agents: { ...state.stats.agents, ...stats.agents },
    },
  })),
  reset: () => set({ started: false, stats: defaultStats, config: {} }),
}))
