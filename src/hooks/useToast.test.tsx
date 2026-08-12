import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, ToastProvider, type Toast } from './useToast'
import type { ReactNode } from 'react'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>
  }

  it('在 ToastProvider 外使用抛出错误', () => {
    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used within <ToastProvider>'
    )
  })

  it('在 ToastProvider 内使用返回正确结构', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    expect(result.current.toasts).toEqual([])
    expect(typeof result.current.toast).toBe('function')
    expect(typeof result.current.dismiss).toBe('function')
  })

  it('toast: 添加一个 toast，toasts 长度+1', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test' })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0]!.title).toBe('Test')
  })

  it('toast: 自动生成 id', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test' })
    })

    const toast = result.current.toasts[0]!
    expect(toast.id).toBeDefined()
    expect(typeof toast.id).toBe('string')
    expect(toast.id.length).toBeGreaterThan(0)
  })

  it('toast: 默认 duration=5000', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test' })
    })

    expect(result.current.toasts[0]!.duration).toBe(5000)
  })

  it('toast: 自定义 duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test', duration: 3000 })
    })

    expect(result.current.toasts[0]!.duration).toBe(3000)
  })

  it('toast: duration=0 时不自动消失', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test', duration: 0 })
    })

    expect(result.current.toasts).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(result.current.toasts).toHaveLength(1)
  })

  it('toast: 指定 variant', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test', variant: 'success' })
    })

    expect(result.current.toasts[0]!.variant).toBe('success')
  })

  it('dismiss: 手动移除指定 toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test' })
    })

    const id = result.current.toasts[0]!.id

    act(() => {
      result.current.dismiss(id)
    })

    expect(result.current.toasts).toHaveLength(0)
  })

  it('dismiss: 移除不存在的 id 不报错', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test' })
    })

    act(() => {
      result.current.dismiss('non-existent-id')
    })

    expect(result.current.toasts).toHaveLength(1)
  })

  it('toast: 多次添加，toasts 累积', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'First' })
      result.current.toast({ title: 'Second' })
      result.current.toast({ title: 'Third' })
    })

    expect(result.current.toasts).toHaveLength(3)
    expect(result.current.toasts.map((t: Toast) => t.title)).toEqual([
      'First',
      'Second',
      'Third',
    ])
  })

  it('toast: 自动消失（使用 vi.useFakeTimers + vi.advanceTimersByTime）', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.toast({ title: 'Test', duration: 5000 })
    })

    expect(result.current.toasts).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(result.current.toasts).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(result.current.toasts).toHaveLength(0)
  })
})
