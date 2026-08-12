/**
 * @test_id V9-TEST-UT-112
 * @covers_docs [V9-DOC-AI-017, V9-DOC-AI-033]
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  analysisStoreNormalState,
  analysisStoreEmptyState,
  mockScores,
  singlePointTrendData,
} from '../../fixtures/store-mock-data'
import { resetCacheStats, getCacheStatsSnapshot, resetAllMemoCaches } from '@/lib/derivedCache'

/**
 * analysisStore.derived.ts 单元测试
 *
 * 测试覆盖：
 *   1. 基础聚合派生（isLoadingAny/errorUnion/isStocksEmpty/scoresCount）
 *   2. 评分等级分布（scoreLevelDistribution）
 *   3. 缓存命中与失效（memoizeByRef 性能验证）
 *   4. 按字段查找（scoreBySymbol/stockBySymbol/stocksBySector/stocksByScoreRange/topStocks）
 *   5. 趋势分析（trendDirection/trendChangeRate/trendPeak/trendTrough）
 *   6. 边界情况（空数组、单元素、undefined）
 *   7. 循环依赖验证（确保派生之间无循环调用）
 */

// mock analysisStore 模块
vi.mock('@/store/analysisStore', () => ({
  useAnalysisStore: {
    getState: vi.fn(),
    // React Hook 形式（用于 useXxxDerived）
    subscribe: vi.fn(),
  },
}))

import { useAnalysisStore } from '@/store/analysisStore'
import {
  isLoadingAny,
  errorUnion,
  hasError,
  isStocksEmpty,
  isScoresEmpty,
  stocksCount,
  scoresCount,
  scoreLevelDistribution,
  getScoreLevelDistribution,
  scoreBySymbol,
  stockBySymbol,
  stocksBySector,
  stocksByScoreRange,
  topStocks,
  trendDirection,
  trendChangeRate,
  trendPeak,
  trendTrough,
  hasTrendData,
} from '@/store/analysisStore.derived'

const mockGetState = vi.mocked(useAnalysisStore.getState)

describe('analysisStore.derived.ts 派生查询单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
    mockGetState.mockReturnValue(analysisStoreNormalState as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：基础聚合派生
  // ═══════════════════════════════════════════════════════════

  describe('基础聚合派生', () => {
    it('isLoadingAny 应返回 loading || trendLoading', () => {
      mockGetState.mockReturnValue({ ...analysisStoreNormalState, loading: false, trendLoading: false } as never)
      expect(isLoadingAny()).toBe(false)

      mockGetState.mockReturnValue({ ...analysisStoreNormalState, loading: true, trendLoading: false } as never)
      expect(isLoadingAny()).toBe(true)

      mockGetState.mockReturnValue({ ...analysisStoreNormalState, loading: false, trendLoading: true } as never)
      expect(isLoadingAny()).toBe(true)
    })

    it('errorUnion 应优先返回主错误', () => {
      mockGetState.mockReturnValue({ ...analysisStoreNormalState, error: '主错误', trendError: null } as never)
      expect(errorUnion()).toBe('主错误')

      mockGetState.mockReturnValue({ ...analysisStoreNormalState, error: null, trendError: '趋势错误' } as never)
      expect(errorUnion()).toBe('趋势错误')

      mockGetState.mockReturnValue({ ...analysisStoreNormalState, error: '主错误', trendError: '趋势错误' } as never)
      expect(errorUnion()).toBe('主错误')

      mockGetState.mockReturnValue({ ...analysisStoreNormalState, error: null, trendError: null } as never)
      expect(errorUnion()).toBe(null)
    })

    it('hasError 应正确判断是否有错误', () => {
      mockGetState.mockReturnValue({ ...analysisStoreNormalState, error: null, trendError: null } as never)
      expect(hasError()).toBe(false)

      mockGetState.mockReturnValue({ ...analysisStoreNormalState, error: 'err', trendError: null } as never)
      expect(hasError()).toBe(true)
    })

    it('isStocksEmpty 应正确判断空列表', () => {
      expect(isStocksEmpty()).toBe(false)
      mockGetState.mockReturnValue(analysisStoreEmptyState as never)
      expect(isStocksEmpty()).toBe(true)
    })

    it('isScoresEmpty 应正确判断空列表', () => {
      expect(isScoresEmpty()).toBe(false)
      mockGetState.mockReturnValue(analysisStoreEmptyState as never)
      expect(isScoresEmpty()).toBe(true)
    })

    it('stocksCount 应返回标的总数', () => {
      expect(stocksCount()).toBe(3)
      mockGetState.mockReturnValue(analysisStoreEmptyState as never)
      expect(stocksCount()).toBe(0)
    })

    it('scoresCount 应返回评分总数', () => {
      expect(scoresCount()).toBe(3)
      mockGetState.mockReturnValue(analysisStoreEmptyState as never)
      expect(scoresCount()).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件2：评分等级分布
  // ═══════════════════════════════════════════════════════════

  describe('评分等级分布', () => {
    it('scoreLevelDistribution 应正确统计各等级数量', () => {
      const dist = scoreLevelDistribution(mockScores)
      // mockScores: [85, 65, 92] → excellent(≥80):2, good(60-79):1, average:0, poor:0, bad:0
      expect(dist.excellent).toBe(2)
      expect(dist.good).toBe(1)
      expect(dist.average).toBe(0)
      expect(dist.poor).toBe(0)
      expect(dist.bad).toBe(0)
    })

    it('scoreLevelDistribution 空数组应返回全零分布', () => {
      const dist = scoreLevelDistribution([])
      expect(dist.excellent).toBe(0)
      expect(dist.good).toBe(0)
      expect(dist.average).toBe(0)
      expect(dist.poor).toBe(0)
      expect(dist.bad).toBe(0)
    })

    it('getScoreLevelDistribution 应自动传入最新 scores', () => {
      const dist = getScoreLevelDistribution()
      expect(dist.excellent).toBe(2)
      expect(dist.good).toBe(1)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：缓存命中与失效（memoizeByRef 性能验证）
  // ═══════════════════════════════════════════════════════════

  describe('memoizeByRef 缓存性能验证', () => {
    it('相同引用应命中缓存（hits > 0）', () => {
      const scores = mockScores
      // 第一次调用：miss
      scoreLevelDistribution(scores)
      // 第二次调用：相同引用，hit
      scoreLevelDistribution(scores)
      // 第三次调用：相同引用，hit
      scoreLevelDistribution(scores)

      const stats = getCacheStatsSnapshot()['scoreLevelDistribution']
      expect(stats).toBeDefined()
      expect(stats!.totalCalls).toBe(3)
      expect(stats!.hits).toBe(2)
      expect(stats!.misses).toBe(1)
    })

    it('不同引用应失效缓存（misses 增加）', () => {
      const scores1 = mockScores
      const scores2 = [...mockScores]  // 新引用

      scoreLevelDistribution(scores1)  // miss
      scoreLevelDistribution(scores1)  // hit
      scoreLevelDistribution(scores2)  // miss（引用变化）
      scoreLevelDistribution(scores2)  // hit

      const stats = getCacheStatsSnapshot()['scoreLevelDistribution']
      expect(stats!.totalCalls).toBe(4)
      expect(stats!.hits).toBe(2)
      expect(stats!.misses).toBe(2)
    })

    it('resetCacheStats 应清空所有缓存统计', () => {
      scoreLevelDistribution(mockScores)
      expect(Object.keys(getCacheStatsSnapshot()).length).toBeGreaterThan(0)

      resetCacheStats()
      expect(Object.keys(getCacheStatsSnapshot()).length).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件4：按字段查找
  // ═══════════════════════════════════════════════════════════

  describe('按字段查找', () => {
    it('scoreBySymbol 应按 symbol 查询评分', () => {
      expect(scoreBySymbol('000001')?.score).toBe(85)
      expect(scoreBySymbol('600519')?.score).toBe(92)
      expect(scoreBySymbol('NOTFOUND')).toBeUndefined()
    })

    it('stockBySymbol 应按 symbol 查询标的', () => {
      expect(stockBySymbol('000001')?.name).toBe('平安银行')
      expect(stockBySymbol('NOTFOUND')).toBeUndefined()
    })

    it('stocksBySector 应按板块筛选标的', () => {
      const banking = stocksBySector('银行')
      expect(banking).toHaveLength(1)
      expect(banking[0]!.symbol).toBe('000001')
    })

    it('stocksByScoreRange 应按评分区间筛选', () => {
      // mockScores: 000001=85, 000002=65, 600519=92
      const highScores = stocksByScoreRange(80, 100)
      expect(highScores).toHaveLength(2)  // 000001, 600519
      const midScores = stocksByScoreRange(60, 80)
      expect(midScores).toHaveLength(1)  // 000002
    })

    it('topStocks 应返回 Top N 高分标的', () => {
      const top2 = topStocks(2)
      expect(top2).toHaveLength(2)
      // 600519(92) > 000001(85) > 000002(65)
      expect(top2[0]!.symbol).toBe('600519')
      expect(top2[1]!.symbol).toBe('000001')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件5：趋势分析
  // ═══════════════════════════════════════════════════════════

  describe('趋势分析', () => {
    it('trendDirection 应基于首尾值返回方向', () => {
      // mockTrendData: 70 → 88，明显上升
      expect(trendDirection()).toBe('up')
    })

    it('trendDirection 无数据应返回 flat', () => {
      mockGetState.mockReturnValue({ ...analysisStoreNormalState, trendData: undefined } as never)
      expect(trendDirection()).toBe('flat')
    })

    it('trendDirection 单点数据应返回 flat', () => {
      mockGetState.mockReturnValue({ ...analysisStoreNormalState, trendData: singlePointTrendData } as never)
      expect(trendDirection()).toBe('flat')
    })

    it('trendChangeRate 应计算变化率', () => {
      // 70 → 88 = +25.7%
      const rate = trendChangeRate()
      expect(rate).toBeGreaterThan(25)
      expect(rate).toBeLessThan(26)
    })

    it('trendPeak 应返回最高值', () => {
      const peak = trendPeak()
      expect(peak).not.toBeNull()
      expect(peak!.value).toBe(88)
      expect(peak!.period).toBe('2026-06')
    })

    it('trendTrough 应返回最低值', () => {
      const trough = trendTrough()
      expect(trough).not.toBeNull()
      expect(trough!.value).toBe(70)
      expect(trough!.period).toBe('2026-01')
    })

    it('hasTrendData 应正确判断是否有趋势数据', () => {
      expect(hasTrendData()).toBe(true)
      mockGetState.mockReturnValue({ ...analysisStoreNormalState, trendData: undefined } as never)
      expect(hasTrendData()).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件6：边界情况
  // ═══════════════════════════════════════════════════════════

  describe('边界情况', () => {
    beforeEach(() => {
      mockGetState.mockReturnValue(analysisStoreEmptyState as never)
    })

    it('空状态：所有聚合应返回零值', () => {
      expect(stocksCount()).toBe(0)
      expect(scoresCount()).toBe(0)
      expect(isStocksEmpty()).toBe(true)
      expect(isScoresEmpty()).toBe(true)
    })

    it('空状态：scoreBySymbol 应返回 undefined', () => {
      expect(scoreBySymbol('000001')).toBeUndefined()
    })

    it('空状态：stocksBySector 应返回空数组', () => {
      expect(stocksBySector('银行')).toEqual([])
    })

    it('空状态：topStocks 应返回空数组', () => {
      expect(topStocks(5)).toEqual([])
    })

    it('空状态：trendDirection 应返回 flat', () => {
      expect(trendDirection()).toBe('flat')
    })

    it('空状态：trendPeak 应返回 null', () => {
      expect(trendPeak()).toBeNull()
    })

    it('空状态：trendTrough 应返回 null', () => {
      expect(trendTrough()).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件7：循环依赖验证
  // ═══════════════════════════════════════════════════════════

  describe('循环依赖验证', () => {
    it('派生函数应能独立调用不产生循环', () => {
      // 所有派生函数都应能独立调用，不抛出 RangeError（stack overflow）
      expect(() => isLoadingAny()).not.toThrow()
      expect(() => errorUnion()).not.toThrow()
      expect(() => getScoreLevelDistribution()).not.toThrow()
      expect(() => scoreBySymbol('000001')).not.toThrow()
      expect(() => stocksBySector('银行')).not.toThrow()
      expect(() => topStocks(5)).not.toThrow()
      expect(() => trendDirection()).not.toThrow()
      expect(() => trendPeak()).not.toThrow()
    })

    it('多次连续调用不应导致栈溢出', () => {
      // 连续调用 100 次派生函数
      expect(() => {
        for (let i = 0; i < 100; i++) {
          getScoreLevelDistribution()
          scoreBySymbol('000001')
          trendDirection()
        }
      }).not.toThrow()
    })
  })
})
