import { getLogger } from '@/lib/logger'
import { ALERT_LEVELS, SCORE_BUCKETS, SUB_FACTOR_MAP } from '@/config/rotationConfig'
import { getSignalGrade } from '@/services/analysis/rotation/rotationSignalGrader'
import type {
  DeclineNature,
  RotationAlertLevel,
  RotationScoreBucket,
  RotationSectorScore,
} from '@/data/types'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { ROTATION_CALCULATOR_THRESHOLDS } from '@/config/thresholds'

const logger = getLogger()

export function getScoreBucket(total: number): RotationScoreBucket {
  return (SCORE_BUCKETS.find((b) => total >= b.min) ?? SCORE_BUCKETS[3]) as RotationScoreBucket
}

export function getAlertLevel(f1: number, f2: number): RotationAlertLevel {
  const t = ROTATION_CALCULATOR_THRESHOLDS
  if (f1 < t.ALERT_F1_LOW_CRITICAL && f2 < t.ALERT_F2_NEGATIVE) return ALERT_LEVELS[3] as RotationAlertLevel
  if (f1 < t.ALERT_F1_LOW_MAJOR && f2 < t.ALERT_F2_NEGATIVE) return ALERT_LEVELS[2] as RotationAlertLevel
  if (f1 > t.ALERT_F1_HIGH_WARNING && f2 < t.ALERT_F2_LOW) return ALERT_LEVELS[1] as RotationAlertLevel
  return ALERT_LEVELS[0] as RotationAlertLevel
}

/** 下跌性质判定 */
export function determineDeclineNature(
  competitionTrend: string,
  roeTrend: string,
  jingqi: number,
  fundInflow: number,
): DeclineNature {
  const t = ROTATION_CALCULATOR_THRESHOLDS
  if (competitionTrend === '恶化' || roeTrend === '下降') {
    return { type: '杀逻辑', severity: '严重', action: '清仓+黑名单6个月', color: COLOR_TOKENS.danger.hex }
  }
  if (jingqi < t.DECLINE_JINGQI_LOW && fundInflow < t.DECLINE_FUND_INFLOW_NEGATIVE) {
    return { type: '杀业绩', severity: '中等', action: '降仓50%，等待景气确认', color: COLOR_TOKENS.warning.hex }
  }
  if (jingqi < t.DECLINE_JINGQI_CRITICAL) {
    return { type: '杀估值', severity: '轻微', action: '降仓30%，不禁回补', color: COLOR_TOKENS.warning.hex }
  }
  return { type: '杀估值', severity: '轻微', action: '观察', color: COLOR_TOKENS.success.hex }
}

/** 计算板块综合得分 */
export function calculateSectorScore(scores: Record<string, number>): {
  f1: number
  f2: number
  f3: number
  f4: number
  f5: number
  total: number
} {
  const expectedKeys = ['F1A', 'F1B', 'F1C', 'F1D', 'F1E', 'F2A', 'F2B', 'F2C', 'F2D', 'F3A', 'F3B', 'F3C', 'F4A', 'F4B', 'F5A', 'F5B']
  const missingKeys = expectedKeys.filter((k) => scores[k] == null)
  if (missingKeys.length > 0) {
    logger.warn('[rotationCalculator] 板块因子得分缺失，使用默认值', { field: missingKeys.join(','), context: 'calculateSectorScore' })
  }
  const s = (v: number | undefined): number => v || 0
  const f1 = s(scores.F1A) + s(scores.F1B) + s(scores.F1C) + s(scores.F1D) + s(scores.F1E)
  const f2 = s(scores.F2A) + s(scores.F2B) + s(scores.F2C) + s(scores.F2D)
  const f3 = s(scores.F3A) + s(scores.F3B) + s(scores.F3C)
  const f4 = s(scores.F4A) + s(scores.F4B)
  const f5 = Math.max(0, s(scores.F5A) + s(scores.F5B))
  return { f1, f2, f3, f4, f5, total: f1 + f2 + f3 + f4 + f5 }
}

/** 共振强度计算 (0-10) */
export function calculateResonance(total: number, f1: number, f2: number): number {
  const t = ROTATION_CALCULATOR_THRESHOLDS

  const tiers = [
    { threshold: t.RESONANCE_TOTAL_TIER_1, score: t.RESONANCE_BASE_SCORE_TIER_1 },
    { threshold: t.RESONANCE_TOTAL_TIER_2, score: t.RESONANCE_BASE_SCORE_TIER_2 },
    { threshold: t.RESONANCE_TOTAL_TIER_3, score: t.RESONANCE_BASE_SCORE_TIER_3 },
    { threshold: t.RESONANCE_TOTAL_TIER_4, score: t.RESONANCE_BASE_SCORE_TIER_4 },
    { threshold: t.RESONANCE_TOTAL_TIER_5, score: t.RESONANCE_BASE_SCORE_TIER_5 },
    { threshold: t.RESONANCE_TOTAL_TIER_6, score: t.RESONANCE_BASE_SCORE_TIER_6 },
    { threshold: t.RESONANCE_TOTAL_TIER_7, score: t.RESONANCE_BASE_SCORE_TIER_7 },
  ]
  const base = tiers.find((tier) => total >= tier.threshold)?.score ?? t.RESONANCE_BASE_SCORE_TIER_8

  const doubleResonance = f1 >= t.RESONANCE_DOUBLE_RESONANCE_F1_MIN && f2 >= t.RESONANCE_DOUBLE_RESONANCE_F2_MIN ? 1 : 0
  const jingqiBonus = f1 >= t.RESONANCE_JINGQI_BONUS_F1_MIN ? 1 : 0

  return Math.min(t.RESONANCE_MAX_SCORE, base + doubleResonance + jingqiBonus)
}

/** 校验子指标分值是否合法 */
export function validateSubScores(scores: Record<string, number>): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  for (const [code, value] of Object.entries(scores)) {
    const meta = SUB_FACTOR_MAP[code]
    if (!meta) {
      errors.push(`未知子指标: ${code}`)
      continue
    }
    if (value < 0 || value > meta.score) {
      errors.push(`${code} 分值 ${value} 超出范围 [0, ${meta.score}]`)
    }
  }
  return { valid: errors.length === 0, errors }
}

/** 生成板块轮动评分记录 ID */
export function makeRotationScoreId(sectorCode: string, scoreDate: string): string {
  return `${sectorCode}__${scoreDate}`
}

/** 根据子指标计算完整的 RotationSectorScore 对象（不含持久化） */
export function calculateRotationScore(input: {
  sectorCode: string
  sectorName: string
  scoreDate: string
  subScores: Record<string, number>
  poolStocks?: Array<{ symbol: string; name: string; v6Composite?: number }>
  analysisReport?: string
  modelUsed?: string
}): RotationSectorScore {
  const { sectorCode, sectorName, scoreDate, subScores, poolStocks = [], analysisReport, modelUsed = 'rotation-v3.1' } = input

  const { f1, f2, f3, f4, f5, total } = calculateSectorScore(subScores)
  const resonance = calculateResonance(total, f1, f2)
  const grade = getSignalGrade(resonance)
  const alert = getAlertLevel(f1, f2)
  const decline = determineDeclineNature('稳定', '稳定', f1, f2)

  return {
    id: makeRotationScoreId(sectorCode, scoreDate),
    sectorCode,
    sectorName,
    scoreDate,
    f1Jingqi: f1,
    f2Zijin: f2,
    f3Guzhi: f3,
    f4Beta: f4,
    f5Nengliang: f5,
    total,
    resonance,
    signal: grade.label,
    alertLevel: alert.name,
    declineType: decline.type,
    poolStocks,
    analysisReport,
    modelUsed,
    createdAt: new Date().toISOString(),
  }
}
