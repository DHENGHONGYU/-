import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION } from '@/config/dbConfig'
import type { DataLayerResult } from '@/data/types'

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
    const [stocks, orders, scores] = await Promise.all([
      dataLayer.stocks.list(),
      dataLayer.orders.list(),
      dataLayer.v6Scores.list(),
    ])
    return {
      success: true,
      data: {
        stocks: stocks.length,
        orders: orders.length,
        scores: scores.length,
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
      traceId: `system-reset-${Date.now()}`,
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
      traceId: `system-export-${Date.now()}`,
    },
    {},
  )

  try {
    await dataBridge.forward(envelope)
    const data = await dataLayer.manager.export()
    return { success: true, data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
