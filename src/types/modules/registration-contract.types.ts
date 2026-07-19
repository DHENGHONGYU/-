/**
 * 注册与契约履行状态查询 — 类型定义
 *
 * @module types/registration-contract
 * @since 2026-07-18
 */

// ── 注册状态 ───────────────────────────────────────────────

/** 注册完成状态 */
export type RegistrationPhase =
  | 'not_started'   // 未开始
  | 'pending'       // 待审核
  | 'active'        // 已激活
  | 'expired'       // 已过期
  | 'revoked'       // 已撤销

/** 注册渠道 */
export type RegistrationChannel =
  | 'web'           // 网页端
  | 'app'           // 移动端
  | 'api'           // API 接入
  | 'import'        // 批量导入
  | 'manual'        // 手动录入

/** 注册记录 */
export interface RegistrationRecord {
  /** 用户唯一标识 */
  userId: string
  /** 注册阶段 */
  phase: RegistrationPhase
  /** 注册时间 ISO */
  registeredAt: string | null
  /** 激活时间 ISO */
  activatedAt: string | null
  /** 注册渠道 */
  channel: RegistrationChannel
  /** 账户是否已验证（邮箱/手机） */
  verified: boolean
  /** 异常标记 */
  anomalies: RegistrationAnomaly[]
}

/** 注册异常类型 */
export type RegistrationAnomaly =
  | 'not_activated'        // 未激活
  | 'expired_session'      // 会话过期
  | 'channel_mismatch'     // 渠道不匹配
  | 'duplicate_account'    // 重复账户
  | 'missing_verification' // 未验证

// ── 契约状态 ───────────────────────────────────────────────

/** 契约履行阶段 */
export type ContractPhase =
  | 'unsigned'      // 未签署
  | 'pending_sign'  // 待签署
  | 'active'        // 履行中
  | 'completed'     // 已完成
  | 'breached'      // 已违约
  | 'terminated'    // 已终止

/** 契约关键节点 */
export interface ContractMilestone {
  /** 节点标识 */
  key: string
  /** 节点名称 */
  label: string
  /** 计划日期 ISO */
  plannedDate: string
  /** 实际完成日期 ISO */
  completedDate: string | null
  /** 是否逾期 */
  overdue: boolean
}

/** 违约记录 */
export interface BreachRecord {
  /** 违约日期 */
  date: string
  /** 违约类型 */
  type: 'late_payment' | 'non_compliance' | 'data_breach' | 'service_outage' | 'other'
  /** 描述 */
  description: string
  /** 严重程度 1-5 */
  severity: number
  /** 是否已解决 */
  resolved: boolean
}

/** 契约记录 */
export interface ContractRecord {
  /** 契约唯一标识 */
  contractId: string
  /** 契约名称 */
  name: string
  /** 签署日期 ISO */
  signedAt: string | null
  /** 生效日期 ISO */
  effectiveAt: string | null
  /** 到期日期 ISO */
  expiresAt: string | null
  /** 当前履行阶段 */
  phase: ContractPhase
  /** 履行进度 0-100 */
  progress: number
  /** 关键节点列表 */
  milestones: ContractMilestone[]
  /** 违约记录 */
  breachRecords: BreachRecord[]
  /** 异常标记 */
  anomalies: ContractAnomaly[]
}

/** 契约异常类型 */
export type ContractAnomaly =
  | 'not_signed'         // 未签署
  | 'milestone_overdue'  // 节点逾期
  | 'progress_stalled'   // 进度停滞
  | 'approaching_expiry' // 临近到期
  | 'has_breaches'       // 存在违约

// ── 综合查询结果 ────────────────────────────────────────────

/** 状态查询入参 */
export interface StatusQueryInput {
  /** 用户标识 */
  userId: string
  /** 契约 ID 列表（空=全部） */
  contractIds?: string[]
  /** 是否包含历史违约 */
  includeHistory?: boolean
}

/** 状态查询结果 */
export interface StatusQueryResult {
  /** 查询时间 */
  queriedAt: string
  /** 注册状态 */
  registration: RegistrationRecord
  /** 契约状态列表 */
  contracts: ContractRecord[]
  /** 汇总异常 */
  summary: StatusSummary
}

/** 汇总统计 */
export interface StatusSummary {
  /** 总异常数 */
  totalAnomalies: number
  /** 注册异常数 */
  registrationAnomalies: number
  /** 契约异常数 */
  contractAnomalies: number
  /** 活跃契约数 */
  activeContracts: number
  /** 违约契约数 */
  breachedContracts: number
  /** 整体健康度 0-100 */
  healthScore: number
}
