/**
 * @doc [V9-DOC-BACK-006, V9-DOC-PROJ-079, V9-DOC-PROJ-113, V9-DOC-PROJ-107, V9-DOC-BACK-012]
 */
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'
import { RESEARCH_STATUS, type ResearchStatus } from '@/constants/pool.constants'
import { getDefaultScreeningConfig } from '@/config/screeningConfig'
import { dataBridge } from '@/core/databridge'
import type { DataLayerResult, Stock } from '@/data/types'
import { transitionPoolItem } from '@/services/pool/poolService'
import { POOL_TYPE } from '@/constants/pool.constants'

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
  if ((required.basic ?? false) === true && !q.basic) return false
  if ((required.kline ?? false) === true && !q.kline) return false
  if ((required.finance ?? false) === true && !q.finance) return false
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

  const v6Result = await dataBridge.query<{ score: number }>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.v6Scores,
    key: stock.symbol,
    source: MODULE_ID.analyzer,
  })
  if (!v6Result.success || !v6Result.data) return false

  return v6Result.data.score >= config.thresholds.minV6ScoreForScreened
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

  const v6Result = await dataBridge.query<{ score: number }>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.v6Scores,
    key: stock.symbol,
    source: MODULE_ID.analyzer,
  })
  const intelligentResult = await dataBridge.query<Array<{ overallScore: number | null; scoredAt: number }>>({
    action: ENVELOPE_ACTION.queryByIndex,
    store: STORE_NAME.intelligentScores,
    indexName: 'by-symbol',
    indexValue: stock.symbol,
    source: MODULE_ID.analyzer,
  })

  const v6Ok = v6Result.success && v6Result.data !== undefined && v6Result.data.score >= config.thresholds.minV6ScoreForDeepDive
  const latestIntelligent = intelligentResult.success && intelligentResult.data
    ? intelligentResult.data
        .filter((s) => s.overallScore !== null)
        .sort((a, b) => b.scoredAt - a.scoredAt)[0]
    : undefined
  const intelligentOk =
    latestIntelligent !== undefined &&
    latestIntelligent.overallScore !== null &&
    latestIntelligent.overallScore >= config.thresholds.minIntelligentScoreForDeepDive

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

  const transitionResult = await transitionPoolItem(stock.symbol, {
    pool: POOL_TYPE.research,
    status: toStatus,
    label: '筛选晋升',
  })
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
    const candidatesResult = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-status',
      indexValue: RESEARCH_STATUS.candidate,
      source: MODULE_ID.analyzer,
    })
    if (candidatesResult.success && candidatesResult.data) {
      for (const stock of candidatesResult.data) {
        await tryPromote(stock, RESEARCH_STATUS.screened, canPromoteToScreened, result, 'promotedToScreened')
      }
    }

    const screenedResult = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-status',
      indexValue: RESEARCH_STATUS.screened,
      source: MODULE_ID.analyzer,
    })
    if (screenedResult.success && screenedResult.data) {
      for (const stock of screenedResult.data) {
        await tryPromote(stock, RESEARCH_STATUS.deepDive, canPromoteToDeepDive, result, 'promotedToDeepDive')
      }
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
    const stockResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: symbol,
      source: MODULE_ID.analyzer,
    })
    if (!stockResult.success || !stockResult.data) {
      return { success: false, error: `股票不存在: ${symbol}` }
    }
    const stock = stockResult.data

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
