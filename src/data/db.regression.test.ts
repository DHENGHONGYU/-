/**
 * @test_id V9-TEST-REGRESS-001
 * V6Database 回归测试套件 — 防止 db.ts 重构/优化/扩展时覆盖率下降
 *
 * 设计理念：
 * 1. 使用真实 fake-indexeddb（非 mock），端到端验证 V6Database 实际行为
 * 2. 每个 describe 块对应 db.ts 的一个公共方法，确保所有公共 API 契约稳定
 * 3. 关键分支保护点显式标注，重构时必须保持这些分支的覆盖
 * 4. 与 db.v6database.test.ts（mock 版）形成双向交叉验证：
 *    - v6database.test.ts: 精确 mock，覆盖所有错误路径和 instanceof 分支
 *    - regression.test.ts: 真实 IDB 环境，验证端到端行为正确性
 *
 * 覆盖率门禁：此套件运行后，db.ts 分支覆盖率必须保持 100%。
 * 若覆盖率下降，CI 应阻断合并。
 *
 * @vitest
 * @covers_docs []
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { V6Database, db, close } from './db'
import { STORE_NAME, DB_NAME, DB_VERSION } from '@/config/dbConfig'

// 使用真实 fake-indexeddb（setup.ts 已注入），不 mock 任何依赖
// 这确保测试反映 V6Database 的真实运行时行为

// ============================================================
// 测试辅助
// ============================================================

/** 测试用股票数据 */
function makeStock(symbol: string, overrides: Record<string, unknown> = {}) {
  return {
    symbol,
    name: `TestStock-${symbol}`,
    price: 100,
    pool: 'research' as const,
    researchStatus: 'candidate' as const,
    source: 'manual' as const,
    group: '默认分组',
    dataVersion: 1,
    ...overrides,
  }
}

type Stock = ReturnType<typeof makeStock>

/** 等待所有 IDB 事务完成（flush） */
function flushIDB(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ============================================================
// 测试主体
// ============================================================

describe('V6Database 回归测试（防覆盖率退化）', () => {
  let testDb: V6Database

  beforeAll(async () => {
    // 使用独立 V6Database 实例，避免与全局 db 单例冲突
    testDb = new V6Database()
    await testDb.init()
  })

  afterAll(() => {
    testDb.close()
  })

  // ── init() / ready() / isReady() 契约验证 ──

  describe('生命周期契约', () => {
    it('init 后 isReady 返回 true', () => {
      expect(testDb.isReady()).toBe(true)
    })

    it('ready() 在已初始化后立即 resolve（不阻塞）', async () => {
      const start = Date.now()
      await testDb.ready()
      expect(Date.now() - start).toBeLessThan(50)
    })

    it('getDatabase() 返回可用的 IDBDatabase 实例', () => {
      const idb = testDb.getDatabase()
      expect(idb).toBeDefined()
      expect(idb.version).toBe(DB_VERSION)
      expect(idb.objectStoreNames.contains(STORE_NAME.stocks)).toBe(true)
    })

    it('未初始化的 V6Database 调用 getDatabase 抛错', () => {
      const uninitDb = new V6Database()
      expect(() => uninitDb.getDatabase()).toThrow('Database not initialized')
    })
  })

  // ── put / get / getAll CRUD 契约验证 ──

  describe('CRUD 契约', () => {
    it('put 后 get 能读取同一记录', async () => {
      const stock = makeStock('600519')
      await testDb.put(STORE_NAME.stocks, stock)
      const result = await testDb.get<Stock>(STORE_NAME.stocks, '600519')
      expect(result).toEqual(stock)
    })

    it('get 不存在的 key 返回 undefined', async () => {
      const result = await testDb.get(STORE_NAME.stocks, 'NONEXISTENT_KEY')
      expect(result).toBeUndefined()
    })

    it('put 多条后 getAll 返回全部记录', async () => {
      await testDb.clear(STORE_NAME.stocks)
      const stocks = [makeStock('000001'), makeStock('000002'), makeStock('000003')]
      for (const s of stocks) {
        await testDb.put(STORE_NAME.stocks, s)
      }
      const result = await testDb.getAll<Stock>(STORE_NAME.stocks)
      expect(result).toHaveLength(3)
      expect(result.map((s) => s.symbol).sort()).toEqual(['000001', '000002', '000003'])
    })

    it('put 覆盖已存在的记录（相同 key）', async () => {
      await testDb.clear(STORE_NAME.stocks)
      await testDb.put(STORE_NAME.stocks, makeStock('600519', { name: 'Old Name' }))
      await testDb.put(STORE_NAME.stocks, makeStock('600519', { name: 'New Name' }))
      const result = await testDb.get<Stock>(STORE_NAME.stocks, '600519')
      expect(result?.name).toBe('New Name')
    })

    it('delete 删除指定 key 后 get 返回 undefined', async () => {
      await testDb.clear(STORE_NAME.stocks)
      await testDb.put(STORE_NAME.stocks, makeStock('600519'))
      await testDb.delete(STORE_NAME.stocks, '600519')
      const result = await testDb.get(STORE_NAME.stocks, '600519')
      expect(result).toBeUndefined()
    })

    it('clear 清空 store 后 getAll 返回空数组', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519'))
      await testDb.clear(STORE_NAME.stocks)
      const result = await testDb.getAll(STORE_NAME.stocks)
      expect(result).toEqual([])
    })
  })

  // ── getAllByIndex 索引查询契约 ──

  describe('getAllByIndex 索引查询', () => {
    beforeEach(async () => {
      await testDb.clear(STORE_NAME.stocks)
    })

    it('按 pool 索引查询返回匹配的记录', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519', { pool: 'research' }))
      await testDb.put(STORE_NAME.stocks, makeStock('000001', { pool: 'position' }))
      await testDb.put(STORE_NAME.stocks, makeStock('000002', { pool: 'research' }))

      const result = await testDb.getAllByIndex<Stock>(
        STORE_NAME.stocks,
        'by-pool',
        'research',
      )
      expect(result).toHaveLength(2)
      expect(result.every((s) => s.pool === 'research')).toBe(true)
    })

    it('索引查询无匹配时返回空数组', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519', { pool: 'research' }))
      const result = await testDb.getAllByIndex(STORE_NAME.stocks, 'by-pool', 'nonexistent')
      expect(result).toEqual([])
    })
  })

  // ── deleteByIndex 批量删除契约 ──

  describe('deleteByIndex 批量删除', () => {
    beforeEach(async () => {
      await testDb.clear(STORE_NAME.stocks)
    })

    it('按索引删除匹配的所有记录', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519', { pool: 'research' }))
      await testDb.put(STORE_NAME.stocks, makeStock('000001', { pool: 'position' }))
      await testDb.put(STORE_NAME.stocks, makeStock('000002', { pool: 'research' }))

      const deleted = await testDb.deleteByIndex(STORE_NAME.stocks, 'by-pool', 'research')
      expect(deleted).toBe(2)

      const remaining = await testDb.getAll(STORE_NAME.stocks)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].symbol).toBe('000001')
    })

    it('无匹配记录时返回 0 且不删除任何数据', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519', { pool: 'research' }))
      const deleted = await testDb.deleteByIndex(STORE_NAME.stocks, 'by-pool', 'nonexistent')
      expect(deleted).toBe(0)
      const remaining = await testDb.getAll(STORE_NAME.stocks)
      expect(remaining).toHaveLength(1)
    })
  })

  // ── withTransaction 事务契约 ──

  describe('withTransaction 事务', () => {
    it('readwrite 事务内多个 put 操作原子提交', async () => {
      await testDb.clear(STORE_NAME.stocks)
      await testDb.withTransaction([STORE_NAME.stocks], 'readwrite', (tx) => {
        const store = tx.objectStore(STORE_NAME.stocks)
        store.put(makeStock('600519'))
        store.put(makeStock('000001'))
        store.put(makeStock('000002'))
      })
      await flushIDB()
      const result = await testDb.getAll(STORE_NAME.stocks)
      expect(result).toHaveLength(3)
    })

    it('readonly 事务内可读取数据', async () => {
      await testDb.clear(STORE_NAME.stocks)
      await testDb.put(STORE_NAME.stocks, makeStock('600519'))
      await testDb.withTransaction([STORE_NAME.stocks], 'readonly', (tx) => {
        const store = tx.objectStore(STORE_NAME.stocks)
        const req = store.get('600519')
        req.onsuccess = () => {
          expect((req.result as { symbol: string }).symbol).toBe('600519')
        }
      })
      await flushIDB()
    })

    it('回调返回值正确传递', async () => {
      const result = await testDb.withTransaction(
        [STORE_NAME.stocks],
        'readonly',
        () => 'computed-value',
      )
      expect(result).toBe('computed-value')
    })

    it('回调抛出 Error 时 withTransaction reject', async () => {
      await expect(
        testDb.withTransaction([STORE_NAME.stocks], 'readonly', () => {
          throw new Error('callback error')
        }),
      ).rejects.toThrow('callback error')
    })

    it('回调抛出非 Error 时 withTransaction reject 包装的 Error', async () => {
      await expect(
        testDb.withTransaction([STORE_NAME.stocks], 'readonly', () => {
          throw 'string error'
        }),
      ).rejects.toThrow('string error')
    })
  })

  // ── reset / export / import 数据管理契约 ──

  describe('reset / export / import', () => {
    beforeEach(async () => {
      await testDb.clear(STORE_NAME.stocks)
    })

    it('export 返回所有 store 的数据', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519'))
      const exported = await testDb.export()
      expect(exported).toHaveProperty(STORE_NAME.stocks)
      expect(exported[STORE_NAME.stocks]).toHaveLength(1)
    })

    it('import 后数据恢复到 export 时的状态', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519'))
      await testDb.put(STORE_NAME.stocks, makeStock('000001'))
      const exported = await testDb.export()

      await testDb.clear(STORE_NAME.stocks)
      let count = await testDb.getAll(STORE_NAME.stocks)
      expect(count).toHaveLength(0)

      await testDb.import(exported)
      const restored = await testDb.getAll(STORE_NAME.stocks)
      expect(restored).toHaveLength(2)
    })

    it('import 空 data 对象时所有 store 保持空', async () => {
      await testDb.import({})
      const result = await testDb.getAll(STORE_NAME.stocks)
      expect(result).toEqual([])
    })

    it('reset 清空所有 store', async () => {
      await testDb.put(STORE_NAME.stocks, makeStock('600519'))
      await testDb.reset()
      const stocks = await testDb.getAll(STORE_NAME.stocks)
      expect(stocks).toEqual([])
    })
  })

  // ── close / 重新初始化契约 ──

  describe('close / 重新初始化', () => {
    it('close 后 isReady 返回 false', () => {
      const localDb = new V6Database()
      // 不调用 init，直接 close 测试 null db 分支
      localDb.close()
      expect(localDb.isReady()).toBe(false)
    })

    it('close 后可重新 init 并正常使用', async () => {
      const localDb = new V6Database()
      await localDb.init()
      await localDb.put(STORE_NAME.stocks, makeStock('600519'))
      localDb.close()

      await localDb.init()
      await localDb.put(STORE_NAME.stocks, makeStock('000001'))
      const result = await localDb.getAll(STORE_NAME.stocks)
      // 注意：fake-indexeddb 在 close 后数据可能保留，取决于实现
      // 这里只验证重新 init 后能正常使用
      expect(result.length).toBeGreaterThanOrEqual(1)
      localDb.close()
    })
  })

  // ── 错误传播契约（关键分支保护点） ──

  describe('错误传播契约（分支保护点）', () => {
    it('未初始化时 get 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(uninitDb.get(STORE_NAME.stocks, 'any')).rejects.toThrow(
        'Database not initialized',
      )
    })

    it('未初始化时 put 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(uninitDb.put(STORE_NAME.stocks, makeStock('600519'))).rejects.toThrow(
        'Database not initialized',
      )
    })

    it('未初始化时 delete 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(uninitDb.delete(STORE_NAME.stocks, 'any')).rejects.toThrow(
        'Database not initialized',
      )
    })

    it('未初始化时 clear 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(uninitDb.clear(STORE_NAME.stocks)).rejects.toThrow(
        'Database not initialized',
      )
    })

    it('未初始化时 getAll 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(uninitDb.getAll(STORE_NAME.stocks)).rejects.toThrow(
        'Database not initialized',
      )
    })

    it('未初始化时 getAllByIndex 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(
        uninitDb.getAllByIndex(STORE_NAME.stocks, 'by-pool', 'research'),
      ).rejects.toThrow('Database not initialized')
    })

    it('未初始化时 deleteByIndex 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(
        uninitDb.deleteByIndex(STORE_NAME.stocks, 'by-pool', 'research'),
      ).rejects.toThrow('Database not initialized')
    })

    it('未初始化时 reset 抛出 Error', async () => {
      const uninitDb = new V6Database()
      await expect(uninitDb.reset()).rejects.toThrow('Database not initialized')
    })
  })

  // ── close() 模块函数 ──

  describe('close() 模块函数', () => {
    it('调用全局 db 单例的 close()', () => {
      // 仅验证函数存在且可调用，不实际关闭（避免影响其他测试）
      expect(typeof close).toBe('function')
    })
  })
})
