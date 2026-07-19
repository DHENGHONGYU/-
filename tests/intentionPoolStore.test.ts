/**
 * intentionPoolStore 单元测试
 *
 * 覆盖场景：
 * 1. deleteItems 空列表 → 返回 0 且不触发写入
 * 2. deleteItems 批量删除 → 按去重后数量调用 deleteStock 并返回正确计数
 * 3. deleteItems 归一化（大写/去空格）并去重
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: vi.fn().mockResolvedValue({ success: true }),
    query: vi.fn().mockResolvedValue({ success: false }),
    subscribe: vi.fn(() => () => {}),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn((meta: unknown) => ({ meta })) },
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

const seedItems = (symbols: string[]): void => {
  useIntentionPoolStore.setState({
    items: symbols.map((symbol) => ({
      symbol,
      name: symbol,
      pool: 'intention',
      status: 'screening',
    })) as never,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
}

beforeEach(() => {
  useIntentionPoolStore.setState({ items: [], loading: false, error: null, isRefreshing: false, lastUpdated: 0 })
  vi.clearAllMocks()
})

describe('intentionPoolStore.deleteItems', () => {
  it('空列表返回 0 且不调用 forward', async () => {
    const result = await useIntentionPoolStore.getState().deleteItems([])
    expect(result).toBe(0)
    expect(dataBridge.forward).not.toHaveBeenCalled()
  })

  it('批量删除 N 条 → 调用 N 次删除并返回 N（按归一化去重）', async () => {
    seedItems(['A.SH', 'B.SH', 'C.SH'])
    const result = await useIntentionPoolStore.getState().deleteItems(['a.sh', 'B.SH', 'A.SH'])
    // a.sh 与 A.SH 归一化后重复，去重为 2 条
    expect(result).toBe(2)
    expect(dataBridge.forward).toHaveBeenCalledTimes(2)
    for (const call of (dataBridge.forward as ReturnType<typeof vi.fn>).mock.calls) {
      expect((call[0] as { meta?: { action?: string } })?.meta?.action).toBe(ENVELOPE_ACTION.deleteStock)
    }
  })

  it('归一化大小写与首尾空格并去重', async () => {
    const result = await useIntentionPoolStore.getState().deleteItems(['x.sh', 'X.SH', ' x.sh '])
    expect(result).toBe(1)
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })
})
