import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { defaultDataBuilder } from './defaultDataBuilder'
import type { DataPacket, ChannelMeta, DataChannel } from './dataflowTypes'

const logger = getLogger()

type DataCallback<T = unknown> = (packet: DataPacket<T>) => void

const DEFAULT_CHANNELS: ChannelMeta[] = [
  { channel: 'market:index', description: '大盘指数实时数据', refreshInterval: 5000, persist: true, priority: 'high' },
  { channel: 'market:sector', description: '板块涨跌排行', refreshInterval: 10000, persist: true, priority: 'high' },
  { channel: 'market:fundflow', description: '资金流向统计', refreshInterval: 15000, persist: true, priority: 'normal' },
  { channel: 'market:emotion', description: '市场情绪指标', refreshInterval: 30000, persist: false, priority: 'low' },
  { channel: 'portfolio:summary', description: '持仓总览', refreshInterval: 10000, persist: true, priority: 'high' },
  { channel: 'portfolio:holding', description: '持仓明细', refreshInterval: 30000, persist: true, priority: 'normal' },
  { channel: 'strategy:signal', description: '买卖信号', refreshInterval: 5000, persist: false, priority: 'high' },
  { channel: 'strategy:score', description: '股票评分', refreshInterval: 60000, persist: true, priority: 'normal' },
  { channel: 'agent:status', description: 'Agent状态', refreshInterval: 10000, persist: false, priority: 'normal' },
  { channel: 'system:health', description: '系统健康', refreshInterval: 30000, persist: false, priority: 'low' },
]

export class DataFlowEngine {
  private subscribers = new Map<string, Set<DataCallback>>()
  private cache = new Map<string, { data: unknown; timestamp: number; seq: number }>()
  private channelMeta = new Map<string, ChannelMeta>()
  private eventSource: EventSource | null = null
  private connected = false
  private seqCounter = 0
  private connectionListeners = new Set<(connected: boolean) => void>()
  private refreshTimers = new Map<string, ReturnType<typeof setInterval>>()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly maxReconnectDelay = 30000
  private readonly maxReconnectAttempts = 5

  constructor() {
    logger.info('[DataFlowEngine] Initializing...')
    DEFAULT_CHANNELS.forEach((c) => {
      const meta = defaultDataBuilder.buildChannelMeta(c.channel)
      this.channelMeta.set(c.channel, meta)
      logger.debug(`[DataFlowEngine] Registered channel: ${c.channel} (${c.priority}, ${c.refreshInterval}ms)`)
    })
    logger.info(`[DataFlowEngine] Initialized with ${this.channelMeta.size} default channels`)
  }

  connect(url?: string): void {
    if (this.connected) {
      logger.debug('[DataFlowEngine] connect() skipped - already connected')
      return
    }
    logger.info(`[DataFlowEngine] connect() called, url=${url ?? 'none (polling mode)'}`)

    if (url && typeof EventSource !== 'undefined') {
      logger.debug('[DataFlowEngine] Attempting SSE connection...')
      try {
        this.eventSource = new EventSource(url)
        this.eventSource.onopen = () => {
          this.connected = true
          this.reconnectAttempts = 0
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }
          logger.info('[DataFlowEngine] SSE connection established successfully')
          eventBus.emit('DATAFLOW_CONNECTED', { connected: true })
          this._notifyConnectionChange(true)
        }
        this.eventSource.onmessage = (event) => {
          logger.debug(`[DataFlowEngine] SSE message received, length=${event.data.length}`)
          try {
            const packet = JSON.parse(event.data) as DataPacket
            if (packet.channel) {
              logger.debug(`[DataFlowEngine] Parsed packet: channel=${packet.channel}, seq=${packet.seq}`)
              this._distribute(packet)
            } else {
              logger.warn('[DataFlowEngine] Invalid packet: missing channel field')
            }
          } catch (parseErr) {
            logger.error('[DataFlowEngine] Failed to parse SSE message', { error: parseErr })
          }
        }
        this.eventSource.onerror = () => {
          this.connected = false
          logger.warn('[DataFlowEngine] SSE connection error')
          eventBus.emit('DATAFLOW_DISCONNECTED', { connected: false })
          this._notifyConnectionChange(false)
          this._scheduleReconnect(url)
        }
      } catch (connErr) {
        logger.warn('[DataFlowEngine] SSE connection failed, switching to polling mode', { error: connErr })
        this.connected = true
        eventBus.emit('DATAFLOW_CONNECTED', { connected: true })
        this._notifyConnectionChange(true)
      }
    } else {
      logger.info('[DataFlowEngine] Running in polling mode (EventSource not available or no URL)')
      this.connected = true
      eventBus.emit('DATAFLOW_CONNECTED', { connected: true })
      this._notifyConnectionChange(true)
    }
  }

  disconnect(): void {
    logger.info('[DataFlowEngine] disconnect() called')
    this.connected = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    if (this.eventSource) {
      logger.debug('[DataFlowEngine] Closing SSE connection')
      this.eventSource.close()
      this.eventSource = null
    }
    this.refreshTimers.forEach((timer, channel) => {
      clearInterval(timer)
      logger.debug(`[DataFlowEngine] Cleared refresh timer for channel: ${channel}`)
    })
    this.refreshTimers.clear()
    logger.info(`[DataFlowEngine] Disconnected. Cleared ${this.refreshTimers.size} refresh timers`)
    eventBus.emit('DATAFLOW_DISCONNECTED', { connected: false })
    this._notifyConnectionChange(false)
  }

  subscribe<T>(channel: string, callback: DataCallback<T>): () => void {
    logger.debug(`[DataFlowEngine] subscribe() called, channel="${channel}"`)

    if (!this.channelMeta.has(channel)) {
      logger.warn(`[DataFlowEngine] Subscribe to unknown channel: "${channel}"`)
    }

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
      logger.debug(`[DataFlowEngine] Created subscriber set for new channel: "${channel}"`)
    }

    const typedCallback = callback as DataCallback
    const prevCount = this.subscribers.get(channel)!.size
    this.subscribers.get(channel)!.add(typedCallback)
    const newCount = this.subscribers.get(channel)!.size

    logger.info(`[DataFlowEngine] Subscribe: channel="${channel}", count=${prevCount}→${newCount}`)

    const cached = this.cache.get(channel)
    if (cached) {
      logger.debug(`[DataFlowEngine] Found cached data for "${channel}", seq=${cached.seq}`)
      queueMicrotask(() => {
        try {
          logger.debug(`[DataFlowEngine] Delivering cached data to subscriber for "${channel}"`)
          typedCallback({ channel, data: cached.data, timestamp: cached.timestamp, seq: cached.seq } as DataPacket<T>)
        } catch (err) {
          logger.error(`[DataFlowEngine] Cache callback error for channel "${channel}"`, { error: err })
        }
      })
    } else {
      logger.debug(`[DataFlowEngine] No cached data for "${channel}"`)
    }

    return () => {
      this.subscribers.get(channel)?.delete(typedCallback)
      const remaining = this.subscribers.get(channel)?.size ?? 0
      logger.info(`[DataFlowEngine] Unsubscribe: channel="${channel}", remaining=${remaining}`)

      if (remaining === 0) {
        logger.debug(`[DataFlowEngine] Last subscriber removed from "${channel}", stopping refresh`)
        this.stopRefresh(channel)
      }
    }
  }

  publish<T>(channel: string, data: T): void {
    const startTs = Date.now()
    this.seqCounter++
    const packet: DataPacket<T> = { channel: channel as DataChannel, data, timestamp: Date.now(), seq: this.seqCounter }
    const meta = this.channelMeta.get(channel)

    if (!meta) {
      logger.warn(`[DataFlowEngine] Publish to unknown channel: "${channel}"`)
    }

    if (!meta || meta.persist) {
      this.cache.set(channel, { data, timestamp: packet.timestamp, seq: packet.seq })
      logger.debug(`[DataFlowEngine] Cache updated: channel="${channel}", seq=${packet.seq}, persist=${meta?.persist ?? 'default'}`)
    }

    logger.info(`[DataFlowEngine] Publish: channel="${channel}", seq=${packet.seq}, payloadSize=${JSON.stringify(data).length}`)
    eventBus.emit('DATAFLOW_PACKET_PUBLISHED', { channel, seq: packet.seq })

    this._distribute(packet)
    const duration = Date.now() - startTs
    if (duration > 10) {
      logger.warn(`[DataFlowEngine] Publish took ${duration}ms for channel "${channel}"`)
    }
  }

  registerRefresh<T>(channel: string, fetcher: () => Promise<T>, intervalMs?: number): void {
    logger.debug(`[DataFlowEngine] registerRefresh() called for "${channel}"`)

    const prevTimer = this.refreshTimers.has(channel)
    this.stopRefresh(channel)

    const meta = this.channelMeta.get(channel)
    const interval = intervalMs ?? meta?.refreshInterval ?? 30000

    if (!meta) {
      logger.warn(`[DataFlowEngine] registerRefresh for unknown channel "${channel}", using default interval=${interval}ms`)
    }

    const run = () => {
      const fetchStart = Date.now()
      logger.debug(`[DataFlowEngine] Refresh triggered for "${channel}"`)
      fetcher()
        .then((data) => {
          const fetchDuration = Date.now() - fetchStart
          logger.debug(`[DataFlowEngine] Refresh fetched "${channel}" in ${fetchDuration}ms`)
          this.publish(channel, data)
        })
        .catch((err) => {
          logger.warn(`[DataFlowEngine] Refresh failed for "${channel}"`, { error: err })
        })
    }

    run()
    const timer = setInterval(run, interval)
    this.refreshTimers.set(channel, timer)
    logger.info(`[DataFlowEngine] Refresh registered: channel="${channel}", interval=${interval}ms, wasUpdated=${prevTimer}`)
  }

  stopRefresh(channel: string): void {
    const timer = this.refreshTimers.get(channel)
    if (timer) {
      clearInterval(timer)
      this.refreshTimers.delete(channel)
      logger.info(`[DataFlowEngine] Refresh stopped: channel="${channel}"`)
    } else {
      logger.debug(`[DataFlowEngine] stopRefresh() called but no timer found for "${channel}"`)
    }
  }

  private _distribute<T>(packet: DataPacket<T>): void {
    const callbacks = this.subscribers.get(packet.channel)
    if (!callbacks || callbacks.size === 0) {
      logger.debug(`[DataFlowEngine] _distribute() skipped: no subscribers for "${packet.channel}"`)
      return
    }

    const startTs = Date.now()
    const callbackArray = Array.from(callbacks)
    logger.debug(`[DataFlowEngine] _distribute(): channel="${packet.channel}", subscribers=${callbackArray.length}`)

    callbackArray.forEach((cb, index) => {
      queueMicrotask(() => {
        const cbStart = Date.now()
        try {
          cb(packet)
          const cbDuration = Date.now() - cbStart
          if (cbDuration > 16) {
            logger.warn(`[DataFlowEngine] Slow subscriber: channel="${packet.channel}", #${index + 1}/${callbackArray.length}, duration=${cbDuration}ms`)
          } else if (cbDuration > 5) {
            logger.debug(`[DataFlowEngine] Subscriber #${index + 1} took ${cbDuration}ms for "${packet.channel}"`)
          }
        } catch (err) {
          logger.error(`[DataFlowEngine] Subscriber error: channel="${packet.channel}", #${index + 1}`, { error: err })
        }
      })
    })

    const dispatchDuration = Date.now() - startTs
    if (dispatchDuration > 5) {
      logger.info(`[DataFlowEngine] Dispatch completed: channel="${packet.channel}", subscribers=${callbackArray.length}, duration=${dispatchDuration}ms`)
    }
  }

  private _scheduleReconnect(url?: string): void {
    if (this.reconnectTimer) {
      logger.debug('[DataFlowEngine] Reconnect already scheduled')
      return
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay)
    this.reconnectAttempts++
    logger.info(`[DataFlowEngine] Scheduling SSE reconnect in ${delay}ms (attempt=${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._tryReconnect(url)
    }, delay)
  }

  private _tryReconnect(url?: string): void {
    if (this.connected) {
      logger.debug('[DataFlowEngine] _tryReconnect() skipped - already connected')
      return
    }
    if (!url) {
      logger.debug('[DataFlowEngine] _tryReconnect() skipped - no URL')
      return
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('[DataFlowEngine] Max reconnect attempts reached, falling back to polling')
      this._fallbackToPolling()
      return
    }
    logger.info(`[DataFlowEngine] Attempting SSE reconnect (attempt=${this.reconnectAttempts})`)
    this.connect(url)
  }

  private _fallbackToPolling(): void {
    logger.info('[DataFlowEngine] Falling back to polling mode')
    this.connected = true
    eventBus.emit('DATAFLOW_CONNECTED', { connected: true })
    this._notifyConnectionChange(true)
  }

  private _notifyConnectionChange(connected: boolean): void {
    logger.debug(`[DataFlowEngine] _notifyConnectionChange(): connected=${connected}, listeners=${this.connectionListeners.size}`)
    this.connectionListeners.forEach((l) => {
      try { l(connected) } catch (err) { logger.error('[DataFlowEngine] Connection listener error', { error: err }) }
    })
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener)
    logger.debug(`[DataFlowEngine] Connection listener added, total=${this.connectionListeners.size}`)
    return () => {
      this.connectionListeners.delete(listener)
      logger.debug(`[DataFlowEngine] Connection listener removed, total=${this.connectionListeners.size}`)
    }
  }

  getStats() {
    const stats = {
      connected: this.connected,
      channels: this.subscribers.size,
      subscribers: Array.from(this.subscribers.entries()).map(([ch, set]) => ({ channel: ch, count: set.size })),
      cacheEntries: this.cache.size,
      refreshTasks: this.refreshTimers.size,
    }
    logger.debug(`[DataFlowEngine] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }

  destroy(): void {
    logger.info('[DataFlowEngine] destroy() called')
    this.disconnect()
    this.subscribers.clear()
    this.cache.clear()
    this.connectionListeners.clear()
    logger.info('[DataFlowEngine] Destroyed: all resources cleaned up')
  }
}

export const dataFlowEngine = new DataFlowEngine()