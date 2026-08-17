/**
 * @module mcpCollector
 * @description MCP SKILL 数据采集适配层 — 替代 Python ETL Bridge 方案。
 *
 * 架构决策 (2026-08-17):
 *   OLD: Frontend → Vite Proxy → Python HTTP (8002) → Eastmoney APIs
 *   NEW: Frontend → Collection Pipeline → iFinD MCP SKILL → 同花顺 iFinD
 *
 * 优势:
 *   1. 零额外进程 — 无 Python 运维负担
 *   2. 原生类型安全 — TypeScript 全链路，无需 JSON 序列化桥接
 *   3. MCP 协议统一 — 与 V9 已有的 MCP 基础设施（ACL/熔断/限流）无缝集成
 *   4. 数据质量 — iFinD 专业金融数据源，覆盖全部 14 维度
 *
 * 14 维度 → iFinD MCP 工具映射:
 *   ┌─────┬──────────┬──────────────────────────────────────────────────┐
 *   │ Dim │ 维度名称  │ iFinD MCP 工具                                    │
 *   ├─────┼──────────┼──────────────────────────────────────────────────┤
 *   │ 01  │ 基本信息  │ get_stock_info + get_stock_summary                │
 *   │ 02  │ K线数据   │ stock_highfreq_quotes + get_stock_performance     │
 *   │ 03  │ 筹码分布  │ get_stock_shareholders                           │
 *   │ 04  │ 重大事项  │ search_notice + get_stock_events                  │
 *   │ 05  │ 热点新闻  │ search_news                                      │
 *   │ 06  │ 行业竞品  │ sector_data + search_stocks                      │
 *   │ 07  │ 关联指数  │ index_data                                       │
 *   │ 08  │ 研报中心  │ search_news (研报类)                              │
 *   │ 09  │ 财务数据  │ get_stock_financials                             │
 *   │ 10  │ 热门板块  │ sector_data                                      │
 *   │ 11  │ 技术指标  │ stock_highfreq_quotes (highfreq)                 │
 *   │ 12  │ 资金流向  │ get_stock_performance (融资融券/龙虎榜)            │
 *   │ 13  │ 机构持仓  │ get_stock_shareholders                           │
 *   │ 14  │ 估值分析  │ get_stock_financials (PE/PB/PS/EV 分位)          │
 *   └─────┴──────────┴──────────────────────────────────────────────────┘
 *
 * @doc [V9-DOC-DATA-050]
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// MCP 服务器标识
// ============================================================

/** iFinD MCP 服务器名称常量 */
export const MCP_SERVERS = {
  /** A股数据 */
  stock: 'mcp_plugin_iFinD_hexin-ifind-ds-stock-mcp',
  /** 指数/板块 */
  index: 'mcp_plugin_iFinD_hexin-ifind-ds-index-mcp',
  /** 新闻/公告 */
  news: 'mcp_plugin_iFinD_hexin-ifind-ds-news-mcp',
  /** 基金 */
  fund: 'mcp_plugin_iFinD_hexin-ifind-ds-fund-mcp',
  /** 全球股票 */
  global: 'mcp_plugin_iFinD_hexin-ifind-ds-global-stock-mcp',
} as const

// ============================================================
// MCP 调用请求 / 响应类型
// ============================================================

/** MCP 工具调用请求 */
export interface McpToolRequest {
  serverName: string
  toolName: string
  args: Record<string, unknown>
}

/** MCP 工具调用响应 */
export interface McpToolResponse<T = Record<string, unknown>> {
  success: boolean
  data: T | null
  error?: string
  latencyMs: number
}

/** 维度采集上下文 */
export interface DimensionCollectContext {
  symbol: string
  dimensionCode: string
  /** 股票简称（用于自然语言查询） */
  symbolName?: string
}

// ============================================================
// 14 维度 MCP 查询模板
// ============================================================

/** 维度 → MCP 工具映射配置 */
export interface McpDimensionMapping {
  dimensionCode: string
  dimensionName: string
  /** 子查询列表（一个维度可能拆分为多个 MCP 调用） */
  queries: McpQueryTemplate[]
}

export interface McpQueryTemplate {
  /** 子查询名 */
  name: string
  serverName: string
  toolName: string
  /** 参数构建函数 */
  buildArgs: (ctx: DimensionCollectContext) => Record<string, unknown>
  /** 响应解析器 */
  parseResponse: (raw: unknown) => Record<string, unknown>
}

// ============================================================
// 查询模板定义
// ============================================================

/**
 * 14 维度 MCP 查询模板映射表。
 * 每个维度包含 1-3 个子查询，对应具体的 iFinD MCP 工具调用。
 */
export const DIMENSION_MCP_MAPPING: McpDimensionMapping[] = [
  // ── Dim 01: 基本信息 ──
  {
    dimensionCode: '01',
    dimensionName: '基本信息',
    queries: [
      {
        name: 'stock_info',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_info',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 的上市时间、所属申万行业、主营业务`,
        }),
        parseResponse: (raw) => ({ stockInfo: raw }),
      },
      {
        name: 'stock_summary',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_summary',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 最新估值水平、市值、PE、PB、ROE`,
        }),
        parseResponse: (raw) => ({ stockSummary: raw }),
      },
    ],
  },

  // ── Dim 02: K线数据 ──
  {
    dimensionCode: '02',
    dimensionName: 'K线数据',
    queries: [
      {
        name: 'daily_kline',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_performance',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
          return {
            query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 在${weekAgo}-${today}的开盘价、最高价、最低价、收盘价、成交量、成交额、涨跌幅、换手率`,
          }
        },
        parseResponse: (raw) => ({ kline: raw }),
      },
      {
        name: 'realtime_quote',
        serverName: MCP_SERVERS.stock,
        toolName: 'stock_highfreq_quotes',
        buildArgs: (ctx) => ({
          symbols: ctx.symbol,
          indicators: '最新价,开盘价,最高价,最低价,涨跌幅,成交额,成交量,换手率,总市值,市盈率TTM,市净率',
          data_mode: 'real_time',
        }),
        parseResponse: (raw) => ({ realtimeQuote: raw }),
      },
    ],
  },

  // ── Dim 03: 筹码分布 ──
  {
    dimensionCode: '03',
    dimensionName: '筹码分布',
    queries: [
      {
        name: 'shareholders',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_shareholders',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 的股东户数、户均持股、前十大股东持股占比`,
        }),
        parseResponse: (raw) => ({ shareholders: raw }),
      },
    ],
  },

  // ── Dim 04: 重大事项 ──
  {
    dimensionCode: '04',
    dimensionName: '重大事项',
    queries: [
      {
        name: 'notices',
        serverName: MCP_SERVERS.news,
        toolName: 'search_notice',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
          return {
            query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 重大事项 公告`,
            time_start: yearAgo,
            time_end: today,
            size: 10,
          }
        },
        parseResponse: (raw) => ({ notices: raw }),
      },
      {
        name: 'events',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_events',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 近期重大事件 增减持 股权激励 回购`,
        }),
        parseResponse: (raw) => ({ events: raw }),
      },
    ],
  },

  // ── Dim 05: 热点新闻 ──
  {
    dimensionCode: '05',
    dimensionName: '热点新闻',
    queries: [
      {
        name: 'hot_news',
        serverName: MCP_SERVERS.news,
        toolName: 'search_news',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
          return {
            query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 最新动态`,
            time_start: monthAgo,
            time_end: today,
            size: 10,
          }
        },
        parseResponse: (raw) => ({ hotNews: raw }),
      },
    ],
  },

  // ── Dim 06: 行业竞品 ──
  {
    dimensionCode: '06',
    dimensionName: '行业竞品',
    queries: [
      {
        name: 'industry_peers',
        serverName: MCP_SERVERS.stock,
        toolName: 'search_stocks',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 所属行业的市值排名、竞品公司`,
        }),
        parseResponse: (raw) => ({ industryPeers: raw }),
      },
      {
        name: 'sector_info',
        serverName: MCP_SERVERS.index,
        toolName: 'sector_data',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 所属申万行业板块的行情与估值`,
        }),
        parseResponse: (raw) => ({ sectorInfo: raw }),
      },
    ],
  },

  // ── Dim 07: 关联指数 ──
  {
    dimensionCode: '07',
    dimensionName: '关联指数',
    queries: [
      {
        name: 'related_index',
        serverName: MCP_SERVERS.index,
        toolName: 'index_data',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
          return {
            query: `沪深300、中证500、${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''}所属行业指数在${monthAgo}-${today}的涨跌幅与收盘点数`,
          }
        },
        parseResponse: (raw) => ({ relatedIndex: raw }),
      },
    ],
  },

  // ── Dim 08: 研报中心 ──
  {
    dimensionCode: '08',
    dimensionName: '研报中心',
    queries: [
      {
        name: 'research_reports',
        serverName: MCP_SERVERS.news,
        toolName: 'search_news',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const yearAgo = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
          return {
            query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 研报 评级 目标价`,
            time_start: yearAgo,
            time_end: today,
            size: 10,
          }
        },
        parseResponse: (raw) => ({ researchReports: raw }),
      },
    ],
  },

  // ── Dim 09: 财务数据 ──
  {
    dimensionCode: '09',
    dimensionName: '财务数据',
    queries: [
      {
        name: 'financials',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_financials',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 在最新报告期的营收、净利润、ROE、毛利率、净利率、经营现金流、EPS、每股净资产`,
        }),
        parseResponse: (raw) => ({ financials: raw }),
      },
    ],
  },

  // ── Dim 10: 热门板块 ──
  {
    dimensionCode: '10',
    dimensionName: '热门板块',
    queries: [
      {
        name: 'hot_sectors',
        serverName: MCP_SERVERS.index,
        toolName: 'sector_data',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
          return {
            query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 所属板块在${weekAgo}-${today}的行情涨跌幅、成交额排名`,
          }
        },
        parseResponse: (raw) => ({ hotSectors: raw }),
      },
    ],
  },

  // ── Dim 11: 技术指标 ──
  {
    dimensionCode: '11',
    dimensionName: '技术指标',
    queries: [
      {
        name: 'technical_indicators',
        serverName: MCP_SERVERS.stock,
        toolName: 'stock_highfreq_quotes',
        buildArgs: (ctx) => ({
          symbols: ctx.symbol,
          indicators: '收盘价,MA均线5周期,MA均线10周期,MA均线20周期,MA均线60周期,KDJ随机指标K值,KDJ随机指标D值,KDJ随机指标J值,MACD指标DIFF值,MACD指标DEA值,MACD指标MACD值,RSI相对强弱指标6周期',
          data_mode: 'highfreq',
          interval: 5,
        }),
        parseResponse: (raw) => ({ technicalIndicators: raw }),
      },
    ],
  },

  // ── Dim 12: 资金流向 ──
  {
    dimensionCode: '12',
    dimensionName: '资金流向',
    queries: [
      {
        name: 'fund_flow',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_performance',
        buildArgs: (ctx) => {
          const today = new Date().toISOString().slice(0, 10)
          const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
          return {
            query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 在${monthAgo}-${today}的融资融券余额、龙虎榜数据、主力资金流向`,
          }
        },
        parseResponse: (raw) => ({ fundFlow: raw }),
      },
    ],
  },

  // ── Dim 13: 机构持仓 ──
  {
    dimensionCode: '13',
    dimensionName: '机构持仓',
    queries: [
      {
        name: 'institutional_holdings',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_shareholders',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 的机构持股比例、基金持仓占比、北向资金持仓、社保持仓、QFII持仓`,
        }),
        parseResponse: (raw) => ({ institutionalHoldings: raw }),
      },
    ],
  },

  // ── Dim 14: 估值分析 ──
  {
    dimensionCode: '14',
    dimensionName: '估值分析',
    queries: [
      {
        name: 'valuation',
        serverName: MCP_SERVERS.stock,
        toolName: 'get_stock_financials',
        buildArgs: (ctx) => ({
          query: `${ctx.symbol}${ctx.symbolName ? ' ' + ctx.symbolName : ''} 的PE、PB、PS、EV/EBITDA、PEG、股息率及其历史分位数`,
        }),
        parseResponse: (raw) => ({ valuation: raw }),
      },
    ],
  },
]

// ============================================================
// 查询映射查找
// ============================================================

/** 按维度代码获取 MCP 查询映射 */
export function getMcpMapping(dimensionCode: string): McpDimensionMapping | undefined {
  return DIMENSION_MCP_MAPPING.find((m) => m.dimensionCode === dimensionCode)
}

/** 获取所有 MCP 支持的维度代码 */
export function getMcpSupportedDimensions(): string[] {
  return DIMENSION_MCP_MAPPING.map((m) => m.dimensionCode)
}

// ============================================================
// 采集结果类型
// ============================================================

export interface McpCollectResult {
  success: boolean
  symbol: string
  dimensionCode: string
  dimensionName: string
  data: Record<string, unknown>
  errors: string[]
  latencyMs: number
  /** 实际调用的 MCP 子查询数 */
  queryCount: number
  /** 成功的子查询数 */
  successCount: number
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 构建 MCP 工具调用请求列表。
 * 将维度上下文转换为可执行的 MCP 调用序列。
 */
export function buildMcpRequests(ctx: DimensionCollectContext): McpToolRequest[] {
  const mapping = getMcpMapping(ctx.dimensionCode)
  if (!mapping) {
    logger.warn(`[mcpCollector] 维度 ${ctx.dimensionCode} 无 MCP 映射`)
    return []
  }

  return mapping.queries.map((q) => ({
    serverName: q.serverName,
    toolName: q.toolName,
    args: q.buildArgs(ctx),
  }))
}

/**
 * 聚合 MCP 子查询结果为统一维度数据。
 */
export function aggregateMcpResults(
  mapping: McpDimensionMapping,
  responses: Array<{ success: boolean; data: unknown; error?: string }>,
  latencyMs: number,
): McpCollectResult {
  const data: Record<string, unknown> = {}
  const errors: string[] = []
  let successCount = 0

  responses.forEach((resp, idx) => {
    const query = mapping.queries[idx]
    if (!query) return

    if (resp.success && resp.data) {
      try {
        const parsed = query.parseResponse(resp.data)
        Object.assign(data, parsed)
        successCount++
      } catch (e) {
        errors.push(`[${query.name}] 解析失败: ${e}`)
      }
    } else if (resp.error) {
      errors.push(`[${query.name}] ${resp.error}`)
    }
  })

  return {
    success: successCount > 0,
    symbol: '',
    dimensionCode: mapping.dimensionCode,
    dimensionName: mapping.dimensionName,
    data,
    errors,
    latencyMs,
    queryCount: mapping.queries.length,
    successCount,
  }
}

// ============================================================
// 默认导出
// ============================================================

export default {
  DIMENSION_MCP_MAPPING,
  MCP_SERVERS,
  getMcpMapping,
  getMcpSupportedDimensions,
  buildMcpRequests,
  aggregateMcpResults,
}