import { describe, test, expect, vi, beforeEach } from 'vitest'
import { listStocks, listV6Scores } from './analysisService'
import type { Stock, V6Score } from '@/data/types'

// ============================================================
// vi.hoisted DataBridge mocks
// ============================================================

const { mockStocksList, mockV6ScoresList } = vi.hoisted(() => ({
  mockStocksList: vi.fn(),
  mockV6ScoresList: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn(async (request: { action: string; store: string }) => {
      if (request.action === 'QUERY_LIST' && request.store === 'stocks') {
        return { success: true, data: await mockStocksList() }
      }
      if (request.action === 'QUERY_LIST' && request.store === 'v6_scores') {
        return { success: true, data: await mockV6ScoresList() }
      }
      return { success: false, error: `unmocked query: ${request.action}/${request.store}` }
    }),
  },
}))

// ============================================================
// 测试数据
// ============================================================

const mockStocks: Stock[] = [
  {
    symbol: '600519',
    name: '贵州茅台',
    price: 1800,
    pe: 35,
    pb: 12,
    roe: 30,
    marketCap: 2200000000000,
    sector: '白酒',
    pool: 'research',
    researchStatus: 'watching',
    source: 'manual',
    dataVersion: 1,
  },
]

const mockV6Scores: V6Score[] = [
  {
    symbol: '600519',
    score: 4.2,
    factors: { 动量: 3.8, 估值: 4.5, 质量: 4.0, 情绪: 4.1 },
    algorithmVersion: 'v6.3',
    calculatedAt: Date.now(),
    dataVersion: 1,
  },
  {
    symbol: '000858',
    score: 3.8,
    factors: { 动量: 3.5, 估值: 4.0, 质量: 3.8, 情绪: 3.9 },
    algorithmVersion: 'v6.3',
    calculatedAt: Date.now(),
    dataVersion: 1,
  },
]

// ============================================================
// listStocks 测试
// ============================================================

describe('listStocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('成功返回数据', async () => {
    mockStocksList.mockResolvedValue(mockStocks)

    const result = await listStocks()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockStocks)
    expect(result.error).toBeUndefined()
    expect(mockStocksList).toHaveBeenCalledTimes(1)
  })

  test('dataLayer 返回空数组', async () => {
    mockStocksList.mockResolvedValue([])

    const result = await listStocks()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
  })

  test('dataLayer 抛异常，返回 { success: false, error }', async () => {
    const errorMessage = '数据库连接失败'
    mockStocksList.mockRejectedValue(new Error(errorMessage))

    const result = await listStocks()

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.data).toBeUndefined()
  })

  test('dataLayer 返回非 Error 对象，正确转换为字符串', async () => {
    mockStocksList.mockRejectedValue('字符串错误')

    const result = await listStocks()

    expect(result.success).toBe(false)
    expect(result.error).toBe('字符串错误')
  })
})

// ============================================================
// listV6Scores 测试
// ============================================================

describe('listV6Scores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('成功返回数据', async () => {
    mockV6ScoresList.mockResolvedValue(mockV6Scores)

    const result = await listV6Scores()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockV6Scores)
    expect(result.error).toBeUndefined()
    expect(mockV6ScoresList).toHaveBeenCalledTimes(1)
  })

  test('dataLayer 返回空数组', async () => {
    mockV6ScoresList.mockResolvedValue([])

    const result = await listV6Scores()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
  })

  test('dataLayer 抛异常', async () => {
    const errorMessage = 'V6评分数据获取失败'
    mockV6ScoresList.mockRejectedValue(new Error(errorMessage))

    const result = await listV6Scores()

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.data).toBeUndefined()
  })

  test('错误信息正确传递', async () => {
    const customError = new Error('自定义错误信息')
    mockV6ScoresList.mockRejectedValue(customError)

    const result = await listV6Scores()

    expect(result.success).toBe(false)
    expect(result.error).toBe('自定义错误信息')
  })
})
