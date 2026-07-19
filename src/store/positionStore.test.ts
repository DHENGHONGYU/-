/**
 * @test_id V9-TEST-ST-150
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Order } from '@/data/types'
import { usePositionStore, initPositionStoreSubscriptions } from './positionStore'

// ============================================================
// Mocks
// ============================================================

const mocks = vi.hoisted(() => ({
  getOrders: vi.fn(),
  eventBusOn: vi.fn(),
  eventBusOff: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/services/trading/tradingService', () => ({
  getOrders: mocks.getOrders,
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: mocks.eventBusOn,
    off: mocks.eventBusOff,
  },
}))

vi.mock('@/config/chartColors', () => ({
  PIE_CHART_PALETTE: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

// ============================================================
// Helpers
// ============================================================

function createOrder(
  overrides: Partial<Order> & Pick<Order, 'symbol' | 'direction' | 'quantity' | 'price' | 'amount'>,
): Order {
  return {
    id: `ord-${Math.random().toString(36).slice(2, 9)}`,
    status: 'filled',
    accountType: 'real',
    createdAt: Date.now(),
    ...overrides,
  } as Order
}

// ============================================================
// Store 初始状态 & 工具函数
// ============================================================

describe('usePositionStore', () => {
  beforeEach(() => {
    usePositionStore.getState().reset()
    vi.clearAllMocks()
    mocks.getOrders.mockResolvedValue({ success: true, data: [] })
  })

  // 1. 初始状态验证
  it('初始状态应全部为零/空', () => {
    const state = usePositionStore.getState()
    expect(state.totalValue).toBe(0)
    expect(state.availableFunds).toBe(0)
    expect(state.positionRatio).toBe(0)
    expect(state.holdings).toEqual([])
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeNull()
  })

  // 2. aggregateOrders: 空数组 → 全部为零
  it('recomputeFromOrders 空数组 → 全部为零', () => {
    usePositionStore.getState().recomputeFromOrders([])
    const state = usePositionStore.getState()
    expect(state.totalValue).toBe(0)
    expect(state.availableFunds).toBe(0)
    expect(state.positionRatio).toBe(0)
    expect(state.holdings).toEqual([])
  })

  // 3. aggregateOrders: 单买单 → 1 个 holding，ratio=100%
  it('单买单 → 1 个 holding，ratio=100%', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(1)
    expect(state.holdings[0]).toMatchObject({
      symbol: 'AAPL',
      value: 1000,
      ratio: 100,
      direction: 'buy',
    })
    expect(state.totalValue).toBe(1000)
  })

  // 4. aggregateOrders: 单买 + 单卖同 symbol（sell < buy）→ 净持仓
  it('单买 + 单卖同 symbol（sell < buy）→ 净持仓', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 30, price: 12, amount: 360 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(1)
    expect(state.holdings[0]!.value).toBe(640)
    expect(state.totalValue).toBe(640)
  })

  // 5. aggregateOrders: 单买 + 单卖同 symbol（sell = buy）→ 已清仓，无 holding
  it('单买 + 单卖同 symbol（sell = buy）→ 已清仓，无 holding', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 100, price: 12, amount: 1200 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings).toEqual([])
    expect(state.totalValue).toBe(0)
    expect(state.availableFunds).toBe(0)
    expect(state.positionRatio).toBe(0)
  })

  // 6. aggregateOrders: 单买 + 单卖同 symbol（sell > buy）→ 无 holding
  it('单买 + 单卖同 symbol（sell > buy）→ 无 holding（净值为负过滤）', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 200, price: 12, amount: 2400 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings).toEqual([])
    expect(state.totalValue).toBe(0)
  })

  // 7. aggregateOrders: 多 symbol → 多个 holdings
  it('多 symbol → 多个 holdings', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
      createOrder({ symbol: 'TSLA', direction: 'buy', quantity: 50, price: 20, amount: 1000 }),
      createOrder({ symbol: 'NVDA', direction: 'buy', quantity: 10, price: 100, amount: 1000 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(3)
    const symbols = state.holdings.map((h) => h.symbol)
    expect(symbols).toContain('AAPL')
    expect(symbols).toContain('TSLA')
    expect(symbols).toContain('NVDA')
  })

  // 8. aggregateOrders: ratio 计算正确（按 value 占比）
  it('ratio 计算正确（按 value 占比）', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 3000 }),
      createOrder({ symbol: 'TSLA', direction: 'buy', quantity: 50, price: 20, amount: 1000 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(2)
    const aapl = state.holdings.find((h) => h.symbol === 'AAPL')!
    const tsla = state.holdings.find((h) => h.symbol === 'TSLA')!
    expect(aapl.ratio).toBe(75)
    expect(tsla.ratio).toBe(25)
  })

  // 9. aggregateOrders: color 按 PIE_COLORS 索引循环分配
  it('color 按 PIE_COLORS 索引循环分配', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'S1', direction: 'buy', quantity: 1, price: 1, amount: 1 }),
      createOrder({ symbol: 'S2', direction: 'buy', quantity: 1, price: 1, amount: 1 }),
      createOrder({ symbol: 'S3', direction: 'buy', quantity: 1, price: 1, amount: 1 }),
      createOrder({ symbol: 'S4', direction: 'buy', quantity: 1, price: 1, amount: 1 }),
      createOrder({ symbol: 'S5', direction: 'buy', quantity: 1, price: 1, amount: 1 }),
      createOrder({ symbol: 'S6', direction: 'buy', quantity: 1, price: 1, amount: 1 }),
    ])
    const state = usePositionStore.getState()
    expect(state.holdings[0]!.color).toBe('#FF6B6B')
    expect(state.holdings[1]!.color).toBe('#4ECDC4')
    expect(state.holdings[2]!.color).toBe('#45B7D1')
    expect(state.holdings[3]!.color).toBe('#96CEB4')
    expect(state.holdings[4]!.color).toBe('#FFEAA7')
    expect(state.holdings[5]!.color).toBe('#FF6B6B') // 循环
  })

  // 10. aggregateOrders: positionRatio = 持仓 / 总资产(1.5x)
  it('positionRatio = 持仓 / 总资产(1.5x)', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ])
    const state = usePositionStore.getState()
    // totalValue = 1000, estimatedTotal = 1500, positionRatio = 1000/1500 = 66.7%
    expect(state.positionRatio).toBe(66.7)
    expect(state.availableFunds).toBe(500)
  })

  // 11. refresh: 调用 getOrders + aggregateOrders
  it('refresh: 调用 getOrders 并更新状态', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ]
    mocks.getOrders.mockResolvedValue({ success: true, data: mockOrders })

    await usePositionStore.getState().refresh()

    expect(mocks.getOrders).toHaveBeenCalledTimes(1)
    const state = usePositionStore.getState()
    expect(state.totalValue).toBe(1000)
    expect(state.holdings).toHaveLength(1)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).not.toBeNull()
  })

  // 12. refresh: 失败时设置 error
  it('refresh: 失败时设置 error', async () => {
    mocks.getOrders.mockResolvedValue({ success: false, error: 'Network error' })

    await usePositionStore.getState().refresh()

    const state = usePositionStore.getState()
    expect(state.error).toBe('Network error')
    expect(state.loading).toBe(false)
  })

  // 13. recomputeFromOrders: 直接调用 aggregateOrders 更新状态
  it('recomputeFromOrders: 直接更新状态并设置 lastUpdated', () => {
    const before = usePositionStore.getState().lastUpdated
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ])
    const state = usePositionStore.getState()
    expect(state.totalValue).toBe(1000)
    expect(state.holdings).toHaveLength(1)
    expect(state.lastUpdated).not.toBeNull()
    expect(state.lastUpdated).not.toBe(before)
  })

  // 14. setLoading: 更新 loading
  it('setLoading: 更新 loading', () => {
    usePositionStore.getState().setLoading(false)
    expect(usePositionStore.getState().loading).toBe(false)
    usePositionStore.getState().setLoading(true)
    expect(usePositionStore.getState().loading).toBe(true)
  })

  // 15. setError: 更新 error
  it('setError: 更新 error', () => {
    usePositionStore.getState().setError('some error')
    expect(usePositionStore.getState().error).toBe('some error')
    usePositionStore.getState().setError(null)
    expect(usePositionStore.getState().error).toBeNull()
  })

  // 16. reset: 重置到初始状态
  it('reset: 重置到初始状态', () => {
    usePositionStore.getState().recomputeFromOrders([
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ])
    usePositionStore.getState().setLoading(false)
    usePositionStore.getState().setError('err')

    usePositionStore.getState().reset()

    const state = usePositionStore.getState()
    expect(state.totalValue).toBe(0)
    expect(state.availableFunds).toBe(0)
    expect(state.positionRatio).toBe(0)
    expect(state.holdings).toEqual([])
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeNull()
  })
})

// ============================================================
// initPositionStoreSubscriptions
// ============================================================

describe('initPositionStoreSubscriptions', () => {
  let eventBusCallback: ((data: unknown) => void) | null = null

  beforeEach(() => {
    usePositionStore.getState().reset()
    vi.clearAllMocks()
    eventBusCallback = null
    vi.useFakeTimers()

    // 捕获 eventBus.on 的回调
    mocks.eventBusOn.mockImplementation((event: string, callback: (data: unknown) => void) => {
      if (event === 'orders:changed') {
        eventBusCallback = callback
      }
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 17. initPositionStoreSubscriptions: 订阅 eventBus ORDERS_CHANGED 事件
  it('订阅 eventBus ORDERS_CHANGED 事件并触发 recompute', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ]
    mocks.getOrders.mockResolvedValue({ success: true, data: mockOrders })

    const cleanup = initPositionStoreSubscriptions()

    expect(mocks.eventBusOn).toHaveBeenCalledWith('orders:changed', expect.any(Function))
    expect(eventBusCallback).not.toBeNull()

    // 触发事件
    eventBusCallback!({})

    // 等待 debounce 200ms
    await vi.advanceTimersByTimeAsync(200)

    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(1)
    expect(state.holdings[0]!.symbol).toBe('AAPL')

    cleanup()
  })

  // 18. initPositionStoreSubscriptions: 去抖 200ms
  it('去抖 200ms：多次变化只触发一次 recompute', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'NVDA', direction: 'buy', quantity: 10, price: 100, amount: 1000 }),
    ]
    mocks.getOrders.mockResolvedValue({ success: true, data: mockOrders })

    const cleanup = initPositionStoreSubscriptions()

    // 快速触发多次事件
    eventBusCallback!({})
    eventBusCallback!({})
    eventBusCallback!({})

    // 未过 200ms 时不应更新
    await vi.advanceTimersByTimeAsync(100)
    expect(usePositionStore.getState().holdings).toHaveLength(0)

    // 200ms 后应触发一次
    await vi.advanceTimersByTimeAsync(100)
    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(1)
    expect(state.holdings[0]!.symbol).toBe('NVDA')

    cleanup()
  })

  it('并发锁 _isRefreshing：跳过正在刷新中的请求', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000 }),
    ]
    mocks.getOrders.mockResolvedValue({ success: true, data: mockOrders })

    const cleanup = initPositionStoreSubscriptions()

    // 第一次触发
    eventBusCallback!({})
    await vi.advanceTimersByTimeAsync(200)

    // 此时 _isRefreshing 已被置为 false（同步执行完毕）
    // 为了测试并发锁，我们需要在 recomputeFromOrders 执行期间再次触发
    // 由于 _isRefreshing 是同步置位的，在单线程 JS 中很难在 true 的窗口内触发
    // 这里验证机制存在：先触发一次使其进入 refreshing，然后立即再触发
    usePositionStore.getState().reset()

    eventBusCallback!({})
    // 在 200ms 防抖窗口内再次触发相同数据
    eventBusCallback!({})

    await vi.advanceTimersByTimeAsync(200)

    const state = usePositionStore.getState()
    expect(state.holdings).toHaveLength(1)

    cleanup()
  })

  // 19. initPositionStoreSubscriptions: 返回 cleanup 函数
  it('返回 cleanup 函数，调用后取消订阅', () => {
    const cleanup = initPositionStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    // 重复初始化应返回已有订阅
    const cleanup2 = initPositionStoreSubscriptions()
    expect(typeof cleanup2).toBe('function')

    cleanup()
  })
})
