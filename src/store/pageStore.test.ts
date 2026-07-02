/**
 * pageStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. setCurrentPage 设置页面并清除 error
 * 3. setPageData 存储数据到 Map
 * 4. resetPageData 清空所有状态
 * 5. setLoading(true/false) 切换可点击与 tooltip
 * 6. setError 设置错误并清除 loading
 * 7. setVisibility 设置可见性
 * 8. setClickable 设置不可点击时设置 tooltip
 * 9. initPageSubscriptions 响应 PAGE_DATA_LOADED / PAGE_ERROR / PAGE_RESET
 * 10. destroyPageSubscriptions 清理所有订阅
 * 11. 重复 initPageSubscriptions 先清理旧订阅
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockOn, capturedCallbacks, allUnsubscribers } = vi.hoisted(() => {
  const mockOn = vi.fn()
  const capturedCallbacks: Map<string, ((payload: unknown) => void)> = new Map()
  const allUnsubscribers: Array<ReturnType<typeof vi.fn>> = []

  mockOn.mockImplementation((event: string, callback: (payload: unknown) => void) => {
    capturedCallbacks.set(event, callback)
    const unsubscribe = vi.fn()
    allUnsubscribers.push(unsubscribe)
    return unsubscribe
  })

  return { mockOn, capturedCallbacks, allUnsubscribers }
})

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: mockOn },
}))

import { usePageStore, initPageSubscriptions, destroyPageSubscriptions } from './pageStore'

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  allUnsubscribers.length = 0

  // 重置 store 到初始状态（因为源文件末尾自动调用了 initPageSubscriptions）
  usePageStore.setState({
    currentPage: '',
    pageData: new Map(),
    loading: false,
    error: null,
    isVisible: true,
    isClickable: true,
    tooltipText: '',
  })
})

describe('pageStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================

  it('初始状态正确', () => {
    const state = usePageStore.getState()
    expect(state.currentPage).toBe('')
    expect(state.pageData).toBeInstanceOf(Map)
    expect(state.pageData.size).toBe(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isVisible).toBe(true)
    expect(state.isClickable).toBe(true)
    expect(state.tooltipText).toBe('')
  })

  // ============================================================
  // setCurrentPage
  // ============================================================

  it('setCurrentPage 设置页面并清除 error', () => {
    usePageStore.setState({ error: '之前的错误' })
    const store = usePageStore.getState()
    store.setCurrentPage('dashboard')
    expect(usePageStore.getState().currentPage).toBe('dashboard')
    expect(usePageStore.getState().error).toBeNull()
  })

  // ============================================================
  // setPageData
  // ============================================================

  it('setPageData 存储数据到 Map', () => {
    const store = usePageStore.getState()
    store.setPageData('marketData', { price: 100 })
    const pageData = usePageStore.getState().pageData
    expect(pageData.get('marketData')).toEqual({ price: 100 })
  })

  it('setPageData 支持覆盖已有 key', () => {
    const store = usePageStore.getState()
    store.setPageData('key1', 'value1')
    store.setPageData('key1', 'value2')
    expect(usePageStore.getState().pageData.get('key1')).toBe('value2')
  })

  // ============================================================
  // resetPageData
  // ============================================================

  it('resetPageData 清空 pageData 并重置 loading/error', () => {
    usePageStore.setState({
      pageData: new Map([['key1', 'value1']]),
      loading: true,
      error: '某错误',
    })
    const store = usePageStore.getState()
    store.resetPageData()
    const state = usePageStore.getState()
    expect(state.pageData.size).toBe(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  // ============================================================
  // setLoading
  // ============================================================

  it('setLoading(true) 时 isClickable=false, tooltipText="加载中..."', () => {
    const store = usePageStore.getState()
    store.setLoading(true)
    const state = usePageStore.getState()
    expect(state.loading).toBe(true)
    expect(state.isClickable).toBe(false)
    expect(state.tooltipText).toBe('加载中...')
  })

  it('setLoading(false) 恢复可点击并清空 tooltip', () => {
    usePageStore.setState({
      loading: true,
      isClickable: false,
      tooltipText: '加载中...',
    })
    const store = usePageStore.getState()
    store.setLoading(false)
    const state = usePageStore.getState()
    expect(state.loading).toBe(false)
    expect(state.isClickable).toBe(true)
    expect(state.tooltipText).toBe('')
  })

  // ============================================================
  // setError
  // ============================================================

  it('setError 设置错误并清除 loading', () => {
    usePageStore.setState({ loading: true })
    const store = usePageStore.getState()
    store.setError('网络错误')
    const state = usePageStore.getState()
    expect(state.error).toBe('网络错误')
    expect(state.loading).toBe(false)
  })

  it('setError(null) 清除错误', () => {
    usePageStore.setState({ error: '之前的错误' })
    const store = usePageStore.getState()
    store.setError(null)
    expect(usePageStore.getState().error).toBeNull()
  })

  // ============================================================
  // setVisibility
  // ============================================================

  it('setVisibility 设置可见性', () => {
    const store = usePageStore.getState()
    store.setVisibility(false)
    expect(usePageStore.getState().isVisible).toBe(false)

    store.setVisibility(true)
    expect(usePageStore.getState().isVisible).toBe(true)
  })

  // ============================================================
  // setClickable
  // ============================================================

  it('setClickable 设置不可点击时设置 tooltip', () => {
    const store = usePageStore.getState()
    store.setClickable(false, '请先完成配置')
    const state = usePageStore.getState()
    expect(state.isClickable).toBe(false)
    expect(state.tooltipText).toBe('请先完成配置')
  })

  it('setClickable 设置可点击时清空 tooltip', () => {
    usePageStore.setState({ isClickable: false, tooltipText: '请先完成配置' })
    const store = usePageStore.getState()
    store.setClickable(true)
    const state = usePageStore.getState()
    expect(state.isClickable).toBe(true)
    expect(state.tooltipText).toBe('')
  })

  it('setClickable 不可点击时不传 tooltip 则默认为空字符串', () => {
    const store = usePageStore.getState()
    store.setClickable(false)
    const state = usePageStore.getState()
    expect(state.isClickable).toBe(false)
    expect(state.tooltipText).toBe('')
  })

  // ============================================================
  // initPageSubscriptions - PAGE_DATA_LOADED
  // ============================================================

  it('initPageSubscriptions 订阅 PAGE_DATA_LOADED 事件，设置页面和数据', () => {
    initPageSubscriptions()
    const callback = capturedCallbacks.get('PAGE_DATA_LOADED')
    expect(callback).toBeDefined()

    callback!({ page: 'analysis', data: { score: 4.5, signal: 'buy' } })

    const state = usePageStore.getState()
    expect(state.currentPage).toBe('analysis')
    expect(state.pageData.get('score')).toEqual(4.5)
    expect(state.pageData.get('signal')).toEqual('buy')
    expect(state.loading).toBe(false)
  })

  // ============================================================
  // initPageSubscriptions - PAGE_ERROR
  // ============================================================

  it('initPageSubscriptions 订阅 PAGE_ERROR 事件，设置错误', () => {
    initPageSubscriptions()
    const callback = capturedCallbacks.get('PAGE_ERROR')
    expect(callback).toBeDefined()

    callback!({ error: '数据加载失败' })

    const state = usePageStore.getState()
    expect(state.error).toBe('数据加载失败')
  })

  // ============================================================
  // initPageSubscriptions - PAGE_RESET
  // ============================================================

  it('initPageSubscriptions 订阅 PAGE_RESET 事件，重置页面数据', () => {
    usePageStore.setState({
      pageData: new Map([['key1', 'value1']]),
      loading: true,
      error: '某错误',
    })

    initPageSubscriptions()
    const callback = capturedCallbacks.get('PAGE_RESET')
    expect(callback).toBeDefined()

    callback!(undefined)

    const state = usePageStore.getState()
    expect(state.pageData.size).toBe(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  // ============================================================
  // destroyPageSubscriptions
  // ============================================================

  it('destroyPageSubscriptions 调用所有 unsubscribe 函数并清空数组', () => {
    initPageSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(3)
    expect(allUnsubscribers).toHaveLength(3)

    destroyPageSubscriptions()

    allUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // initPageSubscriptions 返回清理函数
  // ============================================================

  it('initPageSubscriptions 返回的清理函数等同于 destroyPageSubscriptions', () => {
    const cleanup = initPageSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(3)

    cleanup()

    allUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // 重复调用 initPageSubscriptions 先清理旧订阅
  // ============================================================

  it('initPageSubscriptions 重复调用时先清理旧订阅', () => {
    initPageSubscriptions()
    const firstUnsubscribers = [...allUnsubscribers]

    initPageSubscriptions()

    // 第一次 init 的 unsubscribe 都应该被调用
    firstUnsubscribers.forEach((unsub) => {
      expect(unsub).toHaveBeenCalledTimes(1)
    })
    // 第二次 init 应该重新订阅 3 个事件
    expect(mockOn).toHaveBeenCalledTimes(6)
  })
})
