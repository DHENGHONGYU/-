/**
 * @test_id V9-TEST-ST-067
 * scoreTrendService 单元测试
 *
 * 覆盖：周期标签格式化、周期聚合、行业/个股趋势加载、空数据与 null 分数处理
 *
 * P4 重构后，行业/个股评分趋势查询统一走 DataBridge.queryByIndex，
 * 本测试改为 mock @/core/databridge。
  * @covers_docs []
*/

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  formatPeriodLabel,
  aggregateScoresByPeriod,
  loadIndustryScoreTrend,
  loadStockScoreTrend,
} from '../scoreTrendService'
import type { IndustryScore, IntelligentScore } from '@/data/types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

const { mockIndustryScoresByCode, mockIntelligentScoresBySymbol } = vi.hoisted(() => ({
  mockIndustryScoresByCode: vi.fn(),
  mockIntelligentScoresBySymbol: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn(async (request: {
      action: string
      store: string
      indexName?: string
      indexValue?: unknown
    }) => {
      const { action, store, indexName, indexValue } = request

      if (
        action === 'QUERY_BY_INDEX' &&
        store === 'industry_scores' &&
        indexName === 'by-code'
      ) {
        return { success: true, data: await mockIndustryScoresByCode(indexValue) }
      }

      if (
        action === 'QUERY_BY_INDEX' &&
        store === 'intelligent_scores' &&
        indexName === 'by-symbol'
      ) {
        return { success: true, data: await mockIntelligentScoresBySymbol(indexValue) }
      }

      return { success: false, error: `unmocked query: ${action}/${store}` }
    }),
  },
}))

function createIndustryScore(overrides: Partial<IndustryScore> = {}): IndustryScore {
  return {
    code: 'TEST',
    name: '测试行业',
    overallScore: 4,
    dimensionScores: [
      { name: '政策契合度', score: 4, rationale: '', evidence: [], weight: 1 },
      { name: '稀缺性', score: 3, rationale: '', evidence: [], weight: 1 },
    ],
    summary: '',
    basis: '',
    missingFields: [],
    sectorSnapshot: { composite: 4, recommendation: '', positionPct: '', subTracks: [] },
    configSnapshot: { model: '', baseURL: '' },
    modelResponse: '',
    scoredAt: Date.now(),
    ...overrides,
  }
}

function createIntelligentScore(overrides: Partial<IntelligentScore> = {}): IntelligentScore {
  return {
    symbol: '600519.SH',
    overallScore: 4,
    dimensionScores: [
      { name: '估值', score: 4, rationale: '', evidence: [], weight: 1 },
      { name: '成长', score: null, rationale: '', evidence: [], weight: 1 },
    ],
    summary: '',
    basis: '',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
    configSnapshot: { model: '', baseURL: '' },
    modelResponse: '',
    dataVersion: 1,
    scoredAt: Date.now(),
    ...overrides,
  }
}

describe('formatPeriodLabel', () => {
  test('返回周标签', () => {
    const date = new Date('2026-07-02T00:00:00.000+08:00')
    expect(formatPeriodLabel(date, 'week')).toMatch(/^\d{4}-W\d{2}$/)
  })

  test('返回月标签', () => {
    const date = new Date('2026-07-02T00:00:00.000+08:00')
    expect(formatPeriodLabel(date, 'month')).toBe('2026-07')
  })

  test('返回季度标签', () => {
    const date = new Date('2026-07-02T00:00:00.000+08:00')
    expect(formatPeriodLabel(date, 'quarter')).toBe('2026-Q3')
  })
})

describe('aggregateScoresByPeriod', () => {
  test('按周聚合并计算平均分', () => {
    const items = [
      { scoredAt: new Date('2026-06-29T10:00:00.000+08:00').getTime(), overallScore: 4 },
      { scoredAt: new Date('2026-06-30T10:00:00.000+08:00').getTime(), overallScore: 3 },
      { scoredAt: new Date('2026-07-06T10:00:00.000+08:00').getTime(), overallScore: 5 },
    ]

    const result = aggregateScoresByPeriod(
      items,
      'week',
      (item) => new Date(item.scoredAt),
      (item) => item.overallScore,
    )

    expect(result).toHaveLength(2)
    expect(result[0]!.composite).toBeCloseTo(3.5, 1)
    expect(result[0]!.count).toBe(2)
    expect(result[1]!.composite).toBe(5)
    expect(result[1]!.count).toBe(1)
  })

  test('null 分数不计入聚合', () => {
    const items = [
      { scoredAt: new Date('2026-07-01T10:00:00.000+08:00').getTime(), overallScore: null },
      { scoredAt: new Date('2026-07-02T10:00:00.000+08:00').getTime(), overallScore: 3 },
    ]

    const result = aggregateScoresByPeriod(
      items,
      'month',
      (item) => new Date(item.scoredAt),
      (item) => item.overallScore,
    )

    expect(result).toHaveLength(1)
    expect(result[0]!.composite).toBe(3)
    expect(result[0]!.count).toBe(1)
  })

  test('空数组返回空趋势点', () => {
    const result = aggregateScoresByPeriod<{ scoredAt: number; overallScore: number | null }>(
      [],
      'month',
      (item) => new Date(item.scoredAt),
      (item) => item.overallScore,
    )
    expect(result).toEqual([])
  })
})

describe('loadIndustryScoreTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('成功加载行业评分趋势', async () => {
    const scoredAt = new Date('2026-07-02T10:00:00.000+08:00').getTime()
    mockIndustryScoresByCode.mockResolvedValue([
      createIndustryScore({ code: 'AI', overallScore: 4, scoredAt }),
    ])

    const result = await loadIndustryScoreTrend('AI', 'month')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entityId).toBe('AI')
      expect(result.data.period).toBe('month')
      expect(result.data.points.length).toBeGreaterThan(0)
      expect(result.data.points[0]!.composite).toBe(4)
    }
  })

  test('失败返回 error', async () => {
    mockIndustryScoresByCode.mockRejectedValue(new Error('DB error'))

    const result = await loadIndustryScoreTrend('AI', 'week')

    expect(result.success).toBe(false)
    if ('error' in result) {
      expect(result.error).toContain('DB error')
    }
  })
})

describe('loadStockScoreTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('成功加载个股评分趋势并聚合维度', async () => {
    const scoredAt = new Date('2026-07-02T10:00:00.000+08:00').getTime()
    mockIntelligentScoresBySymbol.mockResolvedValue([
      createIntelligentScore({ symbol: '600519.SH', overallScore: 4, scoredAt }),
    ])

    const result = await loadStockScoreTrend('600519.SH', 'month')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entityId).toBe('600519.SH')
      expect(result.data.period).toBe('month')
      expect(result.data.points[0]!.dimensions).toBeDefined()
      expect(result.data.points[0]!.dimensions!['估值']).toBe(4)
    }
  })
})
