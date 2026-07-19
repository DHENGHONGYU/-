/**
 * @module executionLogService
 * @note P1-12（已确认合规）：dataLayer store 内部通过 sendWriteEnvelope() → DataBridge 写入，
 *   queryList/queryGet 走 DataBridge 查询，是 DataBridge 的类型安全包装层。
 *   符合 services → data 分层规则（AGENTS.md §一），无需迁移。
 * @description 执行日志服务：记录执行计划每个阶段的实际行为与系统事件。
 *
 * 职责：
 *   - writeLog(plan, action, options): 写入一条执行日志
 *   - listByPlan(planId): 查询某计划的全部日志
 * @convergence DataBridge 迁移（Phase 2）：当前直接 import executionLogStore，
 *   写入和查询应改为 DataBridge.forward()/query()。
 */

import { getLogger } from '@/lib/logger'
import { executionLogStore } from '@/data/dataLayerTradingStores'
import type { ExecutionPlan, ExecutionLog } from '@/data/types'
import { EXECUTION_LOG_ACTION, type ExecutionLogAction } from '@/constants/execution.constants'
import { checkExecutionLogFreshness } from '@/core/freshnessGuard'
import { generateId } from '@/lib/utils'

const logger = getLogger()

export interface WriteLogOptions {
  now?: number
  actor?: string
  details?: string
  success?: boolean
  errorMessage?: string
}

/**
 * 写入一条执行日志。
 * 日志时间戳必须晚于关联计划的创建时间（Freshness 校验）。
 */
export async function writeLog(
  plan: ExecutionPlan,
  action: ExecutionLogAction,
  options: WriteLogOptions = {},
): Promise<ExecutionLog | undefined> {
  const now = options.now ?? Date.now()
  const actor = options.actor ?? 'system'
  const success = options.success ?? true

  try {
    // Freshness 校验：日志时间戳必须晚于计划创建时间
    checkExecutionLogFreshness(now, plan.createdAt, plan.id)

    const id = generateId()
    const log: ExecutionLog = {
      id,
      planId: plan.id,
      symbol: plan.symbol,
      phase: plan.phase,
      action,
      actor,
      timestamp: now,
      detail: options.details,
      success,
      errorMessage: options.errorMessage,
      createdAt: now,
    }

    const result = await executionLogStore.save(log)
    if (!result.success) {
      logger.error(`[executionLogService] writeLog save failed: ${result.error}`, { planId: plan.id })
      return undefined
    }

    logger.info(`[executionLogService] writeLog success: planId="${plan.id}" action="${action}"`, {
      symbol: plan.symbol,
      phase: plan.phase,
      actor,
    })
    return log
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionLogService] writeLog error: ${message}`, { planId: plan.id })
    return undefined
  }
}

/**
 * 查询某执行计划的全部日志（按时间正序）。
 */
export async function listByPlan(planId: string): Promise<ExecutionLog[]> {
  try {
    const logs = await executionLogStore.getByPlanId(planId)
    return logs.sort((a, b) => a.timestamp - b.timestamp)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionLogService] listByPlan error: ${message}`, { planId })
    return []
  }
}

/**
 * 查询某股票的全部执行日志（按时间正序）。
 */
export async function listBySymbol(symbol: string): Promise<ExecutionLog[]> {
  try {
    const logs = await executionLogStore.getBySymbol(symbol)
    return logs.sort((a, b) => a.timestamp - b.timestamp)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionLogService] listBySymbol error: ${message}`, { symbol })
    return []
  }
}

/**
 * 查询失败的执行日志。
 */
export async function listFailed(symbol?: string): Promise<ExecutionLog[]> {
  try {
    const logs = symbol ? await executionLogStore.getBySymbol(symbol) : await executionLogStore.getAll()
    return logs.filter((l) => !l.success).sort((a, b) => a.timestamp - b.timestamp)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionLogService] listFailed error: ${message}`, { symbol })
    return []
  }
}

/**
 * executionLogService
 */
export const executionLogService = {
  writeLog,
  listByPlan,
  listBySymbol,
  listFailed,
}

// 重导出常量供外部使用
export { EXECUTION_LOG_ACTION }
