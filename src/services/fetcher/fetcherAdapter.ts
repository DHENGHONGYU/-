import { DATA_SOURCE } from '@/config/dbConfig'
import type { DailyQuotes, FinancialReport, KlineBar, Stock } from '@/data/types'
import type { CollectBasicData, CollectFinancialData, CollectKlineData } from './fetcherTypes'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 将 AKShare / Python 服务返回的基础数据转换为 V9 Stock 更新对象
 *
 * 注意：
 * - 不修改 symbol 与 researchStatus 等本地字段，仅更新来自外部数据源的可变字段。
 * - source 标记为 akshare，dataVersion 由调用方递增。
 */
export function adaptBasicDataToStock(
  symbol: string,
  data: CollectBasicData,
  _existing?: Stock,
): Partial<Stock> {
  const update: Partial<Stock> = {
    symbol,
    source: DATA_SOURCE.akshare,
    updatedAt: Date.now(),
  }

  if (data.name !== undefined && data.name.trim().length > 0) {
    update.name = data.name.trim()
  }
  if (data.price !== undefined && !Number.isNaN(data.price)) {
    update.price = data.price
  }
  if (data.pe !== undefined && !Number.isNaN(data.pe)) {
    update.pe = data.pe
  }
  if (data.pb !== undefined && !Number.isNaN(data.pb)) {
    update.pb = data.pb
  }
  if (data.roe !== undefined && !Number.isNaN(data.roe)) {
    update.roe = data.roe
  }
  if (data.market_cap !== undefined && !Number.isNaN(data.market_cap)) {
    update.marketCap = data.market_cap
  }

  return update
}

function isValidKlineBar(bar: unknown): bar is KlineBar {
  if (!bar || typeof bar !== 'object') return false
  const b = bar as Record<string, unknown>
  return (
    typeof b.date === 'string' &&
    typeof b.open === 'number' &&
    typeof b.high === 'number' &&
    typeof b.low === 'number' &&
    typeof b.close === 'number' &&
    typeof b.volume === 'number' &&
    typeof b.amount === 'number'
  )
}

/**
 * 将 AKShare / Python 服务返回的 K线数据转换为 V9 DailyQuotes
 */
export function adaptKlineDataToDailyQuotes(
  symbol: string,
  data: CollectKlineData,
  period = 'daily',
  adjust = 'qfq',
): DailyQuotes | null {
  const history = (data.history ?? []).filter(isValidKlineBar)
  const latest = data.latest && isValidKlineBar(data.latest) ? data.latest : history[history.length - 1]

  if (!latest) {
    return null
  }

  return {
    symbol,
    latest,
    history,
    period,
    adjust,
    updatedAt: Date.now(),
  }
}

/**
 * 判断 Stock 是否已包含可用于评分的真实基础数据
 */
export function hasRealBasicData(stock: Stock): boolean {
  return (
    stock.price !== undefined &&
    stock.pe !== undefined &&
    stock.pb !== undefined &&
    stock.roe !== undefined &&
    stock.marketCap !== undefined
  )
}

/**
 * 判断 DailyQuotes 是否包含足够历史用于动量/波动/流动性计算
 */
export function hasEnoughHistory(quotes: DailyQuotes | undefined, minBars = 20): boolean {
  return quotes !== undefined && quotes.history.length >= minBars && quotes.latest !== undefined
}

/**
 * 将 AKShare / Python 服务返回的财务数据转换为 V9 FinancialReport
 */
export function adaptFinancialDataToReport(
  symbol: string,
  data: CollectFinancialData,
): FinancialReport | null {
  logger.info('[fetcherAdapter] adaptFinancialDataToReport 开始转换', {
    symbol,
    reportDate: data.report_date,
    revenue: data.revenue,
    netProfit: data.net_profit,
    grossMargin: data.gross_margin,
    netMargin: data.net_margin,
  })

  if (!data.report_date) {
    logger.error('[fetcherAdapter] adaptFinancialDataToReport 转换失败: report_date 为空', {
      symbol,
      data,
    })
    return null
  }

  const report: FinancialReport = {
    symbol,
    reportDate: data.report_date,
    revenue: data.revenue,
    revenueYoY: data.revenue_yoy,
    netProfit: data.net_profit,
    netProfitYoY: data.net_profit_yoy,
    grossMargin: data.gross_margin,
    netMargin: data.net_margin,
    operatingCF: data.operating_cf,
    rdRatio: data.rd_ratio,
    receivables: data.receivables,
    inventoryTurnoverDays: data.inventory_turnover_days,
    interestBearingDebt: data.interest_bearing_debt,
    goodwill: data.goodwill,
    netAssets: data.net_assets,
    shareholderPledge: data.shareholder_pledge,
    updatedAt: Date.now(),
  }

  logger.info('[fetcherAdapter] adaptFinancialDataToReport 转换成功', {
    symbol,
    reportDate: report.reportDate,
    fieldCount: Object.keys(report).length,
    hasRevenue: report.revenue !== undefined,
    hasNetProfit: report.netProfit !== undefined,
    hasGrossMargin: report.grossMargin !== undefined,
  })

  return report
}
