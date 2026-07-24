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

export {
  CatalystTracker,
  startCatalystTracker,
  getCatalystTracker,
} from './catalystTracker'
export type { CatalystType, CatalystImpact, CatalystEvent, CatalystTrackerConfig } from './catalystTracker'

export {
  WatchListTrigger,
  startWatchListTrigger,
  getWatchListTrigger,
} from './watchListTrigger'
export type { WatchListTriggerConfig, WatchListTriggerEvent } from './watchListTrigger'

export {
  StrategyReportGenerator,
  startStrategyReportGenerator,
  getStrategyReportGenerator,
} from './strategyReportGenerator'
export type {
  StrategyReportSection,
  StrategyReport,
  StrategyReportGeneratorConfig,
} from './strategyReportGenerator'

export {
  TimelinessSyncAnalyzer,
  startTimelinessSyncAnalyzer,
  getTimelinessSyncAnalyzer,
} from './timelinessSyncAnalyzer'
export type {
  TradeRecord,
  TimelinessMetrics,
  TimelinessSyncConfig,
} from './timelinessSyncAnalyzer'

export {
  WeeklyReviewScheduler,
  startWeeklyReviewScheduler,
  getWeeklyReviewScheduler,
} from './weeklyReviewScheduler'
export type {
  WeeklyReviewConfig,
  WeeklyReviewResult,
} from './weeklyReviewScheduler'

export {
  VolatilityAlertPush,
  startVolatilityAlertPush,
  getVolatilityAlertPush,
} from './volatilityAlert'
export type {
  VolatilityAlert,
  VolatilityConfig,
} from './volatilityAlert'

export {
  ChipAnomalyDetector,
  startChipAnomalyDetector,
  getChipAnomalyDetector,
} from './chipAnomalyDetector'
export type {
  ChipAnomalyEvent,
  ChipAnomalyConfig,
} from './chipAnomalyDetector'

// ---- 统一初始化 ----

import { getRegistrationOrchestrator } from './registrationOrchestrator'
import { getQualityGate } from './qualityGate'
import { getScoreCalibrator } from './scoreCalibrator'
import { getCatalystTracker } from './catalystTracker'
import { getWatchListTrigger } from './watchListTrigger'
import { getStrategyReportGenerator } from './strategyReportGenerator'
import { getTimelinessSyncAnalyzer } from './timelinessSyncAnalyzer'
import { getWeeklyReviewScheduler } from './weeklyReviewScheduler'
import { getVolatilityAlertPush } from './volatilityAlert'
import { getChipAnomalyDetector } from './chipAnomalyDetector'

/**
 * 初始化全部编排器 — 在 App 启动时调用一次
 *
 * 事件链路：
 *   BATCH_IMPORT_COMPLETED → RegistrationOrchestrator → runBatchTrace
 *   REGISTRATION_COLLECT_COMPLETE → QualityGate → checkQuality → triggerAnalysis
 *   ANALYSIS_SCORE_COMPLETED → ScoreCalibrator → calibrate → triggerStrategy
 */
export function initOrchestration(): void {
  console.log('[Orchestration] 初始化编排器...')

  const reg = getRegistrationOrchestrator()
  reg.start()

  const gate = getQualityGate()
  gate.start()

  const cal = getScoreCalibrator()
  cal.start()

  const tracker = getCatalystTracker()
  tracker.start()

  const watchTrigger = getWatchListTrigger()
  watchTrigger.start()

  const reportGen = getStrategyReportGenerator()
  reportGen.start()

  const timeliness = getTimelinessSyncAnalyzer()
  timeliness.start()

  const weeklyReview = getWeeklyReviewScheduler()
  weeklyReview.start()

  const volAlert = getVolatilityAlertPush()
  volAlert.start()

  const chipDetector = getChipAnomalyDetector()
  chipDetector.start()

  console.log('[Orchestration] 编排器启动完成')
}

/** 停止全部编排器 */
export function stopOrchestration(): void {
  getRegistrationOrchestrator().stop()
  getQualityGate().stop()
  getScoreCalibrator().stop()
  getCatalystTracker().stop()
  getWatchListTrigger().stop()
  getStrategyReportGenerator().stop()
  getTimelinessSyncAnalyzer().stop()
  getWeeklyReviewScheduler().stop()
  getVolatilityAlertPush().stop()
  getChipAnomalyDetector().stop()
  console.log('[Orchestration] 编排器已停止')
}
