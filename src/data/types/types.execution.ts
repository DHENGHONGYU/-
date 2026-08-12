/**
 * @fileoverview 执行计划域类型（L1 执行计划业务域）
 *
 * 包含执行计划、风险检查、执行日志、缺失报告等类型。
 * 与 src/constants/execution.constants.ts 的 EXECUTION_PHASE 值保持一致。
 *
 * @module data/types/types.execution
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
  * @doc [V9-DOC-QA-066]
*/

import type { AccountType } from '@/config/dbConfig'

/**
 * 执行计划阶段枚举
 * 与 src/constants/execution.constants.ts 的 EXECUTION_PHASE 值保持一致
 */
export type ExecutionPhase = 'plan' | 'confirmed' | 'pending' | 'executed' | 'cancelled' | 'reviewed'

/** 风险检查项 */
export interface RiskCheckItem {
  id: string
  name: string
  label: string
  passed: boolean
  detail: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'blocker' | 'warning' | 'info'
}

/** 执行计划 */
export interface ExecutionPlan {
  id: string
  signalId?: string
  symbol: string
  name: string
  phase: ExecutionPhase
  direction: 'buy' | 'sell'
  quantity: number
  targetPrice: number
  currentPrice?: number
  rationale: string
  confidence: number
  riskChecks: RiskCheckItem[]
  risk?: {
    passed: boolean
    preCheck: boolean
    postCheck: boolean
    issueCount: number
    checks: RiskCheckItem[]
    warnings?: string[]
  }
  sizing?: {
    quantity: number
    positionPct: number
    reason?: string
  }
  result?: 'success' | 'failed' | 'partial'
  orderId?: string
  errorMessage?: string
  accountType?: AccountType
  confirmedAt?: number
  executedAt?: number
  reviewedAt?: number
  createdAt: number
  updatedAt?: number
}

/** 执行日志 */
export interface ExecutionLog {
  id: string
  planId: string
  symbol: string
  action: string
  actor?: string
  phase: ExecutionPhase
  timestamp: number
  detail?: string
  success?: boolean
  errorMessage?: string
  createdAt: number
}

/** 缺失报告 */
export interface MissingReport {
  id: string
  symbol: string
  reportType: string
  severity: string
  reason: string
  detectedAt: number
  retryCount: number
  resolvedAt?: number
  createdAt: number
}
