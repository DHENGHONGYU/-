/**
 * poolStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. refresh 正常加载 / 并发锁 / 失败保留 / loading 区分
 * 3. addStock 成功 / 失败
 * 4. updateStock 成功 / 不存在 / symbol 归一化
 * 5. deleteStock 成功 / symbol 归一化 / 失败
 * 6. updateStatus 成功流转 / 非法流转 / 不存在 / 失败
 * 7. updateGroup 成功 / 空名 / 失败
 * 8. getByStatus / getByGroup
 * 9. getTotalCount / getStockBySymbol / getAllGroups
 * 10. initPoolStoreSubscriptions 订阅 / source 过滤 / 去抖 / cleanup / 重复调用
 */

const {
  mockOn,
  mockList,
  mockAdd,
  mockRemove,
  mockUpdateStatus,
  mockUpdateGroup,
  mockForward,
  capturedRef,
  unsubscribeFn,
} = vi.hoisted(() => {
  const capturedRef = { callback: null as ((envelope: any) => void) | null }
  const unsubscribeFn = vi.fn()

  const mockOn = vi.fn().mockImplementation((_channel: string, callback: (envelope: any) => void) => {
    capturedRef.callback = callback
    return unsubscribeFn
  })

  return {
    mockOn,
    mockList: vi.fn().mockResolvedValue([]),
    mockAdd: vi.fn().mockResolvedValue({ success: true }),
    mockRemove: vi.fn().mockResolvedValue({ success: true }),
    mockUpdateStatus: vi.fn().mockResolvedValue({ success: true }),
    mockUpdateGroup: vi.fn().mockResolvedValue({ success: true }),
    mockForward: vi.fn().mockResolvedValue(undefined),
    capturedRef,
    unsubscribeFn,
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/data/db', () => ({
  db: {
    isReady: vi.fn().mockReturnValue(true),
    ready: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: {
      list: mockList,
      add: mockAdd,
      remove: mockRemove,
      updateStatus: mockUpdateStatus,
      updateGroup: mockUpdateGroup,
    },
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockOn, forward: mockForward },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn().mockReturnValue({}) },
}))

vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: vi.fn().mockReturnValue(true),
}))

vi.mock('@/config/dbConfig', () => ({
  DEFAULT_POOL_GROUP: 'default',
  ENVELOPE_ACTION: { updateStock: 'UPDATE_STOCK' },
  ENVELOPE_TARGET: { db: 'DB' },
  MODULE_ID: { stockpool: 'stockpool' },
  STORE_NAME: { stocks: 'stocks' },
}))

import {
  usePoolStore,
  getTotalCount,
  getStockBySymbol,
  getAllGroups,
  initPoolStoreSubscriptions,
} from './poolStore'
import type { Stock } from '@/data/types'
import { EnvelopeFactory } from '@/core/envelope'
import { isValidTransition } from '@/core/poolTransitionEngine'

function createMockStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc',
    researchStatus: 'watching',
    source: 'manual',
    dataVersion: 1,
    ...overrides,
  } as Stock
}

beforeEach(async () => {
  // 清理可能残留的订阅，确保模块级状态重置
  initPoolStoreSubscriptions()()

  vi.clearAllMocks()

  // clearAllMocks 会清除 vi.mock 工厂函数设置的 mock 实现，
  // 需要恢复 db mock，否则 refresh() 中 db.isReady() 返回 undefined 导致超时
  const { db } = await import('@/data/db')
  ;(db.isReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
  ;(db.ready as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

  usePoolStore.setState({
    stocks: [],
    loading: false,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
})

describe('poolStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================
  it('初始状态正确', () => {
    const state = usePoolStore.getState()
    expect(state.stocks).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // refresh
  // ============================================================
  it('refresh 正常加载，更新 stocks 和 lastUpdated', async () => {
    const stocks = [createMockStock({ symbol: 'AAPL' }), createMockStock({ symbol: 'TSLA' })]
    mockList.mockResolvedValue(stocks)
    await usePoolStore.getState().refresh()
    expect(usePoolStore.getState().stocks).toEqual(stocks)
    expect(usePoolStore.getState().lastUpdated).toBeGreaterThan(0)
    expect(usePoolStore.getState().error).toBeNull()
  })

  it('refresh 并发锁（isRefreshing=true 时跳过）', async () => {
    usePoolStore.setState({ isRefreshing: true })
    await usePoolStore.getState().refresh()
    expect(mockList).not.toHaveBeenCalled()
  })

  it('refresh 失败时保留旧数据，设置 error', async () => {
    const oldStocks = [createMockStock()]
    usePoolStore.setState({ stocks: oldStocks })
    mockList.mockRejectedValue(new Error('网络错误'))
    await usePoolStore.getState().refresh()
    expect(usePoolStore.getState().stocks).toEqual(oldStocks)
    expect(usePoolStore.getState().error).toBe('网络错误')
    expect(usePoolStore.getState().isRefreshing).toBe(false)
  })

  it('refresh 首次加载设置 loading=true，后续刷新 loading 不变', async () => {
    // 首次加载
    let resolveList!: (value: Stock[]) => void
    mockList.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    const p1 = usePoolStore.getState().refresh()
    expect(usePoolStore.getState().loading).toBe(true)
    resolveList([createMockStock()])
    await p1
    expect(usePoolStore.getState().loading).toBe(false)

    // 后续刷新
    vi.clearAllMocks()
    mockList.mockResolvedValue([createMockStock(), createMockStock({ symbol: 'TSLA' })])
    await usePoolStore.getState().refresh()
    expect(usePoolStore.getState().loading).toBe(false)
  })

  // ============================================================
  // addStock
  // ============================================================
  it('addStock 成功添加', async () => {
    const newStock = { symbol: 'NVDA', name: 'NVIDIA', researchStatus: 'candidate' as const, source: 'manual' as const }
    const result = await usePoolStore.getState().addStock(newStock)
    expect(result).toBe(true)
    expect(mockAdd).toHaveBeenCalledWith(newStock)
    expect(usePoolStore.getState().error).toBeNull()
  })

  it('addStock 失败时设置 error 返回 false', async () => {
    mockAdd.mockResolvedValueOnce({ success: false, error: '重复添加' })
    const newStock = { symbol: 'NVDA', name: 'NVIDIA', researchStatus: 'candidate' as const, source: 'manual' as const }
    const result = await usePoolStore.getState().addStock(newStock)
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toBe('重复添加')
  })

  // ============================================================
  // updateStock
  // ============================================================
  it('updateStock 成功更新（通过 dataBridge.forward）', async () => {
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateStock('AAPL', { name: 'Apple Updated' })
    expect(result).toBe(true)
    expect(EnvelopeFactory.create).toHaveBeenCalled()
    expect(mockForward).toHaveBeenCalledTimes(1)
    expect(usePoolStore.getState().error).toBeNull()
  })

  it('updateStock 股票不存在返回 false', async () => {
    usePoolStore.setState({ stocks: [] })
    const result = await usePoolStore.getState().updateStock('UNKNOWN', { name: 'X' })
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toContain('不存在')
    expect(mockForward).not.toHaveBeenCalled()
  })

  it('updateStock symbol 自动 trim + toUpperCase', async () => {
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    await usePoolStore.getState().updateStock('  aapl  ', { name: 'Updated' })
    expect(vi.mocked(EnvelopeFactory.create)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ symbol: 'AAPL', name: 'Updated' }),
    )
  })

  // ============================================================
  // deleteStock
  // ============================================================
  it('deleteStock 成功删除', async () => {
    usePoolStore.setState({ stocks: [createMockStock({ symbol: 'AAPL' })] })
    const result = await usePoolStore.getState().deleteStock('AAPL')
    expect(result).toBe(true)
    expect(mockRemove).toHaveBeenCalledWith('AAPL')
  })

  it('deleteStock symbol 自动 trim + toUpperCase', async () => {
    usePoolStore.setState({ stocks: [createMockStock({ symbol: 'AAPL' })] })
    await usePoolStore.getState().deleteStock('  aapl  ')
    expect(mockRemove).toHaveBeenCalledWith('AAPL')
  })

  it('deleteStock 失败时设置 error', async () => {
    mockRemove.mockResolvedValueOnce({ success: false, error: '删除失败' })
    usePoolStore.setState({ stocks: [createMockStock({ symbol: 'AAPL' })] })
    const result = await usePoolStore.getState().deleteStock('AAPL')
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toBe('删除失败')
  })

  // ============================================================
  // updateStatus
  // ============================================================
  it('updateStatus 成功流转（isValidTransition 返回 true）', async () => {
    const stock = createMockStock({ symbol: 'AAPL', researchStatus: 'candidate' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateStatus('AAPL', 'watching')
    expect(result).toBe(true)
    expect(mockUpdateStatus).toHaveBeenCalledWith('AAPL', 'watching')
    expect(usePoolStore.getState().error).toBeNull()
  })

  it('updateStatus 非法流转返回 false（isValidTransition 返回 false）', async () => {
    vi.mocked(isValidTransition).mockReturnValueOnce(false)
    const stock = createMockStock({ symbol: 'AAPL', researchStatus: 'watching' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateStatus('AAPL', 'archived')
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toContain('非法状态流转')
    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  it('updateStatus 股票不存在返回 false', async () => {
    usePoolStore.setState({ stocks: [] })
    const result = await usePoolStore.getState().updateStatus('UNKNOWN', 'watching')
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toContain('不存在')
  })

  it('updateStatus 失败时设置 error', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ success: false, error: 'DB 错误' })
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateStatus('AAPL', 'watching')
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toBe('DB 错误')
  })

  // ============================================================
  // updateGroup
  // ============================================================
  it('updateGroup 成功更新', async () => {
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateGroup('AAPL', 'tech')
    expect(result).toBe(true)
    expect(mockUpdateGroup).toHaveBeenCalledWith('AAPL', 'tech')
    expect(usePoolStore.getState().error).toBeNull()
  })

  it('updateGroup 空分组名返回 false', async () => {
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateGroup('AAPL', '   ')
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toContain('不能为空')
    expect(mockUpdateGroup).not.toHaveBeenCalled()
  })

  it('updateGroup 失败时设置 error', async () => {
    mockUpdateGroup.mockResolvedValueOnce({ success: false, error: '分组更新失败' })
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    const result = await usePoolStore.getState().updateGroup('AAPL', 'tech')
    expect(result).toBe(false)
    expect(usePoolStore.getState().error).toBe('分组更新失败')
  })

  // ============================================================
  // getByStatus / getByGroup
  // ============================================================
  it('getByStatus 按状态筛选', () => {
    const stocks = [
      createMockStock({ symbol: 'A1', researchStatus: 'candidate' }),
      createMockStock({ symbol: 'A2', researchStatus: 'watching' }),
      createMockStock({ symbol: 'A3', researchStatus: 'watching' }),
    ]
    usePoolStore.setState({ stocks })
    const result = usePoolStore.getState().getByStatus('watching')
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.symbol)).toEqual(['A2', 'A3'])
  })

  it('getByGroup 按分组筛选（无 group 时用 DEFAULT_POOL_GROUP）', () => {
    const stocks = [
      createMockStock({ symbol: 'A1', group: 'tech' }),
      createMockStock({ symbol: 'A2', group: undefined }),
      createMockStock({ symbol: 'A3', group: 'tech' }),
    ]
    usePoolStore.setState({ stocks })
    expect(usePoolStore.getState().getByGroup('tech')).toHaveLength(2)
    expect(usePoolStore.getState().getByGroup('default')).toHaveLength(1)
  })

  // ============================================================
  // 派生函数
  // ============================================================
  it('getTotalCount 返回 stocks.length', () => {
    usePoolStore.setState({ stocks: [createMockStock(), createMockStock({ symbol: 'TSLA' })] })
    expect(getTotalCount()).toBe(2)
  })

  it('getStockBySymbol 存在时返回股票', () => {
    const stock = createMockStock({ symbol: 'AAPL' })
    usePoolStore.setState({ stocks: [stock] })
    expect(getStockBySymbol('AAPL')).toEqual(stock)
  })

  it('getStockBySymbol 不存在时返回 undefined', () => {
    usePoolStore.setState({ stocks: [] })
    expect(getStockBySymbol('UNKNOWN')).toBeUndefined()
  })

  it('getAllGroups 去重排序（含 DEFAULT_POOL_GROUP 兜底）', () => {
    const stocks = [
      createMockStock({ symbol: 'A1', group: 'tech' }),
      createMockStock({ symbol: 'A2', group: 'finance' }),
      createMockStock({ symbol: 'A3', group: undefined }),
      createMockStock({ symbol: 'A4', group: 'tech' }),
    ]
    usePoolStore.setState({ stocks })
    expect(getAllGroups()).toEqual(['default', 'finance', 'tech'])
  })

  // ============================================================
  // 订阅
  // ============================================================
  it('initPoolStoreSubscriptions 订阅 dataBridge，source 过滤（跳过 stockpool）', () => {
    vi.useFakeTimers()
    initPoolStoreSubscriptions()
    expect(mockOn).toHaveBeenCalledWith('stocks', expect.any(Function))

    // stockpool 自身发出的事件应被跳过
    capturedRef.callback?.({
      meta: { source: 'stockpool', action: 'UPDATE_STOCK', traceId: 't1' },
    })
    vi.advanceTimersByTime(100)
    expect(mockList).not.toHaveBeenCalled()

    // 其他模块的事件应触发 refresh
    capturedRef.callback?.({
      meta: { source: 'analyzer', action: 'UPDATE_STOCK', traceId: 't2' },
    })
    vi.advanceTimersByTime(100)
    expect(mockList).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('initPoolStoreSubscriptions 去抖 100ms', () => {
    vi.useFakeTimers()
    initPoolStoreSubscriptions()

    capturedRef.callback?.({
      meta: { source: 'analyzer', action: 'X', traceId: 't1' },
    })
    expect(mockList).not.toHaveBeenCalled()

    vi.advanceTimersByTime(99)
    expect(mockList).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(mockList).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('initPoolStoreSubscriptions 多次事件合并为一次 refresh', () => {
    vi.useFakeTimers()
    initPoolStoreSubscriptions()

    capturedRef.callback?.({
      meta: { source: 'analyzer', action: 'X', traceId: 't1' },
    })
    vi.advanceTimersByTime(50)
    capturedRef.callback?.({
      meta: { source: 'analyzer', action: 'Y', traceId: 't2' },
    })

    // 100ms 从第一次算起，但第二次重置了定时器，所以不应触发
    vi.advanceTimersByTime(50)
    expect(mockList).not.toHaveBeenCalled()

    // 再前进 50ms，第二次事件后满 100ms，应触发一次
    vi.advanceTimersByTime(50)
    expect(mockList).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('initPoolStoreSubscriptions 返回 cleanup 函数', () => {
    const cleanup = initPoolStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    cleanup()
    expect(unsubscribeFn).toHaveBeenCalledTimes(1)
  })

  it('initPoolStoreSubscriptions 重复调用时跳过并返回 cleanup', () => {
    initPoolStoreSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(1)

    const cleanup2 = initPoolStoreSubscriptions()
    expect(mockOn).toHaveBeenCalledTimes(1) // 不会重复订阅
    expect(typeof cleanup2).toBe('function')

    cleanup2()
    expect(unsubscribeFn).toHaveBeenCalledTimes(1)
  })
})
