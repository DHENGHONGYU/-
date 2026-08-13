/**
 * @module ParseAccuracyService
 * @description 数据解析准确率统计（P1 修复 R11：数据解析错误 / 字段映射错）
 *
 * 追踪从 API 原始响应 → 标准化记录的解析成功率：
 * 1. 记录解析前后的字段数
 * 2. 检测字段映射错误（空值率过高）
 * 3. 抽样校验（每 N 条做一次人工可读检查）
 *
 * @doc V9-DOC-QUALITY-011
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ── 类型定义 ──

/** 解析记录 */
export interface ParseRecord {
  source: string
  dimension: string
  symbol: string
  rawFields: number
  parsedFields: number
  mappedFields: number
  nullFields: number
  nullRate: number
  fieldsWithNull: string[]
  success: boolean
  error?: string
  timestamp: number
}

/** 解析统计 */
export interface ParseStats {
  total: number
  success: number
  failure: number
  avgNullRate: number
  avgParsedRatio: number
  /** 高空值率记录（>50%） */
  highNullCount: number
  /** 抽样记录 */
  sampleRecords: ParseRecord[]
}

// ── 全局状态 ──

let stats: ParseStats = {
  total: 0,
  success: 0,
  failure: 0,
  avgNullRate: 0,
  avgParsedRatio: 0,
  highNullCount: 0,
  sampleRecords: [],
}

const MAX_SAMPLE_RECORDS = 200
const SAMPLE_INTERVAL = 10 // 每 10 条采样一次

// ── 核心 API ──

/**
 * 记录一次解析操作
 *
 * 使用方式（在 directDataAPI.ts 或 tencentDataAdapter.ts 中）：
 *   const rawFields = Object.keys(apiResponse).length
 *   const parsed = adaptToStandardFormat(apiResponse)
 *   const parsedFields = Object.keys(parsed).length
 *   recordParse({ source: 'tencent', dimension: 'quote', symbol, rawFields, parsedFields, parsed })
 */
export function recordParse(params: {
  source: string
  dimension: string
  symbol: string
  rawFields: number
  parsedFields: number
  parsed: Record<string, unknown>
  error?: string
}): ParseRecord {
  const { source, dimension, symbol, rawFields, parsedFields, parsed, error } = params

  // 统计空值字段
  const fieldsWithNull: string[] = []
  let nullCount = 0
  if (!error) {
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null || value === undefined || value === '') {
        nullCount++
        fieldsWithNull.push(key)
      }
    }
  }

  const totalFields = Object.keys(parsed).length || 1
  const nullRate = nullCount / totalFields

  const record: ParseRecord = {
    source,
    dimension,
    symbol,
    rawFields,
    parsedFields,
    mappedFields: parsedFields,
    nullFields: nullCount,
    nullRate: parseFloat(nullRate.toFixed(4)),
    fieldsWithNull,
    success: !error,
    error,
    timestamp: Date.now(),
  }

  // 更新全局统计
  stats.total++
  if (record.success) {
    stats.success++
  } else {
    stats.failure++
  }

  // 更新平均空值率
  stats.avgNullRate = parseFloat(
    ((stats.avgNullRate * (stats.total - 1) + nullRate) / stats.total).toFixed(4),
  )

  // 更新平均解析率
  const parsedRatio = rawFields > 0 ? parsedFields / rawFields : 0
  stats.avgParsedRatio = parseFloat(
    ((stats.avgParsedRatio * (stats.total - 1) + parsedRatio) / stats.total).toFixed(4),
  )

  // 高控制率记录
  if (nullRate > 0.5) {
    stats.highNullCount++
    logger.warn(
      `[ParseAccuracy] ${source}/${dimension}/${symbol} 空值率 ${(nullRate * 100).toFixed(0)}%`,
      { fieldsWithNull: fieldsWithNull.slice(0, 10) },
    )
  }

  // 采样
  if (stats.total % SAMPLE_INTERVAL === 0) {
    stats.sampleRecords.push(record)
    if (stats.sampleRecords.length > MAX_SAMPLE_RECORDS) {
      stats.sampleRecords = stats.sampleRecords.slice(-MAX_SAMPLE_RECORDS)
    }
  }

  return record
}

/**
 * 获取解析统计
 */
export function getParseStats(): Readonly<ParseStats> {
  return { ...stats }
}

/**
 * 获取解析成功率
 */
export function getParseSuccessRate(): number {
  if (stats.total === 0) return 0
  return stats.success / stats.total
}

/**
 * 获取高风险记录（空值率 > 50%）
 */
export function getHighNullRecords(): ParseRecord[] {
  return stats.sampleRecords.filter((r) => r.nullRate > 0.5)
}

/**
 * 按数据源统计解析成功率
 */
export function getParseStatsBySource(source: string): {
  total: number
  success: number
  failure: number
  avgNullRate: number
} {
  const sourceRecords = stats.sampleRecords.filter((r) => r.source === source)
  if (sourceRecords.length === 0) {
    return { total: 0, success: 0, failure: 0, avgNullRate: 0 }
  }

  return {
    total: sourceRecords.length,
    success: sourceRecords.filter((r) => r.success).length,
    failure: sourceRecords.filter((r) => !r.success).length,
    avgNullRate: parseFloat(
      (sourceRecords.reduce((a, b) => a + b.nullRate, 0) / sourceRecords.length).toFixed(4),
    ),
  }
}

/**
 * 重置统计
 */
export function resetParseStats(): void {
  stats = {
    total: 0,
    success: 0,
    failure: 0,
    avgNullRate: 0,
    avgParsedRatio: 0,
    highNullCount: 0,
    sampleRecords: [],
  }
}

/**
 * 生成解析健康报告
 */
export function generateParseReport(): string {
  const parts: string[] = [
    `解析总数: ${stats.total}`,
    `成功率: ${(getParseSuccessRate() * 100).toFixed(1)}%`,
    `平均空值率: ${(stats.avgNullRate * 100).toFixed(1)}%`,
    `高控制率(>50%): ${stats.highNullCount} 条`,
    `平均字段映射率: ${(stats.avgParsedRatio * 100).toFixed(1)}%`,
  ]
  return parts.join(' | ')
}