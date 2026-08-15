/**
 * @fileoverview 双轨校对器 — 监听评分完成事件，校对后触发策略分层
 *
 * @module services/orchestration/scoreCalibrator
 * @created 2026-07-25 - P0 数据链路打通
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { dataBridge, ENVELOPE_ACTION, STORE_NAME } from '@/core/databridge'
import { runDualStrategyUseCase } from '@/services/useCase/runDualStrategy.useCase'
import { getLogger } from '@/lib/logger'
import type { IntelligentScore } from '@/data/types'
import { scoreToTier as scoreToTierPublic, scoreToRating as scoreToRatingPublic } from './scoreTier'

const logger = getLogger()

/** 校对配置 */
export interface ScoreCalibratorConfig {
  maxDeviation: number
  v6Weight: number
  autoTriggerStrategy: boolean
}

/** 校对结果 */
export interface CalibrationResult {
  symbol: string
  v6Score: number | null
  llmScore: number | null
  deviation: number | null
  needsManualReview: boolean
  finalScore: number
  rating: string
  strategyTier: string
}

const DEFAULT_CONFIG: Required<ScoreCalibratorConfig> = {
  maxDeviation: 0.5,
  v6Weight: 0.6,
  autoTriggerStrategy: true,
}

export class ScoreCalibrator {
  private config: Required<ScoreCalibratorConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  private calibratedScores: Map<string, CalibrationResult> = new Map()
  private pendingSymbols: Set<string> = new Set()

  constructor(config?: Partial<ScoreCalibratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  start(): void {
    if (this._active) return
    this._active = true

    const unsub1 = eventBus.on(EVENT_NAMES.QUALITY_GATE_PASSED, () => {
      // 质量门禁放行 — 后续由 ANALYSIS_SCORE_COMPLETED 驱动
    })

    const unsub2 = eventBus.on(EVENT_NAMES.ANALYSIS_INDUSTRY_COMPLETED, () => {
      logger.info('[ScoreCalibrator] 行业分析完成，等待个股评分...')
    })

    const unsub3 = eventBus.on(EVENT_NAMES.ANALYSIS_SCORE_COMPLETED, (payload: unknown) => {
      const p = payload as { symbol: string; score: IntelligentScore }
      this.calibrateSingle(p.symbol, p.score)
    })

    this.unsubscribers.push(unsub1, unsub2, unsub3)
    logger.info('[ScoreCalibrator] 已启动')
  }

  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    this.calibratedScores.clear()
    this.pendingSymbols.clear()
    logger.info('[ScoreCalibrator] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  private calibrateSingle(symbol: string, score: IntelligentScore): void {
    const v6Score = this.extractV6Score(score)
    const llmScore = score.overallScore ?? null

    let deviation: number | null = null
    let needsManualReview = false
    let finalScore: number

    if (v6Score !== null && llmScore !== null) {
      deviation = Math.abs(v6Score - llmScore)
      needsManualReview = deviation >= this.config.maxDeviation
      const w = this.config.v6Weight
      finalScore = v6Score * w + llmScore * (1 - w)
    } else if (v6Score !== null) {
      finalScore = v6Score
    } else if (llmScore !== null) {
      finalScore = llmScore
    } else {
      finalScore = 0
    }

    const result: CalibrationResult = {
      symbol,
      v6Score,
      llmScore,
      deviation,
      needsManualReview,
      finalScore,
      rating: this.scoreToRating(finalScore),
      strategyTier: this.scoreToTier(finalScore),
    }

    this.calibratedScores.set(symbol, result)
    this.pendingSymbols.delete(symbol)

    logger.info('[ScoreCalibrator] 校对完成', {
      symbol,
      finalScore: finalScore.toFixed(2),
      rating: result.rating,
      tier: result.strategyTier,
    })

    eventBus.emit(EVENT_NAMES.SCORE_CALIBRATOR_ITEM, result)

    if (this.config.autoTriggerStrategy && this.pendingSymbols.size === 0) {
      void this.triggerStrategyClassification()
    }
  }

  /** V6 评分在 configSnapshot.v6Score */
  private extractV6Score(score: IntelligentScore): number | null {
    return score.configSnapshot?.v6Score ?? null
  }

  private async triggerStrategyClassification(): Promise<void> {
    const allResults = Array.from(this.calibratedScores.values())
    if (allResults.length === 0) return

    logger.info('[ScoreCalibrator] 触发策略分层')

    eventBus.emit(EVENT_NAMES.STRATEGY_CLASSIFICATION_START, {
      count: allResults.length,
      timestamp: Date.now(),
    })

    try {
      const stocks = await this.loadStocksFromDB(allResults.map((r) => r.symbol))
      if (stocks.length === 0) {
        logger.warn('[ScoreCalibrator] 无股票数据，跳过策略分层')
        return
      }

      const result = await runDualStrategyUseCase({ stocks: stocks as unknown as Parameters<typeof runDualStrategyUseCase>[0]['stocks'] })

      eventBus.emit(EVENT_NAMES.STRATEGY_CLASSIFICATION_DONE, {
        calibrations: allResults,
        strategy: result.data,
        timestamp: Date.now(),
      })
      logger.info('[ScoreCalibrator] 策略分层完成')
    } catch (e) {
      logger.error('[ScoreCalibrator] 策略分层失败', { error: e instanceof Error ? e.message : String(e) })
      eventBus.emit(EVENT_NAMES.STRATEGY_CLASSIFICATION_ERROR, {
        error: String(e),
        timestamp: Date.now(),
      })
    }
  }

  private scoreToRating(score: number): string {
    return scoreToRatingPublic(score)
  }

  private scoreToTier(score: number): string {
    return scoreToTierPublic(score)
  }

  getAllCalibrations(): CalibrationResult[] {
    return Array.from(this.calibratedScores.values())
  }

  getManualReviewList(): CalibrationResult[] {
    return this.getAllCalibrations().filter((r) => r.needsManualReview)
  }

  reset(): void {
    this.calibratedScores.clear()
    this.pendingSymbols.clear()
  }

  private async loadStocksFromDB(symbols: string[]): Promise<unknown[]> {
    const results: unknown[] = []
    for (const symbol of symbols) {
      try {
        const res = await dataBridge.query({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.stocks,
        })
        const list = (res.data ?? []) as unknown[]
        const match = list.find((s) => (s as { symbol?: string } | null)?.symbol === symbol)
        if (match) results.push(match)
      } catch {
        /* skip */
      }
    }
    return results
  }
}

let _instance: ScoreCalibrator | null = null

export function getScoreCalibrator(config?: Partial<ScoreCalibratorConfig>): ScoreCalibrator {
  _instance ??= new ScoreCalibrator(config)
  return _instance
}

export function startScoreCalibrator(config?: Partial<ScoreCalibratorConfig>): ScoreCalibrator {
  const cal = getScoreCalibrator(config)
  cal.start()
  return cal
}
