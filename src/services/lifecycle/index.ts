/**
 * 数据生命周期管理 — barrel export
 *
 * 统一导出所有生命周期管理模块。
 */

export {
  archiveOldResults,
  cleanupOldArchives,
  getStorageStats,
  lightArchiveCheck,
  TTL_SOFT_DAYS,
  TTL_HARD_DAYS,
} from './analysisResultLifecycle'
export type { LifecycleStats, StorageStats } from './analysisResultLifecycle'
