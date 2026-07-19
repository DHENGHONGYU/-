/**
 * @module ExecutionConstants
 * @description 执行链路模块常量定义。所有枚举值、阈值、配置数值必须从此文件引用，禁止在组件/Service 中硬编码。
 */

import type { ExecutionPhase } from '@/data/types'

// ============================================================
// 执行计划阶段枚举与状态机
// ============================================================

/** 执行计划阶段常量 */
export const EXECUTION_PHASE = {
  PLAN: 'plan' as ExecutionPhase,
  CONFIRMED: 'confirmed' as ExecutionPhase,
  PENDING: 'pending' as ExecutionPhase,
  EXECUTED: 'executed' as ExecutionPhase,
  CANCELLED: 'cancelled' as ExecutionPhase,
  REVIEWED: 'reviewed' as ExecutionPhase,
} as const

/** 阶段状态机：定义每个阶段允许的下一个阶段 */
export const PHASE_TRANSITIONS: Readonly<Record<ExecutionPhase, readonly ExecutionPhase[]>> = {
  plan: [EXECUTION_PHASE.CONFIRMED, EXECUTION_PHASE.CANCELLED],
  confirmed: [EXECUTION_PHASE.PENDING, EXECUTION_PHASE.EXECUTED, EXECUTION_PHASE.CANCELLED],
  pending: [EXECUTION_PHASE.EXECUTED, EXECUTION_PHASE.CANCELLED],
  executed: [EXECUTION_PHASE.REVIEWED],
  cancelled: [],
  reviewed: [],
}

/** 执行日志动作枚举 */
export const EXECUTION_LOG_ACTION = {
  CREATE: 'create',
  CONFIRM: 'confirm',
  EXECUTE: 'execute',
  CANCEL: 'cancel',
  REVIEW: 'review',
} as const

export type ExecutionLogAction = (typeof EXECUTION_LOG_ACTION)[keyof typeof EXECUTION_LOG_ACTION]

/** 阶段与日志动作的映射 */
export const PHASE_LOG_ACTION: Readonly<Record<ExecutionPhase, ExecutionLogAction>> = {
  plan: EXECUTION_LOG_ACTION.CREATE,
  confirmed: EXECUTION_LOG_ACTION.CONFIRM,
  pending: EXECUTION_LOG_ACTION.CONFIRM,
  executed: EXECUTION_LOG_ACTION.EXECUTE,
  cancelled: EXECUTION_LOG_ACTION.CANCEL,
  reviewed: EXECUTION_LOG_ACTION.REVIEW,
}

// ============================================================
// 执行计划默认配置
// ============================================================

/** 默认置信度阈值（低于此值的信号不创建执行计划） */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6

/** 默认仓位百分比上限 */
export const DEFAULT_MAX_POSITION_PCT = 0.25

/** 默认账户类型 */
export const DEFAULT_ACCOUNT_TYPE = 'paper'

// ============================================================
// 缺失报告配置
// ============================================================

/** 缺失报告类型 */
export const MISSING_REPORT_TYPE = {
  RESEARCH: 'research',
  EARNINGS: 'earnings',
  INDUSTRY: 'industry',
  ANNOUNCEMENT: 'announcement',
  RATING: 'rating',
} as const

export type MissingReportType = (typeof MISSING_REPORT_TYPE)[keyof typeof MISSING_REPORT_TYPE]

/** 缺失报告严重度 */
export const MISSING_REPORT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type MissingReportSeverity = (typeof MISSING_REPORT_SEVERITY)[keyof typeof MISSING_REPORT_SEVERITY]

/** 缺失报告默认重试上限 */
export const DEFAULT_MAX_RETRY_COUNT = 3

/** 缺失报告默认启用状态（采集质量基线，默认开启以自动检测数据缺失） */
export const DEFAULT_MISSING_REPORT_ENABLED = true

// ============================================================
// 投资组合配置
// ============================================================

/** 默认现金储备比例 */
export const DEFAULT_CASH_RESERVE_PCT = 0.1

/** 单只股票最大权重上限 */
export const DEFAULT_MAX_HOLDING_WEIGHT = 0.3

/** 权重调整阈值（当 |当前权重 - 目标权重| 超过此值时触发再平衡） */
export const DEFAULT_REBALANCE_THRESHOLD = 0.05
