/**
 * @module ifindMcpCollector
 * @description iFinD MCP 数据采集器 — MCP 优先架构的核心执行器。
 *
 * 架构决策 (2026-08-18):
 *   PRIMARY:   iFinD MCP (专业金融数据，14 维度全覆盖)
 *   SECONDARY: 腾讯自选股 MCP (免费新闻/公告/研报)
 *   TERTIARY:  东方财富等数据爬虫 (补充覆盖)
 *   FALLBACK:  Tushare Pro API (兜底)
 *
 * 本模块负责：
 *   1. 将采集请求路由到正确的 MCP Server/Tool
 *   2. 管理 MCP 调用的降级链和熔断
 *   3. 解析 MCP 返回结果为统一数据格式
 *   4. 记录采集质量指标（成功率/延迟/完整度）
 *
 * @doc [V9-DOC-DATA-050, V9-DOC-DATA-070]
 */

import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { canExecute, recordSourceResult } from './adaptiveSourceOrchestrator'
import {
  MCP_SERVERS,
  getMcpMapping,
  type McpCollectResult,
  type DimensionCollectContext,
} from './mcpCollector'

const logger = getLogger()

/** MCP 源标识（用于熔断器和质量追踪） */
const IFOUND_MCP_SOURCE = 'ifind_mcp'
const TENCENT_MCP_SOURCE = 'tencent_mcp'

// ============================================================
// MCP Server 配置
// ============================================================

/** 腾讯 MCP 服务器列表（辅助采集源） */
const TENCENT_SERVERS = {
  news: 'marketdata:westock',
  stock: 'marketdata:westock',
} as const

// ============================================================
// MCP 调用执行器
// ============================================================

interface McpCallResult {
  success: boolean
  data: unknown
  error?: string
  latencyMs: number
  source: string
}

/**
 * 执行单个 MCP 工具调用。
 * 含熔断器检查和质量指标记录。
 */
async function executeMcpCall(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  source: string,
): Promise<McpCallResult> {
  if (!canExecute(source)) {
    logger.debug(`[ifindMcpCollector] 源 ${source} 熔断中，跳过: ${toolName}`)
    return { success: false, data: null, error: 'circuit_open', latencyMs: 0, source }
  }

  const start = Date.now()
  try {
    const result = await mcpBridge.callTool(serverName, toolName, args, { caller: 'system' })
    const latencyMs = Date.now() - start

    if (result.isError) {
      recordSourceResult(source, { success: false, isMock: false, latencyMs, completeness: 0 })
      const errorText = result.content[0]?.text ?? 'MCP 返回错误'
      logger.warn(`[ifindMcpCollector] ${serverName}.${toolName} 返回错误`, { error: errorText })
      return { success: false, data: null, error: errorText, latencyMs, source }
    }

    const text = result.content[0]?.text
    let parsedData: unknown = text
    if (text) {
      try {
        parsedData = JSON.parse(text)
      } catch {
        parsedData = text
      }
    }

    recordSourceResult(source, { success: true, isMock: false, latencyMs, completeness: 1 })
    return { success: true, data: parsedData, latencyMs, source }
  } catch (err) {
    const latencyMs = Date.now() - start
    recordSourceResult(source, { success: false, isMock: false, latencyMs, completeness: 0 })
    const errorMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
    logger.warn(`[ifindMcpCollector] ${serverName}.${toolName} 调用异常`, { error: errorMsg })
    return { success: false, data: null, error: errorMsg, latencyMs, source }
  }
}

// ============================================================
// 主采集接口
// ============================================================

/**
 * 通过 MCP 获取实时行情（iFinD 优先 → 腾讯 MCP → 直行情降级）。
 */
export async function fetchQuoteViaMcp(
  symbol: string,
  symbolName?: string,
): Promise<{ price: number; name: string; change: number; changePercent: number } | null> {
  const ctx: DimensionCollectContext = { symbol, dimensionCode: '01', symbolName }
  const mapping = getMcpMapping('01')
  if (!mapping) return null

  // 1. iFinD MCP 主采集
  const quoteQuery = mapping.queries.find((q) => q.name === 'stock_info')
  if (quoteQuery) {
    const callResult = await executeMcpCall(
      quoteQuery.serverName,
      quoteQuery.toolName,
      quoteQuery.buildArgs(ctx),
      IFOUND_MCP_SOURCE,
    )
    if (callResult.success && callResult.data) {
      const data = callResult.data as Record<string, unknown>
      const price = Number(data.current_price ?? data.price ?? 0)
      const name = typeof data.name === 'string' ? data.name : typeof symbolName === 'string' ? symbolName : ''
      const change = Number(data.change ?? 0)
      const changePercent = Number(data.change_percent ?? data.changePercent ?? 0)
      if (price > 0) {
        logger.info(`[ifindMcpCollector] iFinD MCP 行情采集成功: ${symbol}`, { price, latencyMs: callResult.latencyMs })
        return { price, name, change, changePercent }
      }
    }
  }

  // 2. 腾讯 MCP 辅助采集（通过 westock）
  if (canExecute(TENCENT_MCP_SOURCE)) {
    const tencentResult = await fetchQuoteViaTencentMcp(symbol)
    if (tencentResult) {
      return tencentResult
    }
  }

  logger.warn(`[ifindMcpCollector] MCP 行情采集全部失败: ${symbol}`)
  return null
}

/**
 * 通过 MCP 获取 K 线数据。
 */
export async function fetchKlineViaMcp(
  symbol: string,
  days: number,
): Promise<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> | null> {
  const ctx: DimensionCollectContext = { symbol, dimensionCode: '02' }
  const mapping = getMcpMapping('02')
  if (!mapping) return null

  const klineQuery = mapping.queries.find((q) => q.name === 'daily_kline')
  if (!klineQuery) return null

  // 1. iFinD MCP 主采集
  const callResult = await executeMcpCall(
    klineQuery.serverName,
    klineQuery.toolName,
    klineQuery.buildArgs(ctx),
    IFOUND_MCP_SOURCE,
  )

  if (callResult.success && callResult.data) {
    const data = callResult.data as Record<string, unknown>
    const klines = parseKlineResponse(data, days)
    if (klines.length > 0) {
      logger.info(`[ifindMcpCollector] iFinD MCP K线采集成功: ${symbol}`, { bars: klines.length, latencyMs: callResult.latencyMs })
      return klines
    }
  }

  logger.warn(`[ifindMcpCollector] MCP K线采集失败: ${symbol}`)
  return null
}

/**
 * 腾讯 MCP 行情辅助采集（通过 westock server）。
 * @remarks P1-1 修复：导出供 dataSourceOrchestrator.tencentMcpQuote 直连，
 * 避免与 fetchQuoteViaMcp 共享 iFinD→tencent 内部降级链导致重试冗余。
 */
export async function fetchQuoteViaTencentMcp(
  symbol: string,
): Promise<{ price: number; name: string; change: number; changePercent: number } | null> {
  try {
    const result = await mcpBridge.callTool(
      TENCENT_SERVERS.news,
      'westock_quote_list',
      { symbols: [symbol] },
      { caller: 'system' },
    )

    if (result.isError) return null

    const text = result.content[0]?.text
    if (!text) return null

    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : data.data ?? []
    if (!Array.isArray(items) || items.length === 0) return null

    const item = items[0] as Record<string, unknown>
    return {
      price: Number(item.current_price ?? item.price ?? 0),
      name: typeof item.name === 'string' ? item.name : '',
      change: Number(item.change ?? 0),
      changePercent: Number(item.change_percent ?? 0),
    }
  } catch {
    return null
  }
}

/**
 * 解析 K 线响应数据。
 */
function parseKlineResponse(raw: Record<string, unknown>, days: number): Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> {
  const bars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> = []
  const data = raw.data ?? raw.items ?? raw.klines ?? raw
  const list = Array.isArray(data) ? data : (data as Record<string, unknown>).list ?? (data as Record<string, unknown>).data_list ?? []

  if (!Array.isArray(list)) return bars

  for (const item of list.slice(-days)) {
    if (!item || typeof item !== 'object') continue
    const bar = item as Record<string, unknown>
    bars.push({
      date: typeof bar.date === 'string' ? bar.date : typeof bar.trade_date === 'string' ? bar.trade_date : '',
      open: Number(bar.open ?? 0),
      high: Number(bar.high ?? 0),
      low: Number(bar.low ?? 0),
      close: Number(bar.close ?? bar.price ?? 0),
      volume: Number(bar.volume ?? 0),
    })
  }
  return bars
}

// ============================================================
// 维度数据采集（03-14）
// ============================================================

/**
 * 通过 MCP 采集指定维度的数据。
 * 这是 03-14 维度的统一采集入口，自动完成：
 *   MCP 调用 → 结果聚合 → 质量记录 → 降级回退
 */
export async function collectDimensionViaMcp(
  symbol: string,
  dimensionCode: string,
  symbolName?: string,
): Promise<McpCollectResult | null> {
  const ctx: DimensionCollectContext = { symbol, dimensionCode, symbolName }
  const mapping = getMcpMapping(dimensionCode)
  if (!mapping) {
    logger.warn(`[ifindMcpCollector] 维度 ${dimensionCode} 无 MCP 映射`)
    return null
  }

  const data: Record<string, unknown> = {}
  const errors: string[] = []
  let queryCount = 0
  let successCount = 0
  const start = Date.now()

  for (const query of mapping.queries) {
    queryCount++
    const callResult = await executeMcpCall(
      query.serverName,
      query.toolName,
      query.buildArgs(ctx),
      IFOUND_MCP_SOURCE,
    )

    if (callResult.success && callResult.data) {
      try {
        const parsed = query.parseResponse(callResult.data)
        Object.assign(data, parsed)
        successCount++
      } catch (e) {
        errors.push(`[${query.name}] 解析失败: ${e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error'}`)
      }
    } else if (callResult.error) {
      errors.push(`[${query.name}] ${callResult.error}`)
    }
  }

  const latencyMs = Date.now() - start
  const result: McpCollectResult = {
    success: successCount > 0,
    symbol,
    dimensionCode,
    dimensionName: mapping.dimensionName,
    data,
    errors,
    latencyMs,
    queryCount,
    successCount,
  }

  if (result.success) {
    logger.info(`[ifindMcpCollector] 维度 ${dimensionCode} MCP 采集成功: ${symbol}`, {
      successCount,
      queryCount,
      latencyMs,
    })
  } else {
    logger.warn(`[ifindMcpCollector] 维度 ${dimensionCode} MCP 采集失败: ${symbol}`, { errors })
  }

  return result
}

/**
 * 通过 MCP 批量采集维度数据（并行调用多维度）。
 */
export async function collectMultipleDimensionsViaMcp(
  symbol: string,
  dimensionCodes: string[],
  symbolName?: string,
): Promise<Map<string, McpCollectResult | null>> {
  const results = new Map<string, McpCollectResult | null>()
  const tasks = dimensionCodes.map(async (code) => {
    const result = await collectDimensionViaMcp(symbol, code, symbolName)
    results.set(code, result)
  })
  await Promise.all(tasks)
  return results
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 检查 iFinD MCP 是否可用（连通性探测）。
 */
export async function probeIfindMcp(): Promise<{ available: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    const result = await mcpBridge.callTool(
      MCP_SERVERS.stock,
      'get_stock_info',
      { query: '000001 平安银行 基本信息' },
      { caller: 'system' },
    )
    const latencyMs = Date.now() - start
    if (result.isError) {
      return { available: false, latencyMs }
    }
    return { available: true, latencyMs }
  } catch {
    return { available: false, latencyMs: Date.now() - start }
  }
}

/**
 * 获取 MCP 源的健康状态摘要。
 */
export function getMcpSourceHealth(): Record<string, { source: string; available: boolean }> {
  const sources: Record<string, { source: string; available: boolean }> = {}
  for (const source of [IFOUND_MCP_SOURCE, TENCENT_MCP_SOURCE]) {
    sources[source] = {
      source,
      available: canExecute(source),
    }
  }
  return sources
}

export default {
  fetchQuoteViaMcp,
  fetchKlineViaMcp,
  collectDimensionViaMcp,
  collectMultipleDimensionsViaMcp,
  probeIfindMcp,
  getMcpSourceHealth,
}