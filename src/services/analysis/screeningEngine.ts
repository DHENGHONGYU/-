import { RESEARCH_STATUS, type ResearchStatus } from '@/config/dbConfig'
import { getDefaultScreeningConfig } from '@/config/screeningConfig'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, Stock } from '@/data/types'
import { transitionStock } from '@/services/stockpool/stockpoolService'

export interface ScreeningResult {
  promotedToScreened: string[]
  promotedToDeepDive: string[]
  errors: string[]
}

function isQualityOk(
  stock: Stock,
  required: { basic?: boolean; kline?: boolean; finance?: boolean },
): boolean {
  const q = stock.dataQuality
  if (!q) return false
  if (required.basic && !q.basic) return false
  if (required.kline && !q.kline) return false
  if (required.finance && !q.finance) return false
  return true
}

async function canPromoteToScreened(stock: Stock): Promise<boolean> {
  if (stock.researchStatus !== RESEARCH_STATUS.candidate) return false

  const config = getDefaultScreeningConfig()
  const qualityOk = isQualityOk(stock, {
    basic: config.thresholds.requireBasicForScreened,
    kline: config.thresholds.requireKlineForScreened,
  })
  if (!qualityOk) return false

  const v6 = await dataLayer.v6Scores.get(stock.symbol)
  if (!v6) return false

  return v6.score >= config.thresholds.minV6ScoreForScreened
}

async function canPromoteToDeepDive(stock: Stock): Promise<boolean> {
  if (stock.researchStatus !== RESEARCH_STATUS.screened) return false

  const config = getDefaultScreeningConfig()
  const qualityOk = isQualityOk(stock, {
    basic: true,
    kline: true,
    finance: config.thresholds.requireFinanceForDeepDive,
  })
  if (!qualityOk) return false

  const v6 = await dataLayer.v6Scores.get(stock.symbol)
  const intelligent = await dataLayer.intelligentScores.getLatestBySymbol(stock.symbol)

  const v6Ok = v6 !== undefined && v6.score >= config.thresholds.minV6ScoreForDeepDive
  const intelligentOk =
    intelligent !== undefined &&
    intelligent.overallScore !== null &&
    intelligent.overallScore >= config.thresholds.minIntelligentScoreForDeepDive

  return v6Ok || intelligentOk
}

async function tryPromote(
  stock: Stock,
  toStatus: ResearchStatus,
  eligibility: (s: Stock) => Promise<boolean>,
  result: ScreeningResult,
  targetKey: 'promotedToScreened' | 'promotedToDeepDive',
): Promise<void> {
  const ok = await eligibility(stock)
  if (!ok) return

  const transitionResult = await transitionStock(stock.symbol, toStatus)
  if (transitionResult.success) {
    result[targetKey].push(stock.symbol)
  } else {
    result.errors.push(`${stock.symbol}: ${transitionResult.error ?? '流转失败'}`)
  }
}

/**
 * 对全量股票池运行筛选规则
 *
 * 按以下顺序执行：
 * 1. candidate → screened
 * 2. screened → deepDive
 */
export async function runScreening(): Promise<DataLayerResult<ScreeningResult>> {
  const result: ScreeningResult = {
    promotedToScreened: [],
    promotedToDeepDive: [],
    errors: [],
  }

  try {
    const candidates = await dataLayer.stocks.listByStatus(RESEARCH_STATUS.candidate)
    for (const stock of candidates) {
      await tryPromote(stock, RESEARCH_STATUS.screened, canPromoteToScreened, result, 'promotedToScreened')
    }

    const screened = await dataLayer.stocks.listByStatus(RESEARCH_STATUS.screened)
    for (const stock of screened) {
      await tryPromote(stock, RESEARCH_STATUS.deepDive, canPromoteToDeepDive, result, 'promotedToDeepDive')
    }

    return { success: true, data: result }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 对单只股票执行即时筛选
 *
 * 仅当股票处于 candidate 或 screened 时可能晋升；其他状态无动作。
 */
export async function screenSingleStock(symbol: string): Promise<DataLayerResult<ScreeningResult>> {
  const result: ScreeningResult = {
    promotedToScreened: [],
    promotedToDeepDive: [],
    errors: [],
  }

  try {
    const stock = await dataLayer.stocks.get(symbol)
    if (!stock) {
      return { success: false, error: `股票不存在: ${symbol}` }
    }

    if (stock.researchStatus === RESEARCH_STATUS.candidate) {
      await tryPromote(stock, RESEARCH_STATUS.screened, canPromoteToScreened, result, 'promotedToScreened')
    } else if (stock.researchStatus === RESEARCH_STATUS.screened) {
      await tryPromote(stock, RESEARCH_STATUS.deepDive, canPromoteToDeepDive, result, 'promotedToDeepDive')
    }

    return { success: true, data: result }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
