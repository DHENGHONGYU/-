import { getLogger } from '@/lib/logger'

const logger = getLogger()

type EventCallback = (payload: unknown) => void

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>()

  on(event: string, callback: EventCallback): () => void {
    logger.debug(`[EventBus] on() called: event="${event}"`)

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
      logger.debug(`[EventBus] Created new listener set for event: "${event}"`)
    }

    const prevCount = this.listeners.get(event)!.size
    this.listeners.get(event)!.add(callback)
    const newCount = this.listeners.get(event)!.size

    logger.info(`[EventBus] Subscribe: event="${event}", count=${prevCount}→${newCount}`)

    return () => {
      const wasPresent = this.listeners.get(event)?.has(callback)
      this.listeners.get(event)?.delete(callback)
      const remaining = this.listeners.get(event)?.size ?? 0

      if (wasPresent) {
        logger.info(`[EventBus] Unsubscribe: event="${event}", remaining=${remaining}`)
      }
    }
  }

  emit(event: string, payload?: unknown): void {
    const startTs = Date.now()
    logger.debug(`[EventBus] emit() called: event="${event}", hasPayload=${payload !== undefined}`)

    const callbacks = this.listeners.get(event)
    if (!callbacks) {
      logger.debug(`[EventBus] emit() skipped: no listeners for event "${event}"`)
      return
    }

    const callbackCount = callbacks.size
    logger.debug(`[EventBus] Emitting to ${callbackCount} listeners: event="${event}"`)

    let successCount = 0
    let errorCount = 0
    let listenerIndex = 0

    callbacks.forEach((cb) => {
      listenerIndex++
      try {
        cb(payload)
        successCount++
      } catch (err) {
        errorCount++
        logger.error(`[EventBus] Listener #${listenerIndex} error for event "${event}"`, { error: err })
      }
    })

    const duration = Date.now() - startTs
    if (duration > 10) {
      logger.warn(`[EventBus] emit() took ${duration}ms for event "${event}"`)
    }

    logger.info(`[EventBus] Emit completed: event="${event}", listeners=${callbackCount}, success=${successCount}, errors=${errorCount}`)
  }

  off(event: string, callback: EventCallback): void {
    logger.debug(`[EventBus] off() called: event="${event}"`)

    const callbacks = this.listeners.get(event)
    if (!callbacks) {
      logger.debug(`[EventBus] off() skipped: no listeners for event "${event}"`)
      return
    }

    const wasPresent = callbacks.has(callback)
    callbacks.delete(callback)
    const remaining = callbacks.size

    logger.info(`[EventBus] off(): event="${event}", removed=${wasPresent}, remaining=${remaining}`)
  }

  getStats() {
    const stats = {
      events: this.listeners.size,
      totalListeners: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
      listenersPerEvent: Array.from(this.listeners.entries()).map(([event, set]) => ({ event, count: set.size })),
    }
    logger.debug(`[EventBus] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }
}

export const eventBus = new EventBus()
