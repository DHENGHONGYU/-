/**
 * 降级链装饰器单元测试
 *
 * 覆盖目标：resilienceChain.ts 100% 行/分支覆盖率
 *
 * 测试范围：
 *   1. fetchQuote — 首源成功 / 中间降级 / 全降级Mock / AbortError / 空返回降级
 *   2. fetchKline — 首源成功 / 中间降级 / 全降级Mock / 空数组降级
 *   3. isAbortError — AbortError / 普通Error / 非Error
 *
 * 策略：使用 vi.spyOn mock MarketDataFetcher.fetchQuoteBySource / fetchKlineBySource
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MarketDataFetcher } from '@/services/fetcher/orchestrator/adapters/marketDataFetcher'
import { ResilienceChain } from '@/services/fetcher/orchestrator/resilienceChain'
import { QUOTE_FALLBACK_CHAIN, KLINE_FALLBACK_CHAIN } from '@/services/fetcher/orchestrator/ports'
import type { StockQuote, KlineItem } from '@/services/fetcher/directDataAPI'

// ============================================================
// 测试常量（禁止 magic numbers）
// ============================================================

const MOCK_PRICE = 100
const MOCK_CHANGE = 1
const MOCK_OPEN = 99
const MOCK_HIGH = 101
const MOCK_LOW = 98
const MOCK_VOLUME = 1000000
const MOCK_AMOUNT = 100000000
const MOCK_KLINE_COUNT = 3
const KLINE_DAYS = 30
/** 非 Error 类型的测试值 */
const NON_ERROR_VALUE = 42

// ============================================================
// 测试工具
// ============================================================

function createMockQuote(code: string, source: StockQuote['source'] = 'tencent'): StockQuote {
  return {
    code,
    name: `TEST_${code}`,
    price: MOCK_PRICE,
    change: MOCK_CHANGE,
    changePercent: MOCK_CHANGE,
    open: MOCK_OPEN,
    high: MOCK_HIGH,
    low: MOCK_LOW,
    prevClose: MOCK_OPEN,
    volume: MOCK_VOLUME,
    amount: MOCK_AMOUNT,
    timestamp: Date.now(),
    source,
  }
}

function createMockKline(count = MOCK_KLINE_COUNT): KlineItem[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    open: MOCK_PRICE + i,
    high: MOCK_HIGH + i,
    low: MOCK_LOW + i,
    close: MOCK_PRICE + i,
    volume: MOCK_VOLUME,
    amount: MOCK_AMOUNT,
  }))
}

/** 创建 AbortError */
function createAbortError(): Error {
  const err = new Error('The operation was aborted')
  err.name = 'AbortError'
  return err
}

// ============================================================
// fetchQuote 测试
// ============================================================

describe('ResilienceChain - fetchQuote()', () => {
  let fetcher: MarketDataFetcher
  let chain: ResilienceChain

  beforeEach(() => {
    fetcher = new MarketDataFetcher()
    chain = new ResilienceChain(fetcher)
    vi.spyOn(fetcher, 'fetchQuoteBySource')
    vi.spyOn(fetcher, 'fetchKlineBySource')
  })

  it('首源(tencent)成功 → 直接返回, 不降级', async () => {
    const quote = createMockQuote('600519', 'tencent')
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>).mockResolvedValue(quote)

    const result = await chain.fetchQuote('600519')

    expect(result).toEqual(quote)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledWith('tencent', '600519')
  })

  it('首源失败 → 降级到第二个源(sina)成功', async () => {
    const sinaQuote = createMockQuote('600519', 'sina')
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('tencent timeout'))
      .mockResolvedValueOnce(sinaQuote)

    const result = await chain.fetchQuote('600519')

    expect(result).toEqual(sinaQuote)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(2)
    expect(fetcher.fetchQuoteBySource).toHaveBeenNthCalledWith(1, 'tencent', '600519')
    expect(fetcher.fetchQuoteBySource).toHaveBeenNthCalledWith(2, 'sina', '600519')
  })

  it('前两个源失败 → 降级到第三个源(akshare)成功', async () => {
    const akshareQuote = createMockQuote('600519', 'akshare')
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('tencent fail'))
      .mockRejectedValueOnce(new Error('sina fail'))
      .mockResolvedValueOnce(akshareQuote)

    const result = await chain.fetchQuote('600519')

    expect(result).toEqual(akshareQuote)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(3)
  })

  it('所有源失败 → 返回 Mock 数据 (source="mock")', async () => {
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('all sources failed'))

    const result = await chain.fetchQuote('600519')

    expect(result.source).toBe('mock')
    expect(result.code).toBe('600519')
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(QUOTE_FALLBACK_CHAIN.length)
  })

  it('AbortError(超时) → 降级到下一个源', async () => {
    const sinaQuote = createMockQuote('600519', 'sina')
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(createAbortError())
      .mockResolvedValueOnce(sinaQuote)

    const result = await chain.fetchQuote('600519')

    expect(result).toEqual(sinaQuote)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(2)
  })

  it('返回空(null/undefined) → 降级到下一个源', async () => {
    // fetchQuoteBySource 返回 falsy 值时应降级
    const sinaQuote = createMockQuote('600519', 'sina')
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(sinaQuote)

    const result = await chain.fetchQuote('600519')

    expect(result).toEqual(sinaQuote)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(2)
  })

  it('降级链末端失败 → 仍返回 Mock', async () => {
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null as never) // tencent 空
      .mockRejectedValueOnce(new Error('sina fail')) // sina 异常
      .mockResolvedValueOnce(null as never) // akshare 空
      // mock 源: fetchQuoteBySource 也会被调用, 返回 mock 数据
      .mockResolvedValueOnce(createMockQuote('600519', 'mock'))

    const result = await chain.fetchQuote('600519')

    // 降级链中 mock 源被调用, 返回 mock 数据
    expect(result.source).toBe('mock')
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(4)
  })

  it('非 Error 类型异常 → 降级到下一个源', async () => {
    const sinaQuote = createMockQuote('600519', 'sina')
    ;(fetcher.fetchQuoteBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce('string error')
      .mockResolvedValueOnce(sinaQuote)

    const result = await chain.fetchQuote('600519')

    expect(result).toEqual(sinaQuote)
    expect(fetcher.fetchQuoteBySource).toHaveBeenCalledTimes(2)
  })
})

// ============================================================
// fetchKline 测试
// ============================================================

describe('ResilienceChain - fetchKline()', () => {
  let fetcher: MarketDataFetcher
  let chain: ResilienceChain

  beforeEach(() => {
    fetcher = new MarketDataFetcher()
    chain = new ResilienceChain(fetcher)
    vi.spyOn(fetcher, 'fetchQuoteBySource')
    vi.spyOn(fetcher, 'fetchKlineBySource')
  })

  it('首源(netease)成功 → 直接返回', async () => {
    const kline = createMockKline(5)
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>).mockResolvedValue(kline)

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result).toEqual(kline)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledWith('netease', '600519', KLINE_DAYS)
  })

  it('首源失败 → 降级到第二个源(tencent)成功', async () => {
    const kline = createMockKline(3)
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('netease fail'))
      .mockResolvedValueOnce(kline)

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result).toEqual(kline)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(2)
    expect(fetcher.fetchKlineBySource).toHaveBeenNthCalledWith(2, 'tencent', '600519', KLINE_DAYS)
  })

  it('所有源失败 → 返回 Mock K线', async () => {
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('all fail'))

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result.length).toBeGreaterThan(0)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(KLINE_FALLBACK_CHAIN.length)
  })

  it('返回空数组 → 降级到下一个源', async () => {
    const kline = createMockKline(3)
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // netease 返回空
      .mockResolvedValueOnce(kline) // tencent 有数据

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result).toEqual(kline)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(2)
  })

  it('AbortError(超时) → 降级到下一个源', async () => {
    const kline = createMockKline(3)
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(createAbortError())
      .mockResolvedValueOnce(kline)

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result).toEqual(kline)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(2)
  })

  it('降级链末端失败 → 仍返回 Mock', async () => {
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // netease 空
      .mockRejectedValueOnce(new Error('tencent fail')) // tencent 异常
      .mockResolvedValueOnce([]) // akshare 空
      // mock 源被调用
      .mockResolvedValueOnce(createMockKline(KLINE_DAYS))

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result.length).toBeGreaterThan(0)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(4)
  })

  it('非 Error 类型异常 → 降级', async () => {
    const kline = createMockKline(3)
    ;(fetcher.fetchKlineBySource as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(NON_ERROR_VALUE as never)
      .mockResolvedValueOnce(kline)

    const result = await chain.fetchKline('600519', KLINE_DAYS)

    expect(result).toEqual(kline)
    expect(fetcher.fetchKlineBySource).toHaveBeenCalledTimes(2)
  })
})

