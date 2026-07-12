import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { dataLayer } from '@/data/dataLayer'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import type { DataLayerResult } from '@/data/types'

import { nanoid } from 'nanoid'
export interface SystemStats {
  stocks: number
  orders: number
  scores: number
}

/**
 * 加载系统统计数量
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
 * 重置全部数据
 *
 * 通过 DataBridge.forward() 执行，确保 ACL 校验与审计日志。
 */
export async function resetAll(): Promise<DataLayerResult<void>> {
  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.system,
      target: ENVELOPE_TARGET.system,
      action: ENVELOPE_ACTION.resetAll,
      traceId: `system-reset-${nanoid(8)}`,
    },
    {},
  )

  try {
    await dataBridge.forward(envelope)
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 导出全部数据
 *
 * 通过 DataBridge.forward() 执行，确保 ACL 校验与审计日志。
 */
export async function exportAll(): Promise<DataLayerResult<Record<string, unknown[]>>> {
  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.system,
      target: ENVELOPE_TARGET.system,
      action: ENVELOPE_ACTION.exportAll,
      traceId: `system-export-${nanoid(8)}`,
    },
    {},
  )

  try {
    await dataBridge.forward(envelope)
    // TODO: dataLayer.manager.export() 需要后续迁移到 DataBridge
    const data = await dataLayer.manager.export()
    return { success: true, data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
