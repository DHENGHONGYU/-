/**
 * MCP 模块顶层导出
 *
 * @module mcp
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

export {
  MCPServerBase,
  InProcessTransport,
  MCPClientImpl,
  MCPRegistry,
  mcpRegistry,
  MCP_ERROR_CODES,
} from './core'

export { MCPBridge, mcpBridge } from './bridge'

export type {
  MCPServer,
  MCPClient,
  ToolDescriptor,
  ToolResult,
  ResourceTemplate,
  ResourceContent,
  PromptTemplate,
  PromptMessage,
  ServerInfo,
  ServerRegistrationOptions,
  RegisteredServer,
} from './core'