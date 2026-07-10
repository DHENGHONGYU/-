/**
 * MCP ACL 监控器 —— 统计 + 告警触发
 *
 * @description
 * 拦截 mcpAclInterceptor 的权限决策，维护滚动窗口统计，
 * 评估告警规则并在阈值触发时通过 EventBus 广播告警事件。
 *
 * **设计模式**：装饰器/代理模式
 *   - 不修改原 mcpAclInterceptor 代码
 *   - 在初始化时包装 check() 方法，注入监控逻辑
 *   - 调用方无感知，原 check() 返回值不变
 *
 * **监控维度**：
 *   1. 事件类型（granted / denied_role / denied_server / denied_tool）
 *   2. caller 角色（agent / ui / ci / system / unknown）
 *   3. Server 名称
 *   4. 时间窗口（滑动窗口，默认 1 小时）
 *
 * **告警去重**：
 *   - 同一规则在 alertDedupWindowMs（默认 5 分钟）内只触发一次告警
 *   - 去重窗口过期后允许再次触发
 *
 * **事件广播**：
 *   - MCP_ACL_ALERT：告警触发时广播（UI 可订阅展示告警通知）
 *   - MCP_ACL_STATS：定期广播统计快照（UI 可订阅展示监控面板）
 *
 * @module mcp/core/mcpAclMonitor
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { mcpAclInterceptor } from './mcpAclInterceptor'
import type { McpAclCheckResult } from './mcpAclInterceptor'
import {
  MCP_ACL_ALERT_RULES,
  MCP_ACL_MONITORING_THRESHOLDS,
  MCP_ACL_ALERT_EVENT,
  MCP_ACL_STATS_EVENT,
  type AclAlertEvent,
  type AclEventType,
  type AclAlertLevel,
} from '@/config/mcpAclMonitoring'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** ACL 事件记录 —— 单次权限决策的记录 */
interface AclEventRecord {
  /** 事件类型 */
  readonly eventType: AclEventType
  /** 调用方角色（可能是未注册的字符串） */
  readonly caller: string
  /** Server 名称 */
  readonly serverName: string
  /** Tool/Resource/Prompt 名称 */
  readonly resourceName: string
  /** 时间戳（ms） */
  readonly timestamp: number
  /** 拒绝原因（权限通过时为空字符串） */
  readonly reason: string
}

/** ACL 统计快照 */
export interface AclStatsSnapshot {
  /** 快照时间戳 */
  readonly timestamp: number
  /** 统计窗口（ms） */
  readonly windowMs: number
  /** 总决策数 */
  readonly totalDecisions: number
  /** 权限通过数 */
  readonly grantedCount: number
  /** 权限拒绝数（按类型细分） */
  readonly deniedByRole: number
  readonly deniedByServer: number
  readonly deniedByTool: number
  /** 按 caller 角色统计拒绝数 */
  readonly deniedByCaller: Readonly<Record<string, number>>
  /** 按 Server 统计拒绝数（Top 5） */
  readonly topDeniedServers: ReadonlyArray<{ server: string; count: number }>
  /** 最近触发的告警（最近 10 条） */
  readonly recentAlerts: ReadonlyArray<AclAlertEvent>
}

// ============================================================
// MCP ACL 监控器
// ============================================================

/**
 * MCP ACL 监控器单例
 *
 * 使用方式：
 *   - 在应用初始化阶段调用 `mcpAclMonitor.start()` 启动监控
 *   - 在应用销毁阶段调用 `mcpAclMonitor.stop()` 停止监控
 *   - 通过 `eventBus.on(MCP_ACL_ALERT_EVENT, handler)` 订阅告警
 *   - 通过 `eventBus.on(MCP_ACL_STATS_EVENT, handler)` 订阅统计快照
 */
class McpAclMonitor {
  /** 事件记录缓冲区（FIFO） */
  private events: AclEventRecord[] = []

  /** 已触发的告警记录（用于去重） */
  private triggeredAlerts = new Map<string, { timestamp: number; event: AclAlertEvent }>()

  /** 原始 check 方法引用（用于 unwrap） */
  private originalCheck: typeof mcpAclInterceptor.check | null = null

  /** 统计快照广播定时器 */
  private statsTimer: ReturnType<typeof setInterval> | null = null

  /** 监控器是否已启动 */
  private started = false

  // ============================================================
  // 生命周期管理
  // ============================================================

  /**
   * 启动监控器 —— 包装 mcpAclInterceptor.check() 并启动统计广播
   */
  start(): void {
    if (this.started) {
      logger.warn('[MCP:AclMonitor] already started, skip')
      return
    }

    // 保存原始 check 方法并替换为带监控的版本
    this.originalCheck = mcpAclInterceptor.check.bind(mcpAclInterceptor)
    mcpAclInterceptor.check = (input: Parameters<typeof mcpAclInterceptor.check>[0]): McpAclCheckResult => {
      const result = this.originalCheck!(input)
      this.recordDecision(result)
      return result
    }

    // 启动统计快照广播定时器
    this.statsTimer = setInterval(
      () => this.broadcastStats(),
      MCP_ACL_MONITORING_THRESHOLDS.statsBroadcastIntervalMs,
    )

    this.started = true
    logger.info('[MCP:AclMonitor] started — ACL decision monitoring active')
  }

  /**
   * 停止监控器 —— 恢复原始 check 方法并清理定时器
   */
  stop(): void {
    if (!this.started) {
      return
    }

    // 恢复原始 check 方法
    if (this.originalCheck) {
      mcpAclInterceptor.check = this.originalCheck
      this.originalCheck = null
    }

    // 清理定时器
    if (this.statsTimer) {
      clearInterval(this.statsTimer)
      this.statsTimer = null
    }

    // 清理缓冲区
    this.events = []
    this.triggeredAlerts.clear()

    this.started = false
    logger.info('[MCP:AclMonitor] stopped — monitoring deactivated')
  }

  /** 监控器是否已启动 */
  isStarted(): boolean {
    return this.started
  }

  // ============================================================
  // 事件记录与规则评估
  // ============================================================

  /**
   * 记录一次 ACL 权限决策
   *
   * @param result - mcpAclInterceptor.check() 的返回值
   */
  private recordDecision(result: McpAclCheckResult): void {
    const eventType = this.resolveEventType(result)
    const record: AclEventRecord = {
      eventType,
      caller: result.caller,
      serverName: result.serverName,
      resourceName: result.resourceName,
      timestamp: Date.now(),
      reason: result.allowed ? '' : result.reason,
    }

    this.events.push(record)

    // FIFO 淘汰：超过最大保留数时移除最旧的事件
    if (this.events.length > MCP_ACL_MONITORING_THRESHOLDS.maxEventsRetained) {
      this.events.shift()
    }

    // 评估告警规则
    this.evaluateRules(record)
  }

  /**
   * 从 McpAclCheckResult 解析事件类型
   */
  private resolveEventType(result: McpAclCheckResult): AclEventType {
    if (result.allowed) {
      return 'granted'
    }
    if (result.reason.includes('not registered')) {
      return 'denied_role'
    }
    if (result.reason.includes('not allowed to access server')) {
      return 'denied_server'
    }
    return 'denied_tool'
  }

  /**
   * 评估告警规则 —— 检查所有规则是否触发
   */
  private evaluateRules(record: AclEventRecord): void {
    const now = Date.now()
    const windowStart = now - MCP_ACL_MONITORING_THRESHOLDS.statsWindowMs

    for (const rule of MCP_ACL_ALERT_RULES) {
      // 1. 事件类型不匹配 → 跳过
      if (rule.eventType !== record.eventType) continue

      // 2. caller 角色不匹配 → 跳过
      if (rule.callerPattern !== '*' && rule.callerPattern !== record.caller) continue

      // 3. Server 名称不匹配 → 跳过
      if (rule.serverPattern !== '*') {
        const serverRegex = new RegExp(rule.serverPattern)
        if (!serverRegex.test(record.serverName)) continue
      }

      // 4. 统计时间窗口内的匹配事件数
      const ruleWindowStart = now - rule.windowMs
      const matchCount = this.events.filter(
        (e) =>
          e.timestamp >= ruleWindowStart &&
          e.timestamp <= now &&
          e.eventType === rule.eventType &&
          (rule.callerPattern === '*' || rule.callerPattern === e.caller) &&
          (rule.serverPattern === '*' || new RegExp(rule.serverPattern).test(e.serverName)),
      ).length

      // 5. 未达阈值 → 跳过
      if (matchCount < rule.threshold) continue

      // 6. 告警去重检查 —— 同一规则在去重窗口内只触发一次
      const lastTriggered = this.triggeredAlerts.get(rule.id)
      if (lastTriggered) {
        const dedupWindow = MCP_ACL_MONITORING_THRESHOLDS.alertDedupWindowMs
        if (now - lastTriggered.timestamp < dedupWindow) {
          // 在去重窗口内，跳过
          continue
        }
      }

      // 7. 触发告警
      const alertEvent: AclAlertEvent = {
        ruleId: rule.id,
        ruleName: rule.name,
        level: rule.level,
        timestamp: now,
        matchCount,
        description: rule.description,
        lastCaller: record.caller,
        lastServer: record.serverName,
        lastResource: record.resourceName,
      }

      this.triggeredAlerts.set(rule.id, { timestamp: now, event: alertEvent })
      this.broadcastAlert(alertEvent)
    }

    // 清理过期的告警去重记录
    this.cleanupTriggeredAlerts(now, windowStart)
  }

  /**
   * 清理过期的告警去重记录
   */
  private cleanupTriggeredAlerts(now: number, _windowStart: number): void {
    const dedupWindow = MCP_ACL_MONITORING_THRESHOLDS.alertDedupWindowMs
    for (const [ruleId, record] of this.triggeredAlerts.entries()) {
      if (now - record.timestamp > dedupWindow * 2) {
        this.triggeredAlerts.delete(ruleId)
      }
    }
  }

  // ============================================================
  // 事件广播
  // ============================================================

  /**
   * 广播告警事件 —— 通过 EventBus 通知订阅者
   */
  private broadcastAlert(alert: AclAlertEvent): void {
    const levelLogFn: Record<AclAlertLevel, (msg: string, ctx?: Record<string, unknown>) => void> = {
      info: (msg, ctx) => logger.info(msg, ctx),
      warn: (msg, ctx) => logger.warn(msg, ctx),
      error: (msg, ctx) => logger.error(msg, ctx),
      critical: (msg, ctx) => logger.error(msg, ctx),
    }

    levelLogFn[alert.level](
      `[MCP:AclMonitor] ALERT triggered: rule="${alert.ruleName}", level=${alert.level}, count=${alert.matchCount}`,
      {
        ruleId: alert.ruleId,
        caller: alert.lastCaller,
        server: alert.lastServer,
        resource: alert.lastResource,
        description: alert.description,
      },
    )

    eventBus.emit(MCP_ACL_ALERT_EVENT, alert)
  }

  /**
   * 广播统计快照 —— 通过 EventBus 通知订阅者
   */
  private broadcastStats(): void {
    const snapshot = this.getStats()
    eventBus.emit(MCP_ACL_STATS_EVENT, snapshot)
    logger.info('[MCP:AclMonitor] stats broadcast', {
      total: snapshot.totalDecisions,
      granted: snapshot.grantedCount,
      denied: snapshot.deniedByRole + snapshot.deniedByServer + snapshot.deniedByTool,
    })
  }

  // ============================================================
  // 统计查询
  // ============================================================

  /**
   * 获取当前统计快照
   *
   * @param windowMs - 统计窗口（默认 1 小时）
   */
  getStats(windowMs: number = MCP_ACL_MONITORING_THRESHOLDS.statsWindowMs): AclStatsSnapshot {
    const now = Date.now()
    const windowStart = now - windowMs
    const windowedEvents = this.events.filter((e) => e.timestamp >= windowStart)

    // 按类型统计
    const grantedCount = windowedEvents.filter((e) => e.eventType === 'granted').length
    const deniedByRole = windowedEvents.filter((e) => e.eventType === 'denied_role').length
    const deniedByServer = windowedEvents.filter((e) => e.eventType === 'denied_server').length
    const deniedByTool = windowedEvents.filter((e) => e.eventType === 'denied_tool').length

    // 按 caller 统计拒绝数
    const deniedByCaller: Record<string, number> = {}
    for (const e of windowedEvents) {
      if (e.eventType !== 'granted') {
        deniedByCaller[e.caller] = (deniedByCaller[e.caller] ?? 0) + 1
      }
    }

    // 按 Server 统计拒绝数（Top 5）
    const serverDeniedCount: Record<string, number> = {}
    for (const e of windowedEvents) {
      if (e.eventType !== 'granted') {
        serverDeniedCount[e.serverName] = (serverDeniedCount[e.serverName] ?? 0) + 1
      }
    }
    const topDeniedServers = Object.entries(serverDeniedCount)
      .map(([server, count]) => ({ server, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 最近触发的告警（最近 10 条）
    const recentAlerts = Array.from(this.triggeredAlerts.values())
      .map((t) => t.event)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    return {
      timestamp: now,
      windowMs,
      totalDecisions: windowedEvents.length,
      grantedCount,
      deniedByRole,
      deniedByServer,
      deniedByTool,
      deniedByCaller,
      topDeniedServers,
      recentAlerts,
    }
  }

  /**
   * 获取原始事件记录（用于调试或导出）
   *
   * @param windowMs - 统计窗口（默认 1 小时）
   */
  getEvents(windowMs: number = MCP_ACL_MONITORING_THRESHOLDS.statsWindowMs): readonly AclEventRecord[] {
    const now = Date.now()
    const windowStart = now - windowMs
    return this.events.filter((e) => e.timestamp >= windowStart)
  }

  /**
   * 清空所有统计记录（用于测试或手动重置）
   */
  reset(): void {
    this.events = []
    this.triggeredAlerts.clear()
    logger.info('[MCP:AclMonitor] stats reset')
  }
}

// ============================================================
// 导出单例
// ============================================================

/** MCP ACL 监控器单例 */
export const mcpAclMonitor = new McpAclMonitor()

// ============================================================
// 类型重导出
// ============================================================

export type { AclAlertRule, AclAlertEvent, AclEventType, AclAlertLevel } from '@/config/mcpAclMonitoring'
