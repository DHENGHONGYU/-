/**
 * @fileoverview 数据同步服务 barrel export
 *
 * 统一导出全局调度、过期检测、冲突处理、更新执行等模块。
 *
 * @module services/data-sync
 * @created 2026-07-14 - 双通道整改 P1-1~P1-4
 */

// 全局调度引擎
export { globalScheduler, isWithinTradingHours } from './globalScheduler'

// 过期检测器
export {
  checkStaleness,
  checkStalenessBatch,
  getStalenessThresholds,
  isAutoCollectable,
} from './stalenessDetector'

// 字段级合并器
export { mergeRecords, DEFAULT_MERGE_RULES } from './fieldMerger'

// 冲突解决器
export {
  detectConflict,
  resolveConflict,
  resolveConflictsBatch,
} from './conflictResolver'
export type { ConflictDetectionResult, ConflictResolutionResult } from './conflictResolver'

// 更新执行器
export {
  executeBatchUpdate,
  executeIncrementalUpdate,
  executeUpdate,
  selectUpdateMode,
  SYNC_EVENTS,
} from './updateExecutor'
export type { UpdateExecutionResult } from './updateExecutor'
