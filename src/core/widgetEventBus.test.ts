import { describe, it, expect, beforeEach, vi } from 'vitest'
import { widgetEventBus } from './widgetEventBus'

describe('widgetEventBus', () => {
  beforeEach(() => {
    widgetEventBus.clear()
  })

  describe('subscribe & publish', () => {
    it('订阅后发布事件能收到回调', () => {
      const callback = vi.fn()
      widgetEventBus.subscribe('widget:w1:update', callback)
      widgetEventBus.publish('widget:w1:update', { value: 42 })
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({ value: 42 })
    })

    it('同一事件多个订阅者都收到', () => {
      const c1 = vi.fn()
      const c2 = vi.fn()
      widgetEventBus.subscribe('widget:w1:click', c1)
      widgetEventBus.subscribe('widget:w1:click', c2)
      widgetEventBus.publish('widget:w1:click', { x: 10, y: 20 })
      expect(c1).toHaveBeenCalledTimes(1)
      expect(c2).toHaveBeenCalledTimes(1)
    })

    it('不同事件互不干扰', () => {
      const c1 = vi.fn()
      const c2 = vi.fn()
      widgetEventBus.subscribe('widget:w1:a', c1)
      widgetEventBus.subscribe('widget:w1:b', c2)
      widgetEventBus.publish('widget:w1:a', 'data')
      expect(c1).toHaveBeenCalled()
      expect(c2).not.toHaveBeenCalled()
    })

    it('发布无订阅的事件不报错', () => {
      expect(() => widgetEventBus.publish('widget:none', 123)).not.toThrow()
    })

    it('subscribe 返回取消订阅函数', () => {
      const callback = vi.fn()
      const unsubscribe = widgetEventBus.subscribe('widget:test:ev', callback)
      widgetEventBus.publish('widget:test:ev', 1)
      unsubscribe()
      widgetEventBus.publish('widget:test:ev', 2)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('unsubscribe', () => {
    it('显式取消订阅', () => {
      const callback = vi.fn()
      widgetEventBus.subscribe('widget:test:ev', callback)
      widgetEventBus.unsubscribe('widget:test:ev', callback)
      widgetEventBus.publish('widget:test:ev', 'data')
      expect(callback).not.toHaveBeenCalled()
    })

    it('取消不存在的回调不报错', () => {
      const callback = vi.fn()
      expect(() => widgetEventBus.unsubscribe('widget:none:ev', callback)).not.toThrow()
    })

    it('最后一个订阅者取消后事件被清理', () => {
      const callback = vi.fn()
      widgetEventBus.subscribe('widget:temp:ev', callback)
      widgetEventBus.unsubscribe('widget:temp:ev', callback)
      // 再次发布不报错，且无回调被触发
      expect(() => widgetEventBus.publish('widget:temp:ev', 'x')).not.toThrow()
    })
  })

  describe('clear', () => {
    it('清空所有订阅', () => {
      const c1 = vi.fn()
      const c2 = vi.fn()
      widgetEventBus.subscribe('widget:a:ev', c1)
      widgetEventBus.subscribe('widget:b:ev', c2)
      widgetEventBus.clear()
      widgetEventBus.publish('widget:a:ev', 1)
      widgetEventBus.publish('widget:b:ev', 2)
      expect(c1).not.toHaveBeenCalled()
      expect(c2).not.toHaveBeenCalled()
    })
  })

  describe('错误隔离', () => {
    it('某个回调抛出错误不影响其他回调', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const c1 = vi.fn(() => { throw new Error('oops') })
      const c2 = vi.fn()
      widgetEventBus.subscribe('widget:err:ev', c1)
      widgetEventBus.subscribe('widget:err:ev', c2)
      expect(() => widgetEventBus.publish('widget:err:ev', 'data')).not.toThrow()
      expect(c1).toHaveBeenCalled()
      expect(c2).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })
})
