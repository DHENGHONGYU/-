/**
 * @module services/skills/riskStopLossSkill
 * @description S-15 风控止损 SKILL（Batch E 交易集成）
 *
 * 基于 riskEngine 的纯函数 checkOrderRiskPure 进行订单级风控检查，
 * 输出是否可执行、警告/阻断项、风险等级与止损建议。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { checkOrderRiskPure, type OrderRiskInput, type RiskCheckResult } from '@/services/trading/riskEngine'
import type { Order } from '@/data/types'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

const logger = getLogger()

/**
 * RiskStopLossInputSchema
 */
export const RiskStopLossInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 待检查订单 */
    order: z.object({
      direction: z.enum(['buy', 'sell', 'hold', 'watch']),
      price: z.number(),
      quantity: z.number().int().min(1),
      portfolioValue: z.number(),
      source: z.enum(['mcp', 'manual', 'strategy']).optional(),
    }),
    /** 当前订单列表（可选，默认空数组） */
    orders: z.array(z.record(z.string(), z.unknown())).optional(),
    /** 行情快照（可选） */
    quotes: z.object({ updatedAt: z.number() }).optional(),
  }).optional(),
})

export type RiskStopLossInput = z.infer<typeof RiskStopLossInputSchema>

/**
 * RiskStopLossOutputSchema
 */
export const RiskStopLossOutputSchema = z.object({
  /** 是否通过风控检查 */
  ok: z.boolean(),
  /** 警告项 */
  warnings: z.array(z.string()),
  /** 阻断项 */
  blocks: z.array(z.string()),
  /** 风险等级 */
  riskLevel: z.enum(['low', 'medium', 'high', 'blocked']),
  /** 通过的检查项 */
  passedChecks: z.array(z.string()),
  /** 止损建议（卖出场景） */
  stopLossSuggestion: z.object({
    /** 是否建议止损 */
    suggested: z.boolean(),
    /** 止损类型 */
    type: z.enum(['fixed', 'trailing', 'none']).optional(),
    /** 参考止损价 */
    stopPrice: z.number().optional(),
    /** 建议理由 */
    rationale: z.string().optional(),
  }),
})

export type RiskStopLossOutput = z.infer<typeof RiskStopLossOutputSchema>

function isValidOrderDirection(value: string): value is OrderRiskInput['direction'] {
  return value === 'buy' || value === 'sell'
}

function normalizeOrders(value: unknown[]): Order[] {
  return value.filter((o) => {
    if (typeof o !== 'object' || o === null) return false
    const order = o as Partial<Order>
    return (
      typeof order.symbol === 'string' &&
      typeof order.direction === 'string' &&
      typeof order.quantity === 'number' &&
      typeof order.price === 'number'
    )
  }) as Order[]
}

function determineRiskLevel(result: RiskCheckResult): RiskStopLossOutput['riskLevel'] {
  if (!result.ok || result.blocks.length > 0) return 'blocked'
  if (result.warnings.length >= 2) return 'high'
  if (result.warnings.length === 1) return 'medium'
  return 'low'
}

function buildPassedChecks(result: RiskCheckResult, input: OrderRiskInput): string[] {
  const checks: string[] = []
  if (input.price > 0 && input.quantity > 0 && Number.isFinite(input.price * input.quantity)) {
    checks.push('price-quantity-valid')
  }
  if (input.portfolioValue > 0) checks.push('portfolio-value-valid')
  if (!result.blocks.some((b) => b.includes('行情数据'))) checks.push('market-data-freshness')
  if (!result.blocks.some((b) => b.includes('冷却期'))) checks.push('symbol-cooldown-passed')
  if (!result.blocks.some((b) => b.includes('交易次数'))) checks.push('daily-trade-limit-passed')
  if (input.direction === 'buy' && !result.blocks.some((b) => b.includes('仓位'))) {
    checks.push('position-limit-passed')
  }
  if (input.direction === 'sell' && !result.blocks.some((b) => b.includes('超过当前持仓'))) {
    checks.push('holding-sufficient')
  }
  return checks
}

function buildStopLossSuggestion(input: OrderRiskInput): RiskStopLossOutput['stopLossSuggestion'] {
  if (input.direction !== 'buy' || input.price <= 0) {
    return { suggested: false, type: 'none', rationale: '非买入场景，无需建仓止损建议' }
  }
  // 买入后的固定止损参考价：成本价回撤 7%
  const stopPrice = input.price * 0.93
  return {
    suggested: true,
    type: 'fixed',
    stopPrice,
    rationale: `建议买入后以成本价 ${input.price.toFixed(2)} 回撤 7% 作为初始止损线，止损参考价 ${stopPrice.toFixed(2)}`,
  }
}

/**
 * executeRiskStopLossSkill
 */
export async function executeRiskStopLossSkill(
  ctx: SkillContext,
): Promise<SkillResult<RiskStopLossOutput>> {
  const startedAt = Date.now()
  const params = ctx.params ?? {}
  const orderCandidate = params.order
  const ordersCandidate = params.orders
  const quotesCandidate = params.quotes

  logger.info('[riskStopLossSkill] 开始风控检查', {
    symbol: ctx.symbol,
    hasOrder: !!orderCandidate,
    hasOrders: Array.isArray(ordersCandidate),
    hasQuotes: !!quotesCandidate,
  })

  if (typeof orderCandidate !== 'object' || orderCandidate === null || Array.isArray(orderCandidate)) {
    return {
      skillId: riskStopLossSkill.name,
      status: 'failed',
      evidence: [],
      error: '缺少订单参数（params.order）',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const rawOrder = orderCandidate as Partial<NonNullable<RiskStopLossInput['params']>['order']>
  const direction = rawOrder.direction

  if (!direction || !isValidOrderDirection(direction)) {
    return {
      skillId: riskStopLossSkill.name,
      status: 'failed',
      evidence: [],
      error: `不支持的交易方向: ${direction}，仅支持 buy/sell`,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  if (
    rawOrder.price === undefined ||
    rawOrder.quantity === undefined ||
    rawOrder.portfolioValue === undefined
  ) {
    return {
      skillId: riskStopLossSkill.name,
      status: 'failed',
      evidence: [],
      error: '订单参数不完整：price、quantity、portfolioValue 均为必填',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  try {
    const orderInput: OrderRiskInput = {
      symbol: ctx.symbol,
      direction,
      price: rawOrder.price,
      quantity: rawOrder.quantity,
      portfolioValue: rawOrder.portfolioValue,
      source: rawOrder.source,
    }

    const orders = Array.isArray(ordersCandidate) ? normalizeOrders(ordersCandidate) : []
    const quotes = quotesCandidate as { updatedAt: number } | undefined

    const result = checkOrderRiskPure(orderInput, orders, quotes)
    const riskLevel = determineRiskLevel(result)
    const passedChecks = buildPassedChecks(result, orderInput)
    const stopLossSuggestion = buildStopLossSuggestion(orderInput)

    const output: RiskStopLossOutput = {
      ok: result.ok,
      warnings: result.warnings,
      blocks: result.blocks,
      riskLevel,
      passedChecks,
      stopLossSuggestion,
    }

    logger.info('[riskStopLossSkill] 风控检查完成', {
      symbol: ctx.symbol,
      ok: output.ok,
      riskLevel: output.riskLevel,
      blockCount: output.blocks.length,
      warningCount: output.warnings.length,
    })

    return {
      skillId: riskStopLossSkill.name,
      status: result.ok ? 'success' : 'blocked',
      data: output,
      evidence: [
        'risk-engine',
        `riskLevel:${output.riskLevel}`,
        `passedChecks:${output.passedChecks.length}`,
      ],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[riskStopLossSkill] 风控检查失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: riskStopLossSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

/**
 * riskStopLossSkill
 */
export const riskStopLossSkill: SkillDefinition<RiskStopLossOutput> = {
  name: 'risk-stop-loss',
  title: '风控止损',
  description: '基于订单、持仓与行情快照执行风控检查并给出止损建议',
  inputSchema: RiskStopLossInputSchema,
  outputSchema: RiskStopLossOutputSchema,
  executor: executeRiskStopLossSkill,
  requiresLlm: false,
  version: '1.0.0',
}
