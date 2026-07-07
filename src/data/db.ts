import { DB_NAME, DB_VERSION, DEFAULT_POOL_GROUP, STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'

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

      if (!db.objectStoreNames.contains(STORE_NAME.stocks)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.stocks}"`)
        const store = db.createObjectStore(STORE_NAME.stocks, { keyPath: 'symbol' })
        store.createIndex('by-status', 'researchStatus', { unique: false })
        store.createIndex('by-group', 'group', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.stocks}" already exists, checking indexes...`)
        const store = request.transaction?.objectStore(STORE_NAME.stocks)
        if (store && !store.indexNames.contains('by-group')) {
          logger.debug('[DB] Adding missing index: "by-group" on "stocks"')
          store.createIndex('by-group', 'group', { unique: false })
        }

        if (store) {
          const cursorRequest = store.openCursor()
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (cursor) {
              const stock = cursor.value as Record<string, unknown>
              if (stock.group === undefined) {
                logger.debug(`[DB] Backfilling missing "group" field for stock: ${String(stock.symbol)}`)
                stock.group = DEFAULT_POOL_GROUP
                cursor.update(stock)
              }
              cursor.continue()
            }
          }
        }
      }

      if (!db.objectStoreNames.contains(STORE_NAME.v6Scores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.v6Scores}"`)
        db.createObjectStore(STORE_NAME.v6Scores, { keyPath: 'symbol' })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.v6Scores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.intelligentScores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.intelligentScores}" with autoIncrement`)
        const scoreStore = db.createObjectStore(STORE_NAME.intelligentScores, {
          keyPath: 'id',
          autoIncrement: true,
        })
        scoreStore.createIndex('by-symbol', 'symbol', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.intelligentScores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.industryScores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.industryScores}" with autoIncrement`)
        const industryStore = db.createObjectStore(STORE_NAME.industryScores, {
          keyPath: 'id',
          autoIncrement: true,
        })
        industryStore.createIndex('by-code', 'code', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.industryScores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.orders)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.orders}"`)
        db.createObjectStore(STORE_NAME.orders, { keyPath: 'id' })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.orders}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.watchlists)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.watchlists}"`)
        db.createObjectStore(STORE_NAME.watchlists, { keyPath: 'id' })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.watchlists}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.signals)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.signals}"`)
        db.createObjectStore(STORE_NAME.signals, { keyPath: 'id' })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.signals}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.researchLogs)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.researchLogs}" with autoIncrement`)
        db.createObjectStore(STORE_NAME.researchLogs, {
          keyPath: 'id',
          autoIncrement: true,
        })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.researchLogs}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.dailyQuotes)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.dailyQuotes}"`)
        db.createObjectStore(STORE_NAME.dailyQuotes, { keyPath: 'symbol' })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.dailyQuotes}" already exists`)
      }

      // v6 新增：板块轮动评分
      if (!db.objectStoreNames.contains(STORE_NAME.rotationScores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.rotationScores}"`)
        const rotationStore = db.createObjectStore(STORE_NAME.rotationScores, { keyPath: 'id' })
        rotationStore.createIndex('by-sector-date', ['sectorCode', 'scoreDate'], { unique: true })
        rotationStore.createIndex('by-sector', 'sectorCode', { unique: false })
        rotationStore.createIndex('by-total', 'total', { unique: false })
        rotationStore.createIndex('by-resonance', 'resonance', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.rotationScores}" already exists`)
      }

      // v6 新增：十五五板块评分
      if (!db.objectStoreNames.contains(STORE_NAME.sectorScores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.sectorScores}"`)
        const sectorScoreStore = db.createObjectStore(STORE_NAME.sectorScores, { keyPath: 'id' })
        sectorScoreStore.createIndex('by-sector', 'sectorCode', { unique: false })
        sectorScoreStore.createIndex('by-composite', 'composite', { unique: false })
        sectorScoreStore.createIndex('by-is-core', 'isCore', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.sectorScores}" already exists`)
      }

      // v6 新增：评分文档版本库
      if (!db.objectStoreNames.contains(STORE_NAME.scoreDocs)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.scoreDocs}"`)
        const scoreDocStore = db.createObjectStore(STORE_NAME.scoreDocs, { keyPath: 'docId' })
        scoreDocStore.createIndex('by-symbol', 'symbol', { unique: false })
        scoreDocStore.createIndex('by-symbol-version', ['symbol', 'version'], { unique: true })
        scoreDocStore.createIndex('by-composite', 'composite', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.scoreDocs}" already exists`)
      }

      // v6 新增：策略快照
      if (!db.objectStoreNames.contains(STORE_NAME.strategySnapshots)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.strategySnapshots}"`)
        const snapshotStore = db.createObjectStore(STORE_NAME.strategySnapshots, { keyPath: 'id' })
        snapshotStore.createIndex('by-version', 'version', { unique: true })
        snapshotStore.createIndex('by-date', 'date', { unique: false })
        snapshotStore.createIndex('by-timestamp', 'timestamp', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.strategySnapshots}" already exists`)
      }

      // v6 新增：本地知识库
      if (!db.objectStoreNames.contains(STORE_NAME.localDocs)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.localDocs}"`)
        const localDocStore = db.createObjectStore(STORE_NAME.localDocs, { keyPath: 'id' })
        localDocStore.createIndex('by-symbol', 'symbol', { unique: false })
        localDocStore.createIndex('by-category', 'category', { unique: false })
        localDocStore.createIndex('by-added-at', 'addedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.localDocs}" already exists`)
      }

      // v6 新增：资讯文章
      if (!db.objectStoreNames.contains(STORE_NAME.news)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.news}"`)
        const newsStore = db.createObjectStore(STORE_NAME.news, { keyPath: 'id' })
        newsStore.createIndex('by-source', 'source', { unique: false })
        newsStore.createIndex('by-category', 'category', { unique: false })
        newsStore.createIndex('by-publish-time', 'publishTime', { unique: false })
        newsStore.createIndex('by-hash', 'hash', { unique: true })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.news}" already exists`)
      }

      // v6 新增：股票-资讯关联
      if (!db.objectStoreNames.contains(STORE_NAME.newsStockMap)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.newsStockMap}"`)
        const newsStockMapStore = db.createObjectStore(STORE_NAME.newsStockMap, { keyPath: 'id' })
        newsStockMapStore.createIndex('by-symbol', 'symbol', { unique: false })
        newsStockMapStore.createIndex('by-news', 'newsId', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.newsStockMap}" already exists`)
      }

      // v6 新增：情感分析缓存
      if (!db.objectStoreNames.contains(STORE_NAME.sentimentCache)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.sentimentCache}"`)
        const sentimentStore = db.createObjectStore(STORE_NAME.sentimentCache, { keyPath: 'id' })
        sentimentStore.createIndex('by-content-hash', 'contentHash', { unique: true })
        sentimentStore.createIndex('by-analyzed-at', 'analyzedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.sentimentCache}" already exists`)
      }

      // v13 新增：资讯收藏
      if (!db.objectStoreNames.contains(STORE_NAME.newsBookmarks)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.newsBookmarks}"`)
        const bookmarkStore = db.createObjectStore(STORE_NAME.newsBookmarks, { keyPath: 'id' })
        bookmarkStore.createIndex('by-bookmarked-at', 'bookmarkedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.newsBookmarks}" already exists`)
      }

      // v14 新增：双策略评分
      if (!db.objectStoreNames.contains(STORE_NAME.hotSectorScores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.hotSectorScores}"`)
        const hotSectorStore = db.createObjectStore(STORE_NAME.hotSectorScores, { keyPath: 'symbol' })
        hotSectorStore.createIndex('by-calculated-at', 'calculatedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.hotSectorScores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.valuePitScores)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.valuePitScores}"`)
        const valuePitStore = db.createObjectStore(STORE_NAME.valuePitScores, { keyPath: 'symbol' })
        valuePitStore.createIndex('by-calculated-at', 'calculatedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.valuePitScores}" already exists`)
      }

      // v15 新增：执行日志
      if (!db.objectStoreNames.contains(STORE_NAME.executionLogs)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.executionLogs}" with autoIncrement`)
        const executionLogStore = db.createObjectStore(STORE_NAME.executionLogs, {
          keyPath: 'id',
          autoIncrement: true,
        })
        executionLogStore.createIndex('by-plan', 'planId', { unique: false })
        executionLogStore.createIndex('by-symbol', 'symbol', { unique: false })
        executionLogStore.createIndex('by-timestamp', 'timestamp', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.executionLogs}" already exists`)
      }

      // v15 新增：缺失报告登记
      if (!db.objectStoreNames.contains(STORE_NAME.missingReports)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.missingReports}" with autoIncrement`)
        const missingReportStore = db.createObjectStore(STORE_NAME.missingReports, {
          keyPath: 'id',
          autoIncrement: true,
        })
        missingReportStore.createIndex('by-symbol', 'symbol', { unique: false })
        missingReportStore.createIndex('by-severity', 'severity', { unique: false })
        missingReportStore.createIndex('by-detected-at', 'detectedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.missingReports}" already exists`)
      }

      // v16 新增：执行计划
      if (!db.objectStoreNames.contains(STORE_NAME.executionPlans)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.executionPlans}"`)
        const executionPlanStore = db.createObjectStore(STORE_NAME.executionPlans, { keyPath: 'id' })
        executionPlanStore.createIndex('by-signal', 'signalId', { unique: false })
        executionPlanStore.createIndex('by-symbol', 'symbol', { unique: false })
        executionPlanStore.createIndex('by-phase', 'phase', { unique: false })
        executionPlanStore.createIndex('by-created-at', 'createdAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.executionPlans}" already exists`)
      }

      // v16 新增：投资组合
      if (!db.objectStoreNames.contains(STORE_NAME.portfolios)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.portfolios}"`)
        const portfolioStore = db.createObjectStore(STORE_NAME.portfolios, { keyPath: 'id' })
        portfolioStore.createIndex('by-theme', 'theme', { unique: false })
        portfolioStore.createIndex('by-updated-at', 'updatedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.portfolios}" already exists`)
      }

      // v17 新增：交易纪律复盘报告
      if (!db.objectStoreNames.contains(STORE_NAME.tradeReviews)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.tradeReviews}" with keyPath: "id"`)
        const tradeReviewStore = db.createObjectStore(STORE_NAME.tradeReviews, { keyPath: 'id' })
        tradeReviewStore.createIndex('by-generated-at', 'generatedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.tradeReviews}" already exists`)
      }

      // v22 新增：财务数据报告
      if (!db.objectStoreNames.contains(STORE_NAME.financialReports)) {
        logger.info(`[DB] Creating objectStore: "${STORE_NAME.financialReports}" with keyPath: "symbol"`)
        const financialReportStore = db.createObjectStore(STORE_NAME.financialReports, { keyPath: 'symbol' })
        financialReportStore.createIndex('by-symbol', 'symbol', { unique: true })
        financialReportStore.createIndex('by-report-date', 'reportDate', { unique: false })
        financialReportStore.createIndex('by-updated-at', 'updatedAt', { unique: false })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.financialReports}" already exists`)
      }

      // D-01：迁移追踪存储（schema_migrations）
      if (!db.objectStoreNames.contains(STORE_NAME.schemaMigrations)) {
        logger.debug(`[DB] Creating objectStore: "${STORE_NAME.schemaMigrations}"`)
        db.createObjectStore(STORE_NAME.schemaMigrations, { keyPath: 'id' })
      } else {
        logger.debug(`[DB] ObjectStore "${STORE_NAME.schemaMigrations}" already exists`)
      }

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
