/**
 * @module mcp/servers/backtest
 * @description 回测引擎 MCP Server — 策略回测、绩效分析
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { BacktestEngine } from '@/services/backtest/BacktestEngine'
import type { BacktestStrategy } from '@/store/backtestStore'

const logger = getLogger()

const DEFAULT_BACKTEST_CONFIG = {
  initialCapital: 100000,
  commissionRate: 0.0003,
  slippage: 0.001,
  maxPositionPct: 0.3,
}

export class BacktestServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'backtest',
    version: '1.0.0',
    description: '回测引擎 — 策略回测、绩效分析、风险指标',
    dependencies: ['fetcher', 'scoring:v6'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'run_backtest',
        description: '执行策略回测',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            startDate: { type: 'string', description: '开始日期 (YYYY-MM-DD)' },
            endDate: { type: 'string', description: '结束日期 (YYYY-MM-DD)' },
            strategy: { type: 'string', description: '策略名称', default: 'v6_scoring' },
            initialCapital: { type: 'number', description: '初始资金', default: 100000 },
          },
          required: ['symbol', 'startDate', 'endDate'],
        },
        handler: async (args) => {
          logger.info('[BacktestServer] run_backtest called', { symbol: args.symbol as string })
          const engine = new BacktestEngine()
          const result = await engine.run({
            strategy: ((args.strategy as string) ?? 'composite') as BacktestStrategy,
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            initialCapital: (args.initialCapital as number) ?? DEFAULT_BACKTEST_CONFIG.initialCapital,
            commissionRate: DEFAULT_BACKTEST_CONFIG.commissionRate,
            slippage: DEFAULT_BACKTEST_CONFIG.slippage,
            maxPositionPct: DEFAULT_BACKTEST_CONFIG.maxPositionPct,
          })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'backtest://config',
        name: '回测默认配置',
        description: '回测引擎默认配置参数',
        mimeType: 'application/json',
        resolver: (uri) => {
          return Promise.resolve({ uri, mimeType: 'application/json', text: JSON.stringify(DEFAULT_BACKTEST_CONFIG) })
        },
      },
    ]
  }
}