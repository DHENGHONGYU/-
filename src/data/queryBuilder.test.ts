/**
 * queryBuilder.ts 单元测试 — D-02 类型安全化
 *
 * 通过 mock @/data/dataLayer 隔离底层存储，验证：
 * - 成功路径返回 ok(QueryBuilderResult) 且维度正确组装
 * - 参数校验失败（symbol 缺失）返回 fail(ValidationError)
 * - 单维度失败仅记入 errors，整体仍为 ok（partial success）
 * - 批量查询返回 ok(Map)
 *
 * @vitest
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockStocksGet,
  mockQuotesGet,
  mockV6Get,
  mockIntelGet,
  mockIndustryGet,
  mockSignalsList,
  mockMapList,
  mockNewsGet,
  mockLogger,
} = vi.hoisted(() => ({
  mockStocksGet: vi.fn(),
  mockQuotesGet: vi.fn(),
  mockV6Get: vi.fn(),
  mockIntelGet: vi.fn(),
  mockIndustryGet: vi.fn(),
  mockSignalsList: vi.fn(),
  mockMapList: vi.fn(),
  mockNewsGet: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: { get: mockStocksGet },
    dailyQuotes: { get: mockQuotesGet },
    v6Scores: { get: mockV6Get },
    intelligentScores: { getLatestBySymbol: mockIntelGet },
    industryScores: { getLatestByCode: mockIndustryGet },
    signals: { listBySymbol: mockSignalsList },
    newsStockMap: { listBySymbol: mockMapList },
    news: { get: mockNewsGet },
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { queryBuilder } from './queryBuilder'
import { ValidationError } from '@/lib/errors'

beforeEach(() => {
  vi.clearAllMocks()
  mockStocksGet.mockResolvedValue(undefined)
  mockQuotesGet.mockResolvedValue(undefined)
  mockV6Get.mockResolvedValue(undefined)
  mockIntelGet.mockResolvedValue(undefined)
  mockIndustryGet.mockResolvedValue(undefined)
  mockSignalsList.mockResolvedValue([])
  mockMapList.mockResolvedValue([])
  mockNewsGet.mockResolvedValue(undefined)
})

describe('QueryBuilder.queryStock — 类型安全', () => {
  it('成功路径返回 ok 且正确组装维度', async () => {
    mockStocksGet.mockResolvedValue({ symbol: '600000', name: '浦发银行' })
    mockV6Get.mockResolvedValue({ symbol: '600000', score: 90 })

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
      includeV6Score: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock).toEqual({ symbol: '600000', name: '浦发银行' })
      expect(res.value.v6Score).toEqual({ symbol: '600000', score: 90 })
      expect(res.value.errors).toBeUndefined()
    }
    expect(mockStocksGet).toHaveBeenCalledWith('600000')
  })

  it('symbol 缺失时返回 fail(ValidationError)', async () => {
    const res = await queryBuilder.queryStock({} as never)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(ValidationError)
      expect(res.error.message).toContain('symbol 不能为空')
    }
  })

  it('单维度失败仅记入 errors，整体仍为 ok', async () => {
    mockStocksGet.mockResolvedValue({ symbol: '600000', name: 'PF' })
    mockSignalsList.mockRejectedValue(new Error('idx unavailable'))

    const res = await queryBuilder.queryStock({
      symbol: '600000',
      includeBasic: true,
      includeSignals: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.stock).toBeDefined()
      expect(res.value.errors).toContain('signals')
    }
  })
})

describe('QueryBuilder.queryStocksBatch', () => {
  it('批量查询返回 ok(Map)，失败标的被跳过', async () => {
    mockStocksGet.mockResolvedValue({ symbol: '600000', name: 'PF' })

    const res = await queryBuilder.queryStocksBatch(['600000'], {
      includeBasic: true,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.size).toBe(1)
      expect(res.value.get('600000')?.stock).toBeDefined()
    }
  })
})
