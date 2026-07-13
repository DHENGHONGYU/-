/**
 * @module mcp/servers/pool
 * @description 股票池三分拆 MCP Server — intention / research / position 查询与流转
 * @created 2026-07-13
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import {
  listPoolItems,
  transitionPoolItem,
  getPoolGroups,
} from '@/services/pool/poolService'
import {
  POOL_TYPE,
  INTENTION_STATUS,
  RESEARCH_STATUS,
  POSITION_STATUS,
  type PoolType,
  type PoolStatus,
} from '@/constants/pool.constants'

const logger = getLogger()

const ALL_POOLS: PoolType[] = [POOL_TYPE.intention, POOL_TYPE.research, POOL_TYPE.position]

const VALID_STATUSES: PoolStatus[] = [
  ...Object.values(INTENTION_STATUS),
  ...Object.values(RESEARCH_STATUS),
  ...Object.values(POSITION_STATUS),
]

function parsePool(raw: string): PoolType | null {
  const pool = raw.trim().toLowerCase() as PoolType
  return ALL_POOLS.includes(pool) ? pool : null
}

function parseStatus(raw: string): PoolStatus | null {
  const status = raw.trim().toLowerCase() as PoolStatus
  return VALID_STATUSES.includes(status) ? status : null
}

export class PoolServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'pool',
    version: '2.0.0',
    description: '股票池三分拆管理 — intention/research/position 查询、状态流转、分组管理',
    dependencies: ['fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'list_pool_items',
        description: '列出股票池中所有标的；可指定池类型过滤',
        inputSchema: {
          type: 'object',
          properties: {
            pool: {
              type: 'string',
              description: '池类型: intention/research/position',
            },
          },
          required: [],
        },
        handler: async (args) => {
          const rawPool = args.pool as string | undefined
          const pool = rawPool ? parsePool(rawPool) : undefined
          if (rawPool && !pool) {
            return {
              content: [{ type: 'text', text: `无效的池类型: ${String(args.pool)}，有效值为: ${ALL_POOLS.join(', ')}` }],
              isError: true,
            }
          }
          logger.info('[PoolServer] list_pool_items called', { pool })
          const result = await listPoolItems(pool ?? undefined)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'transition_pool_item',
        description: '变更股票池标的状态（支持跨池流转）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            toPool: { type: 'string', description: '目标池: intention/research/position' },
            toStatus: { type: 'string', description: '目标状态' },
          },
          required: ['symbol', 'toPool', 'toStatus'],
        },
        handler: async (args) => {
          const pool = parsePool(args.toPool as string)
          if (!pool) {
            return {
              content: [{ type: 'text', text: `无效的池类型: ${String(args.toPool)}，有效值为: ${ALL_POOLS.join(', ')}` }],
              isError: true,
            }
          }
          const status = parseStatus(args.toStatus as string)
          if (!status) {
            return {
              content: [{ type: 'text', text: `无效的状态: ${String(args.toStatus)}，有效值为: ${VALID_STATUSES.join(', ')}` }],
              isError: true,
            }
          }
          logger.info('[PoolServer] transition_pool_item called', { symbol: args.symbol as string, toPool: pool, toStatus: status })
          const result = await transitionPoolItem(args.symbol as string, { pool, status, label: 'MCP 流转' })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'list_groups',
        description: '列出所有股票池分组',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[PoolServer] list_groups called')
          const result = await getPoolGroups()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'pool://items',
        name: '全部标的列表',
        description: '股票池中所有标的',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const result = await listPoolItems()
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
      {
        uriTemplate: 'pool://groups',
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
