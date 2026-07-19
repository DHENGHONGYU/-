/**
 * @module services/skills/entrySignalSkill
 * @description S-13 入场信号 SKILL（Batch E 交易集成）
 *
 * 基于 signalGenerator 的纯函数生成买入/入场信号，并挑选最强信号。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { buildSnapshot, generateBuySignals, type TradingSignal } from '@/services/trading/signalGenerator'
import type { DailyQuotes, Stock } from '@/data/types'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

const logger = getLogger()

const SignalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  direction: z.enum(['buy', 'sell', 'hold', 'watch']),
  type: z.string(),
  strategy: z.string(),
  confidence: z.number(),
  rationale: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
})

/**
 * EntrySignalInputSchema
 */
export const EntrySignalInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 股票基础数据 */
    stock: z.record(z.string(), z.unknown()),
    /** 日线行情数据 */
    quotes: z.record(z.string(), z.unknown()),
  }).optional(),
})

export type EntrySignalInput = z.infer<typeof EntrySignalInputSchema>

/**
 * EntrySignalOutputSchema
 */
export const EntrySignalOutputSchema = z.object({
  /** 最强买入信号 */
  strongestSignal: SignalSchema,
  /** 所有买入信号（按置信度降序） */
  signals: z.array(SignalSchema),
  /** 技术指标快照 */
  snapshot: z.record(z.string(), z.unknown()),
  /** 买入信号数量 */
  signalCount: z.number().int().min(0),
})

export type EntrySignalOutput = z.infer<typeof EntrySignalOutputSchema>

function isValidQuotes(value: unknown): value is DailyQuotes {
  if (typeof value !== 'object' || value === null) return false
  const q = value as Partial<DailyQuotes>
  return (
    typeof q.symbol === 'string' &&
    q.latest !== undefined &&
    Array.isArray(q.history) &&
    q.history.length > 0
  )
}

function isValidStock(value: unknown): value is Stock {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Partial<Stock>
  return typeof s.symbol === 'string' && typeof s.name === 'string'
}

function pickStrongestEntrySignal(signals: TradingSignal[]): TradingSignal | undefined {
  if (signals.length === 0) return undefined
  return signals
    .filter((s) => s.direction === 'buy')
    .sort((a, b) => b.confidence - a.confidence)[0]
}

function normalizeSignal(signal: TradingSignal): z.infer<typeof SignalSchema> {
  return {
    ...signal,
    snapshot: signal.snapshot as Record<string, unknown>,
  }
}

/**
 * executeEntrySignalSkill
 */
export async function executeEntrySignalSkill(
  ctx: SkillContext,
): Promise<SkillResult<EntrySignalOutput>> {
  const startedAt = Date.now()
  const params = ctx.params ?? {}
  const stockCandidate = params.stock
  const quotesCandidate = params.quotes

  logger.info('[entrySignalSkill] 开始生成入场信号', {
    symbol: ctx.symbol,
    hasStock: !!stockCandidate,
    hasQuotes: !!quotesCandidate,
  })

  if (!isValidStock(stockCandidate)) {
    return {
      skillId: entrySignalSkill.name,
      status: 'failed',
      evidence: [],
      error: '缺少合法的股票基础数据（stock）',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  if (!isValidQuotes(quotesCandidate)) {
    return {
      skillId: entrySignalSkill.name,
      status: 'failed',
      evidence: [],
      error: '缺少合法的日线行情数据（quotes）或历史数据为空',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  try {
    const stock = stockCandidate
    const quotes = quotesCandidate

    if (quotes.history.length < 20) {
      return {
        skillId: entrySignalSkill.name,
        status: 'failed',
        evidence: [],
        error: `历史 K 线数据不足，至少需要 20 条，当前 ${quotes.history.length} 条`,
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }

    const snapshot = buildSnapshot(stock, quotes)
    const rawSignals = generateBuySignals(snapshot).map((s) => ({
      ...s,
      id: s.id || `entry-${ctx.symbol}-${Date.now()}`,
      symbol: s.symbol || ctx.symbol,
      createdAt: s.createdAt || Date.now(),
    }))
    const signals = rawSignals.map(normalizeSignal)

    const strongest = pickStrongestEntrySignal(rawSignals)

    if (!strongest) {
      return {
        skillId: entrySignalSkill.name,
        status: 'success',
        data: {
          strongestSignal: {
            id: `hold-${ctx.symbol}-${Date.now()}`,
            symbol: ctx.symbol,
            direction: 'hold',
            type: 'hold',
            strategy: 'signal',
            confidence: 0.15,
            rationale: '未触发任何买入信号，建议持有/观望',
            snapshot: snapshot as Record<string, unknown>,
            createdAt: Date.now(),
          },
          signals: [],
          snapshot: snapshot as Record<string, unknown>,
          signalCount: 0,
        },
        evidence: ['signal-generator', 'no-entry-signal'],
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }

    const output: EntrySignalOutput = {
      strongestSignal: normalizeSignal(strongest),
      signals: signals.sort((a, b) => b.confidence - a.confidence),
      snapshot: snapshot as Record<string, unknown>,
      signalCount: signals.length,
    }

    logger.info('[entrySignalSkill] 入场信号生成完成', {
      symbol: ctx.symbol,
      signalCount: output.signalCount,
      strongestType: output.strongestSignal.type,
      confidence: output.strongestSignal.confidence,
    })

    return {
      skillId: entrySignalSkill.name,
      status: 'success',
      data: output,
      evidence: [
        'signal-generator',
        `strongest:${output.strongestSignal.type}`,
        `confidence:${output.strongestSignal.confidence}`,
      ],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[entrySignalSkill] 入场信号生成失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: entrySignalSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

/**
 * entrySignalSkill
 */
export const entrySignalSkill: SkillDefinition<EntrySignalOutput> = {
  name: 'entry-signal',
  title: '入场信号',
  description: '基于技术指标生成买入信号并挑选最强入场信号',
  inputSchema: EntrySignalInputSchema,
  outputSchema: EntrySignalOutputSchema,
  executor: executeEntrySignalSkill,
  requiresLlm: false,
  version: '1.0.0',
}
