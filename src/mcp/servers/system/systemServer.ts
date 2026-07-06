/**
 * @module mcp/servers/system
 * @description 系统管理 MCP Server — 系统状态、数据导出、重置
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { loadSystemStats, resetAll, exportAll } from '@/services/system/systemService'

const logger = getLogger()

export class SystemServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'system',
    version: '1.0.0',
    description: '系统管理 — 状态监控、数据导出、系统重置',
    dependencies: [],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'get_stats',
        description: '获取系统统计数据',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[SystemServer] get_stats called')
          const result = await loadSystemStats()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'export_data',
        description: '导出全部数据',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[SystemServer] export_data called')
          const result = await exportAll()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'reset_system',
        description: '重置系统数据（危险操作）',
        inputSchema: {
          type: 'object',
          properties: {
            confirm: { type: 'boolean', description: '确认重置操作', default: false },
          },
          required: ['confirm'],
        },
        handler: async (args) => {
          if (!(args.confirm as boolean)) {
            return {
              content: [{ type: 'text', text: '请设置 confirm: true 确认重置操作' }],
              isError: true,
            }
          }
          logger.warn('[SystemServer] reset_system called — 系统重置中')
          const result = await resetAll()
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'system://stats',
        name: '系统统计',
        description: '当前系统统计数据',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const result = await loadSystemStats()
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
      {
        uriTemplate: 'system://export',
        name: '数据导出',
        description: '全部系统数据导出',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const result = await exportAll()
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
    ]
  }
}