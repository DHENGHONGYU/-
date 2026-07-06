/**
 * @module mcp/servers/input
 * @description 数据录入 MCP Server — 股票添加、搜索、股票池导入导出
 * @created 2026-07-05
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import {
  addStock,
  addStockFromSearch,
  searchStocks,
  exportPool,
  importPool,
  listStocks,
} from '@/services/input/inputService'

const logger = getLogger()

export class InputServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'input',
    version: '1.0.0',
    description: '数据录入 — 股票添加、搜索、股票池导入导出',
    dependencies: ['fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'add_stock',
        description: '添加股票到股票池',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            name: { type: 'string', description: '股票名称' },
            poolId: { type: 'string', description: '目标股票池 ID（可选）' },
          },
          required: ['symbol', 'name'],
        },
        handler: async (args) => {
          logger.info('[InputServer] add_stock called', { symbol: args.symbol })
          const result = await addStock({
            symbol: args.symbol as string,
            name: args.name as string,
          })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'search_stocks',
        description: '搜索股票',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词（代码或名称）' },
          },
          required: ['query'],
        },
        handler: async (args) => {
          const query = args.query as string
          logger.info('[InputServer] search_stocks called', { query })
          const results = searchStocks(query)
          return { content: [{ type: 'text', text: JSON.stringify(results) }] }
        },
      },
      {
        name: 'add_stock_from_search',
        description: '从搜索结果添加股票',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info('[InputServer] add_stock_from_search called', { symbol })
          const matches = searchStocks(symbol)
          const match = matches.find((m) => m.symbol === symbol) ?? matches[0]
          if (!match) {
            return { content: [{ type: 'text', text: JSON.stringify({ error: `未找到股票: ${symbol}` }) }] }
          }
          const result = await addStockFromSearch(match)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'list_input_stocks',
        description: '列出已录入的股票',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[InputServer] list_input_stocks called')
          const result = await listStocks()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'export_stock_pool',
        description: '导出股票池（按研究状态筛选）',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: '研究状态（可选，如 candidate/analyzed/invested）' },
          },
        },
        handler: async (args) => {
          // TODO: exportPool 接受 ResearchStatus 筛选，非 poolId；当前忽略 poolId 导出全量
          logger.info('[InputServer] export_stock_pool called', { status: args.status })
          const result = await exportPool()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'import_stock_pool',
        description: '导入股票池',
        inputSchema: {
          type: 'object',
          properties: {
            payload: { type: 'object', description: '导入数据' },
          },
          required: ['payload'],
        },
        handler: async (args) => {
          logger.info('[InputServer] import_stock_pool called')
          const result = await importPool(args.payload as never)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }
}
