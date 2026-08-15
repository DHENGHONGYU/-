/**
 * @module mcp/servers/data-collector
 * @description 数据采集 MCP Server — 行情数据获取、缺失报告检测
 * @created 2026-07-05
  * @doc [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-021, V9-DOC-AI-022]
*/

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { listUnresolved, listBySymbol } from '@/services/data-collector/missingReportDetector'
import { buildCollectionReport } from '@/services/data-collector/collectionReportService'

const logger = getLogger()

export class DataCollectorServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'data-collector',
    version: '1.0.0',
    description: '数据采集 — 行情数据获取、缺失报告检测',
    dependencies: ['fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'fetch_market_data',
        description: '获取指定股票的行情数据',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            days: { type: 'number', description: '回溯天数，默认 30', default: 30 },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          const days = (args.days as number) ?? 30
          logger.info('[DataCollectorServer] fetch_market_data called', { symbol, days })
          // 技术方案 §5.4：取消 TODO 桩，改为经 MCP 调用腾讯自选股 westock_kline 实采历史行情。
          // 注意 K 线有延迟（非实时），实时盘口仍由 Tencent/Sina 直连承担。
          // 失败时降级返回空 data（不抛错），由调用方决定后续兜底。
          try {
            const result = await mcpBridge.callTool(
              'marketdata:westock',
              'westock_kline',
              { codes: symbol, period: 'day', limit: days },
              { caller: 'system' },
            )
            if (result.isError) {
              logger.warn('[DataCollectorServer] fetch_market_data westock 失败，降级空数据', { text: result.content[0]?.text })
              return {
                content: [{ type: 'text', text: JSON.stringify({ symbol, days, data: [], source: 'westock', note: 'westock 返回错误', error: result.content[0]?.text }) }],
              }
            }
            const text = result.content[0]?.text ?? '{}'
            const data = JSON.parse((text as string) || '{}')
            return {
              content: [{ type: 'text', text: JSON.stringify({ symbol, days, data, source: 'westock' }) }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            logger.warn('[DataCollectorServer] fetch_market_data 异常，降级空数据', { error: msg })
            return {
              content: [{ type: 'text', text: JSON.stringify({ symbol, days, data: [], source: 'westock', note: 'westock 异常', error: msg }) }],
            }
          }
        },
      },
      {
        name: 'build_collection_report',
        description: '根据 traceSpans 与 taskStatuses 聚合生成采集报告',
        inputSchema: {
          type: 'object',
          properties: {
            traceSpans: {
              type: 'object',
              description: 'traceId -> CollectionTraceSpan 的运行时链路映射',
            },
            taskStatuses: {
              type: 'object',
              description: 'taskId -> CollectionTaskRuntime 的任务状态映射',
            },
          },
          required: ['traceSpans', 'taskStatuses'],
        },
        handler: (args) => {
          const traceSpans = (args.traceSpans as Record<string, unknown>) ?? {}
          const taskStatuses = (args.taskStatuses as Record<string, unknown>) ?? {}
          logger.info('[DataCollectorServer] build_collection_report called', {
            spanCount: Object.keys(traceSpans).length,
            taskCount: Object.keys(taskStatuses).length,
          })
          const report = buildCollectionReport(traceSpans as never, taskStatuses as never)
          return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(report) }] })
        },
      },
      {
        name: 'detect_missing_reports',
        description: '检测缺失的数据报告',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码（可选，不填则检测全部）' },
          },
        },
        handler: async (args) => {
          const symbol = args.symbol as string | undefined
          logger.info('[DataCollectorServer] detect_missing_reports called', { symbol })
          const result = symbol?.trim() ? await listBySymbol(symbol) : await listUnresolved()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }
}
