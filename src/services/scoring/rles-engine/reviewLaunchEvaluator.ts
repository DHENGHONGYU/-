/**
 * RLES —— 复盘启动分析独立评价体系（Review-Launch Evaluation System）
 *
 * 与 V6 价值层（l1-l8 综合评分）、golden_buy 信号层彻底解耦，是第三层
 * "复盘启动就绪度" 元评分。设计来源：deliverables/strategy-consolidated-and-reviewlaunch-evaluation.md
 *
 * 四维模型：
 *  D1 数据就绪度  —— 置信乘子·守质量门（对标新华制药"数据不全"被压分）
 *  D2 策略适配度  —— 个股策略适配（V6）+ 板块景气增强（权重 0.25）
 *  D3 时机成熟度  —— 评级基分 + 黄金买点 + 板块资金（权重 0.40，二波/MAS 预留）
 *  D4 风险健康度  —— 风险否决·砍仓 0.73（权重 0.35）
 *
 * 公式：RLES = (0.25·D2 + 0.40·D3 + 0.35·D4) × conf(D1)
 * 风险降级：命中硬风险 → 总分 ×0.73，tier 降一级，打标"风险降级"
 * 分流：≥80 优先 / 60-79.99 常规 / <60 谨慎；D1<60 强制谨慎
 */

import type { V6Score } from '@/data/types/types.score'
import type { RotationSectorScore } from '@/data/types/types.rotation'
import type { ChipResult } from '@/services/scoring/v6-engine/types'
import type { SecondWaveSignal } from './secondWaveDetector'

export type RlesDimensionId = 'D1' | 'D2' | 'D3' | 'D4'
export type RlesTier = 'priority' | 'normal' | 'cautious'

export interface RlesDimension {
  id: RlesDimensionId
  name: string
  /** 0-100 */
  score: number
  /** 在加权总分中的权重（D1 为置信乘子，不计入加权和，记 0） */
  weight: number
  detail: string
  subScores: Record<string, number>
}

export interface RlesInput {
  symbol: string
  v6Score?: V6Score | null
  /** 可选增强：板块景气/资金因子（股票→板块映射接入后填入） */
  rotationScore?: RotationSectorScore | null
  /** 可选增强：八级筹码结果（evaluateChip 输出） */
  chip?: ChipResult | null
  /** 由调用方推断（如 v6Score.rating==='strong_buy'）；预留给 golden_buy 检测器 */
  goldenBuyDetected?: boolean
  /** 预留：MAS 市场宽度因子（breadthFactor 落地后接入，0-100） */
  marketBreadth?: number | null
  /** 主升浪二波检测器输出（secondWaveDetector 落地后接入） */
  secondWaveSignal?: SecondWaveSignal | null
  /** 数据就绪度（0-100）；缺省由 v6Score.qualityWarning 推断 */
  dataFreshness?: number | null
  /** 三条禁令等硬风险命中标签 */
  hardRisks?: string[]
}

export interface RlesResult {
  symbol: string
  /** 0-100 加权总分（已应用风险降级乘子） */
  total: number
  dimensions: RlesDimension[]
  tier: RlesTier
  riskDowngraded: boolean
  riskMultiplier: number
  riskTags: string[]
  recommendation: string
  evaluatedAt: number
}

const WEIGHTS = { D2: 0.25, D3: 0.4, D4: 0.35 } as const
const RISK_MULTIPLIER = 0.73
const TIER_PRIORITY = 80
const TIER_NORMAL = 60

/** 评级 → 时机基分（0-100），反映 V6 交易信号对"时机成熟度"的贡献 */
const RATING_TIMING_BASE: Record<string, number> = {
  strong_buy: 88,
  buy: 72,
  hold: 55,
  sell: 35,
  strong_sell: 20,
}

function clamp100(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, n))
}

// ── D1 数据就绪度（置信乘子） ─────────────────────────────────────
function evaluateD1(input: RlesInput): RlesDimension {
  let freshness = input.dataFreshness
  if (freshness == null) {
    if (input.v6Score == null) freshness = 0
    else if (input.v6Score.qualityWarning) freshness = 70
    else freshness = 95
  }
  const score = clamp100(freshness)
  return {
    id: 'D1',
    name: '数据就绪度',
    score,
    weight: 0,
    detail: score >= 80 ? '数据完整，置信高' : score >= 60 ? '数据基本可用' : '数据缺失/告警，置信低',
    subScores: { freshness: score },
  }
}

// ── D2 策略适配度（权重 0.25） ───────────────────────────────────
function evaluateD2(input: RlesInput): RlesDimension {
  const v6 = input.v6Score
  const v6Norm = v6 ? clamp100((v6.score / 5) * 100) : 50
  // 板块景气增强：F1 景气因子作为板块适配信号（映射接入前中性 50）
  const sectorFit = input.rotationScore ? clamp100(input.rotationScore.f1Jingqi) : 50
  const score = clamp100(v6Norm * 0.7 + sectorFit * 0.3)
  return {
    id: 'D2',
    name: '策略适配度',
    score,
    weight: WEIGHTS.D2,
    detail: `个股策略适配 ${v6Norm.toFixed(0)}（V6 ${v6 ? v6.score.toFixed(2) : 'N/A'}）+ 板块景气 ${sectorFit.toFixed(0)}`,
    subScores: { v6Fit: v6Norm, sectorFit },
  }
}

// ── D3 时机成熟度（权重 0.40） ───────────────────────────────────
function evaluateD3(input: RlesInput): RlesDimension {
  const v6 = input.v6Score
  const ratingBase = v6 ? RATING_TIMING_BASE[v6.rating ?? 'hold'] ?? 55 : 50
  const goldenBoost = input.goldenBuyDetected ? 10 : 0
  // 板块资金因子（F2）作为板块动量代理
  const sectorFund = input.rotationScore ? clamp100(input.rotationScore.f2Zijin) : 50
  // 二波检测器：命中后按信号类型/回踩层级给差异化加成
  let secondWaveStrength = 50
  let secondWaveBoost = 0
  const sw = input.secondWaveSignal
  if (sw) {
    secondWaveStrength = sw.strength
    if (sw.detected) {
      if (sw.signalType === 'strong_wave') secondWaveBoost = 12
      else if (sw.signalType === 'pullback') {
        secondWaveBoost =
          sw.pullbackLevel === 'ma5' ? 8 : sw.pullbackLevel === 'ma10' ? 6 : sw.pullbackLevel === 'ma20' ? 4 : 2
      } else if (sw.signalType === 'trial') secondWaveBoost = 6
    }
  }
  // MAS 市场宽度（预留，当前中性）
  const breadth = input.marketBreadth != null ? clamp100(input.marketBreadth) : 50
  const score = clamp100(
    ratingBase * 0.5 + goldenBoost + sectorFund * 0.2 + secondWaveStrength * 0.1 + secondWaveBoost,
  )
  const swDesc = sw
    ? sw.detected
      ? `二波信号 ${sw.signalType}(强度${sw.strength.toFixed(0)})+${secondWaveBoost}`
      : `二波未命中(${sw.signalType})`
    : '二波中性'
  return {
    id: 'D3',
    name: '时机成熟度',
    score,
    weight: WEIGHTS.D3,
    detail: input.goldenBuyDetected
      ? `检出黄金买点 + ${swDesc}`
      : `评级基分 ${ratingBase.toFixed(0)}，板块资金 ${sectorFund.toFixed(0)}，${swDesc}`,
    subScores: { ratingBase, goldenBoost, sectorFund, secondWaveStrength, secondWaveBoost, breadth },
  }
}

// ── D4 风险健康度（权重 0.35） ───────────────────────────────────
function evaluateD4(input: RlesInput): RlesDimension {
  const v6 = input.v6Score
  const risks = v6?.allRisks ?? []
  const hardRisks = input.hardRisks ?? []
  const chipRisk = input.chip
    ? input.chip.riskLevel === 'high'
      ? 30
      : input.chip.riskLevel === 'medium'
        ? 15
        : 0
    : 0
  const penalty = Math.min(100, risks.length * 12 + hardRisks.length * 25 + chipRisk)
  const score = clamp100(100 - penalty)
  return {
    id: 'D4',
    name: '风险健康度',
    score,
    weight: WEIGHTS.D4,
    detail:
      penalty === 0
        ? '无明显风险'
        : `风险惩罚 ${penalty.toFixed(0)}（V6风险 ${risks.length} / 硬风险 ${hardRisks.length} / 筹码 ${chipRisk}）`,
    subScores: { v6RiskCount: risks.length, hardRiskCount: hardRisks.length, chipRisk },
  }
}

/**
 * 评估单只标的的复盘启动就绪度（纯函数，无副作用）。
 * @param input 已准备好的各因子输入（V6 评分、可选板块/筹码增强、硬风险标签）
 * @returns RLES 四维结果、总分、分流等级与风险标签
 */
export function evaluateReviewLaunch(input: RlesInput): RlesResult {
  const d1 = evaluateD1(input)
  const d2 = evaluateD2(input)
  const d3 = evaluateD3(input)
  const d4 = evaluateD4(input)

  const conf = d1.score / 100 // D1 置信乘子
  const weighted = d2.weight * d2.score + d3.weight * d3.score + d4.weight * d4.score
  let total = clamp100(weighted * conf)

  // ── 风险降级（×0.73） ──
  const hardRisks = input.hardRisks ?? []
  const fatalRisks = input.v6Score?.allRisks?.filter((r) => /退市|ST|违规|处罚|立案/.test(r)) ?? []
  const riskTags = new Set<string>(hardRisks)
  const riskDowngraded = hardRisks.length > 0 || fatalRisks.length > 0
  if (riskDowngraded) {
    total = clamp100(total * RISK_MULTIPLIER)
    fatalRisks.forEach((r) => riskTags.add(r))
  }

  // ── 分流 ──
  let tier: RlesTier =
    total >= TIER_PRIORITY ? 'priority' : total >= TIER_NORMAL ? 'normal' : 'cautious'
  if (d1.score < TIER_NORMAL) tier = 'cautious' // D1<60 强制谨慎
  if (riskDowngraded && tier === 'priority') tier = 'normal'

  const recommendation =
    tier === 'priority'
      ? '优先深度复盘：数据就绪且策略/时机/风险三维共振'
      : tier === 'normal'
        ? '常规复盘：满足条件，可纳入复盘队列'
        : '谨慎：数据或风险约束未达阈值，建议补全数据/排查风险后再启动'

  return {
    symbol: input.symbol,
    total,
    dimensions: [d1, d2, d3, d4],
    tier,
    riskDowngraded,
    riskMultiplier: riskDowngraded ? RISK_MULTIPLIER : 1,
    riskTags: Array.from(riskTags),
    recommendation,
    evaluatedAt: Date.now(),
  }
}
