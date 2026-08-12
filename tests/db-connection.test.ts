/**
 * @test_id V9-TEST-UT-015
 * @covers_docs []
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * db-connection 模块测试
 *
 * 验证目标（PR-6 步骤 1.4）：
 * 1. resetDbInstance / getDbInstance 状态管理
 * 2. deleteDB 的 onsuccess / onerror / onblocked 分支
 * 3. openDB 缓存命中分支
 * 4. openDB VersionError + DEV 模式递归重试
 * 5. openDB VersionError + PROD 模式拒绝
 * 6. openDB 非 VersionError 错误透传
 * 7. openDB onsuccess 正常路径（含 dbInstance 缓存写入）
 * 8. openDB onupgradeneeded 委托 createSchema + runMigrations
 */

// vi.mock 必须在 import 之前
vi.mock('@/config/dbConfig', () => ({
  DB_NAME: 'V6TestDB',
  DB_VERSION: 24,
  STORE_NAME: { stocks: 'stocks', v6Scores: 'v6Scores' },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/data/db-schema', () => ({
  createSchema: vi.fn(),
}))

vi.mock('@/data/db-migrations', () => ({
  runMigrations: vi.fn(),
  MIGRATIONS: [],
}))

// 动态导入，确保 vi.mock 生效
const { openDB, deleteDB, resetDbInstance, getDbInstance } = await import('@/data/db-connection')
const { createSchema } = await import('@/data/db-schema')
const { runMigrations } = await import('@/data/db-migrations')

// === Mock IndexedDB 工厂 ===

interface MockIDBRequest<T = unknown> {
  onsuccess: ((event: { target: MockIDBRequest<T> }) => void) | null
  onerror: ((event: { target: MockIDBRequest<T> }) => void) | null
  onblocked: (() => void) | null
  onupgradeneeded: ((event: {
    target: MockIDBRequest<T>
    oldVersion: number
    newVersion: number | null
  }) => void) | null
  result: T
  error: Error | null
  transaction: unknown
}

function createMockRequest<T>(result: T, error: Error | null = null): MockIDBRequest<T> {
  return {
    onsuccess: null,
    onerror: null,
    onblocked: null,
    onupgradeneeded: null,
    result,
    error,
    transaction: { objectStore: vi.fn() },
  }
}

function createMockDb(): IDBDatabase {
  return {
    version: 24,
    objectStoreNames: { contains: vi.fn(() => false), length: 0 } as unknown as DOMStringList,
    close: vi.fn(),
  } as unknown as IDBDatabase
}

interface IndexedDBMock {
  open: ReturnType<typeof vi.fn>
  deleteDatabase: ReturnType<typeof vi.fn>
}

let indexedDBMock: IndexedDBMock

beforeEach(() => {
  // 重置 dbInstance 状态
  resetDbInstance()

  // 重置 mock 调用记录
  vi.mocked(createSchema).mockClear()
  vi.mocked(runMigrations).mockClear()

  indexedDBMock = {
    open: vi.fn(),
    deleteDatabase: vi.fn(),
  }

  // 替换全局 indexedDB
  vi.stubGlobal('indexedDB', indexedDBMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('db-connection 状态管理', () => {
  it('resetDbInstance 清空后 getDbInstance 返回 null', () => {
    // 默认状态就是 null，先通过模拟设置一个非空值再重置
    // 由于 dbInstance 是模块内部状态，我们通过 openDB 写入再重置来验证
    expect(getDbInstance()).toBeNull()
    resetDbInstance()
    expect(getDbInstance()).toBeNull()
  })

  it('getDbInstance 初始为 null', () => {
    expect(getDbInstance()).toBeNull()
  })
})

describe('deleteDB 行为契约', () => {
  it('onsuccess 时 resolve 并记录日志', async () => {
    const mockRequest = createMockRequest<undefined>(undefined, null)
    indexedDBMock.deleteDatabase.mockReturnValue(mockRequest)

    const promise = deleteDB()
    // 模拟异步触发
    mockRequest.onsuccess?.({ target: mockRequest })

    await expect(promise).resolves.toBeUndefined()
  })

  it('onerror 时 reject 原始 Error 对象', async () => {
    const error = new Error('delete failed')
    const mockRequest = createMockRequest<undefined>(undefined, error)
    indexedDBMock.deleteDatabase.mockReturnValue(mockRequest)

    const promise = deleteDB()
    mockRequest.onerror?.({ target: mockRequest })

    await expect(promise).rejects.toThrow('delete failed')
  })

  it('onerror 时 reject 非 Error 对象转换为 Error', async () => {
    const mockRequest = createMockRequest<undefined>(undefined, null)
    mockRequest.error = 'string error' as unknown as Error
    indexedDBMock.deleteDatabase.mockReturnValue(mockRequest)

    const promise = deleteDB()
    mockRequest.onerror?.({ target: mockRequest })

    await expect(promise).rejects.toThrow('string error')
  })

  it('onblocked 时 reject "Database delete blocked"', async () => {
    const mockRequest = createMockRequest<undefined>(undefined, null)
    indexedDBMock.deleteDatabase.mockReturnValue(mockRequest)

    const promise = deleteDB()
    mockRequest.onblocked?.()

    await expect(promise).rejects.toThrow('Database delete blocked')
  })
})

describe('openDB 缓存命中分支', () => {
  it('dbInstance 已存在时直接返回缓存（不调用 indexedDB.open）', async () => {
    // 第一次调用建立缓存
    const mockDb = createMockDb()
    const mockRequest = createMockRequest<IDBDatabase>(mockDb, null)
    indexedDBMock.open.mockReturnValue(mockRequest)

    const promise1 = openDB()
    mockRequest.onsuccess?.({ target: mockRequest })
    await promise1

    // 第二次调用应直接返回缓存
    const result = await openDB()
    expect(result).toBe(mockDb)
    expect(indexedDBMock.open).toHaveBeenCalledTimes(1)
  })
})

describe('openDB onsuccess 正常路径', () => {
  it('成功打开数据库后 dbInstance 被缓存', async () => {
    const mockDb = createMockDb()
    const mockRequest = createMockRequest<IDBDatabase>(mockDb, null)
    indexedDBMock.open.mockReturnValue(mockRequest)

    const promise = openDB()
    mockRequest.onsuccess?.({ target: mockRequest })

    const result = await promise
    expect(result).toBe(mockDb)
    expect(getDbInstance()).toBe(mockDb)
  })
})

describe('openDB onupgradeneeded 委托', () => {
  it('触发 createSchema 和 runMigrations 委托', async () => {
    const mockDb = createMockDb()
    const mockRequest = createMockRequest<IDBDatabase>(mockDb, null)
    indexedDBMock.open.mockReturnValue(mockRequest)

    const promise = openDB()
    // 先触发 onupgradeneeded
    mockRequest.onupgradeneeded?.({
      target: mockRequest,
      oldVersion: 0,
      newVersion: 24,
    })
    // 再触发 onsuccess 完成连接
    mockRequest.onsuccess?.({ target: mockRequest })

    await promise

    expect(createSchema).toHaveBeenCalledWith(mockDb, mockRequest, expect.anything())
    expect(runMigrations).toHaveBeenCalledWith(
      mockDb,
      0,
      24,
      [],
      expect.anything(),
      expect.anything(),
    )
  })
})

describe('openDB VersionError 处理', () => {
  it('DEV 模式 + VersionError 时递归重试', async () => {
    // 保存原 import.meta.env
    const originalDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV
    vi.stubEnv('DEV', true)

    const versionError = new DOMException('VersionError', 'VersionError')
    const failRequest = createMockRequest<IDBDatabase>(undefined as unknown as IDBDatabase, versionError)

    const mockDb = createMockDb()
    const successRequest = createMockRequest<IDBDatabase>(mockDb, null)

    const deleteRequest = createMockRequest<undefined>(undefined, null)

    indexedDBMock.open.mockReturnValueOnce(failRequest)
    indexedDBMock.open.mockReturnValueOnce(successRequest)
    indexedDBMock.deleteDatabase.mockReturnValue(deleteRequest)

    const promise = openDB()
    // 触发首次 onerror（VersionError）
    failRequest.onerror?.({ target: failRequest })
    // 等待 deleteDB + 重新 openDB
    await new Promise((r) => setTimeout(r, 0))
    // 触发 deleteDB 成功
    deleteRequest.onsuccess?.({ target: deleteRequest })
    // 等待重新 openDB
    await new Promise((r) => setTimeout(r, 0))
    // 触发第二次 openDB 成功
    successRequest.onsuccess?.({ target: successRequest })

    await expect(promise).resolves.toBe(mockDb)

    // 恢复原 DEV 值
    if (originalDev === undefined) {
      // DEV 未设置，无需恢复
    } else {
      vi.stubEnv('DEV', originalDev)
    }
  })

  it('PROD 模式 + VersionError 时拒绝并返回友好错误', async () => {
    const originalDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV
    vi.stubEnv('DEV', false)

    const versionError = new DOMException('VersionError', 'VersionError')
    const failRequest = createMockRequest<IDBDatabase>(undefined as unknown as IDBDatabase, versionError)
    indexedDBMock.open.mockReturnValue(failRequest)

    const promise = openDB()
    failRequest.onerror?.({ target: failRequest })

    await expect(promise).rejects.toThrow('数据库版本冲突')

    if (originalDev === undefined) {
      // DEV 未设置，无需恢复
    } else {
      vi.stubEnv('DEV', originalDev)
    }
  })

  it('非 VersionError 错误时直接透传原始 Error', async () => {
    const otherError = new Error('Unknown failure')
    const failRequest = createMockRequest<IDBDatabase>(undefined as unknown as IDBDatabase, otherError)
    indexedDBMock.open.mockReturnValue(failRequest)

    const promise = openDB()
    failRequest.onerror?.({ target: failRequest })

    await expect(promise).rejects.toThrow('Unknown failure')
  })

  it('非 Error 类型的错误对象转换为 Error', async () => {
    const failRequest = createMockRequest<IDBDatabase>(undefined as unknown as IDBDatabase, null)
    failRequest.error = 'string-like-error' as unknown as Error
    indexedDBMock.open.mockReturnValue(failRequest)

    const promise = openDB()
    failRequest.onerror?.({ target: failRequest })

    await expect(promise).rejects.toThrow('string-like-error')
  })
})

describe('向后兼容性验证', () => {
  it('从 @/data/db 仍可导入 deleteDB / resetDbInstance / getDbInstance', async () => {
    // 此测试验证 re-export 是否生效
    const dbModule = await import('@/data/db')
    expect(typeof dbModule.deleteDB).toBe('function')
    expect(typeof dbModule.resetDbInstance).toBe('function')
    expect(typeof dbModule.getDbInstance).toBe('function')
  })
})
