/**
 * @module services/skills/positionManagementSkill
 * @description S-02 仓位管理 SKILL（Batch E 交易集成）
 *
 * 基于 Kelly 公式与风控约束计算目标仓位，将底层 positionSizer 包装为
 * SkillRegistry 可复用的 SKILL。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { calculatePosition, type PositionSizingInput, type PositionSizingResult } from '@/services/trading/positionSizer'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

const logger = getLogger()

export const PositionManagementInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 交易方向 */
    direction: z.enum(['buy', 'sell', 'hold', 'watch']),
    /** 当前价格 */
    price: z.number(),
    /** 组合净值 */
    portfolioValue: z.number(),
    /** 当前持仓股数 */
    currentHoldingShares: z.number().int().min(0).optional(),
    /** 当前持仓市值 */
    currentHoldingValue: z.number().min(0).optional(),
    /** 当前总仓位市值 */
    currentTotalPositionValue: z.number().min(0).optional(),
    /** 胜率（可选） */
    winRate: z.number().min(0).max(1).optional(),
    /** 盈亏比（可选） */
    profitLossRatio: z.number().positive().optional(),
  }).optional(),
})

export type PositionManagementInput = z.infer<typeof PositionManagementInputSchema>

export const PositionManagementOutputSchema = z.object({
  action: z.enum(['buy', 'sell', 'hold']),
  targetShares: z.number().int().min(0),
  targetValue: z.number().min(0),
  positionPct: z.number().min(0).max(1),
  kellyPct: z.number(),
  roundedDown: z.boolean(),
  cappedBy: z.enum(['single', 'total', 'min', 'max', 'none']),
  rationale: z.string(),
})

export type PositionManagementOutput = z.infer<typeof PositionManagementOutputSchema>

function buildRationale(output: PositionSizingResult, symbol: string): string {
  if (output.action === 'hold') {
    if (output.cappedBy === 'min') {
      return `${symbol} 计算后目标仓位低于最小阈值，建议持有/观望`
    }
    if (output.cappedBy === 'single') {
      return `${symbol} 已接近单笔仓位上限，建议持有`
    }
    if (output.cappedBy === 'total') {
      return `${symbol} 已接近总仓位上限，建议持有`
    }
    return `${symbol} 当前不建议开仓，建议持有/观望`
  }

  if (output.action === 'sell') {
    return `${symbol} 卖出信号：建议清仓 ${output.targetShares} 股（市值 ${output.targetValue.toFixed(0)}）`
  }

  const parts = [
    `${symbol} 买入信号：目标 ${output.targetShares} 股，市值 ${output.targetValue.toFixed(0)}`,
    `仓位占比 ${(output.positionPct * 100).toFixed(2)}%`,
    `Kelly 比例 ${(output.kellyPct * 100).toFixed(2)}%`,
  ]
  if (output.cappedBy !== 'none') {
    parts.push(`受 ${output.cappedBy} 上限约束`)
  }
  if (output.roundedDown) {
    parts.push('已按整手取整')
  }
  return parts.join('，')
}

export async function executePositionManagementSkill(
  ctx: SkillContext,
): Promise<SkillResult<PositionManagementOutput>> {
  const startedAt = Date.now()
  const params = ctx.params ?? {}
  const direction = params.direction as NonNullable<PositionManagementInput['params']>['direction'] | undefined
  const price = params.price as number | undefined
  const portfolioValue = params.portfolioValue as number | undefined

  logger.info('[positionManagementSkill] 开始仓位计算', {
    symbol: ctx.symbol,
    direction,
    price,
    portfolioValue,
  })

  if (!direction || price === undefined || portfolioValue === undefined) {
    return {
      skillId: positionManagementSkill.name,
      status: 'failed',
      evidence: [],
      error: '缺少必要参数：direction、price、portfolioValue',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  try {
    const sizingInput: PositionSizingInput = {
      direction,
      price,
      portfolioValue,
      currentHoldingShares: params.currentHoldingShares as number | undefined,
      currentHoldingValue: params.currentHoldingValue as number | undefined,
      currentTotalPositionValue: params.currentTotalPositionValue as number | undefined,
      winRate: params.winRate as number | undefined,
      profitLossRatio: params.profitLossRatio as number | undefined,
    }

    const raw = calculatePosition(sizingInput)
    const output: PositionManagementOutput = {
      ...raw,
      rationale: buildRationale(raw, ctx.symbol),
    }

    logger.info('[positionManagementSkill] 仓位计算完成', {
      symbol: ctx.symbol,
      action: output.action,
      targetShares: output.targetShares,
      positionPct: output.positionPct,
      cappedBy: output.cappedBy,
    })

    return {
      skillId: positionManagementSkill.name,
      status: 'success',
      data: output,
      evidence: ['position-sizer', `action:${output.action}`, `cappedBy:${output.cappedBy}`],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[positionManagementSkill] 仓位计算失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: positionManagementSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

export const positionManagementSkill: SkillDefinition<PositionManagementOutput> = {
  name: 'position-management',
  title: '仓位管理',
  description: '基于 Kelly 公式与风控约束计算单标的建议仓位',
  inputSchema: PositionManagementInputSchema,
  outputSchema: PositionManagementOutputSchema,
  executor: executePositionManagementSkill,
  requiresLlm: false,
  version: '1.0.0',
}
