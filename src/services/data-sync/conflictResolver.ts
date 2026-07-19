/**
 * @fileoverview 冲突解决器
 *
 * 管理双通道数据采集时的冲突检测与解决，支持 6 种策略：
 * - last-write-wins: 最后写入胜出
 * - highest-priority: 按数据源优先级
 * - merge-fields: 字段级合并
 * - skip-if-newer: 现有数据更新则跳过
 * - ask-user: 人工确认
 * - keep-both: 保留两份版本
 *
 * @module services/data-sync/conflictResolver
 * @created 2026-07-14 - 双通道整改 P1-3
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'
import type {
  ConflictPolicy,
  FieldDiff,
  MergeResult,
  MergeRule,
  RecordDiff,
} from '@/types/modules/data-sync.types'
import { mergeRecords, DEFAULT_MERGE_RULES } from './fieldMerger'

const logger = getLogger()

/**
 * 将未知时间戳字段安全转换为字符串
 */
function toTimestampString(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

/**
 * 冲突检测结果
 */
export interface ConflictDetectionResult {
  /** 是否有冲突 */
  hasConflict: boolean
  /** 冲突类型 */
  conflictType: 'none' | 'time' | 'source' | 'field' | 'version'
  /** 冲突字段 */
  fieldDiffs: readonly FieldDiff[]
  /** 现有数据时间戳 */
  existingTimestamp?: string
  /** 新数据时间戳 */
  incomingTimestamp?: string
}

/**
 * 冲突解决结果
 */
export interface ConflictResolutionResult {
  /** 解决策略 */
  policy: ConflictPolicy
  /** 解决后的数据（null 表示跳过） */
  resolvedData: Record<string, unknown> | null
  /** 未解决的冲突（ask-user 时） */
  unresolvedConflicts: readonly FieldDiff[]
  /** 是否自动解决 */
  autoResolved: boolean
  /** 解决说明 */
  reason: string
}

/**
 * 检测两条记录之间的冲突
 *
 * @param existing - 现有记录
 * @param incoming - 新记录
 * @param keyFields - 关键字段列表（这些字段不一致视为冲突）
 * @returns 冲突检测结果
 */
export function detectConflict(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  keyFields: readonly string[] = ['symbol', 'price', 'date', 'open', 'close', 'high', 'low'],
): ConflictDetectionResult {
  const fieldDiffs: FieldDiff[] = []

  const existingTime = toTimestampString(existing.lastUpdated ?? existing.timestamp)
  const incomingTime = toTimestampString(incoming.lastUpdated ?? incoming.timestamp)

  // 时间冲突检测
  if (existingTime && incomingTime) {
    const existingDate = new Date(existingTime).getTime()
    const incomingDate = new Date(incomingTime).getTime()
    if (!Number.isNaN(existingDate) && !Number.isNaN(incomingDate)) {
      if (Math.abs(existingDate - incomingDate) < 60_000) {
        // 1分钟内视为时间冲突
        return {
          hasConflict: true,
          conflictType: 'time',
          fieldDiffs: [],
          existingTimestamp: existingTime,
          incomingTimestamp: incomingTime,
        }
      }
    }
  }

  // 字段冲突检测
  for (const field of keyFields) {
    const existingVal = existing[field]
    const incomingVal = incoming[field]

    if (existingVal === undefined && incomingVal === undefined) continue
    if (existingVal === undefined || incomingVal === undefined) continue

    if (existingVal !== incomingVal) {
      const severity = keyFields.includes(field) ? 'critical' : 'warning'
      fieldDiffs.push({
        fieldName: field,
        existingValue: existingVal,
        newValue: incomingVal,
        diffType: typeof existingVal !== typeof incomingVal ? 'type-mismatch' : 'value-changed',
        severity,
      })
    }
  }

  return {
    hasConflict: fieldDiffs.length > 0,
    conflictType: fieldDiffs.length > 0 ? 'field' : 'none',
    fieldDiffs,
    existingTimestamp: existingTime,
    incomingTimestamp: incomingTime,
  }
}

/**
 * 按策略解决冲突
 *
 * @param existing - 现有记录
 * @param incoming - 新记录
 * @param policy - 冲突处理策略
 * @param detection - 冲突检测结果
 * @param mergeRules - 合并规则（merge-fields 策略时使用）
 * @param context - 上下文（数据源等）
 * @returns 冲突解决结果
 */
export function resolveConflict(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  policy: ConflictPolicy,
  detection: ConflictDetectionResult,
  mergeRules?: readonly MergeRule[],
  context?: { dataSource?: QuoteDataSourceId },
): ConflictResolutionResult {
  const timestamp = new Date().toISOString()

  switch (policy) {
    case 'last-write-wins':
      return {
        policy,
        resolvedData: { ...incoming, lastUpdated: timestamp },
        unresolvedConflicts: [],
        autoResolved: true,
        reason: '最后写入胜出：采用新数据',
      }

    case 'highest-priority': {
      // 简化：新数据来自更高优先级源时采用，否则保留现有
      // 实际优先级比较应由调用方提供
      return {
        policy,
        resolvedData: { ...existing, ...incoming, lastUpdated: timestamp },
        unresolvedConflicts: [],
        autoResolved: true,
        reason: '按优先级合并：新数据字段覆盖现有',
      }
    }

    case 'merge-fields': {
      const rules = mergeRules ?? DEFAULT_MERGE_RULES['stocks'] ?? []
      const result: MergeResult = mergeRecords(existing, incoming, rules, {
        dataSource: context?.dataSource,
        timestamp,
      })
      const unresolved = result.conflicts
      return {
        policy,
        resolvedData: { ...result.merged, lastUpdated: timestamp },
        unresolvedConflicts: unresolved,
        autoResolved: unresolved.length === 0,
        reason: unresolved.length === 0
          ? '字段级合并完成，无冲突'
          : `字段级合并完成，${unresolved.length} 处冲突需人工确认`,
      }
    }

    case 'skip-if-newer': {
      const existingTime = detection.existingTimestamp
        ? new Date(detection.existingTimestamp).getTime()
        : 0
      const incomingTime = detection.incomingTimestamp
        ? new Date(detection.incomingTimestamp).getTime()
        : Date.now()

      if (existingTime > incomingTime) {
        return {
          policy,
          resolvedData: null, // 跳过
          unresolvedConflicts: [],
          autoResolved: true,
          reason: '现有数据更新，跳过新数据',
        }
      }
      return {
        policy,
        resolvedData: { ...incoming, lastUpdated: timestamp },
        unresolvedConflicts: [],
        autoResolved: true,
        reason: '新数据更新，采用新数据',
      }
    }

    case 'ask-user':
      return {
        policy,
        resolvedData: null, // 等待用户确认
        unresolvedConflicts: detection.fieldDiffs,
        autoResolved: false,
        reason: '需人工确认',
      }

    case 'keep-both':
      // 保留两份：现有不变，新数据标记为版本分支
      return {
        policy,
        resolvedData: { ...incoming, lastUpdated: timestamp, _versionBranch: true },
        unresolvedConflicts: [],
        autoResolved: true,
        reason: '保留两份：新数据标记为版本分支',
      }

    default:
      return {
        policy: 'last-write-wins',
        resolvedData: { ...incoming, lastUpdated: timestamp },
        unresolvedConflicts: [],
        autoResolved: true,
        reason: '默认策略：最后写入胜出',
      }
  }
}

/**
 * 批量解决冲突
 *
 * @param recordDiffs - 记录差异数组（来自 diffAnalyzer）
 * @param policy - 默认冲突处理策略
 * @param mergeRules - 合并规则
 * @returns 解决结果数组
 */
export function resolveConflictsBatch(
  recordDiffs: readonly RecordDiff[],
  policy: ConflictPolicy,
  mergeRules?: readonly MergeRule[],
): ReadonlyArray<{
  symbol: string
  resolution: ConflictResolutionResult
}> {
  const results: Array<{ symbol: string; resolution: ConflictResolutionResult }> = []

  for (const diff of recordDiffs) {
    if (diff.status !== 'conflict') continue
    if (!diff.existingData || !diff.newData) continue

    const detection = detectConflict(
      diff.existingData,
      diff.newData,
    )

    const resolution = resolveConflict(
      diff.existingData,
      diff.newData,
      policy,
      detection,
      mergeRules,
    )

    results.push({ symbol: diff.symbol, resolution })
  }

  logger.info('[resolveConflictsBatch] 批量冲突解决完成', {
    total: recordDiffs.length,
    resolved: results.length,
    autoResolved: results.filter(r => r.resolution.autoResolved).length,
  })

  return results
}
