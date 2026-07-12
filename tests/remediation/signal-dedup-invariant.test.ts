/**
 * signalStore 重复条件整改回归
 *
 * 整改手法：原两处同义 source 过滤
 *   `envelope.meta.source === MODULE_ID.trading || === MODULE_ID.tradinghub`
 * 与
 *   `envelope.meta.source !== MODULE_ID.trading && !== MODULE_ID.tradinghub`
 * 经 De Morgan 反转统一为单一守卫生效（文本一正一反，消除重复条件）。
 *
 * 本测试锁定：trading / tradinghub 来源必须被跳过（0 次 refresh），
 * 其余来源必须触发 refresh（去抖合并为 1 次）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StandardEnvelope } from '@/core/envelope'

const { capturedCallbacks, unsubscribes, mockSubscribe, mockDataBridgeQuery } = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, (e: StandardEnvelope) => void>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  const mockSubscribe = vi.fn((channel: string, cb: (e: StandardEnvelope) => void) => {
    capturedCallbacks.set(channel, cb)
    const unsub = vi.fn()
    unsubscribes.push(unsub)
    return unsub
  })
  const mockDataBridgeQuery = vi.fn()
  return { capturedCallbacks, unsubscribes, mockSubscribe, mockDataBridgeQuery }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, query: mockDataBridgeQuery },
}))

vi.mock('@/services/trading/signalGenerator', () => ({
  generateSignalsForSymbol: vi.fn(),
  pickStrongestSignal: vi.fn(),
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    insertSignal: 'INSERT_SIGNAL',
    saveV6Score: 'SAVE_V6_SCORE',
    saveScores: 'SAVE_SCORES',
    queryList: 'QUERY_LIST',
  },
  MODULE_ID: { trading: 'trading', tradinghub: 'tradinghub' },
  STORE_NAME: { stocks: 'stocks', signals: 'signals' },
}))

import { initSignalStoreSubscriptions, useSignalStore } from '@/store/signalStore'

let cleanup: (() => void) | undefined

function makeEnvelope(source: string, action = 'SAVE_SCORES'): StandardEnvelope {
  return {
    meta: { source, target: 'db', action, traceId: 't', timestamp: Date.now() },
    payload: {},
  } as StandardEnvelope
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0
  mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
  useSignalStore.setState({ signals: [], loading: false, error: null, lastUpdated: 0, isRefreshing: false })
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

describe('signalStore 重复条件整改回归 — De Morgan 反转守卫', () => {
  it('两个频道：trading / tradinghub 来源必须被跳过（0 次 refresh）', async () => {
    cleanup = initSignalStoreSubscriptions()

    for (const ch of ['v6_scores', 'signals'] as const) {
      const cb = capturedCallbacks.get(ch)
      expect(cb, `频道 ${ch} 应有订阅回调`).toBeDefined()
      cb!(makeEnvelope('trading'))
      cb!(makeEnvelope('tradinghub'))
    }

    await new Promise((r) => setTimeout(r, 150))
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
    expect(useSignalStore.getState().isRefreshing).toBe(false)
  })

  it('两个频道：其余来源必须触发 refresh（抽取后的单一守卫生效，去抖合并为 1 次）', async () => {
    cleanup = initSignalStoreSubscriptions()

    for (const ch of ['v6_scores', 'signals'] as const) {
      const cb = capturedCallbacks.get(ch)!
      cb(makeEnvelope('analyzer'))
    }

    await new Promise((r) => setTimeout(r, 150))
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(1)
  })
})
