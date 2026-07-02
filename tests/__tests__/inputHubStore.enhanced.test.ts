/**
 * inputHubStore 增强单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证（含类型完整性）
 * 2. setActiveModule 多次切换 / 空值 / 特殊字符
 * 3. setLoading 状态流转
 * 4. reset 回到初始值
 * 5. 并发设置不冲突
 * 6. Store 订阅响应（zustand subscribe）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useInputHubStore } from '@/store/inputHubStore'

beforeEach(() => {
  useInputHubStore.setState({ activeModule: '', loading: false })
})

describe('inputHubStore - 增强测试', () => {
  // ============================================================
  // 初始状态
  // ============================================================
  describe('初始状态', () => {
    it('初始 activeModule 为空字符串', () => {
      expect(useInputHubStore.getState().activeModule).toBe('')
    })

    it('初始 loading 为 false', () => {
      expect(useInputHubStore.getState().loading).toBe(false)
    })

    it('初始状态包含所有必需字段', () => {
      const state = useInputHubStore.getState()
      expect(state).toHaveProperty('activeModule')
      expect(state).toHaveProperty('loading')
      expect(state).toHaveProperty('setActiveModule')
      expect(state).toHaveProperty('setLoading')
      expect(state).toHaveProperty('reset')
    })
  })

  // ============================================================
  // setActiveModule
  // ============================================================
  describe('setActiveModule', () => {
    it('设置有效路径', () => {
      useInputHubStore.getState().setActiveModule('/input/bulk-import')
      expect(useInputHubStore.getState().activeModule).toBe('/input/bulk-import')
    })

    it('多次切换模块路径', () => {
      useInputHubStore.getState().setActiveModule('/input/dashboard')
      expect(useInputHubStore.getState().activeModule).toBe('/input/dashboard')

      useInputHubStore.getState().setActiveModule('/input/hot-sectors')
      expect(useInputHubStore.getState().activeModule).toBe('/input/hot-sectors')

      useInputHubStore.getState().setActiveModule('/input/data-test')
      expect(useInputHubStore.getState().activeModule).toBe('/input/data-test')
    })

    it('设置为空字符串', () => {
      useInputHubStore.getState().setActiveModule('/input')
      useInputHubStore.getState().setActiveModule('')
      expect(useInputHubStore.getState().activeModule).toBe('')
    })

    it('设置含特殊字符的路径', () => {
      useInputHubStore.getState().setActiveModule('/input/local-knowledge?tab=search')
      expect(useInputHubStore.getState().activeModule).toBe('/input/local-knowledge?tab=search')
    })
  })

  // ============================================================
  // setLoading
  // ============================================================
  describe('setLoading', () => {
    it('设置为 true', () => {
      useInputHubStore.getState().setLoading(true)
      expect(useInputHubStore.getState().loading).toBe(true)
    })

    it('设置为 false', () => {
      useInputHubStore.getState().setLoading(true)
      useInputHubStore.getState().setLoading(false)
      expect(useInputHubStore.getState().loading).toBe(false)
    })

    it('多次切换不冲突', () => {
      useInputHubStore.getState().setLoading(true)
      useInputHubStore.getState().setLoading(false)
      useInputHubStore.getState().setLoading(true)
      expect(useInputHubStore.getState().loading).toBe(true)
    })
  })

  // ============================================================
  // reset
  // ============================================================
  describe('reset', () => {
    it('reset 恢复所有字段到初始值', () => {
      useInputHubStore.getState().setActiveModule('/input/bulk-import')
      useInputHubStore.getState().setLoading(true)
      useInputHubStore.getState().reset()

      const state = useInputHubStore.getState()
      expect(state.activeModule).toBe('')
      expect(state.loading).toBe(false)
    })

    it('reset 后可继续正常使用', () => {
      useInputHubStore.getState().reset()
      useInputHubStore.getState().setActiveModule('/input')
      expect(useInputHubStore.getState().activeModule).toBe('/input')
    })
  })

  // ============================================================
  // Store 订阅响应
  // ============================================================
  describe('Store 订阅', () => {
    it('setActiveModule 触发订阅回调', () => {
      const callback = vi.fn()
      const unsubscribe = useInputHubStore.subscribe(callback)

      useInputHubStore.getState().setActiveModule('/input/data-test')

      expect(callback).toHaveBeenCalled()
      unsubscribe()
    })

    it('setLoading 触发订阅回调', () => {
      const callback = vi.fn()
      const unsubscribe = useInputHubStore.subscribe(callback)

      useInputHubStore.getState().setLoading(true)

      expect(callback).toHaveBeenCalled()
      unsubscribe()
    })

    it('reset 触发订阅回调', () => {
      const callback = vi.fn()
      const unsubscribe = useInputHubStore.subscribe(callback)

      useInputHubStore.getState().reset()

      expect(callback).toHaveBeenCalled()
      unsubscribe()
    })

    it('unsubscribe 后不再接收回调', () => {
      const callback = vi.fn()
      const unsubscribe = useInputHubStore.subscribe(callback)

      unsubscribe()
      useInputHubStore.getState().setActiveModule('/input')

      expect(callback).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 并发安全
  // ============================================================
  describe('并发安全', () => {
    it('同步连续调用不丢失最终状态', () => {
      for (let i = 0; i < 100; i++) {
        useInputHubStore.getState().setActiveModule(`/input/path-${i}`)
      }
      expect(useInputHubStore.getState().activeModule).toBe('/input/path-99')
    })
  })
})
