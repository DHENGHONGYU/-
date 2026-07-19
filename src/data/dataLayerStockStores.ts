/**
 * @fileoverview 股票/行情/财报 Store
 *
 * 从 dataLayer.ts 拆分而来，包含：
 * - stockStore: 股票池 CRUD（add/get/list/listByStatus/listByGroups/updateStatus/updateGroup/remove）
 * - dailyQuoteStore: 日行情 save/get
 * - financialReportStore: 财报 save/get/list（含详细日志）
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/
import { DATA_SOURCE, STORE_NAME } from '@/config/dbConfig'
import {
  DEFAULT_POOL_GROUP,
  DEFAULT_POOL_TYPE,
  RESEARCH_STATUS,
  type ResearchStatus,
} from '@/constants/pool.constants'
import { getLogger } from '@/lib/logger'
import { now } from './db'
import type { DataLayerResult, DailyQuotes, FinancialReport, Stock } from './types'
import { sendWriteEnvelope, queryGet, queryList, queryByIndex } from './dataLayerHelpers'

const logger = getLogger()

export const stockStore = {
  async add(stock: Omit<Stock, 'createdAt' | 'updatedAt' | 'dataVersion'>): Promise<DataLayerResult<Stock>> {
    const existing = await queryGet<Stock>(STORE_NAME.stocks, stock.symbol)
    if (existing) {
      return { success: false, error: `${stock.name}(${stock.symbol}) 已存在` }
    }

    const fullStock: Stock = {
      ...stock,
      pool: stock.pool ?? DEFAULT_POOL_TYPE,
      researchStatus: stock.researchStatus ?? RESEARCH_STATUS.candidate,
      source: stock.source ?? DATA_SOURCE.manual,
      group: stock.group ?? DEFAULT_POOL_GROUP,
      dataVersion: 1,
      ingestedAt: now(),
      updatedAt: now(),
    }

    const result = await sendWriteEnvelope<Stock>('insertStock', fullStock, 'pool')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: fullStock }
  },

  async get(symbol: string): Promise<Stock | undefined> {
    return queryGet<Stock>(STORE_NAME.stocks, symbol)
  },

  async list(): Promise<Stock[]> {
    return queryList<Stock>(STORE_NAME.stocks)
  },

  async listByStatus(status: ResearchStatus): Promise<Stock[]> {
    return queryByIndex<Stock>(STORE_NAME.stocks, 'by-status', status)
  },

  async listByGroup(group: string): Promise<Stock[]> {
    return queryByIndex<Stock>(STORE_NAME.stocks, 'by-group', group)
  },

  async listGroups(): Promise<string[]> {
    const all = await queryList<Stock>(STORE_NAME.stocks)
    const groups = new Set<string>()
    for (const stock of all) {
      groups.add(stock.group ?? DEFAULT_POOL_GROUP)
    }
    groups.add(DEFAULT_POOL_GROUP)
    return Array.from(groups).sort()
  },

  async updateStatus(symbol: string, status: ResearchStatus): Promise<DataLayerResult<void>> {
    const existing = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!existing) {
      return { success: false, error: `Stock not found: ${symbol}` }
    }

    return sendWriteEnvelope<void>(
      'updateStock',
      { symbol, researchStatus: status, updatedAt: now() },
      'pool',
    )
  },

  async updateGroup(symbol: string, group: string): Promise<DataLayerResult<Stock>> {
    const normalized = group.trim()
    if (!normalized) {
      return { success: false, error: '分组名称不能为空' }
    }

    const existing = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!existing) {
      return { success: false, error: `Stock not found: ${symbol}` }
    }

    const result = await sendWriteEnvelope<Stock>(
      'updateStock',
      { symbol, group: normalized, updatedAt: now() },
      'pool',
    )
    if (!result.success) {
      return { success: false, error: result.error }
    }

    const updated = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!updated) {
      return { success: false, error: `更新分组后未找到股票: ${symbol}` }
    }
    return { success: true, data: updated }
  },

  async remove(symbol: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope<void>('deleteStock', { symbol }, 'pool')
  },
}

export const dailyQuoteStore = {
  async save(quotes: DailyQuotes): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope<void>('saveDailyQuotes', quotes, 'fetcher')
  },

  async get(symbol: string): Promise<DailyQuotes | undefined> {
    return queryGet<DailyQuotes>(STORE_NAME.dailyQuotes, symbol)
  },
}

export const financialReportStore = {
  async save(report: FinancialReport): Promise<DataLayerResult<void>> {
    logger.info('[dataLayer.financialReportStore] save 开始', {
      symbol: report.symbol,
      reportDate: report.reportDate,
    })
    const result = await sendWriteEnvelope<void>('saveFinancialReport', report, 'fetcher')
    if (result.success) {
      logger.info('[dataLayer.financialReportStore] save 成功', {
        symbol: report.symbol,
        reportDate: report.reportDate,
      })
    } else {
      logger.error('[dataLayer.financialReportStore] save 失败', {
        symbol: report.symbol,
        error: result.error,
      })
    }
    return result
  },

  async get(symbol: string): Promise<FinancialReport | undefined> {
    const report = await queryGet<FinancialReport>(STORE_NAME.financialReports, symbol)
    if (report) {
      logger.info('[dataLayer.financialReportStore] get 成功', {
        symbol,
        reportDate: report.reportDate,
        revenue: report.revenue,
        netProfit: report.netProfit,
      })
    } else {
      logger.info('[dataLayer.financialReportStore] get 未找到', { symbol })
    }
    return report
  },

  async list(): Promise<FinancialReport[]> {
    return queryList<FinancialReport>(STORE_NAME.financialReports)
  },
}
