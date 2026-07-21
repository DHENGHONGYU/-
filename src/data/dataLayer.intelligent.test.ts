/**
 * @fileoverview dataLayer — Intelligent Score 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：intelligentScoreStore(5) / industryScoreStore(4) 共 9 个用例
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockQueryListSuccess,
  mockForwardSuccess,
  mockQuery,
  makeIntelligentScore,
  makeIndustryScore,
} from './dataLayer.test-utils'
import { intelligentScoreStore, industryScoreStore } from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('intelligentScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await intelligentScoreStore.save(makeIntelligentScore())
    expect(result.success).toBe(true)
  })

  it('listBySymbol: 按股票代码查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeIntelligentScore()] })

    const result = await intelligentScoreStore.listBySymbol('600519')
    expect(result).toHaveLength(1)
  })

  it('getLatestBySymbol: 返回最新评分', async () => {
    const scores = [
      makeIntelligentScore({ scoredAt: 1000 }),
      makeIntelligentScore({ scoredAt: 3000 }),
      makeIntelligentScore({ scoredAt: 2000 }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: scores })

    const result = await intelligentScoreStore.getLatestBySymbol('600519')
    expect(result?.scoredAt).toBe(3000)
  })

  it('getLatestBySymbol: 空列表返回 undefined', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await intelligentScoreStore.getLatestBySymbol('600519')
    expect(result).toBeUndefined()
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeIntelligentScore()])

    const result = await intelligentScoreStore.list()
    expect(result).toHaveLength(1)
  })
})

describe('industryScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await industryScoreStore.save(makeIndustryScore())
    expect(result.success).toBe(true)
  })

  it('listByCode: 按行业代码查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeIndustryScore()] })

    const result = await industryScoreStore.listByCode('SW801')
    expect(result).toHaveLength(1)
  })

  it('getLatestByCode: 返回最新评分', async () => {
    const scores = [
      makeIndustryScore({ scoredAt: 1000 }),
      makeIndustryScore({ id: 2, scoredAt: 5000 }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: scores })

    const result = await industryScoreStore.getLatestByCode('SW801')
    expect(result?.scoredAt).toBe(5000)
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeIndustryScore()])

    const result = await industryScoreStore.list()
    expect(result).toHaveLength(1)
  })
})
