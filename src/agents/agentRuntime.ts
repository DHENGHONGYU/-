/**
 * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-QA-077]
 */
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { taskQueue, type TaskPriority } from './taskQueue'
import { getAgentHealthMonitor } from './agentHealthMonitor'

const logger = getLogger()

/** 任务 ID 随机后缀长度（用于降低同毫秒并发冲突概率） */
const TASK_ID_SUFFIX_LENGTH = 7

/** 重试退避基准延迟（ms）——环境配置可转换逻辑：VITE_AGENT_TASK_RETRY_BASE_DELAY_MS 可覆盖 */
const DEFAULT_RETRY_BASE_DELAY_MS = 500
/** 单次重试延迟上限（ms），防止指数退避无限增长 */
const RETRY_MAX_DELAY_MS = 30000

/**
 * 读取环境数值配置，兼容 import.meta.env（Vite 构建内联）与 process.env（运行时/测试/Electron）。
 * vi.stubEnv 仅写入 process.env，故以 import.meta.env 优先、process.env 兜底（环境配置可转换逻辑）。
 */
function resolveEnvNumber(name: string, fallback: number): number {
  const metaVal = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.[name]) as string | undefined
  const procVal = (typeof process !== 'undefined' ? process.env?.[name] : undefined) as string | undefined
  const raw = metaVal ?? procVal
  if (raw == null) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** 任务失败最大重试次数（默认 0 = 不重试，维持历史失败语义；显式配置后启用有限重试） */
function resolveAgentTaskMaxRetries(): number {
  const v = resolveEnvNumber('VITE_AGENT_TASK_MAX_RETRIES', 0)
  return v >= 0 ? Math.floor(v) : 0
}

/** 重试退避基准延迟（ms） */
function resolveAgentTaskRetryBaseDelayMs(): number {
  return resolveEnvNumber('VITE_AGENT_TASK_RETRY_BASE_DELAY_MS', DEFAULT_RETRY_BASE_DELAY_MS)
}

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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  result?: unknown
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export class AgentRuntime {
  private agents = new Map<string, AgentConfig>()
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

  /**
   * 执行一个 Agent 任务。
   * @param priority 队列调度优先级（high|normal|low），默认 'normal'。
   *   启用说明：TaskQueue 已支持优先级调度，此处透传即可按需提升/降低排队权重；
   *   不传时维持历史默认 'normal'，保证向后兼容。
   * @param retries 瞬时失败重试：默认 0（不重试，维持历史失败语义）；
   *   可通过环境变量 VITE_AGENT_TASK_MAX_RETRIES 全局开启有限重试（仅对瞬时/网络类错误，指数退避）。
   */
  async execute(agentId: string, type: string, payload: unknown, timeout?: number, priority?: TaskPriority): Promise<AgentTask> {
    logger.debug(`[AgentRuntime] execute() called: agentId="${agentId}", type="${type}"`)

    const agent = this.agents.get(agentId)
    if (!agent) {
      logger.error(`[AgentRuntime] Execute failed: Agent not found "${agentId}"`)
      throw new Error(`Agent not found: ${agentId}`)
    }

    const taskId = `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, TASK_ID_SUFFIX_LENGTH)}`
    const effectiveTimeout = timeout ?? agent.defaultTimeout

    // 并发控制在 TaskQueue 侧执行：按 agent 维度限制同时运行任务数（maxConcurrent）。
    taskQueue.setMaxConcurrent(agentId, agent.maxConcurrent)

    logger.info(`[AgentRuntime] Task created: taskId="${taskId}", agentId="${agentId}", type="${type}", timeout=${effectiveTimeout}ms, maxConcurrent=${agent.maxConcurrent}`)

    return new Promise((resolve) => {
      const controller = new AbortController()
      let started = false
      let subscribed = true
      let settled = false

      // 单对象真相源：enqueue 返回的对象即 TaskQueue 内部持有的同一引用，
      // 后续 started/completed/failed/timeout/cancelled 均作用在同一对象上，
      // 彻底消除 agentRuntime.tasks 与 taskQueue 双拷贝分歧（诊断 #5 根因）。
      const task = taskQueue.enqueue({ id: taskId, agentId, type, payload, timeout: effectiveTimeout, priority: priority ?? 'normal' })

      const timeoutId = setTimeout(() => {
        settled = true
        // 统一超时终态：pending（并发满未出队）与 running 均处理，置 'timeout' 并移入 completed。
        taskQueue.timeout(taskId)
        this.runningTasks.delete(taskId)
        controller.abort()
        logger.warn(`[AgentRuntime] Task timeout: taskId="${taskId}", agentId="${agentId}", elapsed=${effectiveTimeout}ms`)
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
          runWithRetry(1)
          return
        }

        // 队列侧终态（被取消/超时触发）：清理订阅（正常路径已在 runWithRetry 终态中处理）
        if (subscribed && (qt.status === 'completed' || qt.status === 'failed' || qt.status === 'timeout' || qt.status === 'cancelled')) {
          subscribed = false
          unsubscribe()
        }
      })

      // 有限重试执行器：默认 maxRetries=0 即不重试（维持历史失败语义）；
      // 配置 VITE_AGENT_TASK_MAX_RETRIES>0 后启用指数退避重试，仅对瞬时/网络类错误重试。
      const runWithRetry = (attemptNumber: number): void => {
        const maxRetries = resolveAgentTaskMaxRetries()
        this.runAgent(agentId, task, controller.signal)
          .then((result) => {
            if (settled || task.status === 'cancelled') return
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
            if (task.status === 'cancelled') {
              settled = true
              logger.info(`[AgentRuntime] Task cancelled (late MCP return guarded): taskId="${taskId}"`)
              return
            }
            const willRetry = attemptNumber <= maxRetries && this.isRetryableError(error)
            if (willRetry) {
              const base = resolveAgentTaskRetryBaseDelayMs()
              const delay = Math.min(base * 2 ** (attemptNumber - 1), RETRY_MAX_DELAY_MS)
              logger.warn(`[AgentRuntime] Task retry scheduled: taskId="${taskId}", attempt=${attemptNumber}/${maxRetries}, delay=${delay}ms`)
              setTimeout(() => runWithRetry(attemptNumber + 1), delay)
              return
            }
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
            if (!settled) return
            clearTimeout(timeoutId)
            this.runningTasks.delete(taskId)
            if (subscribed) { subscribed = false; unsubscribe() }
            logger.debug(`[AgentRuntime] Task cleanup: taskId="${taskId}", runningTasks=${this.runningTasks.size}`)
            resolve(task)
          })
      }
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

  /**
   * 判断错误是否可重试。
   * - 不可重试：取消/中止（Task aborted）、Agent 未注册（Agent not found）、显式校验错误。
   * - 可重试：MCP 调用失败、网络/连接瞬时错误（ECONNRESET/ENOTFOUND/ECONNREFUSED/ETIMEDOUT/
   *   fetch failed/network/timeout/socket/EAI_AGAIN）。
   * 任务整体截止由 execute 外层 effectiveTimeout 兜底，重试不二次延展总超时。
   */
  private isRetryableError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : '')
    if (!msg) return false
    if (msg.includes('Task aborted')) return false
    if (msg.includes('Agent not found')) return false
    const retryable = [
      'MCP call failed',
      'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT',
      'fetch failed', 'network', 'timeout', 'socket', 'EAI_AGAIN',
    ]
    return retryable.some((p) => msg.includes(p))
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
    const task = taskQueue.get(id) as AgentTask | undefined
    if (!task) {
      logger.debug(`[AgentRuntime] getTask() not found: id="${id}"`)
    } else {
      logger.debug(`[AgentRuntime] getTask() found: id="${id}", status="${task.status}"`)
    }
    return task
  }

  listTasks(status: AgentTask['status'] | 'all' = 'all'): AgentTask[] {
    const allTasks = taskQueue.list(status !== 'all' ? status : undefined) as AgentTask[]
    logger.debug(`[AgentRuntime] listTasks(): status="${status}", count=${allTasks.length}`)
    return allTasks
  }

  cancelTask(id: string): boolean {
    logger.debug(`[AgentRuntime] cancelTask() called: id="${id}"`)

    // 同步从 TaskQueue 中移除（pending 任务直接取消，running 任务标记 cancelled）。
    // taskQueue.cancel 已在共享对象上置 'cancelled' 并移入 completed（单对象真相源）。
    taskQueue.cancel(id)

    const running = this.runningTasks.get(id)
    if (running) {
      logger.debug(`[AgentRuntime] Cancelling running task: id="${id}"`)
      running.controller.abort()
      clearTimeout(running.timeout)
      this.runningTasks.delete(id)
    }

    const task = taskQueue.get(id)
    if (task) {
      logger.info(`[AgentRuntime] Task cancelled: id="${id}"`)
      eventBus.emit('AGENT_TASK_CANCELLED', { taskId: id })
      this.recordHealth(task)
      return true
    }

    logger.warn(`[AgentRuntime] cancelTask() failed: task not found "${id}"`)
    return false
  }

  getStats() {
    const all = taskQueue.list()
    const stats = {
      totalAgents: this.agents.size,
      pendingTasks: all.filter((t) => t.status === 'pending').length,
      runningTasks: all.filter((t) => t.status === 'running').length,
      completedTasks: all.filter((t) => t.status === 'completed').length,
      failedTasks: all.filter((t) => t.status === 'failed' || t.status === 'timeout').length,
      cancelledTasks: all.filter((t) => t.status === 'cancelled').length,
    }
    logger.debug(`[AgentRuntime] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }
}

export const agentRuntime = new AgentRuntime()