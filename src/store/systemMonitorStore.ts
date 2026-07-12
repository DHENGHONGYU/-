/**
 * @module systemMonitorStore
 * @lifecycle @Global
 * @description 系统监控统一状态 Store，整合 SystemMonitorService 快照与 EventBus 事件
 */

import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { getSystemMonitorService } from '@/services/system/systemMonitorService'
import {
  getMonitorLogService,
  type MonitorLogEntry,
  type MonitorLogFilter,
} from '@/services/system/monitorLogService'
import { MONITOR_INTERVALS } from '@/constants/health.constants'
import type {
  SystemMonitorSnapshot,
  AgentHealthSnapshot,
  AgentMetricsSummary,
  AgentTaskHistoryEntry,
} from '@/types/modules/agent.types'

const logger = getLogger()

interface SystemMonitorState {
  /** 系统监控快照 */
  snapshot: SystemMonitorSnapshot | null
  /** Agent 健康快照列表 */
  agentHealthSnapshots: AgentHealthSnapshot[]
  /** Agent 指标汇总 */
  agentMetrics: AgentMetricsSummary | null
  /** 最近任务历史 */
  recentTasks: AgentTaskHistoryEntry[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number
  /** 监控是否已启动 */
  isMonitoring: boolean
  /** 监控日志列表 */
  monitorLogs: MonitorLogEntry[]
  /** 刷新快照 */
  refreshSnapshot: () => void
  /** 启动监控轮询 */
  startMonitoring: () => void
  /** 停止监控轮询 */
  stopMonitoring: () => void
  /** 按过滤条件获取监控日志 */
  fetchMonitorLogs: (filter: MonitorLogFilter) => void
  /** 清空监控日志 */
  clearMonitorLogs: () => void
}

/** 默认 Agent 指标汇总 */
const DEFAULT_AGENT_METRICS: AgentMetricsSummary = {
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

let monitorTimer: ReturnType<typeof setInterval> | null = null
let isRefreshingSnapshot = false

/**
 * useSystemMonitorStore
 */
export const useSystemMonitorStore = create<SystemMonitorState>((set, get) => ({
  snapshot: null,
  agentHealthSnapshots: [],
  agentMetrics: DEFAULT_AGENT_METRICS,
  recentTasks: [],
  isLoading: false,
  error: null,
  lastUpdated: 0,
  isMonitoring: false,
  monitorLogs: [],

  refreshSnapshot: () => {
    // 重入防护：避免并发事件（如 AGENT_HEALTH_* 与 SYSTEM_MONITOR_SNAPSHOT 同时触发）
    // 导致 refreshSnapshot 递归调用形成 Maximum call stack size exceeded
    if (isRefreshingSnapshot) {
      logger.info('[SystemMonitorStore] refreshSnapshot() skipped — already in progress')
      return
    }
    isRefreshingSnapshot = true

    set({ isLoading: true, error: null })
    try {
      const service = getSystemMonitorService()
      const snapshot = service.getSystemSnapshot()
      const healthSnapshots = service.getAgentHealthSnapshots()
      const metrics = service.getAgentMetricsSummary()
      const recentTasks = service.getRecentTasks(20)

      set({
        snapshot,
        agentHealthSnapshots: healthSnapshots,
        agentMetrics: metrics,
        recentTasks,
        isLoading: false,
        lastUpdated: Date.now(),
      })

      logger.info('[SystemMonitorStore] Snapshot refreshed', {
        agentCount: healthSnapshots.length,
        taskCount: recentTasks.length,
        overallStatus: metrics.criticalCount > 0 ? 'critical' : metrics.warningCount > 0 ? 'warning' : 'healthy',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error('[SystemMonitorStore] Failed to refresh snapshot', { error: message })
      set({ isLoading: false, error: message })
    } finally {
      isRefreshingSnapshot = false
    }
  },

  startMonitoring: () => {
    if (get().isMonitoring) {
      logger.warn('[SystemMonitorStore] Monitoring already active')
      return
    }

    set({ isMonitoring: true })
    logger.info('[SystemMonitorStore] Monitoring started', {
      interval: MONITOR_INTERVALS.SYSTEM_SNAPSHOT,
    })

    // 立即刷新一次
    void get().refreshSnapshot()

    // 启动定时轮询
    monitorTimer = setInterval(() => {
      void get().refreshSnapshot()
    }, MONITOR_INTERVALS.SYSTEM_SNAPSHOT)
  },

  stopMonitoring: () => {
    if (monitorTimer) {
      clearInterval(monitorTimer)
      monitorTimer = null
    }
    set({ isMonitoring: false })
    logger.info('[SystemMonitorStore] Monitoring stopped')
  },

  fetchMonitorLogs: (filter: MonitorLogFilter) => {
    try {
      const service = getMonitorLogService()
      const logs = service.getLogs(filter)
      set({ monitorLogs: logs })
      logger.info('[SystemMonitorStore] fetchMonitorLogs() completed', {
        logCount: logs.length,
        filter,
      })
    } catch (err) {
      logger.error('[SystemMonitorStore] fetchMonitorLogs() failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      set({ monitorLogs: [] })
    }
  },

  clearMonitorLogs: () => {
    try {
      const service = getMonitorLogService()
      service.clearLogs()
      set({ monitorLogs: [] })
      logger.info('[SystemMonitorStore] clearMonitorLogs() completed')
    } catch (err) {
      logger.error('[SystemMonitorStore] clearMonitorLogs() failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },
}))

// ============================================================
// EventBus 订阅：监听系统监控快照事件自动更新
// ============================================================
const monitorSubscriptions: Array<() => void> = []

/**
 * initSystemMonitorSubscriptions
 */
export function initSystemMonitorSubscriptions(): () => void {
  monitorSubscriptions.forEach((unsubscribe) => unsubscribe())
  monitorSubscriptions.length = 0

  monitorSubscriptions.push(
    eventBus.on('SYSTEM_MONITOR_SNAPSHOT', (payload) => {
      // 直接使用事件 payload 更新 Store，避免调用 refreshSnapshot() 导致递归 emit
      const snapshot = payload as SystemMonitorSnapshot
      useSystemMonitorStore.setState({
        snapshot,
        agentHealthSnapshots: snapshot.agentHealthSnapshots,
        agentMetrics: snapshot.agentMetrics,
        recentTasks: snapshot.recentTasks,
        lastUpdated: Date.now(),
      })
      logger.info('[SystemMonitorStore] Snapshot updated from event payload', {
        agentCount: snapshot.agentHealthSnapshots.length,
        taskCount: snapshot.recentTasks.length,
      })
    }),
    eventBus.on('AGENT_HEALTH_CRITICAL', (payload) => {
      const { agentId } = payload as { agentId: string }
      logger.error(`[SystemMonitorStore] Agent health CRITICAL: ${agentId}`)
      // 健康事件触发全量刷新以获取最新状态。
      // 注意：refreshSnapshot() → getSystemSnapshot() → emit('SYSTEM_MONITOR_SNAPSHOT') 的链路
      // 已在 SYSTEM_MONITOR_SNAPSHOT listener 中通过 payload 直接 setState() 终止，不会形成递归。
      void useSystemMonitorStore.getState().refreshSnapshot()
    }),
    eventBus.on('AGENT_HEALTH_WARNING', (payload) => {
      const { agentId } = payload as { agentId: string }
      logger.warn(`[SystemMonitorStore] Agent health WARNING: ${agentId}`)
      void useSystemMonitorStore.getState().refreshSnapshot()
    }),
  )

  return () => {
    monitorSubscriptions.forEach((unsubscribe) => unsubscribe())
    monitorSubscriptions.length = 0
  }
}

// 自动初始化订阅
initSystemMonitorSubscriptions()
