/**
 * MCP Client 实现
 *
 * @description
 * 统一的 MCP 调用入口，通过注册中心查找 Server 并调用其 Tool/Resource/Prompt。
 * 在每个调用入口集成 MCP ACL 拦截器，实现工具层权限控制。
 *
 * 与 Server 基类的深度防御 ACL 校验形成两层权限拦截：
 *   - Client 层（本文件）：基于 caller 上下文的主拦截点
 *   - Server 层（server.ts）：深度防御，防止绕过 Client 的直接调用
 *
 * @module mcp/core/client
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 * @updated 2026-07-08 - P0 集成 ACL 拦截器
 */

import { getLogger } from '@/lib/logger'
import type {
  MCPClient,
  MCPServer,
  ToolDescriptor,
  ToolResult,
  ResourceTemplate,
  ResourceContent,
  PromptTemplate,
  PromptMessage,
  McpCallerContext,
} from '@/types/modules/mcp.types'
import { MCPRegistry } from './registry'
import { mcpAclInterceptor, resolveCaller } from './mcpAclInterceptor'

const logger = getLogger()

/** MCP Client 实现 —— 通过注册中心调用 Server */
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

    // ── ACL 权限拦截（主拦截点） ──
    const aclResult = mcpAclInterceptor.check({
      caller,
      serverName,
      resourceName: toolName,
    })

    if (!aclResult.allowed) {
      logger.warn(
        `[MCPClient] callTool() ACL denied: caller="${caller}", ${serverName}.${toolName}`,
      )
      return {
        content: [
          { type: 'text', text: `ACL_PERMISSION_DENIED: ${aclResult.reason}` },
        ],
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
    // 透传 context 给 Server 基类（深度防御）
    const result = await entry.server.callTool(toolName, args, context)
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
    const match = this.findResourceMatch(uri)

    if (!match) {
      logger.error(`[MCPClient] readResource() no server matches: ${uri}`)
      return {
        uri,
        mimeType: 'text/plain',
        text: `No server matches resource URI: ${uri}`,
      }
    }

    const { server, resource } = match
    const aclResult = mcpAclInterceptor.check({
      caller,
      serverName: server.info.name,
      resourceName: `readResource:${resource.name}`,
    })

    if (!aclResult.allowed) {
      logger.warn(
        `[MCPClient] readResource() ACL denied: caller="${caller}", uri="${uri}"`,
      )
      return {
        uri,
        mimeType: 'text/plain',
        text: `ACL_PERMISSION_DENIED: ${aclResult.reason}`,
      }
    }

    logger.info(`[MCPClient] readResource() ${uri} → ${server.info.name}`, { caller })
    return await server.readResource(uri, context)
  }

  private findResourceMatch(uri: string): { server: MCPServer; resource: ResourceTemplate } | null {
    for (const entry of this.registry.listServers()) {
      if (entry.options.enabled === false) continue
      for (const resource of entry.server.listResources()) {
        if (this.uriTemplateToRegex(resource.uriTemplate).test(uri)) {
          return { server: entry.server, resource }
        }
      }
    }
    return null
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

    // ── ACL 权限拦截（主拦截点） ──
    const aclResult = mcpAclInterceptor.check({
      caller,
      serverName,
      resourceName: `getPrompt:${promptName}`,
    })

    if (!aclResult.allowed) {
      logger.warn(
        `[MCPClient] getPrompt() ACL denied: caller="${caller}", ${serverName}.${promptName}`,
      )
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
    // 透传 context 给 Server 基类（深度防御）
    return await entry.server.getPrompt(promptName, args, context)
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
