/**
 * MCP Server 基类
 *
 * @description
 * 提供 MCPServer 接口的默认实现，内置 Tool/Resource/Prompt 的注册与查找。
 * 业务 Server 继承此类并重写 getTools/getResources/getPrompts 方法。
 *
 * @module mcp/core/server
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import { getLogger } from '@/lib/logger'
import type {
  MCPServer,
  ServerInfo,
  ToolDescriptor,
  ToolResult,
  ResourceTemplate,
  ResourceContent,
  PromptTemplate,
  PromptMessage,
} from '@/types/modules/mcp.types'

const logger = getLogger()

/** MCP Server 基类 —— 提供默认的工具/资源/Prompt 管理 */
export abstract class MCPServerBase implements MCPServer {
  abstract readonly info: ServerInfo

  /** 工具缓存（按 name 索引） */
  private toolCache: Map<string, ToolDescriptor> | null = null

  /** 资源缓存（按 name 索引） */
  private resourceCache: Map<string, ResourceTemplate> | null = null

  /** Prompt 缓存（按 name 索引） */
  private promptCache: Map<string, PromptTemplate> | null = null

  // ============================================================
  // 子类重写方法
  // ============================================================

  /** 子类重写：返回工具列表 */
  protected getTools(): ToolDescriptor[] {
    return []
  }

  /** 子类重写：返回资源模板列表 */
  protected getResources(): ResourceTemplate[] {
    return []
  }

  /** 子类重写：返回 Prompt 模板列表 */
  protected getPrompts(): PromptTemplate[] {
    return []
  }

  // ============================================================
  // 公共接口实现
  // ============================================================

  listTools(): ToolDescriptor[] {
    if (this.toolCache === null) {
      const tools = this.getTools()
      this.toolCache = new Map(tools.map((t) => [t.name, t]))
      logger.info(`[MCPServer:${this.info.name}] listTools() loaded ${tools.length} tools`)
    }
    return Array.from(this.toolCache.values())
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = performance.now()
    const tools = this.listTools()
    const tool = tools.find((t) => t.name === name)

    if (!tool) {
      logger.error(`[MCPServer:${this.info.name}] callTool() tool not found: ${name}`)
      return {
        content: [{ type: 'text', text: `Tool not found: ${name}` }],
        isError: true,
      }
    }

    // P0-2 安全修复：调用前校验参数 schema，防止非法参数注入
    const validationErrors = this.validateToolArgs(tool, args)
    if (validationErrors.length > 0) {
      logger.error(`[MCPServer:${this.info.name}] callTool() validation failed: ${name}`, {
        errors: validationErrors,
      })
      return {
        content: [{ type: 'text', text: `Invalid parameters: ${validationErrors.join('; ')}` }],
        isError: true,
      }
    }

    try {
      logger.info(`[MCPServer:${this.info.name}] callTool() executing: ${name}`, { args })
      const result = await tool.handler(args)
      const duration = performance.now() - startTime
      logger.info(`[MCPServer:${this.info.name}] callTool() completed: ${name}`, {
        durationMs: Math.round(duration),
        isError: result.isError ?? false,
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[MCPServer:${this.info.name}] callTool() failed: ${name}`, { error: message })
      return {
        content: [{ type: 'text', text: `Tool execution error: ${message}` }],
        isError: true,
      }
    }
  }

  listResources(): ResourceTemplate[] {
    if (this.resourceCache === null) {
      const resources = this.getResources()
      this.resourceCache = new Map(resources.map((r) => [r.name, r]))
      logger.info(`[MCPServer:${this.info.name}] listResources() loaded ${resources.length} resources`)
    }
    return Array.from(this.resourceCache.values())
  }

  async readResource(uri: string): Promise<ResourceContent> {
    const resources = this.listResources()

    for (const resource of resources) {
      const regex = this.uriTemplateToRegex(resource.uriTemplate)
      if (regex.test(uri)) {
        try {
          logger.info(`[MCPServer:${this.info.name}] readResource() reading: ${uri}`)
          return await resource.resolver(uri)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(`[MCPServer:${this.info.name}] readResource() failed: ${uri}`, { error: message })
          return {
            uri,
            mimeType: 'text/plain',
            text: `Resource read error: ${message}`,
          }
        }
      }
    }

    logger.error(`[MCPServer:${this.info.name}] readResource() not found: ${uri}`)
    return {
      uri,
      mimeType: 'text/plain',
      text: `Resource not found: ${uri}`,
    }
  }

  listPrompts(): PromptTemplate[] {
    if (this.promptCache === null) {
      const prompts = this.getPrompts()
      this.promptCache = new Map(prompts.map((p) => [p.name, p]))
      logger.info(`[MCPServer:${this.info.name}] listPrompts() loaded ${prompts.length} prompts`)
    }
    return Array.from(this.promptCache.values())
  }

  async getPrompt(name: string, args: Record<string, string>): Promise<PromptMessage[]> {
    const prompts = this.listPrompts()
    const prompt = prompts.find((p) => p.name === name)

    if (!prompt) {
      logger.error(`[MCPServer:${this.info.name}] getPrompt() not found: ${name}`)
      return [{ role: 'user', content: { type: 'text', text: `Prompt not found: ${name}` } }]
    }

    try {
      logger.info(`[MCPServer:${this.info.name}] getPrompt() generating: ${name}`, { args })
      return await prompt.generator(args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[MCPServer:${this.info.name}] getPrompt() failed: ${name}`, { error: message })
      return [{ role: 'user', content: { type: 'text', text: `Prompt generation error: ${message}` } }]
    }
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 校验工具调用参数是否符合 inputSchema 定义。
   * 检查项：必填字段、类型匹配、枚举值约束。
   *
   * @returns 错误信息数组，空数组表示校验通过
   */
  private validateToolArgs(
    tool: ToolDescriptor,
    args: Record<string, unknown>,
  ): string[] {
    const errors: string[] = []
    const schema = tool.inputSchema

    if (!schema || schema.type !== 'object' || !schema.properties) {
      return errors // 无 schema 定义时跳过校验（向后兼容）
    }

    // 检查必填字段
    for (const required of schema.required ?? []) {
      if (!(required in args)) {
        errors.push(`missing required parameter: "${required}"`)
      }
    }

    // 检查类型与枚举
    for (const [key, value] of Object.entries(args)) {
      const prop = schema.properties[key]
      if (!prop) continue // 未知参数不阻断（允许扩展）

      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (value !== null && value !== undefined && actualType !== prop.type) {
        errors.push(`parameter "${key}" expected ${prop.type}, got ${actualType}`)
      }

      if (prop.enum && !prop.enum.includes(value as string)) {
        errors.push(`parameter "${key}" must be one of [${prop.enum.join(', ')}]`)
      }
    }

    return errors
  }

  /** 将 URI 模板转换为正则表达式 */
  private uriTemplateToRegex(template: string): RegExp {
    const escaped = template
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{([^}]+)\\}/g, '([^/]+)')
    return new RegExp(`^${escaped}$`)
  }
}