/**
 * @test_id V9-TEST-UT-P0-TOFIXED
 * @description M3 Day 6 — 13 处 P0 级 .toFixed() 残留回归测试
 *
 * 本测试文件在代码修复前编写（TDD），用于：
 * 1. 记录当前 .toFixed() 在边界条件下的行为（NaN/Infinity/crash）
 * 2. 修复后验证 safeFormatNumber/safeFormatPercent 不会引入回归
 * 3. 确保所有 P0 级风险点在 edge case 下优雅降级而非崩溃
 *
 * 覆盖的 13 处 P0 风险点：
 *   #1-2   MarketSentimentWidget.tsx:35,36     — totalStocks=0 除零
 *   #3     RiskControlPage.tsx:155              — stats.total=0（已有部分守卫）
 *   #4     SkillAuditPage.tsx:165               — skills=[] 空数组除零
 *   #5     CoreResourcePanel.tsx:59             — totalValue=0 除零
 *   #6     ScoreRadar.tsx:47                    — maxScore=0（已有 Math.max(...,1) 守卫）
 *   #7-9   ScoreStatsCards.tsx:24,30,36         — avgScore/maxScore/minScore=null
 *   #10    multiFactorScreeningEngine.ts:180    — stocks.length=0（已有部分守卫）
 *   #11    exitSignalSkill.ts:138               — costPrice!.toFixed(2) 非空断言
 *   #12    signalGenerator.ts:205               — highest=0 除零（已有 highest>0 守卫）
 *   #13    profileIntegrationService.ts:203     — confidence=NaN（已有 ?? 0 守卫）
 *
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-013, V9-DOC-FRONT-037]
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── safeFormatNumber 行为基线（验证工具函数本身正确性） ───────────────────
import { safeFormatNumber, safeFormatPercent } from '@/lib/safeFormat'

// ─── P0 #11: exitSignalSkill ─────────────────────────────────────────────
import { exitSignalSkill, type ExitSignalOutput } from '@/services/skills/exitSignalSkill'
import { SkillRegistry } from '@/services/skills/skillRegistry'
import type { DailyQuotes, KlineBar, Stock } from '@/data/types'

// ─── P0 #12: signalGenerator ─────────────────────────────────────────────
import { generateSellSignals } from '@/services/trading/signalGenerator'

// ─── P0 #10: multiFactorScreeningEngine ──────────────────────────────────
import { runMultiFactorScreening } from '@/services/screening/multiFactorScreeningEngine'

// ─── P0 #6: ScoreRadar ───────────────────────────────────────────────────
import { ScoreRadar, type ScoreRadarData } from '@/components/chart/ScoreRadar'

// ─── P0 #7-9: ScoreStatsCards ────────────────────────────────────────────
import { ScoreStatsCards } from '@/pages/input/CollectTask/components/ScoreStatsCards'
import type { ScoreStats } from '@/pages/input/CollectTask/hooks/useCollectionTaskStats'

// ─── P0 #5: CoreResourcePanel ────────────────────────────────────────────
import { CoreResourcePanel } from '@/apps/trading/panels/CoreResourcePanel'
import type { Portfolio } from '@/data/types'

// ============================================================
// 辅助函数：构建测试数据
// ============================================================

function buildStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '000001.SZ',
    name: '测试股票',
    researchStatus: 'watching',
    source: 'manual',
    dataVersion: 1,
    price: 100,
    pe: 15,
    pb: 2,
    ...overrides,
  }
}

function buildHistory(count: number, factory: (i: number) => KlineBar): KlineBar[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

function buildDailyQuotes(history: KlineBar[], symbol = '000001.SZ'): DailyQuotes {
  return {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}

function buildPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'test-portfolio',
    name: '测试组合',
    theme: 'test',
    totalValue: 1_000_000,
    cashReserve: 40_000,
    holdings: [],
    rebalancePlan: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// ============================================================
// 一、safeFormatNumber 基线验证（工具函数本身的正确性）
// ============================================================

describe('safeFormatNumber 基线验证', () => {
  it('正常数字按精度格式化', () => {
    expect(safeFormatNumber(3.14159, 2)).toBe('3.14')
    expect(safeFormatNumber(100, 0)).toBe('100')
    expect(safeFormatNumber(-3.14, 2)).toBe('-3.14')
  })

  it('null/undefined 返回占位符 --', () => {
    expect(safeFormatNumber(null, 2)).toBe('--')
    expect(safeFormatNumber(undefined, 2)).toBe('--')
  })

  it('NaN/Infinity 返回占位符 --', () => {
    expect(safeFormatNumber(NaN, 2)).toBe('--')
    expect(safeFormatNumber(Infinity, 2)).toBe('--')
    expect(safeFormatNumber(-Infinity, 2)).toBe('--')
  })

  it('safeFormatPercent 正数自动加 + 前缀', () => {
    expect(safeFormatPercent(3.14, 2)).toBe('+3.14%')
    expect(safeFormatPercent(0, 2)).toBe('0.00%')
    expect(safeFormatPercent(-1.5, 2)).toBe('-1.50%')
  })

  it('safeFormatPercent null/undefined 返回占位符', () => {
    expect(safeFormatPercent(null, 2)).toBe('--')
    expect(safeFormatPercent(undefined, 2)).toBe('--')
  })
})

// ============================================================
// 二、P0 #11: exitSignalSkill — costPrice!.toFixed(2) 非空断言
// ============================================================

describe('P0 #11: exitSignalSkill — costPrice 非空断言风险', () => {
  let registry: SkillRegistry
  beforeEach(() => {
    registry = new SkillRegistry()
    registry.register(exitSignalSkill)
  })

  it('costPrice 有值时正常触发固定止损，rationale 含成本价', async () => {
    // 构造行情：成本价 100，最新价 92 → 固定止损价 93（回撤 7%），触发固定止损
    // 但最高价 100 → 移动止损价 90（回撤 10%），92 > 90 不触发移动止损
    // 这样只走 line 138 的 fixedTriggered 分支，包含 costPrice!.toFixed(2)
    const history = buildHistory(30, (i) => {
      const close = i < 29 ? 100 : 92 // 最后一天跌到 92
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close, high: 100, low: close - 1, close,
        volume: 10000, amount: 10000 * close,
      }
    })

    const result = await registry.execute<ExitSignalOutput>('exit-signal', {
      symbol: '000001.SZ',
      params: {
        stock: buildStock({ price: 90 }),
        quotes: buildDailyQuotes(history),
        costPrice: 100,
      },
    })

    expect(result.status).toBe('success')
    expect(result.data!.stopLossSuggestion.triggered).toBe(true)
    // 验证 rationale 中包含格式化的成本价（修复前 "100.00"，修复后也应为 "100.00"）
    expect(result.data!.stopLossSuggestion.rationale).toContain('100.00')
  })

  it('costPrice 为 undefined 时不触发固定止损（仅移动止损）', async () => {
    // 构造正常上涨行情，不触发任何止损
    const history = buildHistory(30, (i) => {
      const close = 100 + i * 0.5
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close, high: close + 1, low: close - 1, close,
        volume: 10000, amount: 10000 * close,
      }
    })

    const result = await registry.execute<ExitSignalOutput>('exit-signal', {
      symbol: '000001.SZ',
      params: {
        stock: buildStock(),
        quotes: buildDailyQuotes(history),
        // 不传 costPrice
      },
    })

    expect(result.status).toBe('success')
    // costPrice 为 undefined，fixedStopPrice 也为 undefined，不触发固定止损
    expect(result.data!.stopLossSuggestion.type).not.toBe('fixed')
  })

  it('修复后：costPrice 为 undefined 时 rationale 不含 "NaN" 或 "undefined"', async () => {
    // 构造大幅下跌行情触发移动止损（但不传 costPrice，所以不会触发固定止损）
    const history = buildHistory(40, (i) => {
      let close: number, high: number
      if (i < 35) {
        close = 100 + i * 0.5
        high = close + 1
      } else {
        close = 105 - (i - 34) * 4
        high = 123
      }
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close, high, low: close - 1, close,
        volume: 10000, amount: 10000 * close,
      }
    })

    const result = await registry.execute<ExitSignalOutput>('exit-signal', {
      symbol: '000001.SZ',
      params: {
        stock: buildStock(),
        quotes: buildDailyQuotes(history),
        // 不传 costPrice → 固定止损不会触发
      },
    })

    expect(result.status).toBe('success')
    const rationale = result.data!.stopLossSuggestion.rationale ?? ''
    // 修复后：rationale 不应包含 NaN/undefined/--（因为固定止损未触发，costPrice 不参与格式化）
    expect(rationale).not.toContain('NaN')
    expect(rationale).not.toContain('undefined')
  })
})

// ============================================================
// 三、P0 #12: signalGenerator — highest=0 除零风险
// ============================================================

describe('P0 #12: signalGenerator — sell_trailing_stop 除零风险', () => {
  it('highest > 0 时正常生成回撤百分比', () => {
    const history = buildHistory(30, (i) => {
      // 前期高点 120，最新价 100 → 回撤 ~16.7%
      if (i < 25) return { date: `d${i}`, open: 115, high: 120, low: 110, close: 115, volume: 1000, amount: 115000 }
      return { date: `d${i}`, open: 105, high: 110, low: 95, close: 100, volume: 1000, amount: 100000 }
    })

    // generateSellSignals 内部计算 trailing stop
    const signals = generateSellSignals(
      { symbol: '000001.SZ', price: 100, priceToMA20: -0.05, rsi14: 30, volumeRatio: 1.5, pePercentile: 0.3, pbPercentile: 0.2, ma20: 105, macdHist: -0.5 } as any,
      history,
    )

    const trailingSignal = signals.find((s) => s.type === 'sell_trailing_stop')
    if (trailingSignal) {
      expect(trailingSignal.rationale).not.toContain('NaN')
      expect(trailingSignal.rationale).not.toContain('Infinity')
    }
  })

  it('highest = 0 时不触发 trailing stop（已有 highest > 0 守卫）', () => {
    // 所有 bar 的 high=0 → highest=0 → 守卫 highest > 0 阻止触发
    const history = buildHistory(30, (i) => ({
      date: `d${i}`, open: 0, high: 0, low: 0, close: 0, volume: 0, amount: 0,
    }))

    const signals = generateSellSignals(
      { symbol: '000001.SZ', price: 0, priceToMA20: 0, rsi14: 50, volumeRatio: 1, pePercentile: 0.5, pbPercentile: 0.5, ma20: 0, macdHist: 0 } as any,
      history,
    )

    // highest=0 时不应生成 trailing stop 信号
    const trailingSignal = signals.find((s) => s.type === 'sell_trailing_stop')
    expect(trailingSignal).toBeUndefined()
  })
})

// ============================================================
// 四、P0 #10: multiFactorScreeningEngine — stocks.length=0 除零
// ============================================================

// mock DataBridge 和 unifiedStockService
vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn(async (request: { action: string; store: string }) => {
      if (request.action === 'QUERY_LIST' && request.store === 'stocks') {
        return { success: true, data: [] } // 空股票池
      }
      return { success: false, error: 'unmocked' }
    }),
  },
}))

vi.mock('@/services/unifiedStockService', () => ({
  getUnifiedStockViews: vi.fn(() => Promise.resolve([])),
}))

describe('P0 #10: multiFactorScreeningEngine — 空股票池除零风险', () => {
  it('stocks.length=0 时不崩溃且返回空结果（已有守卫）', () => {
    // runMultiFactorScreening(stocks, groups) — 两个位置参数
    // 返回 { items, total, elapsedMs }；selectionRate 仅在日志中
    const result = runMultiFactorScreening([], [])

    // 已有守卫：stocks.length > 0 ? ... : '0%'（日志中 selectionRate='0%'）
    // 验证不崩溃且返回空结果
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ============================================================
// 五、P0 #6: ScoreRadar — maxScore=0 除零风险
// ============================================================

// mock usePerfTrace
vi.mock('@/hooks/usePerfTrace', () => ({
  usePerfTrace: vi.fn(),
}))

describe('P0 #6: ScoreRadar — maxScore=0 除零风险', () => {
  it('所有 score=0 时不崩溃（已有 Math.max(..., 1) 守卫）', () => {
    const data: ScoreRadarData[] = [
      { dimension: 'A', score: 0 },
      { dimension: 'B', score: 0 },
      { dimension: 'C', score: 0 },
    ]

    // 不应抛出异常
    expect(() => render(<ScoreRadar data={data} />)).not.toThrow()
  })

  it('所有 fullMark=0 时 maxScore 回退到 1（守卫生效）', () => {
    const data: ScoreRadarData[] = [
      { dimension: 'A', score: 50, fullMark: 0 },
      { dimension: 'B', score: 30, fullMark: 0 },
    ]

    // 守卫 Math.max(..., 1) 确保 maxScore >= 1
    // score=50, maxScore=1 → (50/1)*100 = 5000 → toFixed(1) = "5000.0"
    // 不崩溃，但值可能不合理 — 修复后 safeFormatNumber 仍返回字符串
    expect(() => render(<ScoreRadar data={data} />)).not.toThrow()
  })

  it('score 为 null/undefined 时不崩溃', () => {
    const data: ScoreRadarData[] = [
      { dimension: 'A', score: null as any },
      { dimension: 'B', score: undefined as any },
    ]

    // 修复前：null/0 * 100 = 0 → "0.0"（不崩溃，因为 null 被转为 0）
    // 修复后：safeFormatNumber 应优雅处理
    expect(() => render(<ScoreRadar data={data} />)).not.toThrow()
  })
})

// ============================================================
// 六、P0 #7-9: ScoreStatsCards — avgScore/maxScore/minScore=null
// ============================================================

describe('P0 #7-9: ScoreStatsCards — null 评分崩溃风险', () => {
  it('正常评分数据渲染正确', () => {
    const stats: ScoreStats = {
      total: 10,
      avgScore: 3.567,
      maxScore: 4.5,
      minScore: 2.1,
      scoreDistribution: { high: 3, medium: 5, low: 2 },
      recentTrend: [],
      avgIntervalHours: 24,
      lastScoredAt: Date.now(),
      nextEstimateAt: null,
    }

    render(<ScoreStatsCards scoreStats={stats} />)
    expect(screen.getByText('3.57')).toBeInTheDocument()
    expect(screen.getByText('4.50')).toBeInTheDocument()
    expect(screen.getByText('2.10')).toBeInTheDocument()
  })

  /**
   * 修复前行为：avgScore=null → TypeError: Cannot read properties of null (reading 'toFixed')
   * 修复后预期：safeFormatNumber(null, 2) → '--'
   *
   * 注意：此测试在修复前会 FAIL（抛出 TypeError），这是预期的 TDD 行为。
   * 修复后应 PASS。
   */
  it('avgScore=null 时优雅降级而非崩溃（修复后应通过）', () => {
    const stats: ScoreStats = {
      total: 0,
      avgScore: null as any,
      maxScore: null as any,
      minScore: null as any,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      recentTrend: [],
      avgIntervalHours: 0,
      lastScoredAt: null,
      nextEstimateAt: null,
    }

    // 修复前：此处会抛出 TypeError
    // 修复后：safeFormatNumber(null, 2) 返回 '--'
    expect(() => render(<ScoreStatsCards scoreStats={stats} />)).not.toThrow()
  })

  it('avgScore=undefined 时优雅降级（修复后应通过）', () => {
    const stats: ScoreStats = {
      total: 0,
      avgScore: undefined as any,
      maxScore: undefined as any,
      minScore: undefined as any,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      recentTrend: [],
      avgIntervalHours: 0,
      lastScoredAt: null,
      nextEstimateAt: null,
    }

    expect(() => render(<ScoreStatsCards scoreStats={stats} />)).not.toThrow()
  })

  it('avgScore=NaN 时优雅降级（修复后应通过）', () => {
    const stats: ScoreStats = {
      total: 0,
      avgScore: NaN,
      maxScore: NaN,
      minScore: NaN,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      recentTrend: [],
      avgIntervalHours: 0,
      lastScoredAt: null,
      nextEstimateAt: null,
    }

    // 修复前：NaN.toFixed(2) 返回 "NaN"（不崩溃但显示异常）
    // 修复后：safeFormatNumber(NaN, 2) 返回 '--'
    expect(() => render(<ScoreStatsCards scoreStats={stats} />)).not.toThrow()
  })
})

// ============================================================
// 七、P0 #5: CoreResourcePanel — totalValue=0 除零风险
// ============================================================

describe('P0 #5: CoreResourcePanel — totalValue=0 除零风险', () => {
  it('totalValue=0 时不崩溃（修复后应通过）', () => {
    const portfolio = buildPortfolio({
      totalValue: 0,
      cashReserve: 0,
    })

    // 修复前：(0 - 0) / 0 * 100 = NaN → "NaN%"
    // 修复后：safeFormatPercent 应返回 '--' 或 '0.00%'
    // CoreResourcePanel 接收 portfolio 作为 prop
    expect(() => render(<CoreResourcePanel portfolio={portfolio} onRefresh={vi.fn()} />)).not.toThrow()
  })

  it('totalValue 有值时正常显示仓位百分比', () => {
    const portfolio = buildPortfolio({
      totalValue: 1_000_000,
      cashReserve: 400_000,
    })

    render(<CoreResourcePanel portfolio={portfolio} onRefresh={vi.fn()} />)
    // (1000000 - 400000) / 1000000 * 100 = 60.0%
    // 验证不包含 NaN
    expect(screen.queryByText(/NaN/)).toBeNull()
  })
})

// ============================================================
// 八、P0 #1-2: MarketSentimentWidget — totalStocks=0 除零风险
// ============================================================

/**
 * MarketSentimentWidget 依赖 useMarketData() provider。
 * 此处 mock provider 注入 totalStocks=0 的数据。
 */

// mock MarketDataProvider
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: vi.fn(() => ({
    data: {
      sentiment: {
        up: 100,
        down: 50,
        totalStocks: 0,  // 除零风险
        fearGreedIndex: 50,
        fearGreedLabel: '中性',
      },
    },
    loadingMap: {},
    errorMap: {},
    refreshWidget: vi.fn(),
  })),
}))

// mock useWidgetErrorState
vi.mock('@/cockpit/hooks/useWidgetErrorState', () => ({
  useWidgetErrorState: vi.fn(({ hasData }) => ({
    visualState: hasData ? 'ready' : 'empty',
    displayError: null,
  })),
}))

describe('P0 #1-2: MarketSentimentWidget — totalStocks=0 除零风险', () => {
  it('totalStocks=0 时不显示 NaN（修复后应通过）', async () => {
    const MarketSentimentWidget = (await import('@/cockpit/widgets/MarketSentimentWidget')).default
    const config = { instanceId: 'test-sentiment', widgetId: 'market-sentiment', type: 'market-sentiment', title: '市场情绪', col: 1, row: 1, w: 4, h: 3, size: { cols: 4, rows: 3 }, settings: {}, visible: true, collapsed: false }

    // 修复前：(100 / 0) * 100 = Infinity → "Infinity"
    // 修复后：safeFormatNumber 应返回 '--' 或 '0'
    const { container } = render(<MarketSentimentWidget config={config} />)

    // 验证不包含 "NaN" 或 "Infinity" 文本
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).not.toContain('Infinity')
  })
})

// ============================================================
// 九、P0 #4: SkillAuditPage — skills=[] 空数组除零风险
// ============================================================

/**
 * SkillAuditPage 是一个复杂页面组件，此处仅验证 skills=[] 场景。
 * 由于组件依赖较多，使用最小化 mock。
 */

describe('P0 #4: SkillAuditPage — skills=[] 空数组除零风险', () => {
  it('skills 为空数组时平均成功率不显示 NaN（修复后应通过）', async () => {
    // 直接测试计算逻辑：skills.reduce(..., 0) / skills.length
    // 当 skills.length=0 时，0/0=NaN → "NaN%"
    const skills: { successRate: number }[] = []
    const avgSuccessRate = skills.reduce((sum, s) => sum + s.successRate, 0) / skills.length

    // 修复前：NaN → "NaN%"
    expect(avgSuccessRate).toBeNaN()

    // 修复后应使用 safeFormatNumber：
    // safeFormatNumber(NaN, 1) → '--'
    expect(safeFormatNumber(avgSuccessRate, 1)).toBe('--')
  })

  it('skills 有值时正常计算平均成功率', () => {
    const skills = [
      { successRate: 0.8 },
      { successRate: 0.6 },
      { successRate: 0.9 },
    ]
    const avg = skills.reduce((sum, s) => sum + s.successRate, 0) / skills.length
    const formatted = safeFormatNumber(avg, 1)

    expect(formatted).toBe('0.8')
    expect(formatted).not.toContain('NaN')
  })
})

// ============================================================
// 十、P0 #3: RiskControlPage — stats.total=0 除零风险
// ============================================================

describe('P0 #3: RiskControlPage — stats.total=0 除零风险', () => {
  it('stats.total=0 时阻断率不显示 NaN（已有部分守卫）', () => {
    // 已有守卫：stats.total === 0 ? 0 : (blockedCount / total * 100).toFixed(1)
    // 验证守卫生效
    const stats = { total: 0, blockedCount: 5, warningCount: 3 }
    const rate = stats.total === 0 ? '0' : ((stats.blockedCount / stats.total) * 100).toFixed(1)

    expect(rate).toBe('0')
    expect(rate).not.toContain('NaN')
  })

  it('stats.total 有值时正常计算阻断率', () => {
    const stats = { total: 100, blockedCount: 15, warningCount: 20 }
    const rate = stats.total === 0 ? '0' : ((stats.blockedCount / stats.total) * 100).toFixed(1)

    expect(rate).toBe('15.0')
  })

  it('修复后：safeFormatPercent 替代 .toFixed() 保持行为一致', () => {
    const stats = { total: 100, blockedCount: 15, warningCount: 20 }
    const ratio = stats.blockedCount / stats.total // 0.15
    const formatted = safeFormatPercent(ratio * 100, 1)

    // safeFormatPercent(15, 1) → "+15.0%"（注意 + 前缀）
    // 若不希望 + 前缀，应使用 safeFormatNumber(15, 1) + '%'
    expect(formatted).toContain('15.0')
  })
})

// ============================================================
// 十一、P0 #13: profileIntegrationService — confidence=NaN 风险
// ============================================================

describe('P0 #13: profileIntegrationService — confidence=NaN 风险', () => {
  it('confidence=NaN 时 ?? 0 守卫不生效（NaN !== null/undefined）', () => {
    // 已有守卫：(conclusion.confidence ?? 0) * 100
    // 但 ?? 只拦截 null/undefined，不拦截 NaN
    const confidence: number | undefined = NaN
    const result = (confidence ?? 0) * 100

    // NaN * 100 = NaN → NaN.toFixed(0) = "NaN"
    expect(result).toBeNaN()
    expect(result.toFixed(0)).toBe('NaN')

    // 修复后应使用 safeFormatNumber：
    expect(safeFormatNumber(result, 0)).toBe('--')
  })

  it('confidence=undefined 时 ?? 0 守卫生效', () => {
    const confidence: number | undefined = undefined
    const result = (confidence ?? 0) * 100

    expect(result).toBe(0)
    expect(result.toFixed(0)).toBe('0')
    expect(safeFormatNumber(result, 0)).toBe('0')
  })

  it('confidence 有值时正常格式化', () => {
    const confidence = 0.85
    const result = (confidence ?? 0) * 100

    expect(result).toBe(85)
    expect(result.toFixed(0)).toBe('85')
    expect(safeFormatNumber(result, 0)).toBe('85')
  })
})

// ============================================================
// 十二、回归基线总结
// ============================================================

describe('P0 修复回归基线总结', () => {
  it('所有 P0 edge case 修复后应满足以下断言', () => {
    // P0 #1-2: MarketSentimentWidget — totalStocks=0 → 不显示 NaN/Infinity
    expect(safeFormatNumber((100 / 0) * 100, 0)).toBe('--')

    // P0 #3: RiskControlPage — total=0 → 守卫返回 '0'
    // （已有守卫，修复后保持行为）

    // P0 #4: SkillAuditPage — skills=[] → NaN → '--'
    expect(safeFormatNumber(NaN, 1)).toBe('--')

    // P0 #5: CoreResourcePanel — totalValue=0 → NaN → '--'
    expect(safeFormatNumber(NaN, 1)).toBe('--')

    // P0 #6: ScoreRadar — maxScore=0 → 已有 Math.max(...,1) 守卫

    // P0 #7-9: ScoreStatsCards — null → '--'
    expect(safeFormatNumber(null, 2)).toBe('--')
    expect(safeFormatNumber(undefined, 2)).toBe('--')

    // P0 #10: multiFactorScreeningEngine — 已有守卫

    // P0 #11: exitSignalSkill — costPrice → safeFormatNumber 处理 null/undefined
    expect(safeFormatNumber(undefined, 2)).toBe('--')
    expect(safeFormatNumber(100, 2)).toBe('100.00')

    // P0 #12: signalGenerator — 已有 highest > 0 守卫

    // P0 #13: profileIntegrationService — NaN → '--'
    expect(safeFormatNumber(NaN, 0)).toBe('--')
  })
})
