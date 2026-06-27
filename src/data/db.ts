import { DB_NAME, DB_VERSION, DEFAULT_POOL_GROUP, STORE_NAME } from '@/config/dbConfig'

const STORE_NAMES = Object.values(STORE_NAME)

let dbInstance: IDBDatabase | null = null

function deleteDB(): Promise<void> {
  console.info('[DB] Initiating database deletion...')
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => {
      console.info('[DB] Database deleted successfully')
      resolve()
    }
    request.onerror = () => {
      console.error('[DB] Failed to delete database:', request.error)
      reject(request.error)
    }
    request.onblocked = () => {
      console.warn('[DB] Database delete blocked - other tabs may have active connections')
      reject(new Error('Database delete blocked'))
    }
  })
}

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    console.debug('[DB] Returning existing database instance')
    return Promise.resolve(dbInstance)
  }

  console.info(`[DB] Opening database "${DB_NAME}" with target version ${DB_VERSION}...`)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      const error = request.error
      console.error('[DB] Database open request failed:', error?.message ?? error)
      if (error && error.name === 'VersionError') {
        console.warn(`[DB] Version conflict: existing DB version higher than requested v${DB_VERSION}`)
        if (import.meta.env.DEV) {
          console.warn('[DB] DEV mode: attempting to delete old database and recreate...')
          deleteDB()
            .then(() => {
              dbInstance = null
              console.info('[DB] Reopening database after deletion...')
              openDB().then(resolve).catch(reject)
            })
            .catch((e) => {
              console.error('[DB] Failed to delete old database:', e)
              dbInstance = null
              reject(error)
            })
        } else {
          console.error('[DB] Production mode: refusing to auto-delete existing data')
          reject(new Error('数据库版本冲突，请清除浏览器缓存后重试'))
        }
      } else {
        reject(error)
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result
      console.info(`[DB] Database opened successfully. Current version: ${dbInstance.version}`)
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion
      console.info(`[DB] Upgrade needed: v${oldVersion} → v${DB_VERSION} | Existing stores: [${Array.from(db.objectStoreNames).join(', ')}]`)

      if (!db.objectStoreNames.contains(STORE_NAME.stocks)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.stocks}"`)
        const store = db.createObjectStore(STORE_NAME.stocks, { keyPath: 'symbol' })
        store.createIndex('by-status', 'researchStatus', { unique: false })
        store.createIndex('by-group', 'group', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.stocks}" already exists, checking indexes...`)
        const store = request.transaction?.objectStore(STORE_NAME.stocks)
        if (store && !store.indexNames.contains('by-group')) {
          console.debug('[DB] Adding missing index: "by-group" on "stocks"')
          store.createIndex('by-group', 'group', { unique: false })
        }

        if (store) {
          const cursorRequest = store.openCursor()
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (cursor) {
              const stock = cursor.value as Record<string, unknown>
              if (stock.group === undefined) {
                console.debug(`[DB] Backfilling missing "group" field for stock: ${stock.symbol}`)
                stock.group = DEFAULT_POOL_GROUP
                cursor.update(stock)
              }
              cursor.continue()
            }
          }
        }
      }

      if (!db.objectStoreNames.contains(STORE_NAME.v6Scores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.v6Scores}"`)
        db.createObjectStore(STORE_NAME.v6Scores, { keyPath: 'symbol' })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.v6Scores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.intelligentScores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.intelligentScores}" with autoIncrement`)
        const scoreStore = db.createObjectStore(STORE_NAME.intelligentScores, {
          keyPath: 'id',
          autoIncrement: true,
        })
        scoreStore.createIndex('by-symbol', 'symbol', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.intelligentScores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.industryScores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.industryScores}" with autoIncrement`)
        const industryStore = db.createObjectStore(STORE_NAME.industryScores, {
          keyPath: 'id',
          autoIncrement: true,
        })
        industryStore.createIndex('by-code', 'code', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.industryScores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.orders)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.orders}"`)
        db.createObjectStore(STORE_NAME.orders, { keyPath: 'id' })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.orders}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.watchlists)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.watchlists}"`)
        db.createObjectStore(STORE_NAME.watchlists, { keyPath: 'id' })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.watchlists}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.signals)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.signals}"`)
        db.createObjectStore(STORE_NAME.signals, { keyPath: 'id' })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.signals}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.researchLogs)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.researchLogs}" with autoIncrement`)
        db.createObjectStore(STORE_NAME.researchLogs, {
          keyPath: 'id',
          autoIncrement: true,
        })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.researchLogs}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.dailyQuotes)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.dailyQuotes}"`)
        db.createObjectStore(STORE_NAME.dailyQuotes, { keyPath: 'symbol' })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.dailyQuotes}" already exists`)
      }

      // v6 新增：板块轮动评分
      if (!db.objectStoreNames.contains(STORE_NAME.rotationScores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.rotationScores}"`)
        const rotationStore = db.createObjectStore(STORE_NAME.rotationScores, { keyPath: 'id' })
        rotationStore.createIndex('by-sector-date', ['sectorCode', 'scoreDate'], { unique: true })
        rotationStore.createIndex('by-sector', 'sectorCode', { unique: false })
        rotationStore.createIndex('by-total', 'total', { unique: false })
        rotationStore.createIndex('by-resonance', 'resonance', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.rotationScores}" already exists`)
      }

      // v6 新增：十五五板块评分
      if (!db.objectStoreNames.contains(STORE_NAME.sectorScores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.sectorScores}"`)
        const sectorScoreStore = db.createObjectStore(STORE_NAME.sectorScores, { keyPath: 'id' })
        sectorScoreStore.createIndex('by-sector', 'sectorCode', { unique: false })
        sectorScoreStore.createIndex('by-composite', 'composite', { unique: false })
        sectorScoreStore.createIndex('by-is-core', 'isCore', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.sectorScores}" already exists`)
      }

      // v6 新增：评分文档版本库
      if (!db.objectStoreNames.contains(STORE_NAME.scoreDocs)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.scoreDocs}"`)
        const scoreDocStore = db.createObjectStore(STORE_NAME.scoreDocs, { keyPath: 'docId' })
        scoreDocStore.createIndex('by-symbol', 'symbol', { unique: false })
        scoreDocStore.createIndex('by-symbol-version', ['symbol', 'version'], { unique: true })
        scoreDocStore.createIndex('by-composite', 'composite', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.scoreDocs}" already exists`)
      }

      // v6 新增：策略快照
      if (!db.objectStoreNames.contains(STORE_NAME.strategySnapshots)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.strategySnapshots}"`)
        const snapshotStore = db.createObjectStore(STORE_NAME.strategySnapshots, { keyPath: 'id' })
        snapshotStore.createIndex('by-version', 'version', { unique: true })
        snapshotStore.createIndex('by-date', 'date', { unique: false })
        snapshotStore.createIndex('by-timestamp', 'timestamp', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.strategySnapshots}" already exists`)
      }

      // v6 新增：本地知识库
      if (!db.objectStoreNames.contains(STORE_NAME.localDocs)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.localDocs}"`)
        const localDocStore = db.createObjectStore(STORE_NAME.localDocs, { keyPath: 'id' })
        localDocStore.createIndex('by-symbol', 'symbol', { unique: false })
        localDocStore.createIndex('by-category', 'category', { unique: false })
        localDocStore.createIndex('by-added-at', 'addedAt', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.localDocs}" already exists`)
      }

      // v6 新增：资讯文章
      if (!db.objectStoreNames.contains(STORE_NAME.news)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.news}"`)
        const newsStore = db.createObjectStore(STORE_NAME.news, { keyPath: 'id' })
        newsStore.createIndex('by-source', 'source', { unique: false })
        newsStore.createIndex('by-category', 'category', { unique: false })
        newsStore.createIndex('by-publish-time', 'publishTime', { unique: false })
        newsStore.createIndex('by-hash', 'hash', { unique: true })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.news}" already exists`)
      }

      // v6 新增：股票-资讯关联
      if (!db.objectStoreNames.contains(STORE_NAME.newsStockMap)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.newsStockMap}"`)
        const newsStockMapStore = db.createObjectStore(STORE_NAME.newsStockMap, { keyPath: 'id' })
        newsStockMapStore.createIndex('by-symbol', 'symbol', { unique: false })
        newsStockMapStore.createIndex('by-news', 'newsId', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.newsStockMap}" already exists`)
      }

      // v6 新增：情感分析缓存
      if (!db.objectStoreNames.contains(STORE_NAME.sentimentCache)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.sentimentCache}"`)
        const sentimentStore = db.createObjectStore(STORE_NAME.sentimentCache, { keyPath: 'id' })
        sentimentStore.createIndex('by-content-hash', 'contentHash', { unique: true })
        sentimentStore.createIndex('by-analyzed-at', 'analyzedAt', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.sentimentCache}" already exists`)
      }

      // v13 新增：资讯收藏
      if (!db.objectStoreNames.contains(STORE_NAME.newsBookmarks)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.newsBookmarks}"`)
        const bookmarkStore = db.createObjectStore(STORE_NAME.newsBookmarks, { keyPath: 'id' })
        bookmarkStore.createIndex('by-bookmarked-at', 'bookmarkedAt', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.newsBookmarks}" already exists`)
      }

      // v14 新增：双策略评分
      if (!db.objectStoreNames.contains(STORE_NAME.hotSectorScores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.hotSectorScores}"`)
        const hotSectorStore = db.createObjectStore(STORE_NAME.hotSectorScores, { keyPath: 'symbol' })
        hotSectorStore.createIndex('by-calculated-at', 'calculatedAt', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.hotSectorScores}" already exists`)
      }

      if (!db.objectStoreNames.contains(STORE_NAME.valuePitScores)) {
        console.debug(`[DB] Creating objectStore: "${STORE_NAME.valuePitScores}"`)
        const valuePitStore = db.createObjectStore(STORE_NAME.valuePitScores, { keyPath: 'symbol' })
        valuePitStore.createIndex('by-calculated-at', 'calculatedAt', { unique: false })
      } else {
        console.debug(`[DB] ObjectStore "${STORE_NAME.valuePitScores}" already exists`)
      }

      console.info(`[DB] Schema upgrade complete. Final stores: [${Array.from(db.objectStoreNames).join(', ')}]`)
    }
  })
}

export class V6Database {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    console.info('[DB] V6Database.init() called')
    this.db = await openDB()
    console.info('[DB] V6Database.init() completed, database ready')
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    return this.db
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
  }

  async getAllByIndex<T>(
    storeName: string,
    indexName: string,
    value: string,
  ): Promise<T[]> {
    const db = this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.getAll(value)
      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const db = this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.put(value)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear(storeName: string): Promise<void> {
    const db = this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async reset(): Promise<void> {
    this.ensureDB()
    for (const storeName of STORE_NAMES) {
      await this.clear(storeName)
    }
  }

  async export(): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {}
    for (const storeName of STORE_NAMES) {
      result[storeName] = await this.getAll(storeName)
    }
    return result
  }

  async import(data: Record<string, unknown[]>): Promise<void> {
    for (const storeName of STORE_NAMES) {
      await this.clear(storeName)
      const items = data[storeName] ?? []
      for (const item of items) {
        await this.put(storeName, item)
      }
    }
  }
}

export const db = new V6Database()

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function now(): number {
  return Date.now()
}
