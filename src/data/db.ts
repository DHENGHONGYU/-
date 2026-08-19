/**
 * @doc []
 */
import { STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { openDB, resetDbInstance } from './db-connection'

// === 工具函数重新导出（PR-6 步骤 1.1：从 db-utils.ts 拆分） ===
// 保持 '@/data/db' 路径向后兼容，所有调用点零修改
export { generateId, now } from './db-utils'

// === 迁移框架重新导出（PR-6 步骤 1.2：从 db-migrations.ts 拆分） ===
// 保持 '@/data/db' 路径向后兼容，所有调用点零修改
export { runMigrations, MIGRATIONS } from './db-migrations'
export type { Migration, MigrationContext } from './db-migrations'

// === 连接管理重新导出（PR-6 步骤 1.4：从 db-connection.ts 拆分） ===
// 仅供测试与诊断使用，业务代码应通过 V6Database.init() 获取连接
export { deleteDB, resetDbInstance, getDbInstance } from './db-connection'

const logger = getLogger()

const STORE_NAMES = Object.values(STORE_NAME)

export class V6Database {
  private db: IDBDatabase | null = null
  private _readyPromise: Promise<void> | null = null
  private _readyResolve: (() => void) | null = null
  private _isReady = false

  constructor() {
    this._readyPromise = new Promise<void>((resolve) => {
      this._readyResolve = resolve
    })
  }

  async init(): Promise<void> {
    try {
      if (this._isReady) {
        logger.debug('[DB] V6Database.init() called but already initialized, skipping')
        return
      }
      logger.info('[DB] V6Database.init() called')
      this.db = await openDB()
      this._isReady = true
      this._readyResolve?.()
      logger.info('[DB] V6Database.init() completed, database ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DB] V6Database.init() failed', { error: message })
      throw err
    }
  }

  isReady(): boolean {
    return this._isReady
  }

  async ready(): Promise<void> {
    if (this._isReady) {
      return
    }
    logger.debug('[DB] Waiting for database initialization...')

    // P0-8 修复：给 _readyPromise 加 5s 超时守卫，防止 vitest 环境下 db.init()
    // 未被调用时 forever pending（vitest 全局无 beforeAll db.init / 测试文件忘记调用）。
    // 超时抛明确错误：修复前表现为 "test hangs forever"，极难定位；
    // 修复后直接抛 Error 并给出 "test file missing db.init()" 提示。
    await new Promise<void>((resolve, reject) => {
      let settled = false

      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error(
          '[DB] ready() timeout after 5000ms. ' +
          'Database not initialized. Call db.init() first or ensure tests/setup.ts global ' +
          'beforeAll db.init() is enabled. If using vitest environment=node, consider calling ' +
          'db.init() in your test file beforeAll. Make sure import \"fake-indexeddb/auto\" runs ' +
          'before any db module import.'
        ))
      }, 5000)

      Promise.resolve(this._readyPromise)
        .then(() => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve()
        })
        .catch((err) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          reject(err)
        })
    })

    logger.debug('[DB] Database initialization confirmed ready')
  }

  /**
   * 关闭数据库连接并重置单例状态（供测试间串行运行时重置 db 单例使用）
   *
   * 行为：
   * 1. 关闭底层 IDBDatabase 连接（若存在）
   * 2. 重置 _isReady 标志和 db 引用
   * 3. 清空 db-connection 中的 dbInstance 缓存
   * 4. 重建 ready Promise，使下次 init() 能重新打开全新连接
   *
   * 业务代码禁止调用。
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close()
      } catch (err) {
        logger.warn('[DB] V6Database.close() error while closing IDBDatabase', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
      this.db = null
    }
    this._isReady = false
    resetDbInstance()
    this._readyPromise = new Promise<void>((resolve) => {
      this._readyResolve = resolve
    })
    logger.info('[DB] V6Database.close() completed, instance reset for reuse')
  }

  /**
   * 在跨 store 事务中执行回调。
   * 回调接收同一个 IDBTransaction，确保多 store 写入的原子性。
   *
   * @param storeNames 参与事务的 store 名列表
   * @param mode 事务模式
   * @param callback 事务回调
   * @returns 回调返回值
   */
  withTransaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    try {
      const db = this.ensureDB()
      logger.info(`[DB] withTransaction started: stores=[${storeNames.join(', ')}], mode=${mode}`)

      return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeNames, mode)
        let settled = false

        const settleOnce = (kind: 'resolve' | 'reject', value: T | Error): boolean => {
          if (settled) return false
          settled = true
          if (kind === 'resolve') {
            resolve(value as T)
          } else {
            reject(value instanceof Error ? value : new Error(String(value)))
          }
          return true
        }

        tx.oncomplete = () => {
          logger.info('[DB] withTransaction completed')
        }
        tx.onabort = () => {
          settleOnce('reject', new Error('Transaction aborted'))
        }
        tx.onerror = () => {
          settleOnce('reject', tx.error instanceof Error ? tx.error : new Error(String(tx.error)))
        }

        Promise.resolve(callback(tx))
          .then((result) => {
            settleOnce('resolve', result)
          })
          .catch((err) => {
            logger.error('[DB] withTransaction callback error, aborting', {
              error: err instanceof Error ? err.message : String(err),
            })
            tx.abort()
            settleOnce('reject', err instanceof Error ? err : new Error(String(err)))
          })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DB] withTransaction failed', { error: message })
      throw err
    }
  }

  /**
   * 获取底层 IDBDatabase 实例的只读访问方法。
   * 供 core/transaction 等需要直接操作事务的模块使用。
   */
  getDatabase(): IDBDatabase {
    return this.ensureDB()
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    return this.db
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    try {
      const db = this.ensureDB()
      logger.debug(`[DB] get: store="${storeName}", key="${key}"`)
      return await new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] get failed: store="${storeName}", key="${key}"`, { error: message })
      throw err
    }
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    try {
      const db = this.ensureDB()
      logger.debug(`[DB] getAll: store="${storeName}"`)
      return await new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] getAll failed: store="${storeName}"`, { error: message })
      throw err
    }
  }

  async getAllByIndex<T>(
    storeName: string,
    indexName: string,
    value: string,
  ): Promise<T[]> {
    try {
      const db = this.ensureDB()
      logger.debug(`[DB] getAllByIndex: store="${storeName}", index="${indexName}", value="${value}"`)
      return await new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const index = store.index(indexName)
        const request = index.getAll(value)
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] getAllByIndex failed: store="${storeName}", index="${indexName}"`, { error: message })
      throw err
    }
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    try {
      const db = this.ensureDB()
      logger.debug(`[DB] put: store="${storeName}"`)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.put(value)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] put failed: store="${storeName}"`, { error: message })
      throw err
    }
  }

  async delete(storeName: string, key: string): Promise<void> {
    try {
      const db = this.ensureDB()
      logger.debug(`[DB] delete: store="${storeName}", key="${key}"`)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.delete(key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] delete failed: store="${storeName}", key="${key}"`, { error: message })
      throw err
    }
  }

  async clear(storeName: string): Promise<void> {
    try {
      const db = this.ensureDB()
      logger.warn(`[DB] clear: store="${storeName}"`)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] clear failed: store="${storeName}"`, { error: message })
      throw err
    }
  }

  /**
   * 按索引批量删除匹配记录（级联删除使用）
   *
   * @param storeName 目标 store 名
   * @param indexName 索引名
   * @param value 索引值
   * @returns 实际删除的记录条数
   */
  async deleteByIndex(storeName: string, indexName: string, value: string): Promise<number> {
    try {
      const db = this.ensureDB()
      logger.debug(`[DB] deleteByIndex: store="${storeName}", index="${indexName}", value="${value}"`)
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const index = store.index(indexName)
        const request = index.getAllKeys(value)
        let deletedCount = 0
        request.onsuccess = () => {
          const keys = request.result
          deletedCount = keys.length
          for (const key of keys) {
            store.delete(key)
          }
        }
        request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
        tx.oncomplete = () => resolve(deletedCount)
        tx.onerror = () => reject(tx.error instanceof Error ? tx.error : new Error(String(tx.error)))
        tx.onabort = () => reject(new Error('[DB] deleteByIndex transaction aborted'))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DB] deleteByIndex failed: store="${storeName}", index="${indexName}", value="${value}"`, { error: message })
      throw err
    }
  }

  async reset(): Promise<void> {
    try {
      this.ensureDB()
      logger.warn('[DB] reset: clearing all stores')
      for (const storeName of STORE_NAMES) {
        await this.clear(storeName)
      }
      logger.info('[DB] reset completed successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DB] reset failed', { error: message })
      throw err
    }
  }

  async export(): Promise<Record<string, unknown[]>> {
    try {
      logger.info('[DB] export: starting data export')
      const result: Record<string, unknown[]> = {}
      for (const storeName of STORE_NAMES) {
        result[storeName] = await this.getAll(storeName)
      }
      logger.info('[DB] export completed successfully')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DB] export failed', { error: message })
      throw err
    }
  }

  private async importStoreItems(storeName: typeof STORE_NAMES[number], items: unknown[]): Promise<void> {
    await this.clear(storeName)
    for (const item of items) {
      await this.put(storeName, item)
    }
  }

  async import(data: Record<string, unknown[]>): Promise<void> {
    try {
      logger.info('[DB] import: starting data import')
      for (const storeName of STORE_NAMES) {
        const items = data[storeName] ?? []
        logger.debug(`[DB] import: importing ${items.length} items to store="${storeName}"`)
        await this.importStoreItems(storeName, items)
      }
      logger.info('[DB] import completed successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DB] import failed', { error: message })
      throw err
    }
  }
}

export const db = new V6Database()

/**
 * 关闭数据库连接并重置单例（供测试使用）
 *
 * 等价于 db.close()，关闭底层 IDBDatabase 连接并重置 V6Database 状态，
 * 使下一次 db.init() 能重新打开全新连接。用于同一进程串行运行多个测试
 * 文件时重置 db 单例，解决 fake-indexeddb 状态冲突。
 */
export function close(): void {
  db.close()
}
