/**
 * @test_id V9-TEST-NEW-001
 * @description collectionProgressService 正向/逆向覆盖率
 *
 * 正向：验证 dataBridge.query 成功时返回完整 progress（含维度状态、百分比、评级）
 * 逆向：验证 dataBridge.query 被拒（ACL deny）时 catch 路径返回全 'none' 空进度
 *
 * 逆向测试是 2026-08-02 pool→trace_records ACL 修复的防退化护栏：
 * 若未来有人误删 ACL_MATRIX[pool].read 中的 trace_records，
 * UI 应展示 0%/较差（catch 保障），而非崩溃/undefined。
 *
 * @created 2026-08-02
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getCollectionProgress } from './collectionProgressService'
import type { CollectionTraceSpan } from '@/types/modules/collection.types'

// ── mock logger ──
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ── mock dataBridge ──
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: (...args: unknown[]) => mockQuery(...args),
    forward: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    invalidateAll: vi.fn(),
    invalidateCache: vi.fn(),
  },
  ENVELOPE_ACTION: {},
  STORE_NAME: {},
  MODULE_ID: { pool: 'pool' },
}))

// ── 辅助：构建 trace span ──
function makeSpan(
  code: string,
  result: 'success' | 'fail' | 'partial',
  startedAt: number,
): CollectionTraceSpan {
  return {
    traceId: `trace-${code}`,
    symbol: '000858.SZ',
    dimensionCode: code,
    result,
    startedAt,
    completedAt: startedAt + 500,
    totalDurationMs: 500,
    stages: [],
    fallbackCount: 0,
    error: result === 'fail' ? '数据源不可用' : undefined,
    dataQuality: result === 'success' ? 0.95 : 0,
    parentTaskId: 'task-1',
  } as CollectionTraceSpan
}

// ── 测试套件 ──
describe('collectionProgressService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ================================================================
  // 正向：正常读取 trace → 进度正确
  // ================================================================
  it('正常读取 trace_records → 返回维度状态 + 完成百分比 + 质量评级', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      data: [
        makeSpan('01_basic', 'success', 1000),
        makeSpan('02_kline', 'success', 1000),
        makeSpan('03_chip', 'fail', 1000),
        makeSpan('04_events', 'success', 1000),
        makeSpan('05_news', 'success', 1000),
        makeSpan('06_industry', 'fail', 1000),
        makeSpan('07_index', 'success', 1000),
      ],
    })

    const progress = await getCollectionProgress('000858.SZ')

    expect(progress.symbol).toBe('000858.SZ')
    expect(progress.totalDimensions).toBe(7)
    expect(progress.completedCount).toBe(5) // 5 success, 2 fail
    // completionPercent = round(5/7*100) = 71
    expect(progress.completionPercent).toBe(71)
    // 5/7 ≈ 71% → >= 70% → 'good'
    expect(progress.qualityRating).toBe('good')

    // 各维度状态
    expect(progress.dimensions.find((d) => d.code === '01_basic')?.status).toBe('success')
    expect(progress.dimensions.find((d) => d.code === '03_chip')?.status).toBe('fail')
    expect(progress.dimensions.find((d) => d.code === '07_index')?.status).toBe('success')
  })

  // ================================================================
  // 正向：空 trace → 全 none
  // ================================================================
  it('trace_records 为空（未采集）→ 全维度 none、0%', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const progress = await getCollectionProgress('000858.SZ')

    expect(progress.totalDimensions).toBe(7)
    expect(progress.completedCount).toBe(0)
    expect(progress.completionPercent).toBe(0)
    expect(progress.qualityRating).toBe('poor')
    expect(progress.dimensions.every((d) => d.status === 'none')).toBe(true)
  })

  // ================================================================
  // 逆向：ACL 拒绝（dataBridge query reject）→ catch 全 none fallback
  // ⚠️ 关键防退化测试：如果 pool.read 中误删 trace_records，
  //    getCollectionProgress 不应崩溃而应 fallback 到 0%/较差。
  // ================================================================
  it('ACL 拒绝（query reject）→ catch 返回全 none、0%、poor（不崩溃）', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Module pool cannot SELECT on store trace_records'))

    const progress = await getCollectionProgress('000858.SZ')

    // 不应抛出异常——catch 捕获并返回 fallback
    expect(progress.symbol).toBe('000858.SZ')
    expect(progress.totalDimensions).toBe(7)
    expect(progress.completedCount).toBe(0)
    expect(progress.completionPercent).toBe(0)
    expect(progress.qualityRating).toBe('poor')
    expect(progress.dimensions.every((d) => d.status === 'none')).toBe(true)
  })

  // ================================================================
  // 逆向：query 返回 success=false → 应视为空 trace
  // ================================================================
  it('query 成功但 data 为空 → 全 none', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: undefined })

    const progress = await getCollectionProgress('000858.SZ')

    expect(progress.completedCount).toBe(0)
    expect(progress.completionPercent).toBe(0)
    expect(progress.dimensions.every((d) => d.status === 'none')).toBe(true)
  })

  // ================================================================
  // 正向：partial 维度处理
  // ================================================================
  it('partial 维度计入 completedCount=0、影响评级', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      data: [
        makeSpan('01_basic', 'success', 1000),
        makeSpan('02_kline', 'partial', 1000),
        makeSpan('05_news', 'partial', 1000),
      ],
    })

    const progress = await getCollectionProgress('000858.SZ')
    // 仅 1 success、2 partial（不计成功）、4 none
    expect(progress.completedCount).toBe(1)
    // 1/7≈14% → <40% → 'poor'
    expect(progress.qualityRating).toBe('poor')
    expect(progress.dimensions.find((d) => d.code === '02_kline')?.status).toBe('partial')
  })

  // ================================================================
  // 正向：同维度多次采集取最新（completedAt 最新优先）
  // ================================================================
  it('同维度多条 trace 取最新 → 状态以 completedAt 最大者为准', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      data: [
        makeSpan('01_basic', 'fail', 500),     // 较旧
        makeSpan('01_basic', 'success', 2000),  // 最新
      ],
    })

    const progress = await getCollectionProgress('000858.SZ')
    const dim = progress.dimensions.find((d) => d.code === '01_basic')
    expect(dim?.status).toBe('success')
  })
})
