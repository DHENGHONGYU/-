/**
 * marketDataStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. fetchDataSource: 注册任务并启动，更新 loading 状态
 * 3. fetchDataSource: 失败时设置 error 和 status='error'
 * 4. fetchDataSources: 批量调用多个数据源
 * 5. startPeriodicRefresh: 启动定时器，周期性刷新
 * 6. stopPeriodicRefresh: 停止所有定时器
 * 7. refreshDataSource: taskMap 存在时重新启动任务
 * 8. refreshDataSource: 未注册时只设置 loading
 * 9. reset: 重置所有状态，注销任务
 * 10. refreshWidget: taskMap 存在时重新启动任务
 * 13. refreshWidget: taskMap 不存在时警告
 * 14. getTaskStats: 返回任务统计
 * 15. useDataSource: 返回默认状态当 key 不存在
 * 16. useDataSourceData: 返回 undefined 当 key 不存在
 * 17. initMarketDataStoreTaskSubscription: 订阅 taskScheduler 并返回 cleanup
 * 18. initMarketDataStoreTaskSubscription: 重复调用返回已有 cleanup
 * 19. initMarketDataStoreSubscriptions: 订阅 dataBridge 并返回 cleanup
 * 20. initMarketDataStoreSubscriptions: 订单事件触发 portfolioOverview 刷新
 * 21. initMarketDataStoreSubscriptions: 重复调用跳过
 * 22. handleCollectionResult: 通过 taskScheduler 回调更新数据
 * 23. handleCollectionResult: 错误回调更新 error 状态
 */

const {
  mockRegisterTask,
  mockStartTask,
  mockStopTask,
  mockUnregisterTask,
  mockSubscribeTaskScheduler,
  mockGetAllTasks,
  mockSubscribeDataBridge,
  capturedTaskSchedulerCallback,
  capturedDataBridgeCallback,
  unsubscribeTaskSchedulerFn,
  unsubscribeDataBridgeFn,
  mockAdapt,
  mockMerge,
} = vi.hoisted(() => {
  const capturedTaskSchedulerCallback = { callback: null as ((taskId: string, rawData: unknown, error?: Error) => void) | null }
  const capturedDataBridgeCallback = { callback: null as ((envelope: unknown) => void) | null }
  const unsubscribeTaskSchedulerFn = vi.fn()
  const unsubscribeDataBridgeFn = vi.fn()

  const mockSubscribeTaskScheduler = vi.fn().mockImplementation((callback: unknown) => {
    capturedTaskSchedulerCallback.callback = callback
    return unsubscribeTaskSchedulerFn
  })

  const mockSubscribeDataBridge = vi.fn().mockImplementation((_channel: string, callback: unknown) => {
    capturedDataBridgeCallback.callback = callback
    return unsubscribeDataBridgeFn
  })

  return {
    mockRegisterTask: vi.fn().mockReturnValue('task_test_1'),
    mockStartTask: vi.fn(),
    mockStopTask: vi.fn(),
    mockUnregisterTask: vi.fn(),
    mockSubscribeTaskScheduler,
    mockGetAllTasks: vi.fn().mockReturnValue([]),
    mockSubscribeDataBridge,
    capturedTaskSchedulerCallback,
    capturedDataBridgeCallback,
    unsubscribeTaskSchedulerFn,
    unsubscribeDataBridgeFn,
    mockAdapt: vi.fn().mockReturnValue({ indices: [{ code: 'TEST', price: 100 }] }),
    mockMerge: vi.fn().mockReturnValue({
      timestamp: 0,
      indices: [],
      sectors: [],
      fundFlows: [],
      sentiment: {
        fearGreedIndex: 50,
        fearGreedLabel: '\u4e2d\u6027',
        totalStocks: 0,
        up: 0,
        down: 0,
        flat: 0,
        limitUp: 0,
        limitDown: 0,
      },
      watchlist: [],
      portfolio: {
        totalAssets: '0',
        availableFunds: '0',
        todayPnL: '0',
        todayPnLPercent: 0,
        totalPnL: '0',
        totalPnLPercent: 0,
        holdings: 0,
        holdingsList: [],
        rebalancePlan: [],
      },
      tradeReview: {
        totalTrades: 0,
        profitable: 0,
        losing: 0,
        winRate: 0,
        profitLossRatio: 0,
        disciplineScore: 0,
      },
      analysisScores: {
        profile: { tags: [], metrics: [] },
        kai: { totalScore: 0, sentiment: 0, trend: 0, flow: 0, dimensions: [], detailDistribution: [] },
      },
      modelComparison: {
        leftModel: { id: '', name: '', version: '', score: 0 },
        rightModel: { id: '', name: '', version: '', score: 0 },
        dimensions: [],
        riskHint: '',
      },
      stockPool: { stocks: [], total: 0, page: 1, pageSize: 10 },
      chatHistory: { target: '', targetType: 'stock', messages: [] },
      hotSectors: [],
      valuePit: [],
    }),
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/services/data-collector/TaskScheduler', () => ({
  taskScheduler: {
    registerTask: mockRegisterTask,
    startTask: mockStartTask,
    stopTask: mockStopTask,
    unregisterTask: mockUnregisterTask,
    subscribe: mockSubscribeTaskScheduler,
    getAllTasks: mockGetAllTasks,
  },
}))

vi.mock('@/services/data-collector/MarketDataAdapter', () => ({
  marketDataAdapter: {
    adapt: mockAdapt,
    merge: mockMerge,
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribeDataBridge },
}))

vi.mock('@/config/dbConfig', () => ({
  STORE_NAME: { orders: 'orders' },
}))



import { renderHook } from '@testing-library/react'
import {
  useMarketDataStore,
  useDataSource,
  useDataSourceData,
  initMarketDataStoreTaskSubscription,
  initMarketDataStoreSubscriptions,
} from './marketDataStore'
import { marketDataAdapter } from '@/services/data-collector/MarketDataAdapter'
import { assertContract } from '../../tests/contracts'

function createMockMarketDataItem(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'AAPL',
    price: 150,
    volume: 1000000,
    change: 2.5,
    changePercent: 1.67,
    timestamp: Date.now(),
    ...overrides,
  }
}

function createMockDataSourceConfig(overrides: Record<string, unknown> = {}) {
  return {
    type: 'mock' as const,
    mode: 'once' as const,
    interval: 5000,
    enabled: true,
    ...overrides,
  }
}

beforeEach(() => {
  // 清理模块级订阅状态
  initMarketDataStoreTaskSubscription()()
  initMarketDataStoreSubscriptions()()

  vi.clearAllMocks()

  useMarketDataStore.setState({
    status: 'idle',
    dataSources: {},
    mergedData: marketDataAdapter.merge(),
    loadingMap: {},
    errorMap: {},
    taskMap: {},
    globalError: null,
  })
})

describe('marketDataStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================
  it('初始状态正确', () => {
    const state = useMarketDataStore.getState()
    expect(state.status).toBe('idle')
    expect(state.dataSources).toEqual({})
    expect(state.loadingMap).toEqual({})
    expect(state.errorMap).toEqual({})
    expect(state.taskMap).toEqual({})
    expect(state.globalError).toBeNull()

    // 验证初始状态符合契约
    assertContract('MarketDataState', state, '初始状态')
  })

  // ============================================================
  // fetchDataSource
  // ============================================================
  it('fetchDataSource 注册任务并启动，更新 loading 状态', async () => {
    const config = createMockDataSourceConfig()
    await useMarketDataStore.getState().fetchDataSource('marketIndices', config, 'instance_1')

    expect(mockRegisterTask).toHaveBeenCalledWith('marketIndices', 'instance_1', config)
    expect(mockStartTask).toHaveBeenCalledWith('task_test_1')

    const state = useMarketDataStore.getState()
    expect(state.status).toBe('loading')
    expect(state.dataSources.marketIndices?.loading).toBe(true)
    expect(state.dataSources.marketIndices?.error).toBeNull()
    expect(state.loadingMap.instance_1).toBe(true)
    expect(state.errorMap.instance_1).toBeNull()
  })

  it('fetchDataSource 失败时设置 error 和 status=error', async () => {
    mockRegisterTask.mockImplementationOnce(() => {
      throw new Error('\u6ce8\u518c\u5931\u8d25')
    })

    const config = createMockDataSourceConfig()
    await useMarketDataStore.getState().fetchDataSource('marketIndices', config, 'instance_1')

    const state = useMarketDataStore.getState()
    expect(state.status).toBe('error')
    expect(state.globalError).toBe('\u6ce8\u518c\u5931\u8d25')
    expect(state.dataSources.marketIndices?.loading).toBe(false)
    expect(state.dataSources.marketIndices?.error).toBe('\u6ce8\u518c\u5931\u8d25')
    expect(state.loadingMap.instance_1).toBe(false)
    expect(state.errorMap.instance_1).toBe('\u6ce8\u518c\u5931\u8d25')
  })

  // ============================================================
  // fetchDataSources
  // ============================================================
  it('fetchDataSources 批量调用多个数据源', async () => {
    mockRegisterTask
      .mockReturnValueOnce('task_1')
      .mockReturnValueOnce('task_2')

    const configs = [
      { key: 'marketIndices' as const, config: createMockDataSourceConfig(), instanceId: 'inst_1' },
      { key: 'sectorHeatmap' as const, config: createMockDataSourceConfig(), instanceId: 'inst_2' },
    ]

    await useMarketDataStore.getState().fetchDataSources(configs)

    expect(mockRegisterTask).toHaveBeenCalledTimes(2)
    expect(mockStartTask).toHaveBeenCalledTimes(2)
    expect(useMarketDataStore.getState().loadingMap.inst_1).toBe(true)
    expect(useMarketDataStore.getState().loadingMap.inst_2).toBe(true)
  })

  // ============================================================
  // startPeriodicRefresh / stopPeriodicRefresh
  // ============================================================
  it('startPeriodicRefresh 启动定时器', () => {
    vi.useFakeTimers()
    const spyRefresh = vi.spyOn(useMarketDataStore.getState(), 'refreshDataSource')

    useMarketDataStore.getState().startPeriodicRefresh(['marketIndices', 'sectorHeatmap'], 5000)

    vi.advanceTimersByTime(5000)
    expect(spyRefresh).toHaveBeenCalledWith('marketIndices')
    expect(spyRefresh).toHaveBeenCalledWith('sectorHeatmap')

    vi.useRealTimers()
    spyRefresh.mockRestore()
    useMarketDataStore.getState().stopPeriodicRefresh()
  })

  it('stopPeriodicRefresh 停止所有定时器', () => {
    vi.useFakeTimers()
    useMarketDataStore.getState().startPeriodicRefresh(['marketIndices'], 5000)

    useMarketDataStore.getState().stopPeriodicRefresh()

    const spyRefresh = vi.spyOn(useMarketDataStore.getState(), 'refreshDataSource')
    vi.advanceTimersByTime(10000)
    expect(spyRefresh).not.toHaveBeenCalled()

    vi.useRealTimers()
    spyRefresh.mockRestore()
  })

  // ============================================================
  // refreshDataSource
  // ============================================================
  it('refreshDataSource: taskMap 存在时重新启动任务', () => {
    useMarketDataStore.setState({
      dataSources: {
        marketIndices: { data: undefined, loading: false, error: null, lastUpdated: 0 },
      },
      taskMap: { marketIndices: 'task_existing' },
    })

    useMarketDataStore.getState().refreshDataSource('marketIndices')

    expect(mockStopTask).toHaveBeenCalledWith('task_existing')
    expect(mockStartTask).toHaveBeenCalledWith('task_existing')
    expect(useMarketDataStore.getState().dataSources.marketIndices?.loading).toBe(true)
  })

  it('refreshDataSource: 未注册时只设置 loading 不调用 taskScheduler', () => {
    useMarketDataStore.setState({
      dataSources: {},
      taskMap: {},
    })

    useMarketDataStore.getState().refreshDataSource('sectorHeatmap')

    expect(mockStopTask).not.toHaveBeenCalled()
    expect(mockStartTask).not.toHaveBeenCalled()
  })

  // ============================================================
  // reset
  // ============================================================
  it('reset 重置所有状态', () => {
    useMarketDataStore.setState({
      status: 'ready',
      dataSources: { marketIndices: { data: { indices: [] }, loading: false, error: null, lastUpdated: 123 } },
      loadingMap: { a: true },
      errorMap: { a: 'err' },
      taskMap: { a: 't1' },
      globalError: 'some error',
    })

    useMarketDataStore.getState().reset()

    const state = useMarketDataStore.getState()
    expect(state.status).toBe('idle')
    expect(state.dataSources).toEqual({})
    expect(state.loadingMap).toEqual({})
    expect(state.errorMap).toEqual({})
    expect(state.taskMap).toEqual({})
    expect(state.globalError).toBeNull()
    expect(mockUnregisterTask).toHaveBeenCalledWith('t1')
  })

  // ============================================================
  // refreshWidget
  // ============================================================
  it('refreshWidget: taskMap 存在时重新启动任务', () => {
    useMarketDataStore.setState({
      taskMap: { widget_1: 'task_w1' },
    })

    useMarketDataStore.getState().refreshWidget('widget_1')

    expect(mockStopTask).toHaveBeenCalledWith('task_w1')
    expect(mockStartTask).toHaveBeenCalledWith('task_w1')
    expect(useMarketDataStore.getState().loadingMap.widget_1).toBe(true)
    expect(useMarketDataStore.getState().errorMap.widget_1).toBeNull()
  })

  it('refreshWidget: taskMap 不存在时警告并不调用 taskScheduler', () => {
    useMarketDataStore.setState({ taskMap: {} })

    useMarketDataStore.getState().refreshWidget('unknown_widget')

    expect(mockStopTask).not.toHaveBeenCalled()
    expect(mockStartTask).not.toHaveBeenCalled()
  })

  // ============================================================
  // getTaskStats
  // ============================================================
  it('getTaskStats: 返回任务统计', () => {
    mockGetAllTasks.mockReturnValue([
      { taskId: 't1', status: 'running' },
      { taskId: 't2', status: 'error' },
      { taskId: 't3', status: 'pending' },
    ])

    const stats = useMarketDataStore.getState().getTaskStats()
    expect(stats).toEqual({ total: 3, running: 1, error: 1 })
  })

  // ============================================================
  // Selector Hooks
  // ============================================================
  it('useDataSource: 返回默认状态当 key 不存在', () => {
    const { result } = renderHook(() => useDataSource('marketIndices'))
    expect(result.current).toEqual({
      data: undefined,
      loading: false,
      error: null,
      lastUpdated: 0,
    })
  })

  it('useDataSource: 返回已存在的数据源状态', () => {
    useMarketDataStore.setState({
      dataSources: {
        marketIndices: { data: { foo: 'bar' } as any, loading: false, error: null, lastUpdated: 123 },
      },
    })

    const { result } = renderHook(() => useDataSource('marketIndices'))
    expect(result.current.data).toEqual({ foo: 'bar' })
    expect(result.current.loading).toBe(false)
    expect(result.current.lastUpdated).toBe(123)
  })

  it('useDataSourceData: 返回 undefined 当 key 不存在', () => {
    const { result } = renderHook(() => useDataSourceData('marketIndices'))
    expect(result.current).toBeUndefined()
  })

  it('useDataSourceData: 返回对应数据源数据', () => {
    useMarketDataStore.setState({
      dataSources: {
        marketIndices: { data: [createMockMarketDataItem()] as any, loading: false, error: null, lastUpdated: 0 },
      },
    })

    const { result } = renderHook(() => useDataSourceData('marketIndices'))
    expect(result.current).toHaveLength(1)
    expect((result.current as any)[0].symbol).toBe('AAPL')
  })
})

// ============================================================
// initMarketDataStoreTaskSubscription
// ============================================================
describe('initMarketDataStoreTaskSubscription', () => {
  it('订阅 taskScheduler 并返回 cleanup', () => {
    const cleanup = initMarketDataStoreTaskSubscription()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)
    expect(typeof cleanup).toBe('function')

    cleanup()
    expect(unsubscribeTaskSchedulerFn).toHaveBeenCalledTimes(1)
  })

  it('重复调用返回已有 cleanup', () => {
    initMarketDataStoreTaskSubscription()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)

    const cleanup2 = initMarketDataStoreTaskSubscription()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)
    expect(typeof cleanup2).toBe('function')

    cleanup2()
    expect(unsubscribeTaskSchedulerFn).toHaveBeenCalledTimes(1)
  })

  it('handleCollectionResult: 通过 taskScheduler 回调成功更新数据', () => {
    initMarketDataStoreTaskSubscription()

    // 设置 taskMap，使 handleCollectionResult 能匹配到 key
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: true, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
      mergedData: marketDataAdapter.merge(),
    })

    mockAdapt.mockReturnValueOnce({ portfolio: { totalAssets: '10000' } })
    mockMerge.mockReturnValueOnce({
      ...marketDataAdapter.merge(),
      portfolio: { totalAssets: '10000' },
    })

    capturedTaskSchedulerCallback.callback?.('task_po_1', {
      dataType: 'portfolio',
      source: 'mock',
      payload: { totalAssets: '10000' },
    })

    const state = useMarketDataStore.getState()
    expect(state.dataSources.portfolioOverview?.loading).toBe(false)
    expect(state.dataSources.portfolioOverview?.error).toBeNull()
    expect(state.dataSources.portfolioOverview?.lastUpdated).toBeGreaterThan(0)
  })

  it('handleCollectionResult: 错误回调更新 error 状态', () => {
    initMarketDataStoreTaskSubscription()

    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: true, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
      loadingMap: { portfolioOverview: true },
      errorMap: { portfolioOverview: null },
    })

    capturedTaskSchedulerCallback.callback?.('task_po_1', null, new Error('采集失败'))

    const state = useMarketDataStore.getState()
    expect(state.dataSources.portfolioOverview?.loading).toBe(false)
    expect(state.dataSources.portfolioOverview?.error).toBe('\u91c7\u96c6\u5931\u8d25')
    expect(state.loadingMap.portfolioOverview).toBe(false)
    expect(state.errorMap.portfolioOverview).toBe('\u91c7\u96c6\u5931\u8d25')
  })
})

// ============================================================
// initMarketDataStoreSubscriptions
// ============================================================
describe('initMarketDataStoreSubscriptions', () => {
  it('订阅 dataBridge 并返回 cleanup', () => {
    const cleanup = initMarketDataStoreSubscriptions()
    expect(mockSubscribeDataBridge).toHaveBeenCalledWith('orders', expect.any(Function))
    expect(typeof cleanup).toBe('function')

    cleanup()
    expect(unsubscribeDataBridgeFn).toHaveBeenCalledTimes(1)
  })

  it('订单事件触发 portfolioOverview 刷新', () => {
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: false, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
    })

    initMarketDataStoreSubscriptions()

    capturedDataBridgeCallback.callback?.({
      meta: { action: 'INSERT_ORDER', traceId: 't1' },
      payload: {},
    })

    expect(mockStopTask).toHaveBeenCalledWith('task_po_1')
    expect(mockStartTask).toHaveBeenCalledWith('task_po_1')
  })

  it('portfolioOverview 加载中时跳过刷新', () => {
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: true, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
    })

    initMarketDataStoreSubscriptions()

    capturedDataBridgeCallback.callback?.({
      meta: { action: 'INSERT_ORDER', traceId: 't1' },
      payload: {},
    })

    expect(mockStopTask).not.toHaveBeenCalled()
    expect(mockStartTask).not.toHaveBeenCalled()
  })

  it('重复调用跳过', () => {
    initMarketDataStoreSubscriptions()
    expect(mockSubscribeDataBridge).toHaveBeenCalledTimes(1)

    const cleanup2 = initMarketDataStoreSubscriptions()
    expect(mockSubscribeDataBridge).toHaveBeenCalledTimes(1)
    expect(typeof cleanup2).toBe('function')

    cleanup2()
    expect(unsubscribeDataBridgeFn).toHaveBeenCalledTimes(1)
  })
})
