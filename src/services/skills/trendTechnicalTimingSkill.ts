/**
 * @module services/skills/trendTechnicalTimingSkill
 * @description S-12 趋势股技术分析择时 SKILL（Batch B 确定性计算）
 *
 * 增强技术分析维度：ADX 趋势强度、多周期动量、均线排列、量能确认，
 * 输出趋势股择时信号与风险提示。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

const logger = getLogger()

/**
 * TrendTechnicalTimingInputSchema
 */
export const TrendTechnicalTimingInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 收盘价序列（由旧到新） */
    closeHistory: z.array(z.number()),
    /** 成交量序列（可选，用于量能确认） */
    volumeHistory: z.array(z.number()).optional(),
    /** 自定义 ADX 周期 */
    adxPeriod: z.number().int().positive().optional(),
    /** 自定义动量周期 */
    momentumPeriods: z.array(z.number().int().positive()).optional(),
  }).optional(),
})

export type TrendTechnicalTimingInput = z.infer<typeof TrendTechnicalTimingInputSchema>

const TimingSignal = z.enum(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'])

/**
 * TrendTechnicalTimingOutputSchema
 */
export const TrendTechnicalTimingOutputSchema = z.object({
  trendStrength: z.number().min(0).max(100),
  trendDirection: z.enum(['up', 'down', 'sideways']),
  adx: z.number(),
  diPlus: z.number(),
  diMinus: z.number(),
  momentum: z.object({
    m5: z.number(),
    m10: z.number(),
    m20: z.number(),
    m60: z.number().optional(),
  }),
  movingAverages: z.object({
    ma5: z.number(),
    ma20: z.number(),
    ma60: z.number().optional(),
  }),
  volumeConfirmation: z.boolean(),
  signal: TimingSignal,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  evidence: z.array(z.string()),
})

export type TrendTechnicalTimingOutput = z.infer<typeof TrendTechnicalTimingOutputSchema>

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function wilderSmooth(values: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(0)
    } else if (i === period) {
      result.push(mean(values.slice(1, period + 1)))
    } else {
      result.push(result[i - 1]! * (period - 1) / period + values[i]! / period)
    }
  }
  return result
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number): { adx: number; diPlus: number; diMinus: number } {
  const tr: number[] = [0]
  const dmPlus: number[] = [0]
  const dmMinus: number[] = [0]

  for (let i = 1; i < closes.length; i++) {
    const high = highs[i]!
    const prevHigh = highs[i - 1]!
    const low = lows[i]!
    const prevLow = lows[i - 1]!
    const prevClose = closes[i - 1]!

    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
    dmPlus.push(high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0)
    dmMinus.push(prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0)
  }

  const atr = wilderSmooth(tr, period)
  const smoothedDmPlus = wilderSmooth(dmPlus, period)
  const smoothedDmMinus = wilderSmooth(dmMinus, period)

  const diPlusValues: number[] = []
  const diMinusValues: number[] = []
  const dxValues: number[] = []

  for (let i = 0; i < closes.length; i++) {
    const atrVal = atr[i]!
    if (atrVal === 0 || i < period) {
      diPlusValues.push(0)
      diMinusValues.push(0)
      dxValues.push(0)
      continue
    }
    const dip = 100 * smoothedDmPlus[i]! / atrVal
    const dim = 100 * smoothedDmMinus[i]! / atrVal
    diPlusValues.push(dip)
    diMinusValues.push(dim)
    const dx = Math.abs(dip - dim) / (dip + dim) * 100
    dxValues.push(Number.isNaN(dx) ? 0 : dx)
  }

  const adxValues = wilderSmooth(dxValues, period)
  const lastIdx = closes.length - 1

  return {
    adx: adxValues[lastIdx] ?? 0,
    diPlus: diPlusValues[lastIdx] ?? 0,
    diMinus: diMinusValues[lastIdx] ?? 0,
  }
}

function calculateMomentum(closes: number[], periods: number[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const p of periods) {
    if (closes.length > p) {
      const current = closes[closes.length - 1]!
      const past = closes[closes.length - 1 - p]!
      result[`m${p}`] = past !== 0 ? (current - past) / past : 0
    } else {
      result[`m${p}`] = 0
    }
  }
  return result
}

function calculateMA(closes: number[], periods: number[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const p of periods) {
    if (closes.length >= p) {
      result[`ma${p}`] = mean(closes.slice(-p))
    } else {
      result[`ma${p}`] = mean(closes)
    }
  }
  return result
}

function volumeConfirmed(
  volumes: number[] | undefined,
  lookback: number,
): boolean {
  if (!volumes || volumes.length < lookback + 1) return false
  const recent = volumes.slice(-lookback)
  const prev = volumes.slice(-lookback * 2, -lookback)
  const recentAvg = mean(recent)
  const prevAvg = mean(prev)
  return prevAvg > 0 && recentAvg > prevAvg * 1.1
}

function resolveStrongTrend(
  adx: number,
  diPlus: number,
  diMinus: number,
  m5Positive: boolean,
  m20Positive: boolean,
  bullishArrangement: boolean,
  bearishArrangement: boolean,
  volumeConfirmation: boolean,
): { signal: TrendTechnicalTimingOutput['signal']; confidence: number; rationale: string } | null {
  if (diPlus > diMinus && m5Positive && m20Positive && bullishArrangement) {
    return {
      signal: volumeConfirmation ? 'strong_buy' : 'buy',
      confidence: volumeConfirmation ? 0.85 : 0.7,
      rationale: `ADX ${adx.toFixed(1)} 强势，DI+ 领先，多周期动量向上，均线多头排列${volumeConfirmation ? '，量能配合' : ''}`,
    }
  }
  if (diMinus > diPlus && !m5Positive && !m20Positive && bearishArrangement) {
    return {
      signal: volumeConfirmation ? 'strong_sell' : 'sell',
      confidence: volumeConfirmation ? 0.85 : 0.7,
      rationale: `ADX ${adx.toFixed(1)} 强势，DI- 领先，多周期动量向下，均线空头排列${volumeConfirmation ? '，量能配合' : ''}`,
    }
  }
  return null
}

function resolveFormingTrend(
  adx: number,
  diPlus: number,
  diMinus: number,
  m5Positive: boolean,
  bullishArrangement: boolean,
  bearishArrangement: boolean,
): { signal: TrendTechnicalTimingOutput['signal']; confidence: number; rationale: string } | null {
  if (diPlus > diMinus && m5Positive && bullishArrangement) {
    return { signal: 'buy', confidence: 0.6, rationale: `ADX ${adx.toFixed(1)} 趋势形成中，偏多信号` }
  }
  if (diMinus > diPlus && !m5Positive && bearishArrangement) {
    return { signal: 'sell', confidence: 0.6, rationale: `ADX ${adx.toFixed(1)} 趋势形成中，偏空信号` }
  }
  return null
}

function determineSignal(
  adx: number,
  diPlus: number,
  diMinus: number,
  momentum: Record<string, number>,
  ma: Record<string, number>,
  volumeConfirmation: boolean,
): { signal: TrendTechnicalTimingOutput['signal']; confidence: number; rationale: string } {
  const trendStrong = adx > 25
  const trendWeak = adx < 20
  const m5Positive = (momentum.m5 ?? 0) > 0
  const m20Positive = (momentum.m20 ?? 0) > 0

  // 多头排列：MA5 > MA20
  const bullishArrangement = ma.ma5 !== undefined && ma.ma20 !== undefined && ma.ma5 > ma.ma20
  const bearishArrangement = ma.ma5 !== undefined && ma.ma20 !== undefined && ma.ma5 < ma.ma20

  const signal: TrendTechnicalTimingOutput['signal'] = 'hold'
  const confidence = 0.5
  const rationale = '趋势与动量信号中性，维持观望'

  if (trendStrong) {
    const strong = resolveStrongTrend(
      adx, diPlus, diMinus, m5Positive, m20Positive, bullishArrangement, bearishArrangement, volumeConfirmation,
    )
    if (strong) return strong
    return { signal, confidence: 0.5, rationale: '趋势与动量信号中性，维持观望' }
  }
  if (trendWeak) {
    return { signal, confidence: 0.5, rationale: `ADX ${adx.toFixed(1)} 偏弱，趋势不明，建议观望` }
  }
  // 20 <= ADX <= 25，趋势形成中
  const forming = resolveFormingTrend(adx, diPlus, diMinus, m5Positive, bullishArrangement, bearishArrangement)
  if (forming) return forming
  return { signal, confidence, rationale }
}

/**
 * executeTrendTechnicalTimingSkill
 */
export async function executeTrendTechnicalTimingSkill(
  ctx: SkillContext,
): Promise<SkillResult<TrendTechnicalTimingOutput>> {
  const startedAt = Date.now()
  const params = ctx.params ?? {}
  const closeHistory = params.closeHistory as number[] | undefined
  const volumeHistory = params.volumeHistory as number[] | undefined
  const adxPeriod = (params.adxPeriod as number | undefined) ?? 14
  const momentumPeriods = (params.momentumPeriods as number[] | undefined) ?? [5, 10, 20, 60]

  logger.info('[trendTechnicalTimingSkill] 开始趋势技术分析择时', {
    symbol: ctx.symbol,
    historyLength: closeHistory?.length,
    adxPeriod,
  })

  if (!closeHistory || closeHistory.length < Math.max(adxPeriod, 20) + 5) {
    return {
      skillId: trendTechnicalTimingSkill.name,
      status: 'failed',
      evidence: [],
      error: `收盘价历史数据不足，至少需要 ${Math.max(adxPeriod, 20) + 5} 条`,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  try {
    // 由于没有真实 high/low，用 close 作为 high/low 代理（简化版 ADX）
    const highs = closeHistory
    const lows = closeHistory
    const closes = closeHistory

    const { adx, diPlus, diMinus } = calculateADX(highs, lows, closes, adxPeriod)
    const momentum = calculateMomentum(closes, momentumPeriods)
    const ma = calculateMA(closes, [5, 20, 60])
    const volumeConfirmation = volumeConfirmed(volumeHistory, 5)

    const latestClose = closes[closes.length - 1]!
    const ma5 = ma.ma5 ?? latestClose
    const ma20 = ma.ma20 ?? latestClose
    const ma60 = ma.ma60

    const { signal, confidence, rationale } = determineSignal(
      adx, diPlus, diMinus, momentum, ma, volumeConfirmation,
    )

    const trendDirection: TrendTechnicalTimingOutput['trendDirection'] =
      diPlus > diMinus + 5 ? 'up' : diMinus > diPlus + 5 ? 'down' : 'sideways'

    const output: TrendTechnicalTimingOutput = {
      trendStrength: Math.round(Math.min(100, Math.max(0, adx))),
      trendDirection,
      adx: Math.round(adx * 100) / 100,
      diPlus: Math.round(diPlus * 100) / 100,
      diMinus: Math.round(diMinus * 100) / 100,
      momentum: {
        m5: Math.round((momentum.m5 ?? 0) * 10000) / 10000,
        m10: Math.round((momentum.m10 ?? 0) * 10000) / 10000,
        m20: Math.round((momentum.m20 ?? 0) * 10000) / 10000,
        m60: momentum.m60 !== undefined ? Math.round(momentum.m60 * 10000) / 10000 : undefined,
      },
      movingAverages: {
        ma5: Math.round(ma5 * 100) / 100,
        ma20: Math.round(ma20 * 100) / 100,
        ma60: ma60 !== undefined ? Math.round(ma60 * 100) / 100 : undefined,
      },
      volumeConfirmation,
      signal,
      confidence: Math.round(confidence * 100) / 100,
      rationale,
      evidence: [
        `ADX=${adx.toFixed(2)}`,
        `DI+=${diPlus.toFixed(2)}, DI-=${diMinus.toFixed(2)}`,
        `MA5=${ma5.toFixed(2)}, MA20=${ma20.toFixed(2)}`,
        `M5=${(momentum.m5 ?? 0).toFixed(4)}, M20=${(momentum.m20 ?? 0).toFixed(4)}`,
        `量能确认: ${volumeConfirmation ? '是' : '否'}`,
      ],
    }

    logger.info('[trendTechnicalTimingSkill] 趋势技术分析择时完成', {
      symbol: ctx.symbol,
      adx: output.adx,
      signal: output.signal,
      confidence: output.confidence,
      trendDirection: output.trendDirection,
    })

    return {
      skillId: trendTechnicalTimingSkill.name,
      status: 'success',
      data: output,
      evidence: output.evidence,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[trendTechnicalTimingSkill] 择时计算失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: trendTechnicalTimingSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

/**
 * trendTechnicalTimingSkill
 */
export const trendTechnicalTimingSkill: SkillDefinition<TrendTechnicalTimingOutput> = {
  name: 'trend-technical-timing',
  title: '趋势股技术分析择时',
  description: '基于 ADX、多周期动量、均线排列与量能确认生成趋势股择时信号',
  inputSchema: TrendTechnicalTimingInputSchema,
  outputSchema: TrendTechnicalTimingOutputSchema,
  executor: executeTrendTechnicalTimingSkill,
  requiresLlm: false,
  version: '1.0.0',
}
