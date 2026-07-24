/**
 * @fileoverview 编排器层 — 统一入口
 *
 * 三大编排器串联全链路：
 *   RegistrationOrchestrator (输入→采集)
 *   QualityGate (采集→分析)
 *   ScoreCalibrator (评分→策略)
 *
 * @module services/orchestration
 * @created 2026-07-25
 */

export {
  RegistrationOrchestrator,
  startRegistrationOrchestrator,
  getRegistrationOrchestrator,
} from './registrationOrchestrator'
export type { RegistrationOrchestratorConfig, CollectionDimensionCode } from './registrationOrchestrator'

export { QualityGate, startQualityGate, getQualityGate } from './qualityGate'
export type { QualityGateThresholds, QualityGateResult } from './qualityGate'

export {
  ScoreCalibrator,
  startScoreCalibrator,
  getScoreCalibrator,
} from './scoreCalibrator'
export type { ScoreCalibratorConfig, CalibrationResult } from './scoreCalibrator'

// ---- 统一初始化 ----

import { getRegistrationOrchestrator } from './registrationOrchestrator'
import { getQualityGate } from './qualityGate'
import { getScoreCalibrator } from './scoreCalibrator'

/**
 * 初始化全部编排器 — 在 App 启动时调用一次
 *
 * 事件链路：
 *   BATCH_IMPORT_COMPLETED → RegistrationOrchestrator → runBatchTrace
 *   REGISTRATION_COLLECT_COMPLETE → QualityGate → checkQuality → triggerAnalysis
 *   ANALYSIS_SCORE_COMPLETED → ScoreCalibrator → calibrate → triggerStrategy
 */
export function initOrchestration(): void {
  console.log('[Orchestration] 初始化三大编排器...')

  const reg = getRegistrationOrchestrator()
  reg.start()

  const gate = getQualityGate()
  gate.start()

  const cal = getScoreCalibrator()
  cal.start()

  console.log('[Orchestration] 编排器启动完成')
}

/** 停止全部编排器 */
export function stopOrchestration(): void {
  getRegistrationOrchestrator().stop()
  getQualityGate().stop()
  getScoreCalibrator().stop()
  console.log('[Orchestration] 编排器已停止')
}
