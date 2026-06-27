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

const logger = getLogger()

/**
 * 采集任务调度器
 * @description 负责单个 Widget 数据采集任务的注册、启动、停止、错误状态管理
 * @remarks 支持自动定时轮询，页面销毁时自动清理定时器防止内存泄漏
 */
export class TaskScheduler {
  private tasks = new Map<string, CollectionTask>()
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private collectors = new Map<string, BaseCollector>()
  private listeners = new Set<CollectionResultCallback>()
  private taskCounter = 0

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
    logger.info(`[TaskScheduler] 任务启动: ${taskId}, mode=${dataSource.mode}`)

    if (dataSource.mode === 'polling') {
      // 立即执行一次
      await this.executeTask(taskId)

      // 设置定时轮询
      const timer = setInterval(() => {
        this.executeTask(taskId).catch((err) => {
          logger.error(`[TaskScheduler] 轮询执行失败: ${taskId}`, { error: err })
        })
      }, dataSource.interval)

      this.timers.set(taskId, timer)
    } else if (dataSource.mode === 'once') {
      // 只执行一次
      await this.executeTask(taskId)
      task.status = 'completed'
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
    if (!task || task.status !== 'running') return

    const collector = this.collectors.get(taskId)
    if (!collector) return

    task.lastRun = Date.now()
    task.runCount++

    try {
      const rawData = await collector.collectWithRetry(task.dataSource)
      task.successCount++
      task.nextRun = Date.now() + task.dataSource.interval

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

      logger.error(`[TaskScheduler] 任务执行失败: ${taskId}`, { error })

      // 通知监听器错误
      this.listeners.forEach((listener) => {
        try {
          listener(taskId, null, error instanceof Error ? error : new Error(String(error)))
        } catch (err) {
          logger.error('[TaskScheduler] 错误监听器执行失败', { error: err })
        }
      })
    }
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
      default:
        logger.warn(`[TaskScheduler] 未知的数据源类型: ${type}, 使用 MockCollector`)
        return new MockCollector()
    }
  }
}

export const taskScheduler = new TaskScheduler()
