/**
 * dataflowStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. setConnected: 更新 connected
 * 3. updateChannelSubscribers: 添加新 channel
 * 4. updateChannelSubscribers: 更新已有 channel
 * 5. updateCache: 添加新数据
 * 6. updateCache: 更新已有 channel
 * 7. refreshStats: 更新 stats
 * 8. initDataflowSubscriptions: DATAFLOW_CONNECTED 事件设置 connected=true
 * 9. initDataflowSubscriptions: DATAFLOW_DISCONNECTED 事件设置 connected=false
 * 10. initDataflowSubscriptions: DATAFLOW_PACKET_PUBLISHED 事件更新 subscribers
 * 11. initDataflowSubscriptions: 多次调用清理旧订阅
 * 12. destroyDataflowSubscriptions: 清理所有订阅
 * 13. 多 channel 独立管理
 * 14. stats 正确反映 dataFlowEngine.getStats()
 * 15. createMockDataPacket 辅助函数可用
 */

const {
  mockGetStats,
  mockOn,
  capturedEventBusCallbacks,
  unsubscribeFns,
} = vi.hoisted(() => {
  const capturedEventBusCallbacks = new Map<string, ((payload?: any) => void)>()
  const unsubscribeFns: Array<ReturnType<typeof vi.fn>> = []

  const mockOn = vi.fn().mockImplementation((event: string, callback: (payload?: any) => void) => {
    capturedEventBusCallbacks.set(event, callback)
    const unsub = vi.fn()
    unsubscribeFns.push(unsub)
    return unsub
  })

  return {
    mockGetStats: vi.fn().mockReturnValue({
      connected: false,
      channels: 5,
      subscribers: [
        { channel: 'market:index', count: 2 },
        { channel: 'market:sector', count: 1 },
      ],
      cacheEntries: 3,
      refreshTasks: 2,
    }),
    mockOn,
    capturedEventBusCallbacks,
    unsubscribeFns,
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/dataflow/dataflowEngine', () => ({
  dataFlowEngine: {
    getStats: mockGetStats,
  },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: mockOn,
    emit: vi.fn(),
  },
}))

import {
  useDataflowStore,
  initDataflowSubscriptions,
  destroyDataflowSubscriptions,
} from './dataflowStore'

let initialUnsubscribeCount = 0

function createMockDataPacket(overrides: Record<string, unknown> = {}) {
  return {
    id: `pkt-${Date.now()}`,
    channelId: 'market:index',
    data: { price: 100 },
    timestamp: Date.now(),
    priority: 1,
    ...overrides,
  }
}

beforeEach(() => {
  capturedEventBusCallbacks.clear()
  destroyDataflowSubscriptions()
  initialUnsubscribeCount = unsubscribeFns.length
  vi.clearAllMocks()

  useDataflowStore.setState({
    connected: false,
    channels: new Map(),
    cache: new Map(),
    stats: mockGetStats(),
  })
})

describe('dataflowStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================
  it('初始状态正确', () => {
    const state = useDataflowStore.getState()
    expect(state.connected).toBe(false)
    expect(state.channels.size).toBe(0)
    expect(state.cache.size).toBe(0)
    expect(state.stats.channels).toBe(5)
  })

  // ============================================================
  // setConnected
  // ============================================================
  it('setConnected 更新 connected', () => {
    useDataflowStore.getState().setConnected(true)
    expect(useDataflowStore.getState().connected).toBe(true)

    useDataflowStore.getState().setConnected(false)
    expect(useDataflowStore.getState().connected).toBe(false)
  })

  // ============================================================
  // updateChannelSubscribers
  // ============================================================
  it('updateChannelSubscribers 添加新 channel', () => {
    useDataflowStore.getState().updateChannelSubscribers('market:index', 5)
    const state = useDataflowStore.getState()
    expect(state.channels.get('market:index')?.subscribers).toBe(5)
    expect(state.channels.get('market:index')?.lastPublish).toBeGreaterThan(0)
  })

  it('updateChannelSubscribers 更新已有 channel', () => {
    useDataflowStore.getState().updateChannelSubscribers('market:index', 3)
    const firstPublish = useDataflowStore.getState().channels.get('market:index')?.lastPublish

    // 等待一小段时间确保 lastPublish 可能变化
    const now = Date.now()
    while (Date.now() - now < 2) { /* busy wait for timestamp change */ }

    useDataflowStore.getState().updateChannelSubscribers('market:index', 8)
    const state = useDataflowStore.getState()
    expect(state.channels.get('market:index')?.subscribers).toBe(8)
    expect(state.channels.get('market:index')?.lastPublish).toBeGreaterThanOrEqual(firstPublish ?? 0)
  })

  // ============================================================
  // updateCache
  // ============================================================
  it('updateCache 添加新数据', () => {
    useDataflowStore.getState().updateCache('market:index', { price: 3000 })
    const state = useDataflowStore.getState()
    expect(state.cache.get('market:index')).toEqual({ price: 3000 })
  })

  it('updateCache 更新已有 channel', () => {
    useDataflowStore.getState().updateCache('market:index', { price: 3000 })
    useDataflowStore.getState().updateCache('market:index', { price: 3100 })
    const state = useDataflowStore.getState()
    expect(state.cache.get('market:index')).toEqual({ price: 3100 })
  })

  // ============================================================
  // refreshStats
  // ============================================================
  it('refreshStats 重新计算 stats', () => {
    mockGetStats.mockReturnValueOnce({
      connected: true,
      channels: 10,
      subscribers: [],
      cacheEntries: 5,
      refreshTasks: 3,
    })

    useDataflowStore.getState().refreshStats()
    const state = useDataflowStore.getState()
    expect(state.stats.connected).toBe(true)
    expect(state.stats.channels).toBe(10)
  })

  // ============================================================
  // 多 channel 独立管理
  // ============================================================
  it('多 channel 独立管理', () => {
    useDataflowStore.getState().updateChannelSubscribers('ch1', 1)
    useDataflowStore.getState().updateChannelSubscribers('ch2', 2)
    useDataflowStore.getState().updateCache('ch1', { a: 1 })
    useDataflowStore.getState().updateCache('ch2', { b: 2 })

    const state = useDataflowStore.getState()
    expect(state.channels.get('ch1')?.subscribers).toBe(1)
    expect(state.channels.get('ch2')?.subscribers).toBe(2)
    expect(state.cache.get('ch1')).toEqual({ a: 1 })
    expect(state.cache.get('ch2')).toEqual({ b: 2 })
  })

  // ============================================================
  // stats 初始化
  // ============================================================
  it('stats 通过 dataFlowEngine.getStats() 初始化', () => {
    const state = useDataflowStore.getState()
    expect(mockGetStats).toHaveBeenCalled()
    expect(state.stats.subscribers).toHaveLength(2)
  })
})

// ============================================================
// initDataflowSubscriptions
// ============================================================
describe('initDataflowSubscriptions', () => {
  it('DATAFLOW_CONNECTED 事件设置 connected=true 并刷新 stats', () => {
    initDataflowSubscriptions()

    const cb = capturedEventBusCallbacks.get('DATAFLOW_CONNECTED')
    expect(cb).toBeDefined()

    mockGetStats.mockReturnValueOnce({
      connected: true,
      channels: 5,
      subscribers: [],
      cacheEntries: 3,
      refreshTasks: 2,
    })

    cb!()
    const state = useDataflowStore.getState()
    expect(state.connected).toBe(true)
    expect(state.stats.connected).toBe(true)
  })

  it('DATAFLOW_DISCONNECTED 事件设置 connected=false 并刷新 stats', () => {
    initDataflowSubscriptions()

    const cb = capturedEventBusCallbacks.get('DATAFLOW_DISCONNECTED')
    expect(cb).toBeDefined()

    mockGetStats.mockReturnValueOnce({
      connected: false,
      channels: 5,
      subscribers: [],
      cacheEntries: 3,
      refreshTasks: 2,
    })

    cb!()
    const state = useDataflowStore.getState()
    expect(state.connected).toBe(false)
    expect(state.stats.connected).toBe(false)
  })

  it('DATAFLOW_PACKET_PUBLISHED 事件更新 channel subscribers', () => {
    initDataflowSubscriptions()

    const cb = capturedEventBusCallbacks.get('DATAFLOW_PACKET_PUBLISHED')
    expect(cb).toBeDefined()

    mockGetStats.mockReturnValueOnce({
      connected: true,
      channels: 5,
      subscribers: [
        { channel: 'market:index', count: 7 },
        { channel: 'market:sector', count: 3 },
      ],
      cacheEntries: 3,
      refreshTasks: 2,
    })

    cb!({ channel: 'market:index' })
    const state = useDataflowStore.getState()
    expect(state.channels.get('market:index')?.subscribers).toBe(7)
  })

  it('DATAFLOW_PACKET_PUBLISHED 未知 channel 不报错', () => {
    initDataflowSubscriptions()

    const cb = capturedEventBusCallbacks.get('DATAFLOW_PACKET_PUBLISHED')
    expect(cb).toBeDefined()

    mockGetStats.mockReturnValueOnce({
      connected: true,
      channels: 5,
      subscribers: [
        { channel: 'other:channel', count: 2 },
      ],
      cacheEntries: 3,
      refreshTasks: 2,
    })

    // 不应该抛出错误
    expect(() => cb!({ channel: 'unknown:channel' })).not.toThrow()
    const state = useDataflowStore.getState()
    expect(state.channels.has('unknown:channel')).toBe(false)
  })

  it('多次调用时先清理旧订阅', () => {
    initDataflowSubscriptions()
    const afterFirst = unsubscribeFns.length

    // 再次调用 initDataflowSubscriptions，内部会先 destroyDataflowSubscriptions
    initDataflowSubscriptions()
    const afterSecond = unsubscribeFns.length

    // 每次 initDataflowSubscriptions 创建 3 个新订阅
    // 第一次调用后 unsubscribeFns 数量增加了 3
    // 第二次调用时先 destroy 了第一次的 3 个，然后又创建了 3 个新的
    expect(afterFirst).toBe(initialUnsubscribeCount + 3)
    expect(afterSecond).toBe(afterFirst + 3)

    // 验证第一次创建的 3 个 unsubscribe 都被调用了（通过 destroyDataflowSubscriptions）
    for (let i = initialUnsubscribeCount; i < afterFirst; i++) {
      expect(unsubscribeFns[i]).toHaveBeenCalledTimes(1)
    }
  })
})

// ============================================================
// destroyDataflowSubscriptions
// ============================================================
describe('destroyDataflowSubscriptions', () => {
  it('清理所有订阅', () => {
    initDataflowSubscriptions()
    const afterInit = unsubscribeFns.length
    expect(afterInit).toBe(initialUnsubscribeCount + 3)

    destroyDataflowSubscriptions()

    // 验证新创建的 3 个 unsubscribe 都被调用了
    for (let i = initialUnsubscribeCount; i < afterInit; i++) {
      expect(unsubscribeFns[i]).toHaveBeenCalledTimes(1)
    }
  })
})

// ============================================================
// 辅助函数
// ============================================================
describe('helpers', () => {
  it('createMockDataPacket 生成正确的结构', () => {
    const packet = createMockDataPacket({ channelId: 'test:ch', priority: 5 })
    expect(packet).toMatchObject({
      id: expect.stringMatching(/^pkt-/),
      channelId: 'test:ch',
      data: { price: 100 },
      timestamp: expect.any(Number),
      priority: 5,
    })
  })
})
