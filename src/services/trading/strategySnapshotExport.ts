/**
 * @fileoverview 策略快照导出 — services 层 re-export 壳
 *
 * P1-12 分层合规：纯导出工具已下沉到 src/domain/export/strategySnapshotExport.ts。
 * services 侧 re-export 保持对外 API 兼容（旧路径不变）。
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023]
 */

export {
  exportSnapshotToJson,
  exportGroupToExcel,
  exportAllGroupsToExcel,
  exportBatchSnapshotsToExcel,
  buildUniqueSheetName,
} from '@/domain/export/strategySnapshotExport'

export type {
  SnapshotExportResult,
  BatchExportResult,
} from '@/domain/export/strategySnapshotExport'

export type { StrategySnapshot, StrategyGroupItem } from '@/data/types'
