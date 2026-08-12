/**
 * @fileoverview 观察舱事件触发器 — 监听评分校对事件，当观察舱股票评分提升时触发重新评估
 *
 * 观察舱（watch tier）定义：评分在 2.5-3.2 之间的股票。
 * 当评分提升超过阈值时触发重评，当评分超过 minTriggerScore 时升级 tier。
 *
 * @module services/orchestration/watchListTrigger
 * @created 2026-07-25 - P1 编排器扩展
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ---- 类型定义 ----

export interface WatchListTriggerConfig {
  /** 评分提升超过此阈值时触发重评（默认 0.3） */
  scoreUpgradeThreshold?: number
  /** 最低触发评分，低于此分值不触发（默认 3.2） */
  minTriggerScore?: number
  /** 是否自动触发（默认 true） */
  autoTrigger?: boolean
}

export interface WatchListTriggerEvent {
  id: string
  symbol: string
  previousScore: number
  newScore: number
  reason: string
  timestamp: number
}

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<WatchListTriggerConfig> = {
  scoreUpgradeThreshold: 0.3,
  minTriggerScore: 3.2,
  autoTrigger: true,
}

/** 观察舱评分区间下限 */
const WATCH_TIER_LOWER = 2.5
/** 观察舱评分区间上限 */
const WATCH_TIER_UPPER = 3.2

// ---- 观察舱事件触发器 ----

export class WatchListTrigger {
  private config: Required<WatchListTriggerConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 每只股票的上次评分记录 */
  private previousScores: Map<string, number> = new Map()
  /** 触发事件历史 */
  private triggerEvents: WatchListTriggerEvent[] = []
  /** 待重新评估的股票列表 */
  private pendingReevaluations: Set<string> = new Set()

  constructor(config?: WatchListTriggerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 启动触发器 — 订阅评分校对完成事件 */
  start(): void {
    if (this._active) return
    this._active = true

    const unsub = eventBus.on(EVENT_NAMES.SCORE_CALIBRATOR_ITEM, (payload: unknown) => {
      if (!this.config.autoTrigger) return
      this.handleCalibrationItem(payload)
    })

    this.unsubscribers.push(unsub)
    logger.info('[WatchListTrigger] 已启动，监听评分校对事件')
  }

  /** 停止触发器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[WatchListTrigger] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  // ---- 事件处理 ----

  /** 处理评分校对完成事件 */
  private handleCalibrationItem(payload: unknown): void {
    const p = payload as {
      symbol: string
      finalScore: number
      strategyTier?: string
    }

    const { symbol, finalScore } = p
    const previousScore = this.previousScores.get(symbol)

    // 首次记录评分
    if (previousScore === undefined) {
      this.previousScores.set(symbol, finalScore)
      // 首次评分如果在观察舱区间，记录下来
      if (finalScore >= WATCH_TIER_LOWER && finalScore <= WATCH_TIER_UPPER) {
        logger.info('[WatchListTrigger] 股票进入观察舱', { symbol, score: finalScore })
      }
      return
    }

    // 检查是否在观察舱区间（基于 previousScore）
    const wasInWatchTier = previousScore >= WATCH_TIER_LOWER && previousScore <= WATCH_TIER_UPPER

    if (wasInWatchTier) {
      const scoreDelta = finalScore - previousScore

      // 评分提升超过阈值，触发重新评估
      if (scoreDelta >= this.config.scoreUpgradeThreshold && finalScore >= WATCH_TIER_LOWER) {
        this.emitReEvaluate(symbol, previousScore, finalScore, `评分提升 ${scoreDelta.toFixed(2)} 超过阈值 ${this.config.scoreUpgradeThreshold}`)
      }

      // 评分超过 minTriggerScore，升级 tier
      if (finalScore >= this.config.minTriggerScore) {
        this.emitTierUpgrade(symbol, previousScore, finalScore, `评分 ${finalScore.toFixed(2)} 达到升级阈值 ${this.config.minTriggerScore}`)
      }
    }

    // 更新上次评分
    this.previousScores.set(symbol, finalScore)
  }

  /** 发射重新评估事件 */
  private emitReEvaluate(symbol: string, previousScore: number, newScore: number, reason: string): void {
    const event: WatchListTriggerEvent = {
      id: nanoid(12),
      symbol,
      previousScore,
      newScore,
      reason,
      timestamp: Date.now(),
    }

    this.triggerEvents.push(event)
    this.pendingReevaluations.add(symbol)

    logger.info('[WatchListTrigger] 触发重新评估', {
      symbol,
      previousScore: previousScore.toFixed(2),
      newScore: newScore.toFixed(2),
      reason,
    })

    eventBus.emit(EVENT_NAMES.WATCHLIST_REEVALUATE, event)
  }

  /** 发射 tier 升级事件 */
  private emitTierUpgrade(symbol: string, previousScore: number, newScore: number, reason: string): void {
    const event: WatchListTriggerEvent = {
      id: nanoid(12),
      symbol,
      previousScore,
      newScore,
      reason,
      timestamp: Date.now(),
    }

    this.triggerEvents.push(event)

    logger.info('[WatchListTrigger] 触发 tier 升级', {
      symbol,
      previousScore: previousScore.toFixed(2),
      newScore: newScore.toFixed(2),
      reason,
    })

    eventBus.emit(EVENT_NAMES.WATCHLIST_TIER_UPGRADE, event)
  }

  // ---- 查询接口 ----

  /** 获取全部触发事件历史 */
  getTriggers(): WatchListTriggerEvent[] {
    return [...this.triggerEvents]
  }

  /** 获取待重新评估的股票列表 */
  getPendingReevaluations(): string[] {
    return Array.from(this.pendingReevaluations)
  }

  /** 清空所有数据 */
  clear(): void {
    this.previousScores.clear()
    this.triggerEvents = []
    this.pendingReevaluations.clear()
    logger.info('[WatchListTrigger] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: WatchListTrigger | null = null

export function getWatchListTrigger(config?: WatchListTriggerConfig): WatchListTrigger {
  if (!_instance) _instance = new WatchListTrigger(config)
  return _instance
}

export function startWatchListTrigger(config?: WatchListTriggerConfig): WatchListTrigger {
  const trigger = getWatchListTrigger(config)
  trigger.start()
  return trigger
}
