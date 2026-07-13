/**
 * MCP ACL 拦截器
 *
 * @description
 * 在 MCPClient.callTool / readResource / getPrompt 入口执行权限校验，
 * 拒绝未授权的调用并返回结构化错误。
 *
 * 与 `src/core/acl.ts` 的 AclEngine 设计对齐：
 *   - AclEngine.check() 校验数据层权限（module → store → operation）
 *   - McpAclInterceptor.check() 校验工具层权限（caller → server → tool）
 *
 * 权限校验流程：
 *   1. 从 MCP_ACL_MATRIX 获取调用方角色的权限规则
 *   2. 检查 serverName 是否在 allowedServers 中（支持 `'*'` 通配）
 *   3. 检查 resourceName 是否匹配 allowedTools 模式（支持 `'*'`、`'prefix_*'` 通配）
 *   4. 全部通过则放行，否则返回 AclDeniedResult
 *
 * @module mcp/core/mcpAclInterceptor
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

import { getLogger } from '@/lib/logger'
import {
  MCP_ACL_MATRIX,
  DEFAULT_MCP_CALLER,
  type McpPermissionRule,
} from '@/config/mcpAclMatrix'
import type { McpCallerRole } from '@/types/modules/mcp.types'

const logger = getLogger()

/** 权限校验输入 */
export interface McpAclCheckInput {
  /** 调用方角色 */
  readonly caller: McpCallerRole
  /** 目标 Server 名称 */
  readonly serverName: string
  /** 目标 Tool/Resource/Prompt 名称 */
  readonly resourceName: string
}

/** 权限校验结果 */
export interface McpAclCheckResult {
  readonly allowed: boolean
  readonly reason: string
  readonly caller: McpCallerRole
  readonly serverName: string
  readonly resourceName: string
}

/**
 * 通配符匹配 —— 支持两种模式：
 *   - `'*'`：匹配任意字符串
 *   - `'prefix_*'`：匹配以 `prefix_` 开头的字符串（保留末尾下划线）
 *
 * @param pattern - 权限规则中的模式（如 `'*'`、`'list_*'`、`'health_check'`）
 * @param value - 待匹配的实际值（如 `'list_pool_items'`）
 * @returns 是否匹配
 */
function matchPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith('_*')) {
    const prefix = pattern.slice(0, -1) // 保留末尾下划线
    return value.startsWith(prefix)
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return value.startsWith(prefix)
  }
  return pattern === value
}

/**
 * MCP ACL 拦截器 —— 工具层权限校验
 *
 * 使用方式：
 *   - `check(input)`：非抛出，返回 `{ allowed, reason }`
 *   - `assert(input)`：失败时抛出 `McpAclError`
 */
export class McpAclInterceptor {
  /**
   * 校验调用方是否有权访问指定 Server 的指定资源
   *
   * @returns `allowed=true` 放行；`allowed=false` 拒绝（含拒绝原因）
   */
  check({ caller, serverName, resourceName }: McpAclCheckInput): McpAclCheckResult {
    const rule: McpPermissionRule | undefined = MCP_ACL_MATRIX[caller]

    // 1. 角色不存在
    if (!rule) {
      logger.warn(`[MCP:ACL] caller role not found: ${caller}`)
      return {
        allowed: false,
        reason: `Caller role "${caller}" is not registered in MCP_ACL_MATRIX`,
        caller,
        serverName,
        resourceName,
      }
    }

    // 2. Server 级别校验
    const serverAllowed =
      rule.allowedServers.includes('*') || rule.allowedServers.includes(serverName)
    if (!serverAllowed) {
      logger.warn(
        `[MCP:ACL] server denied: caller="${caller}", server="${serverName}"`,
      )
      return {
        allowed: false,
        reason: `Caller "${caller}" is not allowed to access server "${serverName}"`,
        caller,
        serverName,
        resourceName,
      }
    }

    // 3. Tool/Resource 级别校验（通配符匹配）
    const toolAllowed = rule.allowedTools.some((pattern) =>
      matchPattern(pattern, resourceName),
    )
    if (!toolAllowed) {
      logger.warn(
        `[MCP:ACL] tool denied: caller="${caller}", server="${serverName}", tool="${resourceName}"`,
      )
      return {
        allowed: false,
        reason: `Caller "${caller}" is not allowed to call tool "${resourceName}" on server "${serverName}"`,
        caller,
        serverName,
        resourceName,
      }
    }

    logger.info(
      `[MCP:ACL] granted: caller="${caller}", server="${serverName}", tool="${resourceName}"`,
    )
    return {
      allowed: true,
      reason: 'Permission granted',
      caller,
      serverName,
      resourceName,
    }
  }

  /**
   * 断言权限（失败时抛出 McpAclError）
   *
   * @throws {McpAclError} 当权限校验失败
   */
  assert(input: McpAclCheckInput): void {
    const result = this.check(input)
    if (!result.allowed) {
      throw new McpAclError(result.reason, result)
    }
  }
}

/** MCP ACL 拒绝错误 —— 权限校验失败时抛出 */
export class McpAclError extends Error {
  constructor(
    message: string,
    public readonly detail: McpAclCheckResult,
  ) {
    super(message)
    this.name = 'McpAclError'
  }
}

/** 全局拦截器单例 */
export const mcpAclInterceptor = new McpAclInterceptor()

/**
 * 解析调用方角色（向后兼容：未传入 caller 时使用默认值）
 *
 * @param caller - 调用方角色（可选）
 * @returns 解析后的调用方角色（默认 `'agent'`）
 */
export function resolveCaller(caller?: McpCallerRole): McpCallerRole {
  return caller ?? DEFAULT_MCP_CALLER
}
