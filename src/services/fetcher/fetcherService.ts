import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, DailyQuotes, Stock } from '@/data/types'
import { adaptBasicDataToStock, adaptKlineDataToDailyQuotes } from './fetcherAdapter'
import { collectBasic, collectKline, checkFetcherHealth } from './fetcherClient'

const logger = getLogger()

function createTraceId(symbol: string): string {
  return `fetcher-${Date.now()}-${symbol}-${Math.random().toString(36).slice(2, 7)}`
}

async function sendUpdateStock(
  update: Partial<Stock> & { symbol: string },
): Promise<DataLayerResult<Stock>> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: createTraceId(update.symbol),
      },
      update,
    )
    await dataBridge.forward(envelope)

    const updated = await dataLayer.stocks.get(update.symbol)
    if (!updated) {
      return { success: false, error: `更新后未找到股票: ${update.symbol}` }
    }
    return { success: true, data: updated }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[fetcherService] 更新股票失败', { symbol: update.symbol, error: message })
    return { success: false, error: message }
  }
}

async function sendSaveDailyQuotes(quotes: DailyQuotes): Promise<DataLayerResult<void>> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveDailyQuotes,
        traceId: createTraceId(quotes.symbol),
      },
      quotes,
    )
    await dataBridge.forward(envelope)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[fetcherService] 保存 K线数据失败', { symbol: quotes.symbol, error: message })
    return { success: false, error: message }
  }
}

/**
 * 检查数据采集服务健康状态
 */
export { checkFetcherHealth }

/**
 * 拉取单只股票基础数据并更新本地 Stock
 */
export async function fetchStockBasic(symbol: string): Promise<DataLayerResult<Stock>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return { success: false, error: '股票代码不能为空' }
  }

  const existing = await dataLayer.stocks.get(normalized)
  if (!existing) {
    return { success: false, error: `股票不存在: ${normalized}` }
  }

  const response = await collectBasic(normalized)
  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? '采集基础数据失败',
    }
  }

  const update = adaptBasicDataToStock(normalized, response.data, existing)
  update.dataVersion = (existing.dataVersion ?? 1) + 1
  update.dataQuality = {
    ...(existing.dataQuality ?? { kline: false }),
    basic: true,
    finance: response.data.roe !== undefined && !Number.isNaN(response.data.roe),
    lastChecked: Date.now(),
  }
  return sendUpdateStock(update as Partial<Stock> & { symbol: string })
}

/**
 * 批量拉取基础数据
 */
export async function fetchStocksBasic(symbols: string[]): Promise<DataLayerResult<Stock[]>> {
  const results: Stock[] = []
  const errors: string[] = []

  for (const symbol of symbols) {
    const result = await fetchStockBasic(symbol)
    if (result.success && result.data) {
      results.push(result.data)
    } else {
      errors.push(`${symbol}: ${result.error ?? '失败'}`)
    }
  }

  if (results.length === 0 && errors.length > 0) {
    return { success: false, error: errors.join('; ') }
  }

  return { success: true, data: results }
}

export interface FetchKlineOptions {
  period?: 'daily' | 'weekly' | 'monthly'
  adjust?: 'qfq' | 'hfq' | ''
  startDate?: string
  endDate?: string
}

/**
 * 拉取单只股票 K线数据，保存到 daily_quotes 并同步更新 Stock.price
 */
export async function fetchStockKline(
  symbol: string,
  options: FetchKlineOptions = {},
): Promise<DataLayerResult<Stock>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return { success: false, error: '股票代码不能为空' }
  }

  const existing = await dataLayer.stocks.get(normalized)
  if (!existing) {
    return { success: false, error: `股票不存在: ${normalized}` }
  }

  const response = await collectKline({
    symbol: normalized,
    period: options.period ?? 'daily',
    adjust: options.adjust ?? 'qfq',
    start_date: options.startDate,
    end_date: options.endDate,
  })

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? '采集 K线数据失败',
    }
  }

  const quotes = adaptKlineDataToDailyQuotes(
    normalized,
    response.data,
    options.period ?? 'daily',
    options.adjust ?? 'qfq',
  )
  if (!quotes) {
    return { success: false, error: 'K线数据为空或格式不正确' }
  }

  const saveResult = await sendSaveDailyQuotes(quotes)
  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  const update: Partial<Stock> & { symbol: string } = {
    symbol: normalized,
    price: quotes.latest.close,
    source: existing.source === 'manual' ? 'akshare' : existing.source,
    dataVersion: (existing.dataVersion ?? 1) + 1,
    updatedAt: Date.now(),
    dataQuality: {
      ...(existing.dataQuality ?? { basic: false, finance: false }),
      kline: true,
      lastChecked: Date.now(),
    },
  }

  return sendUpdateStock(update)
}

/**
 * 刷新本地某只股票：拉取最新基础数据并更新
 */
export async function refreshSymbol(symbol: string): Promise<DataLayerResult<Stock>> {
  return fetchStockBasic(symbol)
}

/**
 * 刷新本地某只股票行情：拉取 K线并更新 price
 */
export async function refreshSymbolKline(
  symbol: string,
  options?: FetchKlineOptions,
): Promise<DataLayerResult<Stock>> {
  return fetchStockKline(symbol, options)
}
