import { describe, test, expect, vi, beforeEach } from 'vitest'
import { listStocks, listV6Scores } from './analysisService'
import { dataLayer } from '@/data/dataLayer'
import type { Stock, V6Score } from '@/data/types'

// ============================================================
// Mock dataLayer
// ============================================================

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: { list: vi.fn() },
    v6Scores: { list: vi.fn() },
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
    vi.mocked(dataLayer.stocks.list).mockResolvedValue(mockStocks)

    const result = await listStocks()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockStocks)
    expect(result.error).toBeUndefined()
    expect(dataLayer.stocks.list).toHaveBeenCalledTimes(1)
  })

  test('dataLayer 返回空数组', async () => {
    vi.mocked(dataLayer.stocks.list).mockResolvedValue([])

    const result = await listStocks()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
  })

  test('dataLayer 抛异常，返回 { success: false, error }', async () => {
    const errorMessage = '数据库连接失败'
    vi.mocked(dataLayer.stocks.list).mockRejectedValue(new Error(errorMessage))

    const result = await listStocks()

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.data).toBeUndefined()
  })

  test('dataLayer 返回非 Error 对象，正确转换为字符串', async () => {
    vi.mocked(dataLayer.stocks.list).mockRejectedValue('字符串错误')

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
    vi.mocked(dataLayer.v6Scores.list).mockResolvedValue(mockV6Scores)

    const result = await listV6Scores()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockV6Scores)
    expect(result.error).toBeUndefined()
    expect(dataLayer.v6Scores.list).toHaveBeenCalledTimes(1)
  })

  test('dataLayer 返回空数组', async () => {
    vi.mocked(dataLayer.v6Scores.list).mockResolvedValue([])

    const result = await listV6Scores()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
  })

  test('dataLayer 抛异常', async () => {
    const errorMessage = 'V6评分数据获取失败'
    vi.mocked(dataLayer.v6Scores.list).mockRejectedValue(new Error(errorMessage))

    const result = await listV6Scores()

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.data).toBeUndefined()
  })

  test('错误信息正确传递', async () => {
    const customError = new Error('自定义错误信息')
    vi.mocked(dataLayer.v6Scores.list).mockRejectedValue(customError)

    const result = await listV6Scores()

    expect(result.success).toBe(false)
    expect(result.error).toBe('自定义错误信息')
  })
})
