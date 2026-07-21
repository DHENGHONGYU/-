/**
 * @fileoverview dataLayer — Score & Quote & Order 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：v6ScoreStore(5) / dailyQuoteStore(3) / orderStore(3) 共 11 个用例
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockQueryGetSuccess,
  mockQueryListSuccess,
  mockQueryFail,
  mockForwardSuccess,
  mockForwardFail,
  makeV6Score,
  makeDailyQuote,
  makeOrder,
} from './dataLayer.test-utils'
import { v6ScoreStore, dailyQuoteStore, orderStore } from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('v6ScoreStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()
    const result = await v6ScoreStore.save(makeV6Score())
    expect(result.success).toBe(true)
  })

  it('save: forward 失败', async () => {
    mockForwardFail('DB error')
    const result = await v6ScoreStore.save(makeV6Score())
    expect(result.success).toBe(false)
    expect(result.error).toBe('DB error')
  })

  it('get: 查询到评分', async () => {
    mockQueryGetSuccess(makeV6Score())
    const result = await v6ScoreStore.get('600519')
    expect(result?.score).toBe(85)
  })

  it('get: 查询失败返回 undefined', async () => {
    mockQueryFail('err')
    const result = await v6ScoreStore.get('600519')
    expect(result).toBeUndefined()
  })

  it('list: 返回全部评分', async () => {
    mockQueryListSuccess([makeV6Score()])
    const result = await v6ScoreStore.list()
    expect(result).toHaveLength(1)
  })
})

describe('dailyQuoteStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()
    const result = await dailyQuoteStore.save(makeDailyQuote())
    expect(result.success).toBe(true)
  })

  it('get: 查询到行情', async () => {
    mockQueryGetSuccess(makeDailyQuote())
    const result = await dailyQuoteStore.get('600519')
    expect(result?.symbol).toBe('600519')
  })

  it('get: 查询失败返回 undefined', async () => {
    mockQueryFail('err')
    const result = await dailyQuoteStore.get('600519')
    expect(result).toBeUndefined()
  })
})

describe('orderStore', () => {
  it('add: 成功创建订单', async () => {
    mockForwardSuccess()
    const result = await orderStore.add(makeOrder())
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('mock-id-001')
    expect(result.data?.createdAt).toBe(1700000000000)
  })

  it('add: forward 失败', async () => {
    mockForwardFail('写入失败')
    const result = await orderStore.add(makeOrder())
    expect(result.success).toBe(false)
  })

  it('list: 返回全部订单', async () => {
    mockQueryListSuccess([makeOrder()])
    const result = await orderStore.list()
    expect(result).toHaveLength(1)
  })
})
