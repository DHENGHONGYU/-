/**
 * AI 智能体调度中心 / 健康监控 / 诊断分析 类型定义
  * @doc [V9-DOC-QA-066]
*/

import type { AgentStatus, AgentTag } from '@/constants/ai-center.constants'
import type { HealthStatus, HealthModuleCategory, DiagnosticLevel } from '@/constants/health.constants'

// ============================================================
// AI 智能体调度中心数据
// ============================================================

/** AI 智能体条目 */
export interface AgentItem {
  /** 智能体唯一标识 */
  id: string
  /** 智能体类型 key，对应 AGENT_TYPE_MAP */
  type: string
  /** 显示名称 */
  name: string
  /** 标签列表 */
  tags: AgentTag[]
  /** 描述 */
  description: string
  /** 运行/调用次数 */
  callCount: number
  /** 当前状态 */
  status: AgentStatus
  /** 最后活跃时间 */
  lastActiveAt: number
  /** 知识库使用次数（用于顶部总览） */
  knowledgeUsage?: number
}

/** 顶部总览指标 */
export interface AgentOverviewMetrics {
  totalAgents: number
  knowledgeUsage: number
  taskExecutions: number
  monitorAlerts: number
}

/** Agent 列表数据 */
export interface AgentListData {
  agents: AgentItem[]
  overview: AgentOverviewMetrics
  total: number
  page: number
  pageSize: number
}

// ============================================================
// 系统健康监控数据
// ============================================================

/** 健康指标条目 */
export interface HealthMetricItem {
  /** 模块唯一标识 */
  id: string
  /** 模块名称 */
  name: string
  /** 模块分类 */
  category: HealthModuleCategory
  /** 健康度百分比 0-100 */
  healthScore: number
  /** 状态 */
  status: HealthStatus
  /** 附加指标（如成功率、响应时间等） */
  extra?: Record<string, number | string>
  /** 最后检测时间 */
  checkedAt: number
}

/** 健康监控数据 */
export interface HealthMetricsData {
  metrics: HealthMetricItem[]
  overallScore: number
  overallStatus: HealthStatus
  lastUpdatedAt: number
}

// ============================================================
// 诊断分析数据
// ============================================================

/** 诊断报告条目 */
export interface DiagnosticReportItem {
  /** 诊断项 ID */
  id: string
  /** 诊断项名称 */
  name: string
  /** 所属模块 */
  module: string
  /** 健康评分 0-100 */
  healthScore: number
  /** 成功率 0-100 */
  successRate: number
  /** 稳定性评分 0-100 */
  stabilityScore: number
  /** 综合等级 */
  level: DiagnosticLevel
  /** 诊断详情 */
  detail?: string
  /** 诊断时间 */
  reportedAt: number
}

/** 诊断分析数据 */
export interface DiagnosticReportsData {
  reports: DiagnosticReportItem[]
  overallLevel: DiagnosticLevel
  lastUpdatedAt: number
}

// ============================================================
// AI 中心统一数据（可独立使用，也可嵌入 MarketData）
// ============================================================

export interface AICenterData {
  agents: AgentListData
  healthMetrics: HealthMetricsData
  diagnosticReports: DiagnosticReportsData
}

/** 用于扩展 MarketData 的类型片段
 * @example
 * export interface MarketData {
 *   // ... existing fields
 *   aiCenter: AICenterData
 * }
 */
