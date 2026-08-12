import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportWebVitals } from './webVitals'

// Mock web-vitals 模块
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
  onINP: vi.fn(),
}))

describe('webVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reportWebVitals 注册了 5 个指标监听', async () => {
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals')
    reportWebVitals()
    expect(onCLS).toHaveBeenCalledTimes(1)
    expect(onFCP).toHaveBeenCalledTimes(1)
    expect(onLCP).toHaveBeenCalledTimes(1)
    expect(onTTFB).toHaveBeenCalledTimes(1)
    expect(onINP).toHaveBeenCalledTimes(1)
  })

  it('每个监听都传入了回调函数', async () => {
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals')
    reportWebVitals()
    expect(onCLS).toHaveBeenCalledWith(expect.any(Function))
    expect(onFCP).toHaveBeenCalledWith(expect.any(Function))
    expect(onLCP).toHaveBeenCalledWith(expect.any(Function))
    expect(onTTFB).toHaveBeenCalledWith(expect.any(Function))
    expect(onINP).toHaveBeenCalledWith(expect.any(Function))
  })
})
