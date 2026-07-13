import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  riskStoreNormalState,
  riskStoreBlockedState,
  mockRiskVerdicts,
  emptyRiskVerdicts,
} from '../../fixtures/store-mock-data'
import { resetCacheStats, getCacheStatsSnapshot, resetAllMemoCaches } from '@/lib/derivedCache'

/**
 * riskStore.derived.ts 单元测试
 */

vi.mock('@/store/riskStore', () => ({
  useRiskStore: {
    getState: vi.fn(),
  },
}))

import { useRiskStore } from '@/store/riskStore'
import {
  isExecutable,
  riskLevelText,
  latestVerdict,
  pendingBlocks,
  pendingWarnings,
  isCircuitOpen,
  needsManualIntervention,
  circuitStateText,
  isCircuitHalfOpen,
  blockedCount,
  warningCount,
  normalCount,
  blockedRate,
  verdictsCount,
  riskTrend,
  riskTrendDirection,
  verdictsTimeline,
  symbolRiskStats,
} from '@/store/riskStore.derived'

const mockGetState = vi.mocked(useRiskStore.getState)

describe('riskStore.derived.ts 派生查询单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
    mockGetState.mockReturnValue(riskStoreNormalState as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCacheStats()
    resetAllMemoCaches()
  })

  describe('执行决策', () => {
    it('isExecutable 应基于 triState 判断', () => {
      mockGetState.mockReturnValue(riskStoreNormalState as never)
      expect(isExecutable()).toBe(true)

      mockGetState.mockReturnValue({ ...riskStoreNormalState, triState: 'blocked' } as never)
      expect(isExecutable()).toBe(false)

      mockGetState.mockReturnValue({ ...riskStoreNormalState, triState: 'warning' } as never)
      expect(isExecutable()).toBe(true)
    })

    it('riskLevelText 应返回中文描述', () => {
      mockGetState.mockReturnValue({ ...riskStoreNormalState, triState: 'normal' } as never)
      expect(riskLevelText()).toBe('正常')
      mockGetState.mockReturnValue({ ...riskStoreNormalState, triState: 'warning' } as never)
      expect(riskLevelText()).toBe('警告')
      mockGetState.mockReturnValue({ ...riskStoreNormalState, triState: 'blocked' } as never)
      expect(riskLevelText()).toBe('阻塞')
    })

    it('latestVerdict 应返回最近一次裁决', () => {
      const latest = latestVerdict()
      expect(latest).not.toBeNull()
      expect(latest!.id).toBe('verdict-4')
    })

    it('pendingBlocks 应返回最近裁决的 blocks', () => {
      mockGetState.mockReturnValue({ ...riskStoreNormalState, triState: 'blocked' } as never)
      // verdict-3 的 blocks: ['单股集中度过高', '超出单笔限额']
      // 但 latestVerdict 是 verdict-4（triState: normal, blocks: []）
      expect(pendingBlocks()).toEqual([])

      // 将 verdicts 改为只有 verdict-3
      mockGetState.mockReturnValue({
        ...riskStoreNormalState,
        verdicts: [mockRiskVerdicts[2]!],  // verdict-3
      } as never)
      expect(pendingBlocks()).toEqual(['单股集中度过高', '超出单笔限额'])
    })

    it('pendingWarnings 应返回最近裁决的 warnings', () => {
      expect(pendingWarnings()).toEqual([])
    })
  })

  describe('回路状态', () => {
    it('isCircuitOpen 应基于 circuitState 判断', () => {
      mockGetState.mockReturnValue(riskStoreNormalState as never)
      expect(isCircuitOpen()).toBe(false)

      mockGetState.mockReturnValue(riskStoreBlockedState as never)
      expect(isCircuitOpen()).toBe(true)
    })

    it('needsManualIntervention 应等同于 isCircuitOpen', () => {
      mockGetState.mockReturnValue(riskStoreBlockedState as never)
      expect(needsManualIntervention()).toBe(true)
    })

    it('circuitStateText 应返回中文描述', () => {
      mockGetState.mockReturnValue({ ...riskStoreNormalState, circuitState: 'closed' } as never)
      expect(circuitStateText()).toBe('闭合')
      mockGetState.mockReturnValue({ ...riskStoreNormalState, circuitState: 'open' } as never)
      expect(circuitStateText()).toBe('开启')
      mockGetState.mockReturnValue({ ...riskStoreNormalState, circuitState: 'half-open' } as never)
      expect(circuitStateText()).toBe('半开')
    })

    it('isCircuitHalfOpen 应判断半开状态', () => {
      mockGetState.mockReturnValue({ ...riskStoreNormalState, circuitState: 'half-open' } as never)
      expect(isCircuitHalfOpen()).toBe(true)
    })
  })

  describe('风控统计', () => {
    it('blockedCount 应返回 blocked 次数', () => {
      // mockRiskVerdicts: [normal, warning, blocked, normal]
      expect(blockedCount()).toBe(1)
    })

    it('warningCount 应返回 warning 次数', () => {
      expect(warningCount()).toBe(1)
    })

    it('normalCount 应返回 normal 次数', () => {
      expect(normalCount()).toBe(2)
    })

    it('blockedRate 应返回 blocked 比例', () => {
      // 1/4 = 0.25
      expect(blockedRate()).toBe(0.25)
    })

    it('verdictsCount 应返回裁决总数', () => {
      expect(verdictsCount()).toBe(4)
    })
  })

  describe('趋势分析', () => {
    it('riskTrend 应返回最近 N 次的三态序列', () => {
      const trend = riskTrend(4)
      expect(trend).toEqual(['normal', 'warning', 'blocked', 'normal'])
    })

    it('riskTrendDirection 应判断趋势方向', () => {
      // mockRiskVerdicts: [normal, warning, blocked, normal]
      // 前半 [normal, warning] blocked率=0，后半 [blocked, normal] blocked率=0.5
      // diff = 0.5 > 0.1 → worsening
      const direction = riskTrendDirection()
      expect(direction).toBe('worsening')
    })

    it('verdictsTimeline 应返回时间线', () => {
      const timeline = verdictsTimeline(4)
      expect(timeline).toHaveLength(4)
      expect(timeline[0]).toHaveProperty('verdict')
      expect(timeline[0]).toHaveProperty('timeGap')
    })
  })

  describe('按 symbol 聚合', () => {
    it('symbolRiskStats 应返回指定 symbol 的风险统计', () => {
      const stats = symbolRiskStats('000001')
      // mockRiskVerdicts 中 000001 有 2 条（verdict-1 normal, verdict-4 normal）
      expect(stats.totalChecks).toBe(2)
      expect(stats.blockedCount).toBe(0)
      expect(stats.normalCount).toBe(2)
      expect(stats.lastTriState).toBe('normal')
    })

    it('symbolRiskStats 不存在的 symbol 应返回零值', () => {
      const stats = symbolRiskStats('NOTFOUND')
      expect(stats.totalChecks).toBe(0)
    })
  })

  describe('memoizeByRef 缓存性能验证', () => {
    it('verdictStats 相同引用应命中缓存', () => {
      blockedCount()  // 内部调用 verdictStats
      blockedCount()  // 内部调用 verdictStats
      blockedCount()  // 内部调用 verdictStats
      blockedCount()
      blockedCount()

      const stats = getCacheStatsSnapshot()['verdictStats']
      expect(stats).toBeDefined()
      expect(stats!.totalCalls).toBe(3)
      expect(stats!.hits).toBe(2)
      expect(stats!.misses).toBe(1)
    })

    it('verdictStats 不同引用应失效缓存', () => {
      const verdicts1 = mockRiskVerdicts
      const verdicts2 = [...mockRiskVerdicts]

      mockGetState.mockReturnValue({ ...riskStoreNormalState, verdicts: verdicts1 } as never)
      blockedCount()  // miss
      blockedCount()  // hit

      mockGetState.mockReturnValue({ ...riskStoreNormalState, verdicts: verdicts2 } as never)
      blockedCount()  // miss

      const stats = getCacheStatsSnapshot()['verdictStats']
      expect(stats!.misses).toBe(2)
      expect(stats!.hits).toBe(1)
    })
  })

  describe('边界情况', () => {
    beforeEach(() => {
      mockGetState.mockReturnValue({ ...riskStoreNormalState, verdicts: emptyRiskVerdicts } as never)
    })

    it('空状态：latestVerdict 应返回 null', () => {
      expect(latestVerdict()).toBeNull()
    })

    it('空状态：pendingBlocks 应返回空数组', () => {
      expect(pendingBlocks()).toEqual([])
    })

    it('空状态：blockedCount 应为 0', () => {
      expect(blockedCount()).toBe(0)
    })

    it('空状态：verdictsCount 应为 0', () => {
      expect(verdictsCount()).toBe(0)
    })

    it('空状态：blockedRate 应为 0', () => {
      expect(blockedRate()).toBe(0)
    })

    it('空状态：riskTrend 应返回空数组', () => {
      expect(riskTrend(10)).toEqual([])
    })

    it('空状态：symbolRiskStats 应返回零值', () => {
      const stats = symbolRiskStats('000001')
      expect(stats.totalChecks).toBe(0)
    })
  })

  describe('循环依赖验证', () => {
    it('派生函数应能独立调用不产生循环', () => {
      expect(() => isExecutable()).not.toThrow()
      expect(() => blockedCount()).not.toThrow()
      expect(() => riskTrendDirection()).not.toThrow()
      expect(() => symbolRiskStats('000001')).not.toThrow()
    })
  })
})
