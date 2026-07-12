import type { V6Score, DataLayerResult } from '@/data/types'

export interface V6ScoreQuality {
  dataCompleteness: number
  hasQuotes: boolean
  hasBasicData: boolean
  missingLayers: string[]
}

export interface V6ScoreResult {
  success: boolean
  data?: V6Score
  error?: string
}

export interface V6ScoreService {
  runV6Score(symbol: string): Promise<V6ScoreResult>
  getV6ScoreQuality(symbol: string, factors: Record<string, number>): V6ScoreQuality
}

export interface FetcherService {
  fetchStockBasic(symbol: string): Promise<DataLayerResult<unknown>>
  fetchStockKline(symbol: string): Promise<DataLayerResult<unknown>>
  fetchFinancial(symbol: string): Promise<DataLayerResult<unknown>>
}
