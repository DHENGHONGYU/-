/**
 * L4 情景推演 + L5 T-M矩阵 + L6 Hype周期 计算器
 *
 * 按 SKILL v4.3：
 * - L4：三情景（乐观/基准/悲观）+ 概率加权目标价推导
 * - L5：技术成熟度 × 市场成熟度 双轴矩阵
 * - L6：Gartner Hype Cycle 五阶段定位
 *
 * 权重：L4=8%, L5=5%, L6=7%
 * 类型：半确定性（L4价格计算为确定性，概率/阶段需LLM增强）
 */

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from '../types'
import type { LayerId } from '../types'
import { LAYER_LABELS } from '../types'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { safeArrayGet } from '@/lib/precision'

const logger = getLogger()

// ============================================================
// L4 情景推演 — 权重 8%
// ============================================================

interface Scenario {
  name: string
  /** 概率 */
  probability: number
  /** 预测净利润（亿元） */
  netProfit: number
  /** 预测 PE 倍数 */
  pe: number
  /** 股价中枢 */
  priceTarget: number
}

/**
 * 当财报净利润缺失或无效时，基于可用数据做保守估计。
 * 优先级：市值/PE 反推 > 营收 * 近似净利率。
 */
function estimateNetProfit(
  stock: LayerInput['stock'],
  financials: LayerInput['financials'],
): number | undefined {
  // 市值/PE 反推（PE 有效时最可靠）
  if (stock.pe !== undefined && stock.pe > 0 && stock.marketCap !== undefined && stock.marketCap > 0) {
    const estimated = stock.marketCap / stock.pe
    if (Number.isFinite(estimated) && estimated > 0) {
      return estimated
    }
  }
  // 营收 * 行业近似净利率 5%
  if (financials.revenue !== undefined && financials.revenue > 0) {
    return financials.revenue * 0.05
  }
  return undefined
}

function buildScenarios(
  currentPrice: number,
  netProfit: number,
  pe: number | undefined,
  revenueYoY: number | undefined,
): Scenario[] {
  const np = netProfit
  const safeNp = np
  const basePE = pe ?? V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_BASE_PE
  const growth = revenueYoY ?? V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_BASE_GROWTH

  // 上行：业绩超预期，PE 扩张
  const upNP = safeNp * (1 + Math.max(0.2, growth * 0.5))
  const upPE = basePE * V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_UP_MULTIPLIER
  const upPrice = (upNP / safeNp) * currentPrice * (upPE / basePE)

  // 基准：符合预期
  const baseNP = safeNp * (1 + Math.min(0.15, growth * 0.3))
  const basePE_ = basePE
  const basePrice = (baseNP / safeNp) * currentPrice

  // 下行：业绩不及预期，PE 收缩
  const downNP = safeNp * (1 - Math.max(0.05, Math.min(0.2, growth * 0.3)))
  const downPE = basePE * V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_DOWN_MULTIPLIER
  const downPrice = (downNP / safeNp) * currentPrice * (downPE / basePE)

  return [
    { name: '乐观', probability: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_BULL_PROB, netProfit: upNP, pe: upPE, priceTarget: upPrice },
    { name: '基准', probability: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_BASE_PROB, netProfit: baseNP, pe: basePE_, priceTarget: basePrice },
    { name: '悲观', probability: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_BEAR_PROB, netProfit: downNP, pe: downPE, priceTarget: downPrice },
  ]
}

function scoreScenario(input: LayerInput): { score: number; summary: string; evidence: string[]; scenarios: Scenario[]; participated: boolean } {
  const { stock, financials } = input
  const currentPrice = stock.price ?? 1
  const evidence: string[] = []

  // P0 修复：净利润缺失时使用保守估计，仍无法估计则标记该层未参与
  const rawNetProfit = financials.netProfit
  const hasValidNetProfit = rawNetProfit !== undefined && Number.isFinite(rawNetProfit) && rawNetProfit > 0
  const netProfit = hasValidNetProfit ? rawNetProfit : estimateNetProfit(stock, financials)
  const participated = netProfit !== undefined && netProfit > 0

  if (!participated) {
    logger.warn(`[L4] ${stock.symbol}: 净利润数据缺失且无法估计，情景推演未参与`)
    return {
      score: Number.NaN,
      summary: '净利润数据缺失，情景推演未参与',
      evidence: ['净利润(undefined/≤0)且市值/PE/营收均不足，无法构建情景'],
      scenarios: [],
      participated: false,
    }
  }

  if (!hasValidNetProfit) {
    logger.info(`[L4] ${stock.symbol}: 净利润缺失，使用保守估计 ${netProfit.toFixed(2)} 亿`)
    evidence.push(`净利润缺失，使用保守估计 ${netProfit.toFixed(2)} 亿`)
  }

  const scenarios = buildScenarios(currentPrice, netProfit, stock.pe, financials.revenueYoY)

  // 概率加权合理价
  const weightedPrice = scenarios.reduce((sum, s) => sum + s.priceTarget * s.probability, 0)

  const upScenario = safeArrayGet(scenarios, 0)!
  const downScenario = safeArrayGet(scenarios, 2)!
  const baseScenario = safeArrayGet(scenarios, 1)!

  // 基准上行空间
  const baseUpside = baseScenario.priceTarget > currentPrice
    ? (baseScenario.priceTarget - currentPrice) / currentPrice
    : 0

  // 收益比
  const upGain = (upScenario.priceTarget - currentPrice) * upScenario.probability
  const downLoss = (currentPrice - downScenario.priceTarget) * downScenario.probability
  /** 亏损为零时的最大收益比哨兵值 */
  const MAX_REWARD_RATIO = 999
  /** 盈亏均为零时的默认收益比 */
  const DEFAULT_REWARD_RATIO = 1
  const rewardRatio = downLoss > 0 ? upGain / downLoss : upGain > 0 ? MAX_REWARD_RATIO : DEFAULT_REWARD_RATIO

  const upsideTiers = [
    {
      threshold: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_UPSIDE_TIER1,
      minRatio: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_REWARD_RATIO_HIGH,
      highScore: 5,
      lowScore: 4.5,
    },
    {
      threshold: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_UPSIDE_TIER2,
      minRatio: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_REWARD_RATIO_HIGH,
      highScore: 4,
      lowScore: 3.5,
    },
    {
      threshold: V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_UPSIDE_TIER3,
      minRatio: Number.NEGATIVE_INFINITY,
      highScore: 3,
      lowScore: 3,
    },
  ]

  let score: number
  const matchedTier = upsideTiers.find((tier) => baseUpside > tier.threshold)
  if (matchedTier) {
    score = rewardRatio > matchedTier.minRatio ? matchedTier.highScore : matchedTier.lowScore
  } else if (baseUpside > 0) {
    score = 2.5
  } else {
    score = 2
  }

  evidence.push(
    `当前价: ${currentPrice.toFixed(2)}`,
    `乐观: ${upScenario.priceTarget.toFixed(2)} (${(upScenario.probability * 100).toFixed(0)}%)`,
    `基准: ${baseScenario.priceTarget.toFixed(2)} (${(baseScenario.probability * 100).toFixed(0)}%)`,
    `悲观: ${downScenario.priceTarget.toFixed(2)} (${(downScenario.probability * 100).toFixed(0)}%)`,
    `概率加权价: ${weightedPrice.toFixed(2)}`,
    `上行空间: ${(baseUpside * 100).toFixed(1)}%, 收益比: ${rewardRatio.toFixed(1)}`,
  )

  const summary = `基准上行 ${(baseUpside * 100).toFixed(0)}% | 收益比 ${rewardRatio.toFixed(1)}x | ${score >= 4 ? '情景积极' : score >= 3 ? '情景中性' : '情景偏弱'}`

  return { score, summary, evidence, scenarios, participated: true }
}

/**
 * L4ScenarioCalculator
 */
export const L4ScenarioCalculator: LayerCalculator = {
  layerId: 'l4',

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l4
    const risks: string[] = []

    try {
      const { score, summary, evidence, participated } = scoreScenario(input)

      if (!participated || !Number.isFinite(score)) {
        return {
          layerId: 'l4' as LayerId,
          layerName: LAYER_LABELS.l4 ?? 'L4 情景推演',
          score: Number.NaN,
          summary,
          risks: ['净利润数据缺失，情景推演未参与综合计算'],
          evidence,
          weight,
          weightedScore: Number.NaN,
          dataSources: [],
          participated: false,
        }
      }

      if (score < V6_CALCULATOR_THRESHOLDS.L4_SCENARIO_RISK_THRESHOLD) {
        risks.push('基准情景已无上行空间或下行风险较大')
      }
      if (score < V6_CALCULATOR_THRESHOLDS.L5_TM_RISK_THRESHOLD) {
        risks.push('目标价低于当前价，建议回避')
      }

      logger.info(`[L4] ${stock.symbol}: score=${score.toFixed(2)}, ${summary}`)

      return {
        layerId: 'l4' as LayerId,
        layerName: LAYER_LABELS.l4 ?? 'L4 情景推演',
        score: Math.round(score * 100) / 100,
        summary,
        risks,
        evidence,
        weight,
        weightedScore: score * weight,
        dataSources: ['行情数据', '财报数据', '情景假设'],
        participated: true,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L4] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l4' as LayerId,
        layerName: LAYER_LABELS.l4 ?? 'L4 情景推演',
        score: Number.NaN,
        summary: `情景推演失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: Number.NaN,
        dataSources: [],
        participated: false,
      }
    }
  },
}

// ============================================================
// L5 T-M 矩阵（技术-市场成熟度） — 权重 5%
// ============================================================

function evaluateTMMatrix(input: LayerInput): { techScore: number; marketScore: number; level: string; strategy: string } {
  const { stock, financials } = input
  const sector = (stock.sector ?? '').toLowerCase()

  const SECTOR_SCORES: Record<string, { tech: number; market: number }> = {
    tech: { tech: 70, market: 60 },
    pharma: { tech: 55, market: 45 },
    newEnergy: { tech: 65, market: 55 },
    default: { tech: 50, market: 50 },
  }

  const sectorKey = sector.includes('芯片') || sector.includes('半导体') || sector.includes('ai') || sector.includes('科技')
    ? 'tech'
    : sector.includes('医药') || sector.includes('药') || sector.includes('生物')
      ? 'pharma'
      : sector.includes('新能源') || sector.includes('光伏') || sector.includes('锂电')
        ? 'newEnergy'
        : 'default'
  const base = SECTOR_SCORES[sectorKey] ?? SECTOR_SCORES.default
  const techScore = base!.tech
  let marketScore = base!.market

  // 营收高增 → 市场成熟度上调
  if (financials.revenueYoY !== undefined) {
    if (financials.revenueYoY > V6_CALCULATOR_THRESHOLDS.L5_TM_REVENUE_BOOST_HIGH) marketScore += 10
    else if (financials.revenueYoY > V6_CALCULATOR_THRESHOLDS.L5_TM_REVENUE_BOOST_MEDIUM) marketScore += 5
  }

  // 象限判定
  const techHigh = techScore >= V6_CALCULATOR_THRESHOLDS.L5_TM_TECH_HIGH
  const techMid = techScore >= V6_CALCULATOR_THRESHOLDS.L5_TM_TECH_MID
  const marketHigh = marketScore >= V6_CALCULATOR_THRESHOLDS.L5_TM_MARKET_HIGH
  const marketMid = marketScore >= V6_CALCULATOR_THRESHOLDS.L5_TM_MARKET_MID

  const strategyKey = `${techHigh}:${techMid}:${marketHigh}:${marketMid}`
  const STRATEGY_MAP: Record<string, { level: string; strategy: string }> = {
    'true:true:true:true': { level: '最佳击球区', strategy: '最佳投资时机 — 技术领先且市场正在追赶' },
    'true:true:true:false': { level: '最佳击球区', strategy: '最佳投资时机 — 技术领先且市场正在追赶' },
    'true:true:false:false': { level: '最佳击球区', strategy: '最佳投资时机 — 技术领先且市场正在追赶' },
    'true:false:true:false': { level: '技术等待市场', strategy: '技术领先但市场未跟上，需耐心等待' },
    'true:false:false:false': { level: '技术等待市场', strategy: '技术领先但市场未跟上，需耐心等待' },
    'false:true:true:true': { level: '追赶期', strategy: '追赶期 — 需催化剂推动' },
    'false:true:true:false': { level: '追赶期', strategy: '追赶期 — 需催化剂推动' },
    'false:false:true:false': { level: '早期阶段', strategy: '早期探索或滞后 — 风险较高' },
    'false:false:false:false': { level: '早期阶段', strategy: '早期探索或滞后 — 风险较高' },
  }
  const { level, strategy } = STRATEGY_MAP[strategyKey] ?? { level: '早期阶段', strategy: '早期探索或滞后 — 风险较高' }

  return { techScore, marketScore, level, strategy }
}

/**
 * L5TMCalculator
 */
export const L5TMCalculator: LayerCalculator = {
  layerId: 'l5',

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l5
    const risks: string[] = []

    try {
      const { techScore, marketScore, level, strategy } = evaluateTMMatrix(input)
      const score = Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, ((techScore + marketScore) / 200) * 5)

      const evidence = [
        `技术成熟度: ${techScore}/100`,
        `市场成熟度: ${marketScore}/100`,
        `象限: ${level}`,
        `策略: ${strategy}`,
      ]

      if (score < 2.5) {
        risks.push('技术-市场双低，风险较高')
      }

      logger.info(`[L5] ${stock.symbol}: tech=${techScore}, market=${marketScore}, score=${score.toFixed(2)}`)

      return {
        layerId: 'l5' as LayerId,
        layerName: LAYER_LABELS.l5 ?? 'L5 T-M 矩阵',
        score: Math.round(score * 100) / 100,
        summary: `T-M: ${level} | ${strategy}`,
        risks,
        evidence,
        weight,
        weightedScore: score * weight,
        dataSources: ['行业分析', '技术评估'],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L5] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l5' as LayerId,
        layerName: LAYER_LABELS.l5 ?? 'L5 T-M 矩阵',
        score: Number.NaN,
        summary: `T-M计算失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: Number.NaN,
        dataSources: [],
      }
    }
  },
}

// ============================================================
// L6 Hype Cycle 阶段定位 — 权重 7%
// ============================================================

interface HypeStage {
  stage: string
  score: number
  characteristic: string
  strategy: string
}

function evaluateHypeCycle(input: LayerInput): HypeStage {
  const { stock, financials } = input
  const sector = (stock.sector ?? '').toLowerCase()

  const flags = {
    isAI: sector.includes('ai') || sector.includes('人工智能') || sector.includes('大模型'),
    isRobot: sector.includes('机器人') || sector.includes('人形'),
    isQuantum: sector.includes('量子'),
    isSemicon: sector.includes('芯片') || sector.includes('半导体'),
    isPharma: sector.includes('医药') || sector.includes('药') || sector.includes('创新药'),
    hasRevenue: financials.revenue !== undefined && financials.revenue > 0,
    hasHighGrowth: financials.revenueYoY !== undefined && financials.revenueYoY > 0.30,
    hasOrders: financials.ordersInHand !== undefined && financials.ordersInHand > 0,
  }

  type HypeMatcher = (f: typeof flags) => HypeStage | null

  const matchers: HypeMatcher[] = [
    (f) =>
      f.isAI || f.isRobot
        ? f.hasHighGrowth && f.hasOrders
          ? { stage: '期望膨胀期（有交付）', score: 4, characteristic: 'AI/机器人概念火爆但有实际交付', strategy: '谨慎追高，关注交付能力' }
          : { stage: '期望膨胀期（纯概念）', score: 3, characteristic: '概念股暴涨但交付不足', strategy: '警惕泡沫，精选有实质进展的标的' }
        : null,
    (f) =>
      f.isQuantum
        ? { stage: '技术萌芽期', score: 3, characteristic: '量子计算实验室突破，初创出现', strategy: '小仓位布局，长期跟踪' }
        : null,
    (f) =>
      f.isSemicon
        ? f.hasHighGrowth
          ? { stage: '复苏期/爬升期', score: 5, characteristic: '半导体周期复苏，价值创造者脱颖而出', strategy: '重仓龙头' }
          : { stage: '生产成熟期', score: 3, characteristic: '半导体成为基础设施，增速放缓', strategy: '关注分红回报和估值性价比' }
        : null,
    (f) =>
      f.isPharma
        ? { stage: '复苏期/爬升期', score: 4, characteristic: '创新药管线兑现，商业化加速', strategy: '精选管线，重仓龙头' }
        : null,
    (f) =>
      f.hasRevenue && f.hasHighGrowth
        ? { stage: '复苏期/爬升期', score: 4, characteristic: '价值创造者脱颖而出', strategy: '积极配置' }
        : null,
    (f) =>
      f.hasRevenue
        ? { stage: '生产成熟期', score: 3, characteristic: '技术成基础设施，增速放缓', strategy: '关注分红回报' }
        : null,
  ]

  for (const matcher of matchers) {
    const result = matcher(flags)
    if (result) return result
  }

  return { stage: '技术萌芽期', score: 3, characteristic: '实验室突破，初创出现', strategy: '小仓位布局' }
}

/**
 * L6HypeCalculator
 */
export const L6HypeCalculator: LayerCalculator = {
  layerId: 'l6',

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l6
    const risks: string[] = []

    try {
      const hype = evaluateHypeCycle(input)

      const evidence = [
        `Hype阶段: ${hype.stage}`,
        `特征: ${hype.characteristic}`,
        `策略: ${hype.strategy}`,
      ]

      if (hype.stage.includes('泡沫') || hype.stage.includes('纯概念')) {
        risks.push('处于Hype泡沫期，需警惕估值回调')
      }

      logger.info(`[L6] ${stock.symbol}: ${hype.stage}, score=${hype.score}`)

      return {
        layerId: 'l6' as LayerId,
        layerName: LAYER_LABELS.l6 ?? 'L6 Hype 周期',
        score: Math.round(hype.score * 100) / 100,
        summary: `${hype.stage} | ${hype.strategy}`,
        risks,
        evidence,
        weight,
        weightedScore: hype.score * weight,
        dataSources: ['行业分析', 'Hype Cycle评估'],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L6] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l6' as LayerId,
        layerName: LAYER_LABELS.l6 ?? 'L6 Hype 周期',
        score: Number.NaN,
        summary: `Hype计算失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: Number.NaN,
        dataSources: [],
      }
    }
  },
}