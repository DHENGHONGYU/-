/**
 * @module mcp/servers/analysis
 * @description 分析引擎 MCP Server — 暴露个股分析、板块分析、筛选等工具
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { listStocks, listV6Scores } from '@/services/analysis/analysisService'
import { calculateAndSaveDefaultRotationScores } from '@/services/analysis/sectorAnalysisEngine'
import { runScreening } from '@/services/analysis/screeningEngine'
import { runFullIndustryAnalysisEnhanced } from '@/services/analysis/industryAnalysisService'
import { generateRotationSignals } from '@/services/analysis/industryV4Analyzer'

const logger = getLogger()

export class AnalysisServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'analysis',
    version: '1.0.0',
    description: '分析引擎 — 个股分析、板块分析、股票筛选',
    dependencies: ['scoring:v6', 'fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'analyze_stock',
        description: '查询个股 V6 评分及基本信息',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码，如 000001' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info('[AnalysisServer] analyze_stock called', { symbol })
          const [stocksResult, scoresResult] = await Promise.all([
            listStocks(),
            listV6Scores(),
          ])
          const stock = stocksResult.success && stocksResult.data
            ? stocksResult.data.find((s) => s.symbol === symbol)
            : null
          const scores = scoresResult.success && scoresResult.data
            ? scoresResult.data.filter((s) => s.symbol === symbol)
            : []
          const result = {
            symbol,
            stock,
            scores,
            scoreCount: scores.length,
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }
        },
      },
      {
        name: 'analyze_sector',
        description: '执行行业/板块轮动分析',
        inputSchema: {
          type: 'object',
          properties: {
            scoreDate: { type: 'string', description: '评分日期 (YYYY-MM-DD)，默认今天' },
          },
          required: [],
        },
        handler: async (args) => {
          logger.info('[AnalysisServer] analyze_sector called', {
            scoreDate: args.scoreDate as string | undefined,
          })
          const result = await calculateAndSaveDefaultRotationScores(
            args.scoreDate as string | undefined,
          )
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }
        },
      },
      {
        name: 'screen_stocks',
        description: '按多因子条件筛选股票',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: '返回数量上限', default: 20 },
          },
          required: [],
        },
        handler: async (_args) => {
          logger.info('[AnalysisServer] screen_stocks called')
          const result = await runScreening()
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }
        },
      },
      {
        name: 'analyze_industry_v4',
        description: '增强版 V4 全量行业分析 + 轮动信号生成',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: '序列化的 stocksWithData JSON 数组' },
            hs300Pe: { type: 'number', description: '沪深300 PE' },
            hs300Pb: { type: 'number', description: '沪深300 PB' },
          },
          required: ['data'],
        },
        handler: async (args) => {
           
           
          const stocks = JSON.parse(args.data as string)

          const options: { forceRefresh?: boolean; hs300Pe?: number; hs300Pb?: number } = {}
          if (args.hs300Pe !== undefined) options.hs300Pe = args.hs300Pe as number
          if (args.hs300Pb !== undefined) options.hs300Pb = args.hs300Pb as number
          logger.info('[AnalysisServer] analyze_industry_v4 called', { stockCount: stocks.length })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const results = await runFullIndustryAnalysisEnhanced(stocks, options)
          const rotationSignals = generateRotationSignals(results.v4Analyses)
          return {
            content: [{ type: 'text', text: JSON.stringify({
              v4Analyses: results.v4Analyses,
              rotationSignals,
            }) }],
          }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'analysis://stock/{symbol}',
        name: '个股分析数据',
        description: '指定股票的 V6 评分及基本信息',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/').pop() ?? ''
          const [stocksResult, scoresResult] = await Promise.all([
            listStocks(),
            listV6Scores(),
          ])
          const stock = stocksResult.success && stocksResult.data
            ? stocksResult.data.find((s) => s.symbol === symbol)
            : null
          const scores = scoresResult.success && scoresResult.data
            ? scoresResult.data.filter((s) => s.symbol === symbol)
            : []
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ symbol, stock, scores }),
          }
        },
      },
      {
        uriTemplate: 'analysis://sector/{scoreDate}',
        name: '板块分析数据',
        description: '指定日期的板块轮动分析结果',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const scoreDate = uri.split('/').pop() ?? undefined
          const result = await calculateAndSaveDefaultRotationScores(scoreDate)
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
    ]
  }

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'stock_analysis',
        description: '个股分析报告生成模板',
        arguments: [
          { name: 'symbol', description: '股票代码', required: true },
        ],
        generator: (args) => {
          return Promise.resolve([{
            role: 'user',
            content: {
              type: 'text',
              text: `请对股票 ${args.symbol} 进行全面的投研分析，包括：评分概况、护城河评估、财务健康度、估值水平、情景推演、技术面筹码分析。`,
            },
          }])
        },
      },
    ]
  }
}