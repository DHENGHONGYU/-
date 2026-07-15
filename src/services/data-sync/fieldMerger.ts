/**
 * @fileoverview 字段级合并器
 *
 * 实现双通道数据的字段级合并策略：
 * - take-newer: 取新值
 * - take-non-null: 取非空值
 * - take-higher-priority: 按数据源优先级取值
 * - take-average: 取平均值
 * - manual: 标记为冲突，需人工确认
 *
 * @module services/data-sync/fieldMerger
 * @created 2026-07-14 - 双通道整改 P1-3
 */

import { getLogger } from '@/lib/logger'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'
import type { FieldDiff, MergeResult, MergeRule } from '@/types/modules/data-sync.types'

const logger = getLogger()

/**
 * 深度比较两个值是否相等
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
 * 合并两条记录的字段
 *
 * 根据合并规则逐字段处理，返回合并后的记录和未解决的冲突。
 *
 * @param existing - 现有记录
 * @param incoming - 新记录
 * @param rules - 合并规则数组
 * @param context - 合并上下文（数据源等）
 * @returns 合并结果（merged 记录 + conflicts 列表）
 */
export function mergeRecords(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  rules: readonly MergeRule[],
  context: { dataSource?: QuoteDataSourceId; timestamp: string },
): MergeResult {
  const merged: Record<string, unknown> = { ...existing }
  const conflicts: FieldDiff[] = []

  for (const rule of rules) {
    const existingVal = existing[rule.fieldName]
    const incomingVal = incoming[rule.fieldName]

    // 值相同 → 无冲突
    if (deepEqual(existingVal, incomingVal)) continue

    // 现有值不存在 → 直接取新值
    if (existingVal === undefined) {
      merged[rule.fieldName] = incomingVal
      continue
    }

    // 新值不存在 → 保留现有
    if (incomingVal === undefined) continue

    switch (rule.strategy) {
      case 'take-newer':
        merged[rule.fieldName] = incomingVal
        break

      case 'take-non-null':
        if (existingVal == null) {
          merged[rule.fieldName] = incomingVal
        } else if (incomingVal != null) {
          // 都非空 → 冲突
          conflicts.push({
            fieldName: rule.fieldName,
            existingValue: existingVal,
            newValue: incomingVal,
            diffType: 'value-changed',
            severity: 'warning',
          })
        }
        break

      case 'take-higher-priority': {
        // 比较数据源优先级（优先级数组中索引越小优先级越高）
        const existingPriority = rule.priority?.indexOf(context.dataSource as QuoteDataSourceId) ?? -1
        const incomingPriority = rule.priority?.indexOf(
          (incoming.__source as QuoteDataSourceId) ?? context.dataSource ?? 'mock',
        ) ?? -1
        if (incomingPriority <= existingPriority && incomingPriority >= 0) {
          merged[rule.fieldName] = incomingVal
        }
        break
      }

      case 'take-average':
        if (typeof existingVal === 'number' && typeof incomingVal === 'number') {
          merged[rule.fieldName] = (existingVal + incomingVal) / 2
        } else {
          merged[rule.fieldName] = incomingVal
        }
        break

      case 'manual':
        conflicts.push({
          fieldName: rule.fieldName,
          existingValue: existingVal,
          newValue: incomingVal,
          diffType: 'value-changed',
          severity: 'critical',
        })
        break
    }
  }

  // 合并新记录中存在但现有记录和规则中都不存在的字段
  for (const key of Object.keys(incoming)) {
    if (existing[key] === undefined && merged[key] === undefined) {
      merged[key] = incoming[key]
    }
  }

  logger.info('[mergeRecords] 字段合并完成', {
    fieldCount: rules.length,
    conflictCount: conflicts.length,
    strategy: 'field-level',
  })

  return { merged, conflicts }
}

/**
 * 默认合并规则（按数据类型）
 */
export const DEFAULT_MERGE_RULES: Record<string, readonly MergeRule[]> = {
  stocks: [
    { fieldName: 'price', strategy: 'take-newer' },
    { fieldName: 'name', strategy: 'take-non-null' },
    { fieldName: 'pe', strategy: 'take-higher-priority', priority: ['tencent', 'sina', 'mock'] },
    { fieldName: 'pb', strategy: 'take-higher-priority', priority: ['tencent', 'sina', 'mock'] },
    { fieldName: 'marketCap', strategy: 'take-newer' },
    { fieldName: 'industry', strategy: 'take-non-null' },
  ],
  dailyQuotes: [
    { fieldName: 'open', strategy: 'take-newer' },
    { fieldName: 'close', strategy: 'take-newer' },
    { fieldName: 'high', strategy: 'take-higher-priority', priority: ['tencent', 'sina'] },
    { fieldName: 'low', strategy: 'take-higher-priority', priority: ['tencent', 'sina'] },
    { fieldName: 'volume', strategy: 'take-newer' },
    { fieldName: 'amount', strategy: 'take-newer' },
  ],
  financialReports: [
    { fieldName: 'revenue', strategy: 'manual' },
    { fieldName: 'netProfit', strategy: 'manual' },
    { fieldName: 'roe', strategy: 'take-higher-priority', priority: ['akshare', 'ifind', 'tencent', 'sina'] },
    { fieldName: 'grossMargin', strategy: 'take-higher-priority', priority: ['akshare', 'ifind'] },
    { fieldName: 'debtRatio', strategy: 'take-higher-priority', priority: ['akshare', 'ifind'] },
  ],
}
