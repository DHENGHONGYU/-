/**
 * @test_id V9-TEST-ST-137
 * holdingsStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证（filter 含默认日期范围，pagination 含默认值）
 * 2. setData: 更新 data 和 total
 * 3. setFilter: 更新 filter 并重置 page=1
 * 4. setPage: 更新 page
 * 5. setPageSize: 更新 pageSize 并重置 page=1
 * 6. setLoading: 部分更新 loading 状态
 * 7. openModal: 打开弹窗
 * 8. closeModal: 关闭弹窗
 * 9. resetFilter: 重置 filter 为默认值（日期范围重新计算）并重置 page=1
 * 10. buildHoldingsParams: 从当前状态构建查询参数
 * 11. initHoldingsStoreSubscriptions: 订阅 trading 通道
 * 12. initHoldingsStoreSubscriptions: 返回 cleanup 函数
  * @covers_docs []
*/

import { vi } from 'vitest'
import type { HoldingItem } from '@/types/modules/trade.types'
import type { StandardEnvelope } from '@/core/envelope'

// ============================================================
// vi.hoisted mocks
// ============================================================

const { mockSubscribe, mockForward, mockLoggerHoldings, capturedCallbacks, unsubscribes } = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, ((envelope: StandardEnvelope) => void)>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  const mockSubscribe = vi.fn((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedCallbacks.set(channel, callback)
    const unsub = vi.fn()
    unsubscribes.push(unsub)
    return unsub
  })
  // fetchData / exportCSV 等需要的 dataBridge.forward mock
  const mockForward = vi.fn()
  // 暴露 logger 以便断言 warn / info / error 调用
  const mockLoggerHoldings = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
  return { mockSubscribe, mockForward, mockLoggerHoldings, capturedCallbacks, unsubscribes }
})

// ============================================================
// vi.mock declarations
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLoggerHoldings,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, forward: mockForward },
}))

vi.mock('@/constants/trade.constants', () => ({
  TRADE_DIRECTION: { ALL: 'ALL', BUY: 'BUY', SELL: 'SELL' },
  PAGINATION_DEFAULTS: { DEFAULT_PAGE: 1, DEFAULT_PAGE_SIZE: 20 },
  FILTER_DEFAULTS: { DEFAULT_DATE_RANGE_DAYS: 30 },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    tradeActionExecuted: 'TRADE_ACTION_EXECUTED',
    holdingsDataLoaded: 'HOLDINGS_DATA_LOADED',
    loadHoldingsData: 'LOAD_HOLDINGS_DATA',
    insertOrder: 'INSERT_ORDER',
    updateOrder: 'UPDATE_ORDER',
    deleteOrder: 'DELETE_ORDER',
  },
  ENVELOPE_TARGET: { tradinghub: 'tradinghub' },
  MODULE_ID: { tradinghub: 'tradinghub', holdingsStore: 'holdingsStore' },
  STORE_NAME: { orders: 'orders', stocks: 'stocks' },
}))

// ============================================================
// Imports
// ============================================================

import {
  useHoldingsStore,
  buildHoldingsParams,
  initHoldingsStoreSubscriptions,
} from './holdingsStore'

// ============================================================
// Helpers
// ============================================================

function createMockHoldingItem(code: string): HoldingItem {
  return {
    code,
    name: code,
    quantity: 100,
    currentPrice: 100,
    avgCost: 90,
    floatingPnl: 1000,
    floatingPnlPercent: 11.11,
    marketValueRatio: 0.2,
    strategyId: 'strat-1',
    strategyType: 'CORE',
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0

  // 清理模块级订阅状态
  const cleanup = initHoldingsStoreSubscriptions()
  cleanup()

  useHoldingsStore.setState({
    data: [],
    filter: {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      direction: 'ALL',
      keyword: '',
    },
    pagination: { page: 1, pageSize: 20, total: 0 },
    loading: { isListLoading: false, isActionLoading: false, isExporting: false },
    modal: { open: false, action: null, holding: null },
  })
})

// ============================================================
// 初始状态
// ============================================================

describe('useHoldingsStore', () => {
  it('初始状态验证（filter 含默认日期范围，pagination 含默认值）', () => {
    const state = useHoldingsStore.getState()
    expect(state.data).toEqual([])
    expect(state.filter.direction).toBe('ALL')
    expect(state.filter.keyword).toBe('')
    expect(state.filter.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(state.filter.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(state.pagination.page).toBe(1)
    expect(state.pagination.pageSize).toBe(20)
    expect(state.pagination.total).toBe(0)
    expect(state.loading).toEqual({
      isListLoading: false,
      isActionLoading: false,
      isExporting: false,
    })
    expect(state.modal.open).toBe(false)
    expect(state.modal.action).toBeNull()
    expect(state.modal.holding).toBeNull()
  })

  // ============================================================
  // Actions
  // ============================================================

  it('setData: 更新 data 和 total', () => {
    const list = [createMockHoldingItem('A')]
    useHoldingsStore.getState().setData(list, 100)
    expect(useHoldingsStore.getState().data).toEqual(list)
    expect(useHoldingsStore.getState().pagination.total).toBe(100)
  })

  it('setFilter: 更新 filter 并重置 page=1', () => {
    useHoldingsStore.setState({
      pagination: { ...useHoldingsStore.getState().pagination, page: 5 },
    })
    useHoldingsStore.getState().setFilter({ keyword: 'AAPL', direction: 'BUY' })

    const state = useHoldingsStore.getState()
    expect(state.filter.keyword).toBe('AAPL')
    expect(state.filter.direction).toBe('BUY')
    expect(state.pagination.page).toBe(1)
  })

  it('setPage: 更新 page', () => {
    useHoldingsStore.getState().setPage(3)
    expect(useHoldingsStore.getState().pagination.page).toBe(3)
  })

  it('setPageSize: 更新 pageSize 并重置 page=1', () => {
    useHoldingsStore.setState({
      pagination: { ...useHoldingsStore.getState().pagination, page: 5 },
    })
    useHoldingsStore.getState().setPageSize(50)

    expect(useHoldingsStore.getState().pagination.pageSize).toBe(50)
    expect(useHoldingsStore.getState().pagination.page).toBe(1)
  })

  it('setLoading: 部分更新 loading 状态', () => {
    useHoldingsStore.getState().setLoading({ isListLoading: true })
    expect(useHoldingsStore.getState().loading.isListLoading).toBe(true)
    expect(useHoldingsStore.getState().loading.isActionLoading).toBe(false)
    expect(useHoldingsStore.getState().loading.isExporting).toBe(false)
  })

  it('openModal: 打开弹窗', () => {
    const holding = createMockHoldingItem('AAPL')
    useHoldingsStore.getState().openModal(holding, 'ADD_POSITION')

    const modal = useHoldingsStore.getState().modal
    expect(modal.open).toBe(true)
    expect(modal.holding).toEqual(holding)
    expect(modal.action).toBe('ADD_POSITION')
  })

  it('closeModal: 关闭弹窗', () => {
    useHoldingsStore.setState({
      modal: {
        open: true,
        holding: createMockHoldingItem('A'),
        action: 'ADD_POSITION',
      },
    })
    useHoldingsStore.getState().closeModal()

    const modal = useHoldingsStore.getState().modal
    expect(modal.open).toBe(false)
    expect(modal.holding).toBeNull()
    expect(modal.action).toBeNull()
  })

  it('resetFilter: 重置 filter 为默认值（日期范围重新计算）并重置 page=1', () => {
    useHoldingsStore.setState({
      filter: {
        startDate: '2020-01-01',
        endDate: '2020-12-31',
        direction: 'BUY',
        keyword: 'test',
      },
      pagination: { ...useHoldingsStore.getState().pagination, page: 5 },
    })

    useHoldingsStore.getState().resetFilter()

    const state = useHoldingsStore.getState()
    expect(state.filter.direction).toBe('ALL')
    expect(state.filter.keyword).toBe('')
    expect(state.filter.startDate).not.toBe('2020-01-01')
    expect(state.filter.endDate).not.toBe('2020-12-31')
    expect(state.pagination.page).toBe(1)
  })

  // ============================================================
  // buildHoldingsParams
  // ============================================================

  it('buildHoldingsParams: 从当前状态构建查询参数', () => {
    useHoldingsStore.setState({
      pagination: { page: 2, pageSize: 50, total: 100 },
      filter: {
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        direction: 'SELL',
        keyword: 'tech',
      },
    })

    const params = buildHoldingsParams()
    expect(params).toEqual({
      page: 2,
      pageSize: 50,
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      direction: 'SELL',
      keyword: 'tech',
    })
  })

  // ============================================================
  // fetchData —— 通过 DataBridge 拉取持仓数据
  // ============================================================
  describe('fetchData', () => {
    // @test_id 追加：fetchData 成功/异常路径
    it('成功：应调用 dataBridge.forward、期间 isListLoading=true、返回 code=200', async () => {
      mockForward.mockImplementationOnce(async () => {
        // 验证调用期间 loading 为 true
        expect(useHoldingsStore.getState().loading.isListLoading).toBe(true)
      })

      const result = await useHoldingsStore.getState().fetchData({
        page: 1,
        pageSize: 20,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        direction: 'ALL',
        keyword: '',
      })

      expect(result.code).toBe(200)
      expect(result.message).toBe('OK')
      expect(mockForward).toHaveBeenCalledTimes(1)
      // finally 应重置 loading
      expect(useHoldingsStore.getState().loading.isListLoading).toBe(false)
    })

    it('异常：dataBridge.forward 抛错时应返回 code=500 并记录日志', async () => {
      mockForward.mockRejectedValueOnce(new Error('网络错误'))

      const result = await useHoldingsStore.getState().fetchData({
        page: 1,
        pageSize: 20,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        direction: 'ALL',
        keyword: '',
      })

      expect(result.code).toBe(500)
      expect(result.message).toContain('网络错误')
      expect(mockLoggerHoldings.error).toHaveBeenCalledWith(
        '[holdingsStore] fetchData failed',
        { error: expect.stringContaining('网络错误') },
      )
      // finally 应重置 loading
      expect(useHoldingsStore.getState().loading.isListLoading).toBe(false)
    })
  })

  // ============================================================
  // executeTrade —— 执行交易（占位实现）
  // ============================================================
  describe('executeTrade', () => {
    // @test_id 追加：executeTrade 返回成功
    it('应返回 success=true 和成功消息', async () => {
      const result = await useHoldingsStore.getState().executeTrade({
        code: '600519.SH',
        action: 'ADD_POSITION',
        quantity: 100,
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Trade executed')
    })
  })

  // ============================================================
  // exportCSV —— 导出 CSV
  // ============================================================
  describe('exportCSV', () => {
    // @test_id 追加：exportCSV 切换 isExporting 状态
    it('应切换 isExporting 状态并最终重置为 false', async () => {
      await useHoldingsStore.getState().exportCSV({
        page: 1,
        pageSize: 20,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        direction: 'ALL',
        keyword: '',
      })

      // finally 应重置 isExporting
      expect(useHoldingsStore.getState().loading.isExporting).toBe(false)
    })
  })
})

// ============================================================
// initHoldingsStoreSubscriptions
// ============================================================

describe('initHoldingsStoreSubscriptions', () => {
  it('订阅 stocks 和 orders 通道', () => {
    const cleanup = initHoldingsStoreSubscriptions()
    const stocksCb = capturedCallbacks.get('stocks')
    const ordersCb = capturedCallbacks.get('orders')
    expect(stocksCb).toBeDefined()
    expect(ordersCb).toBeDefined()

    // 调用回调应不会抛错
    expect(() =>
      stocksCb!({
        meta: { source: 'tradinghub', target: 'db', action: 'HOLDINGS_DATA_LOADED', traceId: 't1', timestamp: Date.now() },
        payload: {},
      }),
    ).not.toThrow()

    expect(() =>
      ordersCb!({
        meta: { source: 'tradinghub', target: 'db', action: 'TRADE_ACTION_EXECUTED', traceId: 't2', timestamp: Date.now() },
        payload: {},
      }),
    ).not.toThrow()

    cleanup()
  })

  it('返回 cleanup 函数', () => {
    const cleanup = initHoldingsStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    cleanup()

    // 再次初始化应该能重新订阅
    const cleanup2 = initHoldingsStoreSubscriptions()
    expect(typeof cleanup2).toBe('function')
    cleanup2()
  })

  // @test_id 追加：重复初始化分支（_unsubscribeChannels.length > 0）
  it('已初始化时再次调用应走重复初始化分支、warn 并返回 cleanup', () => {
    // beforeEach 已 init+cleanup，此时 _unsubscribeChannels 为空
    const cleanup1 = initHoldingsStoreSubscriptions()
    // _unsubscribeChannels.length > 0，再次调用走重复分支
    const cleanup2 = initHoldingsStoreSubscriptions()

    expect(typeof cleanup2).toBe('function')
    expect(mockLoggerHoldings.warn).toHaveBeenCalledWith(
      '[holdingsStore] Subscriptions already initialized, skipping',
    )

    // cleanup2 应清理订阅（幂等）
    cleanup2()
    // cleanup1 仍可调用（数组已空，不抛错）
    expect(() => cleanup1()).not.toThrow()
  })
})
