/**
 * 数据生命周期管理 — barrel export
 *
 * 统一导出所有生命周期管理模块。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
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
