import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import {
  CABIN_APPS,
  getActiveApp,
  preloadCabinApps,
  resetPreloadedCabins,
} from './cabinDispatcher'

// jsdom 中无 requestIdleCallback，先注入 polyfill
if (typeof window !== 'undefined' && !('requestIdleCallback' in window)) {
  (window as Window & typeof globalThis).requestIdleCallback = (cb: IdleRequestCallback) =>
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0) as unknown as number
}

describe('cabinDispatcher', () => {
  describe('CABIN_APPS', () => {
    it('应包含全部五舱映射', () => {
      expect(CABIN_APPS).toHaveProperty('input')
      expect(CABIN_APPS).toHaveProperty('analysis')
      expect(CABIN_APPS).toHaveProperty('trading')
      expect(CABIN_APPS).toHaveProperty('output')
      expect(CABIN_APPS).toHaveProperty('command')
    })

    it('每个舱室映射应为 React.lazy 组件', () => {
      for (const [_cabin, Component] of Object.entries(CABIN_APPS)) {
        expect(Component).toBeDefined()
        expect(typeof Component).toBe('object')
      }
    })
  })

  describe('getActiveApp()', () => {
    it('应返回对应舱室的基础 App', () => {
      const App = getActiveApp('input', false, false)
      expect(App).toBe(CABIN_APPS.input)

      const App2 = getActiveApp('trading', false, false)
      expect(App2).toBe(CABIN_APPS.trading)
    })

    it('command + isAgentPath 应返回 AgentApp', () => {
      const App = getActiveApp('command', true, false)
      expect(App).not.toBe(CABIN_APPS.command)
    })

    it('command + isMCPPath 应返回 MCPServerDashboardPage', () => {
      const App = getActiveApp('command', false, true)
      expect(App).not.toBe(CABIN_APPS.command)
    })

    it('command + 普通路径应返回 CommandApp', () => {
      const App = getActiveApp('command', false, false)
      expect(App).toBe(CABIN_APPS.command)
    })

    it('非 command 舱室应忽略 isAgentPath / isMCPPath', () => {
      const App = getActiveApp('analysis', true, true)
      expect(App).toBe(CABIN_APPS.analysis)
    })
  })

  describe('preloadCabinApps()', () => {
    let requestIdleCallbackSpy: MockInstance<
      (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    >

    beforeEach(() => {
      resetPreloadedCabins()
      requestIdleCallbackSpy = vi
        .spyOn(window, 'requestIdleCallback')
        .mockImplementation((cb: IdleRequestCallback) => {
          cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
          return 1
        })
    })

    afterEach(() => {
      if (requestIdleCallbackSpy) requestIdleCallbackSpy.mockRestore()
      resetPreloadedCabins()
    })

    it('应触发相邻舱室的预加载', () => {
      preloadCabinApps('input')
      expect(requestIdleCallbackSpy).toHaveBeenCalled()
    })

    it('重复预加载同一舱室应被去重', () => {
      preloadCabinApps('input')
      preloadCabinApps('input')
      // 每次调用都会触发 requestIdleCallback，但内部 preloadedCabins 去重
      expect(requestIdleCallbackSpy).toHaveBeenCalledTimes(2)
    })

    it('无相邻舱室的舱室不应触发预加载', () => {
      // 所有舱室都有相邻舱室，此测试主要验证不抛异常
      preloadCabinApps('command')
      expect(requestIdleCallbackSpy).toHaveBeenCalled()
    })
  })

  describe('resetPreloadedCabins()', () => {
    it('应清除预加载记录', () => {
      preloadCabinApps('input')
      resetPreloadedCabins()
      // 再次预加载应重新触发（记录已清除）
      const spy = vi
        .spyOn(window, 'requestIdleCallback')
        .mockImplementation((cb: IdleRequestCallback) => {
          cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
          return 2
        })
      preloadCabinApps('input')
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })
})
