/**
 * @module cockpit/hooks/useWidgetErrorState.test
 * @description useWidgetErrorState Hook 单元测试
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWidgetErrorState } from './useWidgetErrorState'

describe('useWidgetErrorState', () => {
  describe('视觉状态判定', () => {
    it('error 有值时返回 error 状态', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: '网络错误', hasData: false }),
      )
      expect(result.current.visualState).toBe('error')
      expect(result.current.isError).toBe(true)
    })

    it('loading=true 且无 error 时返回 loading 状态', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: true, error: null, hasData: false }),
      )
      expect(result.current.visualState).toBe('loading')
      expect(result.current.isLoading).toBe(true)
    })

    it('loading=true 且有 error 时仍返回 error 状态（error 优先）', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: true, error: '超时', hasData: false }),
      )
      expect(result.current.visualState).toBe('error')
    })

    it('loading=false, error=null, hasData=false 时返回 error 状态（接口失败兜底）', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: null, hasData: false }),
      )
      expect(result.current.visualState).toBe('error')
      expect(result.current.isError).toBe(true)
    })

    it('loading=false, error=null, hasData=true 时返回 ready 状态', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: null, hasData: true }),
      )
      expect(result.current.visualState).toBe('ready')
      expect(result.current.isReady).toBe(true)
    })
  })

  describe('displayError 格式化', () => {
    it('error 有值时 displayError 使用原始 error', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: 'HTTP 404', hasData: false }),
      )
      expect(result.current.displayError).toBe('HTTP 404')
    })

    it('error 为空但数据不可用时 displayError 使用 fallbackErrorMessage', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({
          loading: false,
          error: null,
          hasData: false,
          fallbackErrorMessage: '持仓数据暂不可用',
        }),
      )
      expect(result.current.displayError).toBe('持仓数据暂不可用')
    })

    it('未提供 fallbackErrorMessage 时使用默认提示', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: null, hasData: false }),
      )
      expect(result.current.displayError).toBe('数据暂不可用，请稍后重试')
    })

    it('ready 状态时 displayError 为 null', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: null, hasData: true }),
      )
      expect(result.current.displayError).toBeNull()
    })

    it('loading 状态时 displayError 为 null', () => {
      const { result } = renderHook(() =>
        useWidgetErrorState({ loading: true, error: null, hasData: false }),
      )
      expect(result.current.displayError).toBeNull()
    })
  })

  describe('便捷判断属性', () => {
    it('isError / isLoading / isReady 互斥', () => {
      const { result: errorResult } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: 'err', hasData: false }),
      )
      expect(errorResult.current.isError).toBe(true)
      expect(errorResult.current.isLoading).toBe(false)
      expect(errorResult.current.isReady).toBe(false)

      const { result: loadingResult } = renderHook(() =>
        useWidgetErrorState({ loading: true, error: null, hasData: false }),
      )
      expect(loadingResult.current.isError).toBe(false)
      expect(loadingResult.current.isLoading).toBe(true)
      expect(loadingResult.current.isReady).toBe(false)

      const { result: readyResult } = renderHook(() =>
        useWidgetErrorState({ loading: false, error: null, hasData: true }),
      )
      expect(readyResult.current.isError).toBe(false)
      expect(readyResult.current.isLoading).toBe(false)
      expect(readyResult.current.isReady).toBe(true)
    })
  })
})
