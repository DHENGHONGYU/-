/**
 * Workers 目录 — barrel export
 *
 * 统一导出所有 Web Worker 相关模块，方便外部引用：
 *   import { V6ScoreTaskScheduler } from '@/services/workers'
 */

export { V6ScoreTaskScheduler, getGlobalScheduler, destroyGlobalScheduler } from './v6ScoreTaskScheduler'
export type { BatchScoreStats, TaskSchedulerOptions } from './v6ScoreTaskScheduler'
export type { WorkerRequest, WorkerResponse } from './v6ScoreWorker'
