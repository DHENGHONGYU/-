/**
 * MCP (Model Context Protocol) 类型定义
 *
 * @description
 * 定义 MCP 架构的四元抽象：Server / Tool / Resource / Prompt。
 * 所有 MCP Server 实现必须基于此处的接口扩展。
 *
 * @module types/modules/mcp
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import type { UserRole, DeveloperRole } from '@/types/role.types'

// ============================================================
// JSON Schema 子集（用于 Tool inputSchema）
// ============================================================

/** 简化的 JSON Schema 类型（仅支持 Tool 描述所需字段） */
export interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array'
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  description?: string
  enum?: string[]
}

/** JSON Schema 属性描述 */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  default?: unknown
  enum?: string[]
  items?: JSONSchemaProperty
}

// ============================================================
// Server 元信息
// ============================================================

/** MCP Server 信息 */
export interface ServerInfo {
  /** 唯一标识，格式 {domain}:{variant}，如 scoring:v6 */
  name: string
  /** 语义化版本号 */
  version: string
  /** 服务描述 */
  description: string
  /** 依赖的其他 Server 名称列表 */
  dependencies?: string[]
}

// ============================================================
// Tool 抽象
// ============================================================

/** 工具描述符 —— 定义 Tool 的元数据与调用契约 */
export interface ToolDescriptor {
  /** 工具名称，snake_case，如 score_stock */
  name: string
  /** 工具描述，供 AI Agent 理解工具用途 */
  description: string
  /** 输入参数 JSON Schema */
  inputSchema: JSONSchema
  /** 工具执行函数 */
  handler: (args: Record<string, unknown>) => Promise<ToolResult>
}

/** 工具调用结果内容块 */
export interface ToolContentBlock {
  type: 'text' | 'image' | 'resource'
  /** text 类型时使用 */
  text?: string
  /** image 类型时使用，base64 编码 */
  data?: string
  /** image 类型时使用，MIME 类型 */
  mimeType?: string
  /** resource 类型时使用，URI 引用 */
  uri?: string
}

/** 工具调用结果 */
export interface ToolResult {
  /** 内容块数组 */
  content: ToolContentBlock[]
  /** 是否为错误结果 */
  isError?: boolean
}

// ============================================================
// Resource 抽象
// ============================================================

/** 资源模板 —— 定义可暴露的结构化数据 URI 模板 */
export interface ResourceTemplate {
  /** URI 模板，如 scores://{symbol}/v6 */
  uriTemplate: string
  /** 资源名称 */
  name: string
  /** 资源描述 */
  description: string
  /** MIME 类型，默认 application/json */
  mimeType?: string
  /** 解析 URI 并返回资源内容 */
  resolver: (uri: string) => Promise<ResourceContent>
}

/** 资源内容 */
export interface ResourceContent {
  /** URI */
  uri: string
  /** MIME 类型 */
  mimeType: string
  /** 文本内容（JSON 字符串或纯文本） */
  text?: string
  /** 二进制内容（base64 编码） */
  blob?: string
}

// ============================================================
// Prompt 抽象
// ============================================================

/** Prompt 模板参数 */
export interface PromptArgument {
  /** 参数名 */
  name: string
  /** 参数描述 */
  description: string
  /** 是否必填 */
  required?: boolean
}

/** Prompt 消息 */
export interface PromptMessage {
  /** 角色 */
  role: 'user' | 'assistant' | 'system'
  /** 消息内容 */
  content: {
    type: 'text'
    text: string
  }
}

/** Prompt 模板 —— 定义可复用的 AI 提示词模板 */
export interface PromptTemplate {
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description: string
  /** 模板参数定义 */
  arguments?: PromptArgument[]
  /** 生成 Prompt 消息 */
  generator: (args: Record<string, string>) => Promise<PromptMessage[]>
}

// ============================================================
// MCP 调用方上下文（P0 权限控制新增）
// ============================================================

/**
 * MCP 调用方角色 — 用于工具层权限校验。
 *
 * 与 DataBridge 的 ACL_MATRIX（数据层权限）形成纵深防御：
 *   - ACL_MATRIX: module → store → operation（数据层）
 *   - MCP_ACL_MATRIX: caller → server → tool（工具层）
 */
export type McpCallerRole = 'agent' | 'ui' | 'ci' | 'system'

export type McpEffectiveRole = McpCallerRole | UserRole | DeveloperRole

/**
 * MCP 调用方上下文 — 在 Client/Bridge 调用入口传入，用于权限校验和审计。
 *
 * `caller` 默认为 `agent`（向后兼容：未传入时使用默认值）。
 * `callerId` 为可选的调用方标识（如组件名、Agent ID），用于审计日志。
 */
export interface McpCallerContext {
  /** 调用方角色 */
  caller: McpCallerRole
  /** 调用方标识（如组件名、Agent ID，用于审计日志） */
  callerId?: string
}

// ============================================================
// MCP Server 接口
// ============================================================

/** MCP Server 核心接口 —— 所有业务 Server 必须实现 */
export interface MCPServer {
  /** 服务信息 */
  readonly info: ServerInfo

  /** 列出所有暴露的工具 */
  listTools(): ToolDescriptor[]

  /**
   * 调用指定工具
   *
   * @param name - 工具名称
   * @param args - 调用参数
   * @param context - 调用方上下文（用于权限校验，可选，向后兼容）
   */
  callTool(
    name: string,
    args: Record<string, unknown>,
    context?: McpCallerContext,
  ): Promise<ToolResult>

  /** 列出所有暴露的资源模板 */
  listResources(): ResourceTemplate[]

  /**
   * 读取指定资源
   *
   * @param uri - 资源 URI
   * @param context - 调用方上下文（用于权限校验，可选）
   */
  readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent>

  /** 列出所有暴露的 Prompt 模板 */
  listPrompts(): PromptTemplate[]

  /**
   * 获取指定 Prompt
   *
   * @param name - Prompt 名称
   * @param args - 模板参数
   * @param context - 调用方上下文（用于权限校验，可选）
   */
  getPrompt(
    name: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]>
}

// ============================================================
// MCP Client 接口
// ============================================================

/** MCP Client 接口 —— 统一的 MCP 调用入口 */
export interface MCPClient {
  /** 列出所有已注册 Server 的工具 */
  listAllTools(): Array<{ serverName: string; tool: ToolDescriptor }>

  /**
   * 调用指定 Server 的指定工具
   *
   * @param serverName - Server 名称
   * @param toolName - Tool 名称
   * @param args - 调用参数
   * @param context - 调用方上下文（用于权限校验，可选，默认 agent 角色）
   */
  callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: McpCallerContext,
  ): Promise<ToolResult>

  /** 列出所有已注册 Server 的资源 */
  listAllResources(): Array<{ serverName: string; resource: ResourceTemplate }>

  /**
   * 读取指定 URI 的资源
   *
   * @param uri - 资源 URI
   * @param context - 调用方上下文（用于权限校验，可选）
   */
  readResource(uri: string, context?: McpCallerContext): Promise<ResourceContent>

  /** 列出所有已注册 Server 的 Prompt 模板 */
  listAllPrompts(): Array<{ serverName: string; prompt: PromptTemplate }>

  /**
   * 获取指定 Prompt
   *
   * @param serverName - Server 名称
   * @param promptName - Prompt 名称
   * @param args - 模板参数
   * @param context - 调用方上下文（用于权限校验，可选）
   */
  getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
    context?: McpCallerContext,
  ): Promise<PromptMessage[]>
}

// ============================================================
// 注册中心
// ============================================================

/** Server 注册配置 */
export interface ServerRegistrationOptions {
  /** 优先级：high / medium / low */
  priority: 'high' | 'medium' | 'low'
  /** 是否启用（默认 true） */
  enabled?: boolean
  /**
   * 配置模块路径（如 `@/mcp/servers/fetcher/dataFetcherServer`）
   *
   * 作为 Server 在「配置注册表 ↔ 运行时注册表」之间的稳定身份标识，
   * 用于 `syncWithConfig()` 增量同步时精确比对，避免依赖 Server 的
   * `info.name`（可能与配置 `name` 不同，如 `llm` vs `llm:main`）导致的误注销。
   */
  modulePath?: string
}

/** 已注册的 Server 条目 */
export interface RegisteredServer {
  server: MCPServer
  options: ServerRegistrationOptions
  registeredAt: number
}

// ============================================================
// 传输层
// ============================================================

/** JSON-RPC 2.0 请求 */
export interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

/** JSON-RPC 2.0 响应 */
export interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/** MCP 传输层接口 */
export interface MCPTransport {
  /** 发送请求并等待响应 */
  sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown>
  /** 发送通知（无需响应） */
  sendNotification(method: string, params?: Record<string, unknown>): Promise<void>
  /** 关闭连接 */
  close(): void
}

// ============================================================
// MCP 错误码
// ============================================================

/** MCP 标准错误码 */
export const MCP_ERROR_CODES = {
  /** 工具未找到 */
  TOOL_NOT_FOUND: -32001,
  /** 资源未找到 */
  RESOURCE_NOT_FOUND: -32002,
  /** Prompt 未找到 */
  PROMPT_NOT_FOUND: -32003,
  /** Server 未找到 */
  SERVER_NOT_FOUND: -32004,
  /** 工具执行失败 */
  TOOL_EXECUTION_ERROR: -32005,
  /** 参数校验失败 */
  INVALID_PARAMS: -32602,
  /** 内部错误 */
  INTERNAL_ERROR: -32603,
} as const

// ============================================================
// Sampling（Server→LLM 反向调用）
// ============================================================

/** Sampling 请求参数 */
export interface SamplingRequest {
  messages: PromptMessage[]
  modelPreferences?: {
    hints?: Array<{ name?: string }>
    costPriority?: number
    speedPriority?: number
    intelligencePriority?: number
  }
  systemPrompt?: string
  maxTokens: number
  temperature?: number
  stopSequences?: string[]
}

/** Sampling 响应 */
export interface SamplingResponse {
  model: string
  role: 'assistant'
  content: { type: 'text'; text: string }
  stopReason?: string
}

// ============================================================
// Notification（事件推送）
// ============================================================

/** 通知方法名 */
export type NotificationMethod =
  | 'notifications/initialized'
  | 'notifications/cancelled'
  | 'notifications/progress'
  | 'notifications/roots/list_changed'
  | 'notifications/tools/list_changed'
  | 'notifications/resources/list_changed'
  | 'notifications/prompts/list_changed'

/** 通知载荷 */
export interface NotificationPayload {
  method: NotificationMethod
  params?: Record<string, unknown>
}

/** 进度通知 */
export interface ProgressNotification {
  progressToken: string
  progress: number
  total?: number
  message?: string
}

// ============================================================
// Roots（目录范围控制）
// ============================================================

export interface RootDescriptor {
  uri: string
  name?: string
}

export interface ListRootsResult {
  roots: RootDescriptor[]
}

// ============================================================
// Elicitation（交互式用户输入请求）
// ============================================================

export interface ElicitationRequest {
  message: string
  inputSchema?: JSONSchema
  timeout?: number
}

export interface ElicitationResponse {
  action: 'accept' | 'decline' | 'cancel'
  content?: { type: 'text'; text: string }
}

// ============================================================
// Completions（自动补全）
// ============================================================

export interface CompletionRequest {
  ref: {
    type: 'ref/resource' | 'ref/prompt'
    uri?: string
    name?: string
  }
  argument: {
    name: string
    value: string
  }
}

export interface CompletionResponse {
  values: string[]
  total?: number
  hasMore?: boolean
}

// ============================================================
// MCP Server Dashboard（管理 UI）
// ============================================================

export interface MCPServerDashboardEntry {
  serverName: string
  version: string
  description: string
  priority: 'high' | 'medium' | 'low'
  enabled: boolean
  toolCount: number
  resourceCount: number
  promptCount: number
  registeredAt: number
  dependencies: string[]
}