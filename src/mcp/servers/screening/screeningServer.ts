/**
 * @module mcp/servers/screening
 * @description 多因子筛选 MCP Server — 股票筛选、条件组合
 * @created 2026-07-04
  * @doc [V9-DOC-BACK-004, V9-DOC-ARCH-007, V9-DOC-AI-007, V9-DOC-DATA-011, V9-DOC-AI-005]
*/

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { runScreening, screenSingleStock } from '@/services/analysis/screeningEngine'

const logger = getLogger()

export class ScreeningServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'screening',
    version: '1.0.0',
    description: '多因子筛选 — 股票筛选、条件组合、单股评估',
    dependencies: ['fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'run_screening',
        description: '执行全量多因子筛选',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: '返回数量上限', default: 20 },
          },
          required: [],
        },
        handler: async (_args) => {
          logger.info('[ScreeningServer] run_screening called')
          const result = await runScreening()
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }
        },
      },
      {
        name: 'screen_single',
        description: '对单只股票执行多因子筛选评估',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = typeof args.symbol === 'string' ? args.symbol.trim() : ''
          if (!symbol) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'symbol 参数不能为空' }) }],
            }
          }
          logger.info('[ScreeningServer] screen_single called', { symbol })
          const result = await screenSingleStock(symbol)
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'screening://stock/{symbol}',
        name: '单股筛选评估',
        description: '指定股票的多因子筛选评估结果',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/').pop() ?? ''
          const result = await screenSingleStock(symbol)
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
      {
        uriTemplate: 'screening://all',
        name: '全量筛选结果',
        description: '最新全量多因子筛选结果',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const result = await runScreening()
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
    ]
  }
}