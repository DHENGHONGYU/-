/**
 * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-QA-077]
 */
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { taskQueue } from './taskQueue'
import { getAgentHealthMonitor } from './agentHealthMonitor'

const logger = getLogger()

export interface AgentConfig {
  id: string
  name: string
  description: string
  defaultTimeout: number
  maxConcurrent: number
  mcpServerName?: string
  defaultToolName?: string
}

export interface AgentTask {
  id: string
  agentId: string
  type: string
  payload: unknown
  timeout: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
  result?: unknown
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export class AgentRuntime {
  private agents = new Map<string, AgentConfig>()
  private tasks = new Map<string, AgentTask>()
  private runningTasks = new Map<string, { controller: AbortController; timeout: ReturnType<typeof setTimeout> }>()

  constructor() {
    logger.info('[AgentRuntime] Initializing...')
  }

  register(config: AgentConfig): void {
    logger.debug(`[AgentRuntime] register() called for agent "${config.id}"`)

    if (this.agents.has(config.id)) {
      logger.warn(`[AgentRuntime] Agent "${config.id}" already registered, overwriting`)
    }

    this.agents.set(config.id, config)
    eventBus.emit('AGENT_REGISTERED', { agentId: config.id })
    logger.info(`[AgentRuntime] Agent "${config.id}" registered (timeout=${config.defaultTimeout}ms, maxConcurrent=${config.maxConcurrent})`)
  }

  async execute(agentId: string, type: string, payload: unknown, timeout?: number): Promise<AgentTask> {
    logger.debug(`[AgentRuntime] execute() called: agentId="${agentId}", type="${type}"`)

    const agent = this.agents.get(agentId)
    if (!agent) {
      logger.error(`[AgentRuntime] Execute failed: Agent not found "${agentId}"`)
      throw new Error(`Agent not found: ${agentId}`)
    }

    const taskId = `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const effectiveTimeout = timeout ?? agent.defaultTimeout
    const task: AgentTask = {
      id: taskId,
      agentId,
      type,
      payload,
      timeout: effectiveTimeout,
      status: 'pending',
      createdAt: Date.now(),
    }
    this.tasks.set(taskId, task)

    // 并发控制在 TaskQueue 侧执行：按 agent 维度限制同时运行任务数（maxConcurrent）。
    // 达到上限的任务进入队列等待，空出槽位后再由 drain 出队进入 running。
    taskQueue.setMaxConcurrent(agentId, agent.maxConcurrent)

    logger.info(`[AgentRuntime] Task created: taskId="${taskId}", agentId="${agentId}", type="${type}", timeout=${effectiveTimeout}ms, maxConcurrent=${agent.maxConcurrent}`)

    return new Promise((resolve) => {
      const controller = new AbortController()
      let started = false
      let subscribed = true
      let settled = false

      const timeoutId = setTimeout(() => {
        settled = true
        taskQueue.cancel(taskId)
        task.status = 'timeout'
        task.error = `Task timeout after ${task.timeout}ms`
        task.completedAt = Date.now()
        this.runningTasks.delete(taskId)
        controller.abort()
        logger.warn(`[AgentRuntime] Task timeout: taskId="${taskId}", agentId="${agentId}", elapsed=${task.timeout}ms`)
        eventBus.emit('AGENT_TASK_TIMEOUT', { taskId, agentId, type })
        this.recordHealth(task)
        resolve(task)
      }, effectiveTimeout)

      const unsubscribe = taskQueue.subscribe((qt) => {
        if (qt.id !== taskId) return

        if (qt.status === 'running' && !started) {
          started = true
          task.status = 'running'
          task.startedAt = Date.now()
          this.runningTasks.set(taskId, { controller, timeout: timeoutId })
          eventBus.emit('AGENT_TASK_STARTED', { taskId, agentId, type })
          logger.debug(`[AgentRuntime] Task dequeued & started: taskId="${taskId}", timeout=${effectiveTimeout}ms`)

          this.runAgent(agentId, task, controller.signal)
            .then((result) => {
              if (settled) return
              settled = true
              task.status = 'completed'
              task.result = result
              task.completedAt = Date.now()
              taskQueue.markCompleted(taskId, result)
              const duration = task.completedAt - (task.startedAt ?? task.createdAt)
              logger.info(`[AgentRuntime] Task completed: taskId="${taskId}", duration=${duration}ms`)
              eventBus.emit('AGENT_TASK_COMPLETED', { taskId, agentId, type, result })
              this.recordHealth(task)
            })
            .catch((error) => {
              if (settled) return
              settled = true
              task.status = 'failed'
              task.error = error instanceof Error ? error.message : String(error)
              task.completedAt = Date.now()
              taskQueue.markFailed(taskId, task.error)
              const duration = task.completedAt - (task.startedAt ?? task.createdAt)
              logger.error(`[AgentRuntime] Task failed: taskId="${taskId}", duration=${duration}ms, error="${task.error}"`)
              eventBus.emit('AGENT_TASK_FAILED', { taskId, agentId, type, error: task.error })
              this.recordHealth(task)
            })
            .finally(() => {
              clearTimeout(timeoutId)
              this.runningTasks.delete(taskId)
              if (subscribed) { subscribed = false; unsubscribe() }
              logger.debug(`[AgentRuntime] Task cleanup: taskId="${taskId}", runningTasks=${this.runningTasks.size}`)
              resolve(task)
            })
          return
        }

        // 队列侧终态（被取消/超时触发）：清理订阅（正常路径已在 finally 中处理）
        if (subscribed && (qt.status === 'completed' || qt.status === 'failed' || qt.status === 'timeout' || qt.status === 'cancelled')) {
          subscribed = false
          unsubscribe()
        }
      })

      taskQueue.enqueue({ id: taskId, agentId, type, payload, timeout: effectiveTimeout, priority: 'normal' })
    })
  }

  private async runAgent(agentId: string, task: AgentTask, signal: AbortSignal): Promise<unknown> {
    logger.info(`[AgentRuntime] runAgent() executing via MCP: agentId="${agentId}", taskId="${task.id}"`)

    const agent = this.agents.get(agentId)
    if (!agent) throw new Error(`Agent not found: ${agentId}`)

    const { mcpBridge } = await import('@/mcp/bridge')
    const serverName = agent.mcpServerName ?? agentId
    const toolName = agent.defaultToolName ?? task.type
    const result = await mcpBridge.callTool(serverName, toolName, task.payload as Record<string, unknown>)

    if (signal.aborted) {
      logger.debug(`[AgentRuntime] runAgent() aborted: taskId="${task.id}"`)
      throw new Error('Task aborted')
    }

    if (result.isError) {
      const errorText = result.content[0]?.text ?? 'Unknown MCP error'
      logger.error('[AgentRuntime] MCP call failed', { serverName, toolName, error: errorText })
      throw new Error(`MCP call failed: ${errorText}`)
    }

    logger.info(`[AgentRuntime] MCP call completed: ${serverName}.${toolName}`)
    return { success: true, serverName, toolName, result }
  }

  /**
   * 将终态任务上报至健康监控（P0-1 修复：此前 recordTask 从未被调用，
   * 导致 getAllReports() 恒为空、系统级 Agent 健康维度清零）。
   * 异常兜底，避免监控故障影响任务主流程。
   */
  private recordHealth(task: AgentTask): void {
    try {
      getAgentHealthMonitor().recordTask(task)
    } catch (err) {
      logger.warn(`[AgentRuntime] recordHealth skipped: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async executeParallel(tasks: Array<{ agentId: string; type: string; payload: unknown; timeout?: number }>): Promise<AgentTask[]> {
    logger.info(`[AgentRuntime] executeParallel() called: ${tasks.length} tasks`)

    const promises = tasks.map((t, index) => {
      logger.debug(`[AgentRuntime] Parallel task #${index}: agentId="${t.agentId}", type="${t.type}"`)
      return this.execute(t.agentId, t.type, t.payload, t.timeout)
    })

    const results = await Promise.all(promises)
    const successCount = results.filter((r) => r.status === 'completed').length
    logger.info(`[AgentRuntime] executeParallel() completed: ${successCount}/${tasks.length} succeeded`)

    return results
  }

  getTask(id: string): AgentTask | undefined {
    const task = this.tasks.get(id)
    if (!task) {
      logger.debug(`[AgentRuntime] getTask() not found: id="${id}"`)
    } else {
      logger.debug(`[AgentRuntime] getTask() found: id="${id}", status="${task.status}"`)
    }
    return task
  }

  listTasks(status: AgentTask['status'] | 'all' = 'all'): AgentTask[] {
    const allTasks = Array.from(this.tasks.values())
    const filtered = status !== 'all' ? allTasks.filter((t) => t.status === status) : allTasks
    logger.debug(`[AgentRuntime] listTasks(): status="${status}", count=${filtered.length}`)
    return filtered
  }

  cancelTask(id: string): boolean {
    logger.debug(`[AgentRuntime] cancelTask() called: id="${id}"`)

    // 同步从 TaskQueue 中移除（pending 任务直接取消，running 任务标记 cancelled）
    taskQueue.cancel(id)

    const running = this.runningTasks.get(id)
    if (running) {
      logger.debug(`[AgentRuntime] Cancelling running task: id="${id}"`)
      running.controller.abort()
      clearTimeout(running.timeout)
      this.runningTasks.delete(id)
    }

    const task = this.tasks.get(id)
    if (task) {
      task.status = 'failed'
      task.error = 'Task cancelled'
      task.completedAt = Date.now()

      logger.info(`[AgentRuntime] Task cancelled: id="${id}"`)
      eventBus.emit('AGENT_TASK_CANCELLED', { taskId: id })
      this.recordHealth(task)
      return true
    }

    logger.warn(`[AgentRuntime] cancelTask() failed: task not found "${id}"`)
    return false
  }

  getStats() {
    const stats = {
      totalAgents: this.agents.size,
      pendingTasks: this.listTasks('pending').length,
      runningTasks: this.listTasks('running').length,
      completedTasks: this.listTasks('completed').length,
      failedTasks: this.listTasks('failed').length + this.listTasks('timeout').length,
    }
    logger.debug(`[AgentRuntime] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }
}

export const agentRuntime = new AgentRuntime()