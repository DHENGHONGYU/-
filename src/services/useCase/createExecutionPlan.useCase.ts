/**
 * @module services/useCase/createExecutionPlan.useCase
 * @description 创建执行计划用例 — 从 executionStore.createPlan 提取的业务编排逻辑
 *
 * 业务流程（5步）：
 * 1. 获取股票信息（股价）用于仓位计算
 * 2. 计算当前持仓 & 仓位 sizing（Kelly 公式）
 * 3. 风控检查（阻断/警告）
 * 4. 构造 ExecutionPlan 对象
 * 5. 通过 DataBridge 持久化
 *
 * @see Clean Architecture Use Case Interactor 模式
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  STORE_NAME,
  type AccountType,
} from '@/config/dbConfig'
import type { Signal, Stock, Order, ExecutionPlan, RiskCheckItem } from '@/data/types'
import { getEffectiveTradingConfig } from '@/config/tradingConfig'
import { calculatePosition, type PositionSizingResult } from '@/services/trading/positionSizer'
import { checkOrderRisk, type RiskCheckResult } from '@/services/trading/riskEngine'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface CreateExecutionPlanInput {
  /** 交易信号 */
  readonly signal: Signal
  /** 账户类型，默认 'paper' */
  readonly accountType?: AccountType
  /** 调用来源，用于差异化风控策略 */
  readonly source?: 'mcp' | 'manual' | 'strategy'
}

export type ExecutionPlanErrorCode =
  | 'NOT_TRADE_SIGNAL'
  | 'PRICE_MISSING'
  | 'RISK_BLOCKED'
  | 'PERSISTENCE_FAILED'
  | 'UNKNOWN_ERROR'

export interface CreateExecutionPlanResult {
  /** 是否成功 */
  success: boolean
  /** 创建的执行计划（失败时为 undefined） */
  plan?: ExecutionPlan
  /** 错误信息（成功时为 undefined） */
  error?: string
  /** 错误码，便于前端分类处理 */
  errorCode?: ExecutionPlanErrorCode
}

// ============================================================
// 工具函数
// ============================================================

/** 生成执行计划 ID（使用 nanoid 避免高并发下的 ID 碰撞） */
function generatePlanId(): string {
  return `ep-${nanoid(16)}`
}

// ============================================================
// UseCase
// ============================================================

/**
 * 创建执行计划用例
 *
 * 根据交易信号获取股价、计算仓位、执行风控检查，
 * 构造 ExecutionPlan 并通过 DataBridge 持久化。
 *
 * @param input 创建参数
 * @returns 创建结果（包含 plan 或 error）
 *
 * @example
 * ```typescript
 * const result = await createExecutionPlanUseCase({
 *   signal: { id: 'sig-1', symbol: 'AAPL', direction: 'buy', confidence: 0.85 },
 *   accountType: 'paper',
 *   source: 'mcp'
 * })
 * ```
 */
export async function createExecutionPlanUseCase(
  input: CreateExecutionPlanInput,
): Promise<CreateExecutionPlanResult> {
  const { signal, accountType = 'paper' } = input
  const planId = generatePlanId()

  logger.info('[createExecutionPlanUseCase] 开始', {
    planId,
    signalId: signal.id,
    symbol: signal.symbol,
    direction: signal.direction,
    source: input.source,
  })

  // 非交易信号（hold/watch）不创建执行计划
  if (signal.direction === 'hold' || signal.direction === 'watch') {
    logger.info('[createExecutionPlanUseCase] 跳过: direction 为 hold/watch', {
      symbol: signal.symbol,
    })
    return { success: false, error: '非交易信号，不创建执行计划', errorCode: 'NOT_TRADE_SIGNAL' }
  }

  try {
    // 1. 获取股票信息用于仓位计算
    logger.info('[createExecutionPlanUseCase] 查询股票信息', { symbol: signal.symbol })
    const stockResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: signal.symbol,
      source: MODULE_ID.executionPlans,
    })
    logger.info('[createExecutionPlanUseCase] 股票信息返回', {
      symbol: signal.symbol,
      success: stockResult.success,
      hasData: !!stockResult.data,
    })

    const stock = stockResult.success ? stockResult.data : undefined
    const price = stock?.price ?? 0
    if (!stock?.price) {
      logger.warn('[createExecutionPlanUseCase] 股价缺失，使用零值', {
        symbol: stock?.symbol ?? signal.symbol,
      })
    }

    // 2. 计算仓位
    logger.info('[createExecutionPlanUseCase] 查询订单列表', { symbol: signal.symbol })
    const ordersResult = await dataBridge.query<Order[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.orders,
      source: MODULE_ID.executionPlans,
    })
    logger.info('[createExecutionPlanUseCase] 订单列表返回', {
      symbol: signal.symbol,
      success: ordersResult.success,
      count: ordersResult.success ? (ordersResult.data ?? []).length : 0,
    })

    const orders = ordersResult.success ? (ordersResult.data ?? []) : []
    const portfolioValue = getEffectiveTradingConfig().risk.portfolioValue

    const holdingShares = orders
      .filter((o) => o.symbol === signal.symbol)
      .reduce((sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity), 0)
    const holdingValue = holdingShares * price

    const totalShares = orders.reduce(
      (sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity),
      0,
    )
    const totalValue = totalShares * price

    const sizingResult: PositionSizingResult = calculatePosition({
      direction: signal.direction,
      price,
      portfolioValue,
      currentHoldingShares: holdingShares,
      currentHoldingValue: holdingValue,
      currentTotalPositionValue: totalValue,
    })

    // 3. 风控检查
    const riskResult: RiskCheckResult = await checkOrderRisk({
      symbol: signal.symbol,
      direction: signal.direction,
      quantity: sizingResult.targetShares,
      price,
      portfolioValue,
      source: input.source,
    })

    // 将风控结果转换为 RiskCheckItem[]
    const riskChecks: RiskCheckItem[] = []
    for (const block of riskResult.blocks) {
      riskChecks.push({
        id: `risk-${planId}-block-${riskChecks.length}`,
        name: 'blocker',
        label: '风控阻断',
        passed: false,
        message: block,
        detail: block,
        severity: 'blocker',
      })
    }
    for (const warning of riskResult.warnings) {
      riskChecks.push({
        id: `risk-${planId}-warn-${riskChecks.length}`,
        name: 'warning',
        label: '风控预警',
        passed: true,
        message: warning,
        detail: warning,
        severity: 'warning',
      })
    }

    const hasBlocker = riskResult.blocks.length > 0

    // 4. 生成 ExecutionPlan
    const plan: ExecutionPlan = {
      id: planId,
      signalId: signal.id,
      symbol: signal.symbol,
      name: signal.symbol,
      direction: signal.direction === 'buy' || signal.direction === 'sell'
        ? signal.direction
        : 'buy',
      quantity: sizingResult.targetShares,
      targetPrice: price,
      rationale: sizingResult.cappedBy !== 'none'
        ? `仓位受${sizingResult.cappedBy}上限约束`
        : 'Kelly 公式计算',
      phase: 'plan',
      confidence: signal.confidence,
      riskChecks,
      sizing: {
        quantity: sizingResult.targetShares,
        positionPct: sizingResult.positionPct,
        reason: sizingResult.cappedBy !== 'none'
          ? `仓位受${sizingResult.cappedBy}上限约束`
          : 'Kelly 公式计算',
      },
      risk: {
        passed: !hasBlocker,
        preCheck: true,
        postCheck: false,
        issueCount: riskResult.blocks.length,
        checks: riskChecks,
        warnings: riskResult.warnings,
      },
      accountType,
      createdAt: Date.now(),
      result: hasBlocker ? 'failed' : undefined,
      errorMessage: hasBlocker ? riskResult.blocks.join('；') : undefined,
    }

    // 5. 持久化
    logger.info('[createExecutionPlanUseCase] 保存执行计划', { planId, symbol: signal.symbol })
    const saveEnvelope = EnvelopeFactory.create(
      {
        action: ENVELOPE_ACTION.saveExecutionPlan,
        source: MODULE_ID.executionPlans,
        target: ENVELOPE_TARGET.db,
        traceId: `usecase-${planId}`,
      },
      plan,
    )
    await dataBridge.forward(saveEnvelope)
    logger.info('[createExecutionPlanUseCase] 执行计划保存完成', { planId, symbol: signal.symbol })

    // 6. 日志记录：区分成功和风控阻断
    if (!hasBlocker) {
      logger.info('[createExecutionPlanUseCase] 创建成功', {
        planId,
        symbol: signal.symbol,
        passed: true,
        quantity: plan.sizing?.quantity,
      })
    } else {
      logger.warn('[createExecutionPlanUseCase] 风控阻断', {
        planId,
        symbol: signal.symbol,
        passed: false,
        blockers: riskResult.blocks,
      })
    }

    return {
      success: true,
      plan,
      errorCode: hasBlocker ? 'RISK_BLOCKED' : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[createExecutionPlanUseCase] 创建失败', {
      error: message,
      symbol: signal.symbol,
    })
    return { success: false, error: message, errorCode: 'UNKNOWN_ERROR' }
  }
}
