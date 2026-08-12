/**
 * MCP 核心模块导出
 *
 * @module mcp/core
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-002, V9-DOC-AI-007, V9-DOC-AI-005, V9-DOC-PROJ-003]
*/

// 类型
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
} from './types'

export { MCP_ERROR_CODES } from './types'

// 核心类
export { MCPServerBase } from './server'
export { InProcessTransport } from './transport'
export { MCPClientImpl } from './client'
export { MCPRegistry, mcpRegistry } from './registry'
export { RootsManager, rootsManager } from './roots'
export { ElicitationManager, elicitationManager } from './elicitation'
export { ProgressTracker, progressTracker } from './progress'
export { CancellationManager, cancellationManager } from './cancellation'
export { MCPAuditLogger, mcpAuditLogger } from './mcpAuditLogger'
export type { MCPToolAuditRecord } from './mcpAuditLogger'