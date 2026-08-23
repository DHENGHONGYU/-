/**
 * @test_id V9-TEST-UT-QUALITYMETRICSPERSISTENCE
 * @covers qualityMetricsPersistence.ts — 质量指标快照持久化服务（v37 新增，P0-2 整改）
 *
 * 验证目标：
 *   - 空窗口（无采集无写入）跳过快照持久化，返回 false
 *   - 有数据时经 DataBridge.forward 写入 quality_metrics_history
 *   - 信封三要素正确：MODULE_ID.fetcher / saveQualityMetricsHistory / ENVELOPE_TARGET.db
 *   - 写入失败仅记日志、不阻塞、返回 false（永不阻塞契约）
 *   - 记录字段完整性（主键 / 时间戳 / 核心指标）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ENVELOPE_ACTION, MODULE_ID } from '@/config/dbConfig'

// ── Mock：DataBridge.forward ──
vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: vi.fn().mockResolvedValue({ success: true }),
  },
}))

// ── Mock：qualityMetricsCollector 单例快照 ──
const { mockSnapshot } = vi.hoisted(() => ({
  mockSnapshot: {
    since: 1000,
    totalCollects: 0,
    successCollects: 0,
    mockCollects: 0,
    mockSuccesses: 0,
    successRate: 0,
    realSuccessRate: 0,
    completeness: 0,
    sourceCounts: {},
    fallbackCount: 0,
    writeSuccess: 0,
    writeTotal: 0,
    writeRate: 0,
    mockWrites: 0,
    avgLatency: 0,
    totalLatency: 0,
  } as Record<string, unknown>,
}))

vi.mock('@/services/data-collector/qualityMetricsCollector', () => ({
  getQualityMetrics: () => ({ snapshot: () => mockSnapshot }),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

async function getService() {
  const mod = await import('@/services/data-collector/qualityMetricsPersistence')
  const db = await import('@/core/databridge')
  return { persistQualitySnapshot: mod.persistQualitySnapshot, forward: vi.mocked(db.dataBridge.forward) }
}

// ── 夹具：构造一份"有数据"的快照 ──
function seedActiveSnapshot(): void {
  Object.assign(mockSnapshot, {
    since: 1000,
    totalCollects: 5,
    successCollects: 4,
    mockCollects: 1,
    mockSuccesses: 1,
    successRate: 80,
    realSuccessRate: 75,
    completeness: 92,
    sourceCounts: { tencent: 3, sina: 1, mock: 1 },
    fallbackCount: 1,
    writeSuccess: 4,
    writeTotal: 5,
    writeRate: 80,
    mockWrites: 0,
    avgLatency: 120,
    totalLatency: 600,
  })
}

// ── 夹具：空窗口快照 ──
function seedEmptySnapshot(): void {
  Object.assign(mockSnapshot, {
    since: 1000,
    totalCollects: 0,
    successCollects: 0,
    mockCollects: 0,
    mockSuccesses: 0,
    successRate: 0,
    realSuccessRate: 0,
    completeness: 0,
    sourceCounts: {},
    fallbackCount: 0,
    writeSuccess: 0,
    writeTotal: 0,
    writeRate: 0,
    mockWrites: 0,
    avgLatency: 0,
    totalLatency: 0,
  })
  delete mockSnapshot.lastError
}

beforeEach(() => {
  seedEmptySnapshot()
})

describe('persistQualitySnapshot — 空窗口行为', () => {
  it('无采集无写入时跳过持久化，返回 false，不调用 forward', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()

    const result = await persistQualitySnapshot({ reason: 'collection-complete' })

    expect(result).toBe(false)
    expect(forward).not.toHaveBeenCalled()
  })

  it('仅有写入（writeTotal>0）仍应持久化（采集全失败但写入有数据）', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()
    seedEmptySnapshot()
    mockSnapshot.writeTotal = 2
    mockSnapshot.writeSuccess = 1
    mockSnapshot.writeRate = 50

    const result = await persistQualitySnapshot()

    expect(result).toBe(true)
    expect(forward).toHaveBeenCalledTimes(1)
  })
})

describe('persistQualitySnapshot — 正常写入路径', () => {
  it('有数据时调用 forward 一次并返回 true', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()
    seedActiveSnapshot()

    const result = await persistQualitySnapshot({ reason: 'collection-complete' })

    expect(result).toBe(true)
    expect(forward).toHaveBeenCalledTimes(1)
  })

  it('信封元数据正确：fetcher 模块 + saveQualityMetricsHistory 动作', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()
    seedActiveSnapshot()

    await persistQualitySnapshot()

    const envelope = forward.mock.calls[0]?.[0]
    expect(envelope?.meta.source).toBe(MODULE_ID.fetcher)
    expect(envelope?.meta.action).toBe(ENVELOPE_ACTION.saveQualityMetricsHistory)
    expect(envelope?.meta.traceId).toMatch(/^quality-snapshot-\d+$/)
  })

  it('payload 包含核心指标字段与主键', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()
    seedActiveSnapshot()

    await persistQualitySnapshot()

    const payload = forward.mock.calls[0]?.[0]?.payload as Record<string, unknown>
    expect(payload.id).toMatch(/^qmh-\d+$/)
    expect(payload.capturedAt).toBeTypeOf('number')
    expect(payload.totalCollects).toBe(5)
    expect(payload.realSuccessRate).toBe(75)
    expect(payload.completeness).toBe(92)
    expect(payload.writeRate).toBe(80)
    expect(payload.sourceCounts).toEqual({ tencent: 3, sina: 1, mock: 1 })
  })

  it('lastError 仅在快照含错误时写入', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()
    seedActiveSnapshot()

    await persistQualitySnapshot()
    const noErrorPayload = forward.mock.calls[0]?.[0]?.payload as Record<string, unknown>
    expect(noErrorPayload.lastError).toBeUndefined()

    forward.mockClear()
    mockSnapshot.lastError = '网络超时'
    await persistQualitySnapshot()
    const withErrorPayload = forward.mock.calls[0]?.[0]?.payload as Record<string, unknown>
    expect(withErrorPayload.lastError).toBe('网络超时')
  })
})

describe('persistQualitySnapshot — 永不阻塞契约', () => {
  it('forward 抛错时不抛出，返回 false', async () => {
    const { persistQualitySnapshot, forward } = await getService()
    forward.mockClear()
    forward.mockRejectedValueOnce(new Error('DB 不可用'))
    seedActiveSnapshot()

    // 不得抛出（永不阻塞主链路）
    const result = await persistQualitySnapshot()
    expect(result).toBe(false)
  })
})
