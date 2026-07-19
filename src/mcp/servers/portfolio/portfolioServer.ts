/**
 * @module mcp/servers/portfolio
 * @description 投资组合 MCP Server — 组合管理、持仓调整、主题筛选
 * @created 2026-07-04
  * @doc [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-022, V9-DOC-ARCH-022]
*/

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { addHolding, removeHolding, listByTheme } from '@/services/portfolio/portfolioService'

const logger = getLogger()

export class PortfolioServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'portfolio',
    version: '1.0.0',
    description: '投资组合管理 — 组合创建、持仓调整、主题筛选',
    dependencies: ['scoring:v6', 'trading'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'add_holding',
        description: '向投资组合添加持仓',
        inputSchema: {
          type: 'object',
          properties: {
            portfolioId: { type: 'string', description: '组合 ID' },
            symbol: { type: 'string', description: '股票代码' },
            name: { type: 'string', description: '股票名称' },
            targetWeight: { type: 'number', description: '目标权重 (0-1)', default: 0.1 },
          },
          required: ['portfolioId', 'symbol', 'name'],
        },
        handler: async (args) => {
          logger.info('[PortfolioServer] add_holding called', { portfolioId: args.portfolioId as string })
          const result = await addHolding(args.portfolioId as string, {
            symbol: args.symbol as string,
            name: args.name as string,
            currentShares: 0,
            currentWeight: 0,
            targetWeight: (args.targetWeight as number) ?? 0.1,
            targetShares: 0,
            price: 0,
            marketValue: 0,
            score: 0,
            rationale: '',
          })
          return { content: [{ type: 'text', text: JSON.stringify(result ?? {}) }] }
        },
      },
      {
        name: 'remove_holding',
        description: '从投资组合移除持仓',
        inputSchema: {
          type: 'object',
          properties: {
            portfolioId: { type: 'string', description: '组合 ID' },
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['portfolioId', 'symbol'],
        },
        handler: async (args) => {
          logger.info('[PortfolioServer] remove_holding called', { portfolioId: args.portfolioId as string })
          const result = await removeHolding(args.portfolioId as string, args.symbol as string)
          return { content: [{ type: 'text', text: JSON.stringify(result ?? {}) }] }
        },
      },
      {
        name: 'list_by_theme',
        description: '按主题筛选投资组合',
        inputSchema: {
          type: 'object',
          properties: {
            theme: { type: 'string', description: '主题名称' },
          },
          required: ['theme'],
        },
        handler: async (args) => {
          logger.info('[PortfolioServer] list_by_theme called', { theme: args.theme as string })
          const result = await listByTheme(args.theme as string)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'portfolio://theme/{theme}',
        name: '主题组合列表',
        description: '按主题筛选的投资组合',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const theme = uri.split('/').pop() ?? ''
          const result = await listByTheme(theme)
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
    ]
  }

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'portfolio_rebalance',
        description: '组合再平衡建议 Prompt',
        arguments: [{ name: 'portfolioId', description: '组合 ID', required: true }],
        generator: async (args) => {
          return [{
            role: 'user',
            content: {
              type: 'text',
              text: `请对投资组合 ${args.portfolioId} 进行再平衡分析，评估当前持仓权重是否合理，给出调整建议。`,
            },
          }]
        },
      },
    ]
  }
}