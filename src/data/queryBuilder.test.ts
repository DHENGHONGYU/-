/**
 * @test_id V9-TEST-ST-022
 * queryBuilder.ts 单元测试 — D-02 类型安全化
 *
 * 通过 mock @/core/databridge 隔离底层存储，验证：
 * - 成功路径返回 ok(QueryBuilderResult) 且维度正确组装
 * - 参数校验失败（symbol 缺失）返回 fail(ValidationError)
 * - 单维度失败仅记入 errors，整体仍为 ok（partial success）
 * - 批量查询返回 ok(Map)
 *
 * @vitest
  * @covers_docs []
*/
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockQuery,
  mockLogger,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { queryBuilder } from './queryBuilder'
import { ValidationError } from '@/lib/errors'

function mockQueryByStore<T>(overrides: Record<string, T | Error | undefined>): void {
  mockQuery.mockImplementation(async (request: { action: string; store: string; key?: string }) => {
    const key = request.action === 'QUERY_GET'
      ? `${request.store}#${request.key ?? ''}`
      : request.store
    const value = overrides[key]
    if (value instanceof Error) {
      throw value
    }
    return { success: value !== undefined, data: value }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ success: true, data: undefined })
})

describe('QueryBuilder.queryStock — 类型安全', () => {
  it('成功路径返回 ok 且正确组装维度', async () => {
    mockQueryByStore({
      'stocks#600000': { symbol: '600000', name: '浦发银行' },
      'v6_scores#600000': { symbol: '600000', score: 90 },
    })

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
    mockQueryByStore({
      'stocks#600000': { symbol: '600000', name: 'PF' },
      'signals': new Error('idx unavailable'),
    })

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
    mockQueryByStore({
      'stocks#600000': { symbol: '600000', name: 'PF' },
    })

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
