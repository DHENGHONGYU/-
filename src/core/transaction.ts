/**
 * @module core/transaction
 * @description 跨 store 事务编排工具
 *
 * 提供 services/ 层可调用的统一事务入口，封装 IndexedDB transaction 生命周期，
 * 包含自动回滚、错误处理、超时机制（默认30秒），
 * 避免 services/ 直接依赖 db.ts 内部类。
 */

import { db } from '@/data/db'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type TransactionCallback<T> = (tx: IDBTransaction) => Promise<T> | T

/**
 * 事务超时默认值（毫秒）
 */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * 在多个 IndexedDB store 的事务中执行回调，保证原子性。
 * 包含自动回滚、错误处理和超时机制。
 *
 * @param storeNames 参与事务的 store 名称列表
 * @param mode 事务模式：'readonly' | 'readwrite'
 * @param callback 事务回调，接收同一个 IDBTransaction
 * @param timeoutMs 超时时间（毫秒），默认 30000（30秒）
 * @returns 回调返回值
 */
export async function runInTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: TransactionCallback<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const startTs = Date.now()
  logger.info(`[Transaction] runInTransaction 开始: stores=[${storeNames.join(', ')}], mode=${mode}, timeout=${timeoutMs}ms`)

  await db.ready()
  logger.info(`[Transaction] 数据库就绪, 等待耗时 ${Date.now() - startTs}ms`)

  return db.withTransaction(storeNames, mode, (tx) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        logger.error(`[Transaction] 事务超时, 强制回滚: timeout=${timeoutMs}ms, stores=[${storeNames.join(', ')}]`)
        try {
          tx.abort()
        } catch {
          // tx may already be finished/aborted
        }
        reject(new Error(`Transaction timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    const callbackPromise = Promise.resolve(callback(tx))

    return Promise.race([callbackPromise, timeoutPromise])
      .catch((err) => {
        const elapsed = Date.now() - startTs
        logger.error(`[Transaction] 事务回滚: stores=[${storeNames.join(', ')}], elapsed=${elapsed}ms`, {
          error: err instanceof Error ? err.message : String(err),
        })
        try {
          tx.abort()
        } catch {
          // tx may already be finished/aborted
        }
        throw err
      })
      .finally(() => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
      })
  }).then((result) => {
    const elapsed = Date.now() - startTs
    logger.info(`[Transaction] runInTransaction 提交成功: stores=[${storeNames.join(', ')}], elapsed=${elapsed}ms`)
    return result
  }).catch((err) => {
    const elapsed = Date.now() - startTs
    logger.error(`[Transaction] runInTransaction 失败: stores=[${storeNames.join(', ')}], elapsed=${elapsed}ms`, {
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  })
}
