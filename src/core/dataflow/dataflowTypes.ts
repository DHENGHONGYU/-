export type DataChannel = 
  | 'market:index'
  | 'market:sector'
  | 'market:fundflow'
  | 'market:emotion'
  | 'portfolio:summary'
  | 'portfolio:holding'
  | 'strategy:signal'
  | 'strategy:score'
  | 'agent:status'
  | 'system:health'

export interface DataPacket<T = unknown> {
  channel: DataChannel
  data: T
  timestamp: number
  seq: number
}

export interface ChannelMeta {
  channel: DataChannel
  description: string
  refreshInterval: number
  persist: boolean
  priority: 'high' | 'normal' | 'low'
}

export type DataCallback<T = unknown> = (packet: DataPacket<T>) => void