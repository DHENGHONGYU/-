/**
 * @module services/useCase/fetchIndustryDashboard.useCase
 * @description 行业仪表盘数据加载用例 — 从 IndustryDashboardPage 提取的业务编排逻辑
 *
 * 业务流程（4步）：
 * 1. 并行查询股票列表 + 财务报告 + 行情数据
 * 2. 组装 StockWithData（股票+财报+行情）
 * 3. 调用 industryAnalysisService 本地 V4 分析
 * 4. 计算轮动信号并返回合并结果
 *
 * @see Clean Architecture Use Case Interactor 模式
 * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { runFullIndustryAnalysisEnhanced } from '@/services/analysis/industryAnalysisService'
import { generateRotationSignals } from '@/services/analysis/industryV4Analyzer'
import type {
  IndustryRotationSignal,
  IndustryV4AnalysisEnhanced,
} from '@/data/types/types.sector'
import type { Stock } from '@/data/types/types.stock'
import type { FinancialData, QuoteData } from '@/services/scoring/v6-engine/types'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface FetchIndustryDashboardInput {
  /** 是否强制刷新（忽略缓存） */
  forceRefresh?: boolean
  /** 沪深300 PE（用于估值分析） */
  hs300Pe?: number
  /** 沪深300 PB（用于估值分析） */
  hs300Pb?: number
}

export interface FetchIndustryDashboardResult {
  /** 是否成功 */
  success: boolean
  /** V4 行业分析列表 */
  v4Analyses: IndustryV4AnalysisEnhanced[]
  /** 行业轮动信号 */
  rotationSignals: IndustryRotationSignal[]
  /** 错误信息（成功时为 undefined） */
  error?: string
  /** 空态原因（数据为空时说明原因） */
  emptyReason?: string
}

// ============================================================
// 内部辅助
// ============================================================

interface StockWithFullData {
  stock: Stock
  financials: FinancialData
  quotes: QuoteData
}

/**
 * 从 dataBridge 加载股票、财报、行情数据
 */
async function loadStockData(): Promise<{
  success: boolean
  data: StockWithFullData[]
  error?: string
}> {
  try {
    logger.info('[fetchIndustryDashboardUseCase] 开始加载股票基础数据')

    // 并行查询三张表
    const [stocksResult, financialsResult, quotesResult] = await Promise.all([
      dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.analyzer,
      }),
      dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.financialReports,
        source: MODULE_ID.analyzer,
      }),
      dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.dailyQuotes,
        source: MODULE_ID.analyzer,
      }),
    ])

    if (!stocksResult.success) {
      return { success: false, data: [], error: stocksResult.error ?? '股票数据查询失败' }
    }
    if (!financialsResult.success) {
      return { success: false, data: [], error: financialsResult.error ?? '财报数据查询失败' }
    }
    if (!quotesResult.success) {
      return { success: false, data: [], error: quotesResult.error ?? '行情数据查询失败' }
    }

    const stocks = (stocksResult.data ?? []) as Stock[]
    const financials = (financialsResult.data ?? []) as Array<Record<string, unknown>>
    const quotes = (quotesResult.data ?? []) as Array<Record<string, unknown>>

    const financialMap = new Map(financials.map((f) => [String(f.symbol), f as FinancialData]))
    const quoteMap = new Map(quotes.map((q) => [String(q.symbol), q as QuoteData]))

    const stocksWithData: StockWithFullData[] = stocks.map((stock) => ({
      stock,
      financials: (financialMap.get(stock.symbol) ?? {
        revenueGrowth: null,
        profitGrowth: null,
        grossMargin: null,
        netMargin: null,
        roe: null,
        revenue: null,
        profit: null,
      }) as FinancialData,
      quotes: (quoteMap.get(stock.symbol) ?? {
        close: null,
        open: null,
        high: null,
        low: null,
        volume: null,
        turnover: null,
        change: null,
        changePercent: null,
        periodReturn: null,
        periodReturn1w: null,
        periodReturn1m: null,
        periodReturn3m: null,
        periodReturn6m: null,
        periodReturn1y: null,
      }) as QuoteData,
    }))

    logger.info('[fetchIndustryDashboardUseCase] 股票数据加载完成', {
      stockCount: stocks.length,
      withFinancials: financialMap.size,
      withQuotes: quoteMap.size,
    })

    return { success: true, data: stocksWithData }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[fetchIndustryDashboardUseCase] 股票数据加载失败', { error: message })
    return { success: false, data: [], error: message }
  }
}

// ============================================================
// UseCase
// ============================================================

/**
 * 行业仪表盘数据加载用例
 *
 * 从 dataBridge 加载股票+财报+行情数据，调用本地 V4 分析引擎，
 * 计算轮动信号，返回完整的仪表盘数据。
 *
 * @param input 查询参数
 * @returns 仪表盘数据
 */
export async function fetchIndustryDashboardUseCase(
  input: FetchIndustryDashboardInput = {},
): Promise<FetchIndustryDashboardResult> {
  logger.info('[fetchIndustryDashboardUseCase] 开始加载行业仪表盘数据', {
    forceRefresh: input.forceRefresh ?? false,
  })

  try {
    // 1. 加载股票+财报+行情数据
    const stockDataResult = await loadStockData()
    if (!stockDataResult.success) {
      return {
        success: false,
        v4Analyses: [],
        rotationSignals: [],
        error: stockDataResult.error,
      }
    }

    if (stockDataResult.data.length === 0) {
      return {
        success: true,
        v4Analyses: [],
        rotationSignals: [],
        emptyReason: '暂无股票数据，请先导入股票池',
      }
    }

    // 2. 调用本地 V4 分析引擎
    logger.info('[fetchIndustryDashboardUseCase] 调用本地 V4 分析引擎')
    const analysisResult = await runFullIndustryAnalysisEnhanced(stockDataResult.data, {
      forceRefresh: input.forceRefresh,
      hs300Pe: input.hs300Pe,
      hs300Pb: input.hs300Pb,
    })

    const v4Analyses = analysisResult.v4Analyses

    if (v4Analyses.length === 0) {
      return {
        success: true,
        v4Analyses: [],
        rotationSignals: [],
        emptyReason: '行业分析数据为空，请检查股票数据完整性',
      }
    }

    // 3. 计算轮动信号
    logger.info('[fetchIndustryDashboardUseCase] 计算行业轮动信号')
    const rotationSignals = generateRotationSignals(v4Analyses)

    logger.info('[fetchIndustryDashboardUseCase] 数据加载完成', {
      industryCount: v4Analyses.length,
      signalCount: rotationSignals.length,
    })

    return {
      success: true,
      v4Analyses,
      rotationSignals,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logger.error('[fetchIndustryDashboardUseCase] 数据加载失败', { error: message, stack })
    return {
      success: false,
      v4Analyses: [],
      rotationSignals: [],
      error: message,
    }
  }
}
