/**
 * 安全策略统一配置总线
 *
 * 作为所有安全模块（MCP 门禁、安装审计、CI/CD）的唯一配置源，
 * 消除跨文件硬编码，确保授权规则、日志路径、白名单的一致性。
 *
 * 数据来源：.trae/mcp-whitelist-policy.json
 * 消费者：mcp-confirmation-demo.ts / audit-installations.ps1 / CI policy-verify
 *
 * 遵循 AGENTS.md 第三节"零硬编码"约束：所有阈值、规则从 config 层注入
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/

import * as fs from 'fs'
import * as path from 'path'

// ============================================================
// 类型定义（与 .trae/mcp-whitelist-policy.json schema 对齐）
// ============================================================

export type AuthorizationLevel = 'autoApprove' | 'requireConfirmation' | 'requireAdminApproval'

export interface TrustedMcpServer {
  source: string
  package: string
  trustedReason: string
  allowedTools: string[]
  restrictedTools: string[]
  restrictedReason: string
  networkOrigins: string[]
}

export interface BlockedMcpServer {
  blockedReason: string
}

export interface ObservedMcpServer {
  source: string
  package: string
  observedReason: string
  allowedTools: string[]
  restrictedTools: string[]
  restrictedReason: string
  networkOrigins: string[]
}

export interface AuditConfig {
  logEnabled: boolean
  logPath: string
  logFields: string[]
  retentionDays: number
  alertOnFailure: boolean
}

export interface SecurityPolicy {
  policyVersion: string
  policyName: string
  lastUpdated: string
  strategy: string
  scope: string
  trustedMcpServers: Record<string, TrustedMcpServer>
  blockedMcpServers: Record<string, BlockedMcpServer>
  observedMcpServers?: Record<string, ObservedMcpServer>
  authorizationRules: Record<AuthorizationLevel, string[]>
  audit: AuditConfig
}

// ============================================================
// 工具链安全配置（与 .npmrc / pip.conf / setup-install-policy.ps1 对齐）
// ============================================================

export const TOOLCHAIN_CONFIG = {
  npm: {
    registry: 'https://registry.npmmirror.com',
    ignoreScripts: true,
    auditLevel: 'high' as const,
    saveExact: true,
    maxSockets: 5,
  },
  pip: {
    indexUrl: 'https://pypi.tuna.tsinghua.edu.cn/simple',
    trustedHosts: ['pypi.tuna.tsinghua.edu.cn', 'pypi.org', 'files.pythonhosted.org'],
    timeout: 60,
    retries: 3,
  },
  playwright: {
    downloadHost: 'https://npmmirror.com/mirrors/playwright',
    mcpPackage: '@playwright/mcp@latest',
    mcpTimeout: 60000,
  },
} as const

// ============================================================
// 统一日志格式（JSONL，所有模块共享）
// ============================================================

export type AuditLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'

export interface AuditLogEntry {
  timestamp: string
  level: AuditLogLevel
  module: string
  action: string
  detail: string
  toolName?: string
  authorized?: boolean
  auditLevel?: AuthorizationLevel
  durationMs?: number
}

/**
 * 写入 JSONL 格式审计日志（所有模块统一格式）
 * 路径由 policy.audit.logPath 决定，消除双轨制
 */
export function writeAuditLog(
  policy: SecurityPolicy,
  entry: Omit<AuditLogEntry, 'timestamp'>,
): void {
  if (!policy.audit.logEnabled) return

  const logPath = path.resolve(process.cwd(), policy.audit.logPath)
  const logDir = path.dirname(logPath)

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const fullEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  }

  fs.appendFileSync(logPath, JSON.stringify(fullEntry) + '\n', 'utf-8')
}

// ============================================================
// 策略加载器（单一数据源）
// ============================================================

let cachedPolicy: SecurityPolicy | null = null

/**
 * 从 .trae/mcp-whitelist-policy.json 加载安全策略
 * 所有模块必须通过此函数获取策略，禁止硬编码
 */
export function loadSecurityPolicy(): SecurityPolicy {
  if (cachedPolicy) return cachedPolicy

  const policyPath = path.resolve(process.cwd(), '.trae', 'mcp-whitelist-policy.json')

  if (!fs.existsSync(policyPath)) {
    throw new Error(`[SecurityPolicy] 策略文件不存在: ${policyPath}`)
  }

  const raw = fs.readFileSync(policyPath, 'utf-8')
  const policy = JSON.parse(raw) as SecurityPolicy

  // 基础校验
  const requiredFields: (keyof SecurityPolicy)[] = [
    'policyVersion', 'authorizationRules', 'audit', 'trustedMcpServers',
  ]
  for (const field of requiredFields) {
    if (!policy[field]) {
      throw new Error(`[SecurityPolicy] 策略文件缺少必需字段: ${field}`)
    }
  }

  cachedPolicy = policy
  return policy
}

// ============================================================
// 授权检查器（统一门禁逻辑）
// ============================================================

export interface AuthorizationResult {
  authorized: boolean
  level: AuthorizationLevel | 'denied'
  reason: string
}

/**
 * 检查工具调用是否被授权
 * 所有模块必须通过此函数判断授权级别，禁止各自硬编码
 */
export function checkAuthorization(
  policy: SecurityPolicy,
  toolName: string,
): AuthorizationResult {
  const rules = policy.authorizationRules

  // 阶段 1：自动批准（只读操作）
  if (rules.autoApprove.includes(toolName)) {
    return {
      authorized: true,
      level: 'autoApprove',
      reason: '只读操作，无副作用',
    }
  }

  // 阶段 2：需要管理员审批（高危操作）
  if (rules.requireAdminApproval.includes(toolName)) {
    return {
      authorized: false,
      level: 'requireAdminApproval',
      reason: '高危操作，需要管理员审批',
    }
  }

  // 阶段 3：需要用户确认（写操作）
  if (rules.requireConfirmation.includes(toolName)) {
    return {
      authorized: false,
      level: 'requireConfirmation',
      reason: '写操作，有副作用，需要用户确认',
    }
  }

  // 阶段 4：未定义 → 默认拒绝（安全优先）
  return {
    authorized: false,
    level: 'denied',
    reason: `工具 ${toolName} 未在策略中定义授权级别，默认拒绝`,
  }
}

/**
 * 检查 MCP Server 是否在信任列表中
 */
export function isTrustedMcpServer(
  policy: SecurityPolicy,
  serverName: string,
): boolean {
  return serverName in policy.trustedMcpServers
}

/**
 * 检查 MCP Server 是否被显式阻止
 */
export function isBlockedMcpServer(
  policy: SecurityPolicy,
  serverName: string,
): boolean {
  return serverName in policy.blockedMcpServers
}

/**
 * 检查 URL 是否在允许的网络源中
 */
export function isAllowedNetworkOrigin(
  policy: SecurityPolicy,
  serverName: string,
  url: string,
): boolean {
  const server = policy.trustedMcpServers[serverName]
  if (!server) return false

  return server.networkOrigins.some((origin) => url.startsWith(origin))
}
