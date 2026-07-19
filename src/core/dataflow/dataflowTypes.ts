/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-003, V9-DOC-PROJ-002, V9-DOC-ARCH-008, V9-DOC-BACK-008]
 */
export type DataChannel = 
  | 'market:index'
  | 'market:sector'
  | 'market:fundflow'
  | 'market:emotion'
  | 'portfolio:summary'
  | 'portfolio:holding'
  | 'portfolio:risk'
  | 'strategy:signal'
  | 'strategy:score'
  | 'agent:status'
  | 'agent:logs'
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
  /** 缓存过期时间（毫秒），0 表示不缓存 */
  ttl?: number
}

export type DataCallback<T = unknown> = (packet: DataPacket<T>) => void

/** 数据流缓存统计 */
export interface CacheStats {
  hits: number
  hitCount: number
  misses: number
  missCount: number
  size: number
  totalRequests: number
  totalEntries: number
  maxEntries: number
  hitRate: number
  expiredCount: number
  evictedCount: number
}

/** 数据流事件名称 */
export const DATAFLOW_EVENTS = {
  DATAFLOW_CONNECTED: 'dataflow:connected',
  DATAFLOW_DISCONNECTED: 'dataflow:disconnected',
  DATAFLOW_PACKET_PUBLISHED: 'dataflow:packet_published',
} as const