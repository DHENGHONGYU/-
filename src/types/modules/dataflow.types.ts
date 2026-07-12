/**
 * @module DataFlowEngine
 * @lifecycle @Global
 * @description 数据流引擎模块，提供实时数据订阅、缓存、分发能力
 */

export interface DataFlowModuleInput {
  channel: string
  callback: (packet: DataPacket) => void
  options?: {
    intervalMs?: number
    persist?: boolean
  }
}

export interface DataFlowModuleOutput {
  unsubscribe: () => void
  stats: {
    connected: boolean
    channels: number
    subscribers: number
    cacheEntries: number
  }
}

export interface DataPacket {
  channel: string
  data: unknown
  timestamp: number
  seq: number
}

export interface ChannelMeta {
  channel: string
  description: string
  refreshInterval: number
  persist: boolean
  priority: 'high' | 'normal' | 'low'
}

export interface IOModule {
  input: DataFlowModuleInput
  output: DataFlowModuleOutput
}