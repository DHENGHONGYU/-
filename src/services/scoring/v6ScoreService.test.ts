/**
 * v6ScoreService 单元测试
 *
 * 覆盖：getAllV6Scores, runV6Score, getV6ScoreQuality
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getAllV6Scores,
  runV6Score,
  getV6ScoreQuality,
} from './v6ScoreService'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
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

vi.mock('@/data/db', () => ({
  generateId: vi.fn().mockReturnValue('test-id-123'),
}))

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: { get: vi.fn() },
    dailyQuotes: { get: vi.fn() },
    v6Scores: { list: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue({ success: true }) },
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn().mockReturnValue({}) },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: { saveV6Score: 'SAVE_V6_SCORE' },
  ENVELOPE_TARGET: { db: 'DB' },
  MODULE_ID: { analyzer: 'analyzer' },
}))

vi.mock('@/services/fetcher/fetcherAdapter', () => ({
  hasEnoughHistory: vi.fn().mockReturnValue(true),
  hasRealBasicData: vi.fn().mockReturnValue(true),
}))

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
      { symbol: '600519.SH', score: 4.5, factors: {}, algorithmVersion: 'v9-auto', calculatedAt: Date.now(), dataVersion: 1 },
    ]
    vi.mocked(dataLayer.v6Scores.list).mockResolvedValue(mockScores)

    const result = await getAllV6Scores()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockScores)
  })

  test('失败返回 error', async () => {
    vi.mocked(dataLayer.v6Scores.list).mockRejectedValue(new Error('DB error'))

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
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(undefined)

    const result = await runV6Score('UNKNOWN')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Stock not found')
  })

  test('正常评分流程', async () => {
    vi.mocked(dataLayer.stocks.get).mockResolvedValue(createMockStock())
    vi.mocked(dataLayer.dailyQuotes.get).mockResolvedValue(createMockQuotes())
    vi.mocked(dataBridge.forward).mockResolvedValue(undefined)

    const result = await runV6Score('600519.SH')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data!.symbol).toBe('600519.SH')
      expect(result.data!.score).toBeGreaterThanOrEqual(0)
      // V6 引擎接管后，algorithmVersion 为引擎版本号（如 v6-engine-v1.0.0）
      expect(result.data!.algorithmVersion).toMatch(/^v6-engine-/)
      // factors key 为层 ID（lMinus1/l0/l1/...）
      expect(Object.keys(result.data!.factors).length).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// getV6ScoreQuality
// ============================================================

describe('getV6ScoreQuality', () => {
  test('完整因子', () => {
    const factors: Record<string, number> = {
      lMinus1: 4,
      l0: 3,
      l1: 4,
      l2: 3,
      l3f: 4,
      l3v: 3,
      l4: 4,
      l5: 3,
      l6: 4,
      l7: 3,
      l8: 4,
    }
    const result = getV6ScoreQuality('600519.SH', factors)
    expect(result.dataCompleteness).toBe(100)
    expect(result.missingFactors).toHaveLength(0)
    expect(result.hasBasicData).toBe(true)
  })

  test('缺失因子', () => {
    const factors: Record<string, number> = {
      lMinus1: 4,
      l3f: 4,
    }
    const result = getV6ScoreQuality('600519.SH', factors)
    // 2/11 ≈ 18.18%
    expect(result.dataCompleteness).toBeCloseTo(18.18, 1)
    expect(result.missingFactors.length).toBeGreaterThan(0)
    expect(result.hasBasicData).toBe(false)
  })
})
