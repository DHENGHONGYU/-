import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始值', () => {
    it('初始值立即返回（不防抖）', () => {
      const { result } = renderHook(() => useDebounce('hello', 300))
      expect(result.current).toBe('hello')
    })
  })

  describe('基本防抖', () => {
    it('值变化后延迟 delayMs 才更新', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      expect(result.current).toBe('initial')

      rerender({ value: 'updated', delay: 500 })

      // 延迟期间值尚未更新
      act(() => {
        vi.advanceTimersByTime(499)
      })
      expect(result.current).toBe('initial')

      // 达到延迟时间后更新
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe('updated')
    })
  })

  describe('防抖核心', () => {
    it('在延迟期间再次变化，重新计时', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'first', delay: 500 } }
      )

      expect(result.current).toBe('first')

      // 第一次变化
      rerender({ value: 'second', delay: 500 })
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current).toBe('first') // 仍未更新

      // 第二次变化（重新计时）
      rerender({ value: 'third', delay: 500 })
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current).toBe('first') // 重新计时后 300ms，仍未更新

      // 再等 200ms，达到 500ms
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(result.current).toBe('third') // 更新为最后一次的值
    })

    it('延迟期间多次快速变化，只保留最后一次', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'v0', delay: 300 } }
      )

      // 快速连续变化
      rerender({ value: 'v1', delay: 300 })
      rerender({ value: 'v2', delay: 300 })
      rerender({ value: 'v3', delay: 300 })
      rerender({ value: 'v4', delay: 300 })
      rerender({ value: 'final', delay: 300 })

      // 延迟期间都是初始值
      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(result.current).toBe('v0')

      // 延迟结束后，只保留最后一次的值
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe('final')
    })
  })

  describe('delayMs 参数', () => {
    it('默认 delayMs=300', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        { initialProps: { value: 'initial' } }
      )

      rerender({ value: 'changed' })

      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(result.current).toBe('initial')

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe('changed')
    })

    it('自定义 delayMs', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 1000 } }
      )

      rerender({ value: 'changed', delay: 1000 })

      // 500ms 时尚未更新
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current).toBe('initial')

      // 1000ms 后更新
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current).toBe('changed')
    })

    it('delayMs 变化时重新计时', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      // 值变化，开始 500ms 计时
      rerender({ value: 'changed', delay: 500 })
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current).toBe('initial')

      // delayMs 变化，重新计时（新的 delay 是 200ms）
      rerender({ value: 'changed', delay: 200 })

      // 经过 199ms 还未更新（按新 delay 200ms 计时）
      act(() => {
        vi.advanceTimersByTime(199)
      })
      expect(result.current).toBe('initial')

      // 再等 1ms，达到新的 delay
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe('changed')
    })
  })

  describe('内存泄漏', () => {
    it('组件卸载时清理定时器', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

      const { unmount, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: 'initial' } }
      )

      rerender({ value: 'changed' })

      // 确认设置了定时器
      expect(setTimeoutSpy).toHaveBeenCalled()

      unmount()

      // 确认清理了定时器
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // 卸载后再推进时间，不应有状态更新（不会报错即为通过）
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      clearTimeoutSpy.mockRestore()
      setTimeoutSpy.mockRestore()
    })
  })

  describe('引用类型', () => {
    it('对象类型值的防抖（引用变化）', () => {
      const obj1 = { name: 'Alice', age: 20 }
      const obj2 = { name: 'Bob', age: 25 }

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: obj1 } }
      )

      expect(result.current).toBe(obj1)

      rerender({ value: obj2 })

      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(result.current).toBe(obj1)

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe(obj2)
    })

    it('数组类型值的防抖（引用变化）', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [4, 5, 6]

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: arr1 } }
      )

      expect(result.current).toBe(arr1)

      rerender({ value: arr2 })

      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(result.current).toBe(arr1)

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe(arr2)
    })
  })

  describe('布尔值', () => {
    it('布尔值切换的防抖', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: false } }
      )

      expect(result.current).toBe(false)

      // 切换为 true
      rerender({ value: true })
      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(result.current).toBe(false) // 仍为旧值

      // 再切回 false（快速开关）
      rerender({ value: false })
      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(result.current).toBe(false) // 还是初始值（最后一次设为 false）

      // 延迟结束后为最后一次的值
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe(false)
    })
  })
})
