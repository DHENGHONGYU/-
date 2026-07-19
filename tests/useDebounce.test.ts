/**
 * @test_id V9-TEST-UT-064
 * @covers_docs []
 */
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  it('应在初始时立即返回初始值', () => {
    const { result } = renderHook(() => useDebounce('initial', 300))
    expect(result.current).toBe('initial')
  })

  it('应在延迟后返回更新值', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    expect(result.current).toBe('a')

    await waitFor(() => {
      expect(result.current).toBe('b')
    }, { timeout: 1500 })
  })

  it('应在连续变更时只采用最后一次的值', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    await new Promise((r) => setTimeout(r, 50))
    rerender({ value: 'c' })
    await new Promise((r) => setTimeout(r, 50))
    rerender({ value: 'd' })

    await waitFor(() => {
      expect(result.current).toBe('d')
    }, { timeout: 1500 })
  })
})
