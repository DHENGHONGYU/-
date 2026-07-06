import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import type { EngineConfig, EngineStats } from '@/types/modules/engine.types'

interface EngineState {
  started: boolean
  startedAt: number | null
  stats: EngineStats
  config: EngineConfig
  layerStatuses: Record<string, { layerId: string; layerName: string; name: string; weight: number; executionCount: number; deterministic: boolean; llmEnhanceable: boolean; status: 'healthy' | 'warning' | 'critical' | 'unknown' }>
  healthSummary: { status: 'healthy' | 'warning' | 'critical' | 'unknown'; message: string; overallStatus: 'healthy' | 'warning' | 'critical' | 'unknown' }
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
  startedAt: null,
  stats: defaultStats,
  config: {},
  layerStatuses: {},
  healthSummary: { status: 'unknown', message: '引擎未启动', overallStatus: 'unknown' },
  setStarted: (started) => {
    set({ started, startedAt: started ? Date.now() : null })
    eventBus.emit('ENGINE_STORE_STARTED_CHANGED', { started })
  },
  setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
  updateStats: (stats) => set((state) => ({
    stats: {
      dataflow: { ...state.stats.dataflow, ...stats.dataflow },
      agents: { ...state.stats.agents, ...stats.agents },
    },
  })),
  reset: () => set({ started: false, startedAt: null, stats: defaultStats, config: {}, layerStatuses: {}, healthSummary: { status: 'unknown', message: '引擎未启动', overallStatus: 'unknown' } }),
}))
