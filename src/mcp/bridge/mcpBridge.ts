/**
 * MCPBridge — MCP ↔ 现有架构适配层
 *
 * @description
 * 作为 MCP 架构与现有 DataBridge/Store 层之间的适配器，遵循 Strangler Fig 模式：
 * 1. 新代码通过 MCPClient 调用 MCP Server 的 Tool/Resource
 * 2. MCP Server 内部委托现有 Service 层执行
 * 3. Store 层数据通过 MCPBridge 同步到 MCP Resource
 * 4. 数据写入通过 DataBridge 保持一致性
 *
 * @module mcp/bridge/mcpBridge
 * @created 2026-07-04 - Phase 1 MCP 适配层建设
 */

import { getLogger } from '@/lib/logger'
import { MCPClientImpl } from '@/mcp/core/client'
import type { MCPClient, ToolResult, ResourceContent, PromptMessage } from '@/mcp/core/types'
import { mcpRegistry } from '@/mcp/core/registry'
import { mcpAuditLogger } from '@/mcp/core/mcpAuditLogger'

const logger = getLogger()

/** MCPBridge 单例 */
export class MCPBridge {
  private static instance: MCPBridge | null = null
  private client: MCPClientImpl

  private constructor() {
    this.client = new MCPClientImpl(mcpRegistry)
    logger.info('[MCPBridge] initialized')
  }

  /** 获取 MCPBridge 单例 */
  static getInstance(): MCPBridge {
    if (!MCPBridge.instance) {
      MCPBridge.instance = new MCPBridge()
    }
    return MCPBridge.instance
  }

  /** 获取 MCP Client（用于直接调用 Tool/Resource/Prompt） */
  getClient(): MCPClient {
    return this.client
  }

  /** 便捷方法：调用 Tool */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const traceId = `mcp-${Date.now()}-${toolName}`
    const startTime = performance.now()

    try {
      const result = await this.client.callTool(serverName, toolName, args)
      const durationMs = performance.now() - startTime
      await mcpAuditLogger.logToolCall(serverName, toolName, args, result, traceId, durationMs)
      return result
    } catch (err) {
      const errorResult: ToolResult = {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      }
      const durationMs = performance.now() - startTime
      await mcpAuditLogger.logToolCall(serverName, toolName, args, errorResult, traceId, durationMs)
      return errorResult
    }
  }

  /** 便捷方法：读取 Resource */
  async readResource(uri: string): Promise<ResourceContent> {
    return this.client.readResource(uri)
  }

  /** 便捷方法：获取 Prompt */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
  ): Promise<PromptMessage[]> {
    return this.client.getPrompt(serverName, promptName, args)
  }

  /** 列出所有工具（供 Agent 发现） */
  listAllTools() {
    return this.client.listAllTools()
  }

  /** 列出所有资源（供 Agent 发现） */
  listAllResources() {
    return this.client.listAllResources()
  }

  /** 列出所有 Prompt 模板（供 Agent 发现） */
  listAllPrompts() {
    return this.client.listAllPrompts()
  }

  /** 获取注册统计信息 */
  getStats() {
    return mcpRegistry.getStats()
  }
}

/** 全局 MCPBridge 单例 */
export const mcpBridge = MCPBridge.getInstance()