/**
 * @test_id V9-TEST-ST-027
 * @covers_docs []
 */
import { describe, it, expect, vi } from 'vitest'
import { eventBus } from '@/lib/eventBus'
import { withBroadcast, createBroadcaster } from '@/lib/withBroadcast'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('withBroadcast', () => {
  it('emits event with payload', () => {
    const handler = vi.fn()
    const unsubscribe = eventBus.on('TEST_EVENT', handler)
    withBroadcast('TEST_EVENT', { value: 42 })
    expect(handler).toHaveBeenCalledWith({ value: 42 })
    unsubscribe()
  })

  it('does not throw when no subscribers', () => {
    expect(() => withBroadcast('NO_SUBSCRIBERS_EVENT')).not.toThrow()
  })

  it('does not block write operation when emit fails', () => {
    const originalEmit = eventBus.emit
    eventBus.emit = vi.fn(() => {
      throw new Error('emit failed')
    })
    expect(() => withBroadcast('FAIL_EVENT')).not.toThrow()
    eventBus.emit = originalEmit
  })
})

describe('createBroadcaster', () => {
  it('returns a function that emits the bound event', () => {
    const handler = vi.fn()
    const unsubscribe = eventBus.on('BOUND_EVENT', handler)
    const broadcast = createBroadcaster('BOUND_EVENT')
    broadcast({ id: 'x' })
    expect(handler).toHaveBeenCalledWith({ id: 'x' })
    unsubscribe()
  })
})
