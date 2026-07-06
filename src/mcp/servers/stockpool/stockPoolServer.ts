/**
 * @module mcp/servers/stockpool
 * @description 股票池管理 MCP Server — 研究状态流转、分组管理
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { listStocks, transitionStock, getStocksByStatus, getPoolGroups } from '@/services/stockpool/stockpoolService'
import type { ResearchStatus } from '@/config/dbConfig'

const logger = getLogger()

const VALID_STATUSES: ResearchStatus[] = ['candidate', 'screened', 'deepDive', 'watching', 'archived']

function parseStatus(raw: string): ResearchStatus | null {
  const status = raw.trim().toLowerCase() as ResearchStatus
  return VALID_STATUSES.includes(status) ? status : null
}

export class StockPoolServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'stockpool',
    version: '1.0.0',
    description: '股票池管理 — 研究状态流转、分组管理、标的筛选',
    dependencies: ['fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'list_pool_stocks',
        description: '列出股票池中所有标的',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: '按研究状态筛选: candidate/screened/deepDive/watching/archived' },
          },
          required: [],
        },
        handler: async (args) => {
          const rawStatus = args.status as string | undefined
          const status = rawStatus ? parseStatus(rawStatus) : null
          logger.info('[StockPoolServer] list_pool_stocks called', { status })
          const result = status ? await getStocksByStatus(status) : await listStocks()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'transition_stock',
        description: '变更股票研究状态',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            toStatus: { type: 'string', description: '目标状态: candidate/screened/deepDive/watching/archived' },
          },
          required: ['symbol', 'toStatus'],
        },
        handler: async (args) => {
          const status = parseStatus(args.toStatus as string)
          if (!status) {
            return {
              content: [{ type: 'text', text: `无效的研究状态: ${String(args.toStatus)}，有效值为: ${VALID_STATUSES.join(', ')}` }],
              isError: true,
            }
          }
          logger.info('[StockPoolServer] transition_stock called', { symbol: args.symbol as string, toStatus: status })
          const result = await transitionStock(args.symbol as string, status)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'list_groups',
        description: '列出所有股票池分组',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[StockPoolServer] list_groups called')
          const result = await getPoolGroups()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'stockpool://stocks',
        name: '全部标的列表',
        description: '股票池中所有标的',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const result = await listStocks()
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
      {
        uriTemplate: 'stockpool://groups',
        name: '分组列表',
        description: '所有股票池分组',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const result = await getPoolGroups()
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
    ]
  }
}