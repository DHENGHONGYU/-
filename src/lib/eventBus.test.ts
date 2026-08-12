import { describe, it, expect, beforeEach, vi } from 'vitest'
import { eventBus } from './eventBus'

describe('eventBus', () => {
  beforeEach(() => {
    eventBus.clearAll()
  })

  describe('on() & emit()', () => {
    it('订阅后能收到事件', () => {
      const handler = vi.fn()
      eventBus.on('test.event', handler)
      eventBus.emit('test.event', { data: 'hello' })
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ data: 'hello' })
    })

    it('同一事件多个订阅者都能收到', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      eventBus.on('multi', h1)
      eventBus.on('multi', h2)
      eventBus.emit('multi', 42)
      expect(h1).toHaveBeenCalledWith(42)
      expect(h2).toHaveBeenCalledWith(42)
    })

    it('emit 无订阅的事件不报错', () => {
      expect(() => eventBus.emit('nonexistent', {})).not.toThrow()
    })

    it('emit 不传 payload 时 payload 为 undefined', () => {
      const handler = vi.fn()
      eventBus.on('nopayload', handler)
      eventBus.emit('nopayload')
      expect(handler).toHaveBeenCalledWith(undefined)
    })

    it('on 返回取消订阅函数', () => {
      const handler = vi.fn()
      const off = eventBus.on('test', handler)
      eventBus.emit('test', 1)
      off()
      eventBus.emit('test', 2)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('off()', () => {
    it('移除指定回调', () => {
      const handler = vi.fn()
      eventBus.on('test', handler)
      eventBus.off('test', handler)
      eventBus.emit('test', 'data')
      expect(handler).not.toHaveBeenCalled()
    })

    it('移除不存在的回调不报错', () => {
      const handler = vi.fn()
      expect(() => eventBus.off('noevent', handler)).not.toThrow()
    })
  })

  describe('getStats()', () => {
    it('返回事件统计信息', () => {
      eventBus.on('a', () => {})
      eventBus.on('a', () => {})
      eventBus.on('b', () => {})
      const stats = eventBus.getStats()
      expect(stats.events).toBe(2)
      expect(stats.totalListeners).toBe(3)
      const eventA = stats.listenersPerEvent.find((e: { event: string }) => e.event === 'a')
      expect(eventA?.count).toBe(2)
    })

    it('空状态时 events 为 0', () => {
      const stats = eventBus.getStats()
      expect(stats.events).toBe(0)
      expect(stats.totalListeners).toBe(0)
    })
  })

  describe('clearAll()', () => {
    it('清空所有订阅', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      eventBus.on('e1', h1)
      eventBus.on('e2', h2)
      eventBus.clearAll()
      eventBus.emit('e1')
      eventBus.emit('e2')
      expect(h1).not.toHaveBeenCalled()
      expect(h2).not.toHaveBeenCalled()
      expect(eventBus.getStats().events).toBe(0)
    })
  })

  describe('错误隔离', () => {
    it('某个订阅者抛出错误不影响其他订阅者', () => {
      const h1 = vi.fn(() => { throw new Error('oops') })
      const h2 = vi.fn()
      eventBus.on('err', h1)
      eventBus.on('err', h2)
      expect(() => eventBus.emit('err', 'data')).not.toThrow()
      expect(h1).toHaveBeenCalled()
      expect(h2).toHaveBeenCalled()
    })
  })
})
