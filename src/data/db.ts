import { DB_NAME, DB_VERSION, STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { createSchema } from './db-schema'
import { runMigrations, MIGRATIONS } from './db-migrations'

// === 工具函数重新导出（PR-6 步骤 1.1：从 db-utils.ts 拆分） ===
// 保持 '@/data/db' 路径向后兼容，所有调用点零修改
export { generateId, now } from './db-utils'

const logger = getLogger()

const STORE_NAMES = Object.values(STORE_NAME)

// === 迁移框架重新导出（PR-6 步骤 1.2：从 db-migrations.ts 拆分） ===
// 保持 '@/data/db' 路径向后兼容，所有调用点零修改
export { runMigrations, MIGRATIONS } from './db-migrations'
export type { Migration, MigrationContext } from './db-migrations'

let dbInstance: IDBDatabase | null = null

function deleteDB(): Promise<void> {
  logger.info('[DB] Initiating database deletion...')
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => {
      logger.info('[DB] Database deleted successfully')
      resolve()
    }
    request.onerror = () => {
      logger.error('[DB] Failed to delete database:', request.error ? { error: request.error.message } : undefined)
      reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
    }
    request.onblocked = () => {
      logger.warn('[DB] Database delete blocked - other tabs may have active connections')
      reject(new Error('Database delete blocked'))
    }
  })
}

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    logger.debug('[DB] Returning existing database instance')
    return Promise.resolve(dbInstance)
  }

  logger.info(`[DB] Opening database "${DB_NAME}" with target version ${DB_VERSION}...`)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      const error = request.error
      logger.error('[DB] Database open request failed:', error?.message ? { error: error.message } : undefined)
      if (error?.name === 'VersionError') {
        logger.warn(`[DB] Version conflict: existing DB version higher than requested v${DB_VERSION}`)
        if (import.meta.env.DEV) {
          logger.warn('[DB] DEV mode: attempting to delete old database and recreate...')
          deleteDB()
            .then(() => {
              dbInstance = null
              logger.info('[DB] Reopening database after deletion...')
              openDB().then(resolve).catch(reject)
            })
            .catch((e) => {
              logger.error('[DB] Failed to delete old database:', { error: e instanceof Error ? e.message : String(e) })
              dbInstance = null
              reject(error)
            })
        } else {
          logger.error('[DB] Production mode: refusing to auto-delete existing data')
          reject(new Error('数据库版本冲突，请清除浏览器缓存后重试'))
        }
      } else {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result
      logger.info(`[DB] Database opened successfully. Current version: ${dbInstance.version}`)
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const req = event.target as IDBOpenDBRequest | null
      const db = req?.result as IDBDatabase
      const oldVersion = (event).oldVersion
      const upgradeTx = req?.transaction
      logger.info(`[DB] Upgrade needed: v${oldVersion} → v${DB_VERSION} | Existing stores: [${Array.from(db.objectStoreNames).join(', ')}]`)

      // Schema 创建委托给 db-schema.ts（PR-6 步骤 1.3）
      createSchema(db, request, logger)

      // ── D-01：运行已注册迁移（在基线 Schema 就绪后） ──
      runMigrations(db, oldVersion, DB_VERSION, MIGRATIONS, logger, upgradeTx ?? undefined)

      logger.info(`[DB] Schema upgrade complete. Final stores: [${Array.from(db.objectStoreNames).join(', ')}]`)
    }
  })
}

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
    await this._readyPromise
    logger.debug('[DB] Database initialization confirmed ready')
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

        tx.oncomplete = () => {
          logger.info('[DB] withTransaction completed')
        }
        tx.onabort = () => {
          if (!settled) {
            settled = true
            reject(new Error('Transaction aborted'))
          }
        }
        tx.onerror = () => {
          if (!settled) {
            settled = true
            reject(tx.error instanceof Error ? tx.error : new Error(String(tx.error)))
          }
        }

        Promise.resolve(callback(tx))
          .then((result) => {
            if (!settled) {
              settled = true
              resolve(result)
            }
          })
          .catch((err) => {
            if (!settled) {
              settled = true
              logger.error('[DB] withTransaction callback error, aborting', {
                error: err instanceof Error ? err.message : String(err),
              })
              tx.abort()
              reject(err instanceof Error ? err : new Error(String(err)))
            }
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

  async import(data: Record<string, unknown[]>): Promise<void> {
    try {
      logger.info('[DB] import: starting data import')
      for (const storeName of STORE_NAMES) {
        await this.clear(storeName)
        const items = data[storeName] ?? []
        logger.debug(`[DB] import: importing ${items.length} items to store="${storeName}"`)
        for (const item of items) {
          await this.put(storeName, item)
        }
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
