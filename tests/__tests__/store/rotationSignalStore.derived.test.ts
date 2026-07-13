import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  rotationSignalStoreNormalState,
  mockRotationSignals,
  emptyRotationSignals,
} from '../../fixtures/store-mock-data'
import { resetCacheStats, getCacheStatsSnapshot, resetAllMemoCaches } from '@/lib/derivedCache'

/**
 * rotationSignalStore.derived.ts 单元测试
 */

vi.mock('@/store/rotationSignalStore', () => ({
  useRotationSignalStore: {
    getState: vi.fn(),
  },
}))

import { useRotationSignalStore } from '@/store/rotationSignalStore'
import {
  isSignalsEmpty,
  signalsCount,
  isLoading,
  hasError,
  triggeredSignals,
  signalsByStrength,
  strongSignals,
  mediumSignals,
  weakSignals,
  bySector,
  strengthDistribution,
  getStrengthDistribution,
  triggeredCount,
  triggeredRate,
  hasAnyTriggered,
  latestSignals,
  recentTriggered,
  getSectorStats,
  isHotSector,
  hotSectors,
  signalConditions,
  sectorStatsMemo,
} from '@/store/rotationSignalStore.derived'

const mockGetState = vi.mocked(useRotationSignalStore.getState)

describe('rotationSignalStore.derived.ts 派生查询单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
    mockGetState.mockReturnValue(rotationSignalStoreNormalState as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
  })

  describe('基础聚合派生', () => {
    it('isSignalsEmpty 应正确判断空列表', () => {
      expect(isSignalsEmpty()).toBe(false)
      mockGetState.mockReturnValue({ ...rotationSignalStoreNormalState, signals: emptyRotationSignals } as never)
      expect(isSignalsEmpty()).toBe(true)
    })

    it('signalsCount 应返回信号总数', () => {
      expect(signalsCount()).toBe(4)
    })

    it('isLoading 应返回加载状态', () => {
      expect(isLoading()).toBe(false)
      mockGetState.mockReturnValue({ ...rotationSignalStoreNormalState, loading: true } as never)
      expect(isLoading()).toBe(true)
    })

    it('hasError 应正确判断是否有错误', () => {
      expect(hasError()).toBe(false)
      mockGetState.mockReturnValue({ ...rotationSignalStoreNormalState, error: 'err' } as never)
      expect(hasError()).toBe(true)
    })
  })

  describe('信号筛选', () => {
    it('triggeredSignals 应返回已触发信号', () => {
      const triggered = triggeredSignals()
      expect(triggered).toHaveLength(3)  // banking/steel/coal
      expect(triggered.every(s => s.triggered)).toBe(true)
    })

    it('signalsByStrength 应按强度筛选', () => {
      expect(signalsByStrength('strong')).toHaveLength(1)  // banking
      expect(signalsByStrength('medium')).toHaveLength(1)  // steel
      expect(signalsByStrength('weak')).toHaveLength(1)   // coal
    })

    it('strongSignals/mediumSignals/weakSignals 应快捷访问', () => {
      expect(strongSignals()).toHaveLength(1)
      expect(mediumSignals()).toHaveLength(1)
      expect(weakSignals()).toHaveLength(1)
    })

    it('bySector 应按板块查询信号', () => {
      expect(bySector('banking')?.sectorId).toBe('banking')
      expect(bySector('notfound')).toBeUndefined()
    })
  })

  describe('统计聚合', () => {
    it('strengthDistribution 应正确统计各强度数量', () => {
      const dist = getStrengthDistribution()
      expect(dist.strong).toBe(1)
      expect(dist.medium).toBe(1)
      expect(dist.weak).toBe(1)
      expect(dist.none).toBe(1)  // realestate
    })

    it('triggeredCount 应返回已触发数量', () => {
      expect(triggeredCount()).toBe(3)
    })

    it('triggeredRate 应返回触发率', () => {
      // 3/4 = 0.75
      expect(triggeredRate()).toBe(0.75)
    })

    it('hasAnyTriggered 应正确判断是否有触发', () => {
      expect(hasAnyTriggered()).toBe(true)
      mockGetState.mockReturnValue({ ...rotationSignalStoreNormalState, signals: emptyRotationSignals } as never)
      expect(hasAnyTriggered()).toBe(false)
    })
  })

  describe('时间排序', () => {
    it('latestSignals 应按 detectedAt 降序', () => {
      const latest = latestSignals(2)
      expect(latest).toHaveLength(2)
      // banking(detectedAt: now-1h) > steel(now-2h) > coal(now-3h)
      expect(latest[0]!.sectorId).toBe('banking')
      expect(latest[1]!.sectorId).toBe('steel')
    })

    it('recentTriggered 应返回最近 N 小时内的信号', () => {
      // 使用 4 小时窗口确保 3 条触发信号都在范围内（banking 1h/steel 2h/coal 3h）
      const recent = recentTriggered(4)
      expect(recent).toHaveLength(3)
      expect(recent.map(s => s.sectorId)).toContain('banking')
    })
  })

  describe('板块聚合', () => {
    it('getSectorStats 应返回板块统计', () => {
      const stats = getSectorStats()
      expect(stats).toHaveLength(4)  // banking/steel/coal/realestate
      const banking = stats.find(s => s.sectorId === 'banking')
      expect(banking?.hasTriggered).toBe(true)
      expect(banking?.strengthLevel).toBe('strong')
    })

    it('isHotSector 应判断是否为热门板块', () => {
      expect(isHotSector('banking')).toBe(true)
      expect(isHotSector('coal')).toBe(false)  // weak 不是 hot
    })

    it('hotSectors 应按热度排序板块', () => {
      const hot = hotSectors(3)
      expect(hot[0]).toBe('banking')  // strong
    })

    it('signalConditions 应返回条件详情', () => {
      const cond = signalConditions('banking')
      expect(cond).not.toBeNull()
      expect(cond!.volumeBreakthrough).toBe(true)
      expect(cond!.capitalInflow).toBe(true)
      expect(cond!.goldenCross).toBe(true)
      expect(cond!.satisfiedCount).toBe(3)
    })
  })

  describe('memoizeByRef 缓存性能验证', () => {
    it('strengthDistribution 相同引用应命中缓存', () => {
      const signals = mockRotationSignals
      strengthDistribution(signals)
      strengthDistribution(signals)
      strengthDistribution(signals)

      const stats = getCacheStatsSnapshot()['strengthDistribution']
      expect(stats!.totalCalls).toBe(3)
      expect(stats!.hits).toBe(2)
      expect(stats!.misses).toBe(1)
    })

    it('sectorStats 不同引用应失效缓存', () => {
      const signals1 = mockRotationSignals
      const signals2 = [...mockRotationSignals]

      sectorStatsMemo(signals1)  // miss
      sectorStatsMemo(signals1)  // hit
      sectorStatsMemo(signals2)  // miss

      const stats = getCacheStatsSnapshot()['sectorStats']
      expect(stats!.misses).toBe(2)
      expect(stats!.hits).toBe(1)
    })
  })

  describe('边界情况', () => {
    beforeEach(() => {
      mockGetState.mockReturnValue({ ...rotationSignalStoreNormalState, signals: emptyRotationSignals } as never)
    })

    it('空状态：所有聚合应返回零值', () => {
      expect(signalsCount()).toBe(0)
      expect(isSignalsEmpty()).toBe(true)
      expect(triggeredCount()).toBe(0)
      expect(triggeredRate()).toBe(0)
      expect(hasAnyTriggered()).toBe(false)
    })

    it('空状态：triggeredSignals 应返回空数组', () => {
      expect(triggeredSignals()).toEqual([])
    })

    it('空状态：getSectorStats 应返回空数组', () => {
      expect(getSectorStats()).toEqual([])
    })

    it('空状态：signalConditions 应返回 null', () => {
      expect(signalConditions('banking')).toBeNull()
    })
  })

  describe('循环依赖验证', () => {
    it('派生函数应能独立调用不产生循环', () => {
      expect(() => triggeredSignals()).not.toThrow()
      expect(() => getStrengthDistribution()).not.toThrow()
      expect(() => getSectorStats()).not.toThrow()
      expect(() => hotSectors(5)).not.toThrow()
    })
  })
})
