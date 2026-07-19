/**
 * V6 评分任务调度器
 *
 * 管理 Worker 池，将批量评分任务分片到多个 Worker 线程并行执行。
 * 设计约束：
 * - 主线程负责数据 I/O（IndexedDB 读写），Worker 只负责纯计算
 * - Worker 池大小上限 4（避免过度抢占浏览器资源）
 * - 支持优雅降级：Worker 不可用或初始化失败时回退到主线程 Promise.all
 * - 任务级超时保护，防止单股计算卡住整个批次
 */

import type {
  V6ScoreInput,
  CompositeScore,
  V6ScoreEngineConfig,
} from '@/services/scoring/v6-engine'
import type { WorkerRequest, WorkerResponse } from './v6ScoreWorker'
import { getLogger } from '@/lib/logger'
import { measureAsync } from '@/lib/perf'

const logger = getLogger()

/** 单任务元数据 */
interface TaskMeta {
  id: string
  input: V6ScoreInput
  config?: V6ScoreEngineConfig
  resolve: (result: CompositeScore) => void
  reject: (err: Error) => void
  startAt: number
  timeoutTimer?: ReturnType<typeof setTimeout>
}

/** 批次统计 */
export interface BatchScoreStats {
  total: number
  completed: number
  failed: number
  skipped: number
  totalMs: number
  avgMs: number
  workerCount: number
  fallbackToMainThread: boolean
}

/** 调度器配置 */
export interface TaskSchedulerOptions {
  /** Worker 实例数，默认 min(硬件并发数, 4) */
  maxWorkers?: number
  /** 单任务超时（ms），默认 30s */
  taskTimeoutMs?: number
  /** 是否强制回退到主线程（调试用） */
  forceMainThread?: boolean
}

/**
 * V6ScoreTaskScheduler
 *
 * 使用说明：
 *   const scheduler = new V6ScoreTaskScheduler()
 *   const result = await scheduler.calculate(input, config)
 *   const batch = await scheduler.calculateBatch(inputs, config, (done, total) => { ... })
 */
export class V6ScoreTaskScheduler {
  private workers: Worker[] = []
  private taskQueue: TaskMeta[] = []
  private activeTasks = new Map<string, TaskMeta>()
  private workerCount: number
  private taskTimeoutMs: number
  private fallbackMode = false
  private destroyed = false

  constructor(options: TaskSchedulerOptions = {}) {
    this.workerCount = Math.min(options.maxWorkers ?? (navigator.hardwareConcurrency || 4), 4)
    this.taskTimeoutMs = options.taskTimeoutMs ?? 30_000

    if (!options.forceMainThread) {
      this.initWorkers()
    } else {
      this.fallbackMode = true
      logger.info('[TaskScheduler] forceMainThread=true，回退到主线程计算')
    }
  }

  // ─── Worker 生命周期 ───────────────────────────────────────

  private initWorkers(): void {
    try {
      for (let i = 0; i < this.workerCount; i++) {
        const worker = new Worker(
          new URL('./v6ScoreWorker.ts', import.meta.url),
          { type: 'module' },
        )
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handleResponse(e.data)
        worker.onerror = (err) => this.handleWorkerError(err)
        this.workers.push(worker)
      }
      logger.info(`[TaskScheduler] Worker 池初始化完成，size=${this.workers.length}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn(`[TaskScheduler] Worker 初始化失败，回退到主线程: ${msg}`)
      this.fallbackMode = true
      this.workers = []
    }
  }

  private handleResponse(res: WorkerResponse): void {
    const task = this.activeTasks.get(res.id)
    if (!task) return

    this.activeTasks.delete(res.id)
    if (task.timeoutTimer) {
      clearTimeout(task.timeoutTimer)
    }
    const duration = Date.now() - task.startAt

    if (res.type === 'error') {
      logger.warn(`[TaskScheduler] 任务 ${res.id} 失败，耗时 ${duration}ms: ${res.error}`)
      task.reject(new Error(res.error))
    } else if (res.type === 'result') {
      logger.info(`[TaskScheduler] 任务 ${res.id} 完成，耗时 ${duration}ms`)
      task.resolve(res.result)
    }

    this.flushQueue()
  }

  private handleWorkerError(err: ErrorEvent): void {
    logger.error('[TaskScheduler] Worker 全局错误', { error: err.message })
    // 将当前 Worker 上的所有活跃任务标记为失败并重新入队
    const deadWorker = err.target as Worker
    const affected: TaskMeta[] = []
    for (const [id, task] of this.activeTasks) {
      // 保守策略：将所有未完成任务重新入队（实际可由具体任务重试机制优化）
      affected.push(task)
      this.activeTasks.delete(id)
    }
    if (affected.length > 0) {
      logger.warn(`[TaskScheduler] ${affected.length} 个任务因 Worker 错误重新入队`)
      this.taskQueue.unshift(...affected)
    }
    // 移除损坏的 Worker
    const idx = this.workers.indexOf(deadWorker)
    if (idx >= 0) this.workers.splice(idx, 1)
    // 如果没有可用 Worker，回退到主线程
    if (this.workers.length === 0) {
      this.fallbackMode = true
      logger.warn('[TaskScheduler] 所有 Worker 失效，切换到主线程回退模式')
    }
    this.flushQueue()
  }

  // ─── 任务调度 ────────────────────────────────────────────────

  private flushQueue(): void {
    if (this.fallbackMode || this.workers.length === 0) {
      return
    }

    while (this.taskQueue.length > 0 && this.activeTasks.size < this.workers.length) {
      const task = this.taskQueue.shift()!
      const workerIndex = this.activeTasks.size % this.workers.length
      const worker = this.workers[workerIndex]!
      if (!worker) {
        logger.error('[TaskScheduler] Worker 分配失败，任务重新入队')
        this.taskQueue.unshift(task)
        task.reject(new Error('Worker not available'))
        continue
      }
      this.activeTasks.set(task.id, task)
      const req: WorkerRequest = { id: task.id, type: 'calculate', input: task.input, config: task.config }
      worker.postMessage(req)
      logger.info(`[TaskScheduler] 分发任务 ${task.id} (${task.input.symbol}) -> worker#${workerIndex}`)

      task.timeoutTimer = setTimeout(() => {
        if (this.activeTasks.has(task.id)) {
          this.activeTasks.delete(task.id)
          task.reject(new Error(`Task timeout after ${this.taskTimeoutMs}ms`))
          logger.warn(`[TaskScheduler] 任务 ${task.id} 超时`)
        }
      }, this.taskTimeoutMs)
    }
  }

  /** 提交单任务 */
  private submitTask(task: TaskMeta): void {
    if (this.fallbackMode || this.workers.length === 0) {
      void this.runOnMainThread(task)
      return
      return
    }
    this.taskQueue.push(task)
    this.flushQueue()
  }

  /** 主线程回退执行 */
  private async runOnMainThread(task: TaskMeta): Promise<void> {
    try {
      const { createV6Engine } = await import('@/services/scoring/v6-engine')
      const engine = createV6Engine(task.config)
      const result = await engine.calculateAll(task.input)
      task.resolve(result)
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  // ─── 公共 API ────────────────────────────────────────────────

  /**
   * 单股评分（Worker 或主线程）
   */
  async calculate(
    input: V6ScoreInput,
    config?: V6ScoreEngineConfig,
  ): Promise<CompositeScore> {
    return new Promise((resolve, reject) => {
      const task: TaskMeta = {
        id: `task-${input.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        input,
        config,
        resolve,
        reject,
        startAt: Date.now(),
      }
      this.submitTask(task)
    })
  }

  /**
   * 批量评分
   *
   * @param inputs   股票输入列表
   * @param config   引擎配置（可选）
   * @param onProgress 进度回调 (completed, total)
   * @returns 批次统计 + 结果列表（按 input 顺序，失败项为 null）
   */
  async calculateBatch(
    inputs: V6ScoreInput[],
    config?: V6ScoreEngineConfig,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<{ stats: BatchScoreStats; results: (CompositeScore | null)[] }> {
    const stats: BatchScoreStats = {
      total: inputs.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      totalMs: 0,
      avgMs: 0,
      workerCount: this.fallbackMode ? 0 : this.workers.length,
      fallbackToMainThread: this.fallbackMode,
    }

    const start = performance.now()
    const results: (CompositeScore | null)[] = new Array(inputs.length).fill(null)

    // 先提交所有任务，保持索引顺序
    const promises = inputs.map((input, idx) =>
      measureAsync('scoring:worker-batch', async () => {
        try {
          const score = await this.calculate(input, config)
          results[idx] = score
          stats.completed++
          return score
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logger.error(`[TaskScheduler] ${input.symbol} 评分失败: ${msg}`)
          stats.failed++
          return null
        } finally {
          onProgress?.(stats.completed + stats.failed, stats.total)
        }
      }),
    )

    await Promise.all(promises)
    stats.totalMs = Math.round((performance.now() - start) * 100) / 100
    stats.avgMs = stats.total > 0 ? Math.round((stats.totalMs / stats.total) * 100) / 100 : 0

    logger.info('[TaskScheduler] 批量评分完成', { ...stats })
    return { stats, results }
  }

  /**
   * 销毁 Worker 池，释放资源。
   * 组件卸载时调用，避免内存泄漏。
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers = []
    this.taskQueue = []
    this.activeTasks.clear()
    logger.info('[TaskScheduler] Worker 池已销毁')
  }
}

/** 全局单例（应用生命周期内复用） */
let globalScheduler: V6ScoreTaskScheduler | null = null

/**
 * getGlobalScheduler
 * @param options?
 * @returns V6ScoreTaskScheduler
 */
export function getGlobalScheduler(options?: TaskSchedulerOptions): V6ScoreTaskScheduler {
  if (!globalScheduler) {
    globalScheduler = new V6ScoreTaskScheduler(options)
  }
  return globalScheduler
}

/**
 * destroyGlobalScheduler
 * @returns void
 */
export function destroyGlobalScheduler(): void {
  globalScheduler?.destroy()
  globalScheduler = null
}
