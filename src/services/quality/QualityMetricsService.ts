/**
 * QualityMetricsService — 数据质量指标服务（WIP / 在制品）
 *
 * 设计目标（@doc V9-DOC-QUALITY-001）：
 *   记录写入成功 / 失败 / 总数、Mock 写入数、审计警告数，并维护最近写入记录，
 *   供 scripts/audit/kpi-consistency.ts（audit:kpi-consistency 门禁）读取，
 *   以验证 KPI 显示值与实际写入数一致，防止"假绿灯"模式。
 *
 * 当前状态（WIP）：
 *   仅提供桩导出，保证引用方 scripts/audit/kpi-consistency.ts 可解析运行；
 *   真实指标尚未接入写入链路。待实现真实统计后移除本标记。
 */

export interface QualityMetrics {
  /** 写入总次数 */
  writeTotal: number
  /** 写入成功次数 */
  writeSuccess: number
  /** 写入失败次数 */
  writeFailure: number
  /** Mock 写入次数 */
  mockWriteTotal: number
  /** 审计警告数 */
  auditWarnings: number
}

export interface WriteRecord {
  /** 目标 store 名 */
  store: string
  /** 记录主键 */
  key: string
  /** 是否成功 */
  success: boolean
  /** 失败原因 */
  error?: string
  /** 写入时间戳 */
  timestamp: number
}

/** 桩实现：返回零值指标（在制品，未接入真实写入链路） */
export function getQualityMetrics(): QualityMetrics {
  return { writeTotal: 0, writeSuccess: 0, writeFailure: 0, mockWriteTotal: 0, auditWarnings: 0 }
}

/** 桩实现：返回空记录列表（在制品） */
export function getRecentRecords(_limit = 20): WriteRecord[] {
  return []
}
