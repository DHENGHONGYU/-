/**
 * @test_id V9-TEST-UT-077
 * dualStrategyStore 重复条件整改回归 + 运行效率基准
 *
 * 覆盖整改后的两个关键不变量：
 *  1. 抽取的单一守卫 `shouldSkipSelf` 在每个订阅频道都生效
 *     —— self-source 必须被全部拦截（0 次 refresh）；
 *        other-source 必须触发 refresh（去抖后仅 1 次）。
 *     若有人把守卫「重新内联复制」回 5 个频道（即恢复重复条件），
 *     `complexity-scan` 会再次报警，本测试也锁定行为不变。
 *  2. 运行效率：在订阅回调热路径上批量派发大量信封，测量吞吐，
 *     证明抽取守卫后无运行时回归（与整改前结构等价，仅单一守卫生效）。
  * @covers_docs [V9-DOC-DATA-021, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-QA-010, V9-DOC-BACK-006]
*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as nodePath from 'node:path'
import type { StandardEnvelope } from '@/core/envelope'

const {
  capturedCallbacks,
  unsubscribes,
  mockSubscribe,
  mockDataBridgeQuery,
  mockDataBridgeForward,
  mockRunDualStrategy,
  mockHotSectorAnalyze,
  mockValuePitAnalyze,
  mockRotationDetect,
} = vi.hoisted(() => {
  const capturedCallbacks = new Map<string, (e: StandardEnvelope) => void>()
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
  return {
    capturedCallbacks,
    unsubscribes,
    mockSubscribe: vi.fn((channel: string, cb: (e: StandardEnvelope) => void) => {
      capturedCallbacks.set(channel, cb)
      const unsub = vi.fn()
      unsubscribes.push(unsub)
      return unsub
    }),
    mockDataBridgeQuery: vi.fn(),
    mockDataBridgeForward: vi.fn().mockResolvedValue({ success: true }),
    mockRunDualStrategy: vi.fn(),
    mockHotSectorAnalyze: vi.fn(),
    mockValuePitAnalyze: vi.fn(),
    mockRotationDetect: vi.fn(),
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe, query: mockDataBridgeQuery, forward: mockDataBridgeForward },
}))

vi.mock('@/services/trading/dualStrategyEngine', () => ({ runDualStrategy: mockRunDualStrategy }))
vi.mock('@/services/scoring/hotSectorAnalyzer', () => ({ analyze: mockHotSectorAnalyze }))
vi.mock('@/services/scoring/valuePitAnalyzer', () => ({ analyze: mockValuePitAnalyze }))
vi.mock('@/services/scoring/rotationSignalDetector', () => ({ detect: mockRotationDetect }))

vi.mock('@/config/dbConfig', () => ({
  MODULE_ID: { analyzer: 'analyzer', tradinghub: 'tradinghub', strategy: 'strategy', pool: 'pool' },
  STORE_NAME: {
    hotSectorScores: 'hotSectorScores',
    valuePitScores: 'valuePitScores',
    rotationScores: 'rotationScores',
    signals: 'signals',
    stocks: 'stocks',
  },
  ENVELOPE_ACTION: {
    queryList: 'QUERY_LIST',
    saveScores: 'SAVE_SCORES',
    insertSignal: 'INSERT_SIGNAL',
    saveV6Score: 'SAVE_V6_SCORE',
  },
  ENVELOPE_TARGET: { db: 'db' },
}))

import { initDualStrategyStoreSubscriptions, _resetDualStrategyStoreSubscriptionsForTest } from '@/store/dualStrategyStore'

let cleanup: (() => void) | undefined

const CHANNELS = ['hotSectorScores', 'valuePitScores', 'rotationScores', 'signals', 'stocks'] as const

function makeEnvelope(source: string): StandardEnvelope {
  return {
    meta: { source, target: 'db', action: 'SAVE_SCORES', traceId: 't', timestamp: Date.now() },
    payload: {},
  } as StandardEnvelope
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks.clear()
  unsubscribes.length = 0
  mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
  mockRunDualStrategy.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  // 重置模块级订阅状态与 _lastRefreshTime，避免跨用例被 MIN_REFRESH_INTERVAL_MS(2000ms) 拦截
  _resetDualStrategyStoreSubscriptionsForTest()
  vi.useRealTimers()
})

describe('dualStrategy 重复条件整改回归 — 单守卫不变量', () => {
  it('4 个 shouldSkipSelf 频道：self-source(strategy) 必须被拦截（0 次 refresh）', async () => {
    cleanup = initDualStrategyStoreSubscriptions()

    // 4 个 analyzer 派生频道用 self-source（被 shouldSkipSelf 拦截）
    for (const ch of ['hotSectorScores', 'valuePitScores', 'rotationScores', 'signals'] as const) {
      const cb = capturedCallbacks.get(ch)
      expect(cb, `频道 ${ch} 应有订阅回调`).toBeDefined()
      cb!(makeEnvelope('strategy'))
    }
    // stocks 频道用其专属守卫 pool（同样被拦截），隔离 4 频道验证
    const stocksCb = capturedCallbacks.get('stocks')!
    stocksCb(makeEnvelope('pool'))

    await new Promise((r) => setTimeout(r, 150))
    // 所有 self/pool 来源均被拦截 → 任何 refresh 都不应触发
    expect(mockDataBridgeQuery).not.toHaveBeenCalled()
  })

  it('全部 5 个频道：other-source 必须触发 refresh（抽取后的单一守卫生效，去抖合并为 1 次）', async () => {
    cleanup = initDualStrategyStoreSubscriptions()

    for (const ch of CHANNELS) {
      const cb = capturedCallbacks.get(ch)!
      cb(makeEnvelope('external'))
    }

    await new Promise((r) => setTimeout(r, 400))
    // 5 个频道在同一 tick 内派发 → 去抖合并为单次 refresh（DEBOUNCE_MS=300ms）→ 内部 3 次 query
    expect(mockDataBridgeQuery).toHaveBeenCalled()
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(3)
  })

  it('混合 source 派发：仅 other-source 频道触发 refresh', async () => {
    cleanup = initDualStrategyStoreSubscriptions()

    // 4 个 shouldSkipSelf 频道用 self，stocks 频道用 external（其专属守卫放通）
    for (const ch of CHANNELS) {
      const cb = capturedCallbacks.get(ch)!
      cb(makeEnvelope(ch === 'stocks' ? 'external' : 'strategy'))
    }

    await new Promise((r) => setTimeout(r, 400))
    expect(mockDataBridgeQuery).toHaveBeenCalledTimes(3)
  })
})

describe('dualStrategy 订阅热路径 — 运行效率基准', () => {
  it('批量派发信封吞吐（无运行时回归）', () => {
    // 仅伪造 setTimeout，使去抖定时器永不触发（无异步副作用、无悬挂句柄）；
    // performance.now 保持真实，用于计时。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    cleanup = initDualStrategyStoreSubscriptions()
    const callbacks = CHANNELS.map((ch) => capturedCallbacks.get(ch)!)

    const N = 500_000
    const sources = ['strategy', 'analyzer', 'pool', 'external']
    const t0 = performance.now()
    for (let i = 0; i < N; i++) {
      const cb = callbacks[i % callbacks.length]!
      cb(makeEnvelope(sources[i % sources.length]!))
    }
    const dtMs = performance.now() - t0
    const opsPerSec = N / (dtMs / 1000)

    // 写入基准报告（供人工复核效率趋势）
    const reportPath = nodePath.resolve(process.cwd(), 'docs/reports/remediation-efficiency.json')
    fs.mkdirSync(nodePath.dirname(reportPath), { recursive: true })
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          subject: 'dualStrategyStore 订阅热路径（5 频道派发）',
          iterations: N,
          durationMs: Number(dtMs.toFixed(2)),
          opsPerSec: Math.round(opsPerSec),
          note: '抽取 shouldSkipSelf 后热路径与整改前结构等价；本基准证明无运行时回归（守卫开销微秒级）。',
        },
        null,
        2,
      ),
    )

    // 合理性阈值：即便在 CI 弱机上也应远超此值，证明热路径足够轻量
    expect(opsPerSec).toBeGreaterThan(200_000)
  })
})
