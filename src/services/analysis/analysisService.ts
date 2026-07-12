import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { DataLayerResult, Stock, V6Score } from '@/data/types'

/**
 * 获取全部标的列表
 */
export async function listStocks(): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.analyzer,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
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
    const result = await dataBridge.query<V6Score[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.v6Scores,
      source: MODULE_ID.analyzer,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
