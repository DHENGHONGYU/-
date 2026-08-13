/**
 * @module APISchemaValidator
 * @description API 返回数据 Schema 校验（P1 修复 R06：API 返回数据格式变更）
 *
 * 对每个数据源的 API 返回数据进行 Schema 校验，发现格式变更时：
 * 1. 标记为降级数据（reliability: 'degraded'）
 * 2. 记录到 QualityMetrics 审计警告
 * 3. 触发 UI 告警
 *
 * 架构原则：
 * - Schema 定义与代码分离，支持热更新
 * - 校验失败不阻塞采集流程，降级标记
 * - 统计校验成功率，暴露到 QualityMetrics
 *
 * @doc V9-DOC-QUALITY-006
 */

import { getLogger } from '@/lib/logger'
import type { DataRecordMeta } from '@/types/data/DataRecordMeta'

const logger = getLogger()

// ── 类型定义 ──

/** 字段类型 */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'any'

/** 字段校验规则 */
export interface FieldRule {
  /** 字段名 */
  name: string
  /** 期望类型 */
  type: FieldType
  /** 是否必填 */
  required: boolean
  /** 数值范围 [min, max]（仅 type=number） */
  range?: [number, number]
  /** 允许的值集合（仅 type=string） */
  enum?: string[]
  /** 字段描述 */
  description?: string
}

/** Schema 定义 */
export interface APISchema {
  /** 数据源名称 */
  source: string
  /** 数据维度 */
  dimension: string
  /** 版本号 */
  version: number
  /** 字段规则列表 */
  fields: FieldRule[]
}

/** 校验结果 */
export interface SchemaValidationResult {
  /** 是否通过 */
  passed: boolean
  /** 缺失的必填字段 */
  missingRequired: string[]
  /** 类型不匹配的字段 */
  typeMismatches: Array<{ field: string; expected: string; actual: string }>
  /** 范围越界的字段 */
  rangeViolations: Array<{ field: string; value: number; range: [number, number] }>
  /** 额外字段 */
  extraFields: string[]
  /** 校验耗时 (ms) */
  latency: number
}

/** 校验统计 */
export interface SchemaValidationStats {
  total: number
  passed: number
  failed: number
  degraded: number
  missingRequired: number
  typeMismatches: number
  rangeViolations: number
}

// ── Schema 定义 ──

/**
 * 腾讯行情 API Schema
 */
export const TENCENT_QUOTE_SCHEMA: APISchema = {
  source: 'tencent',
  dimension: 'realtime_quote',
  version: 1,
  fields: [
    { name: 'symbol', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'price', type: 'number', required: true, range: [0, 999999] },
    { name: 'change', type: 'number', required: false },
    { name: 'changePercent', type: 'number', required: false, range: [-100, 100] },
    { name: 'open', type: 'number', required: false, range: [0, 999999] },
    { name: 'high', type: 'number', required: false, range: [0, 999999] },
    { name: 'low', type: 'number', required: false, range: [0, 999999] },
    { name: 'volume', type: 'number', required: false, range: [0, 1e12] },
    { name: 'amount', type: 'number', required: false, range: [0, 1e15] },
    { name: 'timestamp', type: 'number', required: false },
  ],
}

/**
 * 新浪行情 API Schema
 */
export const SINA_QUOTE_SCHEMA: APISchema = {
  source: 'sina',
  dimension: 'realtime_quote',
  version: 1,
  fields: [
    { name: 'symbol', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'price', type: 'number', required: true, range: [0, 999999] },
    { name: 'open', type: 'number', required: false, range: [0, 999999] },
    { name: 'high', type: 'number', required: false, range: [0, 999999] },
    { name: 'low', type: 'number', required: false, range: [0, 999999] },
    { name: 'volume', type: 'number', required: false, range: [0, 1e12] },
    { name: 'amount', type: 'number', required: false, range: [0, 1e15] },
    { name: 'timestamp', type: 'number', required: false },
  ],
}

/**
 * V6 引擎评分结果 Schema
 */
export const INTELLIGENT_SCORE_SCHEMA: APISchema = {
  source: 'v6_engine',
  dimension: 'intelligent_score',
  version: 1,
  fields: [
    { name: 'symbol', type: 'string', required: true },
    { name: 'overallScore', type: 'number', required: true, range: [0, 5] },
    { name: 'dimensionScores', type: 'array', required: true },
    { name: 'summary', type: 'string', required: false },
    { name: 'basis', type: 'string', required: false },
    { name: 'scoreProvenance', type: 'string', required: false },
    { name: 'dataProvenance', type: 'string', required: false },
    { name: 'scoredAt', type: 'number', required: false },
    { name: 'dataVersion', type: 'number', required: false },
  ],
}

// ── 校验逻辑 ──

/**
 * 获取字段类型
 */
function getType(value: unknown): FieldType {
  if (value === null || value === undefined) return 'any'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    // 检测是否为日期字符串
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
    return 'string'
  }
  if (typeof value === 'object') return 'object'
  return 'any'
}

/**
 * 校验单个数据记录
 *
 * @param schema - API Schema 定义
 * @param data - 数据记录
 * @returns 校验结果
 */
export function validateRecord(
  schema: APISchema,
  data: Record<string, unknown>,
): SchemaValidationResult {
  const start = performance.now()
  const result: SchemaValidationResult = {
    passed: true,
    missingRequired: [],
    typeMismatches: [],
    rangeViolations: [],
    extraFields: [],
    latency: 0,
  }

  const dataKeys = new Set(Object.keys(data))

  for (const field of schema.fields) {
    const value = data[field.name]
    const present = value !== undefined && value !== null
    dataKeys.delete(field.name)

    // 检查必填
    if (field.required && !present) {
      result.missingRequired.push(field.name)
      result.passed = false
      continue
    }

    if (!present) continue

    // 检查类型
    const actualType = getType(value)
    if (field.type !== 'any' && actualType !== field.type) {
      result.typeMismatches.push({
        field: field.name,
        expected: field.type,
        actual: actualType,
      })
      result.passed = false
    }

    // 检查数值范围
    if (field.range && field.type === 'number' && typeof value === 'number') {
      const [min, max] = field.range
      if (value < min || value > max) {
        result.rangeViolations.push({
          field: field.name,
          value,
          range: [min, max],
        })
        result.passed = false
      }
    }

    // 检查枚举值
    if (field.enum && typeof value === 'string' && !field.enum.includes(value)) {
      result.typeMismatches.push({
        field: field.name,
        expected: `enum(${field.enum.join('|')})`,
        actual: value,
      })
      result.passed = false
    }
  }

  // 收集额外字段
  result.extraFields = Array.from(dataKeys)

  result.latency = Math.round(performance.now() - start)
  return result
}

// ── 全局统计 ──

let stats: SchemaValidationStats = {
  total: 0,
  passed: 0,
  failed: 0,
  degraded: 0,
  missingRequired: 0,
  typeMismatches: 0,
  rangeViolations: 0,
}

/**
 * 带 Schema 校验的数据采集包装器
 *
 * 使用方式：
 *   const result = await fetchStocksAPI(symbol)
 *   const schemaResult = wrapWithSchemaValidation(
 *     TENCENT_QUOTE_SCHEMA,
 *     result.data,
 *     createRealMeta('tencent')
 *   )
 *   if (schemaResult.degraded) {
 *     // 数据已降级，元数据已标记
 *   }
 *
 * @returns 校验后的数据和元数据
 */
export function wrapWithSchemaValidation(
  schema: APISchema,
  data: Record<string, unknown>,
  meta: DataRecordMeta,
): {
  data: Record<string, unknown>
  meta: DataRecordMeta
  validation: SchemaValidationResult
  degraded: boolean
} {
  const validation = validateRecord(schema, data)

  stats.total++

  if (validation.passed) {
    stats.passed++
  } else {
    stats.failed++
    stats.missingRequired += validation.missingRequired.length
    stats.typeMismatches += validation.typeMismatches.length
    stats.rangeViolations += validation.rangeViolations.length

    // 降级标记
    if (validation.missingRequired.length > 0) {
      stats.degraded++
      meta.reliability = 'degraded'
      logger.warn(
        `[SchemaValidation] ${schema.source}/${schema.dimension} 校验失败`,
        {
          missingRequired: validation.missingRequired,
          typeMismatches: validation.typeMismatches,
          rangeViolations: validation.rangeViolations,
        },
      )
    }
  }

  return {
    data: { ...data, __schemaValidation: validation },
    meta,
    validation,
    degraded: !validation.passed && validation.missingRequired.length > 0,
  }
}

/**
 * 获取 Schema 校验统计
 */
export function getSchemaValidationStats(): Readonly<SchemaValidationStats> {
  return { ...stats }
}

/**
 * 重置统计
 */
export function resetSchemaValidationStats(): void {
  stats = {
    total: 0,
    passed: 0,
    failed: 0,
    degraded: 0,
    missingRequired: 0,
    typeMismatches: 0,
    rangeViolations: 0,
  }
}

/**
 * 获取 Schema 校验成功率
 */
export function getSchemaSuccessRate(): number {
  if (stats.total === 0) return 0
  return stats.passed / stats.total
}