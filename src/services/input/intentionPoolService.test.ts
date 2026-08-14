/**
 * @test_id V9-TEST-SV-INTPOOL
 * @covers_docs [V9-DOC-PROJ-053]
 * @description 意向候选池数据服务（输入舱 → 分析舱防腐层）单元测试。
 *
 * 覆盖场景：
 *   1. 成功读取意向候选池并按 ingestedAt 倒序映射
 *   2. 来源（screenSource）过滤
 *   3. 分组（group）过滤
 *   4. join 已有 V6 评分（scoreMap 去重保留首条）
 *   5. v6Scores 读取失败时降级无评分，不阻塞
 *   6. stocks 查询失败返回 error
 *   7. 兜底只保留 pool='intention' 的条目
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Stock, V6Score } from '@/data/types'

// ─── Mock 依赖模块 ───────────────────────────────────────────

const {
  mockQuery,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { query: mockQuery },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    queryByIndex: 'QUERY_BY_INDEX',
    queryList: 'QUERY_LIST',
  },
  MODULE_ID: { pool: 'pool' },
  STORE_NAME: { stocks: 'stocks', v6Scores: 'v6_scores' },
}))

vi.mock('@/constants/pool.constants', () => ({
  POOL_TYPE: { intention: 'intention', research: 'research', position: 'position' },
}))

// ─── 导入被测模块 ────────────────────────────────────────────

import { listIntentionCandidates } from './intentionPoolService'

// ─── 测试数据工厂 ────────────────────────────────────────────

function makeStock(overrides: Partial<Stock>): Stock {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    pool: 'intention',
    screenSource: 'hot-sector',
    group: '白酒',
    price: 1355.29,
    pe: 30,
    pb: 8,
    ingestedAt: 100,
    dataVersion: 1,
    ...overrides,
  } as Stock
}

function makeScore(overrides: Partial<V6Score>): V6Score {
  return { symbol: '600519.SH', score: 85, ...overrides } as V6Score
}

beforeEach(() => {
  mockQuery.mockReset()
})

// ─── 测试用例 ────────────────────────────────────────────────

describe('listIntentionCandidates', () => {
  it('成功读取意向候选池并按 ingestedAt 倒序映射', async () => {
    const stocks = [
      makeStock({ symbol: '600519.SH', ingestedAt: 100 }),
      makeStock({ symbol: '000858.SZ', name: '五粮液', ingestedAt: 200 }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await listIntentionCandidates()

    expect(result.success).toBe(true)
    const candidates = result.data!
    expect(candidates).toHaveLength(2)
    // 倒序：ingestedAt 大的在前
    expect(candidates[0]!.symbol).toBe('000858.SZ')
    expect(candidates[1]!.symbol).toBe('600519.SH')
    expect(candidates[0]!.screenSource).toBe('hot-sector')
    expect(candidates[0]!.group).toBe('白酒')
    expect(candidates[0]!.price).toBe(1355.29)
  })

  it('来源过滤：仅保留 hot-sector', async () => {
    const stocks = [
      makeStock({ symbol: '600519.SH', screenSource: 'hot-sector' }),
      makeStock({ symbol: '000858.SZ', name: '五粮液', screenSource: 'manual' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await listIntentionCandidates({ scope: 'intention', screenSource: 'hot-sector' })

    expect(result.success).toBe(true)
    expect(result.data!.map((c) => c.symbol)).toEqual(['600519.SH'])
  })

  it('分组过滤：仅保留指定分组', async () => {
    const stocks = [
      makeStock({ symbol: '600519.SH', group: '白酒' }),
      makeStock({ symbol: '000858.SZ', name: '五粮液', group: '其他' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await listIntentionCandidates({ scope: 'intention', group: '白酒' })

    expect(result.success).toBe(true)
    expect(result.data!.map((c) => c.symbol)).toEqual(['600519.SH'])
  })

  it('join 已有 V6 评分（scoreMap 去重保留首条）', async () => {
    const stocks = [makeStock({ symbol: '600519.SH' })]
    const scores = [
      makeScore({ symbol: '600519.SH', score: 88 }),
      makeScore({ symbol: '600519.SH', score: 77 }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
    mockQuery.mockResolvedValueOnce({ success: true, data: scores })

    const result = await listIntentionCandidates()

    expect(result.success).toBe(true)
    expect(result.data![0]!.v6Score).toBe(88)
  })

  it('v6Scores 读取失败时降级无评分，不阻塞', async () => {
    const stocks = [makeStock({ symbol: '600519.SH' })]
    mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
    mockQuery.mockResolvedValueOnce({ success: false, error: 'v6 读取失败' })

    const result = await listIntentionCandidates()

    expect(result.success).toBe(true)
    expect(result.data![0]!.v6Score).toBeUndefined()
  })

  it('兜底只保留 pool=intention 的条目', async () => {
    const stocks = [
      makeStock({ symbol: '600519.SH', pool: 'intention' }),
      makeStock({ symbol: '000858.SZ', name: '五粮液', pool: 'research' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: stocks })
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await listIntentionCandidates()

    expect(result.success).toBe(true)
    expect(result.data!.map((c) => c.symbol)).toEqual(['600519.SH'])
  })

  it('stocks 查询失败时返回 error', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, error: 'stocks 查询失败' })

    const result = await listIntentionCandidates()

    expect(result.success).toBe(false)
    expect(result.error).toBe('stocks 查询失败')
  })

  it('stocks 查询抛出异常时返回 error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('网络异常'))

    const result = await listIntentionCandidates()

    expect(result.success).toBe(false)
    expect(result.error).toBe('网络异常')
  })
})
