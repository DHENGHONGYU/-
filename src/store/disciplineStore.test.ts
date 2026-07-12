import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Order } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import type { TradeReviewReport, TradeError } from '@/services/trading/tradeReviewAI'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockGenerateReviewAsync = vi.hoisted(() => vi.fn())
const mockClassifyErrors = vi.hoisted(() => vi.fn())

vi.mock('@/services/trading/tradeReviewAI', () => ({
  generateReviewAsync: mockGenerateReviewAsync,
}))

vi.mock('@/services/trading/tradeErrorClassifier', () => ({
  classifyErrors: mockClassifyErrors,
}))

const mockForward = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockQuery = vi.hoisted(() => vi.fn())

const mockOrderStoreRefresh = vi.hoisted(() => vi.fn())
const mockOrderStoreOrders = vi.hoisted(() => [] as Order[])

vi.mock('./orderStore', () => ({
  useOrderStore: {
    getState: () => ({
      refresh: mockOrderStoreRefresh,
      orders: mockOrderStoreOrders,
    }),
  },
}))

const { mockSubscribe, capturedCallbacks, unsubscribes } = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, ((envelope: StandardEnvelope) => void)>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  const mockSubscribe = vi.fn((channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedCallbacks.set(channel, callback)
    const unsub = vi.fn()
    unsubscribes.push(unsub)
    return unsub
  })
  return { mockSubscribe, capturedCallbacks, unsubscribes }
})

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, forward: mockForward, query: mockQuery },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    insertOrder: 'INSERT_ORDER',
    updateOrder: 'UPDATE_ORDER',
    deleteOrder: 'DELETE_ORDER',
    tradeActionExecuted: 'TRADE_ACTION_EXECUTED',
    saveTradeReview: 'SAVE_TRADE_REVIEW',
    queryGet: 'QUERY_GET',
  },
  ENVELOPE_TARGET: { db: 'db' },
  MODULE_ID: { trading: 'trading', tradeReviews: 'tradeReviews' },
  STORE_NAME: { orders: 'orders', tradeReviews: 'trade_reviews' },
}))

// ============================================================
// Imports
// ============================================================

import { useDisciplineStore, initDisciplineStoreSubscriptions } from './disciplineStore'

// ============================================================
// Helpers
// ============================================================

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    symbol: 'AAPL',
    direction: 'buy',
    price: 100,
    quantity: 10,
    amount: 1000,
    status: 'filled',
    accountType: 'real',
    createdAt: Date.now(),
    ...overrides,
  } as Order
}

function createMockReport(): TradeReviewReport {
  return {
    generatedAt: Date.now(),
    summary: {
      totalTrades: 10,
      profitableTrades: 6,
      losingTrades: 4,
      winRate: 60,
      profitLossRatio: 1.5,
      avgProfit: 5,
      avgLoss: -3,
      totalPnL: 1000,
      totalPnLPercent: 10,
      disciplineScore: 85,
      totalErrors: 2,
    },
    errorAnalysis: {
      topErrors: [],
      errorTrend: 'stable',
      psychologicalProfile: {
        primaryType: 'chase_type',
        name: '追涨型',
        characteristics: [],
        rootCause: 'fomo',
        improvementDirection: '制定交易计划并严格执行',
      },
      riskProfile: {
        riskAppetite: 'moderate',
        maxDrawdown: 20,
        concentrationLevel: 'medium',
        suggestions: [],
      },
    },
    disciplineAnalysis: {
      planAdherenceRate: 80,
      stopLossExecutionRate: 70,
      positionManagementScore: 75,
      emotionControlScore: 65,
      overallScore: 85,
      improvements: [],
    },
    skillDevelopment: {
      currentLevel: 'intermediate',
      prioritySkills: [],
      recommendedResources: [],
      userId: 'test-user',
      dimensions: [],
      milestones: [],
      learningPath: [
        {
          order: 1,
          title: '止损纪律',
          description: '',
          resources: [],
          exercises: [],
          estimatedHours: 2,
          completed: false,
        },
        {
          order: 2,
          title: '仓位管理',
          description: '',
          resources: [],
          exercises: [],
          estimatedHours: 3,
          completed: false,
        },
      ],
      overallLevel: 'intermediate',
      updatedAt: Date.now(),
    },
    actionPlan: {
      immediate: [],
      shortTerm: [],
      longTerm: [],
    },
    aiInsight: {
      pnlAttribution: [],
      dataPatterns: [],
      personalizedAdvice: [],
    },
  }
}

function createMockClassification(errors: TradeError[] = []) {
  return {
    errors,
    totalErrors: errors.length,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0
  mockOrderStoreOrders.length = 0
  mockForward.mockResolvedValue(undefined)
  mockQuery.mockResolvedValue({ success: true, data: null })

  // 清理模块级订阅状态
  const cleanup = initDisciplineStoreSubscriptions()
  cleanup()

  useDisciplineStore.setState({
    latestReport: null,
    tradeErrors: [],
    disciplineScore: 100,
    skillRoadmap: [],
    psychologicalProfile: null,
    loading: true,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
})

// ============================================================
// useDisciplineStore
// ============================================================

describe('useDisciplineStore', () => {
  it('初始状态验证', () => {
    const state = useDisciplineStore.getState()
    expect(state.latestReport).toBeNull()
    expect(state.tradeErrors).toEqual([])
    expect(state.disciplineScore).toBe(100)
    expect(state.skillRoadmap).toEqual([])
    expect(state.psychologicalProfile).toBeNull()
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(0)
  })

  it('recalculate: 传入订单时直接计算', async () => {
    const report = createMockReport()
    mockGenerateReviewAsync.mockResolvedValue(report)
    mockClassifyErrors.mockReturnValue(createMockClassification())

    const orders = [createMockOrder()]
    await useDisciplineStore.getState().recalculate(orders)

    const state = useDisciplineStore.getState()
    expect(state.latestReport).toEqual(report)
    expect(state.disciplineScore).toBe(85)
    expect(state.skillRoadmap).toEqual(['止损纪律', '仓位管理'])
    expect(state.psychologicalProfile).not.toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBeGreaterThan(0)
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('recalculate: 未传入订单时从 orderStore 获取', async () => {
    const report = createMockReport()
    mockGenerateReviewAsync.mockResolvedValue(report)
    mockClassifyErrors.mockReturnValue(createMockClassification())

    mockOrderStoreOrders.push(createMockOrder())
    await useDisciplineStore.getState().recalculate()

    expect(mockOrderStoreRefresh).toHaveBeenCalledTimes(1)
    expect(useDisciplineStore.getState().latestReport).toEqual(report)
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('recalculate: 持久化失败应只 warn 不影响状态', async () => {
    const report = createMockReport()
    mockGenerateReviewAsync.mockResolvedValue(report)
    mockClassifyErrors.mockReturnValue(createMockClassification())
    mockForward.mockRejectedValue(new Error('Save failed'))

    await useDisciplineStore.getState().recalculate([createMockOrder()])

    const state = useDisciplineStore.getState()
    expect(state.latestReport).toEqual(report)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('recalculate: 异常时回滚到旧快照', async () => {
    const oldReport = createMockReport()
    useDisciplineStore.setState({
      latestReport: oldReport,
      disciplineScore: 70,
      skillRoadmap: ['old'],
      lastUpdated: 9999,
    })

    mockGenerateReviewAsync.mockRejectedValue(new Error('AI error'))

    await useDisciplineStore.getState().recalculate([createMockOrder()])

    const state = useDisciplineStore.getState()
    expect(state.latestReport).toEqual(oldReport)
    expect(state.disciplineScore).toBe(70)
    expect(state.skillRoadmap).toEqual(['old'])
    expect(state.error).toBe('AI error')
    expect(state.isRefreshing).toBe(false)
    expect(state.loading).toBe(false)
  })

  it('recalculate: 并发锁（isRefreshing=true 跳过）', async () => {
    useDisciplineStore.setState({ isRefreshing: true })
    await useDisciplineStore.getState().recalculate([createMockOrder()])
    expect(mockGenerateReviewAsync).not.toHaveBeenCalled()
  })

  it('recalculate: 无报告时启动 isRefreshing 并在完成后释放', async () => {
    useDisciplineStore.setState({ latestReport: null, isRefreshing: false })
    let resolveReview: (v: TradeReviewReport) => void
    const reviewPromise = new Promise<TradeReviewReport>((r) => { resolveReview = r })
    mockGenerateReviewAsync.mockReturnValue(reviewPromise)
    mockClassifyErrors.mockReturnValue(createMockClassification())

    const promise = useDisciplineStore.getState().recalculate([createMockOrder()])

    expect(useDisciplineStore.getState().isRefreshing).toBe(true)

    resolveReview!(createMockReport())
    await promise

    expect(useDisciplineStore.getState().isRefreshing).toBe(false)
    expect(useDisciplineStore.getState().loading).toBe(false)
  })

  it('refresh: 从持久化存储恢复', async () => {
    const report = createMockReport()
    mockQuery.mockResolvedValue({
      success: true,
      data: {
        id: 'latest',
        generatedAt: 12345,
        report,
        tradeErrors: [{
          type: 'stop_loss',
          name: '止损错误',
          severity: 'high',
          psychologicalRoot: 'fear',
          relatedOrderIds: [],
        } as unknown as TradeError],
        disciplineScore: 80,
        skillRoadmap: ['a', 'b'],
        psychologicalProfile: report.errorAnalysis.psychologicalProfile,
      },
    })

    await useDisciplineStore.getState().refresh()

    const state = useDisciplineStore.getState()
    expect(state.latestReport).toEqual(report)
    expect(state.disciplineScore).toBe(80)
    expect(state.skillRoadmap).toEqual(['a', 'b'])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(12345)
  })

  it('refresh: 无持久化记录时应清空 loading', async () => {
    mockQuery.mockResolvedValue({ success: true, data: null })

    await useDisciplineStore.getState().refresh()

    const state = useDisciplineStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
  })

  it('refresh: 异常时回滚到旧快照', async () => {
    const oldReport = createMockReport()
    useDisciplineStore.setState({
      latestReport: oldReport,
      disciplineScore: 70,
      lastUpdated: 9999,
    })

    mockQuery.mockResolvedValue({ success: false, error: 'DB error' })

    await useDisciplineStore.getState().refresh()

    const state = useDisciplineStore.getState()
    expect(state.latestReport).toEqual(oldReport)
    expect(state.disciplineScore).toBe(70)
    expect(state.error).toBe('DB error')
    expect(state.isRefreshing).toBe(false)
    expect(state.loading).toBe(false)
  })

  it('refresh: 并发锁（isRefreshing=true 跳过）', async () => {
    useDisciplineStore.setState({ isRefreshing: true })
    await useDisciplineStore.getState().refresh()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('reset: 重置到初始状态', () => {
    useDisciplineStore.setState({
      latestReport: createMockReport(),
      disciplineScore: 50,
      skillRoadmap: ['x'],
      error: 'err',
      isRefreshing: true,
      lastUpdated: 12345,
    })

    useDisciplineStore.getState().reset()

    const state = useDisciplineStore.getState()
    expect(state.latestReport).toBeNull()
    expect(state.tradeErrors).toEqual([])
    expect(state.disciplineScore).toBe(100)
    expect(state.skillRoadmap).toEqual([])
    expect(state.psychologicalProfile).toBeNull()
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
    expect(state.lastUpdated).toBe(0)
  })
})

// ============================================================
// initDisciplineStoreSubscriptions
// ============================================================

describe('initDisciplineStoreSubscriptions', () => {
  it('source 过滤 + action 过滤', async () => {
    const cleanup = initDisciplineStoreSubscriptions()
    const cb = capturedCallbacks.get('orders')
    expect(cb).toBeDefined()

    // trading source 应该被过滤
    cb!({
      meta: { source: 'trading' as any, target: 'db' as any, action: 'INSERT_ORDER' as any, traceId: 't1', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)

    // 不相关的 action 应该被过滤
    cb!({
      meta: { source: 'other' as any, target: 'db' as any, action: 'SAVE_SCORES' as any, traceId: 't2', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)

    await new Promise((r) => setTimeout(r, 150))

    // 有效事件应该触发
    cb!({
      meta: { source: 'other' as any, target: 'db' as any, action: 'INSERT_ORDER' as any, traceId: 't3', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)

    await new Promise((r) => setTimeout(r, 150))

    cleanup()
  })

  it('去抖 100ms', async () => {
    const cleanup = initDisciplineStoreSubscriptions()
    const cb = capturedCallbacks.get('orders')
    expect(cb).toBeDefined()

    // 连续发送 3 个有效事件
    cb!({
      meta: { source: 'other' as any, target: 'db' as any, action: 'INSERT_ORDER' as any, traceId: 't1', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)
    cb!({
      meta: { source: 'other' as any, target: 'db' as any, action: 'UPDATE_ORDER' as any, traceId: 't2', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)
    cb!({
      meta: { source: 'other' as any, target: 'db' as any, action: 'DELETE_ORDER' as any, traceId: 't3', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)

    // 50ms 内不应触发
    await new Promise((r) => setTimeout(r, 50))

    // 150ms 后应只触发一次
    await new Promise((r) => setTimeout(r, 150))

    cleanup()
  })

  it('tradeActionExecuted 也应触发', async () => {
    const cleanup = initDisciplineStoreSubscriptions()
    const cb = capturedCallbacks.get('orders')
    expect(cb).toBeDefined()

    cb!({
      meta: { source: 'other' as any, target: 'db' as any, action: 'TRADE_ACTION_EXECUTED' as any, traceId: 't1', timestamp: Date.now() },
      payload: {},
    } as StandardEnvelope)

    await new Promise((r) => setTimeout(r, 150))

    cleanup()
  })

  it('返回 cleanup 函数', () => {
    const cleanup = initDisciplineStoreSubscriptions()
    expect(typeof cleanup).toBe('function')

    cleanup()

    // 再次初始化应该能重新订阅
    const cleanup2 = initDisciplineStoreSubscriptions()
    expect(typeof cleanup2).toBe('function')
    cleanup2()
  })
})
