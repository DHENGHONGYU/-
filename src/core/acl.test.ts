/**
 * @test_id V9-TEST-ST-012
 * @covers_docs []
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { inferOperation, AclError, AclEngine } from './acl'
import {
  DB_OPERATION,
  MODULE_ID,
  STORE_NAME,
} from '@/config/dbConfig'

// ──────────────────────────────────────────────
// inferOperation
// ──────────────────────────────────────────────
describe('inferOperation', () => {
  it('将包含 INSERT 的 action 映射为 insert', () => {
    expect(inferOperation('INSERT_STOCK')).toBe(DB_OPERATION.insert)
  })

  it('将包含 SAVE 的 action 映射为 insert', () => {
    expect(inferOperation('SAVE_SCORES')).toBe(DB_OPERATION.insert)
  })

  it('将包含 INGEST 的 action 映射为 insert', () => {
    expect(inferOperation('INGEST_DATA')).toBe(DB_OPERATION.insert)
  })

  it('将包含 UPDATE 的 action 映射为 update', () => {
    expect(inferOperation('UPDATE_STOCK')).toBe(DB_OPERATION.update)
  })

  it('将包含 DELETE 的 action 映射为 delete', () => {
    expect(inferOperation('DELETE_STOCK')).toBe(DB_OPERATION.delete)
  })

  it('将包含 CLEAR 的 action 映射为 delete', () => {
    expect(inferOperation('CLEAR_CACHE')).toBe(DB_OPERATION.delete)
  })

  it('将其他 action 默认映射为 select', () => {
    expect(inferOperation('QUERY_DATA')).toBe(DB_OPERATION.select)
  })
})

// ──────────────────────────────────────────────
// AclError
// ──────────────────────────────────────────────
describe('AclError', () => {
  it('继承自 Error', () => {
    const err = new AclError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AclError)
  })

  it('name 属性为 AclError', () => {
    const err = new AclError('test')
    expect(err.name).toBe('AclError')
  })

  it('message 属性正确', () => {
    const err = new AclError('module not found')
    expect(err.message).toBe('module not found')
  })
})

// ──────────────────────────────────────────────
// AclEngine.assert
// ──────────────────────────────────────────────
describe('AclEngine', () => {
  let engine: AclEngine

  beforeEach(() => {
    engine = new AclEngine()
  })

  it('权限通过时不应抛出异常', () => {
    // pool 模块: actions = [INSERT, UPDATE, DELETE], write.stocks
    expect(() =>
      engine.assert({
        module: MODULE_ID.pool,
        store: STORE_NAME.stocks,
        operation: DB_OPERATION.insert,
      }),
    ).not.toThrow()
  })

  it('未注册模块应抛出 AclError', () => {
    expect(() =>
      engine.assert({
        module: 'unknown_module' as any,
        store: STORE_NAME.stocks,
        operation: DB_OPERATION.select,
      }),
    ).toThrow(AclError)
  })

  it('操作不允许时应抛出 AclError', () => {
    // fetcher 模块: read 不含 dailyQuotes（仅 write），SELECT 应被拒绝
    expect(() =>
      engine.assert({
        module: MODULE_ID.fetcher,
        store: STORE_NAME.dailyQuotes,
        operation: DB_OPERATION.select,
      }),
    ).toThrow(AclError)
  })

  it('fetcher 模块允许 SELECT stocks（刷新前读取现有记录合并字段）', () => {
    // 2026-07-12 修复：fetchStockBasic / fetchStockKline 需先读取现有 stock
    expect(() =>
      engine.assert({
        module: MODULE_ID.fetcher,
        store: STORE_NAME.stocks,
        operation: DB_OPERATION.select,
      }),
    ).not.toThrow()
  })

  it('store 不允许时应抛出 AclError', () => {
    // pool 模块: write = [stocks]，不允许写 orders
    expect(() =>
      engine.assert({
        module: MODULE_ID.pool,
        store: STORE_NAME.orders,
        operation: DB_OPERATION.insert,
      }),
    ).toThrow(AclError)
  })

  it('SELECT 操作检查 read 列表', () => {
    // fetcher 模块: read = [stocks, traceRecords, collectConfig]，
    // SELECT 不在 read 中的 store（如 dailyQuotes）应通过 read 校验失败
    expect(() =>
      engine.assert({
        module: MODULE_ID.fetcher,
        store: STORE_NAME.dailyQuotes,
        operation: DB_OPERATION.select,
      }),
    ).toThrow(AclError)
  })

  it('AclError 包含正确的错误信息', () => {
    try {
      engine.assert({
        module: 'nonexistent' as any,
        store: STORE_NAME.stocks,
        operation: DB_OPERATION.select,
      })
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AclError)
      expect((err as AclError).message).toContain('nonexistent')
    }
  })

  describe('system 模块权限遵循最小权限原则', () => {
    it('对 stocks 有 SELECT 权限（系统操作入口检查）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.stocks,
          operation: DB_OPERATION.select,
        }),
      ).not.toThrow()
    })

    it('对 localDocs 有 INSERT 权限（本地文档管理）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.localDocs,
          operation: DB_OPERATION.insert,
        }),
      ).not.toThrow()
    })

    it('对 researchLogs 有 INSERT 权限（迁移审计日志）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.researchLogs,
          operation: DB_OPERATION.insert,
        }),
      ).not.toThrow()
    })

    it('对 orders 有 WRITE 权限（系统模块完整访问）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.orders,
          operation: DB_OPERATION.insert,
        }),
      ).not.toThrow()
    })

    it('有 DELETE 操作权限（系统模块完整访问）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.localDocs,
          operation: DB_OPERATION.delete,
        }),
      ).not.toThrow()
    })

    it('对 executionPlans 有 UPDATE 权限（执行计划跟踪）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.executionPlans,
          operation: DB_OPERATION.update,
        }),
      ).not.toThrow()
    })

    it('对 localDocs 有 UPDATE 权限（执行计划跟踪）', () => {
      expect(() =>
        engine.assert({
          module: MODULE_ID.system,
          store: STORE_NAME.localDocs,
          operation: DB_OPERATION.update,
        }),
      ).not.toThrow()
    })
  })
})

// ──────────────────────────────────────────────
// AclEngine.check（v6 对齐新增）
// ──────────────────────────────────────────────
describe('AclEngine.check', () => {
  let engine: AclEngine

  beforeEach(() => {
    engine = new AclEngine()
  })

  it('合法操作返回 allowed=true', () => {
    const result = engine.check({
      module: MODULE_ID.pool,
      store: STORE_NAME.stocks,
      operation: DB_OPERATION.insert,
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeTruthy()
  })

  it('未注册模块返回 allowed=false', () => {
    const result = engine.check({
      module: 'unknown' as any,
      store: STORE_NAME.stocks,
      operation: DB_OPERATION.select,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('unknown')
  })

  it('操作不允许返回 allowed=false', () => {
    const result = engine.check({
      module: MODULE_ID.fetcher,
      store: STORE_NAME.dailyQuotes,
      operation: DB_OPERATION.select,
    })
    expect(result.allowed).toBe(false)
  })

  it('fetcher SELECT stocks 返回 allowed=true', () => {
    const result = engine.check({
      module: MODULE_ID.fetcher,
      store: STORE_NAME.stocks,
      operation: DB_OPERATION.select,
    })
    expect(result.allowed).toBe(true)
  })
})

// ──────────────────────────────────────────────
// AclEngine.wrap（v6 对齐新增）
// ──────────────────────────────────────────────
describe('AclEngine.wrap', () => {
  let engine: AclEngine

  beforeEach(() => {
    engine = new AclEngine()
  })

  it('权限通过时执行操作并返回结果', async () => {
    const mockFn = async () => 'done'
    const result = await engine.wrap(
      { module: MODULE_ID.pool, store: STORE_NAME.stocks, operation: DB_OPERATION.insert },
      mockFn,
    )
    expect(result).toBe('done')
  })

  it('权限拒绝时抛出 AclError 且不执行操作', async () => {
    let called = false
    const mockFn = async () => { called = true; return 'executed' }

    await expect(
      engine.wrap(
        { module: 'nonexistent' as any, store: STORE_NAME.stocks, operation: DB_OPERATION.select },
        mockFn,
      ),
    ).rejects.toThrow(AclError)

    expect(called).toBe(false)
  })
})
