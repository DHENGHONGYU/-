/**
 * v6ScoreService 单元测试
 *
 * F4 整改后：runV6Score 调用 v6-engine L-1~L8 分层引擎。
 * 覆盖：getAllV6Scores, runV6Score, getV6ScoreQuality
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getAllV6Scores,
  runV6Score,
  getV6ScoreQuality,
} from './v6ScoreService'
import type { Stock, DailyQuotes, V6Score, KlineBar } from '@/data/types'

// ============================================================
// Mocks
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// 2026-07-12 修正：v6ScoreService 已迁移到 dataBridge.query/forward（不再直接用 dataLayer）。
// 原 mock 仅覆盖 @/data/dataLayer，导致真实 dataBridge.query → db.ready() 永久挂起（测试超时）。
// 改为 mock @/core/databridge，按调用顺序用 mockResolvedValueOnce 注入数据。
const { mockQuery, mockForward } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockForward: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/core/databridge', () => ({
  dataBridge: { query: mockQuery, forward: mockForward },
}))

// Mock v6-engine：避免在测试中运行真实 11 层计算器
vi.mock('@/services/scoring/v6-engine', () => {
  const mockComposite = {
    score: 3.75,
    rating: 'buy' as const,
    layers: {
      lMinus1: { layerId: 'lMinus1', layerName: '行业评分估值', score: 4.0, summary: '行业估值合理', risks: [], evidence: [], weight: 0.10, weightedScore: 0.4, dataSources: [] },
      l0: { layerId: 'l0', layerName: 'STEEP 宏观', score: 3.5, summary: '宏观环境中性', risks: [], evidence: [], weight: 0.08, weightedScore: 0.28, dataSources: [] },
      l1: { layerId: 'l1', layerName: '护城河', score: 4.5, summary: '品牌护城河强', risks: [], evidence: [], weight: 0.15, weightedScore: 0.675, dataSources: [] },
      l2: { layerId: 'l2', layerName: '竞品格局', score: 3.0, summary: '竞争中等', risks: ['竞品增多'], evidence: [], weight: 0.10, weightedScore: 0.3, dataSources: [] },
      l3f: { layerId: 'l3f', layerName: '财务健康', score: 4.0, summary: '财务稳健', risks: [], evidence: [], weight: 0.10, weightedScore: 0.4, dataSources: [] },
      l3v: { layerId: 'l3v', layerName: '估值水平', score: 3.5, summary: '估值中等', risks: [], evidence: [], weight: 0.08, weightedScore: 0.28, dataSources: [] },
      l4: { layerId: 'l4', layerName: '情景推演', score: 3.0, summary: '基准情景', risks: [], evidence: [], weight: 0.08, weightedScore: 0.24, dataSources: [] },
      l5: { layerId: 'l5', layerName: 'T-M矩阵', score: 4.0, summary: '时机适中', risks: [], evidence: [], weight: 0.05, weightedScore: 0.2, dataSources: [] },
      l6: { layerId: 'l6', layerName: 'Hype周期', score: 3.5, summary: '稳步爬升', risks: [], evidence: [], weight: 0.07, weightedScore: 0.245, dataSources: [] },
      l7: { layerId: 'l7', layerName: '第二曲线', score: 4.0, summary: '新业务增长', risks: [], evidence: [], weight: 0.15, weightedScore: 0.6, dataSources: [] },
      l8: { layerId: 'l8', layerName: '技术筹码', score: 3.5, summary: '筹码集中', risks: [], evidence: [], weight: 0.04, weightedScore: 0.14, dataSources: [] },
    },
    allRisks: ['竞品增多'],
    recommendation: '建议买入',
    timestamp: 1700000000000,
    engineVersion: 'v6-engine-1.0',
  }

  return {
    createV6Engine: vi.fn(() => ({
      calculateAll: vi.fn().mockResolvedValue(mockComposite),
      audit: vi.fn().mockReturnValue(null),
    })),
    stockToBasicData: vi.fn((stock: Stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price,
      pe: stock.pe,
      pb: stock.pb,
      roe: stock.roe,
      marketCap: stock.marketCap,
      sector: stock.industryCode,
    })),
    quotesToQuoteData: vi.fn((quotes: DailyQuotes) => ({
      latestClose: quotes.latest?.close,
      history: quotes.history.map((b) => b.close),
      volumeHistory: quotes.history.map((b) => b.volume),
    })),
    ALL_LAYER_IDS: ['lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8'],
  }
})

// ============================================================
// Mock 数据工厂
// ============================================================

function createMockStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    price: 1800,
    pe: 30,
    pb: 8,
    roe: 0.25,
    marketCap: 2.2e12,
    dataVersion: 1,
    source: 'akshare',
    updatedAt: Date.now(),
    researchStatus: 'active',
    ...overrides,
  } as Stock
}

function createMockBar(i: number): KlineBar {
  return {
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 1000000,
    amount: 1e8,
  }
}

function createMockQuotes(historyLength = 60): DailyQuotes {
  const history = Array.from({ length: historyLength }, (_, i) => createMockBar(i))
  return {
    symbol: '600519.SH',
    latest: history[historyLength - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}

// ============================================================
// getAllV6Scores
// ============================================================

describe('getAllV6Scores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('成功返回 V6 评分列表', async () => {
    const mockScores: V6Score[] = [
      { symbol: '600519.SH', score: 4.5, factors: {}, algorithmVersion: 'v6-engine-1.0', calculatedAt: Date.now(), dataVersion: 1 },
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: mockScores })

    const result = await getAllV6Scores()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockScores)
  })

  test('失败返回 error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'))

    const result = await getAllV6Scores()

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB error')
  })
})

// ============================================================
// runV6Score
// ============================================================

describe('runV6Score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('股票不存在返回错误', async () => {
    // runV6Score 首次 dataBridge.query(stocks) → data 为空 → Stock not found
    mockQuery.mockResolvedValueOnce({ success: true, data: null })

    const result = await runV6Score('UNKNOWN')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Stock not found')
  })

  test('正常评分流程 — 调用 v6-engine 并映射结果', async () => {
    // dataBridge.query 调用顺序：stocks → dailyQuotes → financialReports（buildFinancialData）
    mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })
      .mockResolvedValueOnce({ success: true, data: null })

    const result = await runV6Score('600519.SH')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data!.symbol).toBe('600519.SH')
      expect(result.data!.score).toBe(3.75)
      expect(result.data!.rating).toBe('buy')
      expect(result.data!.algorithmVersion).toBe('v6-engine-1.0')
      expect(result.data!.engineVersion).toBe('v6-engine-1.0')
      // factors key 为 layerId（11 层）
      expect(Object.keys(result.data!.factors)).toContain('lMinus1')
      expect(Object.keys(result.data!.factors).length).toBe(11)
      // 层明细
      expect(result.data!.layerDetails).toBeDefined()
      expect(result.data!.layerDetails?.['l1']?.score).toBe(4.5)
      // 风险汇总
      expect(result.data!.allRisks).toEqual(['竞品增多'])
      expect(result.data!.recommendation).toBe('建议买入')
    }
  })

  test('无 K线数据时仍可评分（引擎自行降级）', async () => {
    mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: null })
      .mockResolvedValueOnce({ success: true, data: null })

    const result = await runV6Score('600519.SH')

    expect(result.success).toBe(true)
  })
})

// ============================================================
// getV6ScoreQuality
// ============================================================

describe('getV6ScoreQuality', () => {
  test('全部楼层完整', () => {
    const factors: Record<string, number> = {
      lMinus1: 4, l0: 3, l1: 4, l2: 3, l3f: 4,
      l3v: 3, l4: 4, l5: 3, l6: 4, l7: 3, l8: 4,
    }
    const result = getV6ScoreQuality('600519.SH', factors)
    expect(result.dataCompleteness).toBe(100)
    expect(result.missingLayers).toHaveLength(0)
    expect(result.hasBasicData).toBe(true)
  })

  test('部分层缺失', () => {
    const factors: Record<string, number> = {
      lMinus1: 4,
      l3f: 3,
    }
    const result = getV6ScoreQuality('600519.SH', factors)
    // 2/11 ≈ 18.18%
    expect(result.dataCompleteness).toBeCloseTo(18.18, 1)
    expect(result.missingLayers.length).toBe(9)
    expect(result.hasBasicData).toBe(false)
  })
})
