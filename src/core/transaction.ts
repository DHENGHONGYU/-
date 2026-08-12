/**
 * @module core/transaction
 * @description 事务管理器 — 提供跨 store 原子事务执行能力
 *
 * 作为 core 层与 data 层之间的薄适配器，将 IndexedDB 事务能力暴露给 services/useCase
 * 等上层模块，避免业务用例直接依赖 data/db 内部实现。
  * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
*/

import type { StoreName } from '@/config/dbConfig'
import { db } from '@/data/db'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type TransactionMode = IDBTransactionMode

/**
 * 在 IndexedDB 事务中执行回调。
 *
 * 委托 V6Database.withTransaction 实现，确保多 store 读写具有相同的原子语义。
 * 调用方需保证数据库已初始化（db.init() 已完成）。
 *
 * @param storeNames 参与事务的 store 名称列表
 * @param mode 事务模式（readonly / readwrite）
 * @param callback 接收 IDBTransaction 的回调函数
 * @returns 回调返回值
/**
 * runInTransaction
 */
export async function runInTransaction<T>(
  storeNames: StoreName[],
  mode: TransactionMode,
  callback: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const startTs = Date.now()
  logger.info(`[Transaction] runInTransaction() called: stores=[${storeNames.join(', ')}], mode="${mode}"`)

  try {
    const result = await db.withTransaction(storeNames, mode, callback)
    const duration = Date.now() - startTs
    logger.info(`[Transaction] runInTransaction() completed: stores=[${storeNames.join(', ')}], mode="${mode}", duration=${duration}ms`)
    return result
  } catch (err) {
    const duration = Date.now() - startTs
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[Transaction] runInTransaction() failed: stores=[${storeNames.join(', ')}], mode="${mode}", duration=${duration}ms`, { error: message })
    throw err
  }
}
