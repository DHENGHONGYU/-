/**
 * @module mcp/servers/data-collector
 * @description 数据采集 MCP Server — 行情数据获取、缺失报告检测
 * @created 2026-07-05
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import { listUnresolved, listBySymbol } from '@/services/data-collector/missingReportDetector'

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
          // TODO: MarketDataAdapter 尚未实现 fetchMarketData，当前返回占位响应
          return { content: [{ type: 'text', text: JSON.stringify({ symbol, days, data: [], note: 'fetchMarketData 尚未实现' }) }] }
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
