/**
 * @test_id V9-TEST-INT-TRADING-CABIN-5M
 * @description 交易舱综合测试：输入20只股票池，500万总资金，校对分析
 * @coverage 策略引擎(20进13) + 组合构建(资金分配) + 仓位管理(Kelly) + 风控约束
 * @stocks 20只覆盖 A+H股：科技/半导体/AI、医药、锂电、生物制药、白酒消费
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runStrategy } from '@/services/trading/strategyEngine'
import { buildStrategyFilteredPortfolio } from '@/services/trading/portfolioBuilder'
import { calculatePosition } from '@/services/trading/positionSizer'
import * as scoringAdapter from '@/services/trading/scoringAdapter'
import * as hotSectorService from '@/services/input/hotSectorService'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import { getEffectiveTradingConfig, setTradingConfigOverride, resetTradingConfigOverride } from '@/config/tradingConfig'
import type { Stock } from '@/data/types'
import type { CompositeScoreView } from '@/services/trading/scoringAdapter'

// ============================================================
// 一、20只股票池设计（覆盖A+H股，多行业）
// ============================================================
/**
 * 行业分布：
 * - 科技/半导体/AI（8只）：中芯国际A+H、北方华创、工业富联、科大讯飞、海康威视、中兴通讯、腾讯控股H
 * - 医药（3只）：恒瑞医药、药明康德、迈瑞医疗
 * - 锂电（3只）：宁德时代、比亚迪、亿纬锂能
 * - 生物制药（3只）：百济神州A+H、荣昌生物
 * - 白酒消费（3只）：贵州茅台、五粮液、泸州老窖
 */
const CABIN_20_STOCKS: Stock[] = [
  // ===== 科技/半导体/AI（8只，含A+H）=====
  { symbol: '688981.SH', name: '中芯国际', price: 52, sector: '半导体', industryCode: '801120.SW', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '00981.HK', name: '中芯国际H', price: 38, sector: '半导体', industryCode: '801120.SW', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '002371.SZ', name: '北方华创', price: 298, sector: '半导体设备', industryCode: '801120.SW', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '601138.SH', name: '工业富联', price: 24, sector: 'AI服务器', industryCode: '801750.SW', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '002230.SZ', name: '科大讯飞', price: 48, sector: '人工智能', industryCode: '801750.SW', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '002415.SZ', name: '海康威视', price: 32, sector: '机器视觉', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '000063.SZ', name: '中兴通讯', price: 30, sector: '通信设备', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '00700.HK', name: '腾讯控股', price: 380, sector: '互联网', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },

  // ===== 医药（3只）=====
  { symbol: '600276.SH', name: '恒瑞医药', price: 45, sector: '医药', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '603259.SH', name: '药明康德', price: 58, sector: '医药CRO', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '300760.SZ', name: '迈瑞医疗', price: 285, sector: '医疗器械', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },

  // ===== 锂电（3只）=====
  { symbol: '300750.SZ', name: '宁德时代', price: 195, sector: '锂电', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '002594.SZ', name: '比亚迪', price: 248, sector: '新能源汽车', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '300014.SZ', name: '亿纬锂能', price: 42, sector: '锂电池', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },

  // ===== 生物制药（3只，含A+H）=====
  { symbol: '688235.SH', name: '百济神州', price: 125, sector: '生物制药', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '06160.HK', name: '百济神州H', price: 98, sector: '生物制药', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '688331.SH', name: '荣昌生物', price: 38, sector: '生物制药', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },

  // ===== 白酒消费（3只）=====
  { symbol: '600519.SH', name: '贵州茅台', price: 1680, sector: '白酒', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '000858.SZ', name: '五粮液', price: 145, sector: '白酒', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
  { symbol: '000568.SZ', name: '泸州老窖', price: 168, sector: '白酒', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
]

// 总资金规模：500万
const TOTAL_PORTFOLIO_VALUE = 5_000_000

// ============================================================
// 二、评分设计（模拟真实评分分布，含综合分/估值分/行业分/动量）
// ============================================================
interface StockSizing {
  composite: number
  valuationScore: number
  industryScore: number
  momentum: number
  winRate?: number
  profitLossRatio?: number
}

const SCORE_DESIGN: Record<string, StockSizing> = {
  // 科技/半导体/AI（评分偏高，核心稀缺候选）
  '688981.SH': { composite: 4.45, valuationScore: 3.8, industryScore: 4.6, momentum: 0.065, winRate: 0.58, profitLossRatio: 1.6 },
  '00981.HK':  { composite: 4.35, valuationScore: 4.0, industryScore: 4.5, momentum: 0.055, winRate: 0.56, profitLossRatio: 1.5 },
  '002371.SZ': { composite: 4.55, valuationScore: 3.6, industryScore: 4.7, momentum: 0.072, winRate: 0.60, profitLossRatio: 1.7 },
  '601138.SH': { composite: 4.30, valuationScore: 4.2, industryScore: 4.4, momentum: 0.048, winRate: 0.55, profitLossRatio: 1.5 },
  '002230.SZ': { composite: 4.15, valuationScore: 3.2, industryScore: 4.5, momentum: 0.080, winRate: 0.54, profitLossRatio: 1.4 },
  '002415.SZ': { composite: 4.10, valuationScore: 4.0, industryScore: 4.2, momentum: 0.035, winRate: 0.54, profitLossRatio: 1.5 },
  '000063.SZ': { composite: 3.95, valuationScore: 3.9, industryScore: 4.0, momentum: 0.042, winRate: 0.53, profitLossRatio: 1.4 },
  '00700.HK':  { composite: 4.40, valuationScore: 4.1, industryScore: 4.5, momentum: 0.052, winRate: 0.57, profitLossRatio: 1.6 },

  // 医药（评分中等）
  '600276.SH': { composite: 3.85, valuationScore: 4.1, industryScore: 3.7, momentum: 0.018, winRate: 0.52, profitLossRatio: 1.4 },
  '603259.SH': { composite: 3.90, valuationScore: 4.3, industryScore: 3.8, momentum: 0.025, winRate: 0.53, profitLossRatio: 1.4 },
  '300760.SZ': { composite: 4.05, valuationScore: 3.9, industryScore: 4.2, momentum: 0.030, winRate: 0.54, profitLossRatio: 1.5 },

  // 锂电（动量偏弱）
  '300750.SZ': { composite: 3.95, valuationScore: 3.8, industryScore: 4.1, momentum: -0.015, winRate: 0.53, profitLossRatio: 1.4 },
  '002594.SZ': { composite: 4.00, valuationScore: 3.7, industryScore: 4.2, momentum: -0.008, winRate: 0.53, profitLossRatio: 1.4 },
  '300014.SZ': { composite: 3.70, valuationScore: 4.0, industryScore: 3.6, momentum: -0.025, winRate: 0.51, profitLossRatio: 1.3 },

  // 生物制药（估值分高，价值洼地候选）
  '688235.SH': { composite: 3.75, valuationScore: 4.4, industryScore: 3.6, momentum: 0.012, winRate: 0.52, profitLossRatio: 1.4 },
  '06160.HK':  { composite: 3.70, valuationScore: 4.5, industryScore: 3.5, momentum: 0.008, winRate: 0.51, profitLossRatio: 1.3 },
  '688331.SH': { composite: 3.65, valuationScore: 4.2, industryScore: 3.5, momentum: 0.020, winRate: 0.51, profitLossRatio: 1.3 },

  // 白酒消费（高估值分，价值洼地候选）
  '600519.SH': { composite: 4.50, valuationScore: 4.8, industryScore: 4.3, momentum: 0.032, winRate: 0.59, profitLossRatio: 1.7 },
  '000858.SZ': { composite: 4.15, valuationScore: 4.5, industryScore: 4.0, momentum: 0.028, winRate: 0.55, profitLossRatio: 1.5 },
  '000568.SZ': { composite: 4.00, valuationScore: 4.4, industryScore: 3.9, momentum: 0.022, winRate: 0.54, profitLossRatio: 1.4 },
}

function makeScoreView(symbol: string): CompositeScoreView {
  const s = SCORE_DESIGN[symbol]
  return {
    symbol,
    v6Score: s.composite,
    intelligentScore: s.composite * 0.98,
    industryScore: s.industryScore,
    valuationScore: s.valuationScore,
    composite: s.composite,
    rationale: `V6:${s.composite} / 估值:${s.valuationScore} / 行业:${s.industryScore}`,
    scoredAt: Date.now(),
  }
}

// ============================================================
// 三、测试主体
// ============================================================
describe('交易舱综合测试：20只股票×500万资金', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // 重置运行时覆盖
    resetTradingConfigOverride()

    // Mock 热门板块（TOP5：半导体、人工智能、锂电、医药、白酒）
    vi.spyOn(hotSectorService, 'getHotSectors').mockResolvedValue([
      { code: '801120.SW', name: '半导体', score: 92, trend: 'up', factors: { momentum: 90, fundFlow: 88, valuation: 70, sentiment: 85 }, stocks: [] },
      { code: '801750.SW', name: '人工智能', score: 90, trend: 'up', factors: { momentum: 92, fundFlow: 86, valuation: 65, sentiment: 88 }, stocks: [] },
      { code: '801080.SW', name: '锂电', score: 72, trend: 'flat', factors: { momentum: 45, fundFlow: 60, valuation: 80, sentiment: 65 }, stocks: [] },
      { code: '801150.SW', name: '医药', score: 74, trend: 'up', factors: { momentum: 60, fundFlow: 68, valuation: 78, sentiment: 72 }, stocks: [] },
      { code: '801180.SW', name: '白酒', score: 78, trend: 'up', factors: { momentum: 62, fundFlow: 72, valuation: 82, sentiment: 80 }, stocks: [] },
    ])

    // Mock 评分适配器
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockImplementation(async (stocks) => {
      return stocks.map((s) => makeScoreView(s.symbol))
    })
  })

  // ----------------------------------------------------------
  // 测试1：输入股票池完整性校对
  // ----------------------------------------------------------
  it('T1-输入校验：20只股票覆盖要求的行业与市场', () => {
    const stocks = CABIN_20_STOCKS
    expect(stocks).toHaveLength(20)

    // 按行业归类
    const sectors: Record<string, string[]> = { '科技/半导体/AI': [], '医药': [], '锂电': [], '生物制药': [], '白酒消费': [] }
    stocks.forEach((s) => {
      if (['半导体', 'AI服务器', '人工智能', '机器视觉', '通信设备', '互联网'].some((k) => s.sector?.includes(k))) {
        sectors['科技/半导体/AI'].push(s.symbol)
      } else if (s.sector?.includes('医药') || s.sector?.includes('医疗')) {
        sectors['医药'].push(s.symbol)
      } else if (s.sector?.includes('锂电') || s.sector?.includes('新能源')) {
        sectors['锂电'].push(s.symbol)
      } else if (s.sector?.includes('生物制药')) {
        sectors['生物制药'].push(s.symbol)
      } else if (s.sector?.includes('白酒')) {
        sectors['白酒消费'].push(s.symbol)
      }
    })

    expect(sectors['科技/半导体/AI']).toHaveLength(8)
    expect(sectors['医药']).toHaveLength(3)
    expect(sectors['锂电']).toHaveLength(3)
    expect(sectors['生物制药']).toHaveLength(3)
    expect(sectors['白酒消费']).toHaveLength(3)

    // 市场分类校验（A股 vs H股）
    const aShares = stocks.filter((s) => s.symbol.match(/\.(SH|SZ|BJ)$/))
    const hShares = stocks.filter((s) => s.symbol.match(/\.HK$/))
    expect(aShares.length).toBeGreaterThanOrEqual(15) // A股 ≥15只
    expect(hShares.length).toBeGreaterThanOrEqual(3)  // H股 ≥3只

    console.log('\n========== [T1] 股票池行业分布 ==========')
    Object.entries(sectors).forEach(([k, v]) => {
      console.log(`  ${k}: ${v.length}只 → ${v.join(', ')}`)
    })
    console.log(`  A股: ${aShares.length}只, H股: ${hShares.length}只`)
  })

  // ----------------------------------------------------------
  // 测试2：策略引擎20进13筛选与分类
  // ----------------------------------------------------------
  it('T2-策略筛选：20进13分类校对，验证三梯队逻辑', async () => {
    const momentumMap: Record<string, number> = {}
    Object.entries(SCORE_DESIGN).forEach(([sym, s]) => { momentumMap[sym] = s.momentum })

    const result = await runStrategy(CABIN_20_STOCKS, {
      theme: CORE_RESOURCE_THEME,
      momentumMap,
    })

    console.log('\n========== [T2] 策略分类结果 ==========')
    console.log(`  总计输入: ${result.summary.total}只`)
    console.log(`  核心稀缺(core-scarce): ${result.summary.coreScarceCount}只 → ${result.coreScarce.map((c) => `${c.symbol}(${c.composite.toFixed(2)})`).join(', ')}`)
    console.log(`  价值洼地(value-bargain): ${result.summary.valueBargainCount}只 → ${result.valueBargain.map((c) => `${c.symbol}(${c.composite.toFixed(2)}/估${c.valuationScore?.toFixed(2)})`).join(', ')}`)
    console.log(`  热门追涨(hot-momentum): ${result.summary.hotMomentumCount}只 → ${result.hotMomentum.map((c) => `${c.symbol}(${c.composite.toFixed(2)})`).join(', ')}`)
    console.log(`  最终入选(Top13): ${result.summary.selectedCount}只`)
    console.log(`  淘汰(Excluded): ${result.rejected.length}只`)

    // 校对：20只输入
    expect(result.summary.total).toBe(20)
    // 校对：入选 ≤ 13
    expect(result.selected.length).toBeLessThanOrEqual(13)
    // 校对：入选股票综合分全部 ≥3.6（最低门槛）
    result.selected.forEach((c) => {
      expect(c.composite).toBeGreaterThanOrEqual(3.6)
    })
    // 校对：按综合分降序
    for (let i = 1; i < result.selected.length; i++) {
      expect(result.selected[i - 1]!.composite).toBeGreaterThanOrEqual(result.selected[i]!.composite)
    }
  })

  // ----------------------------------------------------------
  // 测试3：500万资金组合构建 + 资金分配校对
  // ----------------------------------------------------------
  it('T3-组合构建：500万资金分配，验证单仓位上限/权重约束', async () => {
    const momentumMap: Record<string, number> = {}
    Object.entries(SCORE_DESIGN).forEach(([sym, s]) => { momentumMap[sym] = s.momentum })

    // 先运行策略引擎获取分类，再构建组合
    const { portfolio, strategyResult } = await buildStrategyFilteredPortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks: CABIN_20_STOCKS,
      totalPortfolioValue: TOTAL_PORTFOLIO_VALUE,
      momentumMap,
    })

    console.log('\n========== [T3] 500万组合构建结果 ==========')
    console.log(`  总资产: ¥${portfolio.totalValue.toLocaleString()}`)
    console.log(`  主题仓位占比: ${CORE_RESOURCE_THEME.totalAllocationPct}% → ¥${(portfolio.totalValue * CORE_RESOURCE_THEME.totalAllocationPct / 100).toLocaleString()}`)
    console.log(`  现金储备: ${CORE_RESOURCE_THEME.cashReservePct}% → ¥${portfolio.cashReserve.toLocaleString()}`)
    console.log(`  入选标的: ${portfolio.holdings.length}只`)
    console.log(`  --- 持仓明细 ---`)

    let totalInvested = 0
    const theme = CORE_RESOURCE_THEME
    const effectiveMax =
      (theme.singleMaxPct / 100) /
      ((theme.totalAllocationPct / 100) * (1 - theme.cashReservePct / 100))

    portfolio.holdings.forEach((h, idx) => {
      const weightOfTotal = (h.marketValue / portfolio.totalValue) * 100
      totalInvested += h.marketValue
      console.log(`  #${idx + 1} ${h.symbol} ${h.name.padEnd(8)}: ¥${h.marketValue.toLocaleString().padStart(10)} | ${h.targetShares}股@¥${h.price} | 组合占比${weightOfTotal.toFixed(2)}% | 主题内权重${(h.targetWeight * 100).toFixed(2)}% | 评分${h.score.toFixed(2)}`)

      // 校对：单只标的占总资产 ≤ singleMaxPct(8%)
      expect(weightOfTotal).toBeLessThanOrEqual(theme.singleMaxPct + 0.01)
      // 校对：单只标的占总资产 ≥ singleMinPct(4%)（如果有持仓）
      // 说明：等权×effectiveMin可能总和超100%，经整手取整后会有-1%以内的浮动误差
      if (h.targetShares > 0) {
        expect(weightOfTotal).toBeGreaterThanOrEqual(theme.singleMinPct - 1.0)
      }
      // 校对：主题内权重 ≤ effectiveMax
      expect(h.targetWeight).toBeLessThanOrEqual(effectiveMax + 1e-6)
      // 校对：整手（100股倍数）
      expect(h.targetShares % 100).toBe(0)
    })

    const totalWeight = portfolio.holdings.reduce((s, h) => s + h.targetWeight, 0)
    console.log(`  ---`)
    console.log(`  主题内权重合计: ${(totalWeight * 100).toFixed(2)}%（应≈100%）`)
    console.log(`  投资金额合计: ¥${totalInvested.toLocaleString()} + 现金储备 ¥${portfolio.cashReserve.toLocaleString()}`)

    // 校对：主题内权重合计 ≈ 100%
    expect(totalWeight).toBeCloseTo(1, 1)
    // 校对：总资产 = 主题总仓位 × totalAllocationPct
    expect(portfolio.totalValue).toBe(TOTAL_PORTFOLIO_VALUE)
  }, 60000) // 增加超时时间到60秒

  // ----------------------------------------------------------
  // 测试4：Kelly仓位管理校对（单只买入）
  // ----------------------------------------------------------
  it('T4-仓位管理：Kelly公式计算单只买入仓位，验证风控约束', () => {
    const config = getEffectiveTradingConfig()
    console.log('\n========== [T4] Kelly仓位管理（默认组合100万→测试用500万） ==========')
    console.log(`  Kelly参数: fraction=${config.kelly.fraction} 胜率=${config.kelly.defaultWinRate} 盈亏比=${config.kelly.defaultProfitLossRatio}`)
    console.log(`  风控: 单仓上限${config.risk.maxSinglePositionPct}% 总仓上限${config.risk.maxTotalPositionPct}%`)
    console.log(`  仓位范围: ${config.kelly.minPositionPct}%~${config.kelly.maxPositionPct}%`)

    // 测试北方华创（高评分）
    const sizing1 = calculatePosition({
      direction: 'buy',
      price: 298,
      portfolioValue: TOTAL_PORTFOLIO_VALUE,
      winRate: 0.60,
      profitLossRatio: 1.7,
    })
    console.log(`\n  北方华创(¥298, 胜率60%, 盈亏比1.7):`)
    console.log(`    Kelly%=${(sizing1.kellyPct * 100).toFixed(2)}% → 仓位占比${(sizing1.positionPct * 100).toFixed(2)}% | ${sizing1.targetShares}股 | ¥${sizing1.targetValue.toLocaleString()} | 约束:${sizing1.cappedBy}`)
    expect(sizing1.action).toBe('buy')
    expect(sizing1.targetShares % 100).toBe(0)
    expect(sizing1.positionPct * 100).toBeLessThanOrEqual(config.risk.maxSinglePositionPct + 0.1)

    // 测试贵州茅台（高价股）
    const sizing2 = calculatePosition({
      direction: 'buy',
      price: 1680,
      portfolioValue: TOTAL_PORTFOLIO_VALUE,
      winRate: 0.59,
      profitLossRatio: 1.7,
    })
    console.log(`\n  贵州茅台(¥1680, 胜率59%, 盈亏比1.7):`)
    console.log(`    Kelly%=${(sizing2.kellyPct * 100).toFixed(2)}% → 仓位占比${(sizing2.positionPct * 100).toFixed(2)}% | ${sizing2.targetShares}股 | ¥${sizing2.targetValue.toLocaleString()} | 约束:${sizing2.cappedBy}`)
    expect(sizing2.action).toBe('buy')
    // 茅台单价高，检查是否被最小仓位约束过滤或正常买入
    if (sizing2.targetShares > 0) {
      expect(sizing2.targetShares % 100).toBe(0)
    }

    // 测试触发单仓上限场景（已有持仓，空间不足最小仓位）
    // 由于单仓剩余空间5万 < 最小仓位阈值3%(15万)，cappedBy为'single'（被单仓上限约束导致无法建仓）
    const sizing3 = calculatePosition({
      direction: 'buy',
      price: 298,
      portfolioValue: TOTAL_PORTFOLIO_VALUE,
      currentHoldingValue: 1_200_000, // 已有24%仓位
    })
    console.log(`\n  北方华创(已持¥120万 → 24%, 剩余空间5万<最小15万):`)
    console.log(`    动作:${sizing3.action} | ${sizing3.targetShares}股 | ¥${sizing3.targetValue.toLocaleString()} | 约束:${sizing3.cappedBy}`)
    // 单仓上限25%即125万，已有120万，剩余空间5万，不足最小仓位阈值
    expect(sizing3.targetValue).toBeLessThanOrEqual(50_000 + 1)
    expect(sizing3.cappedBy).toBe('single') // 被单仓上限约束导致无法达到最小仓位

    // 测试触发总仓上限场景
    const sizing4 = calculatePosition({
      direction: 'buy',
      price: 100,
      portfolioValue: TOTAL_PORTFOLIO_VALUE,
      currentTotalPositionValue: 3_950_000, // 总仓已79%（上限80%=400万）
    })
    console.log(`\n  任意股票(总仓已持¥395万 → 79%, 剩余5万<最小15万):`)
    console.log(`    动作:${sizing4.action} | ${sizing4.targetShares}股 | ¥${sizing4.targetValue.toLocaleString()} | 约束:${sizing4.cappedBy}`)
    expect(sizing4.targetValue).toBeLessThanOrEqual(50_000 + 1)
    expect(sizing4.cappedBy).toBe('total') // 被总仓上限约束导致无法达到最小仓位
  })

  // ----------------------------------------------------------
  // 测试5：运行时配置覆盖（总资金500万生效）
  // ----------------------------------------------------------
  it('T5-配置覆盖：设置portfolioValue=500万后，验证Kelly/风控同步生效', () => {
    // 先设置覆盖
    setTradingConfigOverride({
      risk: { portfolioValue: TOTAL_PORTFOLIO_VALUE },
    })

    const cfg = getEffectiveTradingConfig()
    expect(cfg.risk.portfolioValue).toBe(TOTAL_PORTFOLIO_VALUE)
    console.log(`\n========== [T5] 运行时配置覆盖生效 ==========`)
    console.log(`  配置版本: ${cfg.version}`)
    console.log(`  组合规模: ¥${cfg.risk.portfolioValue.toLocaleString()} (默认100万 → 覆盖为500万 ✓)`)
    console.log(`  Kelly fraction: ${cfg.kelly.fraction}`)
    console.log(`  止盈止损: 止损${cfg.signalThresholds.fixedStopLossPct}% 回撤${cfg.signalThresholds.trailingStopDrawdownPct}%`)
    console.log(`  风控: 单仓上限${cfg.risk.maxSinglePositionPct}%(¥${(cfg.risk.maxSinglePositionPct / 100 * TOTAL_PORTFOLIO_VALUE).toLocaleString()}) 总仓上限${cfg.risk.maxTotalPositionPct}%(¥${(cfg.risk.maxTotalPositionPct / 100 * TOTAL_PORTFOLIO_VALUE).toLocaleString()})`)
    console.log(`  交易频率: 每日最多${cfg.risk.maxTradesPerDay}笔 同标的冷却${cfg.risk.sameSymbolCooldownHours}小时`)

    // 验证Kelly在500万规模下的计算
    const result = calculatePosition({
      direction: 'buy',
      price: 52, // 中芯国际
      portfolioValue: cfg.risk.portfolioValue,
    })
    const kellyValue5m = result.targetValue
    console.log(`\n  中芯国际(¥52) 在500万规模下Kelly建议: ${result.targetShares}股 @ ¥${kellyValue5m.toLocaleString()}`)

    // 对比100万规模下的值
    const result1m = calculatePosition({
      direction: 'buy',
      price: 52,
      portfolioValue: 1_000_000,
    })
    console.log(`  中芯国际(¥52) 在100万规模下Kelly建议: ${result1m.targetShares}股 @ ¥${result1m.targetValue.toLocaleString()}`)
    // 500万规模仓位价值应约为100万的5倍（同比例）
    expect(Math.round(kellyValue5m / result1m.targetValue)).toBeCloseTo(5, 0)
  })

  // ----------------------------------------------------------
  // 测试6：全链路校对（策略→组合→Kelly，汇总报告）
  // ----------------------------------------------------------
  it('T6-全链路校对：汇总报告与一致性校验', async () => {
    const momentumMap: Record<string, number> = {}
    Object.entries(SCORE_DESIGN).forEach(([sym, s]) => { momentumMap[sym] = s.momentum })

    // 设置总资金500万
    setTradingConfigOverride({ risk: { portfolioValue: TOTAL_PORTFOLIO_VALUE } })

    // 1. 策略筛选
    const strategyResult = await runStrategy(CABIN_20_STOCKS, {
      theme: CORE_RESOURCE_THEME,
      momentumMap,
    })

    // 2. 构建组合
    const { portfolio } = await buildStrategyFilteredPortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks: CABIN_20_STOCKS,
      totalPortfolioValue: TOTAL_PORTFOLIO_VALUE,
      momentumMap,
    })

    console.log('\n' + '='.repeat(72))
    console.log('  交易舱测试汇总报告 | 输入:20只 × 资金:¥5,000,000')
    console.log('='.repeat(72))

    // 行业分布
    const holdSectors = { '科技': 0, '医药': 0, '锂电': 0, '生物制药': 0, '白酒': 0 }
    portfolio.holdings.forEach((h) => {
      const stock = CABIN_20_STOCKS.find((s) => s.symbol === h.symbol)
      const sector = stock?.sector ?? ''
      if (['半导体', 'AI', '通信', '互联网', '视觉'].some((k) => sector.includes(k))) holdSectors['科技'] += h.marketValue
      else if (sector.includes('医药') || sector.includes('医疗')) holdSectors['医药'] += h.marketValue
      else if (sector.includes('锂电') || sector.includes('新能源')) holdSectors['锂电'] += h.marketValue
      else if (sector.includes('生物制药')) holdSectors['生物制药'] += h.marketValue
      else if (sector.includes('白酒')) holdSectors['白酒'] += h.marketValue
    })

    console.log('\n【一、策略筛选（20进13）】')
    console.log(`  输入20只 → 入选${strategyResult.selected.length}只（淘汰${strategyResult.rejected.length}只）`)
    console.log(`  梯队构成: 核心稀缺${strategyResult.coreScarce.length} + 价值洼地${strategyResult.valueBargain.length} + 热门追涨${strategyResult.hotMomentum.length}`)
    console.log(`  淘汰原因抽样: ${strategyResult.rejected.slice(0, 3).map((r) => `${r.symbol}[${r.reasons[0]}]`).join(' | ')}`)

    console.log('\n【二、资金分配（¥5,000,000）】')
    const theme = CORE_RESOURCE_THEME
    const totalThemeValue = portfolio.totalValue * theme.totalAllocationPct / 100
    console.log(`  总资产¥500万 分为：主题仓位${theme.totalAllocationPct}%(¥${totalThemeValue.toLocaleString()}) + 其他主题60%(¥${(5000000 - totalThemeValue).toLocaleString()})`)
    console.log(`  主题内：现金储备${theme.cashReservePct}%(¥${portfolio.cashReserve.toLocaleString()}) + 投资¥${(totalThemeValue - portfolio.cashReserve).toLocaleString()}`)

    console.log('\n【三、入选持仓明细】')
    const rows = portfolio.holdings.map((h, i) => {
      const stock = CABIN_20_STOCKS.find((s) => s.symbol === h.symbol)
      const mvOfTotal = (h.marketValue / TOTAL_PORTFOLIO_VALUE) * 100
      return {
        No: i + 1,
        Symbol: h.symbol,
        Name: h.name,
        Sector: stock?.sector ?? '-',
        Price: `¥${h.price}`,
        Shares: `${h.targetShares}`,
        MarketValue: `¥${h.marketValue.toLocaleString()}`,
        Pct: mvOfTotal.toFixed(2) + '%',
        Score: h.score.toFixed(2),
      }
    })
    console.table(rows)

    console.log('\n【四、行业资金分布】')
    Object.entries(holdSectors).forEach(([k, v]) => {
      const pct = (v / TOTAL_PORTFOLIO_VALUE) * 100
      console.log(`  ${k.padEnd(6)}: ¥${v.toLocaleString().padStart(10)} (${pct.toFixed(2)}%)`)
    })

    console.log('\n【五、风控合规校对】')
    const cfg = getEffectiveTradingConfig()
    let allPass = true

    // 单仓上限校验
    portfolio.holdings.forEach((h) => {
      const pct = (h.marketValue / TOTAL_PORTFOLIO_VALUE) * 100
      if (pct > cfg.risk.maxSinglePositionPct + 0.01) {
        console.log(`  ✗ 单仓超限: ${h.symbol} ${pct.toFixed(2)}% > ${cfg.risk.maxSinglePositionPct}%`)
        allPass = false
      }
    })
    // 总持仓价值
    const totalMV = portfolio.holdings.reduce((s, h) => s + h.marketValue, 0)
    const totalPct = (totalMV / TOTAL_PORTFOLIO_VALUE) * 100
    if (totalPct > cfg.risk.maxTotalPositionPct + 0.1) {
      console.log(`  ✗ 总仓超限: ${totalPct.toFixed(2)}% > ${cfg.risk.maxTotalPositionPct}%`)
      allPass = false
    } else {
      console.log(`  ✓ 总仓位: ${totalPct.toFixed(2)}%（上限${cfg.risk.maxTotalPositionPct}%）`)
    }
    // 整手校验
    const lotFail = portfolio.holdings.filter((h) => h.targetShares % cfg.kelly.roundLot !== 0)
    if (lotFail.length > 0) {
      console.log(`  ✗ 非整手: ${lotFail.map((h) => h.symbol).join(',')}`)
      allPass = false
    } else {
      console.log(`  ✓ 整手合规: 所有${portfolio.holdings.length}只均为${cfg.kelly.roundLot}股倍数`)
    }
    // 入选数量
    if (strategyResult.selected.length > 13) {
      console.log(`  ✗ 20进13超限: 入选${strategyResult.selected.length}只 > 13只`)
      allPass = false
    } else {
      console.log(`  ✓ 20进13合规: 入选${strategyResult.selected.length}只 ≤ 13只`)
    }
    // 综合分门槛
    const lowScore = strategyResult.selected.filter((c) => c.composite < 3.6)
    if (lowScore.length > 0) {
      console.log(`  ✗ 综合分不足: ${lowScore.map((c) => c.symbol).join(',')}`)
      allPass = false
    } else {
      console.log(`  ✓ 综合分合规: 入选均≥3.6分`)
    }

    if (allPass) {
      console.log('\n  ✅ 全部风控校验通过！')
    } else {
      console.log('\n  ❌ 存在校验失败项！')
    }

    // 断言：所有关键合规检查
    expect(allPass).toBe(true)
    expect(strategyResult.summary.total).toBe(20)
    expect(portfolio.totalValue).toBe(TOTAL_PORTFOLIO_VALUE)
  }, 60000) // 增加超时时间到60秒
})
