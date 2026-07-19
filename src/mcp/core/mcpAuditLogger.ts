/**
 * MCPAuditLogger — MCP Tool 调用审计日志模块
 *
 * @description
 * 记录所有 MCP Tool 调用的审计信息，包括调用时间、工具名称、参数、结果、耗时。
 * 通过 DataBridge.forward() 将审计日志以信封协议写入 executionLogs 存储，
 * 实现 MCP 层与 DataBridge 统一审计入口的集成。
 *
 * @module mcp/core/mcpAuditLogger
 * @created 2026-07-05 - 批次F MCP-DataBridge 集成
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-002, V9-DOC-AI-007, V9-DOC-AI-005, V9-DOC-PROJ-003]
*/

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { generateId } from '@/lib/utils'
import type { ToolResult } from '@/mcp/core/types'

const logger = getLogger()

/**
 * MCP Tool 调用审计记录
 */
export interface MCPToolAuditRecord {
  /** 唯一标识 */
  id: string
  /** 调用时间戳（ms） */
  timestamp: number
  /** MCP Server 名称 */
  serverName: string
  /** Tool 名称 */
  toolName: string
  /** 调用参数 */
  args: Record<string, unknown>
  /** 调用结果摘要（截取前 500 字符） */
  resultSummary: string
  /** 是否出错 */
  isError: boolean
  /** 耗时（ms） */
  durationMs: number
  /** 追踪 ID */
  traceId: string
}

/**
 * MCP 审计日志管理器
 *
 * 负责将所有 MCP Tool 调用记录为审计日志，
 * 通过 DataBridge.forward() 信封协议写入 executionLogs 存储。
 */
export class MCPAuditLogger {
  private static instance: MCPAuditLogger | null = null

  private constructor() {
    logger.info('[MCPAuditLogger] initialized')
  }

  /** 获取 MCPAuditLogger 单例 */
  static getInstance(): MCPAuditLogger {
    MCPAuditLogger.instance ??= new MCPAuditLogger()
    return MCPAuditLogger.instance
  }

  /**
   * 记录一次 MCP Tool 调用的审计日志。
   *
   * 将审计记录封装入 StandardEnvelope，通过 DataBridge.forward() 写入 executionLogs。
   * 写入失败时仅记录错误日志，不抛出异常（审计日志不应阻断主流程）。
   *
   * @param serverName - MCP Server 名称
   * @param toolName - Tool 名称
   * @param args - 调用参数
   * @param result - 调用结果
   * @param traceId - 追踪 ID
   * @param durationMs - 耗时（ms）
   */
  async logToolCall(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    result: ToolResult,
    traceId: string,
    durationMs: number,
  ): Promise<void> {
    const auditStartTime = performance.now()

    try {
      const now = Date.now()
      const resultText = result.content
        .map((c) => c.text ?? '')
        .join('\n')
      const resultSummary = resultText.length > 500
        ? resultText.slice(0, 500) + '...'
        : resultText

      const auditRecord: MCPToolAuditRecord = {
        id: generateId(),
        timestamp: now,
        serverName,
        toolName,
        args,
        resultSummary,
        isError: result.isError ?? false,
        durationMs,
        traceId,
      }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.system,
          target: ENVELOPE_TARGET.executionLogs,
          action: ENVELOPE_ACTION.saveExecutionLog,
          traceId,
        },
        auditRecord,
      )

      await dataBridge.forward(envelope)

      const auditDuration = performance.now() - auditStartTime
      logger.info(`[MCPAuditLogger] audit log forwarded: ${serverName}/${toolName}`, {
        traceId,
        durationMs,
        isError: result.isError,
        auditWriteMs: Math.round(auditDuration),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[MCPAuditLogger] failed to forward audit log', {
        error: message,
        serverName,
        toolName,
        traceId,
      })
    }
  }
}

/** 全局 MCPAuditLogger 单例 */
export const mcpAuditLogger = MCPAuditLogger.getInstance()
