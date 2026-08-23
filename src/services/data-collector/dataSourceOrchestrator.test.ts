/**
 * @file dataSourceOrchestrator.test.ts — 行情/K 线降级编排器契约单测
 *
 * 评价整改 P0（2026-08-23）：为四层降级策略核心补充独立单测。
 * 覆盖契约：
 * 1. 配置链首源成功直接返回，不触碰后续源
 * 2. 单源按 retryPolicy 重试（1 + maxRetries 次）耗尽后才降级
 * 3. 熔断中（canExecute=false）的源直接跳过，不发请求
 * 4. akshare 占位恒返回 null，静默降级到下一源（浏览器环境契约）
 * 5. allowMockFallback=false：全源失败返回 success:false，绝不产假数据（生产门禁）
 * 6. allowMockFallback 缺省（true）：全源失败返回 source='mock'（血缘可区分）
 * 7. K 线链路同上双契约
 *
 * 所有外部依赖（数据源适配器 / DataBridge / eventBus / 自适应模块）全部 mock，
 * computePolicyBackoffMs 恒返回 0 保证测试确定性与时延。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 基础设施 mock ──
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/logHelpers', () => ({
  withLogging: (_module: string, _name: string, fn: unknown) => fn,
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: vi.fn() },
}))

vi.mock('@/services/storage/DeduplicationService', () => ({
  dedupRecords: (records: unknown[]) => records,
}))

// ── 数据源适配器 mock ──
vi.mock('./directDataAPI', () => ({
  tencentQuote: vi.fn(),
  tencentBatchQuotes: vi.fn(),
  tencentKline: vi.fn(),
  sinaQuote: vi.fn(),
  sinaBatchQuotes: vi.fn(),
  neteaseHistory: vi.fn(),
  quoteToStock: vi.fn(),
  klinesToDailyQuotes: vi.fn(),
}))

vi.mock('./tushareProvider', () => ({
  tushareDaily: vi.fn().mockResolvedValue([]),
  tushareStockBasic: vi.fn().mockResolvedValue([]),
  fromTushareCode: (v: string) => v,
}))

vi.mock('./tushareAdapter', () => ({
  mapDailyToQuote: vi.fn(),
  mapDailyToKlines: vi.fn().mockReturnValue([]),
}))

vi.mock('./crawlerProvider', () => ({
  fetchBaostockKline: vi.fn(),
}))

vi.mock('./qualityMetricsCollector', () => ({
  getQualityMetrics: () => ({
    recordCollect: vi.fn(),
    recordWrite: vi.fn(),
    refreshStats: vi.fn(),
  }),
}))

// ── 自适应模块 mock：熔断/重排/退避可控 ──
const canExecuteMock = vi.fn().mockReturnValue(true)
const orderChainAdaptiveMock = vi.fn().mockImplementation((chain: unknown[]) => chain)
const recordSourceResultMock = vi.fn()

vi.mock('./adaptiveSourceOrchestrator', () => ({
  canExecute: (...args: unknown[]) => canExecuteMock(...args),
  orderChainAdaptive: (...args: unknown[]) => orderChainAdaptiveMock(...args),
  recordSourceResult: (...args: unknown[]) => recordSourceResultMock(...args),
  // 退避恒 0：重试循环确定性且不拖慢测试（真实退避公式由
  // adaptiveSourceOrchestrator.test.ts 独立覆盖）
  computePolicyBackoffMs: () => 0,
}))

import { getQuoteWithConfig, getKlineWithConfig } from './dataSourceOrchestrator'
import { tencentQuote, sinaQuote, tencentKline } from './directDataAPI'

// ── 测试数据构造 ──
function fakeQuote(symbol: string) {
  return {
    symbol,
    name: `测试${symbol}`,
    price: 12.34,
    change: 0.12,
    changePercent: 0.98,
    open: 12.2,
    high: 12.5,
    low: 12.1,
    volume: 100000,
    amount: 1234567,
    timestamp: Date.now(),
  }
}

function fakeKline(days: number) {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026080${(i % 9) + 1}`,
    open: 10,
    high: 11,
    low: 9,
    close: 10.5,
    volume: 1000,
    amount: 10000,
  }))
}

/** 重试耗尽前不等待的确定性策略 */
const FAST_RETRY = { maxRetries: 1, initialDelayMs: 1, backoffMultiplier: 1 }
const NO_RETRY = { maxRetries: 0, initialDelayMs: 1, backoffMultiplier: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  canExecuteMock.mockReturnValue(true)
  orderChainAdaptiveMock.mockImplementation((chain: unknown[]) => chain)
})

describe('getQuoteWithConfig — 行情降级链契约', () => {
  it('首源成功直接返回，不触碰后续源', async () => {
    vi.mocked(tencentQuote).mockResolvedValue(fakeQuote('000001'))

    const result = await getQuoteWithConfig('000001', {
      sourcePriority: ['tencent', 'sina'],
      retryPolicy: NO_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('tencent')
    expect(result.data?.symbol).toBe('000001')
    expect(result.fallbackChain).toEqual(['tencent'])
    expect(tencentQuote).toHaveBeenCalledTimes(1)
    expect(sinaQuote).not.toHaveBeenCalled()
  })

  it('首源失败降级到次源，次源成功返回', async () => {
    vi.mocked(tencentQuote).mockResolvedValue(null)
    vi.mocked(sinaQuote).mockResolvedValue(fakeQuote('000002'))

    const result = await getQuoteWithConfig('000002', {
      sourcePriority: ['tencent', 'sina'],
      retryPolicy: NO_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('sina')
    expect(result.fallbackChain).toEqual(['tencent', 'sina'])
    expect(tencentQuote).toHaveBeenCalledTimes(1)
    expect(sinaQuote).toHaveBeenCalledTimes(1)
  })

  it('单源瞬时失败按 retryPolicy 重试（1 + maxRetries 次），中途成功即止', async () => {
    vi.mocked(tencentQuote)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fakeQuote('600000'))

    const result = await getQuoteWithConfig('600000', {
      sourcePriority: ['tencent'],
      retryPolicy: { maxRetries: 2, initialDelayMs: 1, backoffMultiplier: 1 },
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('tencent')
    expect(tencentQuote).toHaveBeenCalledTimes(3)
    expect(sinaQuote).not.toHaveBeenCalled()
  })

  it('maxRetries=0 时仅尝试 1 次，失败立即降级', async () => {
    vi.mocked(tencentQuote).mockResolvedValue(null)
    vi.mocked(sinaQuote).mockResolvedValue(fakeQuote('600001'))

    await getQuoteWithConfig('600001', {
      sourcePriority: ['tencent', 'sina'],
      retryPolicy: NO_RETRY,
    })

    expect(tencentQuote).toHaveBeenCalledTimes(1)
  })

  it('熔断中（canExecute=false）的源直接跳过，不发请求', async () => {
    canExecuteMock.mockImplementation((source: string) => source !== 'tencent')
    vi.mocked(sinaQuote).mockResolvedValue(fakeQuote('600002'))

    const result = await getQuoteWithConfig('600002', {
      sourcePriority: ['tencent', 'sina'],
      retryPolicy: FAST_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('sina')
    expect(tencentQuote).not.toHaveBeenCalled()
    expect(sinaQuote).toHaveBeenCalledTimes(1)
  })

  it("akshare 占位恒返回 null，静默降级到下一源（浏览器环境契约）", async () => {
    vi.mocked(sinaQuote).mockResolvedValue(fakeQuote('600003'))

    const result = await getQuoteWithConfig('600003', {
      sourcePriority: ['akshare', 'sina'],
      retryPolicy: NO_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('sina')
    expect(result.fallbackChain).toEqual(['akshare', 'sina'])
  })

  it('allowMockFallback=false 且全源失败：返回 success:false，绝不产假数据（生产门禁）', async () => {
    vi.mocked(tencentQuote).mockResolvedValue(null)
    vi.mocked(sinaQuote).mockResolvedValue(null)

    const result = await getQuoteWithConfig('000003', {
      sourcePriority: ['tencent', 'sina'],
      retryPolicy: NO_RETRY,
      allowMockFallback: false,
    })

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain('Mock 兜底已禁用')
  })

  it('allowMockFallback 缺省（开发态）：全源失败返回 source=mock 且血缘可区分', async () => {
    vi.mocked(tencentQuote).mockResolvedValue(null)
    vi.mocked(sinaQuote).mockResolvedValue(null)

    const result = await getQuoteWithConfig('000004', {
      sourcePriority: ['tencent', 'sina'],
      retryPolicy: NO_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('mock')
    expect(result.data).not.toBeNull()
    expect(result.error).toContain('Mock')
  })
})

describe('getKlineWithConfig — K 线降级链契约', () => {
  it('首源成功直接返回', async () => {
    vi.mocked(tencentKline).mockResolvedValue(fakeKline(5))

    const result = await getKlineWithConfig('000001', 5, {
      sourcePriority: ['tencent'],
      retryPolicy: NO_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('tencent')
    expect(result.data).toHaveLength(5)
  })

  it('allowMockFallback=false 且全源失败：返回 success:false（生产门禁）', async () => {
    vi.mocked(tencentKline).mockResolvedValue([])

    const result = await getKlineWithConfig('000005', 5, {
      sourcePriority: ['tencent'],
      retryPolicy: NO_RETRY,
      allowMockFallback: false,
    })

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain('Mock 兜底已禁用')
  })

  it('允许 mock 时全源失败：source=mock 且条数等于请求天数', async () => {
    vi.mocked(tencentKline).mockResolvedValue([])

    const result = await getKlineWithConfig('000006', 7, {
      sourcePriority: ['tencent'],
      retryPolicy: NO_RETRY,
    })

    expect(result.success).toBe(true)
    expect(result.source).toBe('mock')
    expect(result.data).toHaveLength(7)
  })

  it('空数组视为失败（防止零数据假绿灯），触发降级', async () => {
    vi.mocked(tencentKline).mockResolvedValue([])

    const result = await getKlineWithConfig('000007', 5, {
      sourcePriority: ['tencent'],
      retryPolicy: NO_RETRY,
      allowMockFallback: false,
    })

    expect(result.success).toBe(false)
  })
})
