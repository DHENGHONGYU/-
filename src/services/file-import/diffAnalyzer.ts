/**
 * @fileoverview 差异分析引擎
 *
 * 将文件解析后的数据与 IndexedDB 现有数据逐记录比对，
 * 生成字段级差异报告，支持：
 * - 新增/修改/删除/未变化/冲突 五种状态识别
 * - 字段级 diff（值变化/空→值/值→空/类型不匹配）
 * - 严重度评估（critical/warning/info）
 * - 整体建议输出
 *
 * @module services/file-import/diffAnalyzer
 * @created 2026-07-14 - 双通道整改 P0-3
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type {
  DiffAnalysisResult,
  DiffSeverity,
  FieldDiff,
  FieldDiffStat,
  FieldDiffType,
  RecordDiff,
  RecordDiffStatus,
} from '@/types/modules/data-sync.types'
import { compareHashes } from './hashComparator'

const logger = getLogger()

/** 主键字段名 */
const PRIMARY_KEY = 'symbol'

/** 备选主键字段名 */
const ALT_PRIMARY_KEYS = ['code', 'stockCode', 'id']

/** 关键字段（冲突时标记为 critical） */
const CRITICAL_FIELDS: ReadonlySet<string> = new Set([
  'symbol', 'code', 'stockCode', 'price', 'date', 'tradeDate', 'open', 'close', 'high', 'low',
])

/** 财务字段（冲突时标记为 warning） */
const WARNING_FIELDS: ReadonlySet<string> = new Set([
  'roe', 'revenue', 'netProfit', 'pe', 'pb', 'eps', 'marketCap', 'revenueGrowth',
  'profitGrowth', 'grossMargin', 'netMargin', 'debtRatio',
])

// ============================================================
// 工具函数
// ============================================================

/**
 * 从记录中提取主键值
 * @param record - 数据记录
 * @returns 主键值（字符串），未找到返回空字符串
 */
function extractPrimaryKey(record: Record<string, unknown>): string {
  for (const key of [PRIMARY_KEY, ...ALT_PRIMARY_KEYS]) {
    const val = record[key]
    if (val !== undefined && val !== null) {
      const str = typeof val === 'string' || typeof val === 'number' ? String(val) : ''
      if (str.trim() !== '') return str.trim()
    }
  }
  return ''
}

/**
 * 深度比较两个值是否相等
 * @param a - 值 A
 * @param b - 值 B
 * @returns 是否相等
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    const objA = a as Record<string, unknown>
    const objB = b as Record<string, unknown>
    const keysA = Object.keys(objA)
    const keysB = Object.keys(objB)
    if (keysA.length !== keysB.length) return false
    return keysA.every(k => deepEqual(objA[k], objB[k]))
  }

  return false
}

/**
 * 判断字段差异类型
 * @param existingVal - 现有值
 * @param newVal - 新值
 * @returns 差异类型
 */
function classifyDiff(existingVal: unknown, newVal: unknown): FieldDiffType {
  if (existingVal == null && newVal != null) return 'null-to-value'
  if (existingVal != null && newVal == null) return 'value-to-null'
  if (typeof existingVal !== typeof newVal) return 'type-mismatch'
  return 'value-changed'
}

/**
 * 评估字段差异严重度
 * @param fieldName - 字段名
 * @param diffType - 差异类型
 * @returns 严重度
 */
function assessSeverity(fieldName: string, diffType: FieldDiffType): DiffSeverity {
  if (diffType === 'type-mismatch') return 'critical'
  if (CRITICAL_FIELDS.has(fieldName)) return 'critical'
  if (WARNING_FIELDS.has(fieldName)) return 'warning'
  return 'info'
}

/**
 * 比较两条记录的字段差异
 * @param existing - 现有记录
 * @param incoming - 新记录
 * @returns 字段差异数组
 */
function compareFields(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): FieldDiff[] {
  const diffs: FieldDiff[] = []
  const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)])

  for (const key of allKeys) {
    // 跳过元数据字段
    if (['lastUpdated', 'dataVersion', 'timestamp', '_meta', 'createdAt', 'updatedAt'].includes(key)) {
      continue
    }

    const existingVal = existing[key]
    const newVal = incoming[key]

    if (deepEqual(existingVal, newVal)) continue

    const diffType = classifyDiff(existingVal, newVal)
    const severity = assessSeverity(key, diffType)

    diffs.push({
      fieldName: key,
      existingValue: existingVal,
      newValue: newVal,
      diffType,
      severity,
    })
  }

  return diffs
}

/**
 * 统计字段差异
 * @param recordDiffs - 记录差异数组
 * @returns 字段差异统计
 */
function computeFieldStats(recordDiffs: readonly RecordDiff[]): FieldDiffStat[] {
  const statsMap = new Map<string, { changeCount: number; conflictCount: number }>()

  for (const record of recordDiffs) {
    if (!record.fieldDiffs) continue
    for (const field of record.fieldDiffs) {
      const existing = statsMap.get(field.fieldName) ?? { changeCount: 0, conflictCount: 0 }
      existing.changeCount++
      if (field.severity === 'critical') {
        existing.conflictCount++
      }
      statsMap.set(field.fieldName, existing)
    }
  }

  return Array.from(statsMap.entries())
    .map(([fieldName, stats]) => ({
      fieldName,
      changeCount: stats.changeCount,
      conflictCount: stats.conflictCount,
    }))
    .sort((a, b) => b.changeCount - a.changeCount)
}

/**
 * 判断记录差异状态
 * @param fieldDiffs - 字段差异数组
 * @returns 记录状态
 */
function determineRecordStatus(fieldDiffs: readonly FieldDiff[]): RecordDiffStatus {
  if (fieldDiffs.length === 0) return 'unchanged'
  const hasConflict = fieldDiffs.some(d => d.severity === 'critical')
  return hasConflict ? 'conflict' : 'modified'
}

/**
 * 生成整体建议
 * @param summary - 比对摘要
 * @returns 建议操作
 */
function generateRecommendation(summary: DiffAnalysisResult['summary']): DiffAnalysisResult['recommendation'] {
  const { totalRecords, conflictRecords, newRecords } = summary
  if (totalRecords === 0) return 'abort'

  const conflictRatio = conflictRecords / totalRecords
  if (conflictRatio > 0.5) return 'abort'

  if (conflictRecords > 0) return 'review-conflicts'
  if (newRecords > 0 && summary.modifiedRecords === 0) return 'import-new-only'
  return 'import-all'
}

// ============================================================
// 主分析入口
// ============================================================

/**
 * 分析文件数据与现有数据的差异
 *
 * @param newRecords - 文件解析后的新记录数组
 * @param existingRecords - IndexedDB 中的现有记录数组
 * @returns 差异分析结果
 *
 * @example
 * ```typescript
 * const result = await analyzeDiff(parsedData.records, existingStocks)
 * if (result.recommendation === 'review-conflicts') {
 *   // 展示冲突解决面板
 * }
 * ```
 */
export async function analyzeDiff(
  newRecords: readonly Record<string, unknown>[],
  existingRecords: readonly Record<string, unknown>[],
): Promise<DiffAnalysisResult> {
  const startTime = performance.now()

  // 构建现有数据映射（主键 → 记录）
  const existingMap = new Map<string, Record<string, unknown>>()
  for (const record of existingRecords) {
    const key = extractPrimaryKey(record)
    if (key) {
      existingMap.set(key, record)
    }
  }

  // 构建新数据主键集合
  const newKeys = new Set<string>()
  for (const record of newRecords) {
    const pk = extractPrimaryKey(record)
    if (pk) newKeys.add(pk)
  }

  // 逐记录比对
  const recordDiffs: RecordDiff[] = []

  // 新数据 vs 现有数据
  for (const newRecord of newRecords) {
    const key = extractPrimaryKey(newRecord)
    if (!key) continue

    const existing = existingMap.get(key)
    if (!existing) {
      // 新增
      recordDiffs.push({
        symbol: key,
        status: 'added',
        newData: newRecord,
      })
    } else {
      // 比较字段
      const fieldDiffs = compareFields(existing, newRecord)
      const status = determineRecordStatus(fieldDiffs)
      recordDiffs.push({
        symbol: key,
        status,
        existingData: existing,
        newData: newRecord,
        fieldDiffs,
      })
    }
  }

  // 检测删除（现有有但新数据没有）
  for (const [key, existing] of existingMap) {
    if (!newKeys.has(key)) {
      recordDiffs.push({
        symbol: key,
        status: 'deleted',
        existingData: existing,
      })
    }
  }

  // 统计摘要
  const summary = {
    totalRecords: newRecords.length,
    newRecords: recordDiffs.filter(r => r.status === 'added').length,
    modifiedRecords: recordDiffs.filter(r => r.status === 'modified').length,
    unchangedRecords: recordDiffs.filter(r => r.status === 'unchanged').length,
    deletedRecords: recordDiffs.filter(r => r.status === 'deleted').length,
    conflictRecords: recordDiffs.filter(r => r.status === 'conflict').length,
  }

  // 字段统计
  const fieldStats = computeFieldStats(recordDiffs)

  // 建议
  const recommendation = generateRecommendation(summary)

  const elapsed = performance.now() - startTime
  logger.info('[analyzeDiff] 差异分析完成', {
    ...summary,
    elapsedMs: Math.round(elapsed),
    recommendation,
  })

  return {
    summary,
    recordDiffs,
    fieldStats,
    recommendation,
  }
}

/**
 * 快速差异检测（仅用哈希，不做字段级比对）
 *
 * 性能优于 analyzeDiff，但无法提供字段级差异详情。
 * 适用于大文件初次扫描。
 *
 * @param newRecords - 新记录数组
 * @param existingRecords - 现有记录数组
 * @returns 变更记录的 symbol 列表
 */
export async function quickDiff(
  newRecords: readonly Record<string, unknown>[],
  existingRecords: readonly Record<string, unknown>[],
): Promise<readonly string[]> {
  const result = await compareHashes(newRecords, existingRecords)
  return result.changedRecords
}
