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
import { getLogger } from '@/lib/logger'

export type OrchestratorStatus = 'idle' | 'starting' | 'running' | 'failed'

export interface OrchestratorHealth {
  name: string
  status: OrchestratorStatus
  lastStartTime: number | null
  errorMessage: string | null
}

const orchestratorStates = new Map<string, OrchestratorHealth>()

const logger = getLogger()

interface OrchestratorEntry {
  name: string
  fn: () => void
}

function buildOrchestratorList(): OrchestratorEntry[] {
  return [
    { name: 'RegistrationOrchestrator', fn: () => getRegistrationOrchestrator().start() },
    { name: 'QualityGate', fn: () => getQualityGate().start() },
    { name: 'ScoreCalibrator', fn: () => getScoreCalibrator().start() },
    { name: 'CatalystTracker', fn: () => getCatalystTracker().start() },
    { name: 'WatchListTrigger', fn: () => getWatchListTrigger().start() },
    { name: 'StrategyReportGenerator', fn: () => getStrategyReportGenerator().start() },
    { name: 'TimelinessSyncAnalyzer', fn: () => getTimelinessSyncAnalyzer().start() },
    { name: 'WeeklyReviewScheduler', fn: () => getWeeklyReviewScheduler().start() },
    { name: 'VolatilityAlertPush', fn: () => getVolatilityAlertPush().start() },
    { name: 'ChipAnomalyDetector', fn: () => getChipAnomalyDetector().start() },
  ]
}

export function initOrchestration(): void {
  logger.debug('[Orchestration] 初始化编排器...')

  const orchestrators = buildOrchestratorList()
  let successCount = 0
  let failCount = 0

  for (const { name, fn } of orchestrators) {
    try {
      orchestratorStates.set(name, { name, status: 'starting', lastStartTime: null, errorMessage: null })
      fn()
      orchestratorStates.set(name, {
        name,
        status: 'running',
        lastStartTime: Date.now(),
        errorMessage: null,
      })
      successCount++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      orchestratorStates.set(name, {
        name,
        status: 'failed',
        lastStartTime: null,
        errorMessage,
      })
      console.error(`[Orchestration] ${name} 启动失败:`, errorMessage)
      failCount++
    }
  }

  logger.debug(`[Orchestration] 编排器启动完成: ${successCount} 成功, ${failCount} 失败`)

  if (failCount > 0) {
    const failedNames = orchestrators
      .filter((o) => orchestratorStates.get(o.name)?.status === 'failed')
      .map((o) => o.name)
    console.warn(`[Orchestration] 编排器部分启动失败: ${failedNames.join(', ')}`)
  }
}

export function getOrchestratorHealth(): OrchestratorHealth[] {
  return Array.from(orchestratorStates.values())
}

export function getRunningOrchestrators(): string[] {
  return Array.from(orchestratorStates.entries())
    .filter(([, state]) => state.status === 'running')
    .map(([name]) => name)
}

export function isCriticalOrchestratorAvailable(name: string): boolean {
  return orchestratorStates.get(name)?.status === 'running'
}

/** 停止全部编排器 */
export function stopOrchestration(): void {
  const stopEntries = [
    { name: 'RegistrationOrchestrator', fn: () => getRegistrationOrchestrator().stop() },
    { name: 'QualityGate', fn: () => getQualityGate().stop() },
    { name: 'ScoreCalibrator', fn: () => getScoreCalibrator().stop() },
    { name: 'CatalystTracker', fn: () => getCatalystTracker().stop() },
    { name: 'WatchListTrigger', fn: () => getWatchListTrigger().stop() },
    { name: 'StrategyReportGenerator', fn: () => getStrategyReportGenerator().stop() },
    { name: 'TimelinessSyncAnalyzer', fn: () => getTimelinessSyncAnalyzer().stop() },
    { name: 'WeeklyReviewScheduler', fn: () => getWeeklyReviewScheduler().stop() },
    { name: 'VolatilityAlertPush', fn: () => getVolatilityAlertPush().stop() },
    { name: 'ChipAnomalyDetector', fn: () => getChipAnomalyDetector().stop() },
  ]

  for (const { name, fn } of stopEntries) {
    try {
      fn()
      orchestratorStates.set(name, { name, status: 'idle', lastStartTime: null, errorMessage: null })
    } catch {
      // 停止阶段的异常仅记录日志，不影响其他编排器停止
      orchestratorStates.set(name, { name, status: 'idle', lastStartTime: null, errorMessage: null })
    }
  }

  logger.debug('[Orchestration] 编排器已停止')
}
