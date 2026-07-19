/**
 * @test_id V9-TEST-ST-136
 * executionStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. refresh: 正常刷新成功, loading/isRefreshing 状态正确变化
 * 3. refresh: isRefreshing 锁激活时跳过
 * 4. refresh: 失败时回滚旧快照并设置 error
 * 5. createPlan: 成功创建并加入 plans/activePlans
 * 6. createPlan: 非交易信号返回 null 且不设置 error
 * 7. createPlan: UseCase 失败时设置 error
 * 8. createPlan: UseCase 异常时捕获并设置 error
 * 9. confirmPlan: plan -> confirmed 状态转换
 * 10. confirmPlan: 计划不存在时设置 error
 * 11. executePlan: buy 成功 plan -> pending -> executed
 * 12. executePlan: 下单失败时转为 cancelled
 * 13. executePlan: 异常时转为 cancelled 并设置 error
 * 14. cancelPlan: 成功取消活跃计划
 * 15. markReviewed: executed -> reviewed 转换
 *
 * @compliance
 * - beforeEach 使用 setState(..., false) 重置状态（防止 isRefreshing 锁跨测试持久化）
 * - 异步 action 测试 loading/isProcessing 状态变化
 * - try-catch 错误处理覆盖
  * @covers_docs [V9-DOC-ARCH-007, V9-DOC-BACK-015]
*/

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Signal, ExecutionPlan, Stock, Order } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockQuery = vi.hoisted(() => vi.fn())
const mockForward = vi.hoisted(() => vi.fn())

const mockWaitFor = vi.hoisted(() => vi.fn())
vi.mock('@/core/refreshCoordinator', () => ({
  refreshCoordinator: { waitFor: mockWaitFor },
}))

const mockSubscribe = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))
vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, query: mockQuery, forward: mockForward },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    insertSignal: 'INSERT_SIGNAL',
    saveExecutionPlan: 'SAVE_EXECUTION_PLAN',
    updateExecutionPhase: 'UPDATE_EXECUTION_PHASE',
    updateExecutionPlan: 'UPDATE_EXECUTION_PLAN',
    insertOrder: 'INSERT_ORDER',
    updateOrder: 'UPDATE_ORDER',
    queryGet: 'QUERY_GET',
    queryList: 'QUERY_LIST',
  },
  ENVELOPE_TARGET: { db: 'db', analyzer: 'analyzer', ui: 'ui' },
  MODULE_ID: { tradinghub: 'tradinghub' },
  STORE_NAME: {
    signals: 'signals',
    orders: 'orders',
    executionPlans: 'executionPlans',
    stocks: 'stocks',
  },
}))

const mockCreateBuyOrder = vi.hoisted(() => vi.fn())
const mockCreateSellOrder = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/tradingService', () => ({
  createBuyOrder: mockCreateBuyOrder,
  createSellOrder: mockCreateSellOrder,
}))

const mockCreateExecutionPlanUseCase = vi.hoisted(() => vi.fn())
vi.mock('@/services/useCase/createExecutionPlan.useCase', () => ({
  createExecutionPlanUseCase: mockCreateExecutionPlanUseCase,
}))

// ============================================================
// Imports
// ============================================================

import { useExecutionStore } from './executionStore'

// ============================================================
// Setup
// ============================================================

const initialState = {
  plans: [] as ExecutionPlan[],
  activePlans: [] as ExecutionPlan[],
  isProcessing: false,
  loading: true,
  error: null as string | null,
  isRefreshing: false,
  lastUpdated: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  useExecutionStore.setState({ ...initialState }, false)
})

// ============================================================
// Helpers
// ============================================================

function createSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-001',
    symbol: 'AAPL',
    direction: 'buy',
    type: 'breakthrough',
    strategy: 'momentum',
    confidence: 0.85,
    rationale: '突破前高',
    snapshot: {},
    createdAt: Date.now(),
    ...overrides,
  }
}

function createPlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
    id: 'plan-001',
    symbol: 'AAPL',
    name: 'AAPL 买入计划',
    phase: 'plan',
    direction: 'buy',
    quantity: 100,
    targetPrice: 150,
    currentPrice: 145,
    rationale: '突破信号',
    confidence: 0.85,
    riskChecks: [],
    sizing: { quantity: 100, positionPct: 0.1 },
    createdAt: Date.now(),
    ...overrides,
  }
}

function createStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 150,
    researchStatus: 'researched',
    source: 'manual',
    dataVersion: 1,
    ...overrides,
  } as Stock
}

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-001',
    status: 'filled',
    accountType: 'real',
    symbol: 'AAPL',
    direction: 'buy',
    quantity: 100,
    price: 150,
    amount: 15000,
    createdAt: Date.now(),
    ...overrides,
  } as Order
}

// ============================================================
// Tests
// ============================================================

describe('useExecutionStore', () => {
  // ---- 初始状态 ----
  it('初始状态验证', () => {
    const state = useExecutionStore.getState()
    expect(state.plans).toEqual([])
    expect(state.activePlans).toEqual([])
    expect(state.isProcessing).toBe(false)
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(0)
  })

  // ---- refresh ----
  it('refresh: 正常刷新成功, loading/isRefreshing 状态正确变化', async () => {
    let resolveList!: (value: { success: true; data: ExecutionPlan[] }) => void
    mockQuery.mockImplementationOnce(
      () => new Promise<{ success: true; data: ExecutionPlan[] }>((resolve) => { resolveList = resolve }),
    )

    const plans = [
      createPlan({ id: 'plan-001', phase: 'plan' }),
      createPlan({ id: 'plan-002', phase: 'executed' }),
    ]

    const promise = useExecutionStore.getState().refresh()

    // 中间态：isRefreshing=true, loading=true（plans 为空时 loading=true）
    expect(useExecutionStore.getState().isRefreshing).toBe(true)
    expect(useExecutionStore.getState().loading).toBe(true)

    resolveList({ success: true, data: plans })
    await promise

    // 完成态
    const state = useExecutionStore.getState()
    expect(state.plans).toHaveLength(2)
    expect(state.activePlans).toHaveLength(1) // 只含 phase='plan'
    expect(state.activePlans[0]!.id).toBe('plan-001')
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  it('refresh: isRefreshing 锁激活时跳过刷新', async () => {
    useExecutionStore.setState({ isRefreshing: true })

    await useExecutionStore.getState().refresh()

    expect(mockQuery).not.toHaveBeenCalled()
    expect(useExecutionStore.getState().isRefreshing).toBe(true)
  })

  it('refresh: 失败时回滚旧快照并设置 error', async () => {
    const oldPlans = [createPlan({ id: 'old-plan', phase: 'plan' })]
    useExecutionStore.setState({
      plans: oldPlans,
      activePlans: oldPlans,
      lastUpdated: 1000,
      loading: false,
    })
    mockQuery.mockRejectedValueOnce(new Error('DB 连接失败'))

    await useExecutionStore.getState().refresh()

    const state = useExecutionStore.getState()
    expect(state.plans).toEqual(oldPlans) // 回滚到旧快照
    expect(state.activePlans).toEqual(oldPlans)
    expect(state.lastUpdated).toBe(1000) // 回滚
    expect(state.error).toBe('DB 连接失败')
    expect(state.isRefreshing).toBe(false)
    expect(state.loading).toBe(false)
  })

  // ---- createPlan ----
  it('createPlan: 成功创建并加入 plans/activePlans', async () => {
    const signal = createSignal()
    const newPlan = createPlan({ id: 'new-plan', signalId: signal.id })
    mockCreateExecutionPlanUseCase.mockResolvedValueOnce({ success: true, plan: newPlan })

    const result = await useExecutionStore.getState().createPlan(signal)

    expect(result).not.toBeNull()
    expect(result!.id).toBe('new-plan')
    const state = useExecutionStore.getState()
    expect(state.plans).toHaveLength(1)
    expect(state.activePlans).toHaveLength(1)
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  it('createPlan: 非交易信号返回 null 且不设置 error', async () => {
    const signal = createSignal({ direction: 'hold' })
    mockCreateExecutionPlanUseCase.mockResolvedValueOnce({
      success: false,
      error: '非交易信号，不创建执行计划',
    })

    const result = await useExecutionStore.getState().createPlan(signal)

    expect(result).toBeNull()
    expect(useExecutionStore.getState().error).toBeNull()
  })

  it('createPlan: UseCase 失败时设置 error', async () => {
    const signal = createSignal()
    mockCreateExecutionPlanUseCase.mockResolvedValueOnce({
      success: false,
      error: '风控未通过：仓位超限',
    })

    const result = await useExecutionStore.getState().createPlan(signal)

    expect(result).toBeNull()
    expect(useExecutionStore.getState().error).toBe('风控未通过：仓位超限')
  })

  it('createPlan: UseCase 异常时捕获并设置 error', async () => {
    const signal = createSignal()
    mockCreateExecutionPlanUseCase.mockRejectedValueOnce(new Error('UseCase 内部异常'))

    const result = await useExecutionStore.getState().createPlan(signal)

    expect(result).toBeNull()
    expect(useExecutionStore.getState().error).toBe('UseCase 内部异常')
  })

  // ---- confirmPlan ----
  it('confirmPlan: plan -> confirmed 状态转换', async () => {
    const plan = createPlan({ phase: 'plan' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockForward.mockResolvedValueOnce(undefined)

    await useExecutionStore.getState().confirmPlan(plan.id)

    const state = useExecutionStore.getState()
    expect(state.plans[0]!.phase).toBe('confirmed')
    expect(state.plans[0]!.confirmedAt).toBeGreaterThan(0)
    expect(state.activePlans).toHaveLength(1) // confirmed 仍是活跃阶段
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('confirmPlan: 计划不存在时设置 error 且不调用 update', async () => {
    await useExecutionStore.getState().confirmPlan('not-exist-id')

    expect(useExecutionStore.getState().error).toContain('不存在')
    expect(mockForward).not.toHaveBeenCalled()
  })

  // ---- executePlan ----
  it('executePlan: buy 成功 plan -> pending -> executed', async () => {
    const plan = createPlan({ phase: 'confirmed', direction: 'buy' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockWaitFor.mockResolvedValueOnce(undefined)
    mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
    mockForward.mockResolvedValue(undefined)
    mockCreateBuyOrder.mockResolvedValueOnce({
      success: true,
      data: createOrder({ id: 'ord-exec-001' }),
    })

    await useExecutionStore.getState().executePlan(plan.id)

    const state = useExecutionStore.getState()
    const updated = state.plans[0]!
    expect(updated.phase).toBe('executed')
    expect(updated.orderId).toBe('ord-exec-001')
    expect(updated.result).toBe('success')
    expect(updated.executedAt).toBeGreaterThan(0)
    expect(state.isProcessing).toBe(false)
    expect(state.activePlans).toHaveLength(0) // executed 不再是活跃
    expect(state.lastUpdated).toBeGreaterThan(0)
    expect(mockCreateBuyOrder).toHaveBeenCalledTimes(1)
  })

  it('executePlan: 下单失败时转为 cancelled', async () => {
    const plan = createPlan({ phase: 'confirmed', direction: 'buy' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockWaitFor.mockResolvedValueOnce(undefined)
    mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
    mockForward.mockResolvedValue(undefined)
    mockCreateBuyOrder.mockResolvedValueOnce({ success: false, error: '余额不足' })

    await useExecutionStore.getState().executePlan(plan.id)

    const state = useExecutionStore.getState()
    const updated = state.plans[0]!
    expect(updated.phase).toBe('cancelled')
    expect(updated.result).toBe('failed')
    expect(updated.errorMessage).toBe('余额不足')
    expect(updated.executedAt).toBeGreaterThan(0)
    expect(state.isProcessing).toBe(false)
    expect(state.activePlans).toHaveLength(0) // cancelled 不再是活跃
  })

  it('executePlan: 异常时转为 cancelled 并设置 error', async () => {
    const plan = createPlan({ phase: 'confirmed', direction: 'buy' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockWaitFor.mockResolvedValueOnce(undefined)
    mockQuery.mockRejectedValueOnce(new Error('股票数据加载失败'))
    mockForward.mockResolvedValue(undefined)

    await useExecutionStore.getState().executePlan(plan.id)

    const state = useExecutionStore.getState()
    const updated = state.plans[0]!
    expect(updated.phase).toBe('cancelled')
    expect(updated.result).toBe('failed')
    expect(updated.errorMessage).toBe('股票数据加载失败')
    expect(state.error).toBe('股票数据加载失败')
    expect(state.isProcessing).toBe(false)
  })

  // ---- cancelPlan ----
  it('cancelPlan: 成功取消活跃计划, 默认原因 "手动取消"', async () => {
    const plan = createPlan({ phase: 'confirmed' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockForward.mockResolvedValueOnce(undefined)

    await useExecutionStore.getState().cancelPlan(plan.id)

    const state = useExecutionStore.getState()
    expect(state.plans[0]!.phase).toBe('cancelled')
    expect(state.plans[0]!.errorMessage).toBe('手动取消')
    expect(state.activePlans).toHaveLength(0)
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  // ---- markReviewed ----
  it('markReviewed: executed -> reviewed 转换', async () => {
    const plan = createPlan({ phase: 'executed' })
    useExecutionStore.setState({ plans: [plan] })
    mockForward.mockResolvedValueOnce(undefined)

    await useExecutionStore.getState().markReviewed(plan.id)

    const updated = useExecutionStore.getState().plans[0]!
    expect(updated.phase).toBe('reviewed')
    expect(updated.reviewedAt).toBeGreaterThan(0)
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  // ---- 状态机守卫（追加） ----
  it('confirmPlan: phase=confirmed 时设置 error 且不调用 update', async () => {
    const plan = createPlan({ id: 'plan-x01', phase: 'confirmed' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })

    await useExecutionStore.getState().confirmPlan('plan-x01')

    expect(useExecutionStore.getState().error).toContain('当前阶段为 confirmed')
    expect(useExecutionStore.getState().error).toContain('无法确认')
    expect(mockForward).not.toHaveBeenCalled()
  })

  it('executePlan: 计划不存在时设置 error 且不进入处理中状态', async () => {
    await useExecutionStore.getState().executePlan('not-exist-id')

    expect(useExecutionStore.getState().error).toContain('不存在')
    expect(useExecutionStore.getState().isProcessing).toBe(false)
    expect(mockForward).not.toHaveBeenCalled()
    expect(mockCreateBuyOrder).not.toHaveBeenCalled()
    expect(mockCreateSellOrder).not.toHaveBeenCalled()
  })

  it('executePlan: phase=cancelled 时设置 error 且不调用 update', async () => {
    const plan = createPlan({ id: 'plan-x02', phase: 'cancelled' })
    useExecutionStore.setState({ plans: [plan] })

    await useExecutionStore.getState().executePlan('plan-x02')

    expect(useExecutionStore.getState().error).toContain('当前阶段为 cancelled')
    expect(useExecutionStore.getState().error).toContain('无法执行')
    expect(useExecutionStore.getState().isProcessing).toBe(false)
    expect(mockForward).not.toHaveBeenCalled()
  })

  it('executePlan: 股票价格无效时转为 cancelled 并设置 errorMessage', async () => {
    const plan = createPlan({ id: 'plan-x03', phase: 'confirmed', direction: 'buy', symbol: 'BAD.SH' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockWaitFor.mockResolvedValueOnce(undefined)
    mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ symbol: 'BAD.SH', price: 0 }) })
    mockForward.mockResolvedValue(undefined)

    await useExecutionStore.getState().executePlan('plan-x03')

    const state = useExecutionStore.getState()
    const updated = state.plans[0]!
    expect(updated.phase).toBe('cancelled')
    expect(updated.result).toBe('failed')
    expect(updated.errorMessage).toContain('价格无效')
    expect(state.isProcessing).toBe(false)
  })

  it('executePlan: direction=sell 时调用 createSellOrder 而非 createBuyOrder', async () => {
    const plan = createPlan({ id: 'plan-x04', phase: 'confirmed', direction: 'sell', symbol: 'AAPL' })
    useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
    mockWaitFor.mockResolvedValueOnce(undefined)
    mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ symbol: 'AAPL', price: 150 }) })
    mockForward.mockResolvedValue(undefined)
    mockCreateSellOrder.mockResolvedValueOnce({
      success: true,
      data: createOrder({ id: 'ord-sell-001', direction: 'sell' }),
    })

    await useExecutionStore.getState().executePlan('plan-x04')

    expect(mockCreateSellOrder).toHaveBeenCalledTimes(1)
    expect(mockCreateBuyOrder).not.toHaveBeenCalled()
    expect(useExecutionStore.getState().plans[0]!.phase).toBe('executed')
  })

  it('cancelPlan: phase=executed 时跳过且不调用 update 不设置 error', async () => {
    const plan = createPlan({ id: 'plan-x05', phase: 'executed' })
    useExecutionStore.setState({ plans: [plan] })

    await useExecutionStore.getState().cancelPlan('plan-x05')

    expect(mockForward).not.toHaveBeenCalled()
    // 终态跳过仅 warn，不设置 error
    expect(useExecutionStore.getState().error).toBeNull()
    // phase 保持 executed 未被修改
    expect(useExecutionStore.getState().plans[0]!.phase).toBe('executed')
  })

  it('markReviewed: phase=plan 时跳过且不调用 update', async () => {
    const plan = createPlan({ id: 'plan-x06', phase: 'plan' })
    useExecutionStore.setState({ plans: [plan] })

    await useExecutionStore.getState().markReviewed('plan-x06')

    expect(mockForward).not.toHaveBeenCalled()
    expect(useExecutionStore.getState().plans[0]!.phase).toBe('plan')
  })

  // ============================================================
  // executePlan 行为契约测试（重构等价性验证）
  // ============================================================
  // 验证原则：只验证外部可观察行为（phase 序列、forward 调用次数、下单调用、activePlans、error）
  // 不验证内部实现细节（具体调用了哪个辅助函数），用于重构前后行为等价性验证
  // ============================================================
  describe('executePlan 行为契约（重构等价性验证）', () => {
    // ---- 契约①：phase 状态序列（confirmed -> pending -> executed） ----
    it('契约①-1: buy 成功 phase 序列 confirmed -> pending -> executed', async () => {
      const plan = createPlan({ id: 'plan-c01', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      let phaseAtQueryTime: string | null = null
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockImplementationOnce(async () => {
        // 在 query 调用时读取当前 plan 的 phase，验证已经转为 pending
        phaseAtQueryTime = useExecutionStore.getState().plans[0]!.phase
        return { success: true, data: createStock({ price: 150 }) }
      })
      mockForward.mockResolvedValue(undefined)
      mockCreateBuyOrder.mockResolvedValueOnce({
        success: true,
        data: createOrder({ id: 'ord-c01' }),
      })

      await useExecutionStore.getState().executePlan('plan-c01')

      expect(phaseAtQueryTime).toBe('pending') // 验证中间态
      expect(useExecutionStore.getState().plans[0]!.phase).toBe('executed')
    })

    it('契约①-2: sell 成功 phase 序列 confirmed -> pending -> executed', async () => {
      const plan = createPlan({ id: 'plan-c02', phase: 'confirmed', direction: 'sell' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      let phaseAtQueryTime: string | null = null
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockImplementationOnce(async () => {
        phaseAtQueryTime = useExecutionStore.getState().plans[0]!.phase
        return { success: true, data: createStock({ price: 150 }) }
      })
      mockForward.mockResolvedValue(undefined)
      mockCreateSellOrder.mockResolvedValueOnce({
        success: true,
        data: createOrder({ id: 'ord-c02', direction: 'sell' }),
      })

      await useExecutionStore.getState().executePlan('plan-c02')

      expect(phaseAtQueryTime).toBe('pending')
      expect(useExecutionStore.getState().plans[0]!.phase).toBe('executed')
    })

    // ---- 契约②：forward 调用次数 ----
    it('契约②-1: 成功时 forward 调用 2 次（pending + executed）', async () => {
      const plan = createPlan({ id: 'plan-c03', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
      mockForward.mockResolvedValue(undefined)
      mockCreateBuyOrder.mockResolvedValueOnce({
        success: true,
        data: createOrder({ id: 'ord-c03' }),
      })

      await useExecutionStore.getState().executePlan('plan-c03')

      expect(mockForward).toHaveBeenCalledTimes(2)
    })

    it('契约②-2: 下单失败时 forward 调用 2 次（pending + cancelled）', async () => {
      const plan = createPlan({ id: 'plan-c04', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
      mockForward.mockResolvedValue(undefined)
      mockCreateBuyOrder.mockResolvedValueOnce({ success: false, error: '余额不足' })

      await useExecutionStore.getState().executePlan('plan-c04')

      expect(mockForward).toHaveBeenCalledTimes(2)
    })

    // ---- 契约③：下单调用方向互斥 ----
    it('契约③-1: buy 方向仅调用 createBuyOrder', async () => {
      const plan = createPlan({ id: 'plan-c05', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
      mockForward.mockResolvedValue(undefined)
      mockCreateBuyOrder.mockResolvedValueOnce({
        success: true,
        data: createOrder({ id: 'ord-c05' }),
      })

      await useExecutionStore.getState().executePlan('plan-c05')

      expect(mockCreateBuyOrder).toHaveBeenCalledTimes(1)
      expect(mockCreateSellOrder).not.toHaveBeenCalled()
    })

    it('契约③-2: sell 方向仅调用 createSellOrder', async () => {
      const plan = createPlan({ id: 'plan-c06', phase: 'confirmed', direction: 'sell' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
      mockForward.mockResolvedValue(undefined)
      mockCreateSellOrder.mockResolvedValueOnce({
        success: true,
        data: createOrder({ id: 'ord-c06', direction: 'sell' }),
      })

      await useExecutionStore.getState().executePlan('plan-c06')

      expect(mockCreateSellOrder).toHaveBeenCalledTimes(1)
      expect(mockCreateBuyOrder).not.toHaveBeenCalled()
    })

    // ---- 契约④：activePlans 排除终态 plan ----
    it('契约④-1: 成功后 activePlans 不含 executed plan', async () => {
      const plan = createPlan({ id: 'plan-c07', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
      mockForward.mockResolvedValue(undefined)
      mockCreateBuyOrder.mockResolvedValueOnce({
        success: true,
        data: createOrder({ id: 'ord-c07' }),
      })

      await useExecutionStore.getState().executePlan('plan-c07')

      const state = useExecutionStore.getState()
      expect(state.activePlans).toHaveLength(0)
      expect(state.activePlans.find((p) => p.id === 'plan-c07')).toBeUndefined()
    })

    it('契约④-2: 下单失败后 activePlans 不含 cancelled plan', async () => {
      const plan = createPlan({ id: 'plan-c08', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 150 }) })
      mockForward.mockResolvedValue(undefined)
      mockCreateBuyOrder.mockResolvedValueOnce({ success: false, error: '余额不足' })

      await useExecutionStore.getState().executePlan('plan-c08')

      const state = useExecutionStore.getState()
      expect(state.activePlans).toHaveLength(0)
      expect(state.activePlans.find((p) => p.id === 'plan-c08')).toBeUndefined()
    })

    // ---- 契约⑤：异常分支 ----
    it('契约⑤-1: 股票查询 success=false 时转为 cancelled 且不调用下单', async () => {
      const plan = createPlan({ id: 'plan-c09', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: false, error: '查询股票失败' })
      mockForward.mockResolvedValue(undefined)

      await useExecutionStore.getState().executePlan('plan-c09')

      const state = useExecutionStore.getState()
      const updated = state.plans[0]!
      expect(updated.phase).toBe('cancelled')
      expect(updated.result).toBe('failed')
      expect(updated.errorMessage).toBe('查询股票失败')
      expect(mockCreateBuyOrder).not.toHaveBeenCalled()
      expect(mockCreateSellOrder).not.toHaveBeenCalled()
    })

    it('契约⑤-2: 股票价格为 0 时转为 cancelled 且不调用下单', async () => {
      const plan = createPlan({ id: 'plan-c10', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockResolvedValueOnce(undefined)
      mockQuery.mockResolvedValueOnce({ success: true, data: createStock({ price: 0 }) })
      mockForward.mockResolvedValue(undefined)

      await useExecutionStore.getState().executePlan('plan-c10')

      const state = useExecutionStore.getState()
      const updated = state.plans[0]!
      expect(updated.phase).toBe('cancelled')
      expect(updated.result).toBe('failed')
      expect(updated.errorMessage).toContain('价格无效')
      expect(mockCreateBuyOrder).not.toHaveBeenCalled()
      expect(mockCreateSellOrder).not.toHaveBeenCalled()
    })

    it('契约⑤-3: orderStore 等待失败时转为 cancelled 且不查询股票不下单', async () => {
      const plan = createPlan({ id: 'plan-c11', phase: 'confirmed', direction: 'buy' })
      useExecutionStore.setState({ plans: [plan], activePlans: [plan] })
      mockWaitFor.mockRejectedValueOnce(new Error('orderStore 刷新超时'))
      mockForward.mockResolvedValue(undefined)

      await useExecutionStore.getState().executePlan('plan-c11')

      const state = useExecutionStore.getState()
      const updated = state.plans[0]!
      expect(updated.phase).toBe('cancelled')
      expect(updated.result).toBe('failed')
      expect(updated.errorMessage).toBe('orderStore 刷新超时')
      expect(state.error).toBe('orderStore 刷新超时')
      // 异常发生在 waitFor，pending 未应用，仅 cancelled 调用 1 次 forward
      expect(mockForward).toHaveBeenCalledTimes(1)
      expect(mockQuery).not.toHaveBeenCalled()
      expect(mockCreateBuyOrder).not.toHaveBeenCalled()
      expect(mockCreateSellOrder).not.toHaveBeenCalled()
    })
  })
})
