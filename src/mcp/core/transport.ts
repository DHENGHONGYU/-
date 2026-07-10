/**
 * MCP 传输层 —— 进程内零拷贝传输实现
 *
 * @description
 * 同进程内的 MCP Server 调用使用 InProcessTransport，直接传递引用而非序列化，
 * 确保性能不退化。未来扩展跨进程调用时，可新增 JSONRPCTransport 实现。
 *
 * @module mcp/core/transport
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import type { MCPTransport, MCPServer, NotificationMethod, SamplingRequest, McpCallerContext } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** Transport 层调用方上下文 —— 协议适配层属于系统内部调用 */
const TRANSPORT_CALLER_CONTEXT: McpCallerContext = {
  caller: 'system',
  callerId: 'InProcessTransport',
}

/**
 * 校验工具调用/提示模板请求是否包含 name 参数。
 * 抽成断言函数，避免 sendRequest 内重复 if 条件。
 */
function assertNameParam(params?: Record<string, unknown>): asserts params is { name: string; arguments?: Record<string, unknown> } {
  if (!params || typeof params.name !== 'string') {
    throw new Error('Missing required param: name')
  }
}

/** 进程内传输 —— 零拷贝，直接调用 Server 方法 */
export class InProcessTransport implements MCPTransport {
  private server: MCPServer
  private closed = false

  constructor(server: MCPServer) {
    this.server = server
    logger.info(`[InProcessTransport] created for server: ${server.info.name}`)
  }

  async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.closed) {
      throw new Error('Transport is closed')
    }

    const startTime = performance.now()

    switch (method) {
      case 'tools/list': {
        const tools = this.server.listTools()
        logger.info(`[InProcessTransport] tools/list returned ${tools.length} tools`)
        return { tools }
      }

      case 'tools/call': {
        assertNameParam(params)
        const args = (params.arguments as Record<string, unknown>) ?? {}
        const result = await this.server.callTool(params.name, args, TRANSPORT_CALLER_CONTEXT)
        const duration = performance.now() - startTime
        logger.info(`[InProcessTransport] tools/call ${params.name} completed in ${Math.round(duration)}ms`)
        return result
      }

      case 'resources/list': {
        const resources = this.server.listResources()
        return { resources }
      }

      case 'resources/read': {
        if (!params || typeof params.uri !== 'string') {
          throw new Error('Missing required param: uri')
        }
        return await this.server.readResource(params.uri, TRANSPORT_CALLER_CONTEXT)
      }

      case 'prompts/list': {
        const prompts = this.server.listPrompts()
        return { prompts }
      }

      case 'prompts/get': {
        assertNameParam(params)
        const args = (params.arguments as Record<string, string>) ?? {}
        return {
          messages: await this.server.getPrompt(params.name, args, TRANSPORT_CALLER_CONTEXT),
        }
      }

      case 'roots/list': {
        const { rootsManager: rm } = await import('./roots')
        return rm.listRoots()
      }

      case 'elicitation/request': {
        if (!params || typeof params.message !== 'string') {
          throw new Error('Missing required param: message')
        }
        const { elicitationManager: em } = await import('./elicitation')
        return em.request(params as unknown as import('@/types/modules/mcp.types').ElicitationRequest)
      }

      case 'sampling/createMessage': {
        const { samplingHandler } = await import('./sampling')
        return samplingHandler.createMessage(params as unknown as SamplingRequest)
      }

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    const { notificationManager: nm } = await import('./notification')
    nm.emit(method as NotificationMethod, params)
  }

  close(): void {
    this.closed = true
    logger.info(`[InProcessTransport] closed for server: ${this.server.info.name}`)
  }
}