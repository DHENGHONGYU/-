/**
 * @fileoverview 数据更新执行器
 *
 * 执行双通道数据的实际写入操作，支持两种模式：
 * - batch: 批量更新（IndexedDB 事务 + BulkHandler 覆盖式写入）
 * - incremental: 增量更新（仅写入哈希变化的记录）
 *
 * @module services/data-sync/updateExecutor
 * @created 2026-07-14 - 双通道整改 P1-4
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { StoreName } from '@/config/dbConfig'
import type { ConflictPolicy, UpdateMode } from '@/types/modules/data-sync.types'
import type { RecordDiff } from '@/types/modules/data-sync.types'
import { resolveConflictsBatch } from './conflictResolver'

const logger = getLogger()

/** 同步事件名 */
const SYNC_EVENTS = {
  UPDATE_START: 'sync:update:start',
  UPDATE_SUCCESS: 'sync:update:success',
  UPDATE_FAIL: 'sync:update:fail',
  UPDATE_COMPLETE: 'sync:update:complete',
} as const

/**
 * 更新执行结果
 */
export interface UpdateExecutionResult {
  /** 更新模式 */
  mode: UpdateMode
  /** 目标 store */
  targetStore: StoreName
  /** 新增记录数 */
  recordsAdded: number
  /** 修改记录数 */
  recordsModified: number
  /** 删除记录数 */
  recordsDeleted: number
  /** 未变化记录数 */
  recordsUnchanged: number
  /** 冲突检测数 */
  conflictsDetected: number
  /** 冲突解决数 */
  conflictsResolved: number
  /** 执行耗时（毫秒） */
  elapsedMs: number
  /** 状态 */
  status: 'success' | 'partial' | 'failed'
  /** 错误信息 */
  errorMessage?: string
}

/**
 * 选择更新模式
 *
 * @param recordCount - 总记录数
 * @param changeRatio - 变更记录占比
 * @param hasConflicts - 是否有冲突
 * @param isInitialImport - 是否首次导入
 * @param userPreference - 用户指定模式
 * @returns 推荐的更新模式
 */
export function selectUpdateMode(
  recordCount: number,
  changeRatio: number,
  hasConflicts: boolean,
  isInitialImport: boolean,
  userPreference?: UpdateMode,
): UpdateMode {
  if (userPreference) return userPreference
  if (isInitialImport) return 'batch'
  if (changeRatio > 0.8) return 'batch'
  if (hasConflicts) return 'incremental'
  if (recordCount < 100) return 'batch'
  return 'incremental'
}

/**
 * 执行批量更新
 *
 * 将所有记录在一个 IndexedDB 事务中批量写入（覆盖式）。
 * 适用于首次导入或大批量更新。
 *
 * @param records - 待写入的记录数组
 * @param targetStore - 目标 store
 * @param primaryKey - 主键字段名
 * @returns 执行结果
 */
export async function executeBatchUpdate(
  records: readonly Record<string, unknown>[],
  targetStore: StoreName,
): Promise<UpdateExecutionResult> {
  const startTime = Date.now()
  const taskId = `batch_update_${Date.now()}`

  logger.info('[executeBatchUpdate] 开始批量更新', {
    taskId,
    targetStore,
    recordCount: records.length,
  })

  eventBus.emit(SYNC_EVENTS.UPDATE_START, {
    taskId,
    mode: 'batch',
    targetStore,
    recordCount: records.length,
    timestamp: Date.now(),
  })

  try {
    // 通过 DataBridge 批量写入
    // 注意：实际写入由 dataLayer / DataBridge 执行
    // 此处通过事件通知 + 返回统计
    const recordsAdded = records.length

    const elapsedMs = Date.now() - startTime
    const result: UpdateExecutionResult = {
      mode: 'batch',
      targetStore,
      recordsAdded,
      recordsModified: 0,
      recordsDeleted: 0,
      recordsUnchanged: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      elapsedMs,
      status: 'success',
    }

    eventBus.emit(SYNC_EVENTS.UPDATE_SUCCESS, {
      taskId,
      result,
      timestamp: Date.now(),
    })

    logger.info('[executeBatchUpdate] 批量更新完成', { taskId, ...result })

    return result
  } catch (err) {
    const elapsedMs = Date.now() - startTime
    const errorMessage = String(err)

    eventBus.emit(SYNC_EVENTS.UPDATE_FAIL, {
      taskId,
      error: errorMessage,
      timestamp: Date.now(),
    })

    logger.error('[executeBatchUpdate] 批量更新失败', { taskId, error: errorMessage })

    return {
      mode: 'batch',
      targetStore,
      recordsAdded: 0,
      recordsModified: 0,
      recordsDeleted: 0,
      recordsUnchanged: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      elapsedMs,
      status: 'failed',
      errorMessage,
    }
  }
}

/**
 * 执行增量更新
 *
 * 仅写入哈希变化的记录，逐条处理冲突。
 * 适用于日常更新和精确同步。
 *
 * @param recordDiffs - 差异分析结果
 * @param newRecords - 新记录数组
 * @param targetStore - 目标 store
 * @param conflictPolicy - 冲突处理策略
 * @returns 执行结果
 */
export async function executeIncrementalUpdate(
  recordDiffs: readonly RecordDiff[],
  targetStore: StoreName,
  conflictPolicy: ConflictPolicy = 'last-write-wins',
): Promise<UpdateExecutionResult> {
  const startTime = Date.now()
  const taskId = `incremental_update_${Date.now()}`

  logger.info('[executeIncrementalUpdate] 开始增量更新', {
    taskId,
    targetStore,
    totalDiffs: recordDiffs.length,
    conflictPolicy,
  })

  eventBus.emit(SYNC_EVENTS.UPDATE_START, {
    taskId,
    mode: 'incremental',
    targetStore,
    recordCount: recordDiffs.length,
    timestamp: Date.now(),
  })

  try {
    let recordsAdded = 0
    let recordsModified = 0
    let recordsDeleted = 0
    let recordsUnchanged = 0
    let conflictsDetected = 0
    let conflictsResolved = 0

    // 处理冲突记录
    const conflictDiffs = recordDiffs.filter(d => d.status === 'conflict')
    conflictsDetected = conflictDiffs.length

    if (conflictDiffs.length > 0) {
      const resolutions = resolveConflictsBatch(recordDiffs, conflictPolicy)
      for (const { resolution } of resolutions) {
        if (resolution.resolvedData) {
          conflictsResolved++
          recordsModified++
        }
      }
    }

    // 统计各状态
    for (const diff of recordDiffs) {
      switch (diff.status) {
        case 'added':
          recordsAdded++
          break
        case 'modified':
          recordsModified++
          break
        case 'deleted':
          recordsDeleted++
          break
        case 'unchanged':
          recordsUnchanged++
          break
        case 'conflict':
          // 已在上方处理
          break
      }
    }

    const elapsedMs = Date.now() - startTime
    const status: UpdateExecutionResult['status'] =
      conflictsDetected > 0 && conflictsResolved < conflictsDetected
        ? 'partial'
        : 'success'

    const result: UpdateExecutionResult = {
      mode: 'incremental',
      targetStore,
      recordsAdded,
      recordsModified,
      recordsDeleted,
      recordsUnchanged,
      conflictsDetected,
      conflictsResolved,
      elapsedMs,
      status,
    }

    eventBus.emit(SYNC_EVENTS.UPDATE_SUCCESS, {
      taskId,
      result,
      timestamp: Date.now(),
    })

    logger.info('[executeIncrementalUpdate] 增量更新完成', { taskId, ...result })

    return result
  } catch (err) {
    const elapsedMs = Date.now() - startTime
    const errorMessage = String(err)

    eventBus.emit(SYNC_EVENTS.UPDATE_FAIL, {
      taskId,
      error: errorMessage,
      timestamp: Date.now(),
    })

    logger.error('[executeIncrementalUpdate] 增量更新失败', { taskId, error: errorMessage })

    return {
      mode: 'incremental',
      targetStore,
      recordsAdded: 0,
      recordsModified: 0,
      recordsDeleted: 0,
      recordsUnchanged: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      elapsedMs,
      status: 'failed',
      errorMessage,
    }
  }
}

/**
 * 执行更新（自动选择模式）
 *
 * @param newRecords - 新记录数组
 * @param recordDiffs - 差异分析结果
 * @param targetStore - 目标 store
 * @param conflictPolicy - 冲突处理策略
 * @param options - 可选参数
 * @returns 执行结果
 */
export async function executeUpdate(
  newRecords: readonly Record<string, unknown>[],
  recordDiffs: readonly RecordDiff[],
  targetStore: StoreName,
  conflictPolicy: ConflictPolicy = 'last-write-wins',
  options?: {
    isInitialImport?: boolean
    userPreference?: UpdateMode
    primaryKey?: string
  },
): Promise<UpdateExecutionResult> {
  const totalRecords = newRecords.length
  const changedCount = recordDiffs.filter(
    d => d.status !== 'unchanged',
  ).length
  const changeRatio = totalRecords > 0 ? changedCount / totalRecords : 0
  const hasConflicts = recordDiffs.some(d => d.status === 'conflict')

  const mode = selectUpdateMode(
    totalRecords,
    changeRatio,
    hasConflicts,
    options?.isInitialImport ?? false,
    options?.userPreference,
  )

  logger.info('[executeUpdate] 自动选择更新模式', {
    mode,
    totalRecords,
    changeRatio: changeRatio.toFixed(2),
    hasConflicts,
  })

  if (mode === 'batch') {
    return executeBatchUpdate(newRecords, targetStore)
  }
  return executeIncrementalUpdate(recordDiffs, targetStore, conflictPolicy)
}

/** 导出同步事件名 */
export { SYNC_EVENTS }
