import { describe, it, expect, vi, beforeEach } from 'vitest'
import { L4ScenarioCalculator, L5TMCalculator, L6HypeCalculator } from './l4_l5_l6'
import type { LayerInput, StockBasicData } from '../types'
import { DEFAULT_ENGINE_CONFIG } from '../config'

type TestLayerInput = Partial<Omit<LayerInput, 'stock'>> & { stock?: Partial<StockBasicData> }

// ============================================================
// Mock logger — 使用单例实例确保测试可与源文件共享同一对象
// ============================================================
vi.mock('@/lib/logger', () => {
  const instance = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
  return { getLogger: () => instance }
})

// ============================================================
// Helper
// ============================================================
function createInput(overrides: TestLayerInput = {}): LayerInput {
  return {
    stock: { symbol: 'TEST', name: 'Test Stock', ...overrides.stock },
    financials: { ...overrides.financials },
    quotes: { ...overrides.quotes },
    config: overrides.config ?? DEFAULT_ENGINE_CONFIG,
  }
}

// ============================================================
// buildScenarios — 通过 L4ScenarioCalculator 间接验证
// ============================================================
describe('buildScenarios (via L4ScenarioCalculator evidence)', () => {
  it('完整参数计算正确', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.2 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // 手动验算:
    // upNP=12, upPE=24, upPrice=(12/10)*100*(24/20)=144
    // baseNP=10.6, basePrice=(10.6/10)*100=106
    // downNP=9.4, downPE=16, downPrice=(9.4/10)*100*(16/20)=75.2
    // 概率: BULL=30%, BASE=50%, BEAR=20%
    expect(result.evidence).toContain('当前价: 100.00')
    expect(result.evidence).toContain('乐观: 144.00 (30%)')
    expect(result.evidence).toContain('基准: 106.00 (50%)')
    expect(result.evidence).toContain('悲观: 75.20 (20%)')
    // 概率加权价 = 144*0.3 + 106*0.5 + 75.2*0.2 = 43.2 + 53 + 15.04 = 111.24
    expect(result.evidence).toContain('概率加权价: 111.24')
  })

  it('使用默认值处理 undefined', async () => {
    const input = createInput({
      stock: { price: 100 },
      financials: {},
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // np=0→(np||1)=1, basePE=25(默认), growth=0.15(默认); np=0导致所有价格为0
    expect(result.evidence).toContain('当前价: 100.00')
    expect(result.evidence).toContain('乐观: 0.00 (30%)')
    expect(result.evidence).toContain('基准: 0.00 (50%)')
    expect(result.evidence).toContain('悲观: 0.00 (20%)')
  })

  it('当前价=1 时比例计算正确', async () => {
    const input = createInput({
      stock: { price: 1, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.2 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // 与price=100同比例缩放: upPrice=1.44, basePrice=1.06, downPrice=0.752
    expect(result.evidence).toContain('当前价: 1.00')
    expect(result.evidence).toContain('乐观: 1.44 (30%)')
    expect(result.evidence).toContain('基准: 1.06 (50%)')
    expect(result.evidence).toContain('悲观: 0.75 (20%)')
  })

  it('负增长情景', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: -0.1 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // growth=-0.1:
    // upNP=10*(1+max(0.2,-0.05))=12, upPrice=144
    // baseNP=10*(1+min(0.15,-0.03))=9.7, basePrice=97
    // downNP=10*(1-max(0.05,min(0.2,-0.03)))=10*(1-0.05)=9.5, downPrice=76
    expect(result.evidence).toContain('乐观: 144.00 (30%)')
    expect(result.evidence).toContain('基准: 97.00 (50%)')
    expect(result.evidence).toContain('悲观: 76.00 (20%)')
  })
})

// ============================================================
// scoreScenario — 各 score 边界（通过 L4 返回值验证）
// ============================================================
describe('scoreScenario boundaries (via L4ScenarioCalculator)', () => {
  // 基础参数: currentPrice=100, netProfit=10, pe=20
  // baseUpside = min(0.15, growth*0.3)，上限0.15
  // 注意: L4_SCENARIO_UPSIDE_TIER3=0，故任何正增长(baseUpside>0)均score=3;
  //       baseUpside上限0.15 < TIER2(0.2)，故score=3.5/4/4.5/5均不可达

  it('score=2: 无增长（baseUpside=0）', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    expect(result.score).toBe(2)
    expect(result.summary).toContain('情景偏弱')
  })

  it('低增长正增长 → score=3（score=2.5不可达，因TIER3=0，任何baseUpside>0均落入score=3分支）', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.1 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // baseUpside = min(0.15, 0.03) = 0.03 > 0 → score=3
    expect(result.score).toBe(3)
    expect(result.summary).toContain('情景中性')
  })

  it('score=3: 中等增长 baseUpside在(0,0.2)区间', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.3 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // baseUpside=min(0.15,0.09)=0.09, rewardRatio≈(144-100)*0.3/((100-75.2)*0.2)=13.2/4.96≈2.66
    // 但baseUpside=0.09 < TIER2(0.2)，无法进入score=4分支，故score=3
    expect(result.score).toBe(3)
    expect(result.summary).toContain('情景中性')
  })

  it('较高增长但baseUpside<0.2 → score=3（score=3.5不可达，因baseUpside上限0.15<TIER2=0.2）', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.5 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // baseUpside=min(0.15,0.15)=0.15 < 0.2(TIER2) → score=3
    expect(result.score).toBe(3)
  })

  it('高增长rewardRatio>2但baseUpside仍<0.2 → score=3（score=4不可达）', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.6 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // baseUpside=min(0.15,0.18)=0.15 < 0.2 → score=3
    expect(result.score).toBe(3)
    expect(result.summary).toContain('情景中性')
  })

  it('score=4.5/5不可达（baseUpside上限0.15 < TIER1=0.5且<TIER2=0.2，最高score=3）', async () => {
    // 即使 growth 极大，baseUpside 最大仍为 0.15，故最高只能到 3
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 10.0 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    expect(result.score).toBe(3)
  })
})

// ============================================================
// evaluateTMMatrix — 通过 L5TMCalculator 间接验证
// ============================================================
describe('evaluateTMMatrix (via L5TMCalculator)', () => {
  it('芯片/半导体/AI/科技行业', async () => {
    const input = createInput({ stock: { sector: '半导体芯片' } })
    const result = await L5TMCalculator.calculate(input)
    // techScore=70, marketScore=60 → (130/200)*5 = 3.25
    expect(result.score).toBe(3.25)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('技术成熟度: 70/100')]))
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('市场成熟度: 60/100')]))
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('最佳击球区')]))
  })

  it('医药行业', async () => {
    const input = createInput({ stock: { sector: '创新药' } })
    const result = await L5TMCalculator.calculate(input)
    // techScore=55, marketScore=45 → (100/200)*5 = 2.5
    expect(result.score).toBe(2.5)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('技术成熟度: 55/100')]))
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('市场成熟度: 45/100')]))
  })

  it('新能源行业', async () => {
    const input = createInput({ stock: { sector: '光伏新能源' } })
    const result = await L5TMCalculator.calculate(input)
    // techScore=65, marketScore=55 → (120/200)*5 = 3.0
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('技术成熟度: 65/100')]))
  })

  it('其他行业', async () => {
    const input = createInput({ stock: { sector: '消费零售' } })
    const result = await L5TMCalculator.calculate(input)
    // techScore=50, marketScore=50 → (100/200)*5 = 2.5
    expect(result.score).toBe(2.5)
  })

  it('营收增速>50% 市场成熟度+10', async () => {
    const input = createInput({
      stock: { sector: 'AI科技' },
      financials: { revenueYoY: 0.6 },
    })
    const result = await L5TMCalculator.calculate(input)
    // techScore=70, marketScore=70 → (140/200)*5 = 3.5
    expect(result.score).toBe(3.5)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('市场成熟度: 70/100')]))
  })

  it('营收增速>30% 市场成熟度+5', async () => {
    const input = createInput({
      stock: { sector: '新能源' },
      financials: { revenueYoY: 0.4 },
    })
    const result = await L5TMCalculator.calculate(input)
    // techScore=65, marketScore=60 → (125/200)*5 = 3.125 → rounded 3.13
    expect(result.score).toBeCloseTo(3.13, 2)
  })
})

// ============================================================
// evaluateHypeCycle — 通过 L6HypeCalculator 间接验证
// ============================================================
describe('evaluateHypeCycle (via L6HypeCalculator)', () => {
  it('AI/机器人 + 高增 + 有订单 → 期望膨胀期有交付, score=4', async () => {
    const input = createInput({
      stock: { sector: 'AI人工智能' },
      financials: { revenueYoY: 0.5, ordersInHand: 10 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(4)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('期望膨胀期（有交付）')]))
    expect(result.risks).toEqual([])
  })

  it('AI/机器人 + 无交付 → 期望膨胀期纯概念, score=3', async () => {
    const input = createInput({
      stock: { sector: '人形机器人' },
      financials: { revenueYoY: 0.5 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('期望膨胀期（纯概念）')]))
    expect(result.risks).toContain('处于Hype泡沫期，需警惕估值回调')
  })

  it('量子 → 技术萌芽期, score=3', async () => {
    const input = createInput({ stock: { sector: '量子计算' } })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('技术萌芽期')]))
  })

  it('芯片 + 高增 → 复苏期/爬升期, score=5', async () => {
    const input = createInput({
      stock: { sector: '半导体芯片' },
      financials: { revenueYoY: 0.5 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(5)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('复苏期/爬升期')]))
  })

  it('芯片 + 低增 → 生产成熟期, score=3', async () => {
    const input = createInput({
      stock: { sector: '芯片设计' },
      financials: { revenueYoY: 0.1 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('生产成熟期')]))
  })

  it('医药 → 复苏期/爬升期, score=4', async () => {
    const input = createInput({ stock: { sector: '创新药' } })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(4)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('复苏期/爬升期')]))
  })

  it('通用行业 + 有营收 + 高增 → 复苏期, score=4', async () => {
    const input = createInput({
      stock: { sector: '消费' },
      financials: { revenue: 100, revenueYoY: 0.5 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(4)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('复苏期/爬升期')]))
  })

  it('通用行业 + 有营收 → 生产成熟期, score=3', async () => {
    const input = createInput({
      stock: { sector: '零售' },
      financials: { revenue: 100 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('生产成熟期')]))
  })

  it('无数据 → 技术萌芽期, score=3', async () => {
    const input = createInput({ stock: { sector: '某行业' } })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('技术萌芽期')]))
  })
})

// ============================================================
// L4ScenarioCalculator.calculate
// ============================================================
describe('L4ScenarioCalculator.calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常计算', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.3 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    expect(result.layerId).toBe('l4')
    expect(result.layerName).toBe('L4 情景推演')
    expect(result.score).toBe(3)
    expect(result.weight).toBe(0.08)
    expect(result.weightedScore).toBeCloseTo(0.24, 2) // 3 * 0.08
    expect(result.dataSources).toContain('行情数据')
    expect(result.dataSources).toContain('财报数据')
    expect(result.risks).toEqual([])
  })

  it('低增长: score=3 未触发低分风险阈值（score=2.5不可达，正增长均score=3）', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0.1 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    // baseUpside=0.03>0 → score=3，3 >= L4_SCENARIO_RISK_THRESHOLD(2.5) → 无风险
    expect(result.score).toBe(3)
    expect(result.risks).toEqual([])
  })

  it('低分风险: score<2.5', async () => {
    const input = createInput({
      stock: { price: 100, pe: 20 },
      financials: { netProfit: 10, revenueYoY: 0 },
    })
    const result = await L4ScenarioCalculator.calculate(input)
    expect(result.score).toBe(2)
    expect(result.risks).toContain('基准情景已无上行空间或下行风险较大')
    expect(result.risks).toContain('目标价低于当前价，建议回避')
  })

  it('异常处理', async () => {
    const { getLogger } = await import('@/lib/logger')
    const logger = getLogger()
    vi.spyOn(logger, 'info').mockImplementationOnce(() => {
      throw new Error('mock l4 error')
    })

    const input = createInput()
    const result = await L4ScenarioCalculator.calculate(input)
    expect(result.score).toBe(0)
    expect(result.summary).toContain('情景推演失败')
    expect(result.summary).toContain('mock l4 error')
    expect(result.evidence).toEqual([])
    expect(result.risks).toEqual([])
  })
})

// ============================================================
// L5TMCalculator.calculate
// ============================================================
describe('L5TMCalculator.calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常计算', async () => {
    const input = createInput({ stock: { sector: 'AI' } })
    const result = await L5TMCalculator.calculate(input)
    expect(result.layerId).toBe('l5')
    expect(result.layerName).toBe('L5 T-M 矩阵')
    expect(result.score).toBe(3.25)
    expect(result.weight).toBe(0.05)
    expect(result.weightedScore).toBeCloseTo(0.1625, 4) // 3.25 * 0.05
    expect(result.dataSources).toContain('行业分析')
  })

  it('低分风险: 当前实现最低分为 2.5，低分风险条件不可触发', async () => {
    // evaluateTMMatrix 中最低为 techScore=50, marketScore=50 → score=2.5
    // 因此 score < 2.5 的分支在当前实现中不可达
    const input = createInput({ stock: { sector: '其他' } })
    const result = await L5TMCalculator.calculate(input)
    expect(result.score).toBe(2.5)
    expect(result.risks).toEqual([])
  })

  it('异常处理', async () => {
    const { getLogger } = await import('@/lib/logger')
    const logger = getLogger()
    vi.spyOn(logger, 'info').mockImplementationOnce(() => {
      throw new Error('mock l5 error')
    })

    const input = createInput()
    const result = await L5TMCalculator.calculate(input)
    expect(result.score).toBe(0)
    expect(result.summary).toContain('T-M计算失败')
    expect(result.summary).toContain('mock l5 error')
    expect(result.evidence).toEqual([])
  })
})

// ============================================================
// L6HypeCalculator.calculate
// ============================================================
describe('L6HypeCalculator.calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常计算', async () => {
    const input = createInput({
      stock: { sector: '半导体' },
      financials: { revenueYoY: 0.5 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.layerId).toBe('l6')
    expect(result.layerName).toBe('L6 Hype 周期')
    expect(result.score).toBe(5)
    expect(result.weight).toBe(0.07)
    expect(result.weightedScore).toBeCloseTo(0.35, 2) // 5 * 0.07
    expect(result.dataSources).toContain('Hype Cycle评估')
  })

  it('泡沫风险: 纯概念阶段触发风险提示', async () => {
    const input = createInput({
      stock: { sector: '机器人' },
      financials: { revenueYoY: 0.5 },
    })
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(3)
    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining('期望膨胀期（纯概念）')]))
    expect(result.risks).toContain('处于Hype泡沫期，需警惕估值回调')
  })

  it('异常处理', async () => {
    const { getLogger } = await import('@/lib/logger')
    const logger = getLogger()
    vi.spyOn(logger, 'info').mockImplementationOnce(() => {
      throw new Error('mock l6 error')
    })

    const input = createInput()
    const result = await L6HypeCalculator.calculate(input)
    expect(result.score).toBe(0)
    expect(result.summary).toContain('Hype计算失败')
    expect(result.summary).toContain('mock l6 error')
    expect(result.evidence).toEqual([])
  })
})
