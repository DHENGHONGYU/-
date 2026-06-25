import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, Stock, V6Score } from '@/data/types'

/**
 * 获取全部标的列表
 */
export async function listStocks(): Promise<DataLayerResult<Stock[]>> {
  try {
    const list = await dataLayer.stocks.list()
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取全部 V6 评分
 */
export async function listV6Scores(): Promise<DataLayerResult<V6Score[]>> {
  try {
    const list = await dataLayer.v6Scores.list()
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
