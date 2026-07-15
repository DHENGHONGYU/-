/**
 * @fileoverview 输出模块补强测试
 *
 * 覆盖预测校验引擎、周期复盘、因子画板的核心功能。
 *
 * @module tests/output-module.test
 * @created 2026-07-15 - 输出模块补强
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock BroadcastChannel for jsdom
if (typeof globalThis.BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = class MockBroadcastChannel {
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    onmessage = null
  } as unknown as typeof BroadcastChannel
}

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))
import { identifyMarketCycle, generatePrediction, verifyPrediction, computeFactorICs } from '@/services/output/predictionVerifier'
import { generateRetrospectiveReport, formatReportAsMarkdown } from '@/services/output/cycleRetrospective'
import { buildDashboardData } from '@/services/output/factorDashboard'
import { usePredictionStore } from '@/store/predictionStore'
import { PredictionPanel } from '@/components/organisms/output/prediction/PredictionPanel'
import { FactorDashboardPanel } from '@/components/organisms/output/prediction/FactorDashboardPanel'
import { CycleRetrospectivePanel } from '@/components/organisms/output/prediction/CycleRetrospectivePanel'
import type { CycleMetrics, FactorPrediction } from '@/types/modules/prediction.types'

// ============================================================
// 辅助
// ============================================================

function makeCycleMetrics(overrides: Partial<CycleMetrics> = {}): CycleMetrics {
  return {
    indexMA5: 3200,
    indexMA20: 3150,
    indexMA60: 3100,
    volume20d: 500000000,
    volume60d: 400000000,
    northFlow5d: 1000000000,
    rsi14: 60,
    ...overrides,
  }
}

// ============================================================
// 预测校验引擎
// ============================================================

describe('预测校验引擎', () => {
  describe('identifyMarketCycle', () => {
    it('右侧上升：均线多头+放量+北向流入+RSI 50-70', () => {
      const result = identifyMarketCycle(makeCycleMetrics())
      expect(result.cycle).toBe('right-up')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('顶部区域：均线多头+RSI>70', () => {
      const result = identifyMarketCycle(makeCycleMetrics({ rsi14: 75 }))
      expect(result.cycle).toBe('top')
    })

    it('左侧底部：均线空头+RSI<30', () => {
      const result = identifyMarketCycle(makeCycleMetrics({
        indexMA5: 3000, indexMA20: 3100, indexMA60: 3200, rsi14: 25,
      }))
      expect(result.cycle).toBe('left-bottom')
    })
  })

  describe('generatePrediction', () => {
    it('高分应生成看涨预测', () => {
      const scores = { F3_1: 4.5, F3_2: 4.0, F3_6: 4.5, F3_7: 4.0, F1_1: 3.5 }
      const weights = { F3_1: 1.5, F3_2: 1.5, F3_6: 2.0, F3_7: 2.0, F1_1: 0.8 }
      const prediction = generatePrediction('600000', '浦发银行', scores, weights, 'right-up', '20d')
      expect(prediction.direction).toBe('bullish')
      expect(prediction.confidence).toBeGreaterThan(0.5)
      expect(prediction.predictedReturnRange.min).toBeGreaterThan(0)
      expect(prediction.status).toBe('pending')
    })

    it('低分应生成看跌预测', () => {
      const scores = { F3_1: 1.0, F3_2: 1.0, F3_6: 1.0, F1_1: 1.0 }
      const weights = { F3_1: 1.5, F3_2: 1.5, F3_6: 2.0, F1_1: 0.8 }
      const prediction = generatePrediction('600001', '测试股票', scores, weights, 'right-up')
      expect(prediction.direction).toBe('bearish')
      expect(prediction.predictedReturnRange.max).toBeLessThan(0)
    })

    it('中分应生成中性预测', () => {
      const scores = { F3_1: 2.5, F3_2: 2.5, F3_6: 2.5, F1_1: 2.5 }
      const weights = { F3_1: 1.0, F3_2: 1.0, F3_6: 1.0, F1_1: 1.0 }
      const prediction = generatePrediction('600002', '中性股票', scores, weights, 'right-up')
      expect(prediction.direction).toBe('neutral')
    })

    it('情绪因子贡献占比>30%应标记情绪主导', () => {
      const scores = { F3_6: 4.5, F3_7: 4.0, F1_1: 3.0 }
      const weights = { F3_6: 2.0, F3_7: 2.0, F1_1: 0.5 }
      const prediction = generatePrediction('600003', '情绪股', scores, weights, 'right-up')
      expect(prediction.sentimentDominant).toBe(true)
    })

    it('预测应包含驱动因子列表（最多5个）', () => {
      const scores = { F1_1: 4.0, F1_2: 3.5, F3_1: 4.0, F3_2: 3.5, F3_6: 4.0, F3_7: 3.5 }
      const weights = { F1_1: 1.0, F1_2: 1.0, F3_1: 1.5, F3_2: 1.5, F3_6: 2.0, F3_7: 2.0 }
      const prediction = generatePrediction('600004', '多因子', scores, weights, 'right-up')
      expect(prediction.drivingFactors.length).toBeLessThanOrEqual(5)
      expect(prediction.drivingFactors[0]?.factorId).toBeTruthy()
    })
  })

  describe('verifyPrediction', () => {
    it('看涨+实际正收益应方向命中', () => {
      const prediction: FactorPrediction = {
        predictionId: 'test-1', generatedAt: new Date().toISOString(),
        symbol: '600000', stockName: '测试', direction: 'bullish',
        predictedReturnRange: { min: 5, max: 15 }, timeWindow: 20, horizon: '20d',
        drivingFactors: [], confidence: 0.8, marketCycle: 'right-up', sentimentDominant: false,
        status: 'pending',
      }
      const result = verifyPrediction(prediction, 8.5)
      expect(result.hitDirection).toBe(true)
      expect(result.hitRange).toBe(true)
    })

    it('看涨+实际负收益应方向未命中', () => {
      const prediction: FactorPrediction = {
        predictionId: 'test-2', generatedAt: new Date().toISOString(),
        symbol: '600000', stockName: '测试', direction: 'bullish',
        predictedReturnRange: { min: 5, max: 15 }, timeWindow: 20, horizon: '20d',
        drivingFactors: [], confidence: 0.8, marketCycle: 'right-up', sentimentDominant: false,
        status: 'pending',
      }
      const result = verifyPrediction(prediction, -3)
      expect(result.hitDirection).toBe(false)
      expect(result.hitRange).toBe(false)
    })
  })

  describe('computeFactorICs', () => {
    it('应计算因子IC并分类有效性', () => {
      const factorScores = Array.from({ length: 20 }, (_, i) => ({
        F1_1: 2 + (i / 10),
        F3_6: 1 + (i / 5),
      }))
      const returns = Array.from({ length: 20 }, (_, i) => (i - 10) * 0.5)
      const ics = computeFactorICs(factorScores, returns)
      expect(ics.length).toBeGreaterThan(0)
      expect(ics[0]?.factorId).toBeTruthy()
      expect(ics[0]?.ic).toBeGreaterThanOrEqual(-1)
      expect(ics[0]?.ic).toBeLessThanOrEqual(1)
    })

    it('样本不足应返回空', () => {
      const ics = computeFactorICs([{ F1_1: 3 }], [1])
      expect(ics).toHaveLength(0)
    })
  })
})

// ============================================================
// 周期复盘
// ============================================================

describe('周期复盘', () => {
  it('应生成复盘报告', () => {
    const predictions: FactorPrediction[] = [
      {
        predictionId: 'p1', generatedAt: '2026-07-10T10:00:00Z',
        symbol: '600000', stockName: '浦发银行', direction: 'bullish',
        predictedReturnRange: { min: 5, max: 15 }, timeWindow: 20, horizon: '20d',
        drivingFactors: [], confidence: 0.8, marketCycle: 'right-up', sentimentDominant: true,
        status: 'verified', actualReturn: 8.5, hitDirection: true, hitRange: true,
        verifiedAt: '2026-07-30T10:00:00Z',
      },
      {
        predictionId: 'p2', generatedAt: '2026-07-11T10:00:00Z',
        symbol: '600519', stockName: '贵州茅台', direction: 'bearish',
        predictedReturnRange: { min: -10, max: -3 }, timeWindow: 20, horizon: '20d',
        drivingFactors: [], confidence: 0.7, marketCycle: 'right-up', sentimentDominant: false,
        status: 'verified', actualReturn: 2, hitDirection: false, hitRange: false,
        verifiedAt: '2026-07-31T10:00:00Z',
      },
    ]
    // 提供≥5个样本以便 computeFactorICs 能计算
    const factorScores = Array.from({ length: 6 }, (_, i) => ({ F3_6: 2 + i * 0.5 }))
    const returns = [8.5, 2, 5, -3, 7, -1]
    const weights = { F3_6: 2.0 }

    const report = generateRetrospectiveReport(predictions, 'right-up', '2026-07', factorScores, returns, weights)
    expect(report.period).toBe('2026-07')
    expect(report.marketCycle).toBe('right-up')
    expect(report.totalPredictions).toBe(2)
    expect(report.directionAccuracy).toBe(0.5) // 1/2 命中
  })

  it('应格式化为 Markdown', () => {
    const predictions: FactorPrediction[] = []
    const report = generateRetrospectiveReport(predictions, 'right-up', '2026-07', [], [], {})
    const md = formatReportAsMarkdown(report)
    expect(md).toContain('# 周期复盘报告')
    expect(md).toContain('2026-07')
    expect(md).toContain('右侧上升')
  })
})

// ============================================================
// 因子画板
// ============================================================

describe('因子画板', () => {
  it('应构建画板数据', () => {
    const factorScores = { F3_1: 4.0, F3_6: 4.5, F1_1: 3.0 }
    const weights = { F3_1: 1.5, F3_6: 2.0, F1_1: 0.8 }
    const ics = [
      { factorId: 'F3_6', factorName: 'F3_6', ic: 0.08, ir: 0.08, hitRate: 0.7, status: 'effective' as const, sampleCount: 20 },
      { factorId: 'F3_1', factorName: 'F3_1', ic: 0.03, ir: 0.03, hitRate: 0.55, status: 'weakening' as const, sampleCount: 20 },
      { factorId: 'F1_1', factorName: 'F1_1', ic: 0.001, ir: 0.001, hitRate: 0.5, status: 'ineffective' as const, sampleCount: 20 },
    ]
    const data = buildDashboardData('right-up', 0.85, factorScores, weights, ics, [])
    expect(data.marketCycle).toBe('right-up')
    expect(data.cycleConfidence).toBe(0.85)
    expect(data.activeFactors.length).toBe(3)
    expect(data.alerts.length).toBeGreaterThan(0) // F1_1 失效 + F3_1 衰减
    expect(data.alerts.some(a => a.level === 'critical')).toBe(true) // F1_1 ineffective
  })
})

// ============================================================
// predictionStore
// ============================================================

describe('predictionStore', () => {
  beforeEach(() => {
    usePredictionStore.getState().reset()
  })

  it('应添加和查询预测', () => {
    const prediction: FactorPrediction = {
      predictionId: 's1', generatedAt: new Date().toISOString(),
      symbol: '600000', stockName: '测试', direction: 'bullish',
      predictedReturnRange: { min: 5, max: 15 }, timeWindow: 20, horizon: '20d',
      drivingFactors: [], confidence: 0.8, marketCycle: 'right-up', sentimentDominant: false,
      status: 'pending',
    }
    usePredictionStore.getState().addPrediction(prediction)
    expect(usePredictionStore.getState().predictions).toHaveLength(1)
    expect(usePredictionStore.getState().getPendingPredictions()).toHaveLength(1)
  })

  it('应校验预测并更新状态', () => {
    const prediction: FactorPrediction = {
      predictionId: 's2', generatedAt: new Date().toISOString(),
      symbol: '600000', stockName: '测试', direction: 'bullish',
      predictedReturnRange: { min: 5, max: 15 }, timeWindow: 20, horizon: '20d',
      drivingFactors: [], confidence: 0.8, marketCycle: 'right-up', sentimentDominant: false,
      status: 'pending',
    }
    usePredictionStore.getState().addPrediction(prediction)
    usePredictionStore.getState().verifyPrediction('s2', 10)
    const verified = usePredictionStore.getState().getVerifiedPredictions()
    expect(verified).toHaveLength(1)
    expect(verified[0]?.hitDirection).toBe(true)
  })

  it('应计算准确率统计', () => {
    usePredictionStore.getState().addPrediction({
      predictionId: 's3', generatedAt: new Date().toISOString(),
      symbol: 'A', stockName: 'A', direction: 'bullish',
      predictedReturnRange: { min: 5, max: 15 }, timeWindow: 20, horizon: '20d',
      drivingFactors: [], confidence: 0.8, marketCycle: 'right-up', sentimentDominant: false,
      status: 'pending',
    })
    usePredictionStore.getState().verifyPrediction('s3', 8)
    const stats = usePredictionStore.getState().getAccuracyStats()
    expect(stats.total).toBe(1)
    expect(stats.verified).toBe(1)
    expect(stats.directionHitRate).toBe(1)
  })
})

// ============================================================
// UI 组件
// ============================================================

describe('UI 组件', () => {
  beforeEach(() => {
    usePredictionStore.getState().reset()
  })

  it('PredictionPanel 应渲染统计卡片', () => {
    render(<PredictionPanel />)
    expect(screen.getByText('总预测')).toBeTruthy()
    expect(screen.getByText('方向准确率')).toBeTruthy()
  })

  it('PredictionPanel 空状态应显示提示', () => {
    render(<PredictionPanel />)
    expect(screen.getByText('暂无预测记录')).toBeTruthy()
  })

  it('FactorDashboardPanel 应渲染周期状态', () => {
    render(<FactorDashboardPanel />)
    expect(screen.getByText('市场周期')).toBeTruthy()
  })

  it('CycleRetrospectivePanel 无报告应显示提示', () => {
    render(<CycleRetrospectivePanel />)
    expect(screen.getByText('暂无复盘报告')).toBeTruthy()
  })
})
