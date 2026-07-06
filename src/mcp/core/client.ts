/**
 * MCP Client 实现
 *
 * @description
 * 统一的 MCP 调用入口，通过注册中心查找 Server 并调用其 Tool/Resource/Prompt。
 * 支持工具发现、资源读取、Prompt 获取等全部 MCP 协议操作。
 *
 * @module mcp/core/client
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
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
} from '@/types/modules/mcp.types'
import { MCPRegistry } from './registry'

const logger = getLogger()

/** MCP Client 实现 —— 通过注册中心调用 Server */
export class MCPClientImpl implements MCPClient {
  private registry: MCPRegistry

  constructor(registry: MCPRegistry) {
    this.registry = registry
    logger.info('[MCPClient] initialized')
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
  ): Promise<ToolResult> {
    const startTime = performance.now()
    const entry = this.registry.getServer(serverName)

    if (!entry) {
      logger.error(`[MCPClient] callTool() server not found: ${serverName}`)
      return {
        content: [{ type: 'text', text: `Server not found: ${serverName}` }],
        isError: true,
      }
    }

    logger.info(`[MCPClient] callTool() ${serverName}.${toolName}`, { args })
    const result = await entry.server.callTool(toolName, args)
    const duration = performance.now() - startTime

    logger.info(`[MCPClient] callTool() ${serverName}.${toolName} completed`, {
      durationMs: Math.round(duration),
      isError: result.isError ?? false,
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

  async readResource(uri: string): Promise<ResourceContent> {
    const servers = this.registry.listServers()

    for (const entry of servers) {
      if (entry.options.enabled === false) continue
      const resources = entry.server.listResources()
      for (const resource of resources) {
        const regex = this.uriTemplateToRegex(resource.uriTemplate)
        if (regex.test(uri)) {
          logger.info(`[MCPClient] readResource() ${uri} → ${entry.server.info.name}`)
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
  ): Promise<PromptMessage[]> {
    const entry = this.registry.getServer(serverName)

    if (!entry) {
      logger.error(`[MCPClient] getPrompt() server not found: ${serverName}`)
      return [{ role: 'user', content: { type: 'text', text: `Server not found: ${serverName}` } }]
    }

    logger.info(`[MCPClient] getPrompt() ${serverName}.${promptName}`)
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