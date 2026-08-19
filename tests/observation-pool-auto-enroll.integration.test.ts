/**
 * @test_id V9-TEST-UT-025
 * 观察池→研究池「晋升自动入池」集成测试（真实 IndexedDB 存储层闭环）
 *
 * 验证 ObservationPoolReviewer 在 autoEnroll 开启时，将观察池中达研究门槛且尚未在研究池的
 * 标的自动入研究池（经真实 researchPoolStore.addItem → stocks store, pool==='research'），
 * 并验证三类场景：
 *   1) autoEnroll 开启：仅达门槛且不在研究池的标的一一入池；未达门槛者不入；
 *   2) autoEnroll 关闭：即使注入 enrollToResearchPool 也不入池（仅标记候选，不动作）；
 *   3) 已在研究池的标的（isInResearchPool 生效）不再重复入池；addItem 自带 DB 去重（重复返回 false）。
 *
 * 环境：Vitest + jsdom + fake-indexeddb（tests/setup.ts 已注入），不依赖真实行情网络。
 * 注意：stocks store 的 insertStock 对 symbol 有格式校验（600519.SH / 00700.HK / AAPL.US），
 *       故本测试全部使用合法 6 位 .SH 格式 symbol。
 */

import { describe, it, expect } from 'vitest'
import { db } from '@/data/db'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { DATA_SOURCE } from '@/config/dbConfig'
import { ObservationPoolReviewer } from '@/services/orchestration/observationPoolReviewer'
import type { PipelineScorer } from '@/services/orchestration/researchPipelineOrchestrator'
import type { V6Score } from '@/data/types/types.score'

const THRESHOLD = 3.0

interface CaseFixture {
  watchlist: { symbol: string; name: string }[]
  scorer: PipelineScorer
}

// 构造一组用例：highSyms 达门槛（THRESHOLD+1），lowSyms 未达（THRESHOLD-1）
function buildCase(highSyms: string[], lowSyms: string[]): CaseFixture {
  const watchlist = [...highSyms, ...lowSyms].map((s) => ({ symbol: s, name: s }))
  const highSet = new Set(highSyms)
  return {
    watchlist,
    scorer: {
      run: async (symbol: string): Promise<{ success: boolean; data: V6Score }> => ({
        success: true,
        data: {
          symbol,
          score: highSet.has(symbol) ? THRESHOLD + 1 : THRESHOLD - 1,
          factors: {},
          algorithmVersion: 'test',
          calculatedAt: Date.now(),
          dataVersion: 1,
        },
      }),
    },
  }
}

// 真实入池动作（与 src/services/orchestration/index.ts 生产接线同源）
async function enrollToResearchPool(symbol: string, name: string) {
  await useResearchPoolStore.getState().addItem({ symbol, name, source: DATA_SOURCE.system })
}

// 查询真实研究池（pool==='research'）
async function isInResearch(symbol: string): Promise<boolean> {
  await useResearchPoolStore.getState().refresh()
  return useResearchPoolStore.getState().items.some((i) => i.symbol === symbol && i.pool === 'research')
}

describe('观察池→研究池 晋升自动入池（真实存储层闭环）', () => {
  it('autoEnroll 开启：达门槛且不在研究池的标的一一入池；未达门槛者不入', async () => {
    await db.init()
    const { watchlist, scorer } = buildCase(
      ['600111.SH', '600112.SH'],
      ['600113.SH', '600114.SH'],
    )
    const reviewer = new ObservationPoolReviewer({ autoEnroll: true, promotionThreshold: THRESHOLD })
    const result = await reviewer.run({
      getWatchlist: async () => watchlist,
      scorer,
      promotionThreshold: THRESHOLD,
      enrollToResearchPool,
      // 不注入 isInResearchPool → 默认 false（视为未在研究池）
    })

    expect(result.summary.promotionEligible, '达门槛且不在研究池应为 2').toBe(2)
    expect(result.enrolled.sort(), '自动入池应为两个达门槛标的').toEqual(['600111.SH', '600112.SH'])

    expect(await isInResearch('600111.SH'), '600111 应已入研究池').toBe(true)
    expect(await isInResearch('600112.SH'), '600112 应已入研究池').toBe(true)
    expect(await isInResearch('600113.SH'), '600113 未达门槛不应入池').toBe(false)
    expect(await isInResearch('600114.SH'), '600114 未达门槛不应入池').toBe(false)
  }, 30000)

  it('autoEnroll 关闭：即使注入 enrollToResearchPool 也不入池（仅标记候选）', async () => {
    await db.init()
    const { watchlist, scorer } = buildCase(
      ['600211.SH', '600212.SH'],
      ['600213.SH', '600214.SH'],
    )
    const reviewer = new ObservationPoolReviewer({ autoEnroll: false, promotionThreshold: THRESHOLD })
    const result = await reviewer.run({
      getWatchlist: async () => watchlist,
      scorer,
      promotionThreshold: THRESHOLD,
      enrollToResearchPool,
    })

    expect(result.enrolled, 'autoEnroll 关闭不应自动入池').toEqual([])
    expect(result.summary.promotionEligible, '仍应标记晋升候选（仅不入池动作）').toBe(2)

    expect(await isInResearch('600211.SH'), '600211 不应入池').toBe(false)
    expect(await isInResearch('600212.SH'), '600212 不应入池').toBe(false)
    expect(await isInResearch('600213.SH'), '600213 不应入池').toBe(false)
    expect(await isInResearch('600214.SH'), '600214 不应入池').toBe(false)
  }, 30000)

  it('已在研究池的标的不再重复入池；addItem 自带 DB 去重返回 false', async () => {
    await db.init()
    const { watchlist, scorer } = buildCase(
      ['600311.SH', '600312.SH'],
      ['600313.SH', '600314.SH'],
    )
    const reviewer = new ObservationPoolReviewer({ autoEnroll: true, promotionThreshold: THRESHOLD })

    // 第一次复盘：isInResearchPool 默认 false → 600311/600312 入池
    const run1 = await reviewer.run({
      getWatchlist: async () => watchlist,
      scorer,
      promotionThreshold: THRESHOLD,
      enrollToResearchPool,
    })
    expect(run1.enrolled.sort(), '首次应入池 600311/600312').toEqual(['600311.SH', '600312.SH'])

    // 第二次复盘：注入真实 isInResearchPool（查库）→ 600311/600312 已在池，promotionEligible 变 false，不再入池
    const run2 = await reviewer.run({
      getWatchlist: async () => watchlist,
      scorer,
      promotionThreshold: THRESHOLD,
      isInResearchPool: (symbol) => isInResearch(symbol),
      enrollToResearchPool,
    })
    expect(run2.enrolled, '已在研究池的标的不再重复入池').toEqual([])

    // 研究池里 600311/600312 应各仅 1 条（无重复）
    await useResearchPoolStore.getState().refresh()
    const researchItems = useResearchPoolStore.getState().items.filter((i) => i.pool === 'research')
    expect(researchItems.filter((i) => i.symbol === '600311.SH').length, '600311 不应重复').toBe(1)
    expect(researchItems.filter((i) => i.symbol === '600312.SH').length, '600312 不应重复').toBe(1)
    expect(await isInResearch('600313.SH'), '600313 未达门槛不应入池').toBe(false)
    expect(await isInResearch('600314.SH'), '600314 未达门槛不应入池').toBe(false)

    // 直接验证 addItem 内部 DB 去重：再次入已存在的 600311 应安全返回 false，不抛异常
    const dup = await useResearchPoolStore.getState().addItem({
      symbol: '600311.SH',
      name: '600311.SH',
      source: DATA_SOURCE.system,
    })
    expect(dup, '重复入池应返回 false（DB 去重生效）').toBe(false)
  }, 30000)
})
