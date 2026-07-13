/**
 * @module taskQueue
 * @lifecycle @Global
 * @description Agent 任务队列。支持优先级调度、并发控制和状态订阅。
 *
 * @remarks
 * - 优先级：high > normal > low，同优先级内 FIFO
 * - 并发控制：按 agentId 维度限制并发数
 * - 状态变更通过订阅机制通知外部
 *
 * @see src/agents/agentRuntime.ts
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type TaskPriority = 'high' | 'normal' | 'low'

export interface QueuedTask {
  id: string
  agentId: string
  type: string
  payload: unknown
  timeout: number
  priority: TaskPriority
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  result?: unknown
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export type TaskQueueListener = (task: QueuedTask) => void

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
}

export class TaskQueue {
  private pending = new Map<string, QueuedTask>()
  private running = new Map<string, QueuedTask>()
  private completed = new Map<string, QueuedTask>()
  private listeners = new Set<TaskQueueListener>()
  private maxConcurrentPerAgent = new Map<string, number>()
  private drainTimers = new Map<string, ReturnType<typeof queueMicrotask> | number>()

  setMaxConcurrent(agentId: string, max: number): void {
    this.maxConcurrentPerAgent.set(agentId, max)
    logger.debug(`[TaskQueue] setMaxConcurrent: agentId="${agentId}", max=${max}`)
  }

  enqueue(task: Omit<QueuedTask, 'status' | 'createdAt'> & { status?: QueuedTask['status']; createdAt?: number }): QueuedTask {
    const fullTask: QueuedTask = {
      status: 'pending',
      createdAt: Date.now(),
      ...task,
    }

    this.pending.set(fullTask.id, fullTask)
    const stats = this.getStats()
    const pendingIds = Array.from(this.pending.keys())
    logger.info(`[TaskQueue] Enqueued`, {
      taskId: fullTask.id,
      agentId: fullTask.agentId,
      type: fullTask.type,
      priority: fullTask.priority,
      queueSize: stats.pending,
      totalTasks: stats.total,
      remainingTaskIds: pendingIds,
    })

    this.notify(fullTask)
    this.scheduleDrain(fullTask.agentId)

    return fullTask
  }

  dequeue(agentId: string): QueuedTask | undefined {
    const pendingForAgent = Array.from(this.pending.values())
      .filter((t) => t.agentId === agentId && t.status === 'pending')
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority]
        const pb = PRIORITY_ORDER[b.priority]
        if (pa !== pb) return pa - pb
        return a.createdAt - b.createdAt
      })

    if (pendingForAgent.length === 0) {
      logger.info(`[TaskQueue] Dequeue skipped: no pending tasks for agentId="${agentId}"`)
      return undefined
    }

    const task = pendingForAgent[0] as QueuedTask
    this.pending.delete(task.id)
    task.status = 'running'
    task.startedAt = Date.now()
    this.running.set(task.id, task)

    const stats = this.getStats()
    const remainingIds = Array.from(this.pending.keys())
    logger.info(`[TaskQueue] Dequeued`, {
      taskId: task.id,
      agentId: task.agentId,
      type: task.type,
      priority: task.priority,
      pendingQueueSize: stats.pending,
      runningCount: stats.running,
      totalTasks: stats.total,
      remainingTaskIds: remainingIds,
    })
    this.notify(task)
    return task
  }

  markCompleted(taskId: string, result: unknown): void {
    const task = this.running.get(taskId)
    if (!task) return

    task.status = 'completed'
    task.result = result
    task.completedAt = Date.now()
    this.running.delete(taskId)
    this.completed.set(taskId, task)

    logger.info(`[TaskQueue] Completed: taskId="${taskId}", agentId="${task.agentId}"`)
    this.notify(task)
    this.scheduleDrain(task.agentId)
  }

  markFailed(taskId: string, error: string): void {
    const task = this.running.get(taskId)
    if (!task) return

    task.status = 'failed'
    task.error = error
    task.completedAt = Date.now()
    this.running.delete(taskId)
    this.completed.set(taskId, task)

    logger.error(`[TaskQueue] Failed: taskId="${taskId}", error="${error}"`)
    this.notify(task)
    this.scheduleDrain(task.agentId)
  }

  markTimeout(taskId: string): void {
    const task = this.running.get(taskId)
    if (!task) return

    task.status = 'timeout'
    task.error = `Task timeout after ${task.timeout}ms`
    task.completedAt = Date.now()
    this.running.delete(taskId)
    this.completed.set(taskId, task)

    logger.warn(`[TaskQueue] Timeout: taskId="${taskId}"`)
    this.notify(task)
    this.scheduleDrain(task.agentId)
  }

  cancel(taskId: string): boolean {
    const pendingTask = this.pending.get(taskId)
    if (pendingTask) {
      pendingTask.status = 'cancelled'
      pendingTask.error = 'Task cancelled'
      pendingTask.completedAt = Date.now()
      this.pending.delete(taskId)
      this.completed.set(taskId, pendingTask)
      logger.info(`[TaskQueue] Cancelled pending task: taskId="${taskId}"`)
      this.notify(pendingTask)
      return true
    }

    const runningTask = this.running.get(taskId)
    if (runningTask) {
      runningTask.status = 'cancelled'
      runningTask.error = 'Task cancelled'
      runningTask.completedAt = Date.now()
      this.running.delete(taskId)
      this.completed.set(taskId, runningTask)
      logger.info(`[TaskQueue] Cancelled running task: taskId="${taskId}"`)
      this.notify(runningTask)
      this.scheduleDrain(runningTask.agentId)
      return true
    }

    return false
  }

  get(taskId: string): QueuedTask | undefined {
    return (
      this.pending.get(taskId) ??
      this.running.get(taskId) ??
      this.completed.get(taskId)
    )
  }

  list(status?: QueuedTask['status']): QueuedTask[] {
    const all = [
      ...this.pending.values(),
      ...this.running.values(),
      ...this.completed.values(),
    ]
    return status ? all.filter((t) => t.status === status) : all
  }

  getRunningCount(agentId: string): number {
    let count = 0
    for (const task of this.running.values()) {
      if (task.agentId === agentId) count++
    }
    return count
  }

  getStats() {
    return {
      pending: this.pending.size,
      running: this.running.size,
      completed: this.completed.size,
      total: this.pending.size + this.running.size + this.completed.size,
    }
  }

  subscribe(listener: TaskQueueListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(task: QueuedTask): void {
    this.listeners.forEach((l) => {
      try {
        l(task)
      } catch (err) {
        logger.error('[TaskQueue] Listener error', { error: err instanceof Error ? err.message : String(err) })
      }
    })
  }

  private scheduleDrain(agentId: string): void {
    if (this.drainTimers.has(agentId)) return

    const timerId = queueMicrotask(() => {
      this.drainTimers.delete(agentId)
      this.drain(agentId)
    })
    this.drainTimers.set(agentId, timerId)
  }

  private drain(agentId: string): void {
    const maxConcurrent = this.maxConcurrentPerAgent.get(agentId) ?? 1
    const runningCount = this.getRunningCount(agentId)

    if (runningCount >= maxConcurrent) {
      logger.debug(`[TaskQueue] drain skipped: ${runningCount}/${maxConcurrent} running for "${agentId}"`)
      return
    }

    const slots = maxConcurrent - runningCount
    for (let i = 0; i < slots; i++) {
      const task = this.dequeue(agentId)
      if (!task) break
    }
  }
}

export const taskQueue = new TaskQueue()
