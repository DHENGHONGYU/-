/**
 * L0/L1/L2 计算器 — 单元测试
 *
 * 覆盖：
 * - judgeLongTermTrend / scoreLongTermTrend
 * - buildScoreBoard / scoreScoreBoard
 * - judgeValuation / scoreValuation
 * - L0MacroCalculator / L1MoatCalculator / L2PeerCalculator
 */

import {
  judgeLongTermTrend,
  scoreLongTermTrend,
  buildScoreBoard,
  scoreScoreBoard,
  judgeValuation,
  scoreValuation,
  L0MacroCalculator,
  L1MoatCalculator,
  L2PeerCalculator,
} from './l0_l1_l2'
import type { LayerInput, StockBasicData, FinancialData } from '../types'

type TestLayerInput = Partial<Omit<LayerInput, 'stock'>> & { stock?: Partial<StockBasicData> }
import { DEFAULT_ENGINE_CONFIG } from '../config'

// ============================================================
// Mock logger
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// 测试数据工厂
// ============================================================

function createInput(partial: TestLayerInput = {}): LayerInput {
  return {
    stock: {
      symbol: 'TEST',
      name: '测试股票',
      sector: '科技',
      price: 100,
      marketCap: 1000e8,
      pe: 20,
      pb: 2,
      roe: 0.15,
      eps: 1,
      peg: 0.8,
      ...partial.stock,
    },
    financials: {
      revenue: 50,
      revenueYoY: 0.30,
      netProfit: 5,
      netProfitYoY: 0.20,
      grossMargin: 0.40,
      netMargin: 0.10,
      operatingCF: 8,
      rdRatio: 0.10,
      receivables: 5,
      inventoryTurnoverDays: 20,
      interestBearingDebt: 10,
      goodwill: 1,
      netAssets: 100,
      ordersInHand: 60,
      newOrders: 20,
      shareholderPledge: 0.05,
      customerConcentration: 0.20,
      auditOpinion: '标准无保留意见',
      ...partial.financials,
    },
    quotes: {
      latestClose: 100,
      return20d: 0.05,
      volatility20d: 0.03,
      avgTurnover20d: 0.02,
      return60d: 0.10,
      history: [100, 102, 104, 106, 108, 110],
      volumeHistory: [1000000, 1000000, 1000000, 1000000, 1000000, 1000000],
      ...partial.quotes,
    },
    config: partial.config ?? DEFAULT_ENGINE_CONFIG,
  }
}

// ============================================================
// judgeLongTermTrend
// ============================================================

describe('judgeLongTermTrend', () => {
  it('上升：last > first * 1.05', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5)
    expect(judgeLongTermTrend(prices, 30)).toBe('上升')
  })

  it('下降：last < first * 0.95', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 - i * 0.5)
    expect(judgeLongTermTrend(prices, 30)).toBe('下降')
  })

  it('横盘：其他情况', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1))
    expect(judgeLongTermTrend(prices, 30)).toBe('横盘')
  })

  it('无数据：空数组', () => {
    expect(judgeLongTermTrend([], 30)).toBe('无数据')
  })

  it('短期(<30)：返回无数据', () => {
    const prices = [100, 101, 102]
    expect(judgeLongTermTrend(prices, 20)).toBe('无数据')
  })

  it('数据不足：返回无数据', () => {
    const prices = [100, 101]
    expect(judgeLongTermTrend(prices, 30)).toBe('无数据')
  })
})

// ============================================================
// scoreLongTermTrend
// ============================================================

describe('scoreLongTermTrend', () => {
  it('上升趋势 → 4分', () => {
    const history = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5)
    const input = createInput({ quotes: { history } })
    // L0_TREND_UP_SCORE=4, 日均涨幅约0.5%未触发加速(需>=3%)
    expect(scoreLongTermTrend(input)).toBe(4)
  })

  it('横盘趋势 → 3分', () => {
    const history = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1))
    const input = createInput({ quotes: { history } })
    expect(scoreLongTermTrend(input)).toBe(3)
  })

  it('下降趋势 → 2分', () => {
    const history = Array.from({ length: 30 }, (_, i) => 100 - i * 0.5)
    const input = createInput({ quotes: { history } })
    expect(scoreLongTermTrend(input)).toBe(2)
  })

  it('上涨加速（连续3天>=3%）→ 额外+0.5 → 4.5分', () => {
    // 前27天缓慢上涨到100附近，最后3天加速上涨>=3%/天
    // last3=[100,104,108.16]: d1=4%, d2=4%，均>=3%；整体趋势上升(last=108.16 > first=100*1.05=105)
    const history = Array.from({ length: 30 }, (_, i) => {
      if (i < 27) return 100
      if (i === 27) return 100
      if (i === 28) return 104
      return 108.16
    })
    const input = createInput({ quotes: { history } })
    // 上升基础分4 + 加速0.5 = 4.5
    expect(scoreLongTermTrend(input)).toBe(4.5)
  })

  it('下跌加速（连续3天<=-3%）→ 额外-0.5', () => {
    const history = Array.from({ length: 30 }, (_, i) => (i < 27 ? 100 - i * 0.1 : 97.3 - (i - 27) * 3))
    const input = createInput({ quotes: { history } })
    // 趋势下降(91<100*0.95)=2分，加速-0.5=1.5
    expect(scoreLongTermTrend(input)).toBe(1.5)
  })

  it('无历史数据 → 0分', () => {
    const input = createInput({
      quotes: { history: [] },
    })
    expect(scoreLongTermTrend(input)).toBe(0)
  })
})

// ============================================================
// buildScoreBoard
// ============================================================

describe('buildScoreBoard', () => {
  it('完整数据构建评分板', () => {
    const stock: StockBasicData = {
      symbol: 'TEST',
      name: '测试',
      roe: 0.15,
      pe: 20,
      pb: 2,
    }
    const financials: FinancialData = {
      revenueYoY: 0.30,
      netProfitYoY: 0.20,
      grossMargin: 0.40,
      netMargin: 0.10,
      operatingCF: 8,
      interestBearingDebt: 10,
      netAssets: 100,
      rdRatio: 0.10,
    }
    const board = buildScoreBoard(stock, financials)
    expect(Object.keys(board).length).toBe(10)
    expect(board['ROE']).toBeGreaterThanOrEqual(1)
    expect(board['ROE']).toBeLessThanOrEqual(5)
    expect(board['PE']).toBe(3) // 20 < 30 且 >=15
    expect(board['PB']).toBe(3) // 2 < 4 且 >=2
    expect(board['毛利率']).toBe(4) // 0.40 * 10 = 4
  })

  it('只传部分数据 → 缺失项默认3分', () => {
    const stock: StockBasicData = { symbol: 'TEST', name: '测试' }
    const financials: FinancialData = {}
    const board = buildScoreBoard(stock, financials)
    expect(board['ROE']).toBe(3)
    expect(board['PE']).toBe(3)
    expect(board['毛利率']).toBe(3)
    expect(Object.keys(board).length).toBe(10)
  })
})

// ============================================================
// scoreScoreBoard
// ============================================================

describe('scoreScoreBoard', () => {
  const board = {
    ROE: 4,
    PE: 3,
    PB: 5,
    营收增速: 4,
    净利增速: 3,
    毛利率: 4,
    净利率: 3,
    现金流: 4,
    负债率: 3,
    研发占比: 4,
  }

  it('全部指标 → 平均分', () => {
    const score = scoreScoreBoard(board)
    expect(score).toBe(3.7) // 37/10=3.7
  })

  it('过滤PE → 排除PE后的平均分', () => {
    const score = scoreScoreBoard(board, ['ROE', 'PB', 'PE'])
    expect(score).toBe(4) // (4+5+3)/3=4
  })

  it('过滤RPS → 排除不存在指标后正常计算', () => {
    const score = scoreScoreBoard(board, ['ROE', 'PE', 'PB'])
    expect(score).toBe(4)
  })

  it('过滤RPS+PE → 只保留存在的指标', () => {
    const score = scoreScoreBoard(board, ['ROE', 'PB', 'RPS'])
    expect(score).toBe(4.5) // (4+5)/2=4.5
  })

  it('空过滤数组 → 返回0', () => {
    const score = scoreScoreBoard(board, [])
    expect(score).toBe(0)
  })

  it('过滤不存在的关键字 → 返回0', () => {
    const score = scoreScoreBoard(board, ['RPS', 'XYZ'])
    expect(score).toBe(0)
  })
})

// ============================================================
// judgeValuation
// ============================================================

describe('judgeValuation', () => {
  it('低估：PE低+高增长', () => {
    expect(judgeValuation(10, 0.60, 0.70)).toBe('低估')
  })

  it('合理：中等PE', () => {
    expect(judgeValuation(25, 0.10, 0.15)).toBe('合理')
  })

  it('高估：较高PE', () => {
    expect(judgeValuation(40, 0.10, 0.15)).toBe('高估')
  })

  it('极高：极高PE', () => {
    expect(judgeValuation(60, 0.05, 0.05)).toBe('极高')
  })

  it('亏损：PE < 0', () => {
    expect(judgeValuation(-10, 0.30, -0.20)).toBe('亏损')
  })

  it('无PE：PE undefined', () => {
    expect(judgeValuation(undefined, 0.30, 0.20)).toBe('无PE')
  })

  it('芯片行业：低PE+高增长 → 低估', () => {
    expect(judgeValuation(25, 0.60, 0.70, '芯片设计')).toBe('低估')
  })

  it('芯片行业：中等PE → 合理', () => {
    expect(judgeValuation(40, 0.20, 0.30, '半导体')).toBe('合理')
  })

  it('芯片行业：高PE → 高估', () => {
    expect(judgeValuation(60, 0.10, 0.15, '芯片')).toBe('高估')
  })

  it('芯片行业：极高PE → 极高', () => {
    expect(judgeValuation(100, 0.05, 0.05, '半导体')).toBe('极高')
  })
})

// ============================================================
// scoreValuation
// ============================================================

describe('scoreValuation', () => {
  it('低估+高增 → 5分', () => {
    const input = createInput({ stock: { pe: 10 }, financials: { revenueYoY: 0.60 } })
    expect(scoreValuation(input)).toBe(5)
  })

  it('合理+中增 → 3.5分', () => {
    const input = createInput({ stock: { pe: 25 }, financials: { revenueYoY: 0.20 } })
    expect(scoreValuation(input)).toBe(3.5)
  })

  it('高估 → 2分', () => {
    const input = createInput({ stock: { pe: 40 }, financials: { revenueYoY: 0.10 } })
    expect(scoreValuation(input)).toBe(2)
  })

  it('极高 → 1分', () => {
    const input = createInput({ stock: { pe: 60 }, financials: { revenueYoY: 0.05 } })
    expect(scoreValuation(input)).toBe(1)
  })

  it('亏损 → 1.5分', () => {
    const input = createInput({ stock: { pe: -10 } })
    expect(scoreValuation(input)).toBe(1.5)
  })

  it('无数据（PE undefined） → 0分', () => {
    const input = createInput({ stock: { pe: undefined } })
    expect(scoreValuation(input)).toBe(0)
  })
})

// ============================================================
// L0MacroCalculator (L0TrendCalculator)
// ============================================================

describe('L0MacroCalculator', () => {
  it('正常输入：科技行业 → 较高分', async () => {
    const input = createInput({ stock: { sector: 'AI芯片' } })
    const result = await L0MacroCalculator.calculate(input)
    expect(result.layerId).toBe('l0')
    expect(result.score).toBeGreaterThan(3)
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('正常输入：金融行业 → 较低分', async () => {
    const input = createInput({ stock: { sector: '银行' } })
    const result = await L0MacroCalculator.calculate(input)
    expect(result.layerId).toBe('l0')
    expect(result.score).toBeGreaterThanOrEqual(2)
  })

  it('无数据：空sector → 不崩溃', async () => {
    const input = createInput({ stock: { sector: undefined } })
    const result = await L0MacroCalculator.calculate(input)
    expect(result.score).toBeGreaterThanOrEqual(2)
    expect(result.score).toBeLessThanOrEqual(4)
  })

  it('营收高增 → summary包含高增', async () => {
    const input = createInput({ financials: { revenueYoY: 0.50 } })
    const result = await L0MacroCalculator.calculate(input)
    expect(result.summary).toContain('营收高增')
  })
})

// ============================================================
// L1MoatCalculator (L1ScoreBoardCalculator)
// ============================================================

describe('L1MoatCalculator', () => {
  it('正常输入：高研发+高市值 → 强护城河', async () => {
    const input = createInput({
      stock: { marketCap: 6000e8 },
      financials: { rdRatio: 0.10 },
    })
    const result = await L1MoatCalculator.calculate(input)
    expect(result.layerId).toBe('l1')
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.evidence.some((e) => e.includes('研发'))).toBe(true)
  })

  it('无指标：空财务 → 兜底低分', async () => {
    const input = createInput({
      stock: { marketCap: undefined },
      financials: {},
    })
    const result = await L1MoatCalculator.calculate(input)
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(3)
  })

  it('科技行业 → 网络效应加分', async () => {
    const input = createInput({ stock: { sector: 'AI' } })
    const result = await L1MoatCalculator.calculate(input)
    expect(result.evidence.some((e) => e.includes('网络效应'))).toBe(true)
  })

  it('医药行业 → 专利壁垒加分', async () => {
    const input = createInput({ stock: { sector: '创新药' } })
    const result = await L1MoatCalculator.calculate(input)
    expect(result.evidence.some((e) => e.includes('专利'))).toBe(true)
  })
})

// ============================================================
// L2PeerCalculator (L2ValuationCalculator)
// ============================================================

describe('L2PeerCalculator', () => {
  it('正常输入：大市值+科技 → 第一梯队', async () => {
    const input = createInput({
      stock: { sector: '芯片', marketCap: 12000e8 },
      financials: { revenue: 150 },
    })
    const result = await L2PeerCalculator.calculate(input)
    expect(result.layerId).toBe('l2')
    expect(result.score).toBeGreaterThanOrEqual(3.5)
    expect(result.summary).toContain('第一梯队')
  })

  it('无数据：无市值无营收 → 基础分', async () => {
    const input = createInput({
      stock: { marketCap: undefined, sector: undefined },
      financials: { revenue: undefined },
    })
    const result = await L2PeerCalculator.calculate(input)
    expect(result.score).toBeGreaterThanOrEqual(2)
    expect(result.score).toBeLessThanOrEqual(4)
  })

  it('中等市值 → 稳定份额', async () => {
    // L2_PEER_MEDIUM_CAP=100e8, L2_PEER_LARGE_CAP=500e8; 300亿处于中等市值区间
    const input = createInput({
      stock: { marketCap: 300e8 },
    })
    const result = await L2PeerCalculator.calculate(input)
    expect(result.evidence.some((e) => e.includes('稳定份额'))).toBe(true)
  })
})
