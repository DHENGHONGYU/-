/**
 * 系统健康监控与诊断分析常量
 * @description 所有健康状态、评分等级、语义颜色均从此文件读取
 */

// ============================================================
// 健康状态枚举
// @remarks 与服务端 healthStatus/statusCode 保持一一映射
// ============================================================
export const HEALTH_STATUS = {
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
} as const

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS]

/**
 * 健康状态映射表
 */
export const HEALTH_STATUS_MAP: Record<
  HealthStatus,
  {
    label: string
    color: string
    bgClass: string
    textClass: string
    icon: string
  }
> = {
  [HEALTH_STATUS.HEALTHY]: {
    label: '正常',
    color: '#22c55e',
    bgClass: 'bg-green-500',
    textClass: 'text-green-500',
    icon: 'check-circle',
  },
  [HEALTH_STATUS.WARNING]: {
    label: '预警',
    color: '#f59e0b',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-500',
    icon: 'alert-triangle',
  },
  [HEALTH_STATUS.CRITICAL]: {
    label: '异常',
    color: '#ef4444',
    bgClass: 'bg-red-500',
    textClass: 'text-red-500',
    icon: 'x-circle',
  },
  [HEALTH_STATUS.UNKNOWN]: {
    label: '未知',
    color: '#9ca3af',
    bgClass: 'bg-gray-400',
    textClass: 'text-gray-400',
    icon: 'help-circle',
  },
}

// ============================================================
// 模块分类标签（健康监控顶部筛选）
// ============================================================
export const HEALTH_MODULE_CATEGORY = {
  CORE: 'CORE',
  SYSTEM: 'SYSTEM',
  AGENT: 'AGENT',
  DATA: 'DATA',
} as const

export type HealthModuleCategory = (typeof HEALTH_MODULE_CATEGORY)[keyof typeof HEALTH_MODULE_CATEGORY]

export const HEALTH_MODULE_CATEGORY_MAP: Record<HealthModuleCategory, string> = {
  [HEALTH_MODULE_CATEGORY.CORE]: '核心模块',
  [HEALTH_MODULE_CATEGORY.SYSTEM]: '系统组件',
  [HEALTH_MODULE_CATEGORY.AGENT]: '智能体',
  [HEALTH_MODULE_CATEGORY.DATA]: '数据服务',
}

// ============================================================
// 诊断报告等级
// ============================================================
export const DIAGNOSTIC_LEVEL = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  AVERAGE: 'AVERAGE',
  POOR: 'POOR',
} as const

export type DiagnosticLevel = (typeof DIAGNOSTIC_LEVEL)[keyof typeof DIAGNOSTIC_LEVEL]

export const DIAGNOSTIC_LEVEL_MAP: Record<
  DiagnosticLevel,
  {
    label: string
    color: string
    bgClass: string
  }
> = {
  [DIAGNOSTIC_LEVEL.EXCELLENT]: { label: '优秀', color: '#22c55e', bgClass: 'bg-green-500' },
  [DIAGNOSTIC_LEVEL.GOOD]: { label: '良好', color: '#3b82f6', bgClass: 'bg-blue-500' },
  [DIAGNOSTIC_LEVEL.AVERAGE]: { label: '一般', color: '#f59e0b', bgClass: 'bg-amber-500' },
  [DIAGNOSTIC_LEVEL.POOR]: { label: '较差', color: '#ef4444', bgClass: 'bg-red-500' },
}

// ============================================================
// 健康评分阈值
// @remarks 用于将数值评分转换为等级状态
// ============================================================
export const HEALTH_SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  WARNING: 60,
}
