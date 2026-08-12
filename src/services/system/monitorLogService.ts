/**
 * @module monitorLogService
 * @description 结构化监控日志服务：为新增的监控 UI 特性提供统一的日志生成与订阅能力。
 *
 * 职责：
 *   - log(level, source, message, context): 写入一条结构化监控日志
 *   - getLogs(filter): 按级别/来源过滤查询日志
 *   - clearLogs(): 清空全部日志
 *   - subscribe(callback): 订阅日志变更
 *   - logEngineSnapshot(snapshot): 记录引擎状态快照并广播事件
 *   - logAgentHealth(snapshots): 记录 Agent 健康状态，critical 时告警
 *   - logSystemSnapshot(snapshot): 记录系统汇总快照并广播事件
 *
 * 遵循 AGENTS.md 契约：
 *   - 服务层仅依赖 lib/（logger/eventBus）与 types/，不直接调用 dataLayer 或 db
 *   - 核心分支含 logger.info 与 try-catch
 *   - 禁止使用 any
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { EngineMonitorSnapshot } from '@/types/modules/engine.types'
import type { SystemMonitorSnapshot, AgentHealthSnapshot } from '@/types/modules/agent.types'

const logger = getLogger()

// ============================================================
// 公共类型定义
// ============================================================

/** 监控日志级别 */
export type MonitorLogLevel = 'info' | 'warn' | 'error' | 'critical'

/** 监控日志来源 */
export type MonitorLogSource = 'engine' | 'agent' | 'system' | 'dataflow'

/** 监控日志条目 */
export interface MonitorLogEntry {
  id: string
  timestamp: number
  level: MonitorLogLevel
  source: MonitorLogSource
  message: string
  context: Record<string, unknown>
}

/** 监控日志过滤条件 */
export interface MonitorLogFilter {
  level?: MonitorLogLevel
  source?: MonitorLogSource
  limit?: number
}

// ============================================================
// 内部常量
// ============================================================

/** 最大日志条数（FIFO 淘汰） */
const MAX_LOGS = 500

/** ID 随机串基数（toString(36)） */
const ID_RADIX = 36
/** ID 随机串起始偏移（slice(2, ...)） */
const ID_SLICE_START = 2
/** ID 随机串长度（5 位） */
const ID_SLICE_END = 7

/** EventBus 事件名称 */
const MONITOR_LOG_ENGINE_EVENT = 'MONITOR_LOG_ENGINE'
const MONITOR_LOG_AGENT_EVENT = 'MONITOR_LOG_AGENT'
const MONITOR_LOG_SYSTEM_EVENT = 'MONITOR_LOG_SYSTEM'

/** 日志变更监听回调类型 */
type MonitorLogListener = (logs: MonitorLogEntry[]) => void

/**
 * 监控日志服务。
 *
 * 维护一个最大 500 条的 FIFO 日志缓冲区，支持级别/来源过滤、订阅变更、
 * 以及引擎/Agent/系统三类快照的结构化记录与 EventBus 广播。
 */
export class MonitorLogService {
  private logs: MonitorLogEntry[] = []
  private listeners = new Set<MonitorLogListener>()

  /**
   * 生成唯一日志 ID。
   * 格式：`<时间戳>-<5位随机串>`
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(ID_RADIX).slice(ID_SLICE_START, ID_SLICE_END)}`
  }

  /**
   * 通知所有订阅者日志已变更。
   * 单个回调异常不影响其他订阅者。
   */
  private notifyListeners(): void {
    const snapshot = [...this.logs]
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot)
      } catch (err) {
        logger.error('[MonitorLogService] listener callback error', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  }

  /**
   * 写入一条监控日志。
   *
   * 创建条目后追加到缓冲区；若超过 MAX_LOGS 则按 FIFO 裁剪；
   * 通知所有订阅者，并同步调用底层 logger 输出（critical 映射为 error）。
   *
   * @param level 日志级别
   * @param source 日志来源
   * @param message 日志消息
   * @param context 附加上下文（可选）
   */
  log(
    level: MonitorLogLevel,
    source: MonitorLogSource,
    message: string,
    context: Record<string, unknown> = {},
  ): void {
    try {
      const entry: MonitorLogEntry = {
        id: this.generateId(),
        timestamp: Date.now(),
        level,
        source,
        message,
        context,
      }

      this.logs.push(entry)

      // FIFO 裁剪：超出上限时从头部移除
      if (this.logs.length > MAX_LOGS) {
        const overflow = this.logs.length - MAX_LOGS
        this.logs.splice(0, overflow)
      }

      // 同步输出到底层 logger，统一加 [MonitorLog] 前缀
      // critical 级别映射为 logger.error（logger 无 critical 级别）
      const prefixedMessage = `[MonitorLog] ${message}`
      switch (level) {
        case 'info':
          logger.info(prefixedMessage, context)
          break
        case 'warn':
          logger.warn(prefixedMessage, context)
          break
        case 'error':
        case 'critical':
          logger.error(prefixedMessage, context)
          break
      }

      this.notifyListeners()
    } catch (err) {
      logger.error('[MonitorLogService] log() error', {
        error: err instanceof Error ? err.message : String(err),
        level,
        source,
        message,
      })
    }
  }

  /**
   * 按过滤条件查询日志。
   *
   * 返回新数组（浅拷贝），避免外部修改内部状态。
   * 当指定 limit 时返回最近的 N 条（按时间正序保留尾部）。
   *
   * @param filter 过滤条件（可选）
   * @returns 过滤后的日志数组
   */
  getLogs(filter?: MonitorLogFilter): MonitorLogEntry[] {
    try {
      let result = this.logs

      if (filter?.level) {
        result = result.filter((l) => l.level === filter.level)
      }
      if (filter?.source) {
        result = result.filter((l) => l.source === filter.source)
      }

      const limited =
        filter?.limit !== undefined && filter.limit > 0
          ? result.slice(-filter.limit)
          : result
      return [...limited]
    } catch (err) {
      logger.error('[MonitorLogService] getLogs() error', {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }

  /**
   * 清空全部日志并通知订阅者。
   */
  clearLogs(): void {
    try {
      const prevCount = this.logs.length
      this.logs = []
      logger.info('[MonitorLogService] clearLogs() completed', { prevCount })
      this.notifyListeners()
    } catch (err) {
      logger.error('[MonitorLogService] clearLogs() error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * 订阅日志变更。
   *
   * 每当日志被新增、清空时，订阅者会收到当前日志缓冲区的浅拷贝。
   *
   * @param callback 日志变更回调
   * @returns 取消订阅函数
   */
  subscribe(callback: MonitorLogListener): () => void {
    try {
      this.listeners.add(callback)
      logger.info('[MonitorLogService] subscribe() added', {
        listenerCount: this.listeners.size,
      })
      return () => {
        this.listeners.delete(callback)
        logger.info('[MonitorLogService] unsubscribe() completed', {
          listenerCount: this.listeners.size,
        })
      }
    } catch (err) {
      logger.error('[MonitorLogService] subscribe() error', {
        error: err instanceof Error ? err.message : String(err),
      })
      return () => {}
    }
  }

  /**
   * 记录引擎监控快照。
   *
   * 根据引擎综合健康状态（overallStatus）决定日志级别：
   *   - healthy → info
   *   - warning → warn
   *   - critical → critical
   *   - unknown → warn
   *
   * 写入日志后通过 EventBus 广播 'MONITOR_LOG_ENGINE' 事件，携带完整快照。
   *
   * @param snapshot 引擎监控快照
   */
  logEngineSnapshot(snapshot: EngineMonitorSnapshot): void {
    try {
      const overallStatus = snapshot.health.overallStatus
      let level: MonitorLogLevel
      switch (overallStatus) {
        case 'healthy':
          level = 'info'
          break
        case 'warning':
          level = 'warn'
          break
        case 'critical':
          level = 'critical'
          break
        case 'unknown':
        default:
          level = 'warn'
          break
      }

      const message = `Engine snapshot: status=${overallStatus}, uptime=${snapshot.health.uptimeSeconds}s, channels=${snapshot.health.activeChannels}`
      this.log(level, 'engine', message, {
        timestamp: snapshot.timestamp,
        overallStatus,
        uptimeSeconds: snapshot.health.uptimeSeconds,
        dataflowConnected: snapshot.health.dataflowConnected,
        activeChannels: snapshot.health.activeChannels,
        layerCount: snapshot.health.layerStatuses.length,
      })

      eventBus.emit(MONITOR_LOG_ENGINE_EVENT, snapshot)
      logger.info('[MonitorLogService] logEngineSnapshot() emitted', {
        overallStatus,
        event: MONITOR_LOG_ENGINE_EVENT,
      })
    } catch (err) {
      logger.error('[MonitorLogService] logEngineSnapshot() error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * 记录 Agent 健康状态。
   *
   * 汇总各 Agent 健康状态并按以下规则决定日志级别：
   *   - 存在 critical Agent → critical
   *   - 存在 warning Agent → warn
   *   - 否则 → info
   *
   * 对每个 critical Agent 单独输出告警日志，便于快速定位异常 Agent。
   * 写入日志后通过 EventBus 广播 'MONITOR_LOG_AGENT' 事件，携带快照列表。
   *
   * @param snapshots Agent 健康快照列表
   */
  logAgentHealth(snapshots: AgentHealthSnapshot[]): void {
    try {
      const total = snapshots.length
      const critical = snapshots.filter((s) => s.status === 'critical')
      const warning = snapshots.filter((s) => s.status === 'warning')

      const level: MonitorLogLevel =
        critical.length > 0 ? 'critical' : warning.length > 0 ? 'warn' : 'info'
      const message = `Agent health: total=${total}, critical=${critical.length}, warning=${warning.length}`

      this.log(level, 'agent', message, {
        total,
        criticalCount: critical.length,
        warningCount: warning.length,
        criticalAgents: critical.map((s) => s.agentId),
      })

      // 对 critical Agent 单独告警
      critical.forEach((s) => {
        logger.warn('[MonitorLogService] critical agent detected', {
          agentId: s.agentId,
          agentName: s.agentName,
          status: s.status,
          failureRate: s.failureRate,
          consecutiveFailures: s.consecutiveFailures,
        })
      })

      eventBus.emit(MONITOR_LOG_AGENT_EVENT, snapshots)
      logger.info('[MonitorLogService] logAgentHealth() emitted', {
        total,
        criticalCount: critical.length,
        event: MONITOR_LOG_AGENT_EVENT,
      })
    } catch (err) {
      logger.error('[MonitorLogService] logAgentHealth() error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * 记录系统监控汇总快照。
   *
   * 根据 Agent 指标汇总中的异常数量决定日志级别：
   *   - criticalCount > 0 → critical
   *   - warningCount > 0 → warn
   *   - 否则 → info
   *
   * 写入日志后通过 EventBus 广播 'MONITOR_LOG_SYSTEM' 事件，携带完整快照。
   *
   * @param snapshot 系统监控快照
   */
  logSystemSnapshot(snapshot: SystemMonitorSnapshot): void {
    try {
      const agentMetrics = snapshot.agentMetrics
      const level: MonitorLogLevel =
        agentMetrics.criticalCount > 0
          ? 'critical'
          : agentMetrics.warningCount > 0
            ? 'warn'
            : 'info'

      const message = `System snapshot: agents=${agentMetrics.totalAgents}, tasks=${agentMetrics.totalTasks}, initialized=${snapshot.agentSystemInitialized}`

      this.log(level, 'system', message, {
        timestamp: snapshot.timestamp,
        agentSystemInitialized: snapshot.agentSystemInitialized,
        totalAgents: agentMetrics.totalAgents,
        healthyCount: agentMetrics.healthyCount,
        warningCount: agentMetrics.warningCount,
        criticalCount: agentMetrics.criticalCount,
        totalTasks: agentMetrics.totalTasks,
        successTasks: agentMetrics.successTasks,
        failedTasks: agentMetrics.failedTasks,
        eventBusTotalEvents: snapshot.eventBusStats.totalEvents,
        eventBusTotalListeners: snapshot.eventBusStats.totalListeners,
      })

      eventBus.emit(MONITOR_LOG_SYSTEM_EVENT, snapshot)
      logger.info('[MonitorLogService] logSystemSnapshot() emitted', {
        totalAgents: agentMetrics.totalAgents,
        criticalCount: agentMetrics.criticalCount,
        event: MONITOR_LOG_SYSTEM_EVENT,
      })
    } catch (err) {
      logger.error('[MonitorLogService] logSystemSnapshot() error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

// ============================================================
// 单例管理
// ============================================================

let _instance: MonitorLogService | null = null

/**
 * 获取 MonitorLogService 单例。
 *
 * 首次调用时创建实例，后续调用返回同一实例。
 * 供监控 UI（engineStore / agentStore / systemMonitor）统一调用。
 *
 * @returns MonitorLogService 单例
 */
export function getMonitorLogService(): MonitorLogService {
  try {
    if (!_instance) {
      _instance = new MonitorLogService()
      logger.info('[MonitorLogService] singleton created')
    }
    return _instance
  } catch (err) {
    logger.error('[MonitorLogService] getMonitorLogService() error', {
      error: err instanceof Error ? err.message : String(err),
    })
    // 兜底：返回临时新实例，避免调用方崩溃
    return new MonitorLogService()
  }
}

/**
 * 销毁 MonitorLogService 单例。
 *
 * 清空日志与监听器，释放引用。便于测试重置或应用卸载时调用。
 */
export function destroyMonitorLogService(): void {
  try {
    if (_instance) {
      _instance.clearLogs()
      _instance = null
      logger.info('[MonitorLogService] singleton destroyed')
    }
  } catch (err) {
    logger.error('[MonitorLogService] destroyMonitorLogService() error', {
      error: err instanceof Error ? err.message : String(err),
    })
    _instance = null
  }
}
