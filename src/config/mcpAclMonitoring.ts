/**
 * MCP ACL 监控告警规则配置
 *
 * @description
 * 定义 MCP ACL 权限拦截的监控规则、告警阈值和日志关键字模式。
 * 与 src/services/system/monitorLogService.ts 的 MonitorLogLevel 对齐。
 *
 * **告警级别**（与 MonitorLogLevel 对齐）：
 *   - 'info'      → 权限通过的正常事件（仅记录，不告警）
 *   - 'warn'      → 权限拒绝高频告警（配置错误或异常调用）
 *   - 'error'     → 违规角色调用（UI 调交易、CI 调业务数据）
 *   - 'critical'  → 严重越权（未知角色、绕过 Client 的 Server 端拦截）
 *
 * **监控数据源**：
 *   1. mcpAclInterceptor.check() 返回的 McpAclCheckResult
 *   2. 日志输出中的 [MCP:ACL] 关键字（用于日志聚合系统匹配）
 *
 * @module config/mcpAclMonitoring
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

import type { McpCallerRole } from '@/types/modules/mcp.types'

// ============================================================
// 类型定义
// ============================================================

/** ACL 告警级别（与 MonitorLogLevel 对齐，新增 'critical' 用于严重越权） */
export type AclAlertLevel = 'info' | 'warn' | 'error' | 'critical'

/** ACL 事件类型（基于拦截器的拒绝原因分类） */
export type AclEventType =
  | 'granted'           // 权限通过
  | 'denied_role'       // 未知角色拒绝
  | 'denied_server'     // Server 级拒绝
  | 'denied_tool'       // Tool 级拒绝

/** 告警规则 —— 定义何时触发告警 */
export interface AclAlertRule {
  /** 规则 ID（格式：ACL-Rxxx） */
  readonly id: string
  /** 规则名称 */
  readonly name: string
  /** 匹配的事件类型 */
  readonly eventType: AclEventType
  /** 匹配的 caller 角色（`'*'` 表示任意角色） */
  readonly callerPattern: McpCallerRole | '*'
  /** 匹配的 Server 名称正则（`'*'` 表示任意 Server） */
  readonly serverPattern: string
  /** 告警级别 */
  readonly level: AclAlertLevel
  /** 触发阈值（在 windowMs 时间窗口内匹配次数 >= threshold 时触发） */
  readonly threshold: number
  /** 时间窗口（毫秒） */
  readonly windowMs: number
  /** 规则描述（用于告警通知文案） */
  readonly description: string
}

/** 告警事件 —— 规则触发时产生 */
export interface AclAlertEvent {
  /** 触发的规则 ID */
  readonly ruleId: string
  /** 规则名称 */
  readonly ruleName: string
  /** 告警级别 */
  readonly level: AclAlertLevel
  /** 触发时间戳（ms） */
  readonly timestamp: number
  /** 触发次数（窗口内匹配次数） */
  readonly matchCount: number
  /** 告警描述 */
  readonly description: string
  /** 最近一次匹配的 caller */
  readonly lastCaller: McpCallerRole
  /** 最近一次匹配的 Server */
  readonly lastServer: string
  /** 最近一次匹配的 Tool/Resource */
  readonly lastResource: string
}

// ============================================================
// 关键日志关键字（用于日志聚合系统匹配，如 ELK/Loki/Grafana）
// ============================================================

/**
 * MCP ACL 关键日志关键字速查表
 *
 * 这些关键字用于日志聚合系统的告警规则匹配。
 * 日志前缀格式遵循 AGENTS.md §三 日志规范：`[模块名] 操作名`
 */
export const MCP_ACL_LOG_KEYWORDS = {
  /** 权限拒绝 — 未知角色（最严重） */
  ROLE_NOT_FOUND: '[MCP:ACL] caller role not found',

  /** 权限拒绝 — Server 级（caller 无权访问该 Server） */
  SERVER_DENIED: '[MCP:ACL] server denied',

  /** 权限拒绝 — Tool 级（caller 无权调用该 Tool） */
  TOOL_DENIED: '[MCP:ACL] tool denied',

  /** 权限通过（正常事件，用于统计） */
  GRANTED: '[MCP:ACL] granted',

  /** ACL_PERMISSION_DENIED 错误标记（出现在 ToolResult.content.text 中） */
  PERMISSION_DENIED: 'ACL_PERMISSION_DENIED',

  /** Client 端拦截日志（MCPClientImpl） */
  CLIENT_DENIED: '[MCPClient] callTool() ACL denied',
  CLIENT_RESOURCE_DENIED: '[MCPClient] readResource() ACL denied',
  CLIENT_PROMPT_DENIED: '[MCPClient] getPrompt() ACL denied',

  /** Server 端拦截日志（MCPServerBase 深度防御） */
  SERVER_CALLTOOL_DENIED: 'callTool() ACL denied',
  SERVER_RESOURCE_DENIED: 'readResource() ACL denied',
  SERVER_PROMPT_DENIED: 'getPrompt() ACL denied',
} as const

// ============================================================
// 告警规则集
// ============================================================

/**
 * MCP ACL 告警规则集
 *
 * 规则优先级：critical > error > warn > info
 * 同一事件可能匹配多条规则，monitor 取最高级别告警。
 */
export const MCP_ACL_ALERT_RULES: readonly AclAlertRule[] = [
  // ── critical 级别（严重越权，需立即处理） ──

  {
    id: 'ACL-R001',
    name: '未知调用方角色',
    eventType: 'denied_role',
    callerPattern: '*',
    serverPattern: '*',
    level: 'critical',
    threshold: 1,
    windowMs: 60_000,
    description: '出现未注册的 caller 角色，可能存在越权调用或代码 bug',
  },
  {
    id: 'ACL-R002',
    name: '绕过 Client 的 Server 端拦截',
    eventType: 'denied_server',
    callerPattern: '*',
    serverPattern: '*',
    level: 'critical',
    threshold: 1,
    windowMs: 60_000,
    description: '检测到绕过 MCPClient 直接调用 Server 的行为，Server 端深度防御已拦截',
  },

  // ── error 级别（违规角色调用，需排查） ──

  {
    id: 'ACL-R003',
    name: 'UI 调用交易类 Server',
    eventType: 'denied_server',
    callerPattern: 'ui',
    serverPattern: '^(trading|execution|trade)$',
    level: 'error',
    threshold: 1,
    windowMs: 60_000,
    description: 'UI 层尝试调用交易类写操作 Server，违反最小权限原则',
  },
  {
    id: 'ACL-R004',
    name: 'CI 调用非 system Server',
    eventType: 'denied_server',
    callerPattern: 'ci',
    serverPattern: '^(?!system$).+',
    level: 'error',
    threshold: 1,
    windowMs: 60_000,
    description: 'CI 流水线尝试访问非 system Server，超出 CI 权限范围',
  },
  {
    id: 'ACL-R005',
    name: 'UI 调用 system Server',
    eventType: 'denied_server',
    callerPattern: 'ui',
    serverPattern: '^system$',
    level: 'error',
    threshold: 1,
    windowMs: 60_000,
    description: 'UI 层尝试调用 system Server，system Server 仅限 agent/ci/system 调用',
  },

  // ── warn 级别（高频拒绝，需关注） ──

  {
    id: 'ACL-R006',
    name: '权限拒绝高频告警（1分钟）',
    eventType: 'denied_tool',
    callerPattern: '*',
    serverPattern: '*',
    level: 'warn',
    threshold: 10,
    windowMs: 60_000,
    description: '1 分钟内 Tool 级权限拒绝 >= 10 次，可能存在权限配置错误或异常调用',
  },
  {
    id: 'ACL-R007',
    name: '权限拒绝持续告警（1小时）',
    eventType: 'denied_tool',
    callerPattern: '*',
    serverPattern: '*',
    level: 'warn',
    threshold: 50,
    windowMs: 3_600_000,
    description: '1 小时内 Tool 级权限拒绝 >= 50 次，需排查权限配置或调用方代码',
  },
  {
    id: 'ACL-R008',
    name: 'Server 级拒绝高频告警（1分钟）',
    eventType: 'denied_server',
    callerPattern: '*',
    serverPattern: '*',
    level: 'warn',
    threshold: 5,
    windowMs: 60_000,
    description: '1 分钟内 Server 级权限拒绝 >= 5 次，可能存在系统性权限配置问题',
  },
]

// ============================================================
// 监控阈值配置
// ============================================================

/**
 * MCP ACL 监控全局阈值
 *
 * 控制 monitor 的内存使用和告警去重行为。
 */
export const MCP_ACL_MONITORING_THRESHOLDS = {
  /** 统计窗口大小（毫秒）— 滑动窗口的最大跨度 */
  statsWindowMs: 3_600_000, // 1 小时

  /** 最大保留事件数（防止内存溢出，FIFO 淘汰） */
  maxEventsRetained: 10_000,

  /** 告警去重窗口（毫秒）— 同一规则在窗口内只触发一次告警 */
  alertDedupWindowMs: 5 * 60_000, // 5 分钟

  /** 统计快照广播间隔（毫秒）— 定期通过 eventBus 广播统计快照 */
  statsBroadcastIntervalMs: 60_000, // 1 分钟
} as const

// ============================================================
// EventBus 事件名称
// ============================================================

/** ACL 告警事件（规则触发时广播） */
export const MCP_ACL_ALERT_EVENT = 'MCP_ACL_ALERT'

/** ACL 统计快照事件（定期广播） */
export const MCP_ACL_STATS_EVENT = 'MCP_ACL_STATS'

// ============================================================
// 日志聚合系统告警规则（ELK/Loki/Grafana 配置参考）
// ============================================================

/**
 * 日志聚合系统的告警规则配置参考
 *
 * 可直接复制到 Grafana / Loki / ELK 的告警规则配置中。
 * 匹配字段：日志消息文本（message 字段）
 */
export const LOG_AGGREGATION_ALERT_RULES = [
  {
    ruleId: 'LOG-ACL-001',
    name: 'MCP ACL 未知角色告警',
    logQuery: MCP_ACL_LOG_KEYWORDS.ROLE_NOT_FOUND,
    severity: 'critical',
    threshold: 1,
    window: '1m',
    action: '立即通知安全团队 + 自动创建工单',
  },
  {
    ruleId: 'LOG-ACL-002',
    name: 'MCP ACL UI 调用交易 Server 告警',
    logQuery: `${MCP_ACL_LOG_KEYWORDS.SERVER_DENIED}.*caller="ui".*server="(trading|execution|trade)"`,
    severity: 'error',
    threshold: 1,
    window: '1m',
    action: '通知开发团队排查 UI 组件调用代码',
  },
  {
    ruleId: 'LOG-ACL-003',
    name: 'MCP ACL CI 调用非 system Server 告警',
    logQuery: `${MCP_ACL_LOG_KEYWORDS.SERVER_DENIED}.*caller="ci"`,
    severity: 'error',
    threshold: 1,
    window: '1m',
    action: '通知 DevOps 团队排查 CI 流水线配置',
  },
  {
    ruleId: 'LOG-ACL-004',
    name: 'MCP ACL 权限拒绝高频告警',
    logQuery: MCP_ACL_LOG_KEYWORDS.PERMISSION_DENIED,
    severity: 'warning',
    threshold: 10,
    window: '1m',
    action: '通知开发团队排查权限配置',
  },
  {
    ruleId: 'LOG-ACL-005',
    name: 'MCP ACL Server 端拦截告警（绕过 Client）',
    logQuery: `\\[MCPServer:.*\\] ${MCP_ACL_LOG_KEYWORDS.SERVER_CALLTOOL_DENIED}`,
    severity: 'critical',
    threshold: 1,
    window: '1m',
    action: '立即通知安全团队 — 检测到绕过 Client 的直接 Server 调用',
  },
  {
    ruleId: 'LOG-ACL-006',
    name: 'MCP ACL 权限拒绝持续告警（1小时）',
    logQuery: MCP_ACL_LOG_KEYWORDS.PERMISSION_DENIED,
    severity: 'warning',
    threshold: 50,
    window: '1h',
    action: '通知开发团队全面排查权限配置',
  },
] as const
