/**
 * @test_id V9-TEST-ST-025
 * V6Database 类单元测试 — db.ts 中的 V6Database 方法
 *
 * 覆盖范围：
 * 1. init() — 正常/已初始化/失败(Error)/失败(非Error)
 * 2. ready() — 已就绪/等待
 * 3. close() — db存在/不存在/close抛错(Error)/close抛错(非Error)
 * 4. withTransaction() — 成功/回调reject(Error)/回调reject(非Error)/tx.onabort/tx.onerror/ensureDB抛错
 * 5. getDatabase() — 成功/未初始化
 * 6. get/getAll/getAllByIndex/put/delete/clear — 成功/onerror(Error)/onerror(非Error)/catch(非Error)
 * 7. deleteByIndex() — 成功/onerror/tx.onerror/tx.onabort
 * 8. reset() — 成功/失败
 * 9. export() — 成功/失败
 * 10. import() — 成功(带数据)/成功(不带数据)/失败
 * 11. close() 函数 — 调用 db.close()
 *
 * @vitest
 * @covers_docs []
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { V6Database, db, close } from './db'
import { STORE_NAME } from '@/config/dbConfig'

// ============================================================
// Mock 配置
// ============================================================

const { mockLogger, mockOpenDB, mockResetDbInstance } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockOpenDB: vi.fn(),
  mockResetDbInstance: vi.fn(),
}))

vi.mock('./db-connection', () => ({
  openDB: mockOpenDB,
  resetDbInstance: mockResetDbInstance,
  deleteDB: vi.fn(),
  getDbInstance: vi.fn(() => null),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('./db-schema', () => ({ createSchema: vi.fn() }))
vi.mock('./db-migrations', () => ({ runMigrations: vi.fn(), MIGRATIONS: [] }))

const STORE_NAMES = Object.values(STORE_NAME)

// ============================================================
// Mock IDBDatabase 构造器
// ============================================================

interface MockRequest {
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  result: unknown
  error: unknown
}

function makeMockRequest(): MockRequest {
  return { onsuccess: null, onerror: null, result: undefined, error: null }
}

function makeMockDb() {
  const requests: MockRequest[] = []
  const createReq = (): MockRequest => {
    const req = makeMockRequest()
    requests.push(req)
    return req
  }

  const mockIndex = {
    getAll: vi.fn(createReq),
    getAllKeys: vi.fn(createReq),
  }

  const mockStore = {
    get: vi.fn(createReq),
    getAll: vi.fn(createReq),
    getAllKeys: vi.fn(createReq),
    put: vi.fn(createReq),
    delete: vi.fn(createReq),
    clear: vi.fn(createReq),
    index: vi.fn(() => mockIndex),
  }

  const mockTx = {
    objectStore: vi.fn(() => mockStore),
    abort: vi.fn(),
    oncomplete: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onabort: null as (() => void) | null,
    error: null as unknown,
  }

  const mockDb = {
    transaction: vi.fn(() => mockTx),
    close: vi.fn(),
    version: 32,
    objectStoreNames: { contains: vi.fn(() => true), length: 1 } as unknown as DOMStringList,
  }

  return { mockDb, mockTx, mockStore, mockIndex, requests }
}

// ============================================================
// 测试主体
// ============================================================

describe('V6Database', () => {
  let testDb: V6Database
  let mocks: ReturnType<typeof makeMockDb>

  beforeEach(() => {
    vi.resetAllMocks()
    mocks = makeMockDb()
    mockOpenDB.mockResolvedValue(mocks.mockDb)
    testDb = new V6Database()
  })

  afterEach(() => {
    testDb.close()
    if (db.isReady()) {
      db.close()
    }
  })

  // ── init() ──

  describe('init()', () => {
    it('未初始化时正常打开数据库', async () => {
      await testDb.init()
      expect(testDb.isReady()).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('[DB] V6Database.init() completed, database ready')
    })

    it('已初始化时跳过（覆盖 if true）', async () => {
      await testDb.init()
      await testDb.init()
      expect(mockLogger.debug).toHaveBeenCalledWith('[DB] V6Database.init() called but already initialized, skipping')
    })

    it('init 失败抛 Error（覆盖 catch err instanceof Error true）', async () => {
      mockOpenDB.mockRejectedValueOnce(new Error('openDB failed'))
      await expect(testDb.init()).rejects.toThrow('openDB failed')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] V6Database.init() failed', { error: 'openDB failed' })
    })

    it('init 失败抛非 Error（覆盖 catch err instanceof Error false → String(err)）', async () => {
      mockOpenDB.mockRejectedValueOnce('string error')
      await expect(testDb.init()).rejects.toBe('string error')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] V6Database.init() failed', { error: 'string error' })
    })
  })

  // ── ready() ──

  describe('ready()', () => {
    it('已就绪时直接返回（覆盖 if true）', async () => {
      await testDb.init()
      await testDb.ready()
      expect(mockLogger.debug).not.toHaveBeenCalledWith('[DB] Waiting for database initialization...')
    })

    it('未就绪时等待 Promise resolve（覆盖 if false）', async () => {
      const readyPromise = testDb.ready()
      await new Promise((r) => setTimeout(r, 0))
      expect(mockLogger.debug).toHaveBeenCalledWith('[DB] Waiting for database initialization...')
      await testDb.init()
      await readyPromise
      expect(mockLogger.debug).toHaveBeenCalledWith('[DB] Database initialization confirmed ready')
    })
  })

  // ── close() ──

  describe('close()', () => {
    it('db 存在时关闭连接（覆盖 if true）', async () => {
      await testDb.init()
      testDb.close()
      expect(mocks.mockDb.close).toHaveBeenCalledTimes(1)
      expect(testDb.isReady()).toBe(false)
      expect(mockResetDbInstance).toHaveBeenCalled()
    })

    it('db 为 null 时跳过关闭（覆盖 if false）', () => {
      testDb.close()
      expect(mocks.mockDb.close).not.toHaveBeenCalled()
    })

    it('db.close() 抛 Error（覆盖 catch err instanceof Error true）', async () => {
      await testDb.init()
      mocks.mockDb.close.mockImplementation(() => { throw new Error('close boom') })
      testDb.close()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DB] V6Database.close() error while closing IDBDatabase',
        { error: 'close boom' },
      )
    })

    it('db.close() 抛非 Error（覆盖 catch err instanceof Error false → String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.close.mockImplementation(() => { throw 'close string error' })
      testDb.close()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DB] V6Database.close() error while closing IDBDatabase',
        { error: 'close string error' },
      )
    })
  })

  // ── withTransaction() ──

  describe('withTransaction()', () => {
    it('回调成功 resolve（覆盖 settleOnce resolve, kind=resolve + tx.oncomplete 回调）', async () => {
      await testDb.init()
      const promise = testDb.withTransaction(['stocks'], 'readonly', () => 'success')
      await new Promise((r) => setTimeout(r, 0))
      mocks.mockTx.oncomplete!()
      expect(await promise).toBe('success')
      expect(mockLogger.info).toHaveBeenCalledWith('[DB] withTransaction completed')
    })

    it('回调 reject Error（覆盖 catch err instanceof Error true, settleOnce reject Error）', async () => {
      await testDb.init()
      await expect(
        testDb.withTransaction(['stocks'], 'readonly', () => Promise.reject(new Error('callback boom'))),
      ).rejects.toThrow('callback boom')
      expect(mocks.mockTx.abort).toHaveBeenCalled()
    })

    it('回调 reject 非 Error（覆盖 catch err instanceof Error false → String(err), new Error 包装）', async () => {
      await testDb.init()
      await expect(
        testDb.withTransaction(['stocks'], 'readonly', () => Promise.reject('string reject')),
      ).rejects.toThrow('string reject')
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[DB] withTransaction callback error, aborting',
        { error: 'string reject' },
      )
    })

    it('tx.onabort 触发（覆盖 if onabort true）', async () => {
      await testDb.init()
      const promise = testDb.withTransaction(['stocks'], 'readonly', () => new Promise<string>(() => {}))
      await new Promise((r) => setTimeout(r, 0))
      mocks.mockTx.onabort!()
      await expect(promise).rejects.toThrow('Transaction aborted')
    })

    it('tx.onerror 触发 Error（覆盖 tx.error instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.withTransaction(['stocks'], 'readonly', () => new Promise<string>(() => {}))
      await new Promise((r) => setTimeout(r, 0))
      mocks.mockTx.error = new Error('tx error')
      mocks.mockTx.onerror!()
      await expect(promise).rejects.toThrow('tx error')
    })

    it('tx.onerror 触发非 Error（覆盖 tx.error instanceof Error false → String）', async () => {
      await testDb.init()
      const promise = testDb.withTransaction(['stocks'], 'readonly', () => new Promise<string>(() => {}))
      await new Promise((r) => setTimeout(r, 0))
      mocks.mockTx.error = 'string tx error'
      mocks.mockTx.onerror!()
      await expect(promise).rejects.toThrow('string tx error')
    })

    it('双 settle 只生效第一次（覆盖 if settled true → return false）', async () => {
      await testDb.init()
      const promise = testDb.withTransaction(['stocks'], 'readonly', () => 'first')
      await new Promise((r) => setTimeout(r, 0))
      mocks.mockTx.onabort!()
      expect(await promise).toBe('first')
    })

    it('ensureDB 抛错触发外层 catch（覆盖 outer catch err instanceof Error true）', () => {
      // ensureDB 在 try 块中同步抛出，外层 catch 捕获后 throw err（同步抛出，非 Promise reject）
      expect(() =>
        testDb.withTransaction(['stocks'], 'readonly', () => 'result'),
      ).toThrow('Database not initialized. Call init() first.')
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[DB] withTransaction failed',
        { error: 'Database not initialized. Call init() first.' },
      )
    })

    it('外层 catch 非 Error（覆盖 outer catch err instanceof Error false → String）', async () => {
      await testDb.init()
      // logger.info 在 try 块中同步抛出非 Error，外层 catch 捕获走 String(err) 分支后 throw
      mockLogger.info.mockImplementationOnce(() => { throw 'logger string error' })
      expect(() =>
        testDb.withTransaction(['stocks'], 'readonly', () => 'result'),
      ).toThrow('logger string error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[DB] withTransaction failed',
        { error: 'logger string error' },
      )
    })
  })

  // ── getDatabase() + ensureDB() ──

  describe('getDatabase() / ensureDB()', () => {
    it('getDatabase 成功返回 db', async () => {
      await testDb.init()
      expect(testDb.getDatabase()).toBe(mocks.mockDb)
    })

    it('未初始化时 getDatabase 抛错（覆盖 ensureDB if !db true）', () => {
      expect(() => testDb.getDatabase()).toThrow('Database not initialized. Call init() first.')
    })
  })

  // ── get() ──

  describe('get()', () => {
    it('onsuccess 返回结果', async () => {
      await testDb.init()
      const promise = testDb.get('stocks', 'key1')
      const req = mocks.requests[0]!
      req.result = { id: 'key1', name: 'test' }
      req.onsuccess!()
      expect(await promise).toEqual({ id: 'key1', name: 'test' })
    })

    it('onerror Error（覆盖 request.error instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.get('stocks', 'key1')
      const req = mocks.requests[0]!
      req.error = new Error('get failed')
      req.onerror!()
      await expect(promise).rejects.toThrow('get failed')
    })

    it('onerror 非 Error（覆盖 request.error instanceof Error false → new Error(String)）', async () => {
      await testDb.init()
      const promise = testDb.get('stocks', 'key1')
      const req = mocks.requests[0]!
      req.error = 'string get error'
      req.onerror!()
      await expect(promise).rejects.toThrow('string get error')
    })

    it('catch 非 Error（覆盖 catch err instanceof Error false → String）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'transaction string error' })
      await expect(testDb.get('stocks', 'key1')).rejects.toBe('transaction string error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[DB] get failed'),
        { error: 'transaction string error' },
      )
    })

    it('未初始化时抛错（覆盖 ensureDB throw → catch Error）', async () => {
      await expect(testDb.get('stocks', 'key1')).rejects.toThrow('Database not initialized')
    })
  })

  // ── getAll() ──

  describe('getAll()', () => {
    it('onsuccess 返回数组', async () => {
      await testDb.init()
      const promise = testDb.getAll('stocks')
      const req = mocks.requests[0]!
      req.result = [{ id: '1' }, { id: '2' }]
      req.onsuccess!()
      expect(await promise).toEqual([{ id: '1' }, { id: '2' }])
    })

    it('onerror Error（覆盖 instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.getAll('stocks')
      mocks.requests[0]!.error = new Error('getAll boom')
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('getAll boom')
    })

    it('onerror 非 Error（覆盖 instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.getAll('stocks')
      mocks.requests[0]!.error = 'getAll string'
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('getAll string')
    })

    it('catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'tx string' })
      await expect(testDb.getAll('stocks')).rejects.toBe('tx string')
    })
  })

  // ── getAllByIndex() ──

  describe('getAllByIndex()', () => {
    it('onsuccess 返回结果', async () => {
      await testDb.init()
      const promise = testDb.getAllByIndex('stocks', 'by-pool', 'intention')
      const req = mocks.requests[0]!
      req.result = [{ id: '1' }]
      req.onsuccess!()
      expect(await promise).toEqual([{ id: '1' }])
    })

    it('onerror Error（覆盖 instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.getAllByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.error = new Error('index boom')
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('index boom')
    })

    it('onerror 非 Error（覆盖 instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.getAllByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.error = 'index string'
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('index string')
    })

    it('catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'idx tx string' })
      await expect(testDb.getAllByIndex('stocks', 'by-pool', 'intention')).rejects.toBe('idx tx string')
    })
  })

  // ── put() ──

  describe('put()', () => {
    it('onsuccess 完成', async () => {
      await testDb.init()
      const promise = testDb.put('stocks', { id: '1' })
      mocks.requests[0]!.onsuccess!()
      await expect(promise).resolves.toBeUndefined()
    })

    it('onerror Error（覆盖 instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.put('stocks', { id: '1' })
      mocks.requests[0]!.error = new Error('put boom')
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('put boom')
    })

    it('onerror 非 Error（覆盖 instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.put('stocks', { id: '1' })
      mocks.requests[0]!.error = 'put string'
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('put string')
    })

    it('catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'put tx string' })
      await expect(testDb.put('stocks', { id: '1' })).rejects.toBe('put tx string')
    })
  })

  // ── delete() ──

  describe('delete()', () => {
    it('onsuccess 完成', async () => {
      await testDb.init()
      const promise = testDb.delete('stocks', 'key1')
      mocks.requests[0]!.onsuccess!()
      await expect(promise).resolves.toBeUndefined()
    })

    it('onerror Error（覆盖 instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.delete('stocks', 'key1')
      mocks.requests[0]!.error = new Error('delete boom')
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('delete boom')
    })

    it('onerror 非 Error（覆盖 instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.delete('stocks', 'key1')
      mocks.requests[0]!.error = 'delete string'
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('delete string')
    })

    it('catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'del tx string' })
      await expect(testDb.delete('stocks', 'key1')).rejects.toBe('del tx string')
    })
  })

  // ── clear() ──

  describe('clear()', () => {
    it('onsuccess 完成', async () => {
      await testDb.init()
      const promise = testDb.clear('stocks')
      mocks.requests[0]!.onsuccess!()
      await expect(promise).resolves.toBeUndefined()
    })

    it('onerror Error（覆盖 instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.clear('stocks')
      mocks.requests[0]!.error = new Error('clear boom')
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('clear boom')
    })

    it('onerror 非 Error（覆盖 instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.clear('stocks')
      mocks.requests[0]!.error = 'clear string'
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('clear string')
    })

    it('catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'clr tx string' })
      await expect(testDb.clear('stocks')).rejects.toBe('clr tx string')
    })
  })

  // ── deleteByIndex() ──

  describe('deleteByIndex()', () => {
    it('成功删除多条记录', async () => {
      await testDb.init()
      const promise = testDb.deleteByIndex('stocks', 'by-pool', 'intention')
      const keysReq = mocks.requests[0]!
      keysReq.result = ['key1', 'key2', 'key3']
      keysReq.onsuccess!()
      mocks.mockTx.oncomplete!()
      expect(await promise).toBe(3)
      expect(mocks.mockStore.delete).toHaveBeenCalledTimes(3)
    })

    it('request.onerror Error（覆盖 instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.deleteByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.error = new Error('getAllKeys boom')
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('getAllKeys boom')
    })

    it('request.onerror 非 Error（覆盖 instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.deleteByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.error = 'keys string'
      mocks.requests[0]!.onerror!()
      await expect(promise).rejects.toThrow('keys string')
    })

    it('tx.onerror Error（覆盖 tx.error instanceof Error true）', async () => {
      await testDb.init()
      const promise = testDb.deleteByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.result = ['key1']
      mocks.requests[0]!.onsuccess!()
      mocks.mockTx.error = new Error('tx error boom')
      mocks.mockTx.onerror!()
      await expect(promise).rejects.toThrow('tx error boom')
    })

    it('tx.onerror 非 Error（覆盖 tx.error instanceof Error false）', async () => {
      await testDb.init()
      const promise = testDb.deleteByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.result = ['key1']
      mocks.requests[0]!.onsuccess!()
      mocks.mockTx.error = 'tx error string'
      mocks.mockTx.onerror!()
      await expect(promise).rejects.toThrow('tx error string')
    })

    it('tx.onabort（覆盖 onabort reject）', async () => {
      await testDb.init()
      const promise = testDb.deleteByIndex('stocks', 'by-pool', 'intention')
      mocks.requests[0]!.result = ['key1']
      mocks.requests[0]!.onsuccess!()
      mocks.mockTx.onabort!()
      await expect(promise).rejects.toThrow('[DB] deleteByIndex transaction aborted')
    })

    it('catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      mocks.mockDb.transaction.mockImplementation(() => { throw 'delIdx tx string' })
      await expect(testDb.deleteByIndex('stocks', 'by-pool', 'intention')).rejects.toBe('delIdx tx string')
    })
  })

  // ── reset() ──

  describe('reset()', () => {
    it('成功清空所有 store', async () => {
      await testDb.init()
      const clearSpy = vi.spyOn(testDb, 'clear').mockResolvedValue(undefined)
      await testDb.reset()
      expect(clearSpy).toHaveBeenCalledTimes(STORE_NAMES.length)
      expect(mockLogger.info).toHaveBeenCalledWith('[DB] reset completed successfully')
    })

    it('失败时 catch 并抛错（覆盖 catch err instanceof Error true）', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'clear').mockRejectedValue(new Error('reset boom'))
      await expect(testDb.reset()).rejects.toThrow('reset boom')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] reset failed', { error: 'reset boom' })
    })

    it('失败时 catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'clear').mockRejectedValue('reset string')
      await expect(testDb.reset()).rejects.toBe('reset string')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] reset failed', { error: 'reset string' })
    })
  })

  // ── export() ──

  describe('export()', () => {
    it('成功导出所有 store 数据', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'getAll').mockResolvedValue([{ id: '1' }])
      const result = await testDb.export()
      expect(Object.keys(result)).toHaveLength(STORE_NAMES.length)
      expect(mockLogger.info).toHaveBeenCalledWith('[DB] export completed successfully')
    })

    it('失败时 catch 并抛错（覆盖 catch err instanceof Error true）', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'getAll').mockRejectedValue(new Error('export boom'))
      await expect(testDb.export()).rejects.toThrow('export boom')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] export failed', { error: 'export boom' })
    })

    it('失败时 catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'getAll').mockRejectedValue('export string')
      await expect(testDb.export()).rejects.toBe('export string')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] export failed', { error: 'export string' })
    })
  })

  // ── import() ──

  describe('import()', () => {
    it('成功导入带数据的 store（覆盖 ?? true 路径）', async () => {
      await testDb.init()
      const clearSpy = vi.spyOn(testDb, 'clear').mockResolvedValue(undefined)
      const putSpy = vi.spyOn(testDb, 'put').mockResolvedValue(undefined)
      const firstStore = STORE_NAMES[0]!
      await testDb.import({ [firstStore]: [{ id: '1' }, { id: '2' }] })
      expect(clearSpy).toHaveBeenCalled()
      expect(putSpy).toHaveBeenCalledWith(firstStore, { id: '1' })
      expect(putSpy).toHaveBeenCalledWith(firstStore, { id: '2' })
      expect(mockLogger.info).toHaveBeenCalledWith('[DB] import completed successfully')
    })

    it('store 不在 data 中时用空数组（覆盖 ?? false 路径）', async () => {
      await testDb.init()
      const clearSpy = vi.spyOn(testDb, 'clear').mockResolvedValue(undefined)
      const putSpy = vi.spyOn(testDb, 'put').mockResolvedValue(undefined)
      await testDb.import({})
      expect(clearSpy).toHaveBeenCalledTimes(STORE_NAMES.length)
      expect(putSpy).not.toHaveBeenCalled()
    })

    it('失败时 catch Error（覆盖 catch err instanceof Error true）', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'clear').mockRejectedValue(new Error('import boom'))
      await expect(testDb.import({})).rejects.toThrow('import boom')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] import failed', { error: 'import boom' })
    })

    it('失败时 catch 非 Error（覆盖 catch String(err)）', async () => {
      await testDb.init()
      vi.spyOn(testDb, 'clear').mockRejectedValue('import string')
      await expect(testDb.import({})).rejects.toBe('import string')
      expect(mockLogger.error).toHaveBeenCalledWith('[DB] import failed', { error: 'import string' })
    })
  })

  // ── close() 函数 ──

  describe('close() 函数', () => {
    it('调用单例 db.close()', async () => {
      await db.init()
      expect(db.isReady()).toBe(true)
      close()
      expect(db.isReady()).toBe(false)
    })
  })
})
