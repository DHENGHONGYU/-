/**
 * 评分自动触发服务（Score Auto-Trigger）
 *
 * 职责：
 * - 监听数据采集完成事件（COLLECTION_EVENTS.COMPLETE）
 * - 判断采集维度是否影响评分因子
 * - 对影响评分的数据更新，自动触发 V6 评分重算
 * - 内置去抖（debounce）机制，避免同一股票短时间内多次重评
 *
 * 设计原则：
 * - 仅监听，不主动采集（保持单一职责）
 * - 去抖延迟：默认 5000ms，同一股票多次触发合并为一次
 * - 白名单维度：仅对评分相关维度触发重评
 * - 异步非阻塞：触发后不等待评分完成，避免阻塞采集链路
  * @doc [V9-DOC-BACK-005, V9-DOC-PROJ-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-PROJ-002]
*/

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type { CollectionLifecycleEvent } from '@/types/modules/collection.types'

const logger = getLogger()

/** 触发评分重算的维度白名单（数据更新会影响评分结果的维度） */
const SCORE_TRIGGER_DIMENSIONS = new Set([
  '01',
  '02',
  '03',
  '06',
])

const DEFAULT_DEBOUNCE_MS = 5000
const DEFAULT_MAX_CONCURRENT = 3

export interface ScoreAutoTriggerConfig {
  /** 去抖延迟（ms），同一股票多次触发合并为一次 */
  debounceMs?: number
  /** 最大并发评分数 */
  maxConcurrent?: number
  /** 是否启用自动触发 */
  enabled?: boolean
  /** 触发维度白名单，覆盖默认值 */
  triggerDimensions?: string[]
}

type RunV6ScoreFn = (symbol: string) => Promise<unknown>

let injectedRunV6Score: RunV6ScoreFn | null = null

/**
 * setScoreTriggerServices
 * @param services
 */
export function setScoreTriggerServices(services: { runV6Score: RunV6ScoreFn }): void {
  injectedRunV6Score = services.runV6Score
  logger.info('[ScoreAutoTrigger] 评分服务已注入')
}

function getRunV6Score(): RunV6ScoreFn {
  if (!injectedRunV6Score) {
    throw new Error('ScoreAutoTrigger 服务未注入，请在启动时调用 setScoreTriggerServices')
  }
  return injectedRunV6Score
}

/**
 * ScoreAutoTrigger
 */
export class ScoreAutoTrigger {
  private config: Required<Omit<ScoreAutoTriggerConfig, 'triggerDimensions'>> & {
    triggerDimensions: Set<string>
  }
  private pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private runningCount = 0
  private queue: string[] = []
  private started = false

  constructor(config?: ScoreAutoTriggerConfig) {
    this.config = {
      debounceMs: config?.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      maxConcurrent: config?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
      enabled: config?.enabled ?? true,
      triggerDimensions: new Set(config?.triggerDimensions ?? SCORE_TRIGGER_DIMENSIONS),
    }
    logger.info('[ScoreAutoTrigger] 初始化完成', {
      debounceMs: this.config.debounceMs,
      maxConcurrent: this.config.maxConcurrent,
      enabled: this.config.enabled,
      triggerDimensions: Array.from(this.config.triggerDimensions),
    })
  }

  start(): void {
    if (this.started) {
      logger.warn('[ScoreAutoTrigger] 已启动，忽略重复启动')
      return
    }
    eventBus.on(COLLECTION_EVENTS.COMPLETE, this.handleCollectComplete)
    this.started = true
    logger.info('[ScoreAutoTrigger] 已启动，监听采集完成事件')
  }

  stop(): void {
    if (!this.started) return
    eventBus.off(COLLECTION_EVENTS.COMPLETE, this.handleCollectComplete)
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer)
    }
    this.pendingTimers.clear()
    this.queue = []
    this.started = false
    logger.info('[ScoreAutoTrigger] 已停止')
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    logger.info(`[ScoreAutoTrigger] 自动触发已${enabled ? '启用' : '禁用'}`)
  }

  private handleCollectComplete = (event: unknown): void => {
    if (!this.config.enabled) return
    const e = event as Partial<CollectionLifecycleEvent>
    if (!e.symbol || !e.dimensionCode) return

    if (!this.config.triggerDimensions.has(e.dimensionCode)) {
      logger.debug(`[ScoreAutoTrigger] 维度 ${e.dimensionCode} 不触发评分`, {
        symbol: e.symbol,
      })
      return
    }

    this.scheduleTrigger(e.symbol, e.dimensionCode)
  }

  private scheduleTrigger(symbol: string, dimensionCode: string): void {
    const existing = this.pendingTimers.get(symbol)
    if (existing) {
      clearTimeout(existing)
      logger.debug(`[ScoreAutoTrigger] 重置去抖计时器: ${symbol}`)
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(symbol)
      this.enqueue(symbol)
    }, this.config.debounceMs)

    this.pendingTimers.set(symbol, timer)
    logger.info(`[ScoreAutoTrigger] 调度评分重算: ${symbol} (维度: ${dimensionCode}, 延迟: ${this.config.debounceMs}ms)`)
  }

  private enqueue(symbol: string): void {
    if (this.queue.includes(symbol)) {
      logger.debug(`[ScoreAutoTrigger] ${symbol} 已在队列中，跳过`)
      return
    }
    this.queue.push(symbol)
    logger.info(`[ScoreAutoTrigger] 入队: ${symbol}, 队列长度: ${this.queue.length}`)
    this.processQueue()
  }

  private processQueue(): void {
    if (this.runningCount >= this.config.maxConcurrent) return
    if (this.queue.length === 0) return

    const symbol = this.queue.shift()
    if (!symbol) return

    this.runningCount++
    logger.info(`[ScoreAutoTrigger] 开始评分: ${symbol}, 并发: ${this.runningCount}/${this.config.maxConcurrent}`)

    const runV6Score = getRunV6Score()
    runV6Score(symbol)
      .then(() => {
        logger.info(`[ScoreAutoTrigger] 评分完成: ${symbol}`)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`[ScoreAutoTrigger] 评分失败: ${symbol}`, { error: msg })
      })
      .finally(() => {
        this.runningCount--
        this.processQueue()
      })
  }

  getStats(): {
    pending: number
    running: number
    queued: number
    enabled: boolean
  } {
    return {
      pending: this.pendingTimers.size,
      running: this.runningCount,
      queued: this.queue.length,
      enabled: this.config.enabled,
    }
  }
}

/**
 * scoreAutoTrigger
 */
export const scoreAutoTrigger = new ScoreAutoTrigger()
