/**
 * 跨源交叉验证层 (Cross-Validator)
 * =============================================
 * 对采集数据进行双源对比验证，偏差 > 1% 触发告警。
 * 方案 D — 多源聚合去重 Layer 3
 *
 * @module crossValidator
 * @doc [V9-DOC-DATA-050]
 */

import type { QuoteDataSourceId } from '@/types/modules/collection.types'

// ============================================================
// 类型定义
// ============================================================

/** 交叉验证配置 */
export interface CrossValidationConfig {
  /** 允许的最大偏差比率 (默认 0.01 = 1%) */
  maxDeviationRatio: number
  /** 是否启用交叉验证 */
  enabled: boolean
  /** 至少需要的源数量 */
  minSources: number
}

/** 单字段验证结果 */
export interface FieldValidationResult {
  field: string
  /** 各源的值 */
  values: Record<string, number>
  /** 偏差比率 */
  deviationRatio: number
  /** 是否通过 */
  passed: boolean
  /** 警告信息 */
  warning?: string
}

/** 交叉验证总体结果 */
export interface CrossValidationResult {
  symbol: string
  dimension: string
  /** 各源数据 */
  sources: Record<string, Record<string, unknown>>
  /** 字段级验证结果 */
  fields: FieldValidationResult[]
  /** 总体是否通过 */
  passed: boolean
  /** 可信数据源 */
  trustedSource: QuoteDataSourceId | null
  /** 告警 */
  alerts: string[]
  /** 时间戳 */
  timestamp: number
}

// ============================================================
// 默认配置
// ============================================================

export const DEFAULT_CROSS_VALIDATION_CONFIG: CrossValidationConfig = {
  maxDeviationRatio: 0.01, // 1%
  enabled: true,
  minSources: 2,
}

// ============================================================
// 核心验证函数
// ============================================================

/**
 * 对同一维度多个数据源的结果进行交叉验证。
 *
 * @param symbol 标的代码
 * @param dimension 维度 code
 * @param sourceData 各源数据映射 { sourceId: { field: value } }
 * @param config 验证配置
 * @returns 交叉验证结果
 */
export function crossValidate(
  symbol: string,
  dimension: string,
  sourceData: Record<string, Record<string, unknown>>,
  config: CrossValidationConfig = DEFAULT_CROSS_VALIDATION_CONFIG,
): CrossValidationResult {
  const sources = Object.keys(sourceData)
  const alerts: string[] = []
  const fieldResults: FieldValidationResult[] = []

  // 源数量不足
  if (sources.length < config.minSources) {
    alerts.push(`源数量不足: ${sources.length} < ${config.minSources}，无法交叉验证`)
    return {
      symbol,
      dimension,
      sources: sourceData,
      fields: [],
      passed: false,
      trustedSource: sources.length > 0 ? (sources[0] as QuoteDataSourceId) : null,
      alerts,
      timestamp: Date.now(),
    }
  }

  // 收集所有数值字段
  const numericFields = collectNumericFields(sourceData)
  if (numericFields.length === 0) {
    alerts.push('无可验证的数值字段')
    return {
      symbol,
      dimension,
      sources: sourceData,
      fields: [],
      passed: true,
      trustedSource: sources[0] as QuoteDataSourceId,
      alerts,
      timestamp: Date.now(),
    }
  }

  // 逐字段验证
  let totalPassed = 0

  for (const field of numericFields) {
    const values = extractFieldValues(sourceData, field)
    const validValues = Object.values(values).filter(v => v !== null && v !== undefined)

    if (validValues.length < 2) {
      continue // 跳过单源字段
    }

    const maxVal = Math.max(...validValues)
    const minVal = Math.min(...validValues)
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length

    // 偏差比率 = (max - min) / |avg|  (当 avg 接近 0 时使用 max - min)
    const deviationRatio = Math.abs(avg) > 1e-6
      ? (maxVal - minVal) / Math.abs(avg)
      : maxVal - minVal

    const passed = deviationRatio <= config.maxDeviationRatio
    let warning: string | undefined

    if (!passed) {
      warning = `[${field}] 偏差 ${(deviationRatio * 100).toFixed(2)}% > ${(config.maxDeviationRatio * 100).toFixed(0)}%，源值: ${JSON.stringify(values)}`
      alerts.push(warning)
    } else {
      totalPassed++
    }

    fieldResults.push({
      field,
      values: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v ?? 0]),
      ),
      deviationRatio,
      passed,
      warning,
    })
  }

  // 确定可信数据源 (偏差最小的源)
  const trustedSource = determineTrustedSource(fieldResults, sources)

  return {
    symbol,
    dimension,
    sources: sourceData,
    fields: fieldResults,
    passed: alerts.length === 0,
    trustedSource: trustedSource as QuoteDataSourceId,
    alerts,
    timestamp: Date.now(),
  }
}

// ============================================================
// 工具函数
// ============================================================

/** 收集所有源中数值类型的字段名 */
function collectNumericFields(
  sourceData: Record<string, Record<string, unknown>>,
): string[] {
  const fieldSet = new Set<string>()

  for (const data of Object.values(sourceData)) {
    if (!data || typeof data !== 'object') continue
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number' && !isNaN(value)) {
        fieldSet.add(key)
      }
    }
  }

  return Array.from(fieldSet)
}

/** 提取指定字段在各源中的值 */
function extractFieldValues(
  sourceData: Record<string, Record<string, unknown>>,
  field: string,
): Record<string, number | null> {
  const values: Record<string, number | null> = {}

  for (const [source, data] of Object.entries(sourceData)) {
    if (!data || typeof data !== 'object') {
      values[source] = null
      continue
    }
    const val = data[field]
    values[source] = typeof val === 'number' ? val : null
  }

  return values
}

/** 确定可信数据源 (累积偏差最小的源) */
function determineTrustedSource(
  fieldResults: FieldValidationResult[],
  sources: string[],
): string | null {
  if (sources.length === 0) return null
  if (sources.length === 1) return sources[0] ?? null

  const sourceDeviation: Record<string, number> = {}
  for (const source of sources) {
    sourceDeviation[source] = 0
  }

  for (const fr of fieldResults) {
    const values = Object.values(fr.values)
    if (values.length < 2) continue

    const avg = values.reduce((a, b) => a + b, 0) / values.length
    for (const [source, val] of Object.entries(fr.values)) {
      if (Math.abs(avg) > 1e-6) {
        const current = sourceDeviation[source]
        if (current !== undefined) {
          sourceDeviation[source] = current + Math.abs(val - avg) / Math.abs(avg)
        }
      }
    }
  }

  // 偏差最小的源
  return Object.entries(sourceDeviation).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null
}

// ============================================================
// 便捷函数
// ============================================================

/**
 * 对行情数据做双源交叉验证 (腾讯 vs 新浪)
 */
export function validateQuoteData(
  symbol: string,
  tencentData: Record<string, unknown>,
  sinaData: Record<string, unknown>,
): CrossValidationResult {
  return crossValidate(symbol, '01', {
    tencent: tencentData,
    sina: sinaData,
  })
}

/**
 * 对 K 线数据做双源交叉验证 (腾讯 vs 东财)
 */
export function validateKlineData(
  symbol: string,
  tencentData: Record<string, unknown>,
  eastmoneyData: Record<string, unknown>,
): CrossValidationResult {
  return crossValidate(symbol, '02', {
    tencent: tencentData,
    eastmoney: eastmoneyData,
  })
}

/**
 * 批量交叉验证
 */
export function batchCrossValidate(
  validations: Array<{
    symbol: string
    dimension: string
    sourceData: Record<string, Record<string, unknown>>
  }>,
  config?: CrossValidationConfig,
): CrossValidationResult[] {
  return validations.map(v => crossValidate(v.symbol, v.dimension, v.sourceData, config))
}

// ============================================================
// 导出
// ============================================================

export { extractFieldValues, collectNumericFields }