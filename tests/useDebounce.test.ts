import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应在初始时立即返回初始值', () => {
    const { result } = renderHook(() => useDebounce('initial', 300))
    expect(result.current).toBe('initial')
  })

  it('应在延迟后返回更新值', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    expect(result.current).toBe('a')

    vi.advanceTimersByTime(300)

    await waitFor(() => {
      expect(result.current).toBe('b')
    })
  })

  it('应在连续变更时只采用最后一次的值', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    vi.advanceTimersByTime(100)
    rerender({ value: 'c' })
    vi.advanceTimersByTime(100)
    rerender({ value: 'd' })
    vi.advanceTimersByTime(300)

    await waitFor(() => {
      expect(result.current).toBe('d')
    })
  })
})
