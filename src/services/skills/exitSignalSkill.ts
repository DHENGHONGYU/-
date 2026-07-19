/**
 * @module services/skills/exitSignalSkill
 * @description S-14 出场信号 SKILL（Batch E 交易集成）
 *
 * 基于 signalGenerator 的纯函数生成卖出/出场信号，并附加固定止损与移动止损建议。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { buildSnapshot, generateSellSignals, type TradingSignal } from '@/services/trading/signalGenerator'
import { getEffectiveTradingConfig } from '@/config/tradingConfig'
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
 * ExitSignalInputSchema
 */
export const ExitSignalInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 股票基础数据 */
    stock: z.record(z.string(), z.unknown()),
    /** 日线行情数据 */
    quotes: z.record(z.string(), z.unknown()),
    /** 持仓成本价（用于固定止损计算） */
    costPrice: z.number().positive().optional(),
  }).optional(),
})

export type ExitSignalInput = z.infer<typeof ExitSignalInputSchema>

/**
 * ExitSignalOutputSchema
 */
export const ExitSignalOutputSchema = z.object({
  /** 最强卖出信号 */
  strongestSignal: SignalSchema,
  /** 所有卖出信号（按置信度降序） */
  signals: z.array(SignalSchema),
  /** 技术指标快照 */
  snapshot: z.record(z.string(), z.unknown()),
  /** 卖出信号数量 */
  signalCount: z.number().int().min(0),
  /** 止损建议 */
  stopLossSuggestion: z.object({
    /** 是否触发止损 */
    triggered: z.boolean(),
    /** 止损类型：固定止损 / 移动止损 / 无 */
    type: z.enum(['fixed', 'trailing', 'none']).optional(),
    /** 建议止损价 */
    stopPrice: z.number().optional(),
    /** 触发理由 */
    rationale: z.string().optional(),
  }),
})

export type ExitSignalOutput = z.infer<typeof ExitSignalOutputSchema>

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

function pickStrongestExitSignal(signals: TradingSignal[]): TradingSignal | undefined {
  if (signals.length === 0) return undefined
  return signals
    .filter((s) => s.direction === 'sell')
    .sort((a, b) => b.confidence - a.confidence)[0]
}

function normalizeSignal(signal: TradingSignal): z.infer<typeof SignalSchema> {
  return {
    ...signal,
    snapshot: signal.snapshot as Record<string, unknown>,
  }
}

function calculateStopLossSuggestion(
  quotes: DailyQuotes,
  costPrice?: number,
): ExitSignalOutput['stopLossSuggestion'] {
  const config = getEffectiveTradingConfig().signalThresholds
  const latest = quotes.latest.close

  // 移动止损：从近期高点回撤达到阈值
  const recentHistory = quotes.history.slice(-60)
  const highest = recentHistory.length > 0 ? Math.max(...recentHistory.map((bar) => bar.high)) : latest
  const trailingStopPrice = highest * (1 - config.trailingStopDrawdownPct / 100)
  const trailingTriggered = latest <= trailingStopPrice

  // 固定止损：从成本价回撤达到阈值
  const fixedStopPrice = costPrice !== undefined ? costPrice * (1 - config.fixedStopLossPct / 100) : undefined
  const fixedTriggered = fixedStopPrice !== undefined && latest <= fixedStopPrice

  if (fixedTriggered && trailingTriggered) {
    return {
      triggered: true,
      type: 'fixed',
      stopPrice: fixedStopPrice,
      rationale: `价格 ${latest.toFixed(2)} 同时触发固定止损（成本价回撤 ${config.fixedStopLossPct}%）与移动止损（高点回撤 ${config.trailingStopDrawdownPct}%）`,
    }
  }

  if (fixedTriggered) {
    return {
      triggered: true,
      type: 'fixed',
      stopPrice: fixedStopPrice,
      rationale: `价格 ${latest.toFixed(2)} 触发固定止损：成本价 ${costPrice!.toFixed(2)} 回撤 ${config.fixedStopLossPct}%`,
    }
  }

  if (trailingTriggered) {
    return {
      triggered: true,
      type: 'trailing',
      stopPrice: trailingStopPrice,
      rationale: `价格 ${latest.toFixed(2)} 触发移动止损：从近期高点 ${highest.toFixed(2)} 回撤 ${config.trailingStopDrawdownPct}%`,
    }
  }

  return {
    triggered: false,
    type: 'none',
    rationale: `未触发止损：最新价 ${latest.toFixed(2)}，移动止损价 ${trailingStopPrice.toFixed(2)}${fixedStopPrice !== undefined ? `，固定止损价 ${fixedStopPrice.toFixed(2)}` : ''}`,
  }
}

/**
 * executeExitSignalSkill
 */
export async function executeExitSignalSkill(
  ctx: SkillContext,
): Promise<SkillResult<ExitSignalOutput>> {
  const startedAt = Date.now()
  const params = ctx.params ?? {}
  const stockCandidate = params.stock
  const quotesCandidate = params.quotes
  const costPrice = params.costPrice as number | undefined

  logger.info('[exitSignalSkill] 开始生成出场信号', {
    symbol: ctx.symbol,
    hasStock: !!stockCandidate,
    hasQuotes: !!quotesCandidate,
    costPrice,
  })

  if (!isValidStock(stockCandidate)) {
    return {
      skillId: exitSignalSkill.name,
      status: 'failed',
      evidence: [],
      error: '缺少合法的股票基础数据（stock）',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  if (!isValidQuotes(quotesCandidate)) {
    return {
      skillId: exitSignalSkill.name,
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
        skillId: exitSignalSkill.name,
        status: 'failed',
        evidence: [],
        error: `历史 K 线数据不足，至少需要 20 条，当前 ${quotes.history.length} 条`,
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }

    const snapshot = buildSnapshot(stock, quotes)
    const rawSignals = generateSellSignals(snapshot, quotes.history).map((s) => ({
      ...s,
      id: s.id || `exit-${ctx.symbol}-${Date.now()}`,
      symbol: s.symbol || ctx.symbol,
      createdAt: s.createdAt || Date.now(),
    }))
    const signals = rawSignals.map(normalizeSignal)

    const strongest = pickStrongestExitSignal(rawSignals)
    const stopLossSuggestion = calculateStopLossSuggestion(quotes, costPrice)

    if (!strongest) {
      return {
        skillId: exitSignalSkill.name,
        status: 'success',
        data: {
          strongestSignal: {
            id: `hold-${ctx.symbol}-${Date.now()}`,
            symbol: ctx.symbol,
            direction: 'hold',
            type: 'hold',
            strategy: 'signal',
            confidence: 0.15,
            rationale: '未触发任何卖出信号，建议持有/观望',
            snapshot: snapshot as Record<string, unknown>,
            createdAt: Date.now(),
          },
          signals: [],
          snapshot: snapshot as Record<string, unknown>,
          signalCount: 0,
          stopLossSuggestion,
        },
        evidence: ['signal-generator', 'no-exit-signal'],
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }

    const output: ExitSignalOutput = {
      strongestSignal: normalizeSignal(strongest),
      signals: signals.sort((a, b) => b.confidence - a.confidence),
      snapshot: snapshot as Record<string, unknown>,
      signalCount: signals.length,
      stopLossSuggestion,
    }

    logger.info('[exitSignalSkill] 出场信号生成完成', {
      symbol: ctx.symbol,
      signalCount: output.signalCount,
      strongestType: output.strongestSignal.type,
      confidence: output.strongestSignal.confidence,
      stopLossTriggered: output.stopLossSuggestion.triggered,
    })

    return {
      skillId: exitSignalSkill.name,
      status: 'success',
      data: output,
      evidence: [
        'signal-generator',
        `strongest:${output.strongestSignal.type}`,
        `confidence:${output.strongestSignal.confidence}`,
        `stopLoss:${output.stopLossSuggestion.triggered ? 'triggered' : 'none'}`,
      ],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[exitSignalSkill] 出场信号生成失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: exitSignalSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

/**
 * exitSignalSkill
 */
export const exitSignalSkill: SkillDefinition<ExitSignalOutput> = {
  name: 'exit-signal',
  title: '出场信号',
  description: '基于技术指标生成卖出信号并附加止损建议',
  inputSchema: ExitSignalInputSchema,
  outputSchema: ExitSignalOutputSchema,
  executor: executeExitSignalSkill,
  requiresLlm: false,
  version: '1.0.0',
}
