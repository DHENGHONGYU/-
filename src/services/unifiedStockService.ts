/**
 * 统一股票数据融合服务
 *
 * 整合股票的多源数据（基础数据、K线、评分、行业、信号、持仓），
 * 提供统一的融合视图，减少各模块对 dataLayer 的直接调用。
 *
 * 变更记录：
 * - v1.0.0 (2026-06-27): 初始版本，实现基础融合能力
 */

import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, Stock, DailyQuotes, V6Score, IntelligentScore, IndustryScore, RotationSectorScore, Signal, PortfolioHolding } from '@/data/types'

const logger = getLogger()

/**
 * 统一股票视图：融合所有数据源
 */
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

/**
 * 融合选项
 */
export interface FusionOptions {
  /** 是否加载 K线数据 */
  includeQuotes?: boolean
  /** 是否加载 V6 评分 */
  includeV6Score?: boolean
  /** 是否加载智能评分 */
  includeIntelligentScore?: boolean
  /** 是否加载行业评分 */
  includeIndustryScore?: boolean
  /** 是否加载板块轮动评分 */
  includeRotationScore?: boolean
  /** 是否加载最新信号 */
  includeSignal?: boolean
  /** 是否加载持仓 */
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
 * 获取统一股票视图
 */
export async function getUnifiedStockView(
  symbol: string,
  options: FusionOptions = DEFAULT_OPTIONS,
): Promise<DataLayerResult<UnifiedStockView>> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // 1. 获取基础数据
    const stock = await dataLayer.stocks.get(symbol)
    if (!stock) {
      return { success: false, error: `Stock not found: ${symbol}` }
    }

    const missing: string[] = []
    const timestamps: number[] = [stock.updatedAt ?? Date.now()]

    // 2. 可选数据源
    let quotes: DailyQuotes | undefined
    if (opts.includeQuotes) {
      quotes = await dataLayer.dailyQuotes.get(symbol)
      if (quotes) {
        timestamps.push(quotes.updatedAt ?? Date.now())
      } else {
        missing.push('quotes')
      }
    }

    let v6Score: V6Score | undefined
    if (opts.includeV6Score) {
      v6Score = await dataLayer.v6Scores.get(symbol)
      if (v6Score) {
        timestamps.push(v6Score.calculatedAt)
      } else {
        missing.push('v6Score')
      }
    }

    let intelligentScore: IntelligentScore | undefined
    if (opts.includeIntelligentScore) {
      intelligentScore = await dataLayer.intelligentScores.getLatestBySymbol(symbol)
      if (intelligentScore) {
        timestamps.push(intelligentScore.scoredAt)
      } else {
        missing.push('intelligentScore')
      }
    }

    let industryScore: IndustryScore | undefined
    if (opts.includeIndustryScore) {
      const scores = await dataLayer.industryScores.listByCode(stock.sector ?? '')
      industryScore = scores[0]
      if (industryScore) {
        timestamps.push(industryScore.scoredAt)
      } else {
        missing.push('industryScore')
      }
    }

    let rotationScore: RotationSectorScore | undefined
    if (opts.includeRotationScore) {
      const scores = await dataLayer.rotationScores.list()
      rotationScore = scores.find((s) => s.sectorCode === stock.sector)
      if (rotationScore) {
        timestamps.push(rotationScore.createdAt ? new Date(rotationScore.createdAt).getTime() : Date.now())
      } else {
        missing.push('rotationScore')
      }
    }

    let signal: Signal | undefined
    if (opts.includeSignal) {
      const signals = await dataLayer.signals.listBySymbol(symbol)
      signal = signals[0]
      if (signal) {
        timestamps.push(signal.createdAt)
      } else {
        missing.push('signal')
      }
    }

    // 注意：holdings 存储尚未在 dataLayer 中实现，暂不支持
    let holding: PortfolioHolding | undefined
    if (opts.includeHolding) {
      // TODO: 待 dataLayer 实现 holdings 存储后启用
      missing.push('holding')
    }

    // 3. 计算质量指标
    const totalSources = Object.keys(opts).filter((k) => k.startsWith('include') && opts[k as keyof FusionOptions]).length
    const completeness = ((totalSources - missing.length) / totalSources) * 100
    const freshness = Math.max(...timestamps)

    logger.info(`[UnifiedStockService] ${symbol} 融合完成`, {
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
    logger.error(`[UnifiedStockService] ${symbol} 融合失败`, { error })
    return { success: false, error }
  }
}

/**
 * 批量获取统一股票视图
 */
export async function getUnifiedStockViews(
  symbols: string[],
  options: FusionOptions = DEFAULT_OPTIONS,
): Promise<DataLayerResult<UnifiedStockView[]>> {
  try {
    const results = await Promise.all(symbols.map((symbol) => getUnifiedStockView(symbol, options)))
    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      const errors = failed.map((r) => r.error ?? 'unknown').join('; ')
      logger.warn(`[UnifiedStockService] 批量融合部分失败`, { failed: failed.length, total: symbols.length })
      return { success: false, error: errors }
    }
    return { success: true, data: results.map((r) => r.data!) }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error('[UnifiedStockService] 批量融合失败', { error })
    return { success: false, error }
  }
}

/**
 * 获取股票池的统一视图（按状态筛选）
 */
export async function getUnifiedStockViewsByStatus(
  status: string,
  options: FusionOptions = DEFAULT_OPTIONS,
): Promise<DataLayerResult<UnifiedStockView[]>> {
  try {
    const stocks = await dataLayer.stocks.list()
    const filtered = stocks.filter((s) => s.researchStatus === status)
    return getUnifiedStockViews(filtered.map((s) => s.symbol), options)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { success: false, error }
  }
}

/**
 * 获取完整评分视图（仅评分相关数据）
 */
export async function getScoreView(symbol: string): Promise<DataLayerResult<{
  stock: Stock
  v6Score?: V6Score
  intelligentScore?: IntelligentScore
  industryScore?: IndustryScore
  completeness: number
}>> {
  const result = await getUnifiedStockView(symbol, {
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
 * 获取交易决策视图（仅交易相关数据）
 */
export async function getTradingView(symbol: string): Promise<DataLayerResult<{
  stock: Stock
  quotes?: DailyQuotes
  v6Score?: V6Score
  signal?: Signal
  holding?: PortfolioHolding
  completeness: number
}>> {
  const result = await getUnifiedStockView(symbol, {
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