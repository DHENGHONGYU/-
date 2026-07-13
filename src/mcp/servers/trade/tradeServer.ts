/**
 * @module mcp/servers/trade
 * @description 持仓管理 MCP Server — 持仓查询、交易操作、持仓导出
 * @created 2026-07-05
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import {
  fetchHoldings,
  executeTradeAction,
  exportHoldingsCSV,
} from '@/services/trade/holdingsService'
import type { HoldingsQueryParams, TradeActionRequest } from '@/types/modules/trade.types'

const logger = getLogger()

export class TradeServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'trade',
    version: '1.0.0',
    description: '持仓管理 — 持仓查询、交易操作、持仓导出',
    dependencies: ['trading'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'fetch_holdings',
        description: '查询持仓列表（分页）',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页条数，默认 20' },
            startDate: { type: 'string', description: '开始日期（ISO 格式）' },
            endDate: { type: 'string', description: '结束日期（ISO 格式）' },
            direction: { type: 'string', description: '交易方向' },
            keyword: { type: 'string', description: '搜索关键词' },
          },
        },
        handler: async (args) => {
          logger.info('[TradeServer] fetch_holdings called', {
            accountType: args.accountType,
            symbol: args.symbol,
          })
          const queryParams: HoldingsQueryParams = {
            page: 1,
            pageSize: 50,
            startDate: '',
            endDate: '',
            direction: 'ALL',
            keyword: (args.symbol as string) ?? '',
          }
          const result = await fetchHoldings(queryParams)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'execute_trade_action',
        description: '执行交易操作（买入/卖出）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            action: { type: 'string', enum: ['buy', 'sell'], description: '交易动作' },
            quantity: { type: 'number', description: '交易数量' },
            price: { type: 'number', description: '交易价格' },
          },
          required: ['symbol', 'action', 'quantity', 'price'],
        },
        handler: async (args) => {
          logger.info('[TradeServer] execute_trade_action called', {
            symbol: args.symbol,
            action: args.action,
          })
          const tradeReq: TradeActionRequest = {
            code: args.symbol as string,
            action: (args.action === 'buy' ? 'ADD_POSITION' : 'CLOSE_POSITION'),
            quantity: args.quantity as number,
          }
          const result = await executeTradeAction(tradeReq)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'export_holdings_csv',
        description: '导出持仓为 CSV 文件',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页条数，默认 20' },
            startDate: { type: 'string', description: '开始日期（ISO 格式）' },
            endDate: { type: 'string', description: '结束日期（ISO 格式）' },
            direction: { type: 'string', description: '交易方向' },
            keyword: { type: 'string', description: '搜索关键词' },
          },
        },
        handler: async (args) => {
          logger.info('[TradeServer] export_holdings_csv called', {
            accountType: args.accountType,
          })
          const exportParams: HoldingsQueryParams = {
            page: 1,
            pageSize: 9999,
            startDate: '',
            endDate: '',
            direction: 'ALL',
            keyword: '',
          }
          await exportHoldingsCSV(exportParams)
          return { content: [{ type: 'text', text: 'CSV 导出完成' }] }
        },
      },
    ]
  }
}
