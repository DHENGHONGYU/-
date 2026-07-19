/**
 * @fileoverview DataBridge 查询便捷封装
 *
 * 前身：dataLayer/helpers.ts（D1 迁移）
 * 归属：DataBridge 体系，明确所有数据访问统一经 DataBridge
 *
 * 职责：
 * - 提供 queryGet / queryList / queryByIndex / sendWriteEnvelope
 * - 提供系统管理操作：exportAll / importAll / resetAll
 * - 封装 DataBridge.query/forward 的调用样板，简化业务代码
 *
 * 设计原则：
 * - 纯工具函数，零状态，可被任意层安全引入
 * - 所有操作 100% 经由 DataBridge ACL + 审计，保证可追溯
 * - 系统管理操作（export/import/reset）先经 forward 校验，再执行实际操作
  * @doc [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008, V9-DOC-BACK-012, V9-DOC-PROJ-002]
*/
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  type StoreName,
} from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { createTraceId } from '@/lib/utils'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult } from '@/data/types'

const logger = getLogger()

/**
 * 通过 DataBridge 写入数据（封装 EnvelopeFactory + forward）。
 * Services 层推荐使用此函数而非直接调用 dataBridge.forward()。
 *
 * @param action - ENVELOPE_ACTION key
 * @param payload - 写入数据体
 * @param source - 来源模块（默认 'system'）
 * @returns DataLayerResult<T>，success=true 表示写入成功
 */
export async function sendWriteEnvelope<T>(
  action: keyof typeof ENVELOPE_ACTION,
  payload: unknown,
  source: keyof typeof MODULE_ID = 'system',
): Promise<DataLayerResult<T>> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID[source],
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION[action],
        traceId: createTraceId('dbq'),
      },
      payload,
    )
    await dataBridge.forward(envelope)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('DataBridge.forward failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * 按主键查询单条记录。
 * @param store - 目标 Store
 * @param key - 主键值
 */
export async function queryGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const result = await dataBridge.query<T>({
    action: ENVELOPE_ACTION.queryGet,
    store,
    key,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[databridgeQueries] queryGet failed: store="${store}", key="${key}"`, { error: result.error })
    return undefined
  }
  return result.data
}

/** 查询指定 Store 的全部记录。 */
export async function queryList<T>(store: StoreName): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryList,
    store,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[databridgeQueries] queryList failed: store="${store}"`, { error: result.error })
    return []
  }
  return result.data ?? []
}

/**
 * 按二级索引查询记录。
 * @param store - 目标 Store
 * @param indexName - 索引名称
 * @param indexValue - 索引值
 */
export async function queryByIndex<T>(
  store: StoreName,
  indexName: string,
  indexValue: unknown,
): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store,
    indexName,
    indexValue,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(
      `[databridgeQueries] queryByIndex failed: store="${store}", index="${indexName}"`,
      { error: result.error },
    )
    return []
  }
  return result.data ?? []
}

/** 导出全部 IndexedDB 数据为 JSON 对象（表名 → 记录数组）。 */
export async function exportAll(): Promise<DataLayerResult<Record<string, unknown[]>>> {
  try {
    const data = await dataBridge.exportAllData(MODULE_ID.system)
    logger.info('[databridgeQueries] exportAll completed', { tableCount: Object.keys(data).length })
    return { success: true, data }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('[databridgeQueries] exportAll failed', { error: message })
    return { success: false, error: message }
  }
}

/** 从 JSON 对象批量导入数据到 IndexedDB（表名 → 记录数组）。 */
export async function importAll(data: Record<string, unknown[]>): Promise<DataLayerResult<void>> {
  try {
    await dataBridge.importAllData(data, MODULE_ID.system)
    logger.info('[databridgeQueries] importAll completed', { tableCount: Object.keys(data).length })
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('[databridgeQueries] importAll failed', { error: message })
    return { success: false, error: message }
  }
}

/** 清空整个 IndexedDB 数据库并失效所有缓存。 */
export async function resetAll(): Promise<DataLayerResult<void>> {
  try {
    await dataBridge.resetAllData(MODULE_ID.system)
    logger.info('[databridgeQueries] resetAll completed')
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('[databridgeQueries] resetAll failed', { error: message })
    return { success: false, error: message }
  }
}
