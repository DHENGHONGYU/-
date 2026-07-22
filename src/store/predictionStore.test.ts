/**
 * @test_id V9-TEST-ST-PREDICTION
 * @fileoverview predictionStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. addPrediction —— 添加预测记录
 * 3. verifyPrediction —— 校验预测（方向/区间命中）
 * 4. expirePredictions —— 标记过期
 * 5. getAccuracyStats —— 统计准确率
 * 6. getPendingPredictions / getVerifiedPredictions
 * 7. reset —— 恢复初始状态
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockWithBroadcast = vi.hoisted(() => vi.fn())
vi.mock('@/store/helpers/withBroadcast', () => ({ withBroadcast: mockWithBroadcast }))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { DATA_TEST_CHANGED: 'data-test:changed' },
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { usePredictionStore } from './predictionStore'
import type {
  FactorPrediction,
  CycleRetrospectiveReport,
  FactorDashboardData,
  MarketCycle,
} from '@/types/modules/prediction.types'

// ============================================================
// Helpers
// ============================================================

function buildTestPrediction(overrides: Partial<FactorPrediction> = {}): FactorPrediction {
  return {
    predictionId: 'pred-001',
    generatedAt: '2026-07-20T10:00:00Z',
    symbol: '600519.SH',
    stockName: '贵州茅台',
    direction: 'bullish',
    predictedReturnRange: { min: 2, max: 10 },
    timeWindow: 10,
    horizon: '10d',
    drivingFactors: [
      { factorId: 'F1', factorName: '估值因子', factorScore: 0.8, contribution: 0.4 },
    ],
    confidence: 0.75,
    marketCycle: 'right-up',
    sentimentDominant: false,
    status: 'pending',
    ...overrides,
  }
}

function buildTestReport(): CycleRetrospectiveReport {
  return {
    period: '2026-Q3-W3',
    marketCycle: 'right-up',
    totalPredictions: 10,
    directionAccuracy: 0.7,
    rangeAccuracy: 0.5,
    factorICs: [
      { factorId: 'F1', factorName: '估值因子', ic: 0.06, ir: 0.8, hitRate: 0.7, status: 'effective', sampleCount: 100 },
    ],
    cycleAdaptation: {
      'left-bottom': 0.3,
      'right-up': 0.8,
      'top': 0.5,
      'left-down': 0.2,
    },
    weightAdjustments: [],
    generatedAt: '2026-07-22T08:00:00Z',
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  usePredictionStore.setState({
    predictions: [],
    latestReport: null,
    dashboardData: null,
    currentCycle: 'right-up',
    loading: false,
  }, false)

  vi.clearAllMocks()
  mockWithBroadcast.mockReset()
})

// ============================================================
// Tests
// ============================================================

describe('usePredictionStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = usePredictionStore.getState()
      expect(state.predictions).toEqual([])
      expect(state.latestReport).toBeNull()
      expect(state.dashboardData).toBeNull()
      expect(state.currentCycle).toBe('right-up')
      expect(state.loading).toBe(false)
    })
  })

  describe('addPrediction', () => {
    it('应添加预测记录并广播事件', () => {
      const prediction = buildTestPrediction()

      usePredictionStore.getState().addPrediction(prediction)

      const state = usePredictionStore.getState()
      expect(state.predictions).toHaveLength(1)
      expect(state.predictions[0].predictionId).toBe('pred-001')
      expect(mockWithBroadcast).toHaveBeenCalledWith('data-test:changed', {
        action: 'addPrediction',
        predictionId: 'pred-001',
      })
    })

    it('应限制最多 500 条记录（先进先出截断）', () => {
      const store = usePredictionStore.getState()
      // 添加 501 条
      for (let i = 0; i < 501; i++) {
        store.addPrediction(buildTestPrediction({ predictionId: `pred-${String(i).padStart(4, '0')}` }))
      }

      expect(usePredictionStore.getState().predictions).toHaveLength(500)
      // 最新的在前面，最旧的应被截断
      expect(usePredictionStore.getState().predictions[499].predictionId).toBe('pred-0001')
    })
  })

  describe('verifyPrediction', () => {
    it('bullish 方向且 actualReturn>0 应标记 hitDirection=true', () => {
      const prediction = buildTestPrediction({ predictionId: 'pred-v1' })
      usePredictionStore.getState().addPrediction(prediction)

      usePredictionStore.getState().verifyPrediction('pred-v1', 5)

      const verified = usePredictionStore.getState().predictions.find((p) => p.predictionId === 'pred-v1')!
      expect(verified.status).toBe('verified')
      expect(verified.actualReturn).toBe(5)
      expect(verified.hitDirection).toBe(true)
      expect(verified.verifiedAt).toBeTruthy()
    })

    it('bullish 方向且 actualReturn<0 应标记 hitDirection=false', () => {
      const prediction = buildTestPrediction({ predictionId: 'pred-v2' })
      usePredictionStore.getState().addPrediction(prediction)

      usePredictionStore.getState().verifyPrediction('pred-v2', -3)

      const verified = usePredictionStore.getState().predictions.find((p) => p.predictionId === 'pred-v2')!
      expect(verified.hitDirection).toBe(false)
    })

    it('actualReturn 在 predictedReturnRange 内应标记 hitRange=true', () => {
      const prediction = buildTestPrediction({
        predictionId: 'pred-v3',
        predictedReturnRange: { min: 2, max: 10 },
      })
      usePredictionStore.getState().addPrediction(prediction)

      usePredictionStore.getState().verifyPrediction('pred-v3', 5)

      const verified = usePredictionStore.getState().predictions.find((p) => p.predictionId === 'pred-v3')!
      expect(verified.hitRange).toBe(true)
    })

    it('actualReturn 不在 predictedReturnRange 内应标记 hitRange=false', () => {
      const prediction = buildTestPrediction({
        predictionId: 'pred-v4',
        predictedReturnRange: { min: 2, max: 10 },
      })
      usePredictionStore.getState().addPrediction(prediction)

      usePredictionStore.getState().verifyPrediction('pred-v4', 1)

      const verified = usePredictionStore.getState().predictions.find((p) => p.predictionId === 'pred-v4')!
      expect(verified.hitRange).toBe(false)
    })
  })

  describe('expirePredictions', () => {
    it('应将早于指定日期的 pending 预测标记为 expired', () => {
      const oldPrediction = buildTestPrediction({
        predictionId: 'pred-old',
        generatedAt: '2026-07-01T10:00:00Z',
        status: 'pending',
      })
      const newPrediction = buildTestPrediction({
        predictionId: 'pred-new',
        generatedAt: '2026-07-20T10:00:00Z',
        status: 'pending',
      })
      usePredictionStore.getState().addPrediction(oldPrediction)
      usePredictionStore.getState().addPrediction(newPrediction)

      usePredictionStore.getState().expirePredictions('2026-07-15T00:00:00Z')

      const predictions = usePredictionStore.getState().predictions
      const old = predictions.find((p) => p.predictionId === 'pred-old')!
      const fresh = predictions.find((p) => p.predictionId === 'pred-new')!
      expect(old.status).toBe('expired')
      expect(fresh.status).toBe('pending')
    })
  })

  describe('getAccuracyStats', () => {
    it('无校验数据时应返回全零统计', () => {
      const stats = usePredictionStore.getState().getAccuracyStats()
      expect(stats).toEqual({
        total: 0,
        verified: 0,
        directionHitRate: 0,
        rangeHitRate: 0,
      })
    })

    it('有校验数据时应正确计算命中率', () => {
      const store = usePredictionStore.getState()
      const p1 = buildTestPrediction({ predictionId: 'stats-1' })
      const p2 = buildTestPrediction({ predictionId: 'stats-2', direction: 'bearish' })
      const p3 = buildTestPrediction({ predictionId: 'stats-3' })
      store.addPrediction(p1)
      store.addPrediction(p2)
      store.addPrediction(p3)

      // p1 bullish, actualReturn=5 => hitDirection=true
      // p2 bearish, actualReturn=-3 => hitDirection=true
      // p3 bullish, actualReturn=-2 => hitDirection=false
      store.verifyPrediction('stats-1', 5)
      store.verifyPrediction('stats-2', -3)
      store.verifyPrediction('stats-3', -2)

      const stats = usePredictionStore.getState().getAccuracyStats()
      expect(stats.total).toBe(3)
      expect(stats.verified).toBe(3)
      expect(stats.directionHitRate).toBeCloseTo(2 / 3)
    })
  })

  describe('getPendingPredictions / getVerifiedPredictions', () => {
    it('应正确过滤 pending 和 verified 预测', () => {
      const store = usePredictionStore.getState()
      store.addPrediction(buildTestPrediction({ predictionId: 'p-pending' }))
      const verifiedPred = buildTestPrediction({ predictionId: 'p-verified' })
      store.addPrediction(verifiedPred)
      store.verifyPrediction('p-verified', 5)

      expect(usePredictionStore.getState().getPendingPredictions()).toHaveLength(1)
      expect(usePredictionStore.getState().getPendingPredictions()[0].predictionId).toBe('p-pending')
      expect(usePredictionStore.getState().getVerifiedPredictions()).toHaveLength(1)
      expect(usePredictionStore.getState().getVerifiedPredictions()[0].predictionId).toBe('p-verified')
    })
  })

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const store = usePredictionStore.getState()
      store.addPrediction(buildTestPrediction())
      store.setLatestReport(buildTestReport())
      store.setCurrentCycle('top')
      store.setLoading(true)

      usePredictionStore.getState().reset()

      const state = usePredictionStore.getState()
      expect(state.predictions).toEqual([])
      expect(state.latestReport).toBeNull()
      expect(state.dashboardData).toBeNull()
      expect(state.currentCycle).toBe('right-up')
      expect(state.loading).toBe(false)
    })
  })
})
