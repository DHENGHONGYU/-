/**
 * @module executionPlanService
 * @note 已迁移至 DataBridge 架构：所有数据访问通过 dataBridge.query() / dataBridge.forward()，
 *   不再直接依赖 dataLayer store。ACL 审计由 DataBridge 统一管控。
 * @description 执行计划服务：基于交易信号创建执行计划，管理阶段流转与取消。
 *
 * 职责：
 *   - createPlan(signal): ~~基于信号创建执行计划~~ **@deprecated** 旧路径，不推荐新代码使用
 *   - listPlans(symbol?): 查询执行计划列表
 *   - updatePhase(planId, nextPhase): 按状态机推进阶段
 *   - cancelPlan(planId): 取消执行计划
 *
 * 依赖：DataBridge (query/forward) / executionLogService / freshnessGuard
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  STORE_NAME,
} from '@/config/dbConfig'
import type { ExecutionPlan, Signal } from '@/data/types'
import {
  EXECUTION_PHASE,
  PHASE_TRANSITIONS,
  PHASE_LOG_ACTION,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MAX_POSITION_PCT,
  DEFAULT_ACCOUNT_TYPE,
} from '@/constants/execution.constants'
import { checkExecutionPlanFreshness } from '@/core/freshnessGuard'
import { executionLogService } from './executionLogService'
import { nanoid } from 'nanoid'

const logger = getLogger()

const SOURCE = MODULE_ID.executionPlans
const STORE = STORE_NAME.executionPlans

async function savePlanViaBridge(plan: ExecutionPlan): Promise<void> {
  const envelope = EnvelopeFactory.create(
    {
      source: SOURCE,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveExecutionPlan,
      traceId: `plan-${nanoid(8)}`,
    },
    plan,
  )
  await dataBridge.forward(envelope)
}

async function queryAllPlansViaBridge(): Promise<ExecutionPlan[]> {
  const result = await dataBridge.query<ExecutionPlan[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE,
    source: SOURCE,
  })
  return result.success ? (result.data ?? []) : []
}

async function queryPlanByIdViaBridge(planId: string): Promise<ExecutionPlan | undefined> {
  const result = await dataBridge.query<ExecutionPlan>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE,
    key: planId,
    source: SOURCE,
  })
  return result.success ? result.data : undefined
}

export interface CreatePlanOptions {
  now?: number
  confidenceThreshold?: number
  maxPositionPct?: number
  accountType?: ExecutionPlan['accountType']
}

export interface UpdatePhaseOptions {
  now?: number
  actor?: string
}

/**
 * @deprecated 无风控 / 无仓位计算的旧路径，已被 `createExecutionPlanUseCase`（含 checkOrderRisk 风控 + 仓位计算）取代。
 *
 * 新代码请改用 `executionStore.createPlan`（文档《功能模块数据契约》列为 P0 的核心能力），
 * 经 `createExecutionPlanUseCase` 持久化，具备风控与仓位 sizing。
 *
 * 本方法当前保留仅为兼容既有测试与历史调用，不推荐在新增功能中使用；
 * 后续将在全仓调用方迁移完成后逐步删除（CORE PRINCIPLE：删除需经应潇震确认）。
 *
 * 基于交易信号创建执行计划（旧逻辑）。
 * 当信号置信度低于阈值时返回 undefined。
/**
 * createPlan
 * @param signal
 * @param options
 * @returns Promise<ExecutionPlan | undefined>
 */
export async function createPlan(signal: Signal, options: CreatePlanOptions = {}): Promise<ExecutionPlan | undefined> {
  const now = options.now ?? Date.now()
  const confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD
  const maxPositionPct = options.maxPositionPct ?? DEFAULT_MAX_POSITION_PCT
  const accountType = options.accountType ?? DEFAULT_ACCOUNT_TYPE

  try {
    if (signal.confidence < confidenceThreshold) {
      logger.info(
        `[executionPlanService] createPlan skipped: signal confidence ${signal.confidence} < threshold ${confidenceThreshold}`,
        { symbol: signal.symbol, signalId: signal.id },
      )
      return undefined
    }

    const plan: ExecutionPlan = {
      id: `plan_${signal.id}_${now}`,
      signalId: signal.id,
      symbol: signal.symbol,
      name: signal.symbol,
      direction: signal.direction === 'sell' ? 'sell' : 'buy',
      phase: EXECUTION_PHASE.PLAN,
      quantity: 0,
      targetPrice: 0,
      rationale: signal.rationale,
      confidence: signal.confidence,
      riskChecks: [],
      sizing: {
        quantity: 0,
        positionPct: Math.min(maxPositionPct, signal.confidence),
        reason: `基于信号 ${signal.id} 自动生成`,
      },
      accountType,
      createdAt: now,
    }

    // Freshness 校验：执行计划创建时间必须晚于信号创建时间
    checkExecutionPlanFreshness(plan.createdAt, signal.createdAt, plan.id)

    try {
      await savePlanViaBridge(plan)
    } catch (saveErr) {
      const saveMsg = saveErr instanceof Error ? saveErr.message : String(saveErr)
      logger.error(`[executionPlanService] createPlan save failed: ${saveMsg}`, { signalId: signal.id })
      return undefined
    }

    // 写入创建日志
    await executionLogService.writeLog(plan, PHASE_LOG_ACTION[EXECUTION_PHASE.PLAN], { now, actor: 'system' })

    logger.info(`[executionPlanService] createPlan success: planId="${plan.id}"`, {
      symbol: plan.symbol,
      phase: plan.phase,
      confidence: plan.confidence,
    })
    return plan
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionPlanService] createPlan error: ${message}`, { signalId: signal.id })
    return undefined
  }
}

/**
 * 查询执行计划列表。
 * @param symbol 可选，按 symbol 过滤
 */
export async function listPlans(symbol?: string): Promise<ExecutionPlan[]> {
  try {
    const all = await queryAllPlansViaBridge()
    if (!symbol) {
      return all
    }
    return all.filter((p) => p.symbol === symbol)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionPlanService] listPlans error: ${message}`, { symbol })
    return []
  }
}

function applyPhaseTimestamp(
  phase: ExecutionPlan['phase'],
  now: number,
): Partial<ExecutionPlan> {
  if (phase === EXECUTION_PHASE.CONFIRMED) return { confirmedAt: now }
  if (phase === EXECUTION_PHASE.EXECUTED) return { executedAt: now }
  if (phase === EXECUTION_PHASE.REVIEWED) return { reviewedAt: now }
  return {}
}

/**
 * 按状态机推进执行计划阶段。
 * 若 nextPhase 不在当前阶段允许的下一个阶段列表中，则拒绝推进。
 */
export async function updatePhase(
  planId: string,
  nextPhase: ExecutionPlan['phase'],
  options: UpdatePhaseOptions = {},
): Promise<ExecutionPlan | undefined> {
  const now = options.now ?? Date.now()
  const actor = options.actor ?? 'system'

  try {
    const plan = await queryPlanByIdViaBridge(planId)
    if (!plan) {
      logger.warn(`[executionPlanService] updatePhase plan not found: planId="${planId}"`)
      return undefined
    }

    const allowed = PHASE_TRANSITIONS[plan.phase]
    if (!allowed.includes(nextPhase)) {
      logger.warn(
        `[executionPlanService] updatePhase rejected: ${plan.phase} → ${nextPhase} not allowed (planId="${planId}")`,
      )
      return undefined
    }

    const timestampUpdate = applyPhaseTimestamp(nextPhase, now)
    const updated: ExecutionPlan = { ...plan, phase: nextPhase, ...timestampUpdate }

    try {
      await savePlanViaBridge(updated)
    } catch (saveErr) {
      const saveMsg = saveErr instanceof Error ? saveErr.message : String(saveErr)
      logger.error(`[executionPlanService] updatePhase save failed: ${saveMsg}`, { planId })
      return undefined
    }

    // 写入阶段流转日志
    await executionLogService.writeLog(updated, PHASE_LOG_ACTION[nextPhase], { now, actor })

    logger.info(`[executionPlanService] updatePhase success: ${plan.phase} → ${nextPhase} (planId="${planId}")`, {
      actor,
    })
    return updated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionPlanService] updatePhase error: ${message}`, { planId })
    return undefined
  }
}

/**
 * 取消执行计划。仅当当前阶段允许转移到 cancelled 时才可取消。
 */
export async function cancelPlan(planId: string, options: UpdatePhaseOptions = {}): Promise<ExecutionPlan | undefined> {
  const now = options.now ?? Date.now()
  const actor = options.actor ?? 'system'

  try {
    const plan = await queryPlanByIdViaBridge(planId)
    if (!plan) {
      logger.warn(`[executionPlanService] cancelPlan plan not found: planId="${planId}"`)
      return undefined
    }

    const allowed = PHASE_TRANSITIONS[plan.phase]
    if (!allowed.includes(EXECUTION_PHASE.CANCELLED)) {
      logger.warn(
        `[executionPlanService] cancelPlan rejected: ${plan.phase} → cancelled not allowed (planId="${planId}")`,
      )
      return undefined
    }

    const updated: ExecutionPlan = { ...plan, phase: EXECUTION_PHASE.CANCELLED }

    try {
      await savePlanViaBridge(updated)
    } catch (saveErr) {
      const saveMsg = saveErr instanceof Error ? saveErr.message : String(saveErr)
      logger.error(`[executionPlanService] cancelPlan save failed: ${saveMsg}`, { planId })
      return undefined
    }

    await executionLogService.writeLog(updated, PHASE_LOG_ACTION[EXECUTION_PHASE.CANCELLED], { now, actor })

    logger.info(`[executionPlanService] cancelPlan success: planId="${planId}"`, { actor })
    return updated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionPlanService] cancelPlan error: ${message}`, { planId })
    return undefined
  }
}

/**
 * 查询孤儿执行计划：关联的信号已被删除的计划。
 */
export async function getOrphanPlans(): Promise<ExecutionPlan[]> {
  try {
    const all = await queryAllPlansViaBridge()
    const terminalPhases: ExecutionPlan['phase'][] = [EXECUTION_PHASE.EXECUTED, EXECUTION_PHASE.CANCELLED, EXECUTION_PHASE.REVIEWED]
    return all.filter((p) => !terminalPhases.includes(p.phase))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executionPlanService] getOrphanPlans error: ${message}`)
    return []
  }
}

/**
 * executionPlanService
 */
export const executionPlanService = {
  createPlan,
  listPlans,
  updatePhase,
  cancelPlan,
  getOrphanPlans,
}
