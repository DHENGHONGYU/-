/**
 * @module services/useCase/getUnifiedStockView.useCase
 * @description 统一股票视图融合用例
 *
 * 将原先 unifiedStockService 中跨 dataLayer 多源读取的长流程逻辑抽取为 UseCase，
 * 使 Service 层保持薄入口，复杂编排下沉到 UseCase。
 */

import { STORE_NAME } from '@/config/dbConfig'
import { queryGet, queryList, queryByIndex } from '@/data/dataLayerHelpers'
import { getLogger } from '@/lib/logger'
import type {
  DailyQuotes,
  DataLayerResult,
  IndustryScore,
  IntelligentScore,
  PortfolioHolding,
  RotationSectorScore,
  Signal,
  Stock,
  V6Score,
} from '@/data/types'

const logger = getLogger()

export interface UnifiedStockView {
  /** 股票基础信息 */
  stock: Stock
  /** K线数据（可选） */
  quotes?: DailyQuotes
  /** V6 自动评分（可选） */
  v6Score?: V6Score
  /** 智能评分（可选） */
  intelligentScore?: IntelligentScore
  /** 行业评分（可选） */
  industryScore?: IndustryScore
  /** 板块轮动评分（可选） */
  rotationScore?: RotationSectorScore
  /** 最新信号（可选） */
  signal?: Signal
  /** 持仓信息（可选） */
  holding?: PortfolioHolding
  /** 数据质量指标 */
  quality: {
    /** 数据完整度 (0-100) */
    completeness: number
    /** 数据新鲜度（最新更新时间） */
    freshness: number
    /** 缺失数据源列表 */
    missing: string[]
  }
  /** 融合时间戳 */
  fusedAt: number
}

export interface FusionOptions {
  includeQuotes?: boolean
  includeV6Score?: boolean
  includeIntelligentScore?: boolean
  includeIndustryScore?: boolean
  includeRotationScore?: boolean
  includeSignal?: boolean
  includeHolding?: boolean
}

const DEFAULT_OPTIONS: FusionOptions = {
  includeQuotes: true,
  includeV6Score: true,
  includeIntelligentScore: false,
  includeIndustryScore: false,
  includeRotationScore: false,
  includeSignal: false,
  includeHolding: false,
}

/**
 * getUnifiedStockViewUseCase
 */
export async function getUnifiedStockViewUseCase(
  symbol: string,
  options: FusionOptions = DEFAULT_OPTIONS,
): Promise<DataLayerResult<UnifiedStockView>> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    const stock = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!stock) {
      return { success: false, error: `Stock not found: ${symbol}` }
    }

    const missing: string[] = []
    const timestamps: number[] = [stock.updatedAt ?? Date.now()]

    let quotes: DailyQuotes | undefined
    if (opts.includeQuotes) {
      quotes = await queryGet<DailyQuotes>(STORE_NAME.dailyQuotes, symbol)
      if (quotes) timestamps.push(quotes.updatedAt ?? Date.now())
      else missing.push('quotes')
    }

    let v6Score: V6Score | undefined
    if (opts.includeV6Score) {
      v6Score = await queryGet<V6Score>(STORE_NAME.v6Scores, symbol)
      if (v6Score) timestamps.push(v6Score.calculatedAt)
      else missing.push('v6Score')
    }

    let intelligentScore: IntelligentScore | undefined
    if (opts.includeIntelligentScore) {
      const intelligentScores = await queryByIndex<IntelligentScore>(STORE_NAME.intelligentScores, 'by-symbol', symbol)
      intelligentScore = intelligentScores.sort((a, b) => b.scoredAt - a.scoredAt)[0]
      if (intelligentScore) timestamps.push(intelligentScore.scoredAt)
      else missing.push('intelligentScore')
    }

    let industryScore: IndustryScore | undefined
    if (opts.includeIndustryScore) {
      const scores = await queryByIndex<IndustryScore>(STORE_NAME.industryScores, 'by-code', stock.sector ?? '')
      industryScore = scores.sort((a, b) => b.scoredAt - a.scoredAt)[0]
      if (industryScore) timestamps.push(industryScore.scoredAt)
      else missing.push('industryScore')
    }

    let rotationScore: RotationSectorScore | undefined
    if (opts.includeRotationScore) {
      const scores = await queryList<RotationSectorScore>(STORE_NAME.rotationScores)
      rotationScore = scores.find((s) => s.sectorCode === stock.industryCode)
      if (rotationScore) timestamps.push(rotationScore.createdAt ? new Date(rotationScore.createdAt).getTime() : Date.now())
      else missing.push('rotationScore')
    }

    let signal: Signal | undefined
    if (opts.includeSignal) {
      const allSignals = await queryList<Signal>(STORE_NAME.signals)
      const signals = allSignals.filter((s) => s.symbol === symbol).sort((a, b) => b.createdAt - a.createdAt)
      signal = signals[0]
      if (signal) timestamps.push(signal.createdAt)
      else missing.push('signal')
    }

    let holding: PortfolioHolding | undefined
    if (opts.includeHolding) {
      // TODO: 待 dataLayer 实现 holdings 存储后启用
      missing.push('holding')
    }

    const totalSources = Object.keys(opts).filter((k) => k.startsWith('include') && opts[k as keyof FusionOptions]).length
    const completeness = ((totalSources - missing.length) / totalSources) * 100
    const freshness = Math.max(...timestamps)

    logger.info(`[GetUnifiedStockViewUseCase] ${symbol} 融合完成`, {
      completeness: `${completeness.toFixed(0)}%`,
      missing,
      sources: totalSources,
    })

    return {
      success: true,
      data: {
        stock,
        quotes,
        v6Score,
        intelligentScore,
        industryScore,
        rotationScore,
        signal,
        holding,
        quality: {
          completeness,
          freshness,
          missing,
        },
        fusedAt: Date.now(),
      },
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error(`[GetUnifiedStockViewUseCase] ${symbol} 融合失败`, { error })
    return { success: false, error }
  }
}

/**
 * getUnifiedStockViewsUseCase
 */
export async function getUnifiedStockViewsUseCase(
  symbols: string[],
  options: FusionOptions = DEFAULT_OPTIONS,
): Promise<DataLayerResult<UnifiedStockView[]>> {
  try {
    const results = await Promise.all(symbols.map((symbol) => getUnifiedStockViewUseCase(symbol, options)))
    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      const errors = failed.map((r) => r.error ?? 'unknown').join('; ')
      logger.warn(`[GetUnifiedStockViewsUseCase] 批量融合部分失败`, { failed: failed.length, total: symbols.length })
      return { success: false, error: errors }
    }
    return { success: true, data: results.map((r) => r.data!) }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error('[GetUnifiedStockViewsUseCase] 批量融合失败', { error })
    return { success: false, error }
  }
}

/**
 * getUnifiedStockViewsByStatusUseCase
 */
export async function getUnifiedStockViewsByStatusUseCase(
  status: string,
  options: FusionOptions = DEFAULT_OPTIONS,
): Promise<DataLayerResult<UnifiedStockView[]>> {
  try {
    const stocks = await queryList<Stock>(STORE_NAME.stocks)
    const filtered = stocks.filter((s) => s.researchStatus === status)
    return getUnifiedStockViewsUseCase(filtered.map((s) => s.symbol), options)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { success: false, error }
  }
}

/**
 * getScoreViewUseCase
 * @param symbol
 * @returns Promise<DataLayerResult<
 */
export async function getScoreViewUseCase(symbol: string): Promise<DataLayerResult<{
  stock: Stock
  v6Score?: V6Score
  intelligentScore?: IntelligentScore
  industryScore?: IndustryScore
  completeness: number
}>> {
  const result = await getUnifiedStockViewUseCase(symbol, {
    includeQuotes: false,
    includeV6Score: true,
    includeIntelligentScore: true,
    includeIndustryScore: true,
    includeRotationScore: false,
    includeSignal: false,
    includeHolding: false,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const view = result.data!
  return {
    success: true,
    data: {
      stock: view.stock,
      v6Score: view.v6Score,
      intelligentScore: view.intelligentScore,
      industryScore: view.industryScore,
      completeness: view.quality.completeness,
    },
  }
}

/**
 * getTradingViewUseCase
 * @param symbol
 * @returns Promise<DataLayerResult<
 */
export async function getTradingViewUseCase(symbol: string): Promise<DataLayerResult<{
  stock: Stock
  quotes?: DailyQuotes
  v6Score?: V6Score
  signal?: Signal
  holding?: PortfolioHolding
  completeness: number
}>> {
  const result = await getUnifiedStockViewUseCase(symbol, {
    includeQuotes: true,
    includeV6Score: true,
    includeIntelligentScore: false,
    includeIndustryScore: false,
    includeRotationScore: false,
    includeSignal: true,
    includeHolding: true,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const view = result.data!
  return {
    success: true,
    data: {
      stock: view.stock,
      quotes: view.quotes,
      v6Score: view.v6Score,
      signal: view.signal,
      holding: view.holding,
      completeness: view.quality.completeness,
    },
  }
}
