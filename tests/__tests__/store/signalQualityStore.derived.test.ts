import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  signalQualityStoreNormalState,
  signalQualityStoreEmptyState,
  mockSignalReviews,
  emptySignalReviews,
  mockSignalQualityMetrics,
} from '../../fixtures/store-mock-data'
import { resetCacheStats, getCacheStatsSnapshot, resetAllMemoCaches } from '@/lib/derivedCache'

/**
 * signalQualityStore.derived.ts 单元测试
 */

vi.mock('@/store/signalQualityStore', () => ({
  useSignalQualityStore: {
    getState: vi.fn(),
  },
}))

import { useSignalQualityStore } from '@/store/signalQualityStore'
import {
  hasMetrics,
  isReviewsEmpty,
  reviewsCount,
  isLoading,
  hasError,
  reviewsBySymbol,
  accuracyBySymbol,
  winRateBySymbol,
  avgReturnBySymbol,
  signalQualityGrade,
  isLowQuality,
  reviewsByDirection,
  reviewsByType,
  recentReviews,
  profitableReviews,
  losingReviews,
  averageReturn,
  averageWin,
  averageLoss,
  bestReview,
  worstReview,
  getDirectionStats,
  topSignalTypes,
  accuracyTrend,
  winRateTrend,
  directionStatsMemo,
  signalTypeStatsMemo,
} from '@/store/signalQualityStore.derived'

const mockGetState = vi.mocked(useSignalQualityStore.getState)

describe('signalQualityStore.derived.ts 派生查询单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
    mockGetState.mockReturnValue(signalQualityStoreNormalState as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
  })

  describe('基础聚合', () => {
    it('hasMetrics 应正确判断是否有指标数据', () => {
      expect(hasMetrics()).toBe(true)
      mockGetState.mockReturnValue(signalQualityStoreEmptyState as never)
      expect(hasMetrics()).toBe(false)
    })

    it('isReviewsEmpty 应正确判断空列表', () => {
      expect(isReviewsEmpty()).toBe(false)
      mockGetState.mockReturnValue(signalQualityStoreEmptyState as never)
      expect(isReviewsEmpty()).toBe(true)
    })

    it('reviewsCount 应返回复盘总数', () => {
      expect(reviewsCount()).toBe(5)
    })

    it('isLoading 应返回加载状态', () => {
      expect(isLoading()).toBe(false)
    })

    it('hasError 应正确判断是否有错误', () => {
      expect(hasError()).toBe(false)
    })
  })

  describe('按 symbol 查询指标', () => {
    it('reviewsBySymbol 应返回指定 symbol 的复盘记录', () => {
      // 000001 有 2 条复盘
      expect(reviewsBySymbol('000001')).toHaveLength(2)
      expect(reviewsBySymbol('NOTFOUND')).toHaveLength(0)
    })

    it('accuracyBySymbol 应计算准确率', () => {
      // 000001: [correct=true, correct=false] → 1/2 = 0.5
      expect(accuracyBySymbol('000001')).toBe(0.5)
      // 000002: [correct=true, correct=false] → 1/2 = 0.5
      expect(accuracyBySymbol('000002')).toBe(0.5)
      // 600519: [correct=true] → 1/1 = 1.0
      expect(accuracyBySymbol('600519')).toBe(1.0)
    })

    it('winRateBySymbol 应计算胜率', () => {
      // 000001: [pnl=5.2, pnl=-2.1] → 1/2 = 0.5
      expect(winRateBySymbol('000001')).toBe(0.5)
      // 600519: [pnl=1.8] → 1/1 = 1.0
      expect(winRateBySymbol('600519')).toBe(1.0)
    })

    it('avgReturnBySymbol 应计算平均收益', () => {
      // 000001: [5.2, -2.1] → avg = 1.55
      expect(avgReturnBySymbol('000001')).toBeCloseTo(1.55, 1)
    })

    it('signalQualityGrade 应返回质量分级', () => {
      // 600519 accuracy=1.0 → high
      expect(signalQualityGrade('600519')).toBe('high')
      // 000001 accuracy=0.5 → medium
      expect(signalQualityGrade('000001')).toBe('medium')
      // NOTFOUND → unknown
      expect(signalQualityGrade('NOTFOUND')).toBe('unknown')
    })

    it('isLowQuality 应判断是否低质量', () => {
      expect(isLowQuality('600519')).toBe(false)
      expect(isLowQuality('NOTFOUND')).toBe(false)  // unknown 不是 low
    })
  })

  describe('方向与类型筛选', () => {
    it('reviewsByDirection 应按方向筛选', () => {
      // sig-1(buy), sig-3(buy), sig-2(sell), sig-4(hold), sig-5(watch)
      expect(reviewsByDirection('buy')).toHaveLength(2)
      expect(reviewsByDirection('sell')).toHaveLength(1)
      expect(reviewsByDirection('hold')).toHaveLength(1)
      expect(reviewsByDirection('watch')).toHaveLength(1)
    })

    it('reviewsByType 应按类型筛选', () => {
      expect(reviewsByType('volume_breakthrough')).toHaveLength(2)
      expect(reviewsByType('death_cross')).toHaveLength(1)
    })

    it('recentReviews 应按时间降序', () => {
      const recent = recentReviews(3)
      expect(recent).toHaveLength(3)
      // 最新的在前（sig-5 issuedAt: now-2d）
      expect(recent[0]!.signalId).toBe('sig-5')
    })
  })

  describe('盈亏分析', () => {
    it('profitableReviews 应返回盈利复盘', () => {
      const profitable = profitableReviews()
      // sig-1(+5.2), sig-3(+3.5), sig-4(+1.8)
      expect(profitable).toHaveLength(3)
    })

    it('losingReviews 应返回亏损复盘', () => {
      const losing = losingReviews()
      // sig-2(-2.1), sig-5(-5.0)
      expect(losing).toHaveLength(2)
    })

    it('averageReturn 应计算平均收益', () => {
      // [5.2, -2.1, 3.5, 1.8, -5.0] → avg = 0.68
      expect(averageReturn()).toBeCloseTo(0.68, 1)
    })

    it('averageWin 应计算平均盈利', () => {
      // [5.2, 3.5, 1.8] → avg = 3.5
      expect(averageWin()).toBeCloseTo(3.5, 1)
    })

    it('averageLoss 应计算平均亏损', () => {
      // [-2.1, -5.0] → avg = -3.55
      expect(averageLoss()).toBeCloseTo(-3.55, 1)
    })

    it('bestReview 应返回最高收益复盘', () => {
      const best = bestReview()
      expect(best).not.toBeNull()
      expect(best!.pnlPercent).toBe(5.2)
    })

    it('worstReview 应返回最大亏损复盘', () => {
      const worst = worstReview()
      expect(worst).not.toBeNull()
      expect(worst!.pnlPercent).toBe(-5.0)
    })
  })

  describe('方向统计', () => {
    it('getDirectionStats 应返回方向统计', () => {
      const stats = getDirectionStats()
      expect(stats).toHaveLength(4)  // buy/sell/hold/watch
      const buyStat = stats.find(s => s.direction === 'buy')
      expect(buyStat?.count).toBe(2)  // sig-1, sig-3
    })

    it('topSignalTypes 应返回按数量排序的类型', () => {
      const top = topSignalTypes(3)
      expect(top.length).toBeGreaterThan(0)
      // volume_breakthrough 出现 2 次
      expect(top[0]!.type).toBe('volume_breakthrough')
      expect(top[0]!.count).toBe(2)
    })
  })

  describe('趋势分析', () => {
    it('accuracyTrend 应返回准确率趋势', () => {
      const trend = accuracyTrend(2)
      // 5 条复盘，窗口 2，应有 2 个窗口
      expect(trend.length).toBeGreaterThan(0)
    })

    it('winRateTrend 应返回胜率趋势', () => {
      const trend = winRateTrend(2)
      expect(trend.length).toBeGreaterThan(0)
    })
  })

  describe('memoizeByRef 缓存性能验证', () => {
    it('directionStats 相同引用应命中缓存', () => {
      const reviews = mockSignalReviews
      directionStatsMemo(reviews)
      directionStatsMemo(reviews)
      directionStatsMemo(reviews)

      const stats = getCacheStatsSnapshot()['directionStats']
      expect(stats!.totalCalls).toBe(3)
      expect(stats!.hits).toBe(2)
      expect(stats!.misses).toBe(1)
    })

    it('signalTypeStats 不同引用应失效缓存', () => {
      const reviews1 = mockSignalReviews
      const reviews2 = [...mockSignalReviews]

      signalTypeStatsMemo(reviews1)  // miss
      signalTypeStatsMemo(reviews1)  // hit
      signalTypeStatsMemo(reviews2)  // miss

      const stats = getCacheStatsSnapshot()['signalTypeStats']
      expect(stats!.misses).toBe(2)
      expect(stats!.hits).toBe(1)
    })
  })

  describe('边界情况', () => {
    beforeEach(() => {
      mockGetState.mockReturnValue(signalQualityStoreEmptyState as never)
    })

    it('空状态：hasMetrics 应为 false', () => {
      expect(hasMetrics()).toBe(false)
    })

    it('空状态：reviewsCount 应为 0', () => {
      expect(reviewsCount()).toBe(0)
    })

    it('空状态：reviewsBySymbol 应返回空数组', () => {
      expect(reviewsBySymbol('000001')).toEqual([])
    })

    it('空状态：accuracyBySymbol 应为 0', () => {
      expect(accuracyBySymbol('000001')).toBe(0)
    })

    it('空状态：signalQualityGrade 应为 unknown', () => {
      expect(signalQualityGrade('000001')).toBe('unknown')
    })

    it('空状态：bestReview 应为 null', () => {
      expect(bestReview()).toBeNull()
    })

    it('空状态：getDirectionStats 应返回 4 个零值', () => {
      const stats = getDirectionStats()
      expect(stats).toHaveLength(4)
      expect(stats.every(s => s.count === 0)).toBe(true)
    })
  })

  describe('循环依赖验证', () => {
    it('派生函数应能独立调用不产生循环', () => {
      expect(() => accuracyBySymbol('000001')).not.toThrow()
      expect(() => getDirectionStats()).not.toThrow()
      expect(() => topSignalTypes(5)).not.toThrow()
      expect(() => bestReview()).not.toThrow()
    })
  })
})
