/**
 * signalQualityStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. loadReviews 加载信号数据
 * 3. recalculateMetrics 计算质量指标
 * 4. reviewsBySymbol 派生查询
 * 5. topSignalTypes 准确率排名
 * 6. loadReviews 异常处理
 * 7. 指标计算边界情况（无已实现信号）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDataLayerSignalsList } = vi.hoisted(() => {
  const mockDataLayerSignalsList = vi.fn()
  return { mockDataLayerSignalsList }
})

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    signals: {
      list: mockDataLayerSignalsList,
    },
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { useSignalQualityStore, reviewsBySymbol, topSignalTypes } from './signalQualityStore'
import type { Signal } from '@/data/types'

function createMockSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'signal-001',
    symbol: '000001',
    direction: 'buy',
    type: 'buy_dip',
    strategy: 'test_strategy',
    confidence: 0.75,
    rationale: '测试信号',
    snapshot: {
      pePercentile: undefined,
      pbPercentile: undefined,
      priceToMA20: undefined,
      priceToMA60: undefined,
      volumeRatio: undefined,
      rsi14: undefined,
      macdDirection: 'neutral',
    },
    createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useSignalQualityStore.setState({
    metrics: null,
    reviews: [],
    loading: false,
    error: null,
    lastUpdated: 0,
  })
})

describe('signalQualityStore', () => {
  it('初始状态正确', () => {
    const state = useSignalQualityStore.getState()
    expect(state.metrics).toBeNull()
    expect(state.reviews).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadReviews 加载信号数据', async () => {
    const mockSignals = [
      createMockSignal({ id: 'signal-001', symbol: '000001' }),
      createMockSignal({ id: 'signal-002', symbol: '000002' }),
    ]
    mockDataLayerSignalsList.mockResolvedValue(mockSignals)

    await useSignalQualityStore.getState().loadReviews()

    const state = useSignalQualityStore.getState()
    expect(state.reviews).toHaveLength(2)
    expect(state.reviews[0]!.signalId).toBe('signal-001')
    expect(state.loading).toBe(false)
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  it('loadReviews 异常时设置 error', async () => {
    mockDataLayerSignalsList.mockRejectedValue(new Error('数据库错误'))

    await useSignalQualityStore.getState().loadReviews()

    const state = useSignalQualityStore.getState()
    expect(state.error).toBe('数据库错误')
    expect(state.loading).toBe(false)
  })

  it('recalculateMetrics 无已实现信号时返回零值', () => {
    useSignalQualityStore.setState({
      reviews: [
        {
          signalId: 'signal-001',
          symbol: '000001',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.75,
          issuedAt: Date.now(),
          actualReturn: undefined,
          correct: undefined,
        },
      ],
    })

    useSignalQualityStore.getState().recalculateMetrics()

    const state = useSignalQualityStore.getState()
    expect(state.metrics).toBeDefined()
    expect(state.metrics!.totalSignals).toBe(1)
    expect(state.metrics!.realizedSignals).toBe(0)
    expect(state.metrics!.accuracy).toBe(0)
  })

  it('recalculateMetrics 计算准确率和胜率', () => {
    useSignalQualityStore.setState({
      reviews: [
        {
          signalId: 'signal-001',
          symbol: '000001',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.75,
          issuedAt: Date.now(),
          actualReturn: 0.05,
          correct: true,
          holdingDays: 5,
          pnlPercent: 5,
        },
        {
          signalId: 'signal-002',
          symbol: '000002',
          direction: 'buy',
          type: 'breakout',
          confidence: 0.8,
          issuedAt: Date.now(),
          actualReturn: -0.03,
          correct: false,
          holdingDays: 3,
          pnlPercent: -3,
        },
        {
          signalId: 'signal-003',
          symbol: '000003',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.7,
          issuedAt: Date.now(),
          actualReturn: 0.08,
          correct: true,
          holdingDays: 7,
          pnlPercent: 8,
        },
      ],
    })

    useSignalQualityStore.getState().recalculateMetrics()

    const state = useSignalQualityStore.getState()
    expect(state.metrics!.totalSignals).toBe(3)
    expect(state.metrics!.realizedSignals).toBe(3)
    expect(state.metrics!.accuracy).toBeCloseTo(2 / 3)
    expect(state.metrics!.winRate).toBeCloseTo(2 / 3)
    expect(state.metrics!.avgHoldingDays).toBe(5)
  })

  it('reviewsBySymbol 按标的筛选', () => {
    useSignalQualityStore.setState({
      reviews: [
        {
          signalId: 'signal-001',
          symbol: '000001',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.75,
          issuedAt: Date.now(),
        },
        {
          signalId: 'signal-002',
          symbol: '000002',
          direction: 'buy',
          type: 'breakout',
          confidence: 0.8,
          issuedAt: Date.now(),
        },
        {
          signalId: 'signal-003',
          symbol: '000001',
          direction: 'sell',
          type: 'sell_signal',
          confidence: 0.7,
          issuedAt: Date.now(),
        },
      ],
    })

    const filtered = reviewsBySymbol('000001')
    expect(filtered).toHaveLength(2)
    expect(filtered[0]!.signalId).toBe('signal-001')
    expect(filtered[1]!.signalId).toBe('signal-003')
  })

  it('topSignalTypes 返回准确率最高的信号类型', () => {
    useSignalQualityStore.setState({
      reviews: [
        {
          signalId: 'signal-001',
          symbol: '000001',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.75,
          issuedAt: Date.now(),
          correct: true,
        },
        {
          signalId: 'signal-002',
          symbol: '000002',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.8,
          issuedAt: Date.now(),
          correct: true,
        },
        {
          signalId: 'signal-003',
          symbol: '000003',
          direction: 'buy',
          type: 'breakout',
          confidence: 0.7,
          issuedAt: Date.now(),
          correct: false,
        },
        {
          signalId: 'signal-004',
          symbol: '000004',
          direction: 'buy',
          type: 'breakout',
          confidence: 0.75,
          issuedAt: Date.now(),
          correct: true,
        },
      ],
    })

    const topTypes = topSignalTypes(2)
    expect(topTypes).toHaveLength(2)
    expect(topTypes[0]!.type).toBe('buy_dip')
    expect(topTypes[0]!.accuracy).toBe(1)
    expect(topTypes[1]!.type).toBe('breakout')
    expect(topTypes[1]!.accuracy).toBe(0.5)
  })

  it('topSignalTypes 无已实现信号时返回空数组', () => {
    useSignalQualityStore.setState({
      reviews: [
        {
          signalId: 'signal-001',
          symbol: '000001',
          direction: 'buy',
          type: 'buy_dip',
          confidence: 0.75,
          issuedAt: Date.now(),
          correct: undefined,
        },
      ],
    })

    const topTypes = topSignalTypes()
    expect(topTypes).toEqual([])
  })
})
