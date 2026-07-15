/**
 * @fileoverview 预测状态 Store
 *
 * 管理因子预测记录的创建、校验、统计与周期复盘状态。
 *
 * @module store/predictionStore
 * @created 2026-07-15 - 输出模块补强
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type {
  FactorPrediction,
  CycleRetrospectiveReport,
  FactorDashboardData,
  MarketCycle,
} from '@/types/modules/prediction.types'

const logger = getLogger()

interface PredictionState {
  predictions: FactorPrediction[]
  latestReport: CycleRetrospectiveReport | null
  dashboardData: FactorDashboardData | null
  currentCycle: MarketCycle
  loading: boolean

  addPrediction: (prediction: FactorPrediction) => void
  verifyPrediction: (predictionId: string, actualReturn: number) => void
  expirePredictions: (beforeDate: string) => void
  setLatestReport: (report: CycleRetrospectiveReport) => void
  setDashboardData: (data: FactorDashboardData) => void
  setCurrentCycle: (cycle: MarketCycle) => void
  setLoading: (loading: boolean) => void
  getPendingPredictions: () => FactorPrediction[]
  getVerifiedPredictions: () => FactorPrediction[]
  getAccuracyStats: () => {
    total: number
    verified: number
    directionHitRate: number
    rangeHitRate: number
  }
  reset: () => void
}

const initialState = {
  predictions: [] as FactorPrediction[],
  latestReport: null as CycleRetrospectiveReport | null,
  dashboardData: null as FactorDashboardData | null,
  currentCycle: 'right-up' as MarketCycle,
  loading: false,
}

export const usePredictionStore = create<PredictionState>((set, get) => ({
  ...initialState,

  addPrediction: (prediction) => {
    set((state) => ({
      predictions: [prediction, ...state.predictions].slice(0, 500),
    }))
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, {
      action: 'addPrediction',
      predictionId: prediction.predictionId,
    })
    logger.info('[predictionStore] 预测已添加', {
      predictionId: prediction.predictionId,
      symbol: prediction.symbol,
      direction: prediction.direction,
      confidence: prediction.confidence,
    })
  },

  verifyPrediction: (predictionId, actualReturn) => {
    set((state) => ({
      predictions: state.predictions.map((p) => {
        if (p.predictionId !== predictionId) return p
        const hitDirection =
          (p.direction === 'bullish' && actualReturn > 0) ||
          (p.direction === 'bearish' && actualReturn < 0) ||
          (p.direction === 'neutral' && Math.abs(actualReturn) < 3)
        const hitRange =
          actualReturn >= p.predictedReturnRange.min &&
          actualReturn <= p.predictedReturnRange.max
        return {
          ...p,
          status: 'verified' as const,
          actualReturn,
          hitDirection,
          hitRange,
          verifiedAt: new Date().toISOString(),
        }
      }),
    }))
    logger.info('[predictionStore] 预测已校验', {
      predictionId,
      actualReturn,
      hitDirection: get().predictions.find((p) => p.predictionId === predictionId)?.hitDirection,
    })
  },

  expirePredictions: (beforeDate) => {
    set((state) => ({
      predictions: state.predictions.map((p) => {
        if (p.status === 'pending' && p.generatedAt < beforeDate) {
          return { ...p, status: 'expired' as const }
        }
        return p
      }),
    }))
    logger.info('[predictionStore] 过期预测已标记', { beforeDate })
  },

  setLatestReport: (latestReport) => {
    set({ latestReport })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'setReport' })
    logger.info('[predictionStore] 复盘报告已更新', {
      period: latestReport.period,
      directionAccuracy: latestReport.directionAccuracy,
    })
  },

  setDashboardData: (dashboardData) => {
    set({ dashboardData })
  },

  setCurrentCycle: (currentCycle) => {
    set({ currentCycle })
    logger.info('[predictionStore] 市场周期已更新', { currentCycle })
  },

  setLoading: (loading) => set({ loading }),

  getPendingPredictions: () => {
    return get().predictions.filter((p) => p.status === 'pending')
  },

  getVerifiedPredictions: () => {
    return get().predictions.filter((p) => p.status === 'verified')
  },

  getAccuracyStats: () => {
    const all = get().predictions
    const verified = all.filter((p) => p.status === 'verified')
    const directionHit = verified.filter((p) => p.hitDirection).length
    const rangeHit = verified.filter((p) => p.hitRange).length
    return {
      total: all.length,
      verified: verified.length,
      directionHitRate: verified.length > 0 ? directionHit / verified.length : 0,
      rangeHitRate: verified.length > 0 ? rangeHit / verified.length : 0,
    }
  },

  reset: () => {
    set(initialState)
    logger.info('[predictionStore] 状态已重置')
  },
}))
