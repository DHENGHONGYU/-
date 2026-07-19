/**
 * @test_id V9-TEST-ST-044
 * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-023, V9-DOC-AI-021]
 */
import { describe, it, expect, vi } from 'vitest'
import { NotificationManager } from '@/mcp/core/notification'
import type { NotificationMethod } from '@/types/modules/mcp.types'

describe('NotificationManager', () => {
  it('应该订阅 and emit', () => {
    const nm = new NotificationManager()
    const listener = vi.fn()
    nm.subscribe('notifications/tools/list_changed' as NotificationMethod, listener)
    nm.emit('notifications/tools/list_changed' as NotificationMethod, { serverName: 'test' })
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({
      method: 'notifications/tools/list_changed',
      params: { serverName: 'test' },
    })
  })

  it('应该返回 unsubscribe function', () => {
    const nm = new NotificationManager()
    const listener = vi.fn()
    const unsubscribe = nm.subscribe('notifications/progress' as NotificationMethod, listener)
    unsubscribe()
    nm.emit('notifications/progress' as NotificationMethod)
    expect(listener).not.toHaveBeenCalled()
  })

  it('应该isolate listener errors', () => {
    const nm = new NotificationManager()
    const badListener = vi.fn().mockImplementation(() => {
      throw new Error('Boom!')
    })
    const goodListener = vi.fn()
    nm.subscribe('notifications/cancelled' as NotificationMethod, badListener)
    nm.subscribe('notifications/cancelled' as NotificationMethod, goodListener)
    nm.emit('notifications/cancelled' as NotificationMethod)
    expect(goodListener).toHaveBeenCalledOnce()
  })

  it('应该support multiple listeners for same method', () => {
    const nm = new NotificationManager()
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    nm.subscribe('notifications/initialized' as NotificationMethod, listener1)
    nm.subscribe('notifications/initialized' as NotificationMethod, listener2)
    nm.emit('notifications/initialized' as NotificationMethod)
    expect(listener1).toHaveBeenCalledOnce()
    expect(listener2).toHaveBeenCalledOnce()
  })

  it('不应该 emit to unsubscribed listeners', () => {
    const nm = new NotificationManager()
    const listener = vi.fn()
    const unsub = nm.subscribe('notifications/resources/list_changed' as NotificationMethod, listener)
    unsub()
    nm.emit('notifications/resources/list_changed' as NotificationMethod)
    expect(listener).not.toHaveBeenCalled()
  })
})