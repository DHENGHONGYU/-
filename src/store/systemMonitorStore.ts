/**
 * @module systemMonitorStore
 * @lifecycle @Global
 * @description 系统监控统一状态 Store，整合 SystemMonitorService 快照与 EventBus 事件
 */

import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { getSystemMonitorService } from '@/services/system/systemMonitorService'
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
  /** 刷新快照 */
  refreshSnapshot: () => void
  /** 启动监控轮询 */
  startMonitoring: () => void
  /** 停止监控轮询 */
  stopMonitoring: () => void
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

export const useSystemMonitorStore = create<SystemMonitorState>((set, get) => ({
  snapshot: null,
  agentHealthSnapshots: [],
  agentMetrics: DEFAULT_AGENT_METRICS,
  recentTasks: [],
  isLoading: false,
  error: null,
  lastUpdated: 0,
  isMonitoring: false,

  refreshSnapshot: () => {
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
}))

// ============================================================
// EventBus 订阅：监听系统监控快照事件自动更新
// ============================================================
const monitorSubscriptions: Array<() => void> = []

export function initSystemMonitorSubscriptions(): () => void {
  monitorSubscriptions.forEach((unsubscribe) => unsubscribe())
  monitorSubscriptions.length = 0

  monitorSubscriptions.push(
    eventBus.on('SYSTEM_MONITOR_SNAPSHOT', () => {
      // 快照事件触发时，自动刷新 Store 数据
      void useSystemMonitorStore.getState().refreshSnapshot()
    }),
    eventBus.on('AGENT_HEALTH_CRITICAL', (payload) => {
      const { agentId } = payload as { agentId: string }
      logger.error(`[SystemMonitorStore] Agent health CRITICAL: ${agentId}`)
      // 立即刷新以获取最新健康状态
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
