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
 * 新增 `callerContext` 参数透传至 MCPClient，实现工具层权限控制。
 * 新增 Tool 调用计数器，支持月度审计统计。
 *
 * @module mcp/bridge/mcpBridge
 * @created 2026-07-04 - Phase 1 MCP 适配层建设
 * @updated 2026-07-13 - P2 添加 Tool 调用计数器
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
  /** Tool 调用计数器：key = `${serverName}.${toolName}` */
  private toolCallStats: Map<string, number>

  private constructor() {
    this.client = new MCPClientImpl(mcpRegistry)
    this.toolCallStats = new Map()
    logger.info('[MCPBridge] initialized with ACL support')
  }

  /** 获取 MCPBridge 单例 */
  static getInstance(): MCPBridge {
    MCPBridge.instance ??= new MCPBridge()
    return MCPBridge.instance
  }

  /** 获取 MCP Client（用于直接调用 Tool/Resource/Prompt） */
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

    logger.info(
      `[MCPBridge] callTool() called: server="${serverName}", tool="${toolName}", caller="${caller}", traceId="${traceId}"`,
    )

    try {
      // 计数器递增
      const statKey = `${serverName}.${toolName}`
      this.toolCallStats.set(statKey, (this.toolCallStats.get(statKey) ?? 0) + 1)

      const result = await this.client.callTool(serverName, toolName, args, context)
      const durationMs = performance.now() - startTime

      logger.info(
        `[MCPBridge] callTool() completed: server="${serverName}", tool="${toolName}", caller="${caller}", traceId="${traceId}", duration=${durationMs.toFixed(2)}ms, isError=${result.isError ?? false}`,
      )

      await mcpAuditLogger.logToolCall(serverName, toolName, args, result, traceId, durationMs)
      return result
    } catch (err) {
      const errorResult: ToolResult = {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      }
      const durationMs = performance.now() - startTime
      logger.error(
        `[MCPBridge] callTool() failed: server="${serverName}", tool="${toolName}", caller="${caller}", traceId="${traceId}", duration=${durationMs.toFixed(2)}ms`,
        { error: errorResult.content[0]?.text },
      )
      await mcpAuditLogger.logToolCall(serverName, toolName, args, errorResult, traceId, durationMs)
      return errorResult
    }
  }

  /**
   * 便捷方法：读取 Resource
   *
   * @param uri - Resource URI
   * @param context - 调用方上下文（用于权限校验）
   */
  async readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent> {
    return this.client.readResource(uri, context)
  }

  /**
   * 便捷方法：获取 Prompt
   *
   * @param serverName - Server 名称
   * @param promptName - Prompt 名称
   * @param args - 模板参数
   * @param context - 调用方上下文（用于权限校验）
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]> {
    return this.client.getPrompt(serverName, promptName, args, context)
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

  /**
   * 获取 Tool 调用次数统计。
   *
   * @returns 按 serverName.toolName 聚合的调用次数映射
   */
  getToolUsageStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const [key, count] of this.toolCallStats.entries()) {
      stats[key] = count
    }
    return stats
  }

  /** 重置 Tool 调用计数器 */
  resetToolUsageStats(): void {
    this.toolCallStats.clear()
    logger.info('[MCPBridge] tool usage stats reset')
  }
}

/** 全局 MCPBridge 单例 */
export const mcpBridge = MCPBridge.getInstance()
