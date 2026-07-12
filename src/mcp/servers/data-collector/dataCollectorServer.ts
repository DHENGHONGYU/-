/**
 * @module mcp/servers/data-collector
 * @description 数据采集 MCP Server — 行情数据获取、缺失报告检测
 * @created 2026-07-05
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
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
          // TODO[阻塞·#7]: MarketDataAdapter 仅有 adapt/merge，fetchMarketData 未实现；待接真实数据源（AKShare/HTTP）后补全。
          return { content: [{ type: 'text', text: JSON.stringify({ symbol, days, data: [], note: 'fetchMarketData 尚未实现' }) }] }
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
        handler: async (args) => {
          const traceSpans = (args.traceSpans as Record<string, unknown>) ?? {}
          const taskStatuses = (args.taskStatuses as Record<string, unknown>) ?? {}
          logger.info('[DataCollectorServer] build_collection_report called', {
            spanCount: Object.keys(traceSpans).length,
            taskCount: Object.keys(taskStatuses).length,
          })
          const report = buildCollectionReport(traceSpans as never, taskStatuses as never)
          return { content: [{ type: 'text', text: JSON.stringify(report) }] }
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
          const result = symbol && symbol.trim() ? await listBySymbol(symbol) : await listUnresolved()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }
}
