/**
 * @doc [V9-DOC-BACK-010, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-BACK-006]
 */
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import type { DailyQuotes, IndustryScore, IntelligentScore, ResearchLog, Stock, V6Score } from '@/data/types'

/**
 * loadStockForAnalysis
 * @param symbol
 * @returns Promise<Stock | undefined>
 */
export async function loadStockForAnalysis(symbol: string): Promise<Stock | undefined> {
  const result = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: symbol,
  })
  return result.success ? result.data : undefined
}

/**
 * loadV6ScoreForAnalysis
 * @param symbol
 * @returns Promise<V6Score | undefined>
 */
export async function loadV6ScoreForAnalysis(symbol: string): Promise<V6Score | undefined> {
  const result = await dataBridge.query<V6Score>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.v6Scores,
    key: symbol,
  })
  return result.success ? result.data : undefined
}

/**
 * loadDailyQuotesForAnalysis
 * @param symbol
 * @returns Promise<DailyQuotes | undefined>
 */
export async function loadDailyQuotesForAnalysis(symbol: string): Promise<DailyQuotes | undefined> {
  const result = await dataBridge.query<DailyQuotes>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.dailyQuotes,
    key: symbol,
  })
  return result.success ? result.data : undefined
}

/**
 * loadAllStocksForScoreSelect
 * @returns Promise<Stock[]>
 */
export async function loadAllStocksForScoreSelect(): Promise<Stock[]> {
  const result = await dataBridge.query<Stock[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.stocks,
  })
  return result.success ? result.data ?? [] : []
}

/**
 * loadIndustryScoreHistory
 * @param code
 * @returns Promise<IndustryScore[]>
 */
export async function loadIndustryScoreHistory(code: string): Promise<IndustryScore[]> {
  const result = await dataBridge.query<IndustryScore[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store: STORE_NAME.industryScores,
    indexName: 'by-code',
    indexValue: code,
  })
  const list = result.success ? result.data ?? [] : []
  return list.sort((a, b) => b.scoredAt - a.scoredAt)
}

/**
 * loadIntelligentScoreHistory
 * @param symbol
 * @returns Promise<IntelligentScore[]>
 */
export async function loadIntelligentScoreHistory(symbol: string): Promise<IntelligentScore[]> {
  const result = await dataBridge.query<IntelligentScore[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store: STORE_NAME.intelligentScores,
    indexName: 'by-symbol',
    indexValue: symbol,
  })
  const list = result.success ? result.data ?? [] : []
  return list.sort((a, b) => b.scoredAt - a.scoredAt)
}

/**
 * loadResearchLogsForTarget
 * @param targetCode
 * @returns Promise<ResearchLog[]>
 */
export async function loadResearchLogsForTarget(targetCode: string): Promise<ResearchLog[]> {
  const result = await dataBridge.query<ResearchLog[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.researchLogs,
  })
  const allLogs = result.success ? result.data ?? [] : []
  return allLogs.filter((log) => log.targetCode === targetCode)
}
