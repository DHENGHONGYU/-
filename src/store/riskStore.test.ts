/**
 * @test_id V9-TEST-ST-151
 * riskStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. checkRisk 执行风控检查并更新三态
 * 3. checkRisk 阻塞时自动触发回路开路
 * 4. setCircuitState 手动设置回路状态
 * 5. clearVerdicts 清空裁决记录
 * 6. recentVerdicts 派生查询
 * 7. verdictsBySymbol 按标的查询
 * 8. 裁决记录上限淘汰
 * 9. checkRisk 异常处理
 * 10. loadRiskVerdicts 成功加载 + 三态推导 + broadcast
 * 11. loadRiskVerdicts 空数组回退到 normal
 * 12. loadRiskVerdicts 含 blocked/warning 推导 circuitState
 * 13. loadRiskVerdicts 失败路径
 * 14. initRiskStoreSubscriptions 幂等调用
 * 15. initRiskStoreSubscriptions 订阅回调触发
 * 16. initRiskStoreGlobalSubscriptions 幂等 + 自动加载
 * 17. destroyRiskStoreSubscriptions 清理 + 全局保护
 * 18. _resetRiskStoreSubscriptionsForTest 重置订阅状态
 * 19. 订阅 source 过滤（trading/tradinghub 跳过）
 * 20. 订阅 action 过滤（只响应相关 action）
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-DATA-046]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StandardEnvelope } from '@/core/envelope'

// ============================================================
// vi.hoisted mocks
// ============================================================

const { mockCheckOrderRisk, mockLoadRiskVerdicts, mockWithBroadcast, mockDataBridgeSubscribe, capturedOrderCallbacks, orderUnsubscribes } = vi.hoisted(() => {
  const mockCheckOrderRisk = vi.fn()
  const mockLoadRiskVerdicts = vi.fn()
  const mockWithBroadcast = vi.fn()
  const capturedOrderCallbacks = new Map<string, ((envelope: StandardEnvelope) => void)>()
  const orderUnsubscribes: Array<ReturnType<typeof vi.fn>> = []
  const mockDataBridgeSubscribe = vi.fn((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedOrderCallbacks.set(channel, callback)
    const unsub = vi.fn()
    orderUnsubscribes.push(unsub)
    return unsub
  })
  return { mockCheckOrderRisk, mockLoadRiskVerdicts, mockWithBroadcast, mockDataBridgeSubscribe, capturedOrderCallbacks, orderUnsubscribes }
})

vi.mock('@/services/trading/riskEngine', () => ({
  checkOrderRisk: mockCheckOrderRisk,
}))

vi.mock('@/services/riskControlService', () => ({
  loadRiskVerdicts: mockLoadRiskVerdicts,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockDataBridgeSubscribe },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: mockWithBroadcast,
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: { insertOrder: 'INSERT_ORDER', updateOrder: 'UPDATE_ORDER' },
  MODULE_ID: { trading: 'trading', tradinghub: 'tradinghub' },
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { RISK_CHANGED: 'RISK_CHANGED' },
}))

// ============================================================
// Imports
// ============================================================

import { useRiskStore, recentVerdicts, verdictsBySymbol, initRiskStoreSubscriptions, initRiskStoreGlobalSubscriptions, _resetRiskStoreSubscriptionsForTest } from './riskStore'
import type { OrderRiskInput } from '@/services/trading/riskEngine'

// ============================================================
// Helpers
// ============================================================

function createMockInput(overrides: Partial<OrderRiskInput> = {}): OrderRiskInput {
  return {
    symbol: '000001',
    direction: 'buy',
    quantity: 100,
    price: 10,
    portfolioValue: 100000,
    ...overrides,
  }
}

function createMockVerdict(symbol: string, triState: 'normal' | 'warning' | 'blocked' = 'normal', ts = 1000) {
  return {
    id: `v-${symbol}`,
    timestamp: ts,
    symbol,
    direction: 'buy' as const,
    input: createMockInput({ symbol }),
    result: {
      ok: triState === 'normal',
      warnings: triState === 'warning' ? ['w'] : [],
      blocks: triState === 'blocked' ? ['b'] : [],
    },
    triState,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedOrderCallbacks.clear()
  orderUnsubscribes.length = 0

  // 重新设置 mockSubscribe 实现（clearAllMocks 会清除实现）
  mockDataBridgeSubscribe.mockImplementation((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedOrderCallbacks.set(channel, callback)
    const unsub = vi.fn()
    orderUnsubscribes.push(unsub)
    return unsub
  })

  // 清理模块级订阅状态
  _resetRiskStoreSubscriptionsForTest()

  useRiskStore.setState({
    triState: 'normal',
    circuitState: 'closed',
    verdicts: [],
    loading: false,
    error: null,
    lastChecked: 0,
  })
})

// ============================================================
// 基础 Store 测试
// ============================================================

describe('riskStore', () => {
  it('初始状态正确', () => {
    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.circuitState).toBe('closed')
    expect(state.verdicts).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('checkRisk 正常通过 → triState=normal', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    const input = createMockInput()
    const result = await useRiskStore.getState().checkRisk(input)

    expect(result.ok).toBe(true)
    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.verdicts).toHaveLength(1)
    expect(state.verdicts[0]!.triState).toBe('normal')
    expect(state.loading).toBe(false)
  })

  it('checkRisk 有警告 → triState=warning', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: ['仓位接近上限'], blocks: [] })
    const input = createMockInput()
    await useRiskStore.getState().checkRisk(input)

    const state = useRiskStore.getState()
    expect(state.triState).toBe('warning')
    expect(state.verdicts[0]!.triState).toBe('warning')
  })

  it('checkRisk 有阻塞 → triState=blocked，回路切换为 open', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: false, warnings: [], blocks: ['价格或数量非法'] })
    const input = createMockInput()
    await useRiskStore.getState().checkRisk(input)

    const state = useRiskStore.getState()
    expect(state.triState).toBe('blocked')
    expect(state.circuitState).toBe('open')
  })

  it('checkRisk 异常时返回 fallback 结果', async () => {
    mockCheckOrderRisk.mockRejectedValue(new Error('网络超时'))
    const input = createMockInput()
    const result = await useRiskStore.getState().checkRisk(input)

    expect(result.ok).toBe(false)
    expect(result.blocks).toContain('网络超时')
    const state = useRiskStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('网络超时')
  })

  it('setCircuitState 手动设置回路状态', () => {
    useRiskStore.getState().setCircuitState('half-open')
    expect(useRiskStore.getState().circuitState).toBe('half-open')
  })

  it('clearVerdicts 清空裁决记录', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    await useRiskStore.getState().checkRisk(createMockInput())
    expect(useRiskStore.getState().verdicts).toHaveLength(1)

    useRiskStore.getState().clearVerdicts()
    expect(useRiskStore.getState().verdicts).toHaveLength(0)
  })

  it('reset 将所有关键状态字段重置为初始值', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: false, warnings: [], blocks: ['测试阻塞'] })
    await useRiskStore.getState().checkRisk(createMockInput())
    useRiskStore.getState().setCircuitState('half-open')

    expect(useRiskStore.getState().triState).toBe('blocked')
    expect(useRiskStore.getState().circuitState).toBe('half-open')
    expect(useRiskStore.getState().verdicts).toHaveLength(1)
    expect(useRiskStore.getState().loading).toBe(false)
    expect(useRiskStore.getState().error).toBeNull()
    expect(useRiskStore.getState().lastChecked).toBeGreaterThan(0)

    useRiskStore.getState().reset()

    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.circuitState).toBe('closed')
    expect(state.verdicts).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastChecked).toBe(0)
  })

  it('recentVerdicts 返回最近 N 条', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000001' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000002' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000003' }))

    const recent = recentVerdicts(2)
    expect(recent).toHaveLength(2)
    expect(recent[0]!.symbol).toBe('000003')
  })

  it('verdictsBySymbol 按标的筛选', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000001' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000002' }))
    await useRiskStore.getState().checkRisk(createMockInput({ symbol: '000001' }))

    const filtered = verdictsBySymbol('000001')
    expect(filtered).toHaveLength(2)
  })

  it('裁决记录超过上限时淘汰最早的', async () => {
    mockCheckOrderRisk.mockResolvedValue({ ok: true, warnings: [], blocks: [] })
    for (let i = 0; i < 55; i++) {
      await useRiskStore.getState().checkRisk(createMockInput({ symbol: `SYM-${i}` }))
    }
    expect(useRiskStore.getState().verdicts).toHaveLength(50)
    expect(useRiskStore.getState().verdicts[0]!.symbol).toBe('SYM-54')
  })
})

// ============================================================
// loadRiskVerdicts
// ============================================================

describe('loadRiskVerdicts', () => {
  /** @test_id V9-TEST-ST-151-load-01 */
  it('成功加载裁决记录 → 更新 verdicts / triState / lastChecked + broadcast', async () => {
    const verdicts = [
      createMockVerdict('000001', 'normal', 1000),
      createMockVerdict('000002', 'warning', 2000),
    ]
    mockLoadRiskVerdicts.mockResolvedValue(verdicts)

    await useRiskStore.getState().loadRiskVerdicts()

    const state = useRiskStore.getState()
    expect(state.verdicts).toEqual(verdicts)
    // latest 为第一条 → triState=normal
    expect(state.triState).toBe('normal')
    expect(state.lastChecked).toBe(1000)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()

    // 验证 broadcast 被调用
    expect(mockWithBroadcast).toHaveBeenCalledWith('RISK_CHANGED', {
      action: 'loadRiskVerdicts',
      count: 2,
      triState: 'normal',
      circuitState: expect.any(String),
    })
  })

  /** @test_id V9-TEST-ST-151-load-02 */
  it('空数组回退到 triState=normal / circuitState=closed', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])

    await useRiskStore.getState().loadRiskVerdicts()

    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.circuitState).toBe('closed')
    expect(state.verdicts).toEqual([])
    // lastChecked 应为 Date.now()（非 0）
    expect(state.lastChecked).toBeGreaterThan(0)
  })

  /** @test_id V9-TEST-ST-151-load-03 */
  it('含 blocked 记录 → circuitState=open', async () => {
    const verdicts = [
      createMockVerdict('000001', 'normal', 2000),
      createMockVerdict('000002', 'blocked', 1000),
    ]
    mockLoadRiskVerdicts.mockResolvedValue(verdicts)

    await useRiskStore.getState().loadRiskVerdicts()

    const state = useRiskStore.getState()
    // latest 为第一条 000001(normal) → triState=normal
    expect(state.triState).toBe('normal')
    // 但有 blocked 记录 → circuitState=open
    expect(state.circuitState).toBe('open')
  })

  /** @test_id V9-TEST-ST-151-load-04 */
  it('含 warning（无 blocked）→ circuitState=half-open', async () => {
    const verdicts = [
      createMockVerdict('000001', 'warning', 1000),
      createMockVerdict('000002', 'normal', 2000),
    ]
    mockLoadRiskVerdicts.mockResolvedValue(verdicts)

    await useRiskStore.getState().loadRiskVerdicts()

    const state = useRiskStore.getState()
    expect(state.circuitState).toBe('half-open')
  })

  /** @test_id V9-TEST-ST-151-load-05 */
  it('失败路径 → 设置 error + loading=false', async () => {
    mockLoadRiskVerdicts.mockRejectedValue(new Error('DB 连接失败'))

    await useRiskStore.getState().loadRiskVerdicts()

    const state = useRiskStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('DB 连接失败')
    // verdicts 不变
    expect(state.verdicts).toEqual([])
  })

  /** @test_id V9-TEST-ST-151-load-06 */
  it('非 Error 类型异常 → error 为字符串化结果', async () => {
    mockLoadRiskVerdicts.mockRejectedValue('字符串错误')

    await useRiskStore.getState().loadRiskVerdicts()

    expect(useRiskStore.getState().error).toBe('字符串错误')
  })

  /** @test_id V9-TEST-ST-151-load-07 */
  it('latest 为 warning → triState=warning', async () => {
    const verdicts = [
      createMockVerdict('000001', 'warning', 3000),
      createMockVerdict('000002', 'normal', 2000),
    ]
    mockLoadRiskVerdicts.mockResolvedValue(verdicts)

    await useRiskStore.getState().loadRiskVerdicts()

    expect(useRiskStore.getState().triState).toBe('warning')
    expect(useRiskStore.getState().lastChecked).toBe(3000)
  })
})

// ============================================================
// initRiskStoreSubscriptions（组件级）
// ============================================================

describe('initRiskStoreSubscriptions', () => {
  /** @test_id V9-TEST-ST-151-sub-01 */
  it('首次调用 → 注册 orders 频道订阅', () => {
    const cleanup = initRiskStoreSubscriptions()

    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)
    expect(mockDataBridgeSubscribe).toHaveBeenCalledWith('orders', expect.any(Function))
    expect(typeof cleanup).toBe('function')

    // 清理
    cleanup()
  })

  /** @test_id V9-TEST-ST-151-sub-02 */
  it('重复调用 → 幂等，返回 cleanup 函数', () => {
    initRiskStoreSubscriptions()
    const cleanup2 = initRiskStoreSubscriptions()

    // 只注册一次
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)
    expect(typeof cleanup2).toBe('function')

    // cleanup2 调用后应能重新初始化
    cleanup2()
  })

  /** @test_id V9-TEST-ST-151-sub-03 */
  it('cleanup 调用后可重新初始化', () => {
    const cleanup1 = initRiskStoreSubscriptions()
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)

    cleanup1()

    // 重置后应能重新注册
    _resetRiskStoreSubscriptionsForTest()
    const cleanup2 = initRiskStoreSubscriptions()
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(2)
    cleanup2()
  })

  /** @test_id V9-TEST-ST-151-sub-04 */
  it('orders 频道回调：trading source 被过滤', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])
    initRiskStoreSubscriptions()

    const ordersCb = capturedOrderCallbacks.get('orders')!
    ordersCb({
      meta: { source: 'trading', target: 'db', action: 'INSERT_ORDER', traceId: 't1', timestamp: Date.now() },
      payload: {},
    })

    // 等待微任务
    await vi.waitFor(() => expect(mockLoadRiskVerdicts).not.toHaveBeenCalled(), { timeout: 100 })
  })

  /** @test_id V9-TEST-ST-151-sub-05 */
  it('orders 频道回调：tradinghub source 被过滤', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])
    initRiskStoreSubscriptions()

    const ordersCb = capturedOrderCallbacks.get('orders')!
    ordersCb({
      meta: { source: 'tradinghub', target: 'db', action: 'INSERT_ORDER', traceId: 't2', timestamp: Date.now() },
      payload: {},
    })

    await vi.waitFor(() => expect(mockLoadRiskVerdicts).not.toHaveBeenCalled(), { timeout: 100 })
  })

  /** @test_id V9-TEST-ST-151-sub-06 */
  it('orders 频道回调：外部 source + INSERT_ORDER 触发 loadRiskVerdicts', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])
    initRiskStoreSubscriptions()

    const ordersCb = capturedOrderCallbacks.get('orders')!
    ordersCb({
      meta: { source: 'analyzer', target: 'db', action: 'INSERT_ORDER', traceId: 't3', timestamp: Date.now() },
      payload: {},
    })

    await vi.waitFor(() => expect(mockLoadRiskVerdicts).toHaveBeenCalled(), { timeout: 1000 })
  })

  /** @test_id V9-TEST-ST-151-sub-07 */
  it('orders 频道回调：外部 source + UPDATE_ORDER 触发 loadRiskVerdicts', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])
    initRiskStoreSubscriptions()

    const ordersCb = capturedOrderCallbacks.get('orders')!
    ordersCb({
      meta: { source: 'analyzer', target: 'db', action: 'UPDATE_ORDER', traceId: 't4', timestamp: Date.now() },
      payload: {},
    })

    await vi.waitFor(() => expect(mockLoadRiskVerdicts).toHaveBeenCalled(), { timeout: 1000 })
  })

  /** @test_id V9-TEST-ST-151-sub-08 */
  it('orders 频道回调：不相关的 action 不触发', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])
    initRiskStoreSubscriptions()

    const ordersCb = capturedOrderCallbacks.get('orders')!
    ordersCb({
      meta: { source: 'analyzer', target: 'db', action: 'DELETE_ORDER', traceId: 't5', timestamp: Date.now() },
      payload: {},
    })

    await vi.waitFor(() => expect(mockLoadRiskVerdicts).not.toHaveBeenCalled(), { timeout: 100 })
  })
})

// ============================================================
// initRiskStoreGlobalSubscriptions（全局级）
// ============================================================

describe('initRiskStoreGlobalSubscriptions', () => {
  /** @test_id V9-TEST-ST-151-global-01 */
  it('首次调用 → 注册订阅 + 自动加载裁决记录', async () => {
    mockLoadRiskVerdicts.mockResolvedValue([])

    initRiskStoreGlobalSubscriptions()

    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)
    expect(mockDataBridgeSubscribe).toHaveBeenCalledWith('orders', expect.any(Function))

    // 等待自动加载
    await vi.waitFor(() => expect(mockLoadRiskVerdicts).toHaveBeenCalled(), { timeout: 1000 })
  })

  /** @test_id V9-TEST-ST-151-global-02 */
  it('重复调用 → 幂等跳过', () => {
    mockLoadRiskVerdicts.mockResolvedValue([])

    initRiskStoreGlobalSubscriptions()
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)

    initRiskStoreGlobalSubscriptions()
    // 仍然只注册了一次
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)
  })

  /** @test_id V9-TEST-ST-151-global-03 */
  it('全局订阅已初始化时，组件级 destroy 不清理', () => {
    mockLoadRiskVerdicts.mockResolvedValue([])

    initRiskStoreGlobalSubscriptions()
    const unsub = orderUnsubscribes[0]

    // 组件级 cleanup 调用 destroy → 全局标记保护，不调用 unsub
    const cleanup = initRiskStoreSubscriptions()
    cleanup()

    // unsub 不应被调用（全局保护）
    expect(unsub).not.toHaveBeenCalled()
  })
})

// ============================================================
// destroyRiskStoreSubscriptions
// ============================================================

describe('destroyRiskStoreSubscriptions（通过 cleanup 间接触发）', () => {
  /** @test_id V9-TEST-ST-151-destroy-01 */
  it('组件级 cleanup 调用后取消订阅', () => {
    initRiskStoreSubscriptions()
    const unsub = orderUnsubscribes[0]

    // cleanup → destroyRiskStoreSubscriptions
    const cleanup = initRiskStoreSubscriptions()
    cleanup()

    expect(unsub).toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-151-destroy-02 */
  it('全局初始化后，组件级 cleanup 不取消订阅', () => {
    mockLoadRiskVerdicts.mockResolvedValue([])
    initRiskStoreGlobalSubscriptions()
    const unsub = orderUnsubscribes[0]

    // 组件调用 init → 获得幂等返回的 cleanup
    const cleanup = initRiskStoreSubscriptions()
    cleanup()

    // 全局标记保护 → unsub 不应被调用
    expect(unsub).not.toHaveBeenCalled()
  })
})

// ============================================================
// _resetRiskStoreSubscriptionsForTest
// ============================================================

describe('_resetRiskStoreSubscriptionsForTest', () => {
  /** @test_id V9-TEST-ST-151-reset-01 */
  it('重置所有订阅状态和 store 状态', () => {
    initRiskStoreSubscriptions()
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)

    _resetRiskStoreSubscriptionsForTest()

    const state = useRiskStore.getState()
    expect(state.triState).toBe('normal')
    expect(state.circuitState).toBe('closed')
    expect(state.verdicts).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastChecked).toBe(0)
  })
})
