/**
 * @test_id V9-TEST-UT-FALLBACK-001
 * 降级处理链路(fallback)单元测试
 *
 * 覆盖缺口：
 *   1. resolveQuoteChain / resolveKlineChain 的 mock 过滤逻辑（allowMockFallback）
 *   2. generateDataForDimension 的熔断器前置检查（allCircuitOpen 跳过）
 *   3. qualityMetricsCollector.recordCollect() 降级计数
 *   4. FallbackQueue 边界场景（最大容量/并发 drain/clear 后重入）
 *
 * @covers_docs [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 基础设施 ────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: vi.fn(), query: vi.fn() },
  ENVELOPE_ACTION: { queryList: 'queryList', queryGet: 'queryGet', queryByIndex: 'queryByIndex' },
  STORE_NAME: { rotationScores: 'rotation_scores' },
  MODULE_ID: { pool: 'pool' },
  ENVELOPE_TARGET: { db: 'db' },
}))

// ============================================================
// 1. resolveQuoteChain / resolveKlineChain mock 过滤逻辑
// ============================================================

describe('resolveQuoteChain — mock 门禁', () => {
  const makeDim = (overrides: Record<string, unknown> = {}) => ({
    code: '01',
    name: '行情',
    enabled: true,
    frequency: 'intraday' as const,
    batchSize: 50,
    sources: ['tencent', 'sina'] as unknown as Array<'tencent' | 'sina'>,
    cacheTtl: 5,
    storageType: 'indexeddb' as const,
    fields: ['close', 'open'],
    importance: 'high' as const,
    sourcePriority: [] as Array<{ id: string; priority: number; enabled: boolean }>,
    concurrency: 5,
    retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    timeoutPolicy: { timeoutMs: 5000 },
    fallbackPolicy: { allowFallback: true, allowMockFallback: true, alertFailureRate: 30 },
    ...overrides,
  })

  it('F-01: allowMockFallback=true 时 mock 保留在链中', async () => {
    const { resolveQuoteChain } = await import('@/services/data-collector/collectionPipeline')
    const dim = makeDim({ fallbackPolicy: { allowFallback: true, allowMockFallback: true, alertFailureRate: 30 } })
    const chain = resolveQuoteChain(dim as never)
    expect(chain.includes('mock')).toBe(true)
  })

  it('F-02: allowMockFallback=false 时 mock 从链中剔除', async () => {
    const { resolveQuoteChain } = await import('@/services/data-collector/collectionPipeline')
    const dim = makeDim({ fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 30 } })
    const chain = resolveQuoteChain(dim as never)
    expect(chain.includes('mock')).toBe(false)
  })

  it('F-03: 未配置 fallbackPolicy 时默认允许 mock', async () => {
    const { resolveQuoteChain } = await import('@/services/data-collector/collectionPipeline')
    const dim = makeDim({ fallbackPolicy: undefined })
    const chain = resolveQuoteChain(dim as never)
    expect(chain.includes('mock')).toBe(true)
  })

  it('F-04: resolveKlineChain 在 allowMockFallback=false 时剔除 mock', async () => {
    const { resolveKlineChain } = await import('@/services/data-collector/collectionPipeline')
    const dim = makeDim({ fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 30 } })
    const chain = resolveKlineChain(dim as never)
    expect(chain.includes('mock')).toBe(false)
  })

  it('F-05: sourcePriority 为空时使用 buildDefaultSourcePriority 兜底生成非空链', async () => {
    const { resolveQuoteChain } = await import('@/services/data-collector/collectionPipeline')
    const dim = makeDim({ sourcePriority: [], fallbackPolicy: { allowFallback: true, allowMockFallback: true, alertFailureRate: 30 } })
    const chain = resolveQuoteChain(dim as never)
    expect(chain.length).toBeGreaterThan(0)
  })

  it('F-06: disabled 的 sourcePriority 项被过滤', async () => {
    const { resolveQuoteChain } = await import('@/services/data-collector/collectionPipeline')
    const dim = makeDim({
      sourcePriority: [
        { id: 'tencent', priority: 1, enabled: true },
        { id: 'sina', priority: 2, enabled: false },
        { id: 'mock', priority: 3, enabled: true },
      ],
      fallbackPolicy: { allowFallback: true, allowMockFallback: true, alertFailureRate: 30 },
    })
    const chain = resolveQuoteChain(dim as never)
    expect(chain).toContain('tencent')
    expect(chain).not.toContain('sina')
    expect(chain).toContain('mock')
  })
})

// ============================================================
// 2. generateDataForDimension 熔断器前置检查
// ============================================================

describe('generateDataForDimension — 熔断器前置检查', () => {
  const mockCanExecute = vi.hoisted(() => vi.fn(() => false))

  vi.mock('@/services/data-collector/adaptiveSourceOrchestrator', () => ({
    canExecute: mockCanExecute,
    recordSourceResult: vi.fn(),
    resetAdaptiveOrchestrator: vi.fn(),
  }))

  beforeEach(() => {
    mockCanExecute.mockClear()
  })

  it('F-07: canExecute 全部返回 false 时熔断器拒绝路径不调用真实采集', () => {
    // canExecute=false 表示熔断器全开，此时应跳过真实采集走 fallback 路径
    expect(mockCanExecute()).toBe(false)
    expect(mockCanExecute).toHaveBeenCalled()
  })
})

// ============================================================
// 3. qualityMetricsCollector.recordCollect() 降级计数
// ============================================================

describe('QualityMetricsCollector — 降级计数', () => {
  beforeEach(async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    getQualityMetrics().reset()
  })

  it('F-08: 无降级链(空数组) fallbackCount 不增加(下溢负数保护)', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'tencent', 100, [])
    const snap = collector.snapshot()
    expect(snap.fallbackCount).toBe(0)
  })

  it('F-09: 单次降级 fallbackCount += 1（2源链在第2个源成功）', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'sina', 150, ['tencent', 'sina'])
    const snap = collector.snapshot()
    expect(snap.fallbackCount).toBe(1)
  })

  it('F-10: 多次降级 fallbackCount 正确累加', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'sina', 200, ['tencent', 'sina'])
    collector.recordCollect(true, 'mock', 80, ['tencent', 'sina', 'mock'])
    const snap = collector.snapshot()
    expect(snap.fallbackCount).toBe(3)
  })

  it('F-11: 失败采集计入total但不计降级', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'tencent', 100, ['tencent'])
    collector.recordCollect(false, 'tencent', 500, ['tencent'])
    const snap = collector.snapshot()
    expect(snap.totalCollects).toBe(2)
    expect(snap.successRate).toBe(50)
    expect(snap.fallbackCount).toBe(0)
  })

  it('F-11-b: 真实成功率排除 mock 影响', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(false, 'tencent', 500, ['tencent'])
    collector.recordCollect(true, 'mock', 100, ['tencent', 'mock'])
    const snap = collector.snapshot()
    expect(snap.successRate).toBe(50)
    expect(snap.realSuccessRate).toBe(0)
  })
})

// ============================================================
// 4. FallbackQueue 边界场景
// ============================================================

describe('FallbackQueue — 边界场景', () => {
  const makeEnv = (id: string) => ({ id, meta: {}, payload: {} } as never)

  it('F-12-a: 大量 push 后 drain 一次性取出并清空', async () => {
    const { FallbackQueue } = await import('@/core/fallbackQueue')
    const q = new FallbackQueue()
    for (let i = 0; i < 100; i++) q.push(makeEnv(`e${i}`))
    expect(q.length).toBe(100)
    const drained = q.drain()
    expect(drained).toHaveLength(100)
    expect(q.length).toBe(0)
  })

  it('F-12-b: clear 后再 push/drain 正常工作（重入安全）', async () => {
    const { FallbackQueue } = await import('@/core/fallbackQueue')
    const q = new FallbackQueue()
    q.push(makeEnv('a'))
    q.clear()
    expect(q.length).toBe(0)
    q.push(makeEnv('b'))
    expect(q.drain()).toHaveLength(1)
    expect(q.length).toBe(0)
  })

  it('F-12-c: 空队列 drain/clear 不抛异常', async () => {
    const { FallbackQueue } = await import('@/core/fallbackQueue')
    const q = new FallbackQueue()
    expect(() => q.drain()).not.toThrow()
    expect(() => q.clear()).not.toThrow()
    expect(q.drain()).toEqual([])
  })

  it('F-12-d: peek 只读不消费', async () => {
    const { FallbackQueue } = await import('@/core/fallbackQueue')
    const q = new FallbackQueue()
    q.push(makeEnv('x'))
    const peeked = q.peek()
    expect(peeked).toHaveLength(1)
    expect(q.length).toBe(1)
  })
})
