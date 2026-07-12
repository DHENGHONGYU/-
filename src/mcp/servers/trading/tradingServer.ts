/**
 * TradingServer — 交易引擎 MCP Server
 *
 * @description
 * 封装交易信号生成、订单管理、仓位计算、策略快照、交易复盘等核心交易能力。
 * 通过 MCP Tool/Resource/Prompt 接口暴露，支持 AI Agent 和 UI 层统一调用。
 *
 * @module mcp/servers/trading/tradingServer
 * @created 2026-07-04 - Phase 1 MCP 核心业务 Server 迁移
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import {
  getOrders,
  createBuyOrder,
  createSellOrder,
  scanWatchingSignals,
  adviseForStock,
} from '@/services/trading/tradingService'
import { getLatestSnapshot } from '@/services/trading/strategySnapshotService'
import { generateReview } from '@/services/trading/tradeReviewAI'
import { checkOrderRisk } from '@/services/trading/riskEngine'
import { calculatePosition } from '@/services/trading/positionSizer'
import { generateMockTradingData } from '@/services/trading/mockDataGenerator'
import {
  fetchHoldings,
  executeTradeAction,
  exportHoldingsCSV,
} from '@/services/trade/holdingsService'
import type { HoldingsQueryParams, TradeActionRequest } from '@/types/modules/trade.types'

const logger = getLogger()

export class TradingServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'trading',
    version: '1.0.0',
    description: '交易引擎服务，支持信号生成、订单管理、仓位计算、策略快照、交易复盘',
    dependencies: ['scoring:v6', 'fetcher'],
  }

  // ============================================================
  // Tool 定义
  // ============================================================

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'generate_mock_trading_data',
        description: '生成完整的模拟交易数据（信号、订单、持仓、风控指标）',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[trading] generate_mock_trading_data')
          const data = generateMockTradingData()
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          }
        },
      },
      {
        name: 'scan_signals',
        description: '扫描自选股交易信号（MA20/RSI14/MACD/量比），返回所有触发信号',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[trading] scan_signals')
          const signals = await scanWatchingSignals()
          return {
            content: [{ type: 'text', text: JSON.stringify(signals, null, 2) }],
          }
        },
      },
      {
        name: 'advise_stock',
        description: '对指定股票生成交易建议（信号 + 仓位 + 风控）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info(`[trading] advise_stock: ${symbol}`)
          // 需要 Stock 对象，通过 symbol 构建最小 Stock
          const stock = { symbol, name: symbol, price: 0, researchStatus: 'watching' as const, source: 'manual' as const, dataVersion: 1 }
          const result = await adviseForStock(stock)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'get_orders',
        description: '获取所有订单记录',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[trading] get_orders')
          const result = await getOrders()
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        },
      },
      {
        name: 'create_buy_order',
        description: '创建买入订单',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            quantity: { type: 'number', description: '买入数量（不传则自动计算）' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          const quantity = args.quantity as number | undefined
          const stock = { symbol, name: symbol, price: 0, researchStatus: 'watching' as const, source: 'manual' as const, dataVersion: 1 }
          logger.info(`[trading] create_buy_order: ${symbol}`, { quantity })
          const result = await createBuyOrder(stock, quantity)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'create_sell_order',
        description: '创建卖出订单',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            quantity: { type: 'number', description: '卖出数量（不传则全部卖出）' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          const quantity = args.quantity as number | undefined
          const stock = { symbol, name: symbol, price: 0, researchStatus: 'watching' as const, source: 'manual' as const, dataVersion: 1 }
          logger.info(`[trading] create_sell_order: ${symbol}`, { quantity })
          const result = await createSellOrder(stock, quantity)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'check_order_risk',
        description: '检查订单风控（冷却期、日交易上限、仓位上限、行情新鲜度）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            direction: { type: 'string', enum: ['buy', 'sell'], description: '交易方向' },
            quantity: { type: 'number', description: '交易数量' },
            price: { type: 'number', description: '交易价格' },
            portfolioValue: { type: 'number', description: '组合总价值' },
          },
          required: ['symbol', 'direction', 'quantity', 'price', 'portfolioValue'],
        },
        handler: async (args) => {
          logger.info(`[trading] check_order_risk: ${String(args.symbol)}`)
          const result = await checkOrderRisk({
            symbol: args.symbol as string,
            direction: args.direction as 'buy' | 'sell',
            quantity: args.quantity as number,
            price: args.price as number,
            portfolioValue: args.portfolioValue as number,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        },
      },
      {
        name: 'calculate_position',
        description: '基于 Kelly 公式计算推荐仓位大小',
        inputSchema: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['buy', 'sell'], description: '交易方向' },
            price: { type: 'number', description: '当前价格' },
            portfolioValue: { type: 'number', description: '组合总价值' },
            currentHoldingShares: { type: 'number', description: '当前持仓股数' },
            currentHoldingValue: { type: 'number', description: '当前持仓市值' },
            currentTotalPositionValue: { type: 'number', description: '当前总仓位市值' },
            winRate: { type: 'number', description: '胜率 (0-1)' },
            profitLossRatio: { type: 'number', description: '盈亏比' },
          },
          required: ['direction', 'price', 'portfolioValue'],
        },
        handler: async (args) => {
          logger.info('[trading] calculate_position')
          const result = calculatePosition({
            direction: args.direction as 'buy' | 'sell',
            price: args.price as number,
            portfolioValue: args.portfolioValue as number,
            currentHoldingShares: args.currentHoldingShares as number | undefined,
            currentHoldingValue: args.currentHoldingValue as number | undefined,
            currentTotalPositionValue: args.currentTotalPositionValue as number | undefined,
            winRate: args.winRate as number | undefined,
            profitLossRatio: args.profitLossRatio as number | undefined,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        },
      },
      {
        name: 'get_strategy_snapshot',
        description: '获取最新策略快照（core/hot/value 三大分组）',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[trading] get_strategy_snapshot')
          const result = await getLatestSnapshot()
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        },
      },
      {
        name: 'generate_trade_review',
        description: '生成交易复盘报告（六维分析：交易概要、错误分析、纪律评估、技能发展、行动计划、AI 洞察）',
        inputSchema: {
          type: 'object',
          properties: {
            includeAIInsight: { type: 'boolean', description: '是否包含 AI 深度洞察', default: false },
          },
        },
        handler: async (_args) => {
          logger.info('[trading] generate_trade_review')
          const ordersResult = await getOrders()
          const orders = ordersResult.success ? ordersResult.data ?? [] : []
          const report = generateReview(orders, Date.now())
          return {
            content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
          }
        },
      },
      // ── 原 trade:main 合并过来的工具 ──
      {
        name: 'fetch_holdings',
        description: '查询持仓列表（分页）',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页条数，默认 20' },
            startDate: { type: 'string', description: '开始日期（ISO 格式）' },
            endDate: { type: 'string', description: '结束日期（ISO 格式）' },
            direction: { type: 'string', description: '交易方向' },
            keyword: { type: 'string', description: '搜索关键词' },
          },
        },
        handler: async (args) => {
          logger.info('[trading] fetch_holdings called', {
            accountType: args.accountType,
            symbol: args.symbol,
          })
          const queryParams: HoldingsQueryParams = {
            page: 1,
            pageSize: 50,
            startDate: '',
            endDate: '',
            direction: 'ALL',
            keyword: (args.symbol as string) ?? '',
          }
          const result = await fetchHoldings(queryParams)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'execute_trade_action',
        description: '执行交易操作（买入/卖出）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            action: { type: 'string', enum: ['buy', 'sell'], description: '交易动作' },
            quantity: { type: 'number', description: '交易数量' },
            price: { type: 'number', description: '交易价格' },
          },
          required: ['symbol', 'action', 'quantity', 'price'],
        },
        handler: async (args) => {
          logger.info('[trading] execute_trade_action called', {
            symbol: args.symbol,
            action: args.action,
          })
          const tradeReq: TradeActionRequest = {
            code: args.symbol as string,
            action: (args.action === 'buy' ? 'ADD_POSITION' : 'CLOSE_POSITION'),
            quantity: args.quantity as number,
          }
          const result = await executeTradeAction(tradeReq)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'export_holdings_csv',
        description: '导出持仓为 CSV 文件',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页条数，默认 20' },
            startDate: { type: 'string', description: '开始日期（ISO 格式）' },
            endDate: { type: 'string', description: '结束日期（ISO 格式）' },
            direction: { type: 'string', description: '交易方向' },
            keyword: { type: 'string', description: '搜索关键词' },
          },
        },
        handler: async (args) => {
          logger.info('[trading] export_holdings_csv called', {
            accountType: args.accountType,
          })
          const exportParams: HoldingsQueryParams = {
            page: 1,
            pageSize: 9999,
            startDate: '',
            endDate: '',
            direction: 'ALL',
            keyword: '',
          }
          await exportHoldingsCSV(exportParams)
          return { content: [{ type: 'text', text: 'CSV 导出完成' }] }
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
        uriTemplate: 'trading://orders',
        name: 'orders',
        description: '所有订单记录',
        mimeType: 'application/json',
        resolver: async (uri) => {
          logger.info('[trading] resource: trading://orders')
          const result = await getOrders()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }
        },
      },
      {
        uriTemplate: 'trading://snapshot/latest',
        name: 'latest_snapshot',
        description: '最新策略快照',
        mimeType: 'application/json',
        resolver: async (uri) => {
          logger.info('[trading] resource: trading://snapshot/latest')
          const result = await getLatestSnapshot()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }
        },
      },
      {
        uriTemplate: 'trading://signals',
        name: 'watchlist_signals',
        description: '自选股交易信号',
        mimeType: 'application/json',
        resolver: async (uri) => {
          logger.info('[trading] resource: trading://signals')
          const signals = await scanWatchingSignals()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(signals),
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
        name: 'trade_review',
        description: '交易复盘 Prompt 模板',
        arguments: [
          { name: 'tradeReviewReport', description: '交易复盘报告 JSON', required: true },
          { name: 'orderHistory', description: '交易历史 JSON', required: false },
        ],
        generator: async (args) => {
          const report = JSON.parse(args.tradeReviewReport ?? '{}')
          return [
            {
              role: 'system',
              content: {
                type: 'text',
                text: '你是一个专业的交易心理教练，擅长基于数据驱动的交易复盘分析，帮助交易者识别行为模式、改善交易纪律。',
              },
            },
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  '请基于以下交易复盘报告进行深度分析：',
                  `胜率: ${report.summary?.winRate ?? 'N/A'}`,
                  `盈亏比: ${report.summary?.profitLossRatio ?? 'N/A'}`,
                  `纪律评分: ${report.disciplineAnalysis?.overallScore ?? 'N/A'}`,
                  `主要错误: ${JSON.stringify(report.errorAnalysis?.topErrors ?? [])}`,
                  `改进方向: ${JSON.stringify(report.disciplineAnalysis?.improvements ?? [])}`,
                  '请给出具体的改进建议和行动计划。',
                ].join('\n'),
              },
            },
          ]
        },
      },
      {
        name: 'trade_advice',
        description: '交易建议分析 Prompt 模板',
        arguments: [
          { name: 'symbol', description: '股票代码', required: true },
          { name: 'signals', description: '交易信号 JSON', required: true },
          { name: 'riskCheck', description: '风控检查结果 JSON', required: false },
        ],
        generator: async (args) => {
          return [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  `请分析股票 ${args.symbol} 的交易建议：`,
                  `交易信号: ${args.signals}`,
                  args.riskCheck ? `风控检查: ${args.riskCheck}` : '',
                  '请综合评估是否值得交易，以及建议的仓位和止损位。',
                ].filter(Boolean).join('\n'),
              },
            },
          ]
        },
      },
    ]
  }
}