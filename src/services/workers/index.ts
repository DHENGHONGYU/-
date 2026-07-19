/**
 * Workers 目录 — barrel export
 *
 * 统一导出所有 Web Worker 相关模块，方便外部引用：
 *   import { V6ScoreTaskScheduler } from '@/services/workers'
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

export { V6ScoreTaskScheduler, getGlobalScheduler, destroyGlobalScheduler } from './v6ScoreTaskScheduler'
export type { BatchScoreStats, TaskSchedulerOptions } from './v6ScoreTaskScheduler'
export type { WorkerRequest, WorkerResponse } from './v6ScoreWorker'
