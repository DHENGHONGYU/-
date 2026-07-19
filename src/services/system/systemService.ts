/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { dataBridge } from '@/core/databridge'
import { exportAll as dbExportAll, importAll as dbImportAll, resetAll as dbResetAll } from '@/core/databridgeQueries'
import { MODULE_ID, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import type { DataLayerResult } from '@/data/types'

export interface SystemStats {
  stocks: number
  orders: number
  scores: number
}

/**
 * loadSystemStats
 * @returns Promise<DataLayerResult<SystemStats>>
 */
export async function loadSystemStats(): Promise<DataLayerResult<SystemStats>> {
  try {
    const [stocksResult, ordersResult, scoresResult] = await Promise.all([
      dataBridge.query<unknown[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks, source: MODULE_ID.system }),
      dataBridge.query<unknown[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.orders, source: MODULE_ID.system }),
      dataBridge.query<unknown[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.v6Scores, source: MODULE_ID.system }),
    ])
    return {
      success: true,
      data: {
        stocks: stocksResult.success && stocksResult.data ? stocksResult.data.length : 0,
        orders: ordersResult.success && ordersResult.data ? ordersResult.data.length : 0,
        scores: scoresResult.success && scoresResult.data ? scoresResult.data.length : 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * resetAll
 * @returns Promise<DataLayerResult<void>>
 */
export async function resetAll(): Promise<DataLayerResult<void>> {
  return dbResetAll()
}

/**
 * exportAll
 * @returns Promise<DataLayerResult<Record<string, unknown[]>>>
 */
export async function exportAll(): Promise<DataLayerResult<Record<string, unknown[]>>> {
  return dbExportAll()
}

/**
 * importAll
 * @param data
 * @param unknown[]>
 * @returns Promise<DataLayerResult<void>>
 */
export async function importAll(data: Record<string, unknown[]>): Promise<DataLayerResult<void>> {
  return dbImportAll(data)
}
