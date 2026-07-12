/**
 * @module services/riskControlService
 * @description 风控展示页数据服务
 *
 * 通过 DataBridge 读取 execution_plans 存储中的真实风险检查记录，
 * 并将其映射为 RiskVerdict 供 riskStore / RiskControlPage 展示。
 *
 * @compliance AGENTS.md §一：services 层仅依赖 core / data / lib，
 * 不直接依赖 store / pages / components。
 */

import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { SignalDirection } from '@/config/tradingConfig'
import type { ExecutionPlan } from '@/data/types'
import type { OrderRiskInput, RiskCheckResult } from '@/services/trading/riskEngine'
import type { RiskTriState } from '@/types/modules/risk.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 风控裁决记录 */
export interface RiskVerdict {
  id: string
  timestamp: number
  symbol: string
  direction: SignalDirection
  input: OrderRiskInput
  result: RiskCheckResult
  triState: RiskTriState
}

const BLOCKER_SEVERITIES = new Set(['blocker'])
const WARNING_SEVERITIES = new Set(['warning', 'high'])

function deriveTriState(checks: ReadonlyArray<{ severity: string }>): RiskTriState {
  if (checks.some((c) => BLOCKER_SEVERITIES.has(c.severity))) return 'blocked'
  if (checks.some((c) => WARNING_SEVERITIES.has(c.severity))) return 'warning'
  return 'normal'
}

function mapExecutionPlanToVerdict(plan: ExecutionPlan): RiskVerdict {
  const checks = plan.risk?.checks ?? plan.riskChecks ?? []
  const triState = deriveTriState(checks)

  const blocks = checks
    .filter((c) => BLOCKER_SEVERITIES.has(c.severity))
    .map((c) => c.message || c.label)
  const warnings = checks
    .filter((c) => WARNING_SEVERITIES.has(c.severity))
    .map((c) => c.message || c.label)

  if (plan.risk?.warnings && plan.risk.warnings.length > 0) {
    warnings.push(...plan.risk.warnings)
  }

  const input: OrderRiskInput = {
    symbol: plan.symbol,
    direction: plan.direction,
    quantity: plan.quantity,
    price: plan.targetPrice,
    portfolioValue: 0,
    source: 'manual',
  }

  return {
    id: plan.id,
    timestamp: plan.createdAt,
    symbol: plan.symbol,
    direction: plan.direction as SignalDirection,
    input,
    result: { ok: triState !== 'blocked', warnings, blocks },
    triState,
  }
}

/**
 * 从 IndexedDB 的 execution_plans 存储加载风控裁决记录。
 *
 * 映射规则：
 * - severity === 'blocker' → triState = 'blocked'，计入 result.blocks
 * - severity === 'warning' 或 'high' → triState = 'warning'，计入 result.warnings
 * - 其余 severity → triState = 'normal'
 *
 * 返回结果按 createdAt 降序排列，最新记录在前。
 */
export async function loadRiskVerdicts(): Promise<RiskVerdict[]> {
  logger.info('[riskControlService] 开始加载风控裁决记录')

  const result = await dataBridge.query<ExecutionPlan[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.executionPlans,
    source: MODULE_ID.datalayer,
  })

  if (!result.success) {
    const error = result.error ?? '加载风控裁决记录失败'
    logger.error('[riskControlService] 加载风控裁决记录失败', { error })
    throw new Error(error)
  }

  const plans = result.data ?? []
  const verdicts = plans.map(mapExecutionPlanToVerdict).sort((a, b) => b.timestamp - a.timestamp)

  logger.info('[riskControlService] 风控裁决记录加载完成', { count: verdicts.length })
  return verdicts
}
