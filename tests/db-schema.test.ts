import { describe, it, expect, vi } from 'vitest'
import { STORE_NAME } from '@/config/dbConfig'
import { createSchema } from '@/data/db-schema'

/**
 * db-schema Schema 创建模块测试
 *
 * 验证目标（PR-6 步骤 1.3）：
 * 1. createSchema 创建所有 28 个 objectStore
 * 2. 关键索引存在性验证
 * 3. 幂等性验证（store 已存在时跳过创建）
 */
interface MockIndex {
  createIndex: ReturnType<typeof vi.fn>
  indexNames: { contains: (name: string) => boolean }
  openCursor: ReturnType<typeof vi.fn>
}

interface MockDb {
  objectStoreNames: { contains: (name: string) => boolean }
  createObjectStore: ReturnType<typeof vi.fn>
}

interface MockRequest {
  transaction: {
    objectStore: (name: string) => MockIndex | undefined
  }
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

function makeMockDb(existingStores: string[] = []): MockDb {
  const stores = new Set<string>(existingStores)
  const indexMap = new Map<string, Set<string>>()

  return {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: vi.fn((name: string) => {
      stores.add(name)
      const indexes = new Set<string>()
      indexMap.set(name, indexes)
      const mockIndex: MockIndex = {
        createIndex: vi.fn((idxName: string) => {
          indexes.add(idxName)
        }),
        indexNames: { contains: (idxName: string) => indexes.has(idxName) },
        openCursor: vi.fn(() => ({ result: null, onsuccess: null })),
      }
      return mockIndex
    }),
  }
}

function makeMockRequest(): MockRequest {
  return {
    transaction: {
      objectStore: () => undefined,
    },
  }
}

describe('db-schema Schema 创建模块', () => {
  describe('createSchema - 全量创建场景', () => {
    it('创建所有 28 个 objectStore（全新数据库）', () => {
      const db = makeMockDb([])
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      // 验证所有 store 都被创建
      const expectedStores = Object.values(STORE_NAME)
      expect(db.createObjectStore).toHaveBeenCalledTimes(expectedStores.length)
      for (const storeName of expectedStores) {
        expect(db.createObjectStore).toHaveBeenCalledWith(storeName, expect.anything())
      }
    })

    it('stocks store 创建 by-status 和 by-group 两个索引', () => {
      const db = makeMockDb([])
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      // 找到 stocks store 的 createObjectStore 调用，检查返回的 store 的 createIndex 调用
      const stocksCall = db.createObjectStore.mock.calls.find(
        (call) => call[0] === STORE_NAME.stocks,
      )
      expect(stocksCall).toBeDefined()
      // createObjectStore 返回的是 mockIndex，我们需要通过 mock.results 获取
      const stocksCallIndex = db.createObjectStore.mock.calls.findIndex(
        (call) => call[0] === STORE_NAME.stocks,
      )
      const stocksStore = db.createObjectStore.mock.results[stocksCallIndex]?.value as MockIndex
      expect(stocksStore.createIndex).toHaveBeenCalledWith('by-status', 'researchStatus', { unique: false })
      expect(stocksStore.createIndex).toHaveBeenCalledWith('by-group', 'group', { unique: false })
    })

    it('rotationScores store 创建 4 个索引（含复合索引 by-sector-date）', () => {
      const db = makeMockDb([])
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      const rotationCallIndex = db.createObjectStore.mock.calls.findIndex(
        (call) => call[0] === STORE_NAME.rotationScores,
      )
      const rotationStore = db.createObjectStore.mock.results[rotationCallIndex]?.value as MockIndex
      expect(rotationStore.createIndex).toHaveBeenCalledTimes(4)
      expect(rotationStore.createIndex).toHaveBeenCalledWith(
        'by-sector-date',
        ['sectorCode', 'scoreDate'],
        { unique: true },
      )
    })

    it('news store 创建 4 个索引（含唯一索引 by-hash）', () => {
      const db = makeMockDb([])
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      const newsCallIndex = db.createObjectStore.mock.calls.findIndex(
        (call) => call[0] === STORE_NAME.news,
      )
      const newsStore = db.createObjectStore.mock.results[newsCallIndex]?.value as MockIndex
      expect(newsStore.createIndex).toHaveBeenCalledTimes(4)
      expect(newsStore.createIndex).toHaveBeenCalledWith('by-hash', 'hash', { unique: true })
    })

    it('executionPlans store 创建 4 个索引', () => {
      const db = makeMockDb([])
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      const planCallIndex = db.createObjectStore.mock.calls.findIndex(
        (call) => call[0] === STORE_NAME.executionPlans,
      )
      const planStore = db.createObjectStore.mock.results[planCallIndex]?.value as MockIndex
      expect(planStore.createIndex).toHaveBeenCalledTimes(4)
      expect(planStore.createIndex).toHaveBeenCalledWith('by-signal', 'signalId', { unique: false })
      expect(planStore.createIndex).toHaveBeenCalledWith('by-phase', 'phase', { unique: false })
    })
  })

  describe('createSchema - 幂等性场景', () => {
    it('已存在的 store 不重复创建（跳过 createObjectStore）', () => {
      // 所有 store 都已存在
      const existingStores = Object.values(STORE_NAME)
      const db = makeMockDb(existingStores)
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      // 没有任何 store 被创建（因为全部已存在）
      expect(db.createObjectStore).not.toHaveBeenCalled()
    })

    it('部分存在的 store 只创建缺失的', () => {
      // 只让 stocks 已存在，其他全部不存在
      const db = makeMockDb([STORE_NAME.stocks])
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      const expectedStores = Object.values(STORE_NAME)
      const storesToCreate = expectedStores.filter((s) => s !== STORE_NAME.stocks)
      expect(db.createObjectStore).toHaveBeenCalledTimes(storesToCreate.length)
    })

    it('调用 logger.debug 记录已存在的 store', () => {
      const existingStores = Object.values(STORE_NAME)
      const db = makeMockDb(existingStores)
      const request = makeMockRequest()
      const logger = makeLogger()

      createSchema(
        db as unknown as IDBDatabase,
        request as unknown as IDBOpenDBRequest,
        logger,
      )

      // 每个 store 都会记录 "already exists"
      const debugCalls = logger.debug.mock.calls.filter((call) =>
        String(call[0]).includes('already exists'),
      )
      expect(debugCalls.length).toBe(existingStores.length)
    })
  })

  describe('createSchema - 与原 db.ts 实现兼容', () => {
    it('db.ts 的 onupgradeneeded 回调调用 createSchema（通过集成测试验证）', () => {
      // createSchema 是 db.ts 的内部函数，不对外 re-export
      // 兼容性通过 db.test.ts 的回归测试验证（openDB 流程完整）
      // 此处仅验证 createSchema 本身可正常调用
      const db = makeMockDb([])
      const request = makeMockRequest()
      const logger = makeLogger()

      expect(() =>
        createSchema(
          db as unknown as IDBDatabase,
          request as unknown as IDBOpenDBRequest,
          logger,
        ),
      ).not.toThrow()
    })
  })
})
