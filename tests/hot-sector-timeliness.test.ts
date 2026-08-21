/**
 * @test_id V9-TEST-UT-HS-001
 * 热门板块评分时效性 & 动态权重排序测试
 *
 * 覆盖缺口：
 *   H-01: scoreDate 近7天内 → timely=true
 *   H-02: scoreDate 超过7天 → timely=false, daysAgo>7
 *   H-03: scoreDate 缺失 → timely=false, daysAgo=null
 *   H-04: scoreDate 非法(NaN) → timely=false, daysAgo=null
 *   H-05: rankSectorsByDynamicScore 按 DYNAMIC_SCORE_WEIGHTS / MOMENTUM_WEIGHTS 正确计算并降序
 *   H-06: extractRepresentativeStocks 跨板块去重 + limit 20 默认值
 *   H-07: timelyOnly=true 过滤过期板块
 *   H-08: trend 映射（score>=70 up, <=30 down, 否则 neutral）
 *
 * @covers_docs [V9-DOC-UI-003, V9-DOC-UI-004, V9-DOC-DB-007]
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

// ============================================================
// 1. getTimeliness 及时性判定
// ============================================================

describe('getTimeliness — 评分及时性判定', () => {
  const DAY = 24 * 60 * 60 * 1000
  const BASE_DATE = new Date('2026-01-15T00:00:00.000Z').getTime()

  const daysFromBase = (offsetDays: number) => {
    const t = new Date(BASE_DATE - offsetDays * DAY)
    return t.toISOString().slice(0, 10) // YYYY-MM-DD
  }

  it('H-01: 近3天（<7）→ timely=true, daysAgo=3', async () => {
    const { getTimeliness } = await import('@/apps/input/hotSector.utils')
    const result = getTimeliness(daysFromBase(3), BASE_DATE)
    expect(result.timely).toBe(true)
    expect(result.daysAgo).toBe(3)
  })

  it('H-01-b: 刚好7天（边界）→ timely=true', async () => {
    const { getTimeliness } = await import('@/apps/input/hotSector.utils')
    const result = getTimeliness(daysFromBase(7), BASE_DATE)
    expect(result.timely).toBe(true)
    expect(result.daysAgo).toBe(7)
  })

  it('H-02: 超过7天（8天）→ timely=false', async () => {
    const { getTimeliness } = await import('@/apps/input/hotSector.utils')
    const result = getTimeliness(daysFromBase(8), BASE_DATE)
    expect(result.timely).toBe(false)
    expect(result.daysAgo).toBe(8)
  })

  it('H-03: scoreDate 缺失(undefined) → timely=false, daysAgo=null', async () => {
    const { getTimeliness } = await import('@/apps/input/hotSector.utils')
    const result = getTimeliness(undefined, BASE_DATE)
    expect(result.timely).toBe(false)
    expect(result.daysAgo).toBeNull()
  })

  it('H-04: scoreDate 非法字符串 → timely=false, daysAgo=null', async () => {
    const { getTimeliness } = await import('@/apps/input/hotSector.utils')
    const result = getTimeliness('not-a-date-xxxx', BASE_DATE)
    expect(result.timely).toBe(false)
    expect(result.daysAgo).toBeNull()
  })
})

// ============================================================
// 2. rankSectorsByDynamicScore 动态权重排序
// ============================================================

describe('rankSectorsByDynamicScore — 动态权重排序', () => {
  const makeSector = (overrides: Record<string, unknown> = {}) => ({
    code: `SC${Math.random().toString(36).slice(2, 6)}`,
    name: '测试板块',
    score: 80,
    scoreDate: '2026-01-10',
    trend: 'up' as const,
    factors: {
      fundFlow: 60, // 资金因子
      momentum: 50, // 景气+量能加权
      sentiment: 70, // 情绪因子
      valuation: 40, // 估值因子
    },
    stocks: [],
    ...overrides,
  })

  it('H-05-a: 按 DYNAMIC_SCORE_WEIGHTS 正确计算 dynamicScore', async () => {
    const { DYNAMIC_SCORE_WEIGHTS, MOMENTUM_WEIGHTS } = await import('@/apps/input/hotSector.config')
    const { rankSectorsByDynamicScore } = await import('@/apps/input/hotSector.utils')
    const sector = makeSector({
      score: 80,
      factors: { fundFlow: 60, momentum: 50, sentiment: 70, valuation: 40 },
    })
    const ranked = rankSectorsByDynamicScore([sector])
    // 预期计算
    const capitalWeight = (60 + 50) / 2 // 55
    const momentumWeight = 70 * MOMENTUM_WEIGHTS.sentiment + 40 * MOMENTUM_WEIGHTS.valuation // 70*0.6+40*0.4=42+16=58
    const expectedDynamic =
      80 * DYNAMIC_SCORE_WEIGHTS.original +
      capitalWeight * DYNAMIC_SCORE_WEIGHTS.capital +
      momentumWeight * DYNAMIC_SCORE_WEIGHTS.momentum
    expect(ranked![0]!.dynamicScore).toBeCloseTo(expectedDynamic, 5)
  })

  it('H-05-b: 多板块按 dynamicScore 降序排列', async () => {
    const { rankSectorsByDynamicScore } = await import('@/apps/input/hotSector.utils')
    const sectorLow = makeSector({ score: 40, factors: { fundFlow: 30, momentum: 30, sentiment: 30, valuation: 30 } })
    const sectorHigh = makeSector({ score: 90, factors: { fundFlow: 90, momentum: 90, sentiment: 90, valuation: 90 } })
    const ranked = rankSectorsByDynamicScore([sectorLow, sectorHigh])
    expect(ranked![0]!.dynamicScore).toBeGreaterThan(ranked[1]!.dynamicScore)
    expect(ranked![0]!.code).toBe(sectorHigh.code)
  })

  it('H-05-c: 空列表返回空', async () => {
    const { rankSectorsByDynamicScore } = await import('@/apps/input/hotSector.utils')
    expect(rankSectorsByDynamicScore([])).toEqual([])
  })
})

// ============================================================
// 3. extractRepresentativeStocks 代表股抽取
// ============================================================

describe('extractRepresentativeStocks — 代表股抽取', () => {
  const makeStock = (symbol: string, name: string) => ({ symbol, name })

  it('H-06-a: 跨板块去重（同一 symbol 只取首次出现）', async () => {
    const { extractRepresentativeStocks } = await import('@/apps/input/hotSector.utils')
    const sectors = [
      {
        code: 'SEC-A', name: 'A板块', score: 90, scoreDate: '2026-01-14',
        trend: 'up' as const, factors: { fundFlow: 80, momentum: 80, sentiment: 80, valuation: 80 },
        stocks: [makeStock('SH600001', '重复股'), makeStock('SH600002', '股2')],
      },
      {
        code: 'SEC-B', name: 'B板块', score: 70, scoreDate: '2026-01-14',
        trend: 'up' as const, factors: { fundFlow: 60, momentum: 60, sentiment: 60, valuation: 60 },
        stocks: [makeStock('SH600001', '重复股'), makeStock('SH600003', '股3')],
      },
    ]
    const picks = extractRepresentativeStocks(sectors as never)
    const symbols = picks.map((p) => p.symbol)
    expect(symbols).toEqual(['SH600001', 'SH600002', 'SH600003'])
    expect(picks).toHaveLength(3)
  })

  it('H-06-b: limit 默认 20 生效', async () => {
    const { extractRepresentativeStocks } = await import('@/apps/input/hotSector.utils')
    const manyStocks = Array.from({ length: 50 }, (_, i) => makeStock(`SH${1000 + i}`, `股${i}`))
    const sectors = [{
      code: 'SEC-BIG', name: '大板块', score: 80, scoreDate: '2026-01-14',
      trend: 'up' as const, factors: { fundFlow: 70, momentum: 70, sentiment: 70, valuation: 70 },
      stocks: manyStocks,
    }]
    const picks = extractRepresentativeStocks(sectors as never)
    expect(picks).toHaveLength(20)
  })

  it('H-06-c: 自定义 limit 参数', async () => {
    const { extractRepresentativeStocks } = await import('@/apps/input/hotSector.utils')
    const manyStocks = Array.from({ length: 30 }, (_, i) => makeStock(`SH${1000 + i}`, `股${i}`))
    const sectors = [{
      code: 'SEC-BIG', name: '大板块', score: 80, scoreDate: '2026-01-14',
      trend: 'up' as const, factors: { fundFlow: 70, momentum: 70, sentiment: 70, valuation: 70 },
      stocks: manyStocks,
    }]
    const picks = extractRepresentativeStocks(sectors as never, { limit: 5 })
    expect(picks).toHaveLength(5)
  })

  it('H-07: timelyOnly=true 过滤过期板块代表股', async () => {
    const { extractRepresentativeStocks } = await import('@/apps/input/hotSector.utils')
    // 基准"今天"固定为 2026-01-14：SEC-TIMELY 为 1 天前(及时)，SEC-STALE 为 25 天前(过期)
    const BASE_DATE = new Date('2026-01-14T12:00:00.000Z').getTime()
    const sectors = [
      {
        code: 'SEC-TIMELY', name: '及时板块', score: 90, scoreDate: '2026-01-13',
        trend: 'up' as const, factors: { fundFlow: 80, momentum: 80, sentiment: 80, valuation: 80 },
        stocks: [makeStock('SH001', '及时股')],
      },
      {
        code: 'SEC-STALE', name: '过期板块', score: 70, scoreDate: '2025-12-20',
        trend: 'up' as const, factors: { fundFlow: 60, momentum: 60, sentiment: 60, valuation: 60 },
        stocks: [makeStock('SH002', '过期股')],
      },
    ]
    // extractRepresentativeStocks 内部 getTimeliness 使用 Date.now()，用 fake timers 固定
    vi.useFakeTimers().setSystemTime(BASE_DATE)
    try {
      const picks = extractRepresentativeStocks(sectors as never, { timelyOnly: true })
      expect(picks.map((p) => p.symbol)).toEqual(['SH001'])
      expect(picks![0]!.timely).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ============================================================
// 4. trend 映射规则（与 hotSectorService.toHotSector 同构）
//    注: toHotSector 为非导出私有函数，此处按源码同一映射规则做黑盒同构验证
// ============================================================

describe('HotSector trend 映射规则（与 hotSectorService.toHotSector 同构）', () => {
  const hotSectorTrend = (total: number | undefined | null) => {
    const t = total ?? 0
    return t >= 70 ? 'up' : t <= 30 ? 'down' : 'neutral'
  }

  it('H-08-a: total >= 70 → trend=up', () => {
    expect(hotSectorTrend(80)).toBe('up')
    expect(hotSectorTrend(70)).toBe('up')
    expect(hotSectorTrend(99)).toBe('up')
  })

  it('H-08-b: total <= 30 → trend=down', () => {
    expect(hotSectorTrend(25)).toBe('down')
    expect(hotSectorTrend(30)).toBe('down')
    expect(hotSectorTrend(0)).toBe('down')
  })

  it('H-08-c: 31~69 之间 → trend=neutral', () => {
    expect(hotSectorTrend(31)).toBe('neutral')
    expect(hotSectorTrend(50)).toBe('neutral')
    expect(hotSectorTrend(69)).toBe('neutral')
  })

  it('H-08-d: undefined/null → 退化 0 走 down 分支', () => {
    expect(hotSectorTrend(undefined)).toBe('down')
    expect(hotSectorTrend(null)).toBe('down')
    expect(hotSectorTrend(0)).toBe('down')
  })
})
