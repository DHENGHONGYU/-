import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { getLogger } from '@/lib/logger'
import type { MigrationReport, V6ExportShape, V9ImportShape } from '@/services/system/v6MigrationService'
import type { McpCallerContext } from '@/types/modules/mcp.types'

const logger = getLogger()

/** 系统迁移操作的调用方上下文 —— 迁移属于系统级操作，使用 system 角色 */
const MIGRATION_CALLER_CONTEXT: McpCallerContext = {
  caller: 'system',
  callerId: 'useMcpMigration',
}

interface McpMigrationApi {
  parseV6Export: (json: unknown) => Promise<V6ExportShape>
  transformV6ToV9: (v6Data: unknown) => Promise<V9ImportShape>
  importToV9: (data: unknown, options: { overwriteExisting?: boolean; dryRun?: boolean }) => Promise<MigrationReport>
  runV6Migration: (json: unknown, options: { overwriteExisting?: boolean }) => Promise<{ success: boolean; data?: MigrationReport; error?: string }>
  generateMigrationReport: (report: MigrationReport) => Promise<string>
  exportAll: () => Promise<{ success: boolean; data?: Record<string, unknown[]>; error?: string }>
}

export function useMcpMigration(): McpMigrationApi {
  const callMigrationTool = async <T>(toolName: string, args: Record<string, unknown>): Promise<T> => {
    const result = await mcpBridge.callTool('system', toolName, args, MIGRATION_CALLER_CONTEXT)
    
    if (result.isError) {
      const errorText = result.content[0]?.text ?? '未知错误'
      logger.error(`[useMcpMigration] ${toolName} failed`, { error: errorText })
      throw new Error(errorText)
    }

    try {
      const text = result.content[0]?.text ?? '{}'
      return JSON.parse(text) as T
    } catch {
      return result.content[0]?.text as unknown as T
    }
  }

  const parseV6Export = async (json: unknown): Promise<V6ExportShape> => {
    return callMigrationTool('parse_v6_export', { json })
  }

  const transformV6ToV9 = async (v6Data: unknown): Promise<V9ImportShape> => {
    return callMigrationTool('transform_v6_to_v9', { v6Data })
  }

  const importToV9 = async (
    data: unknown,
    options: { overwriteExisting?: boolean; dryRun?: boolean } = {},
  ): Promise<MigrationReport> => {
    return callMigrationTool('import_to_v9', {
      transformedData: data,
      overwriteExisting: options.overwriteExisting ?? false,
      dryRun: options.dryRun ?? false,
    })
  }

  const runV6Migration = async (
    json: unknown,
    options: { overwriteExisting?: boolean } = {},
  ): Promise<{ success: boolean; data?: MigrationReport; error?: string }> => {
    return callMigrationTool('run_v6_migration', {
      json,
      overwriteExisting: options.overwriteExisting ?? false,
    })
  }

  const generateMigrationReport = async (report: MigrationReport): Promise<string> => {
    const result = await mcpBridge.callTool('system', 'generate_migration_report', { migrationReport: report })
    if (result.isError) {
      const errorText = result.content[0]?.text ?? '未知错误'
      logger.error('[useMcpMigration] generate_migration_report failed', { error: errorText })
      throw new Error(errorText)
    }
    return result.content[0]?.text ?? ''
  }

  const exportAll = async (): Promise<{ success: boolean; data?: Record<string, unknown[]>; error?: string }> => {
    return callMigrationTool('export_data', {})
  }

  return {
    parseV6Export,
    transformV6ToV9,
    importToV9,
    runV6Migration,
    generateMigrationReport,
    exportAll,
  }
}