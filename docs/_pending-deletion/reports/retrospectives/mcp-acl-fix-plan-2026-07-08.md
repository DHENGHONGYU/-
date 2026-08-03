---
title: MCP 层权限控制修复方案
type: reports
domain: ai
phase: planning
tier: T2
status: active
maintainer: V9 Architecture Team
summary: "问题级别: P0 高风险 对应审查项: MCP Tool/Resource 调用无任何权限校验 方案日期: 2026-07-08"
tags: [ai, mcp, fix]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
doc_id: V9-DOC-AUTO-DCDDB9
---

# MCP 层权限控制修复方案

> **问题级别**: P0 高风险
> **对应审查项**: MCP Tool/Resource 调用无任何权限校验
> **方案日期**: 2026-07-08

---

## 一、问题分析

### 当前调用链路（无权限校验）

```
调用方 → MCPBridge.callTool(serverName, toolName, args)
           → MCPClientImpl.callTool(serverName, toolName, args)
              → registry.getServer(serverName)
              → server.callTool(toolName, args)  ← 直接执行，无拦截
```

### 目标调用链路（含权限拦截）

```
调用方 → MCPBridge.callTool(serverName, toolName, args, callerContext)
           → MCPClientImpl.callTool(serverName, toolName, args, callerContext)
              → mcpAclInterceptor.check(caller, serverName, toolName)  ← 新增拦截
              → registry.getServer(serverName)
              → server.callTool(toolName, args)
```

---

## 二、修改文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/config/mcpAclMatrix.ts` | **新建** | MCP 权限矩阵定义 |
| `src/mcp/core/mcpAclInterceptor.ts` | **新建** | 权限拦截器 |
| `src/mcp/core/client.ts` | 修改 | callTool/readResource/getPrompt 入口增加拦截 |
| `src/mcp/bridge/mcpBridge.ts` | 修改 | 新增 callerContext 参数透传 |
| `src/types/modules/mcp.types.ts` | 修改 | 新增 McpCallerContext 类型 |

---

## 三、具体代码

### 3.1 新建：`src/config/mcpAclMatrix.ts`

```typescript
/**
 * MCP 权限矩阵
 *
 * @description
 * 定义不同调用方角色可访问的 MCP Server 和 Tool 范围。
 * 与 DataBridge 的 ACL_MATRIX 形成纵深防御：
 *   - ACL_MATRIX: 数据层权限（module → store → operation）
 *   - MCP_ACL_MATRIX: 工具层权限（caller → server → tool）
 *
 * @module config/mcpAclMatrix
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

/** MCP 调用方角色 */
export type McpCallerRole = 'agent' | 'ui' | 'ci' | 'system'

/** MCP 权限规则 */
export interface McpPermissionRule {
  /** 允许访问的 Server 名称列表（`*` 表示全部） */
  readonly allowedServers: readonly string[]
  /** 允调用的 Tool 名称模式列表（支持 `*` 通配符，如 `list_*`、`get_*`、`*`） */
  readonly allowedTools: readonly string[]
}

/** MCP 权限矩阵 — 按调用方角色定义 */
export const MCP_ACL_MATRIX: Readonly<Record<McpCallerRole, McpPermissionRule>> = {
  // AI Agent：可调用所有 Server 的所有 Tool
  agent: {
    allowedServers: ['*'],
    allowedTools: ['*'],
  },

  // UI 层：仅可调用查询类 Tool，禁止交易类写操作
  ui: {
    allowedServers: [
      'fetcher', 'stockpool', 'scoring:v6', 'analysis',
      'news', 'llm', 'portfolio', 'screening', 'backtest',
    ],
    allowedTools: [
      'health_check',
      'list_*',
      'get_*',
      'fetch_*',
      'score_stock',
      'screen_stocks',
      'run_backtest',
      'list_pool_stocks',
      'list_groups',
    ],
  },

  // CI 流水线：仅可调用系统管理类 Tool
  ci: {
    allowedServers: ['system'],
    allowedTools: ['get_*', 'generate_migration_report'],
  },

  // 系统内部调用：超级权限（用于 bootstrap、迁移等系统级操作）
  system: {
    allowedServers: ['*'],
    allowedTools: ['*'],
  },
}

/** 默认调用方角色（向后兼容：未传入 caller 时使用） */
export const DEFAULT_MCP_CALLER: McpCallerRole = 'agent'
```

---

### 3.2 新建：`src/mcp/core/mcpAclInterceptor.ts`

```typescript
/**
 * MCP ACL 拦截器
 *
 * @description
 * 在 MCPClient.callTool / readResource / getPrompt 入口执行权限校验，
 * 拒绝未授权的调用并返回结构化错误。
 *
 * 权限校验流程：
 *   1. 从 MCP_ACL_MATRIX 获取调用方角色的权限规则
 *   2. 检查 serverName 是否在 allowedServers 中（支持 `*` 通配）
 *   3. 检查 toolName 是否匹配 allowedTools 模式（支持 `*` 通配）
 *   4. 全部通过则放行，否则返回 AclDeniedResult
 *
 * @module mcp/core/mcpAclInterceptor
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

import { getLogger } from '@/lib/logger'
import {
  MCP_ACL_MATRIX,
  DEFAULT_MCP_CALLER,
  type McpCallerRole,
  type McpPermissionRule,
} from '@/config/mcpAclMatrix'

const logger = getLogger()

/** 权限校验输入 */
export interface McpAclCheckInput {
  /** 调用方角色 */
  caller: McpCallerRole
  /** 目标 Server 名称 */
  serverName: string
  /** 目标 Tool/Resource/Prompt 名称 */
  resourceName: string
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
 * 通配符匹配
 *
 * 支持两种模式：
 *   - `*` 匹配任意字符串
 *   - `prefix_*` 匹配以 prefix_ 开头的字符串
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
 * MCP ACL 拦截器
 */
export class McpAclInterceptor {
  /**
   * 校验调用方是否有权访问指定 Server 的指定资源
   *
   * @returns allowed=true 放行；allowed=false 拒绝
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
      logger.warn(`[MCP:ACL] server denied: caller="${caller}", server="${serverName}"`)
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
      logger.warn(`[MCP:ACL] tool denied: caller="${caller}", server="${serverName}", tool="${resourceName}"`)
      return {
        allowed: false,
        reason: `Caller "${caller}" is not allowed to call tool "${resourceName}" on server "${serverName}"`,
        caller,
        serverName,
        resourceName,
      }
    }

    logger.info(`[MCP:ACL] granted: caller="${caller}", server="${serverName}", tool="${resourceName}"`)
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
   */
  assert(input: McpAclCheckInput): void {
    const result = this.check(input)
    if (!result.allowed) {
      throw new McpAclError(result.reason, result)
    }
  }
}

/** MCP ACL 拒绝错误 */
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
 * 解析调用方角色（用于向后兼容：未传入 caller 时使用默认值）
 */
export function resolveCaller(
  caller?: McpCallerRole,
): McpCallerRole {
  return caller ?? DEFAULT_MCP_CALLER
}
```

---

### 3.3 修改：`src/types/modules/mcp.types.ts`

在文件中新增 `McpCallerContext` 类型（放在现有类型定义之后）：

```typescript
// ============================================================
// MCP 调用方上下文（P0 权限控制新增）
// ============================================================

import type { McpCallerRole } from '@/config/mcpAclMatrix'

/** MCP 调用方上下文 — 用于权限校验 */
export interface McpCallerContext {
  /** 调用方角色 */
  caller: McpCallerRole
  /** 调用方标识（如组件名、Agent ID，用于审计日志） */
  callerId?: string
}
```

同时修改 `MCPClient` 接口的 `callTool` 签名：

```typescript
export interface MCPClient {
  // 修改前：
  // callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult>

  // 修改后（新增可选 context 参数，向后兼容）：
  callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: McpCallerContext,
  ): Promise<ToolResult>

  // readResource 和 getPrompt 同理新增可选 context 参数
  readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent>
  getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]>
}
```

---

### 3.4 修改：`src/mcp/core/client.ts`

```typescript
/**
 * MCP Client 实现
 *
 * @description
 * 统一的 MCP 调用入口，通过注册中心查找 Server 并调用其 Tool/Resource/Prompt。
 * 在每个调用入口集成 MCP ACL 拦截器，实现工具层权限控制。
 *
 * @module mcp/core/client
 */

import { getLogger } from '@/lib/logger'
import type {
  MCPClient,
  ToolDescriptor,
  ToolResult,
  ResourceTemplate,
  ResourceContent,
  PromptTemplate,
  PromptMessage,
  McpCallerContext,
} from '@/types/modules/mcp.types'
import { MCPRegistry } from './registry'
import { mcpAclInterceptor, resolveCaller, McpAclError } from './mcpAclInterceptor'

const logger = getLogger()

export class MCPClientImpl implements MCPClient {
  private registry: MCPRegistry

  constructor(registry: MCPRegistry) {
    this.registry = registry
    logger.info('[MCPClient] initialized with ACL interceptor')
  }

  // ============================================================
  // Tool 操作
  // ============================================================

  listAllTools(): Array<{ serverName: string; tool: ToolDescriptor }> {
    const result: Array<{ serverName: string; tool: ToolDescriptor }> = []
    const servers = this.registry.listServers()

    for (const entry of servers) {
      if (entry.options.enabled === false) continue
      const tools = entry.server.listTools()
      for (const tool of tools) {
        result.push({ serverName: entry.server.info.name, tool })
      }
    }

    logger.info(`[MCPClient] listAllTools() found ${result.length} tools across ${servers.length} servers`)
    return result
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: McpCallerContext,
  ): Promise<ToolResult> {
    const startTime = performance.now()
    const caller = resolveCaller(context?.caller)

    // ── ACL 权限拦截 ──
    const aclResult = mcpAclInterceptor.check({
      caller,
      serverName,
      resourceName: toolName,
    })

    if (!aclResult.allowed) {
      logger.warn(`[MCPClient] callTool() ACL denied: caller="${caller}", ${serverName}.${toolName}`)
      return {
        content: [{
          type: 'text',
          text: `ACL_PERMISSION_DENIED: ${aclResult.reason}`,
        }],
        isError: true,
      }
    }

    const entry = this.registry.getServer(serverName)
    if (!entry) {
      logger.error(`[MCPClient] callTool() server not found: ${serverName}`)
      return {
        content: [{ type: 'text', text: `Server not found: ${serverName}` }],
        isError: true,
      }
    }

    logger.info(`[MCPClient] callTool() ${serverName}.${toolName}`, { args, caller })
    const result = await entry.server.callTool(toolName, args)
    const duration = performance.now() - startTime

    logger.info(`[MCPClient] callTool() ${serverName}.${toolName} completed`, {
      durationMs: Math.round(duration),
      isError: result.isError ?? false,
      caller,
    })

    return result
  }

  // ============================================================
  // Resource 操作
  // ============================================================

  listAllResources(): Array<{ serverName: string; resource: ResourceTemplate }> {
    const result: Array<{ serverName: string; resource: ResourceTemplate }> = []
    const servers = this.registry.listServers()

    for (const entry of servers) {
      if (entry.options.enabled === false) continue
      const resources = entry.server.listResources()
      for (const resource of resources) {
        result.push({ serverName: entry.server.info.name, resource })
      }
    }

    return result
  }

  async readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent> {
    const caller = resolveCaller(context?.caller)
    const servers = this.registry.listServers()

    for (const entry of servers) {
      if (entry.options.enabled === false) continue
      const resources = entry.server.listResources()
      for (const resource of resources) {
        const regex = this.uriTemplateToRegex(resource.uriTemplate)
        if (regex.test(uri)) {
          // ── ACL 权限拦截 ──
          const aclResult = mcpAclInterceptor.check({
            caller,
            serverName: entry.server.info.name,
            resourceName: 'readResource',
          })

          if (!aclResult.allowed) {
            logger.warn(`[MCPClient] readResource() ACL denied: caller="${caller}", uri="${uri}"`)
            return {
              uri,
              mimeType: 'text/plain',
              text: `ACL_PERMISSION_DENIED: ${aclResult.reason}`,
            }
          }

          logger.info(`[MCPClient] readResource() ${uri} → ${entry.server.info.name}`, { caller })
          return await entry.server.readResource(uri)
        }
      }
    }

    logger.error(`[MCPClient] readResource() no server matches: ${uri}`)
    return {
      uri,
      mimeType: 'text/plain',
      text: `No server matches resource URI: ${uri}`,
    }
  }

  // ============================================================
  // Prompt 操作
  // ============================================================

  listAllPrompts(): Array<{ serverName: string; prompt: PromptTemplate }> {
    const result: Array<{ serverName: string; prompt: PromptTemplate }> = []
    const servers = this.registry.listServers()

    for (const entry of servers) {
      if (entry.options.enabled === false) continue
      const prompts = entry.server.listPrompts()
      for (const prompt of prompts) {
        result.push({ serverName: entry.server.info.name, prompt })
      }
    }

    return result
  }

  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]> {
    const caller = resolveCaller(context?.caller)

    // ── ACL 权限拦截 ──
    const aclResult = mcpAclInterceptor.check({
      caller,
      serverName,
      resourceName: promptName,
    })

    if (!aclResult.allowed) {
      logger.warn(`[MCPClient] getPrompt() ACL denied: caller="${caller}", ${serverName}.${promptName}`)
      return [{
        role: 'user',
        content: {
          type: 'text',
          text: `ACL_PERMISSION_DENIED: ${aclResult.reason}`,
        },
      }]
    }

    const entry = this.registry.getServer(serverName)
    if (!entry) {
      logger.error(`[MCPClient] getPrompt() server not found: ${serverName}`)
      return [{ role: 'user', content: { type: 'text', text: `Server not found: ${serverName}` } }]
    }

    logger.info(`[MCPClient] getPrompt() ${serverName}.${promptName}`, { caller })
    return await entry.server.getPrompt(promptName, args)
  }

  // ============================================================
  // 工具方法
  // ============================================================

  private uriTemplateToRegex(template: string): RegExp {
    const escaped = template
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{([^}]+)\\}/g, '([^/]+)')
    return new RegExp(`^${escaped}$`)
  }
}
```

---

### 3.5 修改：`src/mcp/bridge/mcpBridge.ts`

```typescript
/**
 * MCPBridge — MCP ? 现有架构适配层
 *
 * @description
 * 作为 MCP 架构与现有 DataBridge/Store 层之间的适配器。
 * 新增 callerContext 参数透传至 MCPClient，实现权限控制。
 *
 * @module mcp/bridge/mcpBridge
 */

import { getLogger } from '@/lib/logger'
import { MCPClientImpl } from '@/mcp/core/client'
import type { MCPClient, ToolResult, ResourceContent, PromptMessage } from '@/mcp/core/types'
import type { McpCallerContext } from '@/types/modules/mcp.types'
import { mcpRegistry } from '@/mcp/core/registry'
import { mcpAuditLogger } from '@/mcp/core/mcpAuditLogger'
import { DEFAULT_MCP_CALLER } from '@/config/mcpAclMatrix'

import { nanoid } from 'nanoid'
const logger = getLogger()

/** MCPBridge 单例 */
export class MCPBridge {
  private static instance: MCPBridge | null = null
  private client: MCPClientImpl

  private constructor() {
    this.client = new MCPClientImpl(mcpRegistry)
    logger.info('[MCPBridge] initialized with ACL support')
  }

  static getInstance(): MCPBridge {
    if (!MCPBridge.instance) {
      MCPBridge.instance = new MCPBridge()
    }
    return MCPBridge.instance
  }

  getClient(): MCPClient {
    return this.client
  }

  /**
   * 便捷方法：调用 Tool
   *
   * @param serverName - Server 名称
   * @param toolName - Tool 名称
   * @param args - 调用参数
   * @param context - 调用方上下文（用于权限校验，默认 agent 角色）
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: McpCallerContext,
  ): Promise<ToolResult> {
    const traceId = `mcp-${nanoid(8)}-${toolName}`
    const startTime = performance.now()
    const caller = context?.caller ?? DEFAULT_MCP_CALLER

    logger.info(`[MCPBridge] callTool() called: server="${serverName}", tool="${toolName}", caller="${caller}", traceId="${traceId}"`)

    try {
      const result = await this.client.callTool(serverName, toolName, args, context)
      const durationMs = performance.now() - startTime

      logger.info(`[MCPBridge] callTool() completed: server="${serverName}", tool="${toolName}", caller="${caller}", traceId="${traceId}", duration=${durationMs.toFixed(2)}ms, isError=${result.isError ?? false}`)

      // 审计日志增加 caller 字段
      await mcpAuditLogger.logToolCall(serverName, toolName, args, result, traceId, durationMs)
      return result
    } catch (err) {
      const errorResult: ToolResult = {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      }
      const durationMs = performance.now() - startTime
      logger.error(`[MCPBridge] callTool() failed: server="${serverName}", tool="${toolName}", caller="${caller}", traceId="${traceId}", duration=${durationMs.toFixed(2)}ms`, { error: errorResult.content[0]?.text })
      await mcpAuditLogger.logToolCall(serverName, toolName, args, errorResult, traceId, durationMs)
      return errorResult
    }
  }

  /**
   * 便捷方法：读取 Resource
   *
   * @param uri - Resource URI
   * @param context - 调用方上下文
   */
  async readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent> {
    return this.client.readResource(uri, context)
  }

  /**
   * 便捷方法：获取 Prompt
   *
   * @param context - 调用方上下文
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]> {
    return this.client.getPrompt(serverName, promptName, args, context)
  }

  listAllTools() {
    return this.client.listAllTools()
  }

  listAllResources() {
    return this.client.listAllResources()
  }

  listAllPrompts() {
    return this.client.listAllPrompts()
  }

  getStats() {
    return mcpRegistry.getStats()
  }
}

/** 全局 MCPBridge 单例 */
export const mcpBridge = MCPBridge.getInstance()
```

---

## 四、调用方使用示例

### 4.1 UI 层调用（受限角色）

```typescript
// src/apps/input/InputDashboard.tsx
import { mcpBridge } from '@/mcp/bridge/mcpBridge'

// UI 层显式传入 caller: 'ui'
const result = await mcpBridge.callTool(
  'fetcher',
  'health_check',
  {},
  { caller: 'ui', callerId: 'InputDashboard' },
)

// 如果 UI 层尝试调用交易类工具，会被 ACL 拒绝
const denied = await mcpBridge.callTool(
  'trading',
  'create_buy_order',  // ← ui 角色不允许调用此工具
  { symbol: '600519', quantity: 100 },
  { caller: 'ui' },
)
// denied.isError === true
// denied.content[0].text === 'ACL_PERMISSION_DENIED: Caller "ui" is not allowed to call tool "create_buy_order" on server "trading"'
```

### 4.2 Agent 调用（全权限角色）

```typescript
// src/agents/agentRuntime.ts
import { mcpBridge } from '@/mcp/bridge/mcpBridge'

// Agent 默认使用 'agent' 角色（全权限）
const result = await mcpBridge.callTool('trading', 'create_buy_order', {
  symbol: '600519',
  quantity: 100,
}, {
  caller: 'agent',
  callerId: 'agentRuntime',
})
```

### 4.3 CI 调用（最小权限角色）

```typescript
// scripts/ci-migration-check.ts
import { mcpBridge } from '@/mcp/bridge/mcpBridge'

const result = await mcpBridge.callTool(
  'system',
  'generate_migration_report',
  { migrationReport: report },
  { caller: 'ci', callerId: 'ci-pipeline' },
)

// CI 尝试调用非 system Server 会被拒绝
const denied = await mcpBridge.callTool(
  'fetcher', 'health_check', {},
  { caller: 'ci' },
)
// denied.isError === true
```

---

## 五、权限矩阵速查表

| 调用方角色 | 可访问 Server | 可调用 Tool 模式 | 典型场景 |
|-----------|--------------|-----------------|---------|
| `agent` | `*`（全部） | `*`（全部） | AI Agent 自主调用 |
| `ui` | 9 个查询类 Server | `health_check`/`list_*`/`get_*`/`fetch_*`/`score_stock` 等 | UI 交互 |
| `ci` | `system` | `get_*`/`generate_migration_report` | CI 流水线 |
| `system` | `*`（全部） | `*`（全部） | 系统内部调用（bootstrap、迁移） |

---

## 六、测试验证方案

### 6.1 单元测试

```typescript
// tests/__tests__/mcp/mcpAclInterceptor.test.ts
describe('McpAclInterceptor', () => {
  it('agent 角色应允许访问所有 Server 的所有 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'agent', serverName: 'trading', resourceName: 'create_buy_order',
    })
    expect(result.allowed).toBe(true)
  })

  it('ui 角色应拒绝交易类写操作', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trading', resourceName: 'create_buy_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
  })

  it('ui 角色应允许查询类操作', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'stockpool', resourceName: 'list_pool_stocks',
    })
    expect(result.allowed).toBe(true)
  })

  it('ci 角色应拒绝访问非 system Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'fetcher', resourceName: 'health_check',
    })
    expect(result.allowed).toBe(false)
  })

  it('通配符 list_* 应匹配 list_pool_stocks', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'stockpool', resourceName: 'list_pool_stocks',
    })
    expect(result.allowed).toBe(true)
  })

  it('通配符 * 应匹配任意 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'agent', serverName: 'fetcher', resourceName: 'any_unknown_tool',
    })
    expect(result.allowed).toBe(true)
  })
})
```

### 6.2 集成测试验证

```typescript
// 在现有集成测试中新增 ACL 验证套件
describe('ACL 权限拦截集成测试', () => {
  it('UI 角色调用交易类 Tool 应返回 ACL_PERMISSION_DENIED', async () => {
    const result = await mcpBridge.callTool(
      'trading', 'create_buy_order',
      { symbol: 'TEST001', quantity: 100 },
      { caller: 'ui' },
    )
    expect(result.isError).toBe(true)
    expect(result.content[0].type).toBe('text')
    expect((result.content[0] as { text: string }).text).toContain('ACL_PERMISSION_DENIED')
  })

  it('Agent 角色调用查询类 Tool 应成功', async () => {
    const result = await mcpBridge.callTool(
      'fetcher', 'health_check', {},
      { caller: 'agent' },
    )
    // health_check 可能因 Python 服务未启动而返回 false，但不应是 ACL 拒绝
    expect(result.isError).not.toBe(true)
  })
})
```

---

## 七、向后兼容性说明

1. **`context` 参数为可选**：现有调用方不传 `context` 时，默认使用 `agent` 角色（全权限），行为与修复前一致
2. **接口签名兼容**：`MCPClient.callTool` 新增第 4 个可选参数，不破坏现有调用
3. **无强制迁移**：现有代码无需立即修改，新调用方应显式传入 `context`

**建议**：在整改项 4.2（apps 层违规修复）中，将所有 `mcpBridge.callTool` 调用补充 `caller: 'ui'` 参数。

---

## 八、验证清单

- [ ] `src/config/mcpAclMatrix.ts` 创建完成
- [ ] `src/mcp/core/mcpAclInterceptor.ts` 创建完成
- [ ] `src/mcp/core/client.ts` callTool/readResource/getPrompt 增加 ACL 拦截
- [ ] `src/mcp/bridge/mcpBridge.ts` 透传 callerContext
- [ ] `src/types/modules/mcp.types.ts` 新增 McpCallerContext 类型
- [ ] 单元测试：6 个用例覆盖 4 种角色 + 通配符匹配
- [ ] 集成测试：ACL 拒绝场景 + ACL 放行场景
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm test -- --run` 通过
- [ ] `npm run audit:layers` 通过
