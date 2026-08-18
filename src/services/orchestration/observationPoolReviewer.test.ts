/**
 * @test 观察池定期自动复盘调度器（投研编排器 spec 缺口②）单元测试
 *
 * 覆盖：晋升候选判定、评分漂移计算、事件广播、定时调度触发、已入研究池排除。
 * 不依赖 IndexedDB —— getWatchlist / scorer 均由测试注入。
 */
import { it, expect, vi } from 'vitest'
import {
  ObservationPoolReviewer,
  type ObservationPoolReviewerDeps,
  type ObservationReviewResult,
} from './observationPoolReviewer'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type { V6Score } from '@/data/types'

const WATCHLIST = [
  { symbol: '600000.SH', name: '浦发银行' },
  { symbol: '000001.SZ', name: '平安银行' },
  { symbol: '300750.SZ', name: '宁德时代' },
]

function makeDeps(
  scores: Record<string, number>,
  extra?: Partial<ObservationPoolReviewerDeps>,
): ObservationPoolReviewerDeps {
  return {
    getWatchlist: async () => WATCHLIST,
    scorer: {
      run: async (symbol: string) => ({
        success: true,
        data: { score: scores[symbol] ?? 0 } as unknown as V6Score,
      }),
    },
    ...extra,
  }
}

it('复盘产出晋升候选，且首次无历史快照', async () => {
  const reviewer = new ObservationPoolReviewer({ promotionThreshold: 3.0 })
  const r = await reviewer.run(makeDeps({ '600000.SH': 4.2, '000001.SZ': 2.1, '300750.SZ': 3.5 }))
  expect(r.summary.total).toBe(3)
  // 600000(4.2) 与 300750(3.5) 越过门槛 3.0 → 晋升候选
  expect(r.summary.promotionEligible).toBe(2)
  expect([...r.promotionCandidates].sort()).toEqual(['300750.SZ', '600000.SH'])
  // 首次复盘 previousScore 应为 null
  for (const item of r.items) expect(item.previousScore).toBeNull()
  // 600000 达门槛 → promote；000001 未达 → watch
  expect(r.items.find((i) => i.symbol === '600000.SH')!.recommendation).toBe('promote')
  expect(r.items.find((i) => i.symbol === '000001.SZ')!.recommendation).toBe('watch')
})

it('二次复盘计算评分漂移并广播事件', async () => {
  const reviewer = new ObservationPoolReviewer({ promotionThreshold: 3.0 })
  const received: ObservationReviewResult[] = []
  const unsub = eventBus.on(EVENT_NAMES.OBSERVATION_REVIEW_COMPLETED, (p) =>
    received.push(p as ObservationReviewResult),
  )

  await reviewer.run(makeDeps({ '600000.SH': 4.2, '000001.SZ': 2.1, '300750.SZ': 3.5 }))
  const r2 = await reviewer.run(makeDeps({ '600000.SH': 3.0, '000001.SZ': 2.5, '300750.SZ': 3.5 }))

  // 漂移：600000 4.2→3.0（-1.2）；000001 2.1→2.5（+0.4）；300750 不变
  const item600 = r2.items.find((i) => i.symbol === '600000.SH')!
  expect(item600.previousScore).toBe(4.2)
  expect(item600.scoreDelta).toBeCloseTo(-1.2)
  expect(r2.summary.promotionEligible).toBe(2) // 600000(3.0) 与 300750 仍达门槛
  const item000 = r2.items.find((i) => i.symbol === '000001.SZ')!
  expect(item000.promotionEligible).toBe(false)
  expect(item000.recommendation).toBe('watch')
  expect(r2.summary.improved).toBe(1)
  expect(r2.summary.declined).toBe(1)
  expect(r2.summary.unchanged).toBe(1)

  // 事件广播两次，第二次 id 与返回一致
  expect(received.length).toBe(2)
  expect(received[1]!.id).toBe(r2.id)

  unsub()
})

it('已在研究池的标的即使达门槛也不标记为晋升', async () => {
  const reviewer = new ObservationPoolReviewer({ promotionThreshold: 3.0 })
  const deps = makeDeps({ '600000.SH': 4.5 }, { isInResearchPool: (s) => s === '600000.SH' })
  const r = await reviewer.run(deps)
  const item = r.items.find((i) => i.symbol === '600000.SH')!
  expect(item.meetsResearchThreshold).toBe(true)
  expect(item.promotionEligible).toBe(false)
  expect(item.recommendation).toBe('hold')
})

it('定时调度：启用后按间隔自动复盘，start 不立即执行', async () => {
  vi.useFakeTimers()
  const reviewer = new ObservationPoolReviewer({
    enabled: true,
    intervalMs: 1000,
    promotionThreshold: 3.0,
  })
  const runSpy = vi.spyOn(reviewer, 'run')
  reviewer.configure(makeDeps({ '600000.SH': 4.0 }))
  reviewer.start()
  expect(runSpy).not.toHaveBeenCalled() // 与 WeeklyReviewScheduler 一致：启动不立即跑
  await vi.advanceTimersByTimeAsync(1000)
  expect(runSpy).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(2000)
  expect(runSpy).toHaveBeenCalledTimes(3)
  reviewer.stop()
  vi.useRealTimers()
})

it('autoEnroll 开启时自动将晋升候选入研究池（未达门槛排除）', async () => {
  const enrollMock = vi.fn(async () => {})
  const reviewer = new ObservationPoolReviewer({ promotionThreshold: 3.0, autoEnroll: true })
  const deps = makeDeps(
    { '600000.SH': 4.2, '000001.SZ': 2.1, '300750.SZ': 3.5 },
    { enrollToResearchPool: enrollMock },
  )
  const r = await reviewer.run(deps)
  // 600000(4.2) 与 300750(3.5) 越过门槛 → 入池；000001(2.1) 未达 → 不入池
  expect([...r.enrolled].sort()).toEqual(['300750.SZ', '600000.SH'])
  expect(enrollMock).toHaveBeenCalledTimes(2)
  expect(enrollMock).toHaveBeenCalledWith('600000.SH', '浦发银行')
  expect(enrollMock).toHaveBeenCalledWith('300750.SZ', '宁德时代')
  expect(r.enrolled).not.toContain('000001.SZ')
})

it('autoEnroll 未开启时即使注入 enrollToResearchPool 也不入池', async () => {
  const enrollMock = vi.fn(async () => {})
  const reviewer = new ObservationPoolReviewer({ promotionThreshold: 3.0, autoEnroll: false })
  const deps = makeDeps({ '600000.SH': 4.2 }, { enrollToResearchPool: enrollMock })
  const r = await reviewer.run(deps)
  expect(r.enrolled).toEqual([])
  expect(enrollMock).not.toHaveBeenCalled()
})
