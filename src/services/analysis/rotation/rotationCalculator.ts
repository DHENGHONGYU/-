import { ALERT_LEVELS, SCORE_BUCKETS, SUB_FACTOR_MAP } from '@/config/rotationConfig'
import { getSignalGrade } from '@/services/analysis/rotation/rotationSignalGrader'
import type {
  DeclineNature,
  RotationAlertLevel,
  RotationScoreBucket,
  RotationSectorScore,
} from '@/data/types'

export function getScoreBucket(total: number): RotationScoreBucket {
  return (SCORE_BUCKETS.find((b) => total >= b.min) ?? SCORE_BUCKETS[3]) as RotationScoreBucket
}

export function getAlertLevel(f1: number, f2: number): RotationAlertLevel {
  if (f1 < 40 && f2 < 0) return ALERT_LEVELS[3] as RotationAlertLevel
  if (f1 < 50 && f2 < 0) return ALERT_LEVELS[2] as RotationAlertLevel
  if (f1 > 58 && f2 < 12) return ALERT_LEVELS[1] as RotationAlertLevel
  return ALERT_LEVELS[0] as RotationAlertLevel
}

/** 下跌性质判定 */
export function determineDeclineNature(
  competitionTrend: string,
  roeTrend: string,
  jingqi: number,
  fundInflow: number,
): DeclineNature {
  if (competitionTrend === '恶化' || roeTrend === '下降') {
    return { type: '杀逻辑', severity: '严重', action: '清仓+黑名单6个月', color: '#ef4444' }
  }
  if (jingqi < 50 && fundInflow < 0) {
    return { type: '杀业绩', severity: '中等', action: '降仓50%，等待景气确认', color: '#f97316' }
  }
  if (jingqi < 40) {
    return { type: '杀估值', severity: '轻微', action: '降仓30%，不禁回补', color: '#f59e0b' }
  }
  return { type: '杀估值', severity: '轻微', action: '观察', color: '#10b981' }
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
  const f1 = (scores.F1A || 0) + (scores.F1B || 0) + (scores.F1C || 0) + (scores.F1D || 0) + (scores.F1E || 0)
  const f2 = (scores.F2A || 0) + (scores.F2B || 0) + (scores.F2C || 0) + (scores.F2D || 0)
  const f3 = (scores.F3A || 0) + (scores.F3B || 0) + (scores.F3C || 0)
  const f4 = (scores.F4A || 0) + (scores.F4B || 0)
  const f5 = Math.max(0, (scores.F5A || 0) + (scores.F5B || 0))
  return { f1, f2, f3, f4, f5, total: f1 + f2 + f3 + f4 + f5 }
}

/** 共振强度计算 (0-10) */
export function calculateResonance(total: number, f1: number, f2: number): number {
  let base = 1
  if (total >= 80) base = 8
  else if (total >= 70) base = 7
  else if (total >= 60) base = 6
  else if (total >= 55) base = 5
  else if (total >= 45) base = 4
  else if (total >= 35) base = 3
  else if (total >= 25) base = 2

  const doubleResonance = f1 >= 28 && f2 >= 18 ? 1 : 0
  const jingqiBonus = f1 >= 35 ? 1 : 0

  return Math.min(10, base + doubleResonance + jingqiBonus)
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
  const { sectorCode, sectorName, scoreDate, subScores, poolStocks, analysisReport, modelUsed = 'rotation-v3.1' } = input

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
    poolStocks: poolStocks ?? [],
    analysisReport,
    modelUsed,
    createdAt: new Date().toISOString(),
  }
}
