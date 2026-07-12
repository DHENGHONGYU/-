/**
 * @fileoverview IndexedDB 连接管理
 *
 * 从 db.ts 拆分而来（PR-6 步骤 1.4），职责：
 * - 管理 dbInstance 单例状态
 * - 提供 openDB()：含 VersionError 重试、Schema 委托、Migration 委托
 * - 提供 deleteDB()：销毁数据库
 * - 提供 resetDbInstance()：测试间状态重置
 *
 * 设计原则：纯连接管理，不持有 V6Database 业务状态。
 * 通过 db.ts 的 re-export 保持 '@/data/db' 内部调用兼容。
 */
import { DB_NAME, DB_VERSION } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { createSchema } from './db-schema'
import { runMigrations, MIGRATIONS } from './db-migrations'

const logger = getLogger()

let dbInstance: IDBDatabase | null = null

/**
 * 重置 dbInstance 状态（仅供测试使用）
 * 业务代码禁止调用，否则会导致连接泄露
 */
export function resetDbInstance(): void {
  dbInstance = null
}

/**
 * 获取当前缓存的 dbInstance（仅供测试与诊断使用）
 * 业务代码应通过 openDB() 获取连接
 */
export function getDbInstance(): IDBDatabase | null {
  return dbInstance
}

/**
 * 销毁当前数据库（用于 VersionError 冲突或手动重置）
 */
export function deleteDB(): Promise<void> {
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

/**
 * 打开/复用 IndexedDB 连接
 *
 * 行为说明：
 * 1. 若 dbInstance 已存在，直接复用（缓存命中）
 * 2. 若发生 VersionError（浏览器中存在更高版本 DB）：
 *    - DEV 模式：自动 deleteDB 后递归重试
 *    - PROD 模式：拒绝自动删除，抛出友好错误
 * 3. onupgradeneeded 回调中委托 createSchema + runMigrations
 *
 * @returns IDBDatabase 实例
 */
export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    logger.debug('[DB] Returning existing database instance')
    return Promise.resolve(dbInstance)
  }

  logger.info(`[DB] Opening database "${DB_NAME}" with target version ${DB_VERSION}...`)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      const error = request.error
      logger.error('[DB] Database open request failed:', error?.message != null ? { error: error.message } : undefined)
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
      const oldVersion = event.oldVersion
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
