/**
 * DataFetcherServer — 数据采集 MCP Server
 *
 * @description
 * 封装行情数据获取、K线数据采集、基础数据查询等数据采集能力。
 * 支持 AkShare（远程）和 Mock（本地）两种数据源，通过 DataSourceRegistry 自动切换。
 *
 * @module mcp/servers/fetcher/dataFetcherServer
 * @created 2026-07-04 - Phase 1 MCP 核心业务 Server 迁移
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import {
  fetchStockBasic,
  fetchStocksBasic,
  fetchStockKline,
  refreshSymbol,
  checkFetcherHealth,
} from '@/services/fetcher/fetcherService'
import { testSourceConnectivity } from '@/services/data-collector/dataSourceOrchestrator'
import { DataSourceRegistry } from '@/services/fetcher/dataSourceRegistry'
import { AkshareProvider } from '@/services/fetcher/akshareProvider'
import { MockProvider } from '@/services/fetcher/mockProvider'
import type { DataSourceProvider } from '@/services/fetcher/types'

const logger = getLogger()

// ============================================================
// DataSourceRegistry 单例（Lazy 初始化，注册 AkShare + Mock providers）
// 修复 P0 类型错误：原代码引用不存在的 getDataSourceRegistry 工厂函数
// ============================================================

let _registry: DataSourceRegistry | null = null

function getDataSourceRegistry(): DataSourceRegistry {
  if (!_registry) {
    _registry = new DataSourceRegistry()
    _registry.register(new AkshareProvider())
    _registry.register(new MockProvider())
    logger.info('[fetcher] DataSourceRegistry initialized with AkShare + Mock providers')
  }
  return _registry
}

export class DataFetcherServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'fetcher',
    version: '1.0.0',
    description: '数据采集服务，支持 AkShare/Mock 数据源，提供行情、K线、基本面数据获取',
    dependencies: [],
  }

  // ============================================================
  // Tool 定义
  // ============================================================

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'fetch_stock_basic',
        description: '获取单只股票的基础信息（名称、价格、PE、PB、ROE、市值等）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码，如 000001' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info(`[fetcher] fetch_stock_basic: ${symbol}`)
          const result = await fetchStockBasic(symbol)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'fetch_stocks_basic',
        description: '批量获取多只股票的基础信息',
        inputSchema: {
          type: 'object',
          properties: {
            symbols: {
              type: 'array',
              description: '股票代码列表',
              items: { type: 'string' },
            },
          },
          required: ['symbols'],
        },
        handler: async (args) => {
          const symbols = args.symbols as string[]
          logger.info(`[fetcher] fetch_stocks_basic: ${symbols.length} symbols`)
          const result = await fetchStocksBasic(symbols)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'fetch_kline',
        description: '获取股票 K 线数据（日线/周线/月线，支持前复权/后复权）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: '周期', default: 'daily' },
            adjust: { type: 'string', enum: ['qfq', 'hfq', ''], description: '复权方式', default: 'qfq' },
            startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
            endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          const options = {
            period: (args.period as 'daily' | 'weekly' | 'monthly') ?? 'daily',
            adjust: (args.adjust as 'qfq' | 'hfq' | '') ?? 'qfq',
            startDate: args.startDate as string | undefined,
            endDate: args.endDate as string | undefined,
          }
          logger.info(`[fetcher] fetch_kline: ${symbol}`, options)
          const result = await fetchStockKline(symbol, options)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'refresh_symbol',
        description: '刷新单只股票的全部数据（基础信息 + K线）',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info(`[fetcher] refresh_symbol: ${symbol}`)
          const result = await refreshSymbol(symbol)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        },
      },
      {
        name: 'test_source_connectivity',
        description: '测试单个行情数据源（tencent/sina/netease/akshare/mock）的连通性',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              enum: ['tencent', 'sina', 'netease', 'akshare', 'mock'],
              description: '数据源标识',
            },
          },
          required: ['source'],
        },
        handler: async (args) => {
          const source = args.source as 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock'
          logger.info(`[fetcher] test_source_connectivity: ${source}`)
          const result = await testSourceConnectivity(source)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.ok,
          }
        },
      },
    ]
  }

  // ============================================================
  // Resource 模板
  // ============================================================

  protected getResources(): ResourceTemplate[] {
    const warnMissingSymbol = (symbol: string, uri: string, kind: string): void => {
      if (!symbol) {
        logger.warn(`[fetcher] resource ${kind}: missing symbol in URI`, { uri })
      }
    }
    return [
      {
        uriTemplate: 'fetcher://{symbol}/basic',
        name: 'stock_basic',
        description: '股票基础信息',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/')[2] ?? ''
          warnMissingSymbol(symbol, uri, 'basic')
          logger.info(`[fetcher] resource: fetcher://${symbol}/basic`)
          const result = await fetchStockBasic(symbol)
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }
        },
      },
      {
        uriTemplate: 'fetcher://{symbol}/kline',
        name: 'stock_kline',
        description: '股票 K 线数据',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/')[2] ?? ''
          warnMissingSymbol(symbol, uri, 'kline')
          logger.info(`[fetcher] resource: fetcher://${symbol}/kline`)
          const result = await fetchStockKline(symbol, { period: 'daily', adjust: 'qfq' })
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          }
        },
      },
      {
        uriTemplate: 'fetcher://health',
        name: 'health_status',
        description: '数据采集服务健康状态',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const health = await checkFetcherHealth()
          const registry = getDataSourceRegistry()
          const providers = registry.getAllProviders()
          const providerStatuses = await Promise.all(
            providers.map(async (p: DataSourceProvider) => ({
              name: p.name,
              status: await p.healthCheck(),
            })),
          )
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ fetcher: health, providers: providerStatuses }),
          }
        },
      },
    ]
  }
}