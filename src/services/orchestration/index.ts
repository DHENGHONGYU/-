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

import {
  ObservationPoolReviewer,
  getObservationPoolReviewer,
  startObservationPoolReviewer,
} from './observationPoolReviewer'
import type { ObservationReviewPersister, ObservationReviewPersistRecord } from './observationPoolReviewer'
export {
  ObservationPoolReviewer,
  getObservationPoolReviewer,
  startObservationPoolReviewer,
}
export type {
  ObservationReviewConfig,
  ObservationReviewResult,
  ObservationReviewItem,
  ObservationPoolReviewerDeps,
  ObservationReviewPersister,
  ObservationReviewPersistRecord,
} from './observationPoolReviewer'

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
import { getIntentionWatchlistStocks } from '@/services/trading/tradingService'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import type { Stock } from '@/data/types'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME, DATA_SOURCE } from '@/config/dbConfig'
import type { ObservationReviewRecord } from '@/data/dataLayerContentStores'
import { POOL_TYPE, RESEARCH_STATUS, DEFAULT_POOL_GROUP } from '@/constants/pool.constants'
import { nanoid } from 'nanoid'

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
    {
      name: 'ObservationPoolReviewer',
      fn: () => {
        // enabled:true —— 开启 24h 周期定时复盘调度（spec 缺口②「定期自动复盘调度」）
        // autoEnroll:true —— 观察池复盘发现达门槛且不在研究池的标的，自动晋升入研究池
        const reviewer = getObservationPoolReviewer({ enabled: true, autoEnroll: true })
        // 复盘快照持久化器：经 DataBridge 落 observation_reviews 存储（spec 缺口② 闭环，跨重启漂移比对）
        const observationReviewPersister: ObservationReviewPersister = {
          async loadLastScores() {
            const res = await dataBridge.query<ObservationReviewRecord[]>({
              action: ENVELOPE_ACTION.queryList,
              store: STORE_NAME.observationReviews,
              source: MODULE_ID.system,
            })
            const list = res.data ?? []
            let latest: ObservationReviewRecord | undefined
            for (const r of list) {
              if (!latest || r.generatedAt > latest.generatedAt) latest = r
            }
            const m = new Map<string, number>()
            if (latest) for (const it of latest.items) m.set(it.symbol, it.currentScore)
            return m
          },
          async saveReview(record: ObservationReviewPersistRecord) {
            const full: ObservationReviewRecord = {
              reviewId: record.reviewId,
              generatedAt: record.generatedAt,
              items: record.items,
              summary: record.summary,
              sourceModule: MODULE_ID.system,
            }
            await dataBridge.forward(
              EnvelopeFactory.create(
                {
                  source: MODULE_ID.system,
                  target: ENVELOPE_TARGET.db,
                  action: ENVELOPE_ACTION.saveObservationReview,
                  traceId: `obs-review-${record.reviewId}`,
                },
                full,
              ),
            )
          },
        }
        reviewer.configure({
          getWatchlist: async () => {
            const res = await getIntentionWatchlistStocks()
            return (res.data ?? []).map((s) => ({ symbol: s.symbol, name: s.name }))
          },
          scorer: {
            run: async (symbol: string) => {
              const r = await runV6Score(symbol)
              return { success: r.success, data: r.data }
            },
          },
          // 权威判定：直接查 stocks store，symbol 属研究池(pool==='research')即视为已晋升
          isInResearchPool: async (symbol: string) => {
            const res = await dataBridge.query<Stock>({
              action: ENVELOPE_ACTION.queryGet,
              store: STORE_NAME.stocks,
              key: symbol.trim().toUpperCase(),
              source: MODULE_ID.system,
            })
            return res.success && res.data?.pool === POOL_TYPE.research
          },
          // 晋升动作：调研究池 Store 入池（自带 DB 去重，重复安全返回 false）
          enrollToResearchPool: async (symbol: string, name: string) => {
            const normalizedSymbol = symbol.trim().toUpperCase()
            const fullStock: Stock = {
              symbol: normalizedSymbol,
              name,
              pool: POOL_TYPE.research,
              researchStatus: RESEARCH_STATUS.candidate,
              source: DATA_SOURCE.system,
              group: DEFAULT_POOL_GROUP,
              dataVersion: 1,
              ingestedAt: Date.now(),
              updatedAt: Date.now(),
            }
            const envelope = EnvelopeFactory.create(
              {
                source: MODULE_ID.system,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.insertStock,
                traceId: `orchestrator-research-enroll-${nanoid(8)}-${normalizedSymbol}`,
              },
              fullStock,
            )
            await dataBridge.forward(envelope)
          },
          persister: observationReviewPersister,
        })
        reviewer.start()
      },
    },
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
    { name: 'ObservationPoolReviewer', fn: () => getObservationPoolReviewer().stop() },
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
