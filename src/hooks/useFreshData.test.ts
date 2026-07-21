import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFreshData } from './useFreshData'

// Mock logger（使用 vi.hoisted 确保在 vi.mock 提升之前初始化）
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

describe('useFreshData', () => {
  let baseTime: number

  beforeEach(() => {
    vi.useFakeTimers()
    baseTime = 1_700_000_000_000 // 固定基准时间
    vi.setSystemTime(baseTime)

    // 重置 mock logger
    mockLogger.info.mockReset()
    mockLogger.debug.mockReset()
    mockLogger.error.mockReset()
    mockLogger.warn.mockReset()

    // 重置 visibilityState
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 辅助函数：创建默认选项
  function createOptions(overrides: Partial<Parameters<typeof useFreshData>[0]> = {}) {
    return {
      lastUpdated: baseTime,
      maxStaleMs: 60_000, // 60秒
      refresh: vi.fn().mockResolvedValue(undefined),
      enabled: true,
      label: 'test',
      ...overrides,
    }
  }

  describe('数据新鲜度判断', () => {
    it('数据新鲜时 isStale=false', () => {
      const options = createOptions({
        lastUpdated: baseTime - 30_000, // 30秒前更新，未过期
        maxStaleMs: 60_000,
      })

      const { result } = renderHook(() => useFreshData(options))

      expect(result.current.isStale).toBe(false)
      expect(result.current.secondsSinceUpdate).toBe(30)
    })

    it('数据过期时 isStale=true 并自动触发 refresh', async () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: baseTime - 120_000, // 120秒前更新，已过期
        maxStaleMs: 60_000,
        refresh,
      })

      const { result } = renderHook(() => useFreshData(options))

      expect(result.current.isStale).toBe(true)
      // 自动刷新已触发（useEffect 中同步设置 isRefreshingRef 并调用 refresh）
      expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('lastUpdated=0 时视为无数据（isStale=false, secondsSinceUpdate=0）', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: 0,
        maxStaleMs: 60_000,
        refresh,
      })

      const { result } = renderHook(() => useFreshData(options))

      expect(result.current.isStale).toBe(false)
      expect(result.current.secondsSinceUpdate).toBe(0)
      // 无数据时不应触发自动刷新
      expect(refresh).not.toHaveBeenCalled()
    })

    it('maxStaleMs 变化时重新判断过期状态', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const initialOptions = createOptions({
        lastUpdated: baseTime - 45_000, // 45秒前
        maxStaleMs: 60_000, // 60秒阈值，此时未过期
        refresh,
      })

      const { result, rerender } = renderHook(
        (opts) => useFreshData(opts),
        { initialProps: initialOptions }
      )

      expect(result.current.isStale).toBe(false)

      // 缩短 maxStaleMs 到 30秒，此时应变为过期
      rerender({
        ...initialOptions,
        maxStaleMs: 30_000,
      })

      expect(result.current.isStale).toBe(true)
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('enabled 控制', () => {
    it('enabled=false 时不检查也不刷新', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: baseTime - 120_000, // 已过期
        maxStaleMs: 60_000,
        enabled: false,
        refresh,
      })

      const { result } = renderHook(() => useFreshData(options))

      expect(result.current.isStale).toBe(false) // enabled=false 时 isStale 为 false
      expect(refresh).not.toHaveBeenCalled()
    })
  })

  describe('forceRefresh', () => {
    it('手动触发刷新', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: baseTime - 30_000, // 数据新鲜
        maxStaleMs: 60_000,
        refresh,
      })

      const { result } = renderHook(() => useFreshData(options))

      expect(refresh).not.toHaveBeenCalled()

      act(() => {
        result.current.forceRefresh()
      })

      expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('正在刷新时重复调用被跳过（防重入）', () => {
      let _resolveRefresh: () => void
      const refresh = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => {
          _resolveRefresh = resolve
        })
      )
      const options = createOptions({
        lastUpdated: baseTime - 30_000,
        maxStaleMs: 60_000,
        refresh,
      })

      const { result } = renderHook(() => useFreshData(options))

      act(() => {
        result.current.forceRefresh()
      })
      expect(refresh).toHaveBeenCalledTimes(1)

      // 第一次刷新尚未完成，再次调用应被跳过
      act(() => {
        result.current.forceRefresh()
      })
      expect(refresh).toHaveBeenCalledTimes(1) // 仍为 1 次

      // 验证 debug 日志记录了跳过
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('forceRefresh skipped: already refreshing')
      )
    })
  })

  describe('secondsSinceUpdate', () => {
    it('正确计算（每秒更新）', () => {
      const options = createOptions({
        lastUpdated: baseTime,
        maxStaleMs: 60_000,
      })

      const { result } = renderHook(() => useFreshData(options))

      expect(result.current.secondsSinceUpdate).toBe(0)

      // 推进 5 秒
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(result.current.secondsSinceUpdate).toBe(5)

      // 再推进 10 秒
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(result.current.secondsSinceUpdate).toBe(15)
    })
  })

  describe('visibilitychange 事件', () => {
    // 辅助：触发 visibilitychange 到 hidden 再回到 visible
    function triggerVisibilityChange() {
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
          configurable: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))

        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
          configurable: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }

    it('visibilitychange 触发页面可见时的自动刷新', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: baseTime, // 初始数据新鲜
        maxStaleMs: 60_000,
        refresh,
        label: 'myData',
      })

      renderHook(() => useFreshData(options))
      expect(refresh).not.toHaveBeenCalled() // 初始数据新鲜，不触发

      // 推进系统时间 120 秒，使数据过期
      act(() => {
        vi.setSystemTime(baseTime + 120_000)
      })

      // 触发 visibilitychange
      triggerVisibilityChange()

      // 数据过期，应触发刷新
      expect(refresh).toHaveBeenCalledTimes(1)
      // 验证日志包含 label（第二次 info 调用是具体的刷新日志）
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('[useFreshData:myData] visibilitychange 触发自动刷新'),
        expect.objectContaining({ lastUpdated: expect.any(Number), maxStaleMs: expect.any(Number) })
      )
    })

    it('visibilitychange 时数据新鲜则不刷新', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: baseTime, // 初始数据新鲜
        maxStaleMs: 60_000,
        refresh,
      })

      renderHook(() => useFreshData(options))
      expect(refresh).not.toHaveBeenCalled()

      // 只推进 10 秒，数据仍然新鲜
      act(() => {
        vi.setSystemTime(baseTime + 10_000)
      })

      triggerVisibilityChange()

      // 数据新鲜，不触发刷新
      expect(refresh).not.toHaveBeenCalled()
    })

    it('组件卸载时清理 visibilitychange 注册', () => {
      const refresh1 = vi.fn().mockResolvedValue(undefined)
      const options1 = createOptions({
        lastUpdated: baseTime,
        maxStaleMs: 60_000,
        refresh: refresh1,
        label: 'data1',
      })

      const refresh2 = vi.fn().mockResolvedValue(undefined)
      const options2 = createOptions({
        lastUpdated: baseTime,
        maxStaleMs: 60_000,
        refresh: refresh2,
        label: 'data2',
      })

      const { unmount: unmount1 } = renderHook(() => useFreshData(options1))
      const { unmount: unmount2 } = renderHook(() => useFreshData(options2))

      // 推进时间使数据过期
      act(() => {
        vi.setSystemTime(baseTime + 120_000)
      })

      // 卸载第一个
      unmount1()

      // 触发 visibilitychange
      triggerVisibilityChange()

      // 第一个已卸载，不应再触发
      expect(refresh1).not.toHaveBeenCalled()
      // 第二个仍在，应触发
      expect(refresh2).toHaveBeenCalledTimes(1)

      unmount2()
    })

    it('多个实例同时注册到 visibilitychange', () => {
      const refresh1 = vi.fn().mockResolvedValue(undefined)
      const options1 = createOptions({
        lastUpdated: baseTime,
        maxStaleMs: 60_000,
        refresh: refresh1,
        label: 'data1',
      })

      const refresh2 = vi.fn().mockResolvedValue(undefined)
      const options2 = createOptions({
        lastUpdated: baseTime,
        maxStaleMs: 60_000,
        refresh: refresh2,
        label: 'data2',
      })

      const { unmount: unmount1 } = renderHook(() => useFreshData(options1))
      const { unmount: unmount2 } = renderHook(() => useFreshData(options2))

      // 推进时间使数据都过期
      act(() => {
        vi.setSystemTime(baseTime + 120_000)
      })

      // 触发 visibilitychange
      triggerVisibilityChange()

      // 两个实例都应触发刷新（都过期了）
      expect(refresh1).toHaveBeenCalledTimes(1)
      expect(refresh2).toHaveBeenCalledTimes(1)

      unmount1()
      unmount2()
    })
  })

  describe('异常处理', () => {
    it('refresh 失败时不抛出异常（catch 静默处理）', () => {
      const refresh = vi.fn().mockRejectedValue(new Error('Network error'))
      const options = createOptions({
        lastUpdated: baseTime - 120_000,
        maxStaleMs: 60_000,
        refresh,
      })

      // 不应抛出异常
      expect(() => {
        renderHook(() => useFreshData(options))
      }).not.toThrow()

      // forceRefresh 也不应抛出
      const { result } = renderHook(() => useFreshData(options))
      expect(() => {
        act(() => {
          result.current.forceRefresh()
        })
      }).not.toThrow()
    })
  })

  describe('日志标签', () => {
    it('label 参数正确传递到日志', () => {
      const refresh = vi.fn().mockResolvedValue(undefined)
      const options = createOptions({
        lastUpdated: baseTime - 30_000,
        maxStaleMs: 60_000,
        refresh,
        label: 'orderStore',
      })

      const { result } = renderHook(() => useFreshData(options))

      act(() => {
        result.current.forceRefresh()
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[useFreshData:orderStore] forceRefresh triggered')
      )
    })
  })
})
