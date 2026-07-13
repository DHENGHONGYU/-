/**
 * @module mcp/servers/system
 * @description 系统管理 MCP Server — 系统状态、数据导出、重置
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { loadSystemStats, resetAll, exportAll } from '@/services/system/systemService'
import { fetchHealthReport } from '@/services/system/healthDashboardService'
import {
  parseV6Export,
  transformV6ToV9,
  importToV9,
  runV6Migration,
  generateMigrationReport,
} from '@/services/system/v6MigrationService'

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
      {
        name: 'parse_v6_export',
        description: '解析 V6 Pro 导出的 JSON 数据',
        inputSchema: {
          type: 'object',
          properties: {
            json: { type: 'object', description: 'V6 导出的 JSON 数据' },
          },
          required: ['json'],
        },
        handler: async (args) => {
          logger.info('[SystemServer] parse_v6_export called')
          try {
            const v6 = parseV6Export(args.json)
            return { content: [{ type: 'text', text: JSON.stringify(v6) }] }
          } catch (err) {
            return {
              content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            }
          }
        },
      },
      {
        name: 'transform_v6_to_v9',
        description: '将 V6 数据转换为 V9 格式',
        inputSchema: {
          type: 'object',
          properties: {
            v6Data: { type: 'object', description: '已解析的 V6 数据' },
          },
          required: ['v6Data'],
        },
        handler: async (args) => {
          logger.info('[SystemServer] transform_v6_to_v9 called')
          try {
            const v9 = transformV6ToV9(args.v6Data as never)
            return { content: [{ type: 'text', text: JSON.stringify(v9) }] }
          } catch (err) {
            return {
              content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            }
          }
        },
      },
      {
        name: 'import_to_v9',
        description: '将转换后的 V9 数据导入系统',
        inputSchema: {
          type: 'object',
          properties: {
            transformedData: { type: 'object', description: '转换后的 V9 数据' },
            overwriteExisting: { type: 'boolean', description: '是否覆盖已存在数据', default: false },
            dryRun: { type: 'boolean', description: '是否仅预览不实际导入', default: false },
          },
          required: ['transformedData'],
        },
        handler: async (args) => {
          logger.info('[SystemServer] import_to_v9 called', {
            overwriteExisting: args.overwriteExisting,
            dryRun: args.dryRun,
          })
          try {
            const result = await importToV9(args.transformedData as never, {
              overwriteExisting: args.overwriteExisting as boolean,
              dryRun: args.dryRun as boolean,
            })
            return { content: [{ type: 'text', text: JSON.stringify(result) }] }
          } catch (err) {
            return {
              content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            }
          }
        },
      },
      {
        name: 'run_v6_migration',
        description: '一键执行 V6 → V9 完整迁移流程（解析+验证+转换+导入）',
        inputSchema: {
          type: 'object',
          properties: {
            json: { type: 'object', description: 'V6 导出的 JSON 数据' },
            overwriteExisting: { type: 'boolean', description: '是否覆盖已存在数据', default: false },
          },
          required: ['json'],
        },
        handler: async (args) => {
          logger.info('[SystemServer] run_v6_migration called', {
            overwriteExisting: args.overwriteExisting,
          })
          const result = await runV6Migration(args.json, {
            overwriteExisting: args.overwriteExisting as boolean,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'generate_migration_report',
        description: '生成迁移结果文本报告',
        inputSchema: {
          type: 'object',
          properties: {
            migrationReport: { type: 'object', description: '迁移结果报告数据' },
          },
          required: ['migrationReport'],
        },
        handler: async (args) => {
          logger.info('[SystemServer] generate_migration_report called')
          try {
            const report = generateMigrationReport(args.migrationReport as never)
            return { content: [{ type: 'text', text: report }] }
          } catch (err) {
            return {
              content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            }
          }
        },
      },
      {
        name: 'fetch_health_report',
        description: '获取架构健康度报告（public/health-report.json）',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[SystemServer] fetch_health_report called')
          try {
            const report = await fetchHealthReport()
            return { content: [{ type: 'text', text: JSON.stringify(report) }] }
          } catch (err) {
            return {
              content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            }
          }
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