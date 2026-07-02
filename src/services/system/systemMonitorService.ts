/**
 * @module SystemMonitorService
 * @lifecycle @Global
 * @description 系统监控服务。将 Agent 运行时、健康监控、任务队列与 EventBus
 *   等后端基础设施的状态聚合为统一快照，并通过 EventBus 向监控频道广播。
 *
 * @remarks
 * - 服务层只读聚合，不直接写 IndexedDB；如需持久化快照须通过 DataBridge.forward()。
 * - 两个轮询定时器：Agent 状态（15s）+ 系统综合快照（30s），间隔由
 *   `MONITOR_INTERVALS` 常量注入，零硬编码。
 * - 所有公开方法均含 try-catch 与 logger.error 兜底，监控服务自身不得拖垮宿主应用。
 */

import { getAgentSystemStatus, DEFAULT_AGENTS, type AgentConfig } from '@/agents'
import { getAgentHealthMonitor, type AgentHealthReport } from '@/agents/agentHealthMonitor'
import { agentRuntime, type AgentTask } from '@/agents/agentRuntime'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { MONITOR_INTERVALS } from '@/constants/health.constants'
import type {
  SystemMonitorSnapshot,
  AgentHealthSnapshot,
  AgentMetricsSummary,
  AgentTaskHistoryEntry,
} from '@/types/modules/agent.types'

const logger = getLogger()

/** 系统监控快照事件名，每次快照构建后通过 eventBus 广播 */
export const SYSTEM_MONITOR_SNAPSHOT_EVENT = 'SYSTEM_MONITOR_SNAPSHOT' as const

/** getSystemSnapshot() 默认拉取的最近任务条数 */
const DEFAULT_RECENT_TASKS_LIMIT = 50

/** agentRuntime.getStats() 的返回类型别名，避免 ReturnType 散落各处 */
type RuntimeStats = ReturnType<typeof agentRuntime.getStats>

/** getAgentMetricsSummary() 失败时返回的零值汇总，确保监控面板始终可渲染 */
const ZERO_METRICS_SUMMARY: AgentMetricsSummary = {
  totalAgents: 0,
  healthyCount: 0,
  warningCount: 0,
  criticalCount: 0,
  totalTasks: 0,
  successTasks: 0,
  failedTasks: 0,
  runningTasks: 0,
  pendingTasks: 0,
  avgFailureRate: 0,
  avgExecutionTime: 0,
}

export class SystemMonitorService {
  /** Agent 状态轮询定时器（15s） */
  private agentStatusTimer: ReturnType<typeof setInterval> | null = null
  /** 系统综合快照轮询定时器（30s） */
  private snapshotTimer: ReturnType<typeof setInterval> | null = null
  /** 服务是否正在运行 */
  private running = false

  /** Agent 配置查找表：agentId → AgentConfig，用于补全 name/timeout/concurrent */
  private readonly agentConfigMap: ReadonlyMap<string, AgentConfig>

  constructor() {
    this.agentConfigMap = new Map(DEFAULT_AGENTS.map((config) => [config.id, config]))
    logger.info('[SystemMonitorService] Initialized', {
      registeredAgents: DEFAULT_AGENTS.length,
      agentStatusInterval: MONITOR_INTERVALS.AGENT_HEALTH,
      snapshotInterval: MONITOR_INTERVALS.SYSTEM_SNAPSHOT,
    })
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 启动监控轮询。
   * - Agent 状态轮询：每 {@link MONITOR_INTERVALS.AGENT_HEALTH} 毫秒（15s）
   * - 系统综合快照：每 {@link MONITOR_INTERVALS.SYSTEM_SNAPSHOT} 毫秒（30s）
   */
  start(): void {
    try {
      if (this.running) {
        logger.warn('[SystemMonitorService] Already running, skip start()')
        return
      }

      this.running = true

      this.agentStatusTimer = setInterval(() => {
        this.pollAgentStatus()
      }, MONITOR_INTERVALS.AGENT_HEALTH)

      this.snapshotTimer = setInterval(() => {
        this.pollSystemSnapshot()
      }, MONITOR_INTERVALS.SYSTEM_SNAPSHOT)

      logger.info('[SystemMonitorService] Started', {
        agentStatusInterval: MONITOR_INTERVALS.AGENT_HEALTH,
        snapshotInterval: MONITOR_INTERVALS.SYSTEM_SNAPSHOT,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] start() failed', { error: message })
    }
  }

  /**
   * 停止监控轮询，清理全部定时器。
   */
  stop(): void {
    try {
      if (!this.running) {
        logger.warn('[SystemMonitorService] Not running, skip stop()')
        return
      }

      if (this.agentStatusTimer) {
        clearInterval(this.agentStatusTimer)
        this.agentStatusTimer = null
      }
      if (this.snapshotTimer) {
        clearInterval(this.snapshotTimer)
        this.snapshotTimer = null
      }

      this.running = false
      logger.info('[SystemMonitorService] Stopped')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] stop() failed', { error: message })
    }
  }

  // ============================================================
  // 公开查询接口
  // ============================================================

  /**
   * 构建并返回当前系统监控统一快照。
   *
   * 数据来源：
   * - {@link getAgentSystemStatus}：initialized / runtimeStats / healthReports
   * - {@link agentRuntime.listTasks}（经 getRecentTasks 转换）：最近任务历史
   * - {@link eventBus.getStats}：事件总线统计
   *
   * 快照构建完成后通过 eventBus 广播 {@link SYSTEM_MONITOR_SNAPSHOT_EVENT}。
   */
  getSystemSnapshot(): SystemMonitorSnapshot {
    try {
      // getAgentSystemStatus() 内部已调用 agentRuntime.getStats()、
      // getAgentRegistry().getStats() 与 getAgentHealthMonitor().getAllReports()
      const status = getAgentSystemStatus()
      const runtimeStats: RuntimeStats = status.runtimeStats
      const healthReports: AgentHealthReport[] = status.healthReports
      const eventStats = eventBus.getStats()

      const agentHealthSnapshots = healthReports.map((report) => this.toHealthSnapshot(report))
      const agentMetrics = this.buildMetricsSummary(healthReports, runtimeStats)
      const recentTasks = this.getRecentTasks(DEFAULT_RECENT_TASKS_LIMIT)

      const snapshot: SystemMonitorSnapshot = {
        timestamp: Date.now(),
        agentSystemInitialized: status.initialized,
        agentMetrics,
        agentHealthSnapshots,
        recentTasks,
        eventBusStats: {
          totalEvents: eventStats.events,
          totalListeners: eventStats.totalListeners,
        },
      }

      logger.info('[SystemMonitorService] Snapshot built', {
        timestamp: snapshot.timestamp,
        agentSystemInitialized: snapshot.agentSystemInitialized,
        agentCount: agentHealthSnapshots.length,
        recentTaskCount: recentTasks.length,
        eventBusEvents: snapshot.eventBusStats.totalEvents,
      })

      eventBus.emit(SYSTEM_MONITOR_SNAPSHOT_EVENT, snapshot)

      return snapshot
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] getSystemSnapshot() failed', { error: message })
      throw err
    }
  }

  /**
   * 获取所有 Agent 的健康快照列表。
   *
   * 从 AgentHealthMonitor 拉取健康报告，并使用 {@link DEFAULT_AGENTS}
   * 补全 agentName / defaultTimeout / maxConcurrent。
   */
  getAgentHealthSnapshots(): AgentHealthSnapshot[] {
    try {
      const reports = getAgentHealthMonitor().getAllReports()
      return reports.map((report) => this.toHealthSnapshot(report))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] getAgentHealthSnapshots() failed', { error: message })
      return []
    }
  }

  /**
   * 聚合 Agent 健康报告与运行时统计，生成指标汇总。
   *
   * @returns 各维度计数与平均值；失败时返回零值汇总，保证监控面板可渲染。
   */
  getAgentMetricsSummary(): AgentMetricsSummary {
    try {
      const reports = getAgentHealthMonitor().getAllReports()
      const runtimeStats = agentRuntime.getStats()
      return this.buildMetricsSummary(reports, runtimeStats)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] getAgentMetricsSummary() failed', { error: message })
      return { ...ZERO_METRICS_SUMMARY }
    }
  }

  /**
   * 获取最近的 Agent 任务历史条目。
   *
   * @param limit 返回条数上限；<=0 时返回空数组。
   * @returns 按 createdAt 降序排列的任务历史，失败时返回空数组。
   */
  getRecentTasks(limit: number): AgentTaskHistoryEntry[] {
    try {
      const safeLimit = Math.max(0, limit)
      if (safeLimit === 0) {
        return []
      }

      const tasks: AgentTask[] = agentRuntime.listTasks()
      const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)
      const limited = sorted.slice(0, safeLimit)

      return limited.map((task) => this.toTaskHistoryEntry(task))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] getRecentTasks() failed', { error: message })
      return []
    }
  }

  // ============================================================
  // 私有映射 / 聚合工具
  // ============================================================

  /**
   * 将 AgentHealthReport 映射为 AgentHealthSnapshot。
   * 使用 agentConfigMap 补全 name / defaultTimeout / maxConcurrent；
   * 未在 DEFAULT_AGENTS 中注册的 Agent 回退为 agentId 作为名称、0 作为阈值。
   */
  private toHealthSnapshot(report: AgentHealthReport): AgentHealthSnapshot {
    const config = this.agentConfigMap.get(report.agentId)
    return {
      agentId: report.agentId,
      agentName: config?.name ?? report.agentId,
      status: report.status,
      failureRate: report.failureRate,
      avgExecutionTime: report.avgExecutionTime,
      lastHeartbeat: report.lastHeartbeat,
      totalTasks: report.totalTasks,
      consecutiveFailures: report.consecutiveFailures,
      maxConcurrent: config?.maxConcurrent ?? 0,
      defaultTimeout: config?.defaultTimeout ?? 0,
    }
  }

  /**
   * 将 AgentTask 映射为 AgentTaskHistoryEntry，并计算执行耗时。
   */
  private toTaskHistoryEntry(task: AgentTask): AgentTaskHistoryEntry {
    let durationMs: number | undefined
    if (task.startedAt !== undefined && task.completedAt !== undefined) {
      durationMs = task.completedAt - task.startedAt
    }

    return {
      taskId: task.id,
      agentId: task.agentId,
      type: task.type,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      durationMs,
      error: task.error,
    }
  }

  /**
   * 基于预取的健康报告与运行时统计构建指标汇总。
   * 抽象为私有方法，供 getSystemSnapshot() 与 getAgentMetricsSummary() 复用，
   * 避免在单次快照构建中重复调用 getAllReports() / getStats()。
   */
  private buildMetricsSummary(
    reports: AgentHealthReport[],
    runtimeStats: RuntimeStats,
  ): AgentMetricsSummary {
    const reportCount = reports.length
    const healthyCount = reports.filter((r) => r.status === 'healthy').length
    const warningCount = reports.filter((r) => r.status === 'warning').length
    const criticalCount = reports.filter((r) => r.status === 'critical').length

    const totalTasks = reports.reduce((sum, r) => sum + r.totalTasks, 0)
    const avgFailureRate =
      reportCount > 0 ? reports.reduce((sum, r) => sum + r.failureRate, 0) / reportCount : 0
    const avgExecutionTime =
      reportCount > 0
        ? reports.reduce((sum, r) => sum + r.avgExecutionTime, 0) / reportCount
        : 0

    return {
      totalAgents: runtimeStats.totalAgents,
      healthyCount,
      warningCount,
      criticalCount,
      totalTasks,
      successTasks: runtimeStats.completedTasks,
      failedTasks: runtimeStats.failedTasks,
      runningTasks: runtimeStats.runningTasks,
      pendingTasks: runtimeStats.pendingTasks,
      avgFailureRate,
      avgExecutionTime,
    }
  }

  // ============================================================
  // 轮询回调
  // ============================================================

  /** Agent 状态轮询回调（15s） */
  private pollAgentStatus(): void {
    try {
      const snapshots = this.getAgentHealthSnapshots()
      const critical = snapshots.filter((s) => s.status === 'critical').length
      const warning = snapshots.filter((s) => s.status === 'warning').length
      logger.info('[SystemMonitorService] Agent status polled', {
        agentCount: snapshots.length,
        criticalCount: critical,
        warningCount: warning,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] pollAgentStatus() failed', { error: message })
    }
  }

  /** 系统综合快照轮询回调（30s） */
  private pollSystemSnapshot(): void {
    try {
      this.getSystemSnapshot()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SystemMonitorService] pollSystemSnapshot() failed', { error: message })
    }
  }
}

// ============================================================
// 单例管理
// ============================================================

let instance: SystemMonitorService | null = null

/**
 * 获取 SystemMonitorService 单例。
 * 首次调用时惰性创建；重复调用返回同一实例。
 */
export function getSystemMonitorService(): SystemMonitorService {
  instance ??= new SystemMonitorService()
  return instance
}

/**
 * 销毁 SystemMonitorService 单例。
 * 停止全部轮询定时器并释放引用，供应用卸载 / 测试重置时调用。
 */
export function destroySystemMonitorService(): void {
  if (instance) {
    instance.stop()
    instance = null
    logger.info('[SystemMonitorService] Instance destroyed')
  }
}
