/**
 * @module AgentHealthMonitor
 * @lifecycle @Global
 * @description Agent 健康监控模块，实时检测 Agent 存活状态、失败率与性能指标
  * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-QA-077]
*/

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { AgentTask } from './agentRuntime'

const logger = getLogger()

/** 默认健康检查间隔（毫秒） */
const DEFAULT_CHECK_INTERVAL_MS = 30_000

/** 健康检查间隔环境变量名（Vite 注入，跨并行开发环境可配置） */
const ENV_HEALTH_CHECK_INTERVAL = 'VITE_AGENT_HEALTH_CHECK_INTERVAL_MS'

/** 健康检查间隔硬上限（毫秒），防止误配导致高频检查拖垮主线程 */
const MAX_CHECK_INTERVAL_MS = 300_000

/** 警告阈值比例（相对于最大失败率） */
const WARNING_THRESHOLD_RATIO = 0.5

/**
 * 从环境变量解析健康检测间隔（毫秒）——「环境配置可转换」逻辑。
 * 转换规则：环境变量为字符串需转为数字；非法/缺失/非正回退默认；
 * 超出上限则钳制，保证跨多套并行开发环境（COZE）可移植且安全。
 */
export function resolveHealthCheckIntervalMs(fallback: number = DEFAULT_CHECK_INTERVAL_MS): number {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  // 环境配置可转换：优先 Vite 注入的 import.meta.env，回退 Node/测试/SSR 的 process.env，
  // 保证跨多套并行开发环境（COZE 含 Node 宿主）均可读取同一配置键。
  const raw =
    env?.[ENV_HEALTH_CHECK_INTERVAL] ??
    (typeof process !== 'undefined' ? process.env[ENV_HEALTH_CHECK_INTERVAL] : undefined)
  const parsed = raw != null ? Number(raw) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, MAX_CHECK_INTERVAL_MS)
}

export interface HealthThresholds {
  maxFailureRate: number // 0.0 ~ 1.0
  maxAvgExecutionTime: number // ms
  minHeartbeatInterval: number // ms
}

export interface AgentHealthReport {
  agentId: string
  status: 'healthy' | 'warning' | 'critical'
  failureRate: number
  avgExecutionTime: number
  lastHeartbeat: number
  totalTasks: number
  consecutiveFailures: number
}

export class AgentHealthMonitor {
  private tasks = new Map<string, AgentTask[]>()
  private heartbeats = new Map<string, number>()
  private thresholds: HealthThresholds
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(thresholds: Partial<HealthThresholds> = {}) {
    this.thresholds = {
      maxFailureRate: 0.3,
      maxAvgExecutionTime: 10000,
      minHeartbeatInterval: 60000,
      ...thresholds,
    }
    logger.info('[AgentHealthMonitor] Initialized', { thresholds: this.thresholds })
  }

  start(checkInterval = resolveHealthCheckIntervalMs()): void {
    if (this.running) {
      logger.warn('[AgentHealthMonitor] Already running')
      return
    }

    this.running = true
    this.checkTimer = setInterval(() => {
      this._checkAll()
    }, checkInterval)

    logger.info(`[AgentHealthMonitor] Started (interval=${checkInterval}ms)`)
  }

  stop(): void {
    if (!this.running) return

    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    this.running = false
    logger.info('[AgentHealthMonitor] Stopped')
  }

  recordTask(task: AgentTask): void {
    const list = this.tasks.get(task.agentId) ?? []
    list.push(task)
    // 保留最近 100 条记录
    if (list.length > 100) {
      list.shift()
    }
    this.tasks.set(task.agentId, list)
    logger.debug(`[AgentHealthMonitor] Recorded task "${task.id}" for agent "${task.agentId}"`)
  }

  recordHeartbeat(agentId: string): void {
    this.heartbeats.set(agentId, Date.now())
    logger.debug(`[AgentHealthMonitor] Heartbeat from agent "${agentId}"`)
  }

  getHealthReport(agentId: string): AgentHealthReport | null {
    const taskList = this.tasks.get(agentId) ?? []
    if (taskList.length === 0) return null

    const total = taskList.length
    const failures = taskList.filter((t) => t.status === 'failed' || t.status === 'timeout').length
    const failureRate = total > 0 ? failures / total : 0

    const completedTasks = taskList.filter((t) => t.status === 'completed' && t.completedAt != null && t.startedAt != null)
    const avgExecutionTime =
      completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + (t.completedAt! - t.startedAt!), 0) / completedTasks.length
        : 0

    const lastHeartbeat = this.heartbeats.get(agentId) ?? 0
    const consecutiveFailures = this._countConsecutiveFailures(taskList)

    let status: AgentHealthReport['status'] = 'healthy'
    if (failureRate > this.thresholds.maxFailureRate || consecutiveFailures >= 5) {
      status = 'critical'
    } else if (failureRate > this.thresholds.maxFailureRate * WARNING_THRESHOLD_RATIO || avgExecutionTime > this.thresholds.maxAvgExecutionTime) {
      status = 'warning'
    }

    return {
      agentId,
      status,
      failureRate,
      avgExecutionTime,
      lastHeartbeat,
      totalTasks: total,
      consecutiveFailures,
    }
  }

  getAllReports(): AgentHealthReport[] {
    const reports: AgentHealthReport[] = []
    for (const agentId of this.tasks.keys()) {
      const report = this.getHealthReport(agentId)
      if (report) reports.push(report)
    }
    return reports
  }

  private _checkAll(): void {
    logger.debug('[AgentHealthMonitor] Running health check cycle')
    const reports = this.getAllReports()

    for (const report of reports) {
      if (report.status === 'critical') {
        logger.error(
          `[AgentHealthMonitor] CRITICAL: Agent "${report.agentId}" failureRate=${(report.failureRate * 100).toFixed(1)}%, consecutiveFailures=${report.consecutiveFailures}`
        )
        eventBus.emit('AGENT_HEALTH_CRITICAL', { agentId: report.agentId, report })
      } else if (report.status === 'warning') {
        logger.warn(
          `[AgentHealthMonitor] WARNING: Agent "${report.agentId}" failureRate=${(report.failureRate * 100).toFixed(1)}%`
        )
        eventBus.emit('AGENT_HEALTH_WARNING', { agentId: report.agentId, report })
      }
    }
  }

  private _countConsecutiveFailures(tasks: AgentTask[]): number {
    let count = 0
    for (let i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i]!.status === 'failed' || tasks[i]!.status === 'timeout') {
        count++
      } else {
        break
      }
    }
    return count
  }
}

// Singleton
let monitorInstance: AgentHealthMonitor | null = null

export function createAgentHealthMonitor(thresholds?: Partial<HealthThresholds>): AgentHealthMonitor {
  if (monitorInstance) return monitorInstance
  monitorInstance = new AgentHealthMonitor(thresholds)
  return monitorInstance
}

export function getAgentHealthMonitor(): AgentHealthMonitor {
  monitorInstance ??= new AgentHealthMonitor()
  return monitorInstance
}

export function destroyAgentHealthMonitor(): void {
  if (monitorInstance) {
    monitorInstance.stop()
    monitorInstance = null
  }
  logger.info('[AgentHealthMonitor] Instance destroyed')
}
