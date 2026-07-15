/**
 * @fileoverview 全局采集调度引擎
 *
 * 扩展现有 Widget 级 TaskScheduler 为全局定时调度引擎，支持：
 * - 多调度配置管理（注册/启用/禁用/删除）
 * - cron-like 定时执行（基于 FREQUENCY_MINUTES）
 * - 交易时段感知（A股 09:30-11:30 / 13:00-15:00）
 * - 连续失败熔断（maxConsecutiveFailures）
 * - 调度历史记录
 *
 * @module services/data-sync/globalScheduler
 * @created 2026-07-14 - 双通道整改 P1-1
 */

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import { FREQUENCY_MINUTES } from '@/config/collectConfig'
import type { UpdateFrequency } from '@/types/modules/collection.types'
import type { GlobalScheduleConfig } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 默认最大连续失败次数（超过后暂停调度） */
const MAX_CONSECUTIVE_FAILURES = 5

/** 调度器 tick 间隔（毫秒） */
const TICK_INTERVAL_MS = 60_000

/** A 股上午交易时段起始：09:30（单位：分钟） */
const MORNING_SESSION_START_MINUTES = 9 * 60 + 30

/** A 股上午交易时段结束：11:30（单位：分钟） */
const MORNING_SESSION_END_MINUTES = 11 * 60 + 30

/** A 股下午交易时段起始：13:00（单位：分钟） */
const AFTERNOON_SESSION_START_MINUTES = 13 * 60

/** A 股下午交易时段结束：15:00（单位：分钟） */
const AFTERNOON_SESSION_END_MINUTES = 15 * 60

/**
 * 判断当前时间是否在 A 股交易时段内
 * @param date - 当前时间
 * @returns 是否在交易时段
 */
export function isWithinTradingHours(date: Date = new Date()): boolean {
  const hour = date.getHours()
  const minute = date.getMinutes()
  const time = hour * 60 + minute
  const day = date.getDay()

  // 周末不执行
  if (day === 0 || day === 6) return false

  if (time >= MORNING_SESSION_START_MINUTES && time <= MORNING_SESSION_END_MINUTES) return true
  if (time >= AFTERNOON_SESSION_START_MINUTES && time <= AFTERNOON_SESSION_END_MINUTES) return true

  return false
}

/**
 * 检查当前时间是否在调度配置的活跃窗口内
 * @param config - 调度配置
 * @param now - 当前时间
 * @returns 是否在活跃窗口内
 */
function isWithinActiveWindow(config: GlobalScheduleConfig, now: Date = new Date()): boolean {
  // 无窗口配置 → 默认全天可用
  if (!config.activeWindow) return true

  const day = now.getDay()
  if (!config.activeWindow.weekdays.includes(day)) return false

  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return timeStr >= config.activeWindow.start && timeStr <= config.activeWindow.end
}

/**
 * 计算下次执行时间
 * @param frequency - 采集频率
 * @param now - 当前时间
 * @returns 下次执行时间 ISO 字符串
 */
function computeNextRunAt(frequency: UpdateFrequency, now: Date = new Date()): string {
  const intervalMinutes = FREQUENCY_MINUTES[frequency] ?? 1440
  const next = new Date(now.getTime() + intervalMinutes * 60_000)
  return next.toISOString()
}

/**
 * 全局采集调度引擎
 *
 * 管理多个调度配置，按频率定时触发采集任务。
 * 与 Widget 级 TaskScheduler 互补：TaskScheduler 管 Widget 级实时采集，
 * GlobalScheduler 管全局定时批量采集。
 */
class GlobalCollectionScheduler {
  /** 调度配置映射（scheduleId → config） */
  private schedules = new Map<string, GlobalScheduleConfig>()

  /** 定时器引用 */
  private tickTimer: ReturnType<typeof setInterval> | null = null

  /** 是否正在运行 */
  private running = false

  /** 全局运行计数器 */
  private globalRunCount = 0

  /**
   * 注册调度配置
   * @param config - 调度配置
   * @returns scheduleId
   */
  registerSchedule(config: GlobalScheduleConfig): string {
    const id = config.scheduleId
    config.nextRunAt = computeNextRunAt(config.frequency)
    this.schedules.set(id, config)
    logger.info('[GlobalScheduler] 调度已注册', {
      scheduleId: id,
      frequency: config.frequency,
      dimensions: config.dimensions,
      nextRunAt: config.nextRunAt,
    })
    return id
  }

  /**
   * 更新调度配置
   * @param scheduleId - 调度 ID
   * @param updates - 更新字段
   */
  updateSchedule(scheduleId: string, updates: Partial<GlobalScheduleConfig>): void {
    const existing = this.schedules.get(scheduleId)
    if (!existing) {
      logger.warn('[GlobalScheduler] 调度不存在，无法更新', { scheduleId })
      return
    }
    Object.assign(existing, updates)
    logger.info('[GlobalScheduler] 调度已更新', { scheduleId, updates: Object.keys(updates) })
  }

  /**
   * 删除调度配置
   * @param scheduleId - 调度 ID
   */
  removeSchedule(scheduleId: string): void {
    this.schedules.delete(scheduleId)
    logger.info('[GlobalScheduler] 调度已删除', { scheduleId })
  }

  /**
   * 启用调度
   * @param scheduleId - 调度 ID
   */
  enableSchedule(scheduleId: string): void {
    const config = this.schedules.get(scheduleId)
    if (config) {
      config.enabled = true
      config.nextRunAt = computeNextRunAt(config.frequency)
      logger.info('[GlobalScheduler] 调度已启用', { scheduleId, nextRunAt: config.nextRunAt })
    }
  }

  /**
   * 禁用调度
   * @param scheduleId - 调度 ID
   */
  disableSchedule(scheduleId: string): void {
    const config = this.schedules.get(scheduleId)
    if (config) {
      config.enabled = false
      logger.info('[GlobalScheduler] 调度已禁用', { scheduleId })
    }
  }

  /**
   * 立即触发指定调度
   * @param scheduleId - 调度 ID
   */
  async triggerNow(scheduleId: string): Promise<void> {
    const config = this.schedules.get(scheduleId)
    if (!config) {
      logger.warn('[GlobalScheduler] 调度不存在，无法触发', { scheduleId })
      return
    }
    await this.executeSchedule(config)
  }

  /**
   * 启动调度引擎
   */
  start(): void {
    if (this.running) {
      logger.warn('[GlobalScheduler] 引擎已在运行')
      return
    }
    this.running = true
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    logger.info('[GlobalScheduler] 引擎已启动', {
      tickInterval: TICK_INTERVAL_MS,
      scheduleCount: this.schedules.size,
    })
  }

  /**
   * 停止调度引擎
   */
  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.running = false
    logger.info('[GlobalScheduler] 引擎已停止')
  }

  /**
   * 执行一次 tick：检查所有调度是否需要执行
   */
  private async tick(): Promise<void> {
    const now = new Date()
    const nowIso = now.toISOString()

    for (const config of this.schedules.values()) {
      if (!config.enabled) continue
      if (config.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) continue
      if (!isWithinActiveWindow(config, now)) continue
      if (!config.nextRunAt || config.nextRunAt > nowIso) continue

      await this.executeSchedule(config)
    }
  }

  /**
   * 执行单个调度配置
   */
  private async executeSchedule(config: GlobalScheduleConfig): Promise<void> {
    const startTime = Date.now()
    this.globalRunCount++

    logger.info('[GlobalScheduler] 开始执行调度', {
      scheduleId: config.scheduleId,
      symbols: config.symbols.length,
      dimensions: config.dimensions,
      runCount: config.runCount + 1,
    })

    // 发射任务状态事件
    eventBus.emit(COLLECTION_EVENTS.TASK_STATUS, {
      taskId: `global_${config.scheduleId}_${this.globalRunCount}`,
      message: `全局调度执行: ${config.scheduleId}`,
      timestamp: Date.now(),
      payload: {
        scheduleId: config.scheduleId,
        symbols: config.symbols,
        dimensions: config.dimensions,
        channel: 'auto-collect',
      },
    })

    try {
      let successCount = 0
      const failCount = 0

      // 逐标的逐维度执行采集
      // 注意：实际采集调用 collectionPipeline.runSingleTrace/runBatchTrace
      // 此处通过事件触发，由 collectionRuntimeStore 监听执行
      for (const symbol of config.symbols) {
        for (const dimension of config.dimensions) {
          eventBus.emit(COLLECTION_EVENTS.TRIGGERED, {
            traceId: `auto_${symbol}_${dimension}_${Date.now()}`,
            symbol,
            dimensionCode: dimension,
            source: config.sourceScope.enabled,
            channel: 'auto-collect',
            timestamp: Date.now(),
          })

          // 实际采集由 collectionPipeline 订阅执行
          // 此处仅负责调度触发，不直接调用采集器
          successCount++
        }
      }

      config.runCount++
      config.consecutiveFailures = 0
      config.lastRunAt = new Date().toISOString()
      config.nextRunAt = computeNextRunAt(config.frequency)

      const elapsed = Date.now() - startTime
      logger.info('[GlobalScheduler] 调度执行完成', {
        scheduleId: config.scheduleId,
        successCount,
        failCount,
        elapsedMs: elapsed,
        nextRunAt: config.nextRunAt,
      })
    } catch (err) {
      config.consecutiveFailures++
      config.lastRunAt = new Date().toISOString()
      config.nextRunAt = computeNextRunAt(config.frequency)

      logger.error('[GlobalScheduler] 调度执行失败', {
        scheduleId: config.scheduleId,
        error: String(err),
        consecutiveFailures: config.consecutiveFailures,
      })

      if (config.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        config.enabled = false
        logger.warn('[GlobalScheduler] 调度因连续失败被熔断', {
          scheduleId: config.scheduleId,
          consecutiveFailures: config.consecutiveFailures,
        })
      }
    }
  }

  /**
   * 获取所有调度配置
   * @returns 调度配置数组
   */
  getAllSchedules(): GlobalScheduleConfig[] {
    return Array.from(this.schedules.values())
  }

  /**
   * 获取启用的调度数
   * @returns 启用数
   */
  getActiveCount(): number {
    let count = 0
    for (const config of this.schedules.values()) {
      if (config.enabled) count++
    }
    return count
  }

  /**
   * 获取全局运行计数
   */
  getGlobalRunCount(): number {
    return this.globalRunCount
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.running
  }
}

/** 全局调度引擎单例 */
export const globalScheduler = new GlobalCollectionScheduler()
