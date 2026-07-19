/**
 * L0 STEEP 宏观扫描 + L1 护城河 + L2 竞品 计算器
 *
 * 按 SKILL v4.3 评分 rubric 实现。
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from '../types'
import type { LayerId } from '../types'
import { LAYER_LABELS } from '../types'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { safeArrayGet, safeFirst, safeLast } from '@/lib/precision'

const logger = getLogger()

// ============================================================
// L0 STEEP 宏观扫描 — 权重 8%
// ============================================================

interface SteepSubItem {
  name: string
  score: number  // 0-10
  evidence: string
}

function evaluateSTEEP(input: LayerInput): { subs: SteepSubItem[]; score: number; summary: string } {
  const { stock, financials } = input
  const sector = (stock.sector ?? '').toLowerCase()
  const subs: SteepSubItem[] = []

  // S-社会：人口结构/消费习惯/ESG
  const isPharma = sector.includes('医药') || sector.includes('药') || sector.includes('生物')
  const isTech = sector.includes('ai') || sector.includes('芯片') || sector.includes('半导体') || sector.includes('科技')
  const isFinance = sector.includes('金融') || sector.includes('银行') || sector.includes('保险')

  subs.push({ name: 'S-人口结构', score: isPharma ? 8 : 6, evidence: isPharma ? '老龄化利好医药' : '中性影响' })
  subs.push({ name: 'S-消费习惯', score: isTech ? 7 : 6, evidence: isTech ? '科技消费升级' : '中性' })
  subs.push({ name: 'S-ESG', score: isTech ? 8 : 6, evidence: isTech ? '科技企业ESG表现较好' : '中性' })

  // T-技术：成熟度/迭代速度/替代风险
  subs.push({ name: 'T-技术成熟度', score: isTech ? 8 : 6, evidence: isTech ? '核心技术处于商业化阶段' : '一般' })
  subs.push({ name: 'T-技术迭代速度', score: isTech ? 7 : 5, evidence: isTech ? '迭代周期1-3年' : '较慢' })
  subs.push({ name: 'T-技术替代风险', score: isTech ? 7 : 6, evidence: isTech ? '远期存在替代风险' : '风险较低' })

  // E-经济：GDP相关性/利率敏感性/通胀传导
  subs.push({ name: 'E-GDP相关性', score: isFinance ? 6 : 5, evidence: isFinance ? '与GDP中等相关' : '弱相关' })
  subs.push({ name: 'E-利率敏感性', score: 6, evidence: '当前利率环境中性' })
  subs.push({ name: 'E-通胀传导', score: isTech ? 7 : 5, evidence: isTech ? '强传导能力' : '一般' })

  // E-环境：碳达峰/碳中和
  subs.push({ name: 'E-双碳政策', score: isTech ? 7 : 6, evidence: isTech ? '间接受益于双碳政策' : '中性' })

  // P-政策：国家战略/财政支持/监管风险
  subs.push({ name: 'P-国家战略', score: isTech ? 9 : 6, evidence: isTech ? '纳入国家战略规划' : '未明确提及' })
  subs.push({ name: 'P-财政支持', score: isTech ? 8 : 5, evidence: isTech ? '有专项资金支持' : '无明确支持' })
  subs.push({ name: 'P-监管风险', score: isFinance ? 5 : 7, evidence: isFinance ? '强监管收紧风险' : '监管风险较低' })

  const avg = subs.reduce((s, x) => s + x.score, 0) / subs.length
  const score = Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, Math.max(V6_CALCULATOR_THRESHOLDS.SCORE_MIN, avg / V6_CALCULATOR_THRESHOLDS.L0_STEEP_NORMALIZE_DIVISOR)) // 归一化 0-10 → 0-5

  const topPos = subs.filter((s) => s.score >= V6_CALCULATOR_THRESHOLDS.L0_STEEP_POSITIVE_THRESHOLD).slice(0, 3).map((s) => s.name)
  const topNeg = subs.filter((s) => s.score <= V6_CALCULATOR_THRESHOLDS.L0_STEEP_NEGATIVE_THRESHOLD).slice(0, 2).map((s) => s.name)

  let summary = `STEEP 均值 ${avg.toFixed(1)}/10`
  if (topPos.length > 0) summary += `, 利好: ${topPos.join('、')}`
  if (topNeg.length > 0) summary += `, 风险: ${topNeg.join('、')}`

  // 财务数据补充
  if (financials.revenueYoY !== undefined && financials.revenueYoY > V6_CALCULATOR_THRESHOLDS.L0_REVENUE_YOY_HIGH) {
    summary += ', 营收高增印证行业景气'
  }

  return { subs, score, summary }
}

/**
 * L0MacroCalculator
 */
export const L0MacroCalculator: LayerCalculator = {
  layerId: 'l0',
  async calculate(input: LayerInput): Promise<LayerScore> {
    const { config } = input
    const weight = config.weights.l0
    const { subs, score, summary } = evaluateSTEEP(input)

    logger.info(`[L0] ${input.stock.symbol}: STEEP score=${score.toFixed(2)}`)

    return {
      layerId: 'l0' as LayerId,
      layerName: LAYER_LABELS.l0 ?? 'L0 STEEP 宏观扫描',
      score: Math.round(score * 100) / 100,
      summary,
      risks: subs.filter((s) => s.score <= V6_CALCULATOR_THRESHOLDS.L0_STEEP_NEGATIVE_THRESHOLD).map((s) => `${s.name}: ${s.evidence}`),
      evidence: subs.slice(0, 5).map((s) => `${s.name}: ${s.score}/10`),
      weight,
      weightedScore: score * weight,
      dataSources: ['宏观数据', '行业报告'],
      participated: true,
    }
  },
}

// ============================================================
// L1 护城河分析 — 权重 15%
// ============================================================

function evaluateMoat(input: LayerInput): { score: number; summary: string; evidence: string[] } {
  const { stock, financials } = input
  const sector = (stock.sector ?? '').toLowerCase()
  const evidence: string[] = []
  let criteriaMet = 0

  // 技术独占性：研发/营收>10%, 顶尖团队
  if (financials.rdRatio !== undefined && financials.rdRatio > V6_CALCULATOR_THRESHOLDS.L1_MOAT_RD_HIGH) {
    criteriaMet++
    evidence.push(`研发/营收=${(financials.rdRatio * 100).toFixed(1)}%>8%`)
  } else if (financials.rdRatio !== undefined && financials.rdRatio > V6_CALCULATOR_THRESHOLDS.L1_MOAT_RD_MEDIUM) {
    criteriaMet += 0.5
    evidence.push(`研发/营收=${(financials.rdRatio * 100).toFixed(1)}%>5%`)
  }

  // 客户锁定：NRR>120% 或 使用年限>5年 或 深度嵌入流程
  if (financials.customerConcentration !== undefined && financials.customerConcentration < V6_CALCULATOR_THRESHOLDS.L1_MOAT_CUSTOMER_CONCENTRATION_LOW) {
    criteriaMet += 0.5
    evidence.push(`客户集中度低=${(financials.customerConcentration * 100).toFixed(0)}%`)
  }

  // 规模效应：翻倍成本降>15% 或 固定资产竞品3倍+ 或 渠道密度远超
  if (stock.marketCap !== undefined) {
    if (stock.marketCap > V6_CALCULATOR_THRESHOLDS.L1_MOAT_MARKET_CAP_LARGE) {
      criteriaMet++
      evidence.push(`市值=${(stock.marketCap / 1e8).toFixed(0)}亿，行业龙头`)
    } else if (stock.marketCap > V6_CALCULATOR_THRESHOLDS.L1_MOAT_MARKET_CAP_MEDIUM) {
      criteriaMet += 0.5
      evidence.push(`市值=${(stock.marketCap / 1e8).toFixed(0)}亿`)
    }
  }

  // 网络效应：双边/多边效应，份额>50%且提升
  const isTech = sector.includes('ai') || sector.includes('芯片') || sector.includes('半导体') || sector.includes('科技')
  if (isTech) {
    criteriaMet += 0.5
    evidence.push('科技行业存在网络效应')
  }

  // 资源独占：稀缺资源垄断/牌照/不可复制区位
  const isPharma = sector.includes('医药') || sector.includes('药') || sector.includes('生物')
  if (isPharma) {
    criteriaMet += 0.5
    evidence.push('医药行业存在专利/牌照壁垒')
  }

  // 满足4条=5分, 3条=4分, 2条=3分, 1条=2分, 0条=1分
  const scoreMap = V6_CALCULATOR_THRESHOLDS.L1_MOAT_CRITERIA_SCORE_MAP
  const score = scoreMap[Math.min(4, criteriaMet)] ?? 1

  const strengths = evidence.filter((e) => !e.includes('中性'))
  const summary = `护城河评估: ${criteriaMet.toFixed(1)}/4条标准满足, ${score >= 4 ? '强护城河' : score >= 3 ? '中等护城河' : '弱护城河'}`

  return { score, summary, evidence: strengths }
}

/**
 * L1MoatCalculator
 */
export const L1MoatCalculator: LayerCalculator = {
  layerId: 'l1',
  async calculate(input: LayerInput): Promise<LayerScore> {
    const { config } = input
    const weight = config.weights.l1
    const { score, summary, evidence } = evaluateMoat(input)

    logger.info(`[L1] ${input.stock.symbol}: 护城河 score=${score.toFixed(2)}`)

    return {
      layerId: 'l1' as LayerId,
      layerName: LAYER_LABELS.l1 ?? 'L1 护城河分析',
      score: Math.round(score * 100) / 100,
      summary,
      risks: score < V6_CALCULATOR_THRESHOLDS.L1_MOAT_RISK_THRESHOLD ? ['护城河较弱，需关注竞争压力'] : [],
      evidence,
      weight,
      weightedScore: score * weight,
      dataSources: ['财报数据', '行业分析'],
      participated: true,
    }
  },
}

// ============================================================
// L2 竞品格局 — 权重 10%
// ============================================================

function evaluatePeer(input: LayerInput): { score: number; summary: string; evidence: string[] } {
  const { stock, financials } = input
  const evidence: string[] = []
  let dimensionScore = V6_CALCULATOR_THRESHOLDS.L2_PEER_BASELINE_SCORE // 基础分

  // 技术代差：领先2代+2.0, 1代+1.0, 持平0, 落后-1.0
  const sector = (stock.sector ?? '').toLowerCase()
  if (sector.includes('芯片') || sector.includes('半导体') || sector.includes('ai')) {
    dimensionScore += V6_CALCULATOR_THRESHOLDS.L2_PEER_TECH_BOOST
    evidence.push('科技赛道，技术领先推断+1.0')
  }

  // 市场份额：龙头>30%扩大+1.5, 稳定+0.5
  if (stock.marketCap !== undefined) {
    if (stock.marketCap > V6_CALCULATOR_THRESHOLDS.L2_PEER_LARGE_CAP) {
      dimensionScore += V6_CALCULATOR_THRESHOLDS.L2_PEER_LARGE_CAP_BOOST
      evidence.push(`市值=${(stock.marketCap / 1e8).toFixed(0)}亿，行业龙头+1.0`)
    } else if (stock.marketCap > V6_CALCULATOR_THRESHOLDS.L2_PEER_MEDIUM_CAP) {
      dimensionScore += V6_CALCULATOR_THRESHOLDS.L2_PEER_MEDIUM_CAP_BOOST
      evidence.push(`市值=${(stock.marketCap / 1e8).toFixed(0)}亿，稳定份额+0.5`)
    }
  }

  // 客户认证：量产供货+1.5, 小批量+0.5
  if (financials.revenue !== undefined && financials.revenue > V6_CALCULATOR_THRESHOLDS.L2_PEER_REVENUE_THRESHOLD) {
    dimensionScore += V6_CALCULATOR_THRESHOLDS.L2_PEER_REVENUE_BOOST
    evidence.push(`营收=${financials.revenue.toFixed(0)}亿，量产阶段+0.5`)
  }

  const score = Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, Math.max(1, dimensionScore))
  const tier = score >= 4 ? '第一梯队领先' : score >= 3.5 ? '并列第一梯队' : score >= 3 ? '第二梯队' : '落后'

  return { score, summary: `竞品评估: ${tier}`, evidence }
}

/**
 * L2PeerCalculator
 */
export const L2PeerCalculator: LayerCalculator = {
  layerId: 'l2',
  async calculate(input: LayerInput): Promise<LayerScore> {
    const { config } = input
    const weight = config.weights.l2
    const { score, summary, evidence } = evaluatePeer(input)

    logger.info(`[L2] ${input.stock.symbol}: 竞品 score=${score.toFixed(2)}`)

    return {
      layerId: 'l2' as LayerId,
      layerName: LAYER_LABELS.l2 ?? 'L2 竞品格局',
      score: Math.round(score * 100) / 100,
      summary,
      risks: score < V6_CALCULATOR_THRESHOLDS.L2_PEER_RISK_THRESHOLD ? ['竞品格局偏弱，需关注竞争压力'] : [],
      evidence,
      weight,
      weightedScore: score * weight,
      dataSources: ['市值数据', '财报数据', '行业分析'],
      participated: true,
    }
  },
}

// ============================================================
// 可测试纯函数 — 趋势 / 评分板 / 估值
// ============================================================

import type { StockBasicData, FinancialData } from '../types'

/** 判断长期趋势 */
export function judgeLongTermTrend(priceHistory: number[], days: number): string {
  if (!priceHistory || priceHistory.length === 0 || days < V6_CALCULATOR_THRESHOLDS.L0_TREND_MIN_DAYS) return '无数据'
  if (priceHistory.length < days) return '无数据'
  const slice = priceHistory.slice(-days)
  const first = safeFirst(slice)
  const last = safeLast(slice)
  if (first !== undefined && last !== undefined && last > first * V6_CALCULATOR_THRESHOLDS.L0_TREND_RISE_MULTIPLIER) return '上升'
  if (first !== undefined && last !== undefined && last < first * V6_CALCULATOR_THRESHOLDS.L0_TREND_FALL_MULTIPLIER) return '下降'
  return '横盘'
}

/** 长期趋势评分 */
export function scoreLongTermTrend(input: LayerInput): number {
  const { quotes } = input
  const history = quotes.history ?? []
  const days = history.length
  const trend = judgeLongTermTrend(history, days)

  const TREND_SCORES: Record<string, number> = {
    上升: V6_CALCULATOR_THRESHOLDS.L0_TREND_UP_SCORE,
    横盘: V6_CALCULATOR_THRESHOLDS.L0_TREND_SIDEWAYS_SCORE,
    下降: V6_CALCULATOR_THRESHOLDS.L0_TREND_DOWN_SCORE,
    无数据: 0,
  }

  if (trend === '无数据') return 0
  const score = TREND_SCORES[trend] ?? V6_CALCULATOR_THRESHOLDS.L0_TREND_BASELINE_SCORE

  // 日线连续3天同向且>=3% 额外加分/减分
  if (history.length >= 3) {
    const last3 = history.slice(-3)
    const v0 = safeArrayGet(last3, 0, 1)
    const v1 = safeArrayGet(last3, 1, 1)
    const v2 = safeArrayGet(last3, 2, 1)
    const d1 = (v1 - v0) / v0
    const d2 = (v2 - v1) / v1
    if (d1 >= V6_CALCULATOR_THRESHOLDS.L0_TREND_ACCELERATION && d2 >= V6_CALCULATOR_THRESHOLDS.L0_TREND_ACCELERATION) {
      return Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, Math.max(V6_CALCULATOR_THRESHOLDS.SCORE_MIN, score + V6_CALCULATOR_THRESHOLDS.L0_TREND_ACCELERATION_DELTA))
    }
    if (d1 <= -V6_CALCULATOR_THRESHOLDS.L0_TREND_ACCELERATION && d2 <= -V6_CALCULATOR_THRESHOLDS.L0_TREND_ACCELERATION) {
      return Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, Math.max(V6_CALCULATOR_THRESHOLDS.SCORE_MIN, score - V6_CALCULATOR_THRESHOLDS.L0_TREND_ACCELERATION_DELTA))
    }
  }

  return Math.min(V6_CALCULATOR_THRESHOLDS.SCORE_MAX, Math.max(V6_CALCULATOR_THRESHOLDS.SCORE_MIN, score))
}

/** 构建评分板（10项指标，每项1-5分） */
export function buildScoreBoard(stock: StockBasicData, financials: FinancialData): Record<string, number> {
  const board: Record<string, number> = {}

  board['ROE'] = stock.roe !== undefined && stock.roe > 0 ? Math.min(5, Math.max(1, stock.roe / 0.05)) : 3
  board['PE'] = stock.pe !== undefined && stock.pe > 0 ? (stock.pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_LOW ? 5 : stock.pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_MEDIUM ? 3 : 1) : 3
  board['PB'] = stock.pb !== undefined && stock.pb > 0 ? (stock.pb < V6_CALCULATOR_THRESHOLDS.PB_TIER1 ? 5 : stock.pb < V6_CALCULATOR_THRESHOLDS.PB_TIER2 ? 3 : 1) : 3
  board['营收增速'] = financials.revenueYoY !== undefined ? Math.min(5, Math.max(1, 2 + financials.revenueYoY * 10)) : 3
  board['净利增速'] = financials.netProfitYoY !== undefined ? Math.min(5, Math.max(1, 2 + financials.netProfitYoY * 10)) : 3
  board['毛利率'] = financials.grossMargin !== undefined ? Math.min(5, Math.max(1, financials.grossMargin * 10)) : 3
  board['净利率'] = financials.netMargin !== undefined ? Math.min(5, Math.max(1, financials.netMargin * 20)) : 3
  board['现金流'] = financials.operatingCF !== undefined ? (financials.operatingCF > 0 ? 4 : 2) : 3
  board['负债率'] = financials.interestBearingDebt !== undefined && financials.netAssets !== undefined && financials.netAssets > 0
    ? (financials.interestBearingDebt / financials.netAssets < 0.5 ? 4 : 2) : 3
  board['研发占比'] = financials.rdRatio !== undefined ? Math.min(5, Math.max(1, financials.rdRatio * 50)) : 3

  return board
}

/** 评分板打分 */
export function scoreScoreBoard(board: Record<string, number>, filters?: string[]): number {
  if (filters?.length === 0) return 0
  const keys = filters !== undefined && filters.length > 0
    ? Object.keys(board).filter(k => filters.includes(k))
    : Object.keys(board)
  if (keys.length === 0) return 0
  const missingBoardKeys = keys.filter((k) => board[k] == null)
  if (missingBoardKeys.length > 0) {
    logger.warn('[l0_l1_l2] 评分板字段缺失，使用默认值', { field: missingBoardKeys.join(','), context: 'scoreScoreBoard' })
  }
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const sum = keys.reduce((s, k) => s + (board[k] || 0), 0)
  return Math.min(5, Math.max(1, sum / keys.length))
}

/** 估值判断 */
export function judgeValuation(
  pe: number | undefined,
  revenueYoY: number | undefined,
  netProfitYoY: number | undefined,
  sector?: string,
): string {
  if (pe === undefined) return '无PE'
  if (pe < 0) return '亏损'

  const isChip = sector
    ? sector.toLowerCase().includes('芯片') || sector.toLowerCase().includes('半导体')
    : false

  const highGrowth = (revenueYoY !== undefined && revenueYoY > 0.5) ||
                     (netProfitYoY !== undefined && netProfitYoY > 0.5)

  if (isChip) {
    if (pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_MEDIUM && highGrowth) return '低估'
    if (pe < V6_CALCULATOR_THRESHOLDS.PE_TIER_CHIP2) return '合理'
    if (pe < V6_CALCULATOR_THRESHOLDS.PE_TIER_CHIP3) return '高估'
    return '极高'
  }

  if (pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_LOW && highGrowth) return '低估'
  if (pe < V6_CALCULATOR_THRESHOLDS.L3_VALUATION_PE_MEDIUM) return '合理'
  if (pe < V6_CALCULATOR_THRESHOLDS.PE_TIER_GENERAL3) return '高估'
  return '极高'
}

/** 估值评分 */
export function scoreValuation(input: LayerInput): number {
  const { stock, financials } = input
  const judgement = judgeValuation(stock.pe, financials.revenueYoY, financials.netProfitYoY, stock.sector)

  switch (judgement) {
    case '低估': return 5
    case '合理': return 3.5
    case '高估': return 2
    case '极高': return 1
    case '亏损': return 1.5
    case '无PE': return 0
    default: return 3
  }
}