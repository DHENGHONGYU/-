/**
 * @module health.types
 * @description 架构健康度仪表盘相关类型定义
 */

export type HealthMetricStatus = 'healthy' | 'warning' | 'critical' | 'info'

export interface HealthMetric {
  name: string
  label: string
  value: number
  baseline?: number
  unit: string
  status: HealthMetricStatus
  detail?: string
}

export interface HealthReport {
  generatedAt: string
  agentsVersion: string
  overallScore: number
  metrics: HealthMetric[]
}
