/**
 * MCP Server 基类
 *
 * @description
 * 提供 MCPServer 接口的默认实现，内置 Tool/Resource/Prompt 的注册与查找。
 * 业务 Server 继承此类并重写 getTools/getResources/getPrompts 方法。
 *
 * **双端权限校验（金融级底线）**：
 *   - Client 端（防君子）：MCPClientImpl 在入口拦截，基于 caller 上下文校验
 *   - Server 端（防小人）：本基类在 callTool/readResource/getPrompt 执行前，
 *     调用 `assertServerPermission(role, resourceName)` 再次校验，
 *     防止绕过 Client 直接调用 Server 实例的越权访问
 *
 * @module mcp/core/server
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 * @updated 2026-07-08 - P0 新增 constructor 接收 defaultCallerRole + assertServerPermission 方法
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
  McpCallerContext,
  McpCallerRole,
} from '@/types/modules/mcp.types'
import { mcpAclInterceptor, McpAclError } from './mcpAclInterceptor'

const logger = getLogger()

/** MCP Server 基类 —— 提供默认的工具/资源/Prompt 管理 + 服务端权限防御 */
export abstract class MCPServerBase implements MCPServer {
  abstract readonly info: ServerInfo

  /**
   * 该 Server 实例的默认调用方角色。
   *
   * 当 callTool/readResource/getPrompt 未传入 `context.caller` 时使用此默认值。
   * 子类可在构造时通过 `super('ui')` / `super('system')` 指定，
   * 默认 `'agent'`（向后兼容：现有 16 个 Server 子类无需修改）。
   */
  private readonly defaultCallerRole: McpCallerRole

  /** 工具缓存（按 name 索引） */
  private toolCache: Map<string, ToolDescriptor> | null = null

  /** 资源缓存（按 name 索引） */
  private resourceCache: Map<string, ResourceTemplate> | null = null

  /** Prompt 缓存（按 name 索引） */
  private promptCache: Map<string, PromptTemplate> | null = null

  /**
   * @param defaultCallerRole - 默认调用方角色（未传入 context 时使用），默认 `'agent'`
   */
  constructor(defaultCallerRole: McpCallerRole = 'agent') {
    this.defaultCallerRole = defaultCallerRole
  }

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
  // 服务端权限防御（防小人）
  // ============================================================

  /**
   * 服务端权限断言 —— 在执行工具/资源/Prompt 前校验调用方角色是否有权访问。
   *
   * **设计目的**：这是"Server 防小人"的防线。即使调用方绕过 MCPClient 直接拿到
   * Server 实例调用 callTool，Server 自身也会基于传入的 callerRole 进行权限校验，
   * 拒绝未授权的工具访问。
   *
   * **可重写**：子类可重写此方法实现自定义权限逻辑（如基于 Tool 元数据的细粒度控制、
   * 基于 args 内容的动态权限决策）。重写时建议保留 `super.assertServerPermission()`
   * 调用以维持基础 ACL 校验。
   *
   * @param role - 调用方角色（从 context.caller 或 defaultCallerRole 解析）
   * @param resourceName - 资源名称（Tool name / `readResource:xxx` / `getPrompt:xxx`）
   * @throws {McpAclError} 当权限校验失败
   */
  protected assertServerPermission(
    role: McpCallerRole,
    resourceName: string,
  ): void {
    mcpAclInterceptor.assert({
      caller: role,
      serverName: this.info.name,
      resourceName,
    })
  }

  /**
   * 解析当前调用的 caller 角色：
   * 优先使用 context.caller，未传入时回退到 this.defaultCallerRole。
   */
  private resolveCallerFromContext(context?: McpCallerContext): McpCallerRole {
    return context?.caller ?? this.defaultCallerRole
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

  async callTool(
    name: string,
    args: Record<string, unknown>,
    context?: McpCallerContext,
  ): Promise<ToolResult> {
    const startTime = performance.now()
    const caller = this.resolveCallerFromContext(context)

    // ── Server 端权限断言（防小人） ──
    // 即使调用方绕过 Client 直接调用 Server 实例，Server 自身也会拦截未授权调用
    try {
      this.assertServerPermission(caller, name)
    } catch (err) {
      if (err instanceof McpAclError) {
        logger.warn(
          `[MCPServer:${this.info.name}] callTool() ACL denied: caller="${caller}", tool="${name}"`,
        )
        return {
          content: [
            { type: 'text', text: `ACL_PERMISSION_DENIED: ${err.detail.reason}` },
          ],
          isError: true,
        }
      }
      throw err
    }

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
      logger.info(`[MCPServer:${this.info.name}] callTool() executing: ${name}`, {
        args,
        caller,
      })
      const result = await tool.handler(args)
      const duration = performance.now() - startTime
      logger.info(`[MCPServer:${this.info.name}] callTool() completed: ${name}`, {
        durationMs: Math.round(duration),
        isError: result.isError ?? false,
        caller,
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

  async readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent> {
    const caller = this.resolveCallerFromContext(context)
    const resources = this.listResources()
    const matched = resources.find((r) => this.uriTemplateToRegex(r.uriTemplate).test(uri))

    if (!matched) {
      logger.error(`[MCPServer:${this.info.name}] readResource() not found: ${uri}`)
      return {
        uri,
        mimeType: 'text/plain',
        text: `Resource not found: ${uri}`,
      }
    }

    const permissionResult = this.checkResourcePermission(caller, matched, uri)
    if (permissionResult) return permissionResult

    return this.resolveResource(matched, uri, caller)
  }

  private checkResourcePermission(
    caller: McpCallerRole,
    resource: ResourceTemplate,
    uri: string,
  ): ResourceContent | null {
    try {
      this.assertServerPermission(caller, `readResource:${resource.name}`)
      return null
    } catch (err) {
      if (err instanceof McpAclError) {
        logger.warn(
          `[MCPServer:${this.info.name}] readResource() ACL denied: caller="${caller}", uri="${uri}"`,
        )
        return {
          uri,
          mimeType: 'text/plain',
          text: `ACL_PERMISSION_DENIED: ${err.detail.reason}`,
        }
      }
      throw err
    }
  }

  private async resolveResource(
    resource: ResourceTemplate,
    uri: string,
    caller: McpCallerRole,
  ): Promise<ResourceContent> {
    try {
      logger.info(`[MCPServer:${this.info.name}] readResource() reading: ${uri}`, { caller })
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

  listPrompts(): PromptTemplate[] {
    if (this.promptCache === null) {
      const prompts = this.getPrompts()
      this.promptCache = new Map(prompts.map((p) => [p.name, p]))
      logger.info(`[MCPServer:${this.info.name}] listPrompts() loaded ${prompts.length} prompts`)
    }
    return Array.from(this.promptCache.values())
  }

  async getPrompt(
    name: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]> {
    const caller = this.resolveCallerFromContext(context)

    // ── Server 端权限断言（防小人） ──
    try {
      this.assertServerPermission(caller, `getPrompt:${name}`)
    } catch (err) {
      if (err instanceof McpAclError) {
        logger.warn(
          `[MCPServer:${this.info.name}] getPrompt() ACL denied: caller="${caller}", prompt="${name}"`,
        )
        return [{
          role: 'user',
          content: {
            type: 'text',
            text: `ACL_PERMISSION_DENIED: ${err.detail.reason}`,
          },
        }]
      }
      throw err
    }

    const prompts = this.listPrompts()
    const prompt = prompts.find((p) => p.name === name)

    if (!prompt) {
      logger.error(`[MCPServer:${this.info.name}] getPrompt() not found: ${name}`)
      return [{ role: 'user', content: { type: 'text', text: `Prompt not found: ${name}` } }]
    }

    try {
      logger.info(`[MCPServer:${this.info.name}] getPrompt() generating: ${name}`, { args, caller })
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

    if (schema?.type !== 'object' || !schema.properties) {
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
