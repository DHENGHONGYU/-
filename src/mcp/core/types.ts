/**
 * MCP 核心类型重导出
 *
 * @description
 * 从 src/types/modules/mcp.types.ts 重导出所有 MCP 类型，
 * 作为 mcp/core 模块的统一类型入口。
 *
 * @module mcp/core/types
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

export type {
  JSONSchema,
  JSONSchemaProperty,
  ServerInfo,
  ToolDescriptor,
  ToolContentBlock,
  ToolResult,
  ResourceTemplate,
  ResourceContent,
  PromptArgument,
  PromptMessage,
  PromptTemplate,
  MCPServer,
  MCPClient,
  ServerRegistrationOptions,
  RegisteredServer,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPTransport,
  McpCallerRole,
  McpCallerContext,
} from '@/types/modules/mcp.types'

export { MCP_ERROR_CODES } from '@/types/modules/mcp.types'