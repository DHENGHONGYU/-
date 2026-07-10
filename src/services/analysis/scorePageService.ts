import { dataLayer } from '@/data/dataLayer'
import type { DailyQuotes, IndustryScore, IntelligentScore, ResearchLog, Stock, V6Score } from '@/data/types'

/**
 * loadStockForAnalysis
 * @param symbol
 * @returns Promise<Stock | undefined>
 */
export async function loadStockForAnalysis(symbol: string): Promise<Stock | undefined> {
  return dataLayer.stocks.get(symbol)
}

/**
 * loadV6ScoreForAnalysis
 * @param symbol
 * @returns Promise<V6Score | undefined>
 */
export async function loadV6ScoreForAnalysis(symbol: string): Promise<V6Score | undefined> {
  return dataLayer.v6Scores.get(symbol)
}

/**
 * loadDailyQuotesForAnalysis
 * @param symbol
 * @returns Promise<DailyQuotes | undefined>
 */
export async function loadDailyQuotesForAnalysis(symbol: string): Promise<DailyQuotes | undefined> {
  return dataLayer.dailyQuotes.get(symbol)
}

/**
 * loadAllStocksForScoreSelect
 * @returns Promise<Stock[]>
 */
export async function loadAllStocksForScoreSelect(): Promise<Stock[]> {
  return dataLayer.stocks.list()
}

/**
 * loadIndustryScoreHistory
 * @param code
 * @returns Promise<IndustryScore[]>
 */
export async function loadIndustryScoreHistory(code: string): Promise<IndustryScore[]> {
  const list = await dataLayer.industryScores.listByCode(code)
  return list.sort((a, b) => b.scoredAt - a.scoredAt)
}

/**
 * loadIntelligentScoreHistory
 * @param symbol
 * @returns Promise<IntelligentScore[]>
 */
export async function loadIntelligentScoreHistory(symbol: string): Promise<IntelligentScore[]> {
  const list = await dataLayer.intelligentScores.listBySymbol(symbol)
  return list.sort((a, b) => b.scoredAt - a.scoredAt)
}

/**
 * loadResearchLogsForTarget
 * @param targetCode
 * @returns Promise<ResearchLog[]>
 */
export async function loadResearchLogsForTarget(targetCode: string): Promise<ResearchLog[]> {
  const allLogs = await dataLayer.researchLogs.list()
  return allLogs.filter((log) => log.targetCode === targetCode)
}
