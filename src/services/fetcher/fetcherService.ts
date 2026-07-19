/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
 */
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, DailyQuotes, FinancialReport, Stock } from '@/data/types'
import { adaptBasicDataToStock, adaptFinancialDataToReport, adaptKlineDataToDailyQuotes } from './fetcherAdapter'
import { collectBasic, collectFinancial, collectKline, checkFetcherHealth } from './fetcherClient'

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

    const updatedResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: update.symbol,
      source: MODULE_ID.fetcher,
    })
    if (!updatedResult.success || !updatedResult.data) {
      return { success: false, error: `更新后未找到股票: ${update.symbol}` }
    }
    return { success: true, data: updatedResult.data }
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
    logger.warn('[fetcherService] fetchStockBasic 入参为空', { rawSymbol: symbol })
    return { success: false, error: '股票代码不能为空' }
  }

  logger.info('[fetcherService] fetchStockBasic 开始', { symbol: normalized })

  const existingResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.fetcher,
  })
  if (!existingResult.success || !existingResult.data) {
    logger.warn('[fetcherService] fetchStockBasic 股票不存在', { symbol: normalized })
    return { success: false, error: `股票不存在: ${normalized}` }
  }
  const existing = existingResult.data

  logger.info('[fetcherService] fetchStockBasic 本地股票已找到', {
    symbol: normalized,
    currentDataVersion: existing.dataVersion,
    currentSource: existing.source,
    currentPrice: existing.price,
  })

  const response = await collectBasic(normalized)
  if (!response.success || !response.data) {
    logger.error('[fetcherService] fetchStockBasic 采集接口返回失败', {
      symbol: normalized,
      error: response.error ?? '未知错误',
      success: response.success,
    })
    return {
      success: false,
      error: response.error ?? '采集基础数据失败',
    }
  }

  logger.info('[fetcherService] fetchStockBasic 采集成功', {
    symbol: normalized,
    fetchedName: response.data.name,
    fetchedPrice: response.data.price,
    fetchedPe: response.data.pe,
    fetchedPb: response.data.pb,
    fetchedRoe: response.data.roe,
    fetchedMarketCap: response.data.market_cap,
  })

  const update = adaptBasicDataToStock(normalized, response.data, existing)
  update.dataVersion = (existing.dataVersion ?? 1) + 1
  update.dataQuality = {
    ...(existing.dataQuality ?? { kline: false }),
    basic: true,
    finance: response.data.roe !== undefined && !Number.isNaN(response.data.roe),
    lastChecked: Date.now(),
  }

  logger.info('[fetcherService] fetchStockBasic 数据适配完成，准备写入 DB', {
    symbol: normalized,
    newDataVersion: update.dataVersion,
    dataQualityBasic: update.dataQuality.basic,
    dataQualityFinance: update.dataQuality.finance,
  })

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
    logger.warn('[fetcherService] fetchStockKline 入参为空', { rawSymbol: symbol })
    return { success: false, error: '股票代码不能为空' }
  }

  logger.info('[fetcherService] fetchStockKline 开始', {
    symbol: normalized,
    period: options.period ?? 'daily',
    adjust: options.adjust ?? 'qfq',
    startDate: options.startDate,
    endDate: options.endDate,
  })

  const existingResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.fetcher,
  })
  if (!existingResult.success || !existingResult.data) {
    logger.warn('[fetcherService] fetchStockKline 股票不存在', { symbol: normalized })
    return { success: false, error: `股票不存在: ${normalized}` }
  }
  const existing = existingResult.data

  logger.info('[fetcherService] fetchStockKline 本地股票已找到', {
    symbol: normalized,
    currentDataVersion: existing.dataVersion,
    currentPrice: existing.price,
  })

  const response = await collectKline({
    symbol: normalized,
    period: options.period ?? 'daily',
    adjust: options.adjust ?? 'qfq',
    start_date: options.startDate,
    end_date: options.endDate,
  })

  if (!response.success || !response.data) {
    logger.error('[fetcherService] fetchStockKline 采集接口返回失败', {
      symbol: normalized,
      error: response.error ?? '未知错误',
      success: response.success,
    })
    return {
      success: false,
      error: response.error ?? '采集 K线数据失败',
    }
  }

  logger.info('[fetcherService] fetchStockKline 采集成功', {
    symbol: normalized,
    dataCount: response.data?.history?.length ?? 0,
    firstDate: response.data?.history?.[0]?.date,
    lastDate: response.data?.history?.[response.data.history.length - 1]?.date,
  })

  const quotes = adaptKlineDataToDailyQuotes(
    normalized,
    response.data,
    options.period ?? 'daily',
    options.adjust ?? 'qfq',
  )
  if (!quotes) {
    logger.error('[fetcherService] fetchStockKline K线数据适配失败', {
      symbol: normalized,
      rawDataLength: response.data?.history?.length ?? 0,
    })
    return { success: false, error: 'K线数据为空或格式不正确' }
  }

  logger.info('[fetcherService] fetchStockKline 数据适配完成', {
    symbol: normalized,
    historyLength: quotes.history.length,
    latestClose: quotes.latest.close,
    latestDate: quotes.latest.date,
  })

  const saveResult = await sendSaveDailyQuotes(quotes)
  if (!saveResult.success) {
    logger.error('[fetcherService] fetchStockKline 保存 DailyQuotes 失败', {
      symbol: normalized,
      error: saveResult.error,
    })
    return { success: false, error: saveResult.error }
  }

  logger.info('[fetcherService] fetchStockKline DailyQuotes 已保存', {
    symbol: normalized,
  })

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

  logger.info('[fetcherService] fetchStockKline 准备更新 Stock', {
    symbol: normalized,
    newPrice: update.price,
    newDataVersion: update.dataVersion,
    sourceChanged: existing.source !== update.source,
  })

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

/**
 * 拉取单只股票财务数据并保存
 */
export async function fetchFinancial(
  symbol: string,
): Promise<DataLayerResult<FinancialReport>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    logger.warn('[fetcherService] fetchFinancial 入参为空', { rawSymbol: symbol })
    return { success: false, error: '股票代码不能为空' }
  }

  logger.info('[fetcherService] fetchFinancial 开始', { symbol: normalized })

  // 1. 调用采集接口
  logger.info('[fetcherService] fetchFinancial 调用 collectFinancial', { symbol: normalized })
  const response = await collectFinancial(normalized)

  if (!response.success || !response.data) {
    logger.error('[fetcherService] fetchFinancial 采集接口返回失败', {
      symbol: normalized,
      error: response.error ?? '未知错误',
      success: response.success,
    })
    return {
      success: false,
      error: response.error ?? '采集财务数据失败',
    }
  }

  logger.info('[fetcherService] fetchFinancial 采集成功', {
    symbol: normalized,
    reportDate: response.data.report_date,
    revenue: response.data.revenue,
    netProfit: response.data.net_profit,
    grossMargin: response.data.gross_margin,
    netMargin: response.data.net_margin,
    operatingCF: response.data.operating_cf,
    rdRatio: response.data.rd_ratio,
  })

  // 2. 数据适配
  logger.info('[fetcherService] fetchFinancial 开始数据适配', { symbol: normalized })
  const report = adaptFinancialDataToReport(normalized, response.data)

  if (!report) {
    logger.error('[fetcherService] fetchFinancial 数据适配失败', {
      symbol: normalized,
      rawData: response.data,
    })
    return { success: false, error: '财务数据为空或格式不正确' }
  }

  logger.info('[fetcherService] fetchFinancial 数据适配成功', {
    symbol: normalized,
    reportDate: report.reportDate,
    fieldCount: Object.keys(report).length,
    hasRevenue: report.revenue !== undefined,
    hasNetProfit: report.netProfit !== undefined,
    hasGrossMargin: report.grossMargin !== undefined,
  })

  // 3. 保存到数据库
  logger.info('[fetcherService] fetchFinancial 准备保存到 financial_reports', {
    symbol: normalized,
    reportDate: report.reportDate,
  })

  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveFinancialReport,
        traceId: createTraceId(normalized),
      },
      report,
    )

    logger.info('[fetcherService] fetchFinancial 创建信封成功', {
      symbol: normalized,
      traceId: envelope.meta.traceId,
      action: envelope.meta.action,
    })

    await dataBridge.forward(envelope)

    logger.info('[fetcherService] fetchFinancial DataBridge.forward 成功', {
      symbol: normalized,
      traceId: envelope.meta.traceId,
    })

    // 4. 验证保存结果
    logger.info('[fetcherService] fetchFinancial 开始验证保存结果', { symbol: normalized })
    const savedResult = await dataBridge.query<FinancialReport>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.financialReports,
      key: normalized,
      source: MODULE_ID.fetcher,
    })

    if (!savedResult.success || !savedResult.data) {
      logger.error('[fetcherService] fetchFinancial 验证失败: 保存后未找到记录', {
        symbol: normalized,
      })
      return { success: false, error: '保存后未找到财务数据记录' }
    }
    const saved = savedResult.data

    logger.info('[fetcherService] fetchFinancial 验证成功: 财务数据已保存', {
      symbol: normalized,
      reportDate: saved.reportDate,
      revenue: saved.revenue,
      netProfit: saved.netProfit,
      updatedAt: saved.updatedAt,
    })

    return { success: true, data: saved }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[fetcherService] fetchFinancial 保存过程异常', {
      symbol: normalized,
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    })
    return { success: false, error: message }
  }
}
