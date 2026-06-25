import { DB_NAME, DB_VERSION, DEFAULT_POOL_GROUP, STORE_NAME } from '@/config/dbConfig'

// DB_VERSION 升级历史：
// v3 → v4: 新增 daily_quotes 存储，用于保存 K线/行情数据。
// v4 → v5: stocks 存储新增 group 字段与 by-group 索引，历史数据回退为默认分组。
// v5 → v6: 新增 rotation_scores、sector_scores、score_docs、strategy_snapshots、
//          local_docs、news、news_stock_map、sentiment_cache 存储，支撑 V6 Pro 迁移能力。

const STORE_NAMES = Object.values(STORE_NAME)

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME.stocks)) {
        const store = db.createObjectStore(STORE_NAME.stocks, { keyPath: 'symbol' })
        store.createIndex('by-status', 'researchStatus', { unique: false })
        store.createIndex('by-group', 'group', { unique: false })
      } else {
        const store = request.transaction?.objectStore(STORE_NAME.stocks)
        if (store && !store.indexNames.contains('by-group')) {
          store.createIndex('by-group', 'group', { unique: false })
        }

        // 历史数据兼容：缺失 group 字段的股票回写为默认分组
        if (store) {
          const cursorRequest = store.openCursor()
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (cursor) {
              const stock = cursor.value as Record<string, unknown>
              if (stock.group === undefined) {
                stock.group = DEFAULT_POOL_GROUP
                cursor.update(stock)
              }
              cursor.continue()
            }
          }
        }
      }

      if (!db.objectStoreNames.contains(STORE_NAME.v6Scores)) {
        db.createObjectStore(STORE_NAME.v6Scores, { keyPath: 'symbol' })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.intelligentScores)) {
        const scoreStore = db.createObjectStore(STORE_NAME.intelligentScores, {
          keyPath: 'id',
          autoIncrement: true,
        })
        scoreStore.createIndex('by-symbol', 'symbol', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.industryScores)) {
        const industryStore = db.createObjectStore(STORE_NAME.industryScores, {
          keyPath: 'id',
          autoIncrement: true,
        })
        industryStore.createIndex('by-code', 'code', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.orders)) {
        db.createObjectStore(STORE_NAME.orders, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.watchlists)) {
        db.createObjectStore(STORE_NAME.watchlists, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.signals)) {
        db.createObjectStore(STORE_NAME.signals, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.researchLogs)) {
        db.createObjectStore(STORE_NAME.researchLogs, {
          keyPath: 'id',
          autoIncrement: true,
        })
      }

      if (!db.objectStoreNames.contains(STORE_NAME.dailyQuotes)) {
        db.createObjectStore(STORE_NAME.dailyQuotes, { keyPath: 'symbol' })
      }

      // v6 新增：板块轮动评分
      if (!db.objectStoreNames.contains(STORE_NAME.rotationScores)) {
        const rotationStore = db.createObjectStore(STORE_NAME.rotationScores, { keyPath: 'id' })
        rotationStore.createIndex('by-sector-date', ['sectorCode', 'scoreDate'], { unique: true })
        rotationStore.createIndex('by-sector', 'sectorCode', { unique: false })
        rotationStore.createIndex('by-total', 'total', { unique: false })
        rotationStore.createIndex('by-resonance', 'resonance', { unique: false })
      }

      // v6 新增：十五五板块评分
      if (!db.objectStoreNames.contains(STORE_NAME.sectorScores)) {
        const sectorScoreStore = db.createObjectStore(STORE_NAME.sectorScores, { keyPath: 'id' })
        sectorScoreStore.createIndex('by-sector', 'sectorCode', { unique: false })
        sectorScoreStore.createIndex('by-composite', 'composite', { unique: false })
        sectorScoreStore.createIndex('by-is-core', 'isCore', { unique: false })
      }

      // v6 新增：评分文档版本库
      if (!db.objectStoreNames.contains(STORE_NAME.scoreDocs)) {
        const scoreDocStore = db.createObjectStore(STORE_NAME.scoreDocs, { keyPath: 'docId' })
        scoreDocStore.createIndex('by-symbol', 'symbol', { unique: false })
        scoreDocStore.createIndex('by-symbol-version', ['symbol', 'version'], { unique: true })
        scoreDocStore.createIndex('by-composite', 'composite', { unique: false })
      }

      // v6 新增：策略快照
      if (!db.objectStoreNames.contains(STORE_NAME.strategySnapshots)) {
        const snapshotStore = db.createObjectStore(STORE_NAME.strategySnapshots, { keyPath: 'id' })
        snapshotStore.createIndex('by-version', 'version', { unique: true })
        snapshotStore.createIndex('by-date', 'date', { unique: false })
        snapshotStore.createIndex('by-timestamp', 'timestamp', { unique: false })
      }

      // v6 新增：本地知识库
      if (!db.objectStoreNames.contains(STORE_NAME.localDocs)) {
        const localDocStore = db.createObjectStore(STORE_NAME.localDocs, { keyPath: 'id' })
        localDocStore.createIndex('by-symbol', 'symbol', { unique: false })
        localDocStore.createIndex('by-category', 'category', { unique: false })
        localDocStore.createIndex('by-added-at', 'addedAt', { unique: false })
      }

      // v6 新增：资讯文章
      if (!db.objectStoreNames.contains(STORE_NAME.news)) {
        const newsStore = db.createObjectStore(STORE_NAME.news, { keyPath: 'id' })
        newsStore.createIndex('by-source', 'source', { unique: false })
        newsStore.createIndex('by-category', 'category', { unique: false })
        newsStore.createIndex('by-publish-time', 'publishTime', { unique: false })
        newsStore.createIndex('by-hash', 'hash', { unique: true })
      }

      // v6 新增：股票-资讯关联
      if (!db.objectStoreNames.contains(STORE_NAME.newsStockMap)) {
        const newsStockMapStore = db.createObjectStore(STORE_NAME.newsStockMap, { keyPath: 'id' })
        newsStockMapStore.createIndex('by-symbol', 'symbol', { unique: false })
        newsStockMapStore.createIndex('by-news', 'newsId', { unique: false })
      }

      // v6 新增：情感分析缓存
      if (!db.objectStoreNames.contains(STORE_NAME.sentimentCache)) {
        const sentimentStore = db.createObjectStore(STORE_NAME.sentimentCache, { keyPath: 'id' })
        sentimentStore.createIndex('by-content-hash', 'contentHash', { unique: true })
        sentimentStore.createIndex('by-analyzed-at', 'analyzedAt', { unique: false })
      }
    }
  })
}

export class V6Database {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    this.db = await openDB()
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
