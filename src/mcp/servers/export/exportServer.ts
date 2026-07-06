/**
 * @module mcp/servers/export
 * @description 数据导出 MCP Server — 回测报告导出
 * @created 2026-07-05
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import { exportBacktestReport } from '@/services/export/backtestExportService'
import type { BacktestResult, BacktestConfig } from '@/types/modules/backtest.types'

const logger = getLogger()

export class ExportServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'export',
    version: '1.0.0',
    description: '数据导出 — 回测报告导出（PDF/Excel）',
    dependencies: ['backtest'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'export_backtest_report',
        description: '导出回测报告（PDF 或 Excel）',
        inputSchema: {
          type: 'object',
          properties: {
            resultId: { type: 'string', description: '回测结果 ID' },
            format: { type: 'string', enum: ['pdf', 'excel'], description: '导出格式' },
          },
          required: ['resultId', 'format'],
        },
        handler: async (args) => {
          const resultId = args.resultId as string
          const format = args.format as 'pdf' | 'excel'
          logger.info('[ExportServer] export_backtest_report called', { resultId, format })
          // TODO: 需根据 resultId 从 Store 查询完整 BacktestResult 和 BacktestConfig
          const stubResult = { resultId } as unknown as BacktestResult
          const stubConfig = {} as unknown as BacktestConfig
          const result = await exportBacktestReport(stubResult, stubConfig, { format })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }
}
