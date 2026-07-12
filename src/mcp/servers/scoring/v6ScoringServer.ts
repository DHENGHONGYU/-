/**
 * V6ScoringServer — V6 分层递进式个股评分引擎 MCP Server
 *
 * @description
 * 封装 V6 评分引擎（L-1 到 L8 共 11 层计算器）、热门板块分析、轮动信号检测、
 * 价值洼地分析等核心评分能力，通过 MCP Tool/Resource/Prompt 接口暴露。
 *
 * @module mcp/servers/scoring/v6ScoringServer
 * @created 2026-07-04 - Phase 1 MCP 核心业务 Server 迁移
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { runV6Score, getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { analyzeBySymbol as analyzeHotSector } from '@/services/scoring/hotSectorAnalyzer'
import { detectBySector as detectRotation } from '@/services/scoring/rotationSignalDetector'
import { analyzeBySymbol as analyzeValuePit } from '@/services/scoring/valuePitAnalyzer'
import { createV6Engine } from '@/services/scoring/v6-engine'
import type { CompositeScore } from '@/services/scoring/v6-engine'

const logger = getLogger()

export class V6ScoringServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'scoring:v6',
    version: '1.0.0',
    description: 'V6 分层递进式个股评分引擎（L-1 到 L8 共 11 层计算器），含热门板块分析、轮动信号检测、价值洼地分析',
    dependencies: ['fetcher'],
  }

  // ============================================================
  // Tool 定义
  // ============================================================

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'score_stock',
        description: '对指定股票运行 V6 九维评分，返回 L-1 到 L8 各层评分及综合得分。评分维度：行业评分(L-1)、宏观STEEP(L0)、护城河(L1)、竞品(L2)、财务健康(L3a)、估值水平(L3v)、情景推演(L4)、T-M矩阵(L5)、Hype周期(L6)、第二曲线(L7)、技术筹码(L8)',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码，如 000001, AAPL' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info(`[scoring:v6] score_stock: ${symbol}`)
          const result = await runV6Score(symbol)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'get_all_scores',
        description: '获取所有已评分股票的 V6 评分数据',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[scoring:v6] get_all_scores')
          const result = await getAllV6Scores()
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        },
      },
      {
        name: 'get_engine_config',
        description: '获取 V6 评分引擎的当前配置（权重、阈值、行业基准、IPC 参数等）',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          const engine = createV6Engine()
          const config = engine.getConfig()
          return {
            content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
          }
        },
      },
      {
        name: 'analyze_hot_sector',
        description: '对指定股票进行热门板块分析，返回板块热度评分',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info(`[scoring:v6] analyze_hot_sector: ${symbol}`)
          const result = await analyzeHotSector(symbol)
          return {
            content: [{ type: 'text', text: JSON.stringify(result ?? { error: 'No data' }, null, 2) }],
          }
        },
      },
      {
        name: 'detect_rotation',
        description: '对指定板块进行轮动信号检测，返回触发条件与信号强度',
        inputSchema: {
          type: 'object',
          properties: {
            sectorId: { type: 'string', description: '板块 ID' },
          },
          required: ['sectorId'],
        },
        handler: async (args) => {
          const sectorId = args.sectorId as string
          logger.info(`[scoring:v6] detect_rotation: ${sectorId}`)
          const result = await detectRotation(sectorId)
          return {
            content: [{ type: 'text', text: JSON.stringify(result ?? { error: 'No data' }, null, 2) }],
          }
        },
      },
      {
        name: 'analyze_value_pit',
        description: '对指定股票进行价值洼地分析，返回催化剂、估值安全边际、筹码结构、轮动位置、流动性评分',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info(`[scoring:v6] analyze_value_pit: ${symbol}`)
          const result = await analyzeValuePit(symbol)
          return {
            content: [{ type: 'text', text: JSON.stringify(result ?? { error: 'No data' }, null, 2) }],
          }
        },
      },
    ]
  }

  // ============================================================
  // Resource 模板
  // ============================================================

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'scores://{symbol}/v6',
        name: 'v6_score',
        description: '指定股票的 V6 评分数据',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/')[2] ?? ''
          if (!symbol) {
            logger.warn('[scoring:v6] resource v6: missing symbol in URI', { uri })
          }
          logger.info(`[scoring:v6] resource: scores://${symbol}/v6`)
          const result = await runV6Score(symbol)
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }
        },
      },
      {
        uriTemplate: 'scores://all',
        name: 'all_v6_scores',
        description: '所有已评分股票的 V6 评分汇总',
        mimeType: 'application/json',
        resolver: async (uri) => {
          logger.info('[scoring:v6] resource: scores://all')
          const result = await getAllV6Scores()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }
        },
      },
      {
        uriTemplate: 'scores://config',
        name: 'engine_config',
        description: 'V6 评分引擎配置',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const engine = createV6Engine()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(engine.getConfig()),
          }
        },
      },
    ]
  }

  // ============================================================
  // Prompt 模板
  // ============================================================

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'stock_analysis',
        description: 'V6 个股综合分析 Prompt 模板',
        arguments: [
          { name: 'symbol', description: '股票代码', required: true },
          { name: 'compositeScore', description: '综合评分 JSON', required: true },
          { name: 'context', description: '额外上下文（如行业动态、市场环境）', required: false },
        ],
        generator: async (args) => {
          const { symbol, compositeScore, context } = args
          if (!symbol || !compositeScore) {
            throw new Error('[scoring:v6] stock_analysis prompt: symbol and compositeScore are required')
          }
          const scoreData: CompositeScore = JSON.parse(compositeScore)
          const layerSummary = Object.entries(scoreData.layers)
            .map(([id, layer]) => `- ${id}(${layer.layerName}): ${layer.score} (权重 ${layer.weight * 100}%)`)
            .join('\n')

          return [
            {
              role: 'system',
              content: {
                type: 'text',
                text: '你是一个专业的股票分析师，擅长基于 V6 九维评分模型进行个股深度分析。',
              },
            },
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  `请分析股票 ${symbol} 的 V6 评分结果：`,
                  `综合评分: ${scoreData.score}`,
                  `评级: ${scoreData.rating}`,
                  `推荐: ${scoreData.recommendation}`,
                  `各层得分:`,
                  layerSummary,
                  `风险提示: ${scoreData.allRisks.join('、')}`,
                  context ? `额外信息: ${context}` : '',
                ].filter(Boolean).join('\n'),
              },
            },
          ]
        },
      },
      {
        name: 'hot_sector_analysis',
        description: '热门板块分析 Prompt 模板',
        arguments: [
          { name: 'sectorName', description: '板块名称', required: true },
          { name: 'scores', description: '板块热度评分 JSON', required: true },
        ],
        generator: async (args) => {
          return [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `请分析板块「${args.sectorName}」的热度评分：${args.scores}`,
              },
            },
          ]
        },
      },
    ]
  }
}