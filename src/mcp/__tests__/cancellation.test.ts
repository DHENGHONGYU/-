import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CancellationManager } from '@/mcp/core/cancellation'

describe('CancellationManager', () => {
  let manager: CancellationManager

  beforeEach(() => {
    manager = new CancellationManager()
  })

  it('should register and unregister AbortController', () => {
    const controller = new AbortController()
    manager.register('req-1', controller)
    expect(manager.getActiveCount()).toBe(1)

    manager.unregister('req-1')
    expect(manager.getActiveCount()).toBe(0)
  })

  it('should cancel a registered request', () => {
    const controller = new AbortController()
    const onAbort = vi.fn()
    controller.signal.addEventListener('abort', onAbort)

    manager.register('req-1', controller)
    const result = manager.cancel('req-1', 'User cancelled')

    expect(result).toBe(true)
    expect(onAbort).toHaveBeenCalled()
    expect(manager.getActiveCount()).toBe(0)
  })

  it('should return false for non-existent request', () => {
    const result = manager.cancel('nonexistent')
    expect(result).toBe(false)
  })

  it('should cancel all active requests', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    manager.register('req-1', c1)
    manager.register('req-2', c2)

    manager.cancelAll('Mass cancel')
    expect(manager.getActiveCount()).toBe(0)
  })

  it('should notify onCancel listeners', () => {
    const listener = vi.fn()
    manager.onCancel(listener)

    const controller = new AbortController()
    manager.register('req-1', controller)
    manager.cancel('req-1', 'Test')

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1', reason: 'Test' }),
    )
  })

  it('should unsubscribe onCancel listeners', () => {
    const listener = vi.fn()
    const unsubscribe = manager.onCancel(listener)
    unsubscribe()

    const controller = new AbortController()
    manager.register('req-1', controller)
    manager.cancel('req-1')

    expect(listener).not.toHaveBeenCalled()
  })

  it('should isolate listener errors', () => {
    const badListener = vi.fn().mockImplementation(() => {
      throw new Error('Boom!')
    })
    const goodListener = vi.fn()
    manager.onCancel(badListener)
    manager.onCancel(goodListener)

    const controller = new AbortController()
    manager.register('req-1', controller)
    manager.cancel('req-1')

    expect(goodListener).toHaveBeenCalledOnce()
  })
})