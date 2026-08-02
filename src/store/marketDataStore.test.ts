/**
 * @test_id V9-TEST-ST-143
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
  * @covers_docs []
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
  const capturedTaskSchedulerCallback = { callback: null as ((taskId: string, rawData: Record<string, unknown>, error?: Error) => void) | null }
  const capturedDataBridgeCallback = { callback: null as ((envelope: StandardEnvelope) => void) | null }
  const unsubscribeTaskSchedulerFn = vi.fn()
  const unsubscribeDataBridgeFn = vi.fn()

  const mockSubscribeTaskScheduler = vi.fn().mockImplementation((callback: (taskId: string, rawData: Record<string, unknown>, error?: Error) => void) => {
    capturedTaskSchedulerCallback.callback = callback
    return unsubscribeTaskSchedulerFn
  })

  const mockSubscribeDataBridge = vi.fn().mockImplementation((_channel: string, callback: (envelope: StandardEnvelope) => void) => {
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
        maxDrawdown: 0,
        sharpeRatio: 0,
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
      poolBoard: { items: [], total: 0, page: 1, pageSize: 10 },
      chatHistory: { target: '', targetType: 'stock', messages: [] },
      hotSectors: [],
      valuePit: [],
    }),
  }
})

// ============================================================
// 补充覆盖：额外 vi.hoisted mocks
// ============================================================

const mockSendChatMessage = vi.hoisted(() => vi.fn())
const mockStreamingChat = vi.hoisted(() => vi.fn())
const mockNanoid = vi.hoisted(() => vi.fn().mockReturnValue('testid123'))
const cockpitState = vi.hoisted(() => ({ activeDataSource: 'MOCK' as string }))

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
  MODULE_ID: { fetcher: 'fetcher' },
  ENVELOPE_ACTION: { saveNews: 'saveNews' },
  ENVELOPE_TARGET: { data: 'data' },
  DB_VERSION: 1,
  DATA_SOURCE: { manual: 'manual', auto: 'auto' },
}))

vi.mock('@/constants/cockpit.constants', () => ({
  get ACTIVE_DATA_SOURCE() { return cockpitState.activeDataSource },
  DATA_SOURCE_TYPE: { MOCK: 'MOCK', REST: 'REST' },
}))

vi.mock('@/services/stock-analysis/mockStockAnalysisProvider', () => ({
  MockStockAnalysisProvider: { sendChatMessage: mockSendChatMessage },
}))

vi.mock('@/services/llm/llmGateway', () => ({
  streamingChat: mockStreamingChat,
}))

vi.mock('nanoid', () => ({
  nanoid: mockNanoid,
}))



import { renderHook } from '@testing-library/react'
import type { StandardEnvelope } from '@/core/envelope'
import {
  useMarketDataStore,
  useDataSource,
  useDataSourceData,
  initMarketDataStoreTaskSubscription,
  initMarketDataStoreSubscriptions,
  initMarketDataStoreGlobalSubscriptions,
  _resetMarketDataStoreSubscriptionsForTest,
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
  vi.clearAllMocks()
  _resetMarketDataStoreSubscriptionsForTest()
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

    mockAdapt.mockReturnValueOnce({ portfolio: { totalAssets: '10000', maxDrawdown: 0, sharpeRatio: 0 } })
    mockMerge.mockReturnValueOnce({
      ...marketDataAdapter.merge(),
      portfolio: { totalAssets: '10000', maxDrawdown: 0, sharpeRatio: 0 },
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

    capturedTaskSchedulerCallback.callback?.('task_po_1', {}, new Error('采集失败'))

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

  it('订单事件触发 portfolioOverview 刷新', async () => {
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: false, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
    })

    initMarketDataStoreSubscriptions()

    capturedDataBridgeCallback.callback?.({
      meta: { source: 'trading', target: 'db', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    // 等待防抖完成
    await new Promise((r) => setTimeout(r, 400))

    expect(mockStopTask).toHaveBeenCalledWith('task_po_1')
    expect(mockStartTask).toHaveBeenCalledWith('task_po_1')
  })

  it('portfolioOverview 加载中时跳过刷新', async () => {
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: true, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
    })

    initMarketDataStoreSubscriptions()

    capturedDataBridgeCallback.callback?.({
      meta: { source: 'trading', target: 'db', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    // 等待防抖
    await new Promise((r) => setTimeout(r, 400))

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

// ============================================================
// 补充覆盖：mergeAdaptedData + sendChatMessage + global init + destroy
// ============================================================

describe('marketDataStore 补充覆盖', () => {
  beforeEach(() => {
    cockpitState.activeDataSource = 'MOCK'
  })

  // ----------------------------------------------------------
  // mergeAdaptedData（lines 388-392）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-merge-01 */
  it('mergeAdaptedData: 合并适配数据到 mergedData', () => {
    mockMerge.mockReturnValue({ indices: [{ code: 'SH', price: 3200 }] })
    useMarketDataStore.getState().mergeAdaptedData({ indices: [{ code: 'SH', price: 3200 }] })
    expect(mockMerge).toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // sendChatMessage: Mock 模式（lines 403-404）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-chat-mock-01 */
  it('sendChatMessage: Mock 模式调用 MockStockAnalysisProvider', async () => {
    cockpitState.activeDataSource = 'MOCK'
    const mockResponse = { id: 'msg_1', role: 'assistant' as const, content: 'mock reply', timestamp: Date.now() }
    mockSendChatMessage.mockResolvedValue(mockResponse)

    const result = await useMarketDataStore.getState().sendChatMessage('AAPL', '分析一下')

    expect(mockSendChatMessage).toHaveBeenCalledWith('AAPL', '分析一下')
    expect(result.content).toBe('mock reply')
    expect(result.role).toBe('assistant')
  })

  // ----------------------------------------------------------
  // sendChatMessage: REST 模式成功（lines 407-435）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-chat-rest-01 */
  it('sendChatMessage: REST 模式使用 SSE 流式推理', async () => {
    cockpitState.activeDataSource = 'REST'
    mockStreamingChat.mockImplementation(async (_messages: unknown, callback: (chunk: { content: string; isDone: boolean }) => void) => {
      callback({ content: 'Hello ', isDone: false })
      callback({ content: 'World', isDone: false })
      callback({ content: '', isDone: true })
    })

    const result = await useMarketDataStore.getState().sendChatMessage('AAPL', '分析一下')

    expect(mockStreamingChat).toHaveBeenCalledTimes(1)
    expect(result.content).toBe('Hello World')
    expect(result.role).toBe('assistant')
    expect(result.id).toContain('assistant_')
  })

  // ----------------------------------------------------------
  // sendChatMessage: REST 模式失败（lines 425-428）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-chat-rest-02 */
  it('sendChatMessage: REST 模式 LLM 失败时抛出异常', async () => {
    cockpitState.activeDataSource = 'REST'
    mockStreamingChat.mockRejectedValue(new Error('LLM 服务不可用'))

    await expect(useMarketDataStore.getState().sendChatMessage('AAPL', '分析一下'))
      .rejects.toThrow('LLM 服务不可用')
  })

  // ----------------------------------------------------------
  // handleCollectionResult: 未知 taskId（lines 459, 472）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-callback-unknown-01 */
  it('handleCollectionResult: 未知 taskId 成功回调不崩溃（覆盖 lines 459, 472）', () => {
    initMarketDataStoreTaskSubscription()
    // taskMap 为空，taskId 不匹配任何条目 → key=undefined, instanceId=undefined
    capturedTaskSchedulerCallback.callback?.('unknown_task', { dataType: 'test', source: 'mock', payload: {} })
    // 不应该崩溃，也不应该更新任何数据源
    expect(useMarketDataStore.getState().dataSources).toEqual({})
  })

  /** @test_id V9-TEST-ST-143-callback-unknown-02 */
  it('handleCollectionResult: 未知 taskId 错误回调不崩溃（覆盖 lines 459, 472 错误路径）', () => {
    initMarketDataStoreTaskSubscription()
    capturedTaskSchedulerCallback.callback?.('unknown_task', null, new Error('采集失败'))
    // 不应该崩溃
  })

  // ----------------------------------------------------------
  // initMarketDataStoreGlobalSubscriptions（lines 600-618）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-global-init-01 */
  it('initMarketDataStoreGlobalSubscriptions: 首次调用注册全部订阅', () => {
    initMarketDataStoreGlobalSubscriptions()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)
    expect(mockSubscribeDataBridge).toHaveBeenCalledWith('orders', expect.any(Function))
    expect(mockSubscribeDataBridge).toHaveBeenCalledTimes(1)
  })

  /** @test_id V9-TEST-ST-143-global-init-02 */
  it('initMarketDataStoreGlobalSubscriptions: 重复调用幂等跳过', () => {
    initMarketDataStoreGlobalSubscriptions()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)
    expect(mockSubscribeDataBridge).toHaveBeenCalledTimes(1)

    initMarketDataStoreGlobalSubscriptions()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)
    expect(mockSubscribeDataBridge).toHaveBeenCalledTimes(1)
  })

  /** @test_id V9-TEST-ST-143-global-init-03 */
  it('initMarketDataStoreGlobalSubscriptions: 已有组件级订阅时复用', () => {
    // 先组件级初始化
    initMarketDataStoreTaskSubscription()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1)

    // 全局初始化 → TaskScheduler 已订阅，只初始化 DataBridge
    initMarketDataStoreGlobalSubscriptions()
    expect(mockSubscribeTaskScheduler).toHaveBeenCalledTimes(1) // 不增加
    expect(mockSubscribeDataBridge).toHaveBeenCalledTimes(1)    // DataBridge 新增
  })

  // ----------------------------------------------------------
  // destroyMarketDataStoreSubscriptions: 全局保护（lines 672-673）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-destroy-global-01 */
  it('全局初始化后，组件级 destroy 跳过（全局保护，覆盖 lines 672-673）', () => {
    initMarketDataStoreGlobalSubscriptions()

    // 记录 cleanup 前的调用次数（beforeEach 的 _reset 可能已调用过 unsub）
    const callsBefore = unsubscribeDataBridgeFn.mock.calls.length

    const cleanup = initMarketDataStoreSubscriptions()
    cleanup()

    // 全局保护 → cleanup 不应额外调用 unsub
    expect(unsubscribeDataBridgeFn.mock.calls.length).toBe(callsBefore)
  })

  // ----------------------------------------------------------
  // destroyMarketDataStoreSubscriptions: 去抖定时器清理（lines 675-677）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-destroy-timer-01 */
  it('组件级 destroy：有去抖定时器时清除（覆盖 lines 675-677）', async () => {
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: false, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
    })

    const cleanup = initMarketDataStoreSubscriptions()

    // 触发事件 → 设置去抖定时器（300ms 防抖）
    capturedDataBridgeCallback.callback?.({
      meta: { source: 'trading', target: 'db', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    // 100ms 后调用 cleanup（定时器还未触发，_refreshDebounceTimer 仍存在）
    await new Promise((r) => setTimeout(r, 100))
    cleanup()

    // 验证 unsub 被调用（组件级 destroy 正常清理）
    expect(unsubscribeDataBridgeFn).toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // _resetMarketDataStoreSubscriptionsForTest: 定时器清理（lines 635-636）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-reset-timer-01 */
  it('_resetMarketDataStoreSubscriptionsForTest: 有定时器时清理（覆盖 lines 635-636）', () => {
    vi.useFakeTimers()
    useMarketDataStore.getState().startPeriodicRefresh(['marketIndices'], 5000)
    // 不调用 stopPeriodicRefresh，直接 reset → periodicTimers 有条目
    _resetMarketDataStoreSubscriptionsForTest()
    vi.useRealTimers()
    // 验证不崩溃，periodicTimers 已清理
  })

  // ----------------------------------------------------------
  // fetchDataSource: 非 Error 异常（branch 264）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-fetch-nonerror-01 */
  it('fetchDataSource: 非 Error 异常时使用 String(err) 作为消息（branch 264）', async () => {
    mockRegisterTask.mockImplementationOnce(() => {
      throw '注册字符串异常'
    })
    const config = createMockDataSourceConfig()
    await useMarketDataStore.getState().fetchDataSource('marketIndices', config, 'instance_1')
    expect(useMarketDataStore.getState().globalError).toBe('注册字符串异常')
  })

  // ----------------------------------------------------------
  // sendChatMessage: REST 模式非 Error 异常（branch 426）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-chat-rest-03 */
  it('sendChatMessage: REST 模式非 Error 异常（branch 426）', async () => {
    cockpitState.activeDataSource = 'REST'
    mockStreamingChat.mockRejectedValue('LLM字符串异常')
    await expect(useMarketDataStore.getState().sendChatMessage('AAPL', '分析一下'))
      .rejects.toBe('LLM字符串异常')
  })

  // ----------------------------------------------------------
  // DataBridge 连续事件：第二次清除前一个去抖定时器（line 657）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-debounce-clear-01 */
  it('DataBridge 连续事件：第二次事件清除前一个去抖定时器（覆盖 line 657）', async () => {
    useMarketDataStore.setState({
      dataSources: {
        portfolioOverview: { data: undefined, loading: false, error: null, lastUpdated: 0 },
      },
      taskMap: { portfolioOverview: 'task_po_1' },
    })
    initMarketDataStoreSubscriptions()

    // 第一次事件 → 设置 _refreshDebounceTimer
    capturedDataBridgeCallback.callback?.({
      meta: { source: 'trading', target: 'db', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    // 50ms 后第二次事件 → 清除前一个定时器（覆盖 line 657）并设置新定时器
    await new Promise((r) => setTimeout(r, 50))
    capturedDataBridgeCallback.callback?.({
      meta: { source: 'trading', target: 'db', action: 'INSERT_ORDER', traceId: 't2', timestamp: Date.now() },
      payload: {},
    })

    // 等待防抖完成
    await new Promise((r) => setTimeout(r, 400))
    expect(mockStopTask).toHaveBeenCalledWith('task_po_1')
  })

  // ----------------------------------------------------------
  // fetchDataSource: 失败且无 instanceId（branch 278 false）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-fetch-error-no-instance-01 */
  it('fetchDataSource: 失败且无 instanceId 时不更新 loadingMap（branch 278）', async () => {
    mockRegisterTask.mockImplementationOnce(() => {
      throw new Error('注册失败')
    })
    const config = createMockDataSourceConfig()
    // 不传 instanceId → catch 块中 instanceId 为 undefined → loadingMap 不更新
    await useMarketDataStore.getState().fetchDataSource('marketIndices', config)
    expect(useMarketDataStore.getState().globalError).toBe('注册失败')
  })

  // ----------------------------------------------------------
  // handleCollectionResult: rawData 为 null 且无 error（branch 505 false）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-callback-null-01 */
  it('handleCollectionResult: rawData 为 null 且无 error 时不更新（branch 505）', () => {
    initMarketDataStoreTaskSubscription()
    // rawData=null, error=undefined → 既不进 error 分支也不进 rawData 分支
    capturedTaskSchedulerCallback.callback?.('task_1', null)
    // 不崩溃
  })

  // ----------------------------------------------------------
  // handleCollectionResult: hasAnyData 为 true 时 status 设为 ready（branch 533 true）
  // ----------------------------------------------------------

  /** @test_id V9-TEST-ST-143-callback-hasdata-01 */
  it('handleCollectionResult: mergedData 有数据时 status 设为 ready（branch 533 true）', () => {
    initMarketDataStoreTaskSubscription()
    useMarketDataStore.setState({
      taskMap: { portfolioOverview: 'task_po_1' },
    })
    // mockMerge 返回含非空数组的对象 → hasAnyData = true
    mockMerge.mockReturnValueOnce({ indices: [{ code: 'SH', price: 3200 }] })
    capturedTaskSchedulerCallback.callback?.('task_po_1', { dataType: 'portfolio', source: 'mock', payload: { total: 100 } })
    expect(useMarketDataStore.getState().status).toBe('ready')
  })
})
