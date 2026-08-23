/**
 * @test_id V9-TEST-UT-MOCK-001
 * Mock 假绿灯修复 + 自适应链集成测试
 *
 * 覆盖：
 *   1. resolveQuoteChain / resolveKlineChain / buildDefaultSourcePriority 的 mock 门禁
 *   2. getQuoteWithConfig / getKlineWithConfig / getBatchQuotes：
 *      allowMockFallback=false 时全源失败返回 success:false
 *   3. runSingleTrace（quote 维度）：mock 禁用时不落库、不计成功；允许时行为不变
 *   4. 自适应排序：冷启动顺序不变；积累指标后健康源提前
 *
 * @module tests/__tests__/services/mockFallbackPolicy.spec
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 基础设施 ────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

/** hoisted mock 函数集（vi.mock factory 提升执行，必须经 vi.hoisted 声明） */
const mocks = vi.hoisted(() => ({
  forward: vi.fn(),
  tencentQuote: vi.fn(),
  sinaQuote: vi.fn(),
  tencentKline: vi.fn(),
  sinaBatch: vi.fn(),
  tencentBatch: vi.fn(),
  neteaseHistory: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: mocks.forward },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() },
}))

vi.mock('@/services/data-collector/directDataAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/data-collector/directDataAPI')>()
  return {
    ...actual,
    tencentQuote: mocks.tencentQuote,
    sinaQuote: mocks.sinaQuote,
    tencentKline: mocks.tencentKline,
    sinaBatchQuotes: mocks.sinaBatch,
    tencentBatchQuotes: mocks.tencentBatch,
    neteaseHistory: mocks.neteaseHistory,
  }
})

vi.mock('@/services/data-collector/tushareProvider', () => ({
  tushareDaily: vi.fn().mockResolvedValue([]),
  tushareStockBasic: vi.fn().mockResolvedValue([]),
  fromTushareCode: (s: string) => s,
}))

vi.mock('@/services/data-collector/crawlerProvider', () => ({
  fetchBaostockKline: vi.fn().mockResolvedValue([]),
}))

// ── Mock pipeline 的重依赖（quote/kline 链路不经过它们） ────

vi.mock('@/services/data-collector/tracePersistenceService', () => ({
  saveTraceRecord: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/services/data-collector/missingReportDetector', () => ({
  detect: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/services/data-collector/multiSourceFetcher', () => ({
  fetchDimensionData: vi.fn().mockResolvedValue(null),
}))

import {
  getQuoteWithConfig,
  getKlineWithConfig,
  getBatchQuotes,
} from '@/services/data-collector/dataSourceOrchestrator'
import {
  resolveQuoteChain,
  resolveKlineChain,
  buildDefaultSourcePriority,
  upgradeDimensionsToPipeline,
  runSingleTrace,
  createDefaultCollectionConfig,
} from '@/services/data-collector/collectionPipeline'
import {
  resetAdaptiveOrchestrator,
  recordSourceResult,
} from '@/services/data-collector/adaptiveSourceOrchestrator'
import type {
  CollectionConfig,
  DimensionPipelineConfig,
} from '@/types/modules/collection.types'

// ── 测试配置构造 ─────────────────────────────────────────────

function makeDimension(overrides: Partial<DimensionPipelineConfig>): DimensionPipelineConfig {
  return {
    code: '01',
    name: '实时行情',
    enabled: true,
    frequency: 'realtime',
    batchSize: 50,
    sources: ['ifind'],
    cacheTtl: 5,
    storageType: 'full',
    fields: ['price'],
    importance: 'critical',
    sourcePriority: [
      { id: 'tencent', priority: 1, enabled: true },
      { id: 'sina', priority: 2, enabled: true },
      { id: 'mock', priority: 3, enabled: true },
    ],
    concurrency: 1,
    retryPolicy: { maxRetries: 2, backoffMultiplier: 2, initialDelayMs: 500 },
    timeoutPolicy: { requestTimeoutMs: 5000, dimensionTimeoutMs: 30000 },
    fallbackPolicy: { allowFallback: true, allowMockFallback: true, alertFailureRate: 80 },
    ...overrides,
  }
}

function makeConfig(dimension: DimensionPipelineConfig): CollectionConfig {
  const config = createDefaultCollectionConfig()
  return { ...config, dimensions: [dimension], historyDays: 30 }
}

beforeEach(() => {
  resetAdaptiveOrchestrator()
  mocks.forward.mockReset()
  mocks.forward.mockResolvedValue({ success: true, data: {} })
  mocks.tencentQuote.mockReset()
  mocks.tencentQuote.mockRejectedValue(new Error('tencent down'))
  mocks.sinaQuote.mockReset()
  mocks.sinaQuote.mockRejectedValue(new Error('sina down'))
  mocks.tencentKline.mockReset()
  mocks.tencentKline.mockResolvedValue([])
  mocks.sinaBatch.mockReset()
  mocks.sinaBatch.mockResolvedValue([])
  mocks.tencentBatch.mockReset()
  mocks.tencentBatch.mockResolvedValue([])
})

// ── 1. 链解析的 mock 门禁 ────────────────────────────────────

describe('链解析 mock 门禁', () => {
  it('allowMockFallback=true 时 resolveQuoteChain 保留 mock', () => {
    const dim = makeDimension({})
    expect(resolveQuoteChain(dim)).toEqual(['tencent', 'sina', 'mock'])
    expect(resolveKlineChain(dim)).toEqual(['tencent', 'sina', 'mock'])
  })

  it('allowMockFallback=false 时 resolveQuoteChain / resolveKlineChain 剔除 mock', () => {
    const dim = makeDimension({
      fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 80 },
    })
    expect(resolveQuoteChain(dim)).toEqual(['tencent', 'sina'])
    expect(resolveKlineChain(dim)).toEqual(['tencent', 'sina'])
  })

  it('buildDefaultSourcePriority 在 allowMockFallback=false 时不注入 mock', () => {
    const dim = makeDimension({ sourcePriority: [] })
    const withMock = buildDefaultSourcePriority(dim, true).map((i) => i.id)
    const withoutMock = buildDefaultSourcePriority(dim, false).map((i) => i.id)
    expect(withMock).toContain('mock')
    expect(withoutMock).not.toContain('mock')
    expect(withoutMock.length).toBeGreaterThan(0)
  })

  it('upgradeDimensionsToPipeline 在 dev（非 PROD）默认允许 mock', () => {
    const dim = makeDimension({ sourcePriority: [] })
    const [upgraded] = upgradeDimensionsToPipeline([dim])
    expect(upgraded?.fallbackPolicy.allowMockFallback).toBe(true)
    expect(upgraded?.sourcePriority.map((i) => i.id)).toContain('mock')
  })
})

// ── 2. 编排器层 mock 门禁 ────────────────────────────────────

describe('orchestrator mock 门禁', () => {
  it('getQuoteWithConfig：allowMockFallback=false 全源失败返回 success:false', async () => {
    const result = await getQuoteWithConfig('000001.SZ', {
      sourcePriority: ['tencent', 'sina'],
      allowMockFallback: false,
    })
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain('Mock 兜底已禁用')
  })

  it('getQuoteWithConfig：允许 mock 时返回 success:true 且 source=mock（血缘正确）', async () => {
    const result = await getQuoteWithConfig('000001.SZ', {
      sourcePriority: ['tencent', 'sina'],
      allowMockFallback: true,
    })
    expect(result.success).toBe(true)
    expect(result.source).toBe('mock')
    expect(result.data).not.toBeNull()
  })

  it('getKlineWithConfig：allowMockFallback=false 全源失败返回 success:false', async () => {
    const result = await getKlineWithConfig('000001.SZ', 30, {
      sourcePriority: ['tencent'],
      allowMockFallback: false,
    })
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain('Mock 兜底已禁用')
  })

  it('getKlineWithConfig：允许 mock 时 source=mock', async () => {
    const result = await getKlineWithConfig('000001.SZ', 30, {
      sourcePriority: ['tencent'],
      allowMockFallback: true,
    })
    expect(result.success).toBe(true)
    expect(result.source).toBe('mock')
    expect(result.data?.length).toBe(30)
  })

  it('getBatchQuotes：allowMockFallback=false 全源失败返回 success:false', async () => {
    const result = await getBatchQuotes(['000001.SZ'], { allowMockFallback: false })
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain('Mock 兜底已禁用')
  })

  it('getBatchQuotes：允许 mock 时 source=mock 且行为不变', async () => {
    const result = await getBatchQuotes(['000001.SZ', '600519.SH'])
    expect(result.success).toBe(true)
    expect(result.source).toBe('mock')
    expect(result.data?.length).toBe(2)
  })
})

// ── 3. pipeline 层：mock 禁用不落库 ──────────────────────────

describe('runSingleTrace mock 假绿灯修复', () => {
  it('allowMockFallback=false：全源失败 → success:false 且 dataBridge.forward 零调用', async () => {
    const dim = makeDimension({
      fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 80 },
    })
    const result = await runSingleTrace({
      symbol: '000001',
      dimensionCode: '01',
      config: makeConfig(dim),
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Mock 兜底已禁用')
    expect(mocks.forward).not.toHaveBeenCalled()
  })

  it('allowMockFallback=true：行为不变，mock 数据落库且 source=mock', async () => {
    const dim = makeDimension({})
    const result = await runSingleTrace({
      symbol: '000001',
      dimensionCode: '01',
      config: makeConfig(dim),
    })
    expect(result.success).toBe(true)
    expect(result.source).toBe('mock')
    expect(mocks.forward).toHaveBeenCalled()
    // 血缘：写入 payload 的 dataProvenance 必须为 mock
    const payload = mocks.forward.mock.calls[0]?.[0]?.payload as { dataProvenance?: string } | undefined
    expect(payload?.dataProvenance).toBe('mock')
  })
})

// ── 4. 自适应排序接入 ────────────────────────────────────────

describe('orchestrator 自适应排序', () => {
  it('冷启动：链顺序保持配置原顺序（tencent 先被尝试）', async () => {
    await getQuoteWithConfig('000001.SZ', { sourcePriority: ['tencent', 'sina'] })
    const tencentOrder = mocks.tencentQuote.mock.invocationCallOrder[0] ?? 0
    const sinaOrder = mocks.sinaQuote.mock.invocationCallOrder[0] ?? 0
    expect(tencentOrder).toBeLessThan(sinaOrder)
  })

  it('积累指标后：健康源（sina 成功）被排到失败源（tencent）前面', async () => {
    // 预置指标：tencent 连续失败，sina 持续成功
    for (let i = 0; i < 5; i += 1) {
      recordSourceResult('tencent', { success: false, isMock: false, latencyMs: 5000, completeness: 0 })
      recordSourceResult('sina', { success: true, isMock: false, latencyMs: 100, completeness: 1 })
    }
    mocks.tencentQuote.mockClear()
    mocks.sinaQuote.mockClear()

    await getQuoteWithConfig('000001.SZ', { sourcePriority: ['tencent', 'sina'] })
    const tencentOrder = mocks.tencentQuote.mock.invocationCallOrder[0] ?? 0
    const sinaOrder = mocks.sinaQuote.mock.invocationCallOrder[0] ?? 0
    // tencent 连续失败后可能被 orchestrator 直接跳过（未调用，order=0），
    // 此时只验证健康源 sina 被调用；若 tencent 也被调用则要求 sina 排前面。
    expect(sinaOrder).toBeGreaterThan(0)
    if (tencentOrder > 0) {
      expect(sinaOrder).toBeLessThan(tencentOrder)
    }
  })

  it('采集调用积累 EWMA 指标：成功源后续排名提升', async () => {
    // 第一轮：tencent 成功（快），sina 失败
    mocks.tencentQuote.mockResolvedValueOnce({
      symbol: '000001.SZ', name: '平安银行', price: 10, change: 0.1, changePercent: 1,
      open: 9.9, high: 10.1, low: 9.8, volume: 1000, amount: 10000, timestamp: Date.now(),
    })
    const first = await getQuoteWithConfig('000001.SZ', { sourcePriority: ['sina', 'tencent'] })
    expect(first.success).toBe(true)
    expect(first.source).toBe('tencent')

    // 第二轮：sina 持续失败而 tencent 已成功过一次 → tencent 应排在 sina 前
    mocks.tencentQuote.mockClear()
    mocks.sinaQuote.mockClear()
    mocks.tencentQuote.mockRejectedValue(new Error('tencent down'))
    await getQuoteWithConfig('000001.SZ', { sourcePriority: ['sina', 'tencent'] })
    const tencentOrder = mocks.tencentQuote.mock.invocationCallOrder[0] ?? 0
    const sinaOrder = mocks.sinaQuote.mock.invocationCallOrder[0] ?? 0
    // P0-1 接通重试后（2026-08-22）：第一轮 sina 按 maxRetries=2 重试 3 次全部失败，
    // 连续失败达熔断阈值（failureThreshold=3）被置 open，第二轮直接被跳过（order=0）——
    // 这是重试×熔断交互的预期行为。此时仅验证健康源 tencent 被调用；
    // 若 sina 未被熔断也调用，则要求已成功过一次的 tencent 排在 sina 前（EWMA 提升）。
    expect(tencentOrder).toBeGreaterThan(0)
    if (sinaOrder > 0) {
      expect(tencentOrder).toBeLessThan(sinaOrder)
    }
  })
})
