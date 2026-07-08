/**
 * @fileoverview PipelineScheduler - 分布式循环调度器
 * 
 * 职责：
 * - 管理数据处理管道的定时循环执行
 * - 提供循环状态管理与健康监控
 * - 实现指数退避重试机制
 * - 提供数据完整性校验与自动修复
 * 
 * 设计原则：
 * - 每个循环独立运行，互不影响
 * - 支持暂停/恢复/重置操作
 * - 完整的状态机管理（IDLE/RUNNING/PAUSED/SUCCESS/RETRY/FAILED）
 * - 内置健康检查与数据完整性保障
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from './databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { runV6Score } from '@/services/scoring/v6ScoreService'

const logger = getLogger()

export interface CycleStatus {
  name: string
  state: PipelineCycleState
  lastRunAt: number | null
  lastSuccessAt: number | null
  consecutiveFailures: number
  avgDurationMs: number
  totalRuns: number
  totalSuccesses: number
  totalFailures: number
  enabled: boolean
}

export type PipelineCycleState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'SUCCESS' | 'RETRY' | 'FAILED'

export interface IntegrityResult {
  status: 'healthy' | 'degraded' | 'critical'
  missingCount: number
  details?: Record<string, unknown>
}

export interface CycleConfig {
  name: string
  interval: number
  enabled: boolean
  maxRetries: number
  backoffFactor: number
  healthThreshold: number
  integrityCheck?: () => Promise<IntegrityResult>
  executor: () => Promise<void>
}

class PipelineCycle {
  private config: CycleConfig
  private state: PipelineCycleState = 'IDLE'
  private timer: ReturnType<typeof setTimeout> | null = null
  private retryCount = 0
  private consecutiveFailures = 0
  private lastRunAt: number | null = null
  private lastSuccessAt: number | null = null
  private totalRuns = 0
  private totalSuccesses = 0
  private totalFailures = 0
  private durations: number[] = []

  constructor(name: string, config: CycleConfig) {
    this.config = { ...config, name }
  }

  start(): void {
    if (!this.config.enabled) {
      logger.info(`[PipelineScheduler] 循环 "${this.config.name}" 未启用，跳过启动`)
      return
    }
    if (this.state === 'RUNNING') {
      logger.debug(`[PipelineScheduler] 循环 "${this.config.name}" 已在运行中`)
      return
    }

    logger.info(`[PipelineScheduler] 启动循环: "${this.config.name}"，间隔=${this.config.interval}ms`)
    this.state = 'RUNNING'
    this.scheduleNext()
  }

  stop(): void {
    logger.info(`[PipelineScheduler] 停止循环: "${this.config.name}"`)
    this.state = 'IDLE'
    this.clearTimer()
  }

  pause(): void {
    if (this.state === 'RUNNING') {
      logger.info(`[PipelineScheduler] 暂停循环: "${this.config.name}"`)
      this.state = 'PAUSED'
      this.clearTimer()
    }
  }

  resume(): void {
    if (this.state === 'PAUSED') {
      logger.info(`[PipelineScheduler] 恢复循环: "${this.config.name}"`)
      this.state = 'RUNNING'
      this.scheduleNext()
    }
  }

  reset(): void {
    logger.info(`[PipelineScheduler] 重置循环: "${this.config.name}"`)
    this.stop()
    this.retryCount = 0
    this.consecutiveFailures = 0
    this.durations = []
  }

  getStatus(): CycleStatus {
    const avgDuration = this.durations.length > 0
      ? this.durations.reduce((a, b) => a + b, 0) / this.durations.length
      : 0

    return {
      name: this.config.name,
      state: this.state,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      consecutiveFailures: this.consecutiveFailures,
      avgDurationMs: Math.round(avgDuration),
      totalRuns: this.totalRuns,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      enabled: this.config.enabled,
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleNext(): void {
    if (this.state !== 'RUNNING') return

    const delay = this.retryCount > 0
      ? this.config.interval * Math.pow(this.config.backoffFactor, this.retryCount)
      : this.config.interval

    logger.debug(`[PipelineScheduler] 循环 "${this.config.name}" 下次执行: ${delay}ms 后`)

    this.timer = setTimeout(async () => {
      await this.execute()
      if (this.state === 'RUNNING') {
        this.scheduleNext()
      }
    }, delay)
  }

  private async execute(): Promise<void> {
    this.lastRunAt = Date.now()
    this.totalRuns++
    logger.info(`[PipelineScheduler] 开始执行循环: "${this.config.name}"`)

    try {
      const startTime = Date.now()
      await this.config.executor()
      const duration = Date.now() - startTime

      this.recordSuccess(duration)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[PipelineScheduler] 循环 "${this.config.name}" 执行失败: ${message}`)
      this.recordFailure()

      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++
        this.state = 'RETRY'
        logger.info(`[PipelineScheduler] 循环 "${this.config.name}" 重试中: ${this.retryCount}/${this.config.maxRetries}`)
      } else {
        this.state = 'FAILED'
        logger.error(`[PipelineScheduler] 循环 "${this.config.name}" 达到最大重试次数，状态变为 FAILED`)

        await this.triggerHealthCheck()
      }
    }
  }

  private recordSuccess(duration: number): void {
    this.state = 'SUCCESS'
    this.lastSuccessAt = Date.now()
    this.totalSuccesses++
    this.consecutiveFailures = 0
    this.retryCount = 0

    this.durations.push(duration)
    if (this.durations.length > 10) {
      this.durations.shift()
    }

    logger.info(`[PipelineScheduler] 循环 "${this.config.name}" 执行成功，耗时=${duration}ms`)
  }

  private recordFailure(): void {
    this.totalFailures++
    this.consecutiveFailures++
  }

  private async triggerHealthCheck(): Promise<void> {
    if (this.config.integrityCheck) {
      logger.info(`[PipelineScheduler] 循环 "${this.config.name}" 触发完整性检查`)
      try {
        const result = await this.config.integrityCheck()
        logger.info(`[PipelineScheduler] 完整性检查结果: ${result.status}, missing=${result.missingCount}`)

        if (result.status !== 'healthy') {
          await this.attemptRepair(result)
        }
      } catch (err) {
        logger.error(`[PipelineScheduler] 完整性检查失败`, { error: err })
      }
    }
  }

  private async attemptRepair(_result: IntegrityResult): Promise<void> {
    logger.warn(`[PipelineScheduler] 循环 "${this.config.name}" 数据完整性受损，尝试自动修复`)
  }
}

export class PipelineScheduler {
  private cycles = new Map<string, PipelineCycle>()
  private running = false

  registerCycle(name: string, config: CycleConfig): void {
    if (this.cycles.has(name)) {
      logger.warn(`[PipelineScheduler] 循环 "${name}" 已存在，将被覆盖`)
    }

    const cycle = new PipelineCycle(name, config)
    this.cycles.set(name, cycle)
    logger.info(`[PipelineScheduler] 注册循环: "${name}"`)
  }

  start(): void {
    if (this.running) {
      logger.warn(`[PipelineScheduler] 调度器已在运行中`)
      return
    }

    this.running = true
    logger.info(`[PipelineScheduler] 启动调度器，共 ${this.cycles.size} 个循环`)

    for (const cycle of this.cycles.values()) {
      cycle.start()
    }
  }

  stop(): void {
    if (!this.running) {
      logger.warn(`[PipelineScheduler] 调度器未在运行`)
      return
    }

    this.running = false
    logger.info(`[PipelineScheduler] 停止调度器`)

    for (const cycle of this.cycles.values()) {
      cycle.stop()
    }
  }

  pauseCycle(name: string): void {
    const cycle = this.cycles.get(name)
    if (cycle) {
      cycle.pause()
    } else {
      logger.error(`[PipelineScheduler] 循环 "${name}" 不存在`)
    }
  }

  resumeCycle(name: string): void {
    const cycle = this.cycles.get(name)
    if (cycle) {
      cycle.resume()
    } else {
      logger.error(`[PipelineScheduler] 循环 "${name}" 不存在`)
    }
  }

  resetCycle(name: string): void {
    const cycle = this.cycles.get(name)
    if (cycle) {
      cycle.reset()
    } else {
      logger.error(`[PipelineScheduler] 循环 "${name}" 不存在`)
    }
  }

  getStatus(): CycleStatus[] {
    return Array.from(this.cycles.values()).map(c => c.getStatus())
  }

  getCycleStatus(name: string): CycleStatus | undefined {
    return this.cycles.get(name)?.getStatus()
  }

  isHealthy(): boolean {
    const statuses = this.getStatus()
    const failedCycles = statuses.filter(s => s.state === 'FAILED' && s.enabled)
    return failedCycles.length === 0
  }
}

export class DataIntegrityGuard {
  async checkStockPool(): Promise<IntegrityResult> {
    logger.info('[DataIntegrityGuard] 开始校验股票池数据完整性')

    const stocksResult = await dataBridge.query<{ symbol: string }[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
    })

    const scoresResult = await dataBridge.query<{ symbol: string }[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.v6Scores,
    })

    const stocks = stocksResult.success && stocksResult.data ? stocksResult.data : []
    const scores = scoresResult.success && scoresResult.data ? scoresResult.data : []

    const stockSymbols = new Set(stocks.map(s => s.symbol))
    const scoreSymbols = new Set(scores.map(s => s.symbol))

    const missingScores = stocks.filter(s => !scoreSymbols.has(s.symbol))
    const extraScores = scores.filter(s => !stockSymbols.has(s.symbol))

    const missingCount = missingScores.length + extraScores.length

    let status: IntegrityResult['status'] = 'healthy'
    if (missingCount > 0 && missingCount <= stocks.length * 0.1) {
      status = 'degraded'
    } else if (missingCount > stocks.length * 0.1) {
      status = 'critical'
    }

    logger.info('[DataIntegrityGuard] 股票池数据完整性校验完成', {
      status,
      stockCount: stocks.length,
      scoreCount: scores.length,
      missingScores: missingScores.length,
      extraScores: extraScores.length,
    })

    return {
      status,
      missingCount,
      details: {
        stockCount: stocks.length,
        scoreCount: scores.length,
        missingScores: missingScores.map(s => s.symbol),
        extraScores: extraScores.map(s => s.symbol),
      },
    }
  }

  async checkStrategyData(): Promise<IntegrityResult> {
    logger.info('[DataIntegrityGuard] 开始校验策略数据完整性')

    const stocksResult = await dataBridge.query<{ symbol: string }[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
    })

    const hotSectorResult = await dataBridge.query<{ symbol: string }[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.hotSectorScores,
    })

    const valuePitResult = await dataBridge.query<{ symbol: string }[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.valuePitScores,
    })

    const stocks = stocksResult.success && stocksResult.data ? stocksResult.data : []
    const hotSector = hotSectorResult.success && hotSectorResult.data ? hotSectorResult.data : []
    const valuePit = valuePitResult.success && valuePitResult.data ? valuePitResult.data : []

    const hotSectorSymbols = new Set(hotSector.map(s => s.symbol))
    const valuePitSymbols = new Set(valuePit.map(s => s.symbol))

    const missingHotSector = stocks.filter(s => !hotSectorSymbols.has(s.symbol))
    const missingValuePit = stocks.filter(s => !valuePitSymbols.has(s.symbol))

    const missingCount = missingHotSector.length + missingValuePit.length

    let status: IntegrityResult['status'] = 'healthy'
    if (missingCount > 0 && missingCount <= stocks.length * 0.2) {
      status = 'degraded'
    } else if (missingCount > stocks.length * 0.2) {
      status = 'critical'
    }

    logger.info('[DataIntegrityGuard] 策略数据完整性校验完成', {
      status,
      stockCount: stocks.length,
      hotSectorCount: hotSector.length,
      valuePitCount: valuePit.length,
      missingHotSector: missingHotSector.length,
      missingValuePit: missingValuePit.length,
    })

    return {
      status,
      missingCount,
      details: {
        stockCount: stocks.length,
        hotSectorCount: hotSector.length,
        valuePitCount: valuePit.length,
      },
    }
  }

  async repairMissingScores(): Promise<void> {
    logger.info('[DataIntegrityGuard] 开始自动修复缺失评分')

    const result = await this.checkStockPool()
    if (result.status === 'healthy') {
      logger.info('[DataIntegrityGuard] 数据完整，无需修复')
      return
    }

    const missingSymbols = (result.details as Record<string, unknown>)?.missingScores as string[] ?? []
    logger.info(`[DataIntegrityGuard] 需要修复 ${missingSymbols.length} 个缺失评分`)

    let successCount = 0
    let failureCount = 0

    for (const symbol of missingSymbols) {
      try {
        const scoreResult = await runV6Score(symbol)
        if (scoreResult.success) {
          successCount++
          logger.info(`[DataIntegrityGuard] 修复成功: ${symbol}`)
        } else {
          failureCount++
          logger.warn(`[DataIntegrityGuard] 修复失败: ${symbol}, ${scoreResult.error}`)
        }
      } catch (err) {
        failureCount++
        logger.error(`[DataIntegrityGuard] 修复异常: ${symbol}`, { error: err })
      }
    }

    logger.info('[DataIntegrityGuard] 自动修复完成', {
      total: missingSymbols.length,
      success: successCount,
      failure: failureCount,
    })
  }
}

export const pipelineScheduler = new PipelineScheduler()
export const dataIntegrityGuard = new DataIntegrityGuard()