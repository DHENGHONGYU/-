import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION, RESEARCH_STATUS, DEFAULT_POOL_GROUP, type ResearchStatus } from '@/config/dbConfig'
import { INPUT_CONFIG } from '@/config/inputConfig'
import type { DataLayerResult, Stock } from '@/data/types'
import { fetchStockBasic, fetchStockKline } from '@/services/fetcher/fetcherService'
import { MOCK_STOCK_LIBRARY, type MockStock } from './mockStockLibrary'

export interface AddStockInput {
  symbol: string
  name: string
}

export type StockSearchResult = MockStock

export interface PoolExportPayload {
  version: 'v9-pool-export-1'
  exportedAt: number
  stocks: Stock[]
}

export interface PoolImportResult {
  success: number
  failed: number
  errors: string[]
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

export interface AddStockOptions {
  /**
   * 是否在录入成功后立即拉取 AKShare 基础数据
   */
  fetchBasicAfterAdd?: boolean
  /**
   * 是否在录入成功后立即拉取 AKShare K线数据
   */
  fetchKlineAfterAdd?: boolean
  /**
   * 目标股票池分组，未指定时使用默认分组
   */
  group?: string
}

/**
 * 添加候选股票到意向候选池，并在需要时触发基础数据采集
 *
 * 通过 DataBridge.forward() 写入，确保 ACL 校验与审计日志。
 */
export async function addStock(
  input: AddStockInput,
  options: AddStockOptions = {},
): Promise<DataLayerResult<Stock>> {
  const symbol = normalizeSymbol(input.symbol)
  const name = input.name.trim()

  if (!symbol) {
    return { success: false, error: '股票代码不能为空' }
  }
  if (!name) {
    return { success: false, error: '股票名称不能为空' }
  }

  let stock: Stock = {
    symbol,
    name,
    researchStatus: RESEARCH_STATUS.candidate,
    source: 'manual',
    group: options.group ?? DEFAULT_POOL_GROUP,
    dataVersion: 1,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
  }

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.stockpool,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertStock,
      traceId: `input-${Date.now()}-${symbol}`,
    },
    stock,
  )

  try {
    await dataBridge.forward(envelope)

    if (options.fetchBasicAfterAdd) {
      const fetchResult = await fetchStockBasic(symbol)
      if (fetchResult.success && fetchResult.data) {
        stock = { ...fetchResult.data, group: stock.group }
      } else {
        return {
          success: true,
          data: stock,
          error: `录入成功，但基础数据拉取失败：${fetchResult.error ?? '未知错误'}`,
        }
      }
    }

    if (options.fetchKlineAfterAdd) {
      const klineResult = await fetchStockKline(symbol)
      if (klineResult.success && klineResult.data) {
        stock = { ...klineResult.data, group: stock.group }
      } else {
        return {
          success: true,
          data: stock,
          error: `录入成功，但 K线数据拉取失败：${klineResult.error ?? '未知错误'}`,
        }
      }
    }

    return { success: true, data: stock }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 从搜索结果录入股票
 */
export async function addStockFromSearch(
  result: StockSearchResult,
  options: AddStockOptions = {},
): Promise<DataLayerResult<Stock>> {
  return addStock({ symbol: result.symbol, name: result.name }, options)
}

/**
 * 搜索本地 mock 股票库
 *
 * 支持按代码、名称、行业进行大小写不敏感模糊匹配。
 * 当前为离线降级数据源，未来可切换为 AKShare 搜索接口。
 */
export function searchStocks(query: string): StockSearchResult[] {
  const trimmed = query.trim()
  if (trimmed.length < INPUT_CONFIG.search.minQueryLength) {
    return []
  }

  const lower = trimmed.toLowerCase()
  const matches = MOCK_STOCK_LIBRARY.filter(
    (s) =>
      s.symbol.toLowerCase().includes(lower) ||
      s.name.toLowerCase().includes(lower) ||
      s.industry.toLowerCase().includes(lower),
  )

  return matches.slice(0, INPUT_CONFIG.search.maxResults)
}

/**
 * 导出候选池（全部或按状态过滤）
 */
export async function exportPool(
  status?: ResearchStatus,
): Promise<DataLayerResult<PoolExportPayload>> {
  try {
    const list = status ? await dataLayer.stocks.listByStatus(status) : await dataLayer.stocks.list()
    return {
      success: true,
      data: {
        version: 'v9-pool-export-1',
        exportedAt: Date.now(),
        stocks: list,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 导入候选池
 *
 * 通过 DataBridge.forward() 逐条写入，避免 UI 层直接操作 dataLayer。
 */
export async function importPool(payload: PoolExportPayload): Promise<DataLayerResult<PoolImportResult>> {
  if (payload.version !== 'v9-pool-export-1') {
    return { success: false, error: '不兼容的导出文件版本' }
  }

  const result: PoolImportResult = { success: 0, failed: 0, errors: [] }

  for (const stock of payload.stocks) {
    try {
      const normalized = normalizeSymbol(stock.symbol)
      const existing = await dataLayer.stocks.get(normalized)
      if (existing) {
        result.failed++
        result.errors.push(`${normalized}: 已存在`)
        continue
      }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertStock,
          traceId: `import-${Date.now()}-${normalized}`,
        },
        {
          ...stock,
          symbol: normalized,
          researchStatus: stock.researchStatus ?? RESEARCH_STATUS.candidate,
          source: stock.source ?? 'import',
          group: stock.group ?? DEFAULT_POOL_GROUP,
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
      )
      await dataBridge.forward(envelope)
      result.success++
    } catch (err) {
      result.failed++
      result.errors.push(`${stock.symbol}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { success: true, data: result }
}

/**
 * @deprecated 使用带 options 的 addStock 替代
 */
export async function _legacyAddStock(input: AddStockInput): Promise<DataLayerResult<Stock>> {
  return addStock(input, { fetchBasicAfterAdd: false })
}

/**
 * 获取全部股票列表
 */
export async function listStocks(): Promise<DataLayerResult<Stock[]>> {
  try {
    const list = await dataLayer.stocks.list()
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 按研究状态获取股票列表
 */
export async function listStocksByStatus(status: ResearchStatus): Promise<DataLayerResult<Stock[]>> {
  try {
    const list = await dataLayer.stocks.listByStatus(status)
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
