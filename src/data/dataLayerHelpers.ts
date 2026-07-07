/**
 * @fileoverview dataLayer 共享辅助函数
 *
 * 从 dataLayer.ts 拆分而来，职责：
 * - 提供 createTraceId / sendWriteEnvelope / queryGet / queryList / queryByIndex
 * - 被所有 domain store 文件共享，避免重复实现
 *
 * 设计原则：这些函数是无状态的纯工具函数，仅依赖 dataBridge / logger / envelope，
 * 可被任意 store 文件安全引入。
 */
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  type StoreName,
} from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult } from './types'

import { nanoid } from 'nanoid'
const logger = getLogger()

/**
 * 生成带前缀的 traceId
 */
export function createTraceId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`
}

/**
 * 通过 DataBridge 转发写操作信封
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
        traceId: createTraceId('dl'),
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
 * 查询单条记录（通过主键）
 */
export async function queryGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const result = await dataBridge.query<T>({
    action: ENVELOPE_ACTION.queryGet,
    store,
    key,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[dataLayer] queryGet failed: store="${store}", key="${key}"`, { error: result.error })
    return undefined
  }
  return result.data
}

/**
 * 查询全部记录
 */
export async function queryList<T>(store: StoreName): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryList,
    store,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[dataLayer] queryList failed: store="${store}"`, { error: result.error })
    return []
  }
  return result.data ?? []
}

/**
 * 按索引查询记录
 */
export async function queryByIndex<T>(store: StoreName, indexName: string, indexValue: unknown): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store,
    indexName,
    indexValue,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[dataLayer] queryByIndex failed: store="${store}", index="${indexName}"`, { error: result.error })
    return []
  }
  return result.data ?? []
}
