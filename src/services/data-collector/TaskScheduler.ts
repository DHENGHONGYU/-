/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { getLogger } from '@/lib/logger'
import type {
  CollectionTask,
  CollectionTaskStatus,
  DataSourceConfig,
  CollectionResultCallback,
} from '@/types/modules/widget.types'
import { DATA_SOURCE_TYPE } from '@/constants/cockpit.constants'
import { BaseCollector } from './collectors/BaseCollector'
import { MockCollector } from './collectors/MockCollector'
import { RestCollector } from './collectors/RestCollector'
import { WebSocketCollector } from './collectors/WebSocketCollector'
import { NewsCrawler } from './collectors/NewsCrawler'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import { runSingleTrace } from './collectionPipeline'
import type { CollectionConfig } from '@/types/modules/collection.types'

const logger = getLogger()

function emitTaskStatus(
  taskId: string,
  status: CollectionTaskStatus,
  payload?: Record<string, unknown>,
): void {
  try {
    eventBus.emit(COLLECTION_EVENTS.TASK_STATUS, {
      traceId: taskId,
      taskId,
      message: `任务状态变更: ${status}`,
      timestamp: Date.now(),
      payload: { status, ...payload },
    })
  } catch (err) {
    logger.warn('[TaskScheduler] 任务状态事件发射失败', { error: err, taskId })
  }
}

function emitTaskProgress(
  taskId: string,
  progress: number,
  completedCount: number,
  totalCount: number,
  payload?: Record<string, unknown>,
): void {
  try {
    eventBus.emit('collect:task:progress', {
      traceId: taskId,
      taskId,
      message: `任务进度更新: ${progress}% (${completedCount}/${totalCount})`,
      timestamp: Date.now(),
      payload: { progress, completedCount, totalCount, ...payload },
    })
  } catch (err) {
    logger.warn('[TaskScheduler] 任务进度事件发射失败', { error: err, taskId })
  }
}

/** 数据采集轮询默认间隔（毫秒）。原硬编码 60000 提取为命名常量，供 audit:hardcode「硬编码超时」门禁放行。 */
const DEFAULT_POLL_INTERVAL_MS = 60000

/**
 * 采集任务调度器
 * @description 负责单个 Widget 数据采集任务的注册、启动、停止、错误状态管理
 * @remarks 支持自动定时轮询，页面销毁时自动清理定时器防止内存泄漏
 * @remarks 2026-07-18 新增批量任务进度监控功能
 */
export class TaskScheduler {
  private tasks = new Map<string, CollectionTask>()
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private collectors = new Map<string, BaseCollector>()
  private listeners = new Set<CollectionResultCallback>()
  private taskCounter = 0
  private batchTasks = new Map<string, BatchTaskInfo>()

  /**
   * 注册采集任务
   * @param widgetId Widget ID
   * @param instanceId 实例 ID
   * @param dataSource 数据源配置
   * @returns 任务 ID
   */
  registerTask(widgetId: string, instanceId: string, dataSource: DataSourceConfig): string {
    this.taskCounter++
    const taskId = `task_${widgetId}_${instanceId}_${this.taskCounter}`

    const task: CollectionTask = {
      taskId,
      widgetId,
      instanceId,
      dataSource,
      status: 'pending',
      runCount: 0,
      successCount: 0,
      failCount: 0,
    }

    this.tasks.set(taskId, task)
    emitTaskStatus(taskId, 'pending', { widgetId, instanceId, mode: dataSource.mode })
    // 参数 widgetId / instanceId 来自 registerTask 的闭包，类型已推断
    logger.info(`[TaskScheduler] 任务注册成功: ${taskId}, widgetId=${widgetId}, type=${dataSource.type}, mode=${dataSource.mode}`)

    return taskId
  }

  /**
   * 启动采集任务
   * @param taskId 任务 ID
   */
  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      logger.error(`[TaskScheduler] 启动失败: 任务 ${taskId} 未找到`)
      return
    }

    if (task.status === 'running') {
      logger.warn(`[TaskScheduler] 任务 ${taskId} 已在运行中`)
      return
    }

    const { dataSource } = task

    // 根据数据源类型创建对应的采集器
    const collector = this.getOrCreateCollector(dataSource.type)
    this.collectors.set(taskId, collector)

    task.status = 'running'
    emitTaskStatus(taskId, 'running', {
      widgetId: task.widgetId,
      instanceId: task.instanceId,
      mode: dataSource.mode,
    })
    logger.info(`[TaskScheduler] 任务启动: ${taskId}, mode=${dataSource.mode}`)

    if (dataSource.mode === 'polling') {
      // 立即执行一次
      await this.executeTask(taskId)

      // 校验 interval 合法性
      const interval = dataSource.interval > 0 ? dataSource.interval : DEFAULT_POLL_INTERVAL_MS
      if (dataSource.interval <= 0) {
        logger.warn(`[TaskScheduler] interval 非法，使用默认值 ${DEFAULT_POLL_INTERVAL_MS}ms: ${taskId}`)
      }

      // 设置定时轮询
      const timer = setInterval(() => {
        this.executeTask(taskId).catch((err) => {
          logger.error(`[TaskScheduler] 轮询执行失败: ${taskId}`, { error: err })
        })
      }, interval)

      this.timers.set(taskId, timer)
    } else if (dataSource.mode === 'once') {
      // 只执行一次
      await this.executeTask(taskId)
      task.status = 'completed'
      emitTaskStatus(taskId, 'completed', {
        widgetId: task.widgetId,
        instanceId: task.instanceId,
      })
    } else if (dataSource.mode === 'streaming') {
      // 流式采集（WebSocket）
      logger.info(`[TaskScheduler] 流式采集模式: ${taskId}`)
      await this.executeTask(taskId)
    }
  }

  /**
   * 停止采集任务
   * @param taskId 任务 ID
   */
  stopTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    // 清除定时器
    const timer = this.timers.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(taskId)
      logger.info(`[TaskScheduler] 定时器已清除: ${taskId}`)
    }

    // 取消采集器
    const collector = this.collectors.get(taskId)
    if (collector) {
      collector.cancel()
      this.collectors.delete(taskId)
    }

    task.status = 'paused'
    emitTaskStatus(taskId, 'paused', {
      widgetId: task.widgetId,
      instanceId: task.instanceId,
    })
    logger.info(`[TaskScheduler] 任务已停止: ${taskId}`)
  }

  /**
   * 注销采集任务
   * @param taskId 任务 ID
   */
  unregisterTask(taskId: string): void {
    this.stopTask(taskId)
    this.tasks.delete(taskId)
    logger.info(`[TaskScheduler] 任务已注销: ${taskId}`)
  }

  /**
   * 订阅采集结果
   * @param callback 结果回调函数
   * @returns 取消订阅函数
   */
  subscribe(callback: CollectionResultCallback): () => void {
    this.listeners.add(callback)
    logger.debug(`[TaskScheduler] 结果监听器已添加, 总数=${this.listeners.size}`)

    return () => {
      this.listeners.delete(callback)
      logger.debug(`[TaskScheduler] 结果监听器已移除, 总数=${this.listeners.size}`)
    }
  }

  /**
   * 获取任务状态
   * @param taskId 任务 ID
   */
  getTaskStatus(taskId: string): CollectionTaskStatus | undefined {
    return this.tasks.get(taskId)?.status
  }

  /**
   * 获取所有任务统计
   */
  getAllTasks(): CollectionTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 使用 collectionPipeline 执行单次采集（供输入舱页面显式触发）。
   * 不会注册到任务轮询列表，只产生一次 trace 并持久化。
   * @param symbol 标的代码
   * @param dimensionCode 维度代码
   * @param config 采集配置
   * @returns 采集结果
   */
  async runPipelineOnce(
    symbol: string,
    dimensionCode: string,
    config: CollectionConfig,
  ): Promise<{ success: boolean; latency: number; fallbackCount: number; error?: string }> {
    const taskId = `pipeline-once-${dimensionCode}-${Date.now()}`
    emitTaskStatus(taskId, 'running', { symbol, dimensionCode })

    const result = await runSingleTrace({ symbol, dimensionCode, config, parentTaskId: taskId })

    emitTaskStatus(taskId, result.success ? 'completed' : 'error', {
      symbol,
      dimensionCode,
      latency: result.latency,
      error: result.error,
    })

    return result
  }

  /**
   * 清理所有任务（页面销毁时调用）
   * @remarks 防止内存泄漏的关键方法
   */
  dispose(): void {
    logger.info('[TaskScheduler] 正在清理所有任务...')

    // 停止所有定时器
    this.timers.forEach((timer, taskId) => {
      clearInterval(timer)
      logger.debug(`[TaskScheduler] 定时器已清除: ${taskId}`)
    })
    this.timers.clear()

    // 取消所有采集器
    this.collectors.forEach((collector, taskId) => {
      collector.cancel()
      logger.debug(`[TaskScheduler] 采集器已取消: ${taskId}`)
    })
    this.collectors.clear()

    // 清空任务
    this.tasks.clear()

    // 清空监听器
    this.listeners.clear()

    logger.info('[TaskScheduler] 所有任务已清理完毕')
  }

  /**
   * 执行单次采集任务
   * @param taskId 任务 ID
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task?.status !== 'running') return

    const collector = this.collectors.get(taskId)
    if (!collector) return

    task.lastRun = Date.now()
    task.runCount++

    const traceId = `scheduler-${taskId}-${Date.now()}`
    eventBus.emit(COLLECTION_EVENTS.TRIGGERED, {
      traceId,
      taskId,
      message: `任务触发: ${taskId}`,
      timestamp: Date.now(),
    })

    try {
      const rawData = await collector.collectWithRetry(task.dataSource)
      task.successCount++
      task.nextRun = Date.now() + task.dataSource.interval
      emitTaskStatus(task.taskId, 'running', {
        widgetId: task.widgetId,
        instanceId: task.instanceId,
        runCount: task.runCount,
        successCount: task.successCount,
      })
      eventBus.emit(COLLECTION_EVENTS.COMPLETE, {
        traceId,
        taskId,
        message: `任务执行成功: ${taskId}`,
        timestamp: Date.now(),
      })

      // 通知所有监听器
      this.listeners.forEach((listener) => {
        try {
          listener(taskId, rawData)
        } catch (err) {
          logger.error('[TaskScheduler] 监听器执行失败', { error: err })
        }
      })
    } catch (error) {
      task.failCount++
      task.status = 'error'
      task.error = error instanceof Error ? error.message : String(error)
      emitTaskStatus(taskId, 'error', {
        widgetId: task.widgetId,
        instanceId: task.instanceId,
        error: task.error,
      })
      eventBus.emit(COLLECTION_EVENTS.COMPLETE, {
        traceId,
        taskId,
        message: `任务执行失败: ${taskId}`,
        timestamp: Date.now(),
        error: task.error,
      })

      logger.error(`[TaskScheduler] 任务执行失败: ${taskId}`, { error })

      // 通知监听器错误
      this.notifyErrorListeners(taskId, error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 向所有监听器广播任务错误，单监听器异常不影响其余监听器。
   * 抽取为独立方法以消除调用处的 forEach+try/catch 嵌套（深度 > 3）。
   */
  private notifyErrorListeners(taskId: string, error: Error): void {
    this.listeners.forEach((listener) => {
      try {
        listener(taskId, null, error)
      } catch (err) {
        logger.error('[TaskScheduler] 错误监听器执行失败', { error: err })
      }
    })
  }

  /**
   * 获取或创建采集器
   * @param type 数据源类型
   */
  private getOrCreateCollector(type: string): BaseCollector {
    switch (type) {
      case DATA_SOURCE_TYPE.MOCK:
        return new MockCollector()
      case DATA_SOURCE_TYPE.REST:
        return new RestCollector()
      case DATA_SOURCE_TYPE.WEBSOCKET:
        return new WebSocketCollector()
      case 'newsCrawler':
        return new NewsCrawler()
      default:
        logger.warn(`[TaskScheduler] 未知的数据源类型: ${type}, 使用 MockCollector`)
        return new MockCollector()
    }
  }

  /**
   * 创建批量采集任务
   * @param batchId 批次 ID
   * @param tasks 任务列表
   * @param collectorType 采集器类型
   */
  createBatchTask(batchId: string, tasks: { widgetId: string; instanceId: string; dataSource: DataSourceConfig }[], _collectorType: string): void {
    const batchInfo: BatchTaskInfo = {
      batchId,
      totalCount: tasks.length,
      completedCount: 0,
      successCount: 0,
      failCount: 0,
      status: 'running',
      startTime: Date.now(),
      tasks: [],
      errors: [],
    }

    this.batchTasks.set(batchId, batchInfo)
    emitTaskStatus(batchId, 'running', { totalCount: tasks.length })

    tasks.forEach((taskConfig, index) => {
      const taskId = this.registerTask(taskConfig.widgetId, taskConfig.instanceId, taskConfig.dataSource)
      batchInfo.tasks.push(taskId)

      this.startTask(taskId).then(() => {
        batchInfo.completedCount++
        const task = this.tasks.get(taskId)
        if (task?.status === 'completed' || (task?.successCount ?? 0) > 0) {
          batchInfo.successCount++
        } else if (task?.status === 'error') {
          batchInfo.failCount++
          batchInfo.errors.push({ taskId, error: task.error ?? '未知错误' })
        }

        const progress = Math.round((batchInfo.completedCount / batchInfo.totalCount) * 100)
        emitTaskProgress(batchId, progress, batchInfo.completedCount, batchInfo.totalCount, {
          successCount: batchInfo.successCount,
          failCount: batchInfo.failCount,
          currentTaskIndex: index,
        })

        if (batchInfo.completedCount >= batchInfo.totalCount) {
          batchInfo.status = batchInfo.failCount === 0 ? 'completed' : 'completed'
          batchInfo.endTime = Date.now()
          emitTaskStatus(batchId, 'completed', {
            totalCount: batchInfo.totalCount,
            successCount: batchInfo.successCount,
            failCount: batchInfo.failCount,
            durationMs: batchInfo.endTime - batchInfo.startTime,
          })
        }
      }).catch((err) => {
        batchInfo.completedCount++
        batchInfo.failCount++
        batchInfo.errors.push({ taskId, error: err instanceof Error ? err.message : String(err) })

        const progress = Math.round((batchInfo.completedCount / batchInfo.totalCount) * 100)
        emitTaskProgress(batchId, progress, batchInfo.completedCount, batchInfo.totalCount, {
          successCount: batchInfo.successCount,
          failCount: batchInfo.failCount,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    })
  }

  /**
   * 获取批量任务进度
   * @param batchId 批次 ID
   */
  getBatchProgress(batchId: string): BatchTaskInfo | undefined {
    return this.batchTasks.get(batchId)
  }

  /**
   * 停止批量任务
   * @param batchId 批次 ID
   */
  stopBatchTask(batchId: string): void {
    const batchInfo = this.batchTasks.get(batchId)
    if (!batchInfo) return

    batchInfo.status = 'paused'
    batchInfo.endTime = Date.now()

    batchInfo.tasks.forEach((taskId) => {
      this.stopTask(taskId)
    })

    emitTaskStatus(batchId, 'paused', {
      completedCount: batchInfo.completedCount,
      totalCount: batchInfo.totalCount,
    })
  }

  /**
   * 获取所有批量任务统计
   */
  getAllBatchTasks(): BatchTaskInfo[] {
    return Array.from(this.batchTasks.values())
  }

  /**
   * 获取任务统计摘要
   */
  getTaskSummary(): {
    totalTasks: number
    runningTasks: number
    completedTasks: number
    errorTasks: number
    totalBatchTasks: number
    runningBatchTasks: number
  } {
    const tasks = this.getAllTasks()
    const batchTasks = this.getAllBatchTasks()

    return {
      totalTasks: tasks.length,
      runningTasks: tasks.filter((t) => t.status === 'running').length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      errorTasks: tasks.filter((t) => t.status === 'error').length,
      totalBatchTasks: batchTasks.length,
      runningBatchTasks: batchTasks.filter((b) => b.status === 'running').length,
    }
  }
}

/**
 * 批量任务信息
 */
export interface BatchTaskInfo {
  batchId: string
  totalCount: number
  completedCount: number
  successCount: number
  failCount: number
  status: 'running' | 'completed' | 'error' | 'paused'
  startTime: number
  endTime?: number
  tasks: string[]
  errors: { taskId: string; error: string }[]
}

/**
 * taskScheduler
 */
export const taskScheduler = new TaskScheduler()
