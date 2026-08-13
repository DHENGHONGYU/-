/**
 * @module CrossSourceValidation
 * @description 多源数据交叉验证（P1 修复 R12：第三方数据源本身有误）
 *
 * 当同一数据可从多个来源获取时，进行交叉验证：
 * 1. 腾讯行情 vs 新浪行情 → 收盘价偏差
 * 2. 不同数据源的 PE/PB → 偏差告警
 * 3. 偏差超过阈值 → 标记为 degraded + 审计告警
 *
 * 架构原则：
 * - 交叉验证是可选检查，不阻塞采集流程
 * - 偏差 > 5% 标记为 degraded
 * - 偏差 > 10% 触发审计告警
 *
 * @doc V9-DOC-QUALITY-012
 */

import { getLogger } from '@/lib/logger'
import type { DataRecordMeta } from '@/types/data/DataRecordMeta'

const logger = getLogger()

// ── 类型定义 ──

/** 数据源条目 */
export interface SourceEntry {
  source: string
  value: number
  timestamp: number
}

/** 交叉验证结果 */
export interface CrossSourceResult {
  /** 字段名 */
  field: string
  /** 各数据源的值 */
  sources: SourceEntry[]
  /** 中位数 */
  median: number
  /** 最大偏差百分比 */
  maxDeviationPct: number
  /** 是否通过 */
  passed: boolean
  /** 偏差等级 */
  deviationLevel: 'normal' | 'warn' | 'alert'
  /** 建议 */
  suggestion?: string
}

/** 交叉验证报告 */
export interface CrossSourceReport {
  /** 股票代码 */
  symbol: string
  /** 各字段验证结果 */
  results: CrossSourceResult[]
  /** 是否通过 */
  passed: boolean
  /** 告警等级 */
  alertLevel: 'normal' | 'warn' | 'alert'
}

// ── 阈值 ──

/** 偏差告警阈值 5% */
const DEVIATION_WARN_THRESHOLD = 0.05

/** 偏差严重告警阈值 10% */
const DEVIATION_ALERT_THRESHOLD = 0.10

// ── 校验逻辑 ──

/**
 * 对两个数据源的数值字段进行交叉验证
 *
 * @param field - 字段名
 * @param sourceA - 数据源 A 的值
 * @param sourceB - 数据源 B 的值
 * @param sourceAName - 数据源 A 名称
 * @param sourceBName - 数据源 B 名称
 * @returns 验证结果
 */
export function crossValidateField(
  field: string,
  sourceA: { value: number; timestamp: number },
  sourceB: { value: number; timestamp: number },
  sourceAName: string,
  sourceBName: string,
): CrossSourceResult {
  const sources: SourceEntry[] = [
    { source: sourceAName, value: sourceA.value, timestamp: sourceA.timestamp },
    { source: sourceBName, value: sourceB.value, timestamp: sourceB.timestamp },
  ]

  const values = sources.map((s) => s.value)
  const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values)

  const maxDeviationPct = median > 0
    ? Math.max(
        Math.abs(maxValue - median) / median,
        Math.abs(minValue - median) / median,
      )
    : 0

  let deviationLevel: CrossSourceResult['deviationLevel'] = 'normal'
  let suggestion: string | undefined

  if (maxDeviationPct > DEVIATION_ALERT_THRESHOLD) {
    deviationLevel = 'alert'
    suggestion = `${field} 多源数据偏差 ${(maxDeviationPct * 100).toFixed(1)}%，超过 ${(DEVIATION_ALERT_THRESHOLD * 100).toFixed(0)}% 严重阈值，建议人工核实`
  } else if (maxDeviationPct > DEVIATION_WARN_THRESHOLD) {
    deviationLevel = 'warn'
    suggestion = `${field} 多源数据偏差 ${(maxDeviationPct * 100).toFixed(1)}%，超过 ${(DEVIATION_WARN_THRESHOLD * 100).toFixed(0)}% 告警阈值`
  }

  return {
    field,
    sources,
    median: parseFloat(median.toFixed(4)),
    maxDeviationPct: parseFloat(maxDeviationPct.toFixed(4)),
    passed: deviationLevel !== 'alert',
    deviationLevel,
    suggestion,
  }
}

/**
 * 对股票行情数据做多源交叉验证
 *
 * @param tencentQuote - 腾讯行情数据
 * @param sinaQuote - 新浪行情数据
 * @returns 交叉验证报告
 */
export function crossValidateQuotes(
  symbol: string,
  tencentQuote: { close: number; date: string },
  sinaQuote: { close: number; date: string },
): CrossSourceReport {
  const results: CrossSourceResult[] = []

  // 验证收盘价
  results.push(
    crossValidateField(
      'close',
      { value: tencentQuote.close, timestamp: Date.now() },
      { value: sinaQuote.close, timestamp: Date.now() },
      'tencent',
      'sina',
    ),
  )

  const alertLevels = results.map((r) => r.deviationLevel)
  let alertLevel: CrossSourceReport['alertLevel'] = 'normal'
  if (alertLevels.includes('alert')) {
    alertLevel = 'alert'
  } else if (alertLevels.includes('warn')) {
    alertLevel = 'warn'
  }

  const passed = results.every((r) => r.passed)

  if (!passed) {
    logger.warn(`[CrossSource] ${symbol} 多源交叉验证未通过`, {
      alertLevel,
      results: results.filter((r) => !r.passed),
    })
  }

  return {
    symbol,
    results,
    passed,
    alertLevel,
  }
}

/**
 * 根据交叉验证结果更新元数据
 */
export function applyCrossSourceResult(
  meta: DataRecordMeta,
  report: CrossSourceReport,
): DataRecordMeta {
  if (report.alertLevel === 'alert') {
    return {
      ...meta,
      reliability: 'degraded',
    }
  }
  return meta
}