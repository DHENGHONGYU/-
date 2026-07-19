/**
 * @test_id V9-TEST-UT-023
 * @covers_docs []
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { eventBus } from '@/lib/eventBus'

describe('eventBus', () => {
  beforeEach(() => {
    // Reset internal state by clearing all listeners
    const stats = eventBus.getStats()
    stats.listenersPerEvent.forEach(() => {
      // No direct clear API; we rely on unsubscribe returns from on()
    })
  })

  it('应该订阅 and receive emitted events', () => {
    const handler = vi.fn()
    eventBus.on('test:event', handler)
    eventBus.emit('test:event', { foo: 'bar' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('应该允许 multiple listeners for same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    eventBus.on('test:multi', handler1)
    eventBus.on('test:multi', handler2)
    eventBus.emit('test:multi', 123)

    expect(handler1).toHaveBeenCalledWith(123)
    expect(handler2).toHaveBeenCalledWith(123)
  })

  it('应该取消订阅 via returned function', () => {
    const handler = vi.fn()
    const unsubscribe = eventBus.on('test:unsub', handler)
    unsubscribe()
    eventBus.emit('test:unsub', 'data')

    expect(handler).not.toHaveBeenCalled()
  })

  it('应该取消订阅 via off()', () => {
    const handler = vi.fn()
    eventBus.on('test:off', handler)
    eventBus.off('test:off', handler)
    eventBus.emit('test:off', 'data')

    expect(handler).not.toHaveBeenCalled()
  })

  it('不应该 throw when emitting to no listeners', () => {
    expect(() => eventBus.emit('test:no-listeners', 'data')).not.toThrow()
  })

  it('不应该 throw when listener throws', () => {
    const badHandler = vi.fn(() => { throw new Error('listener error') })
    const goodHandler = vi.fn()
    eventBus.on('test:error', badHandler)
    eventBus.on('test:error', goodHandler)

    expect(() => eventBus.emit('test:error', 'data')).not.toThrow()
    expect(badHandler).toHaveBeenCalled()
    expect(goodHandler).toHaveBeenCalled()
  })

  it('应该返回 stats', () => {
    const handler = vi.fn()
    eventBus.on('test:stats', handler)
    const stats = eventBus.getStats()

    expect(stats.events).toBeGreaterThanOrEqual(1)
    expect(stats.totalListeners).toBeGreaterThanOrEqual(1)
    expect(stats.listenersPerEvent.some((e) => e.event === 'test:stats')).toBe(true)
  })

  it('应该触发 without payload', () => {
    const handler = vi.fn()
    eventBus.on('test:no-payload', handler)
    eventBus.emit('test:no-payload')

    expect(handler).toHaveBeenCalledWith(undefined)
  })

  it('应该clean up all listeners after multiple unsubscribes', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const unsub1 = eventBus.on('test:cleanup', handler1)
    const unsub2 = eventBus.on('test:cleanup', handler2)

    unsub1()
    unsub2()
    eventBus.emit('test:cleanup', 'data')

    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })
})
