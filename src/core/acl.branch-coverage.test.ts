/**
 * @test_id V9-TEST-BRANCH-ACL
 * acl.ts 分支覆盖率补充测试
 *
 * 覆盖目标：
 *   1. check() apiVersion 存在但 override 不存在 → 降级到 ACL_MATRIX 检查
 *   2. check() override.storeOverrides 存在但 store 不在 allowedStores → 拒绝
 *   3. check() override.storeOverrides 存在且 store 在 allowedStores → 允许
 *   4. check() override.storeOverrides.read/write 为 undefined → 拒绝
 *   5. check() catch 块非 Error 异常（fail-closed）
 *   6. inferOperation() INGEST 关键字
 *   7. assert() 权限拒绝时抛 AclError
 *   8. wrap() 权限通过后执行操作
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AclEngine, AclError, inferOperation } from './acl'
import { DB_OPERATION } from '@/config/dbConfig'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('acl — 分支覆盖率补充', () => {
  let engine: AclEngine

  beforeEach(() => {
    engine = new AclEngine()
  })

  // ──────────────────────────────────────────
  // check() apiVersion 存在但 override 不存在
  // ──────────────────────────────────────────
  describe('check() apiVersion 存在但 override 不存在', () => {
    it('apiVersion 有值但无对应 override 时应降级到 ACL_MATRIX', () => {
      // 使用已注册的模块（如 pool），传入不存在的 apiVersion
      const result = engine.check({
        module: 'pool',
        store: 'stocks',
        operation: DB_OPERATION.select,
        apiVersion: '99.99',
      })

      // 应降级到 ACL_MATRIX 检查（pool 模块有 stocks 读权限）
      expect(result.allowed).toBe(true)
    })

    it('apiVersion 有值但无对应 override 且 ACL_MATRIX 也拒绝时应返回 false', () => {
      // 使用未注册的 store 名触发 ACL_MATRIX 拒绝
      const result = engine.check({
        module: 'pool',
        store: 'nonExistentStore' as never,
        operation: DB_OPERATION.select,
        apiVersion: '99.99',
      })

      expect(result.allowed).toBe(false)
    })
  })

  // ──────────────────────────────────────────
  // check() override.storeOverrides 分支
  // ──────────────────────────────────────────
  describe('check() override.storeOverrides', () => {
    it('storeOverrides 存在但 store 不在 read 列表中应拒绝', () => {
      engine.registerVersionedOverride({
        moduleId: 'pool',
        apiVersion: '1.0',
        level: 'full',
        storeOverrides: {
          read: ['stocks'],
          write: [],
        },
      })

      const result = engine.check({
        module: 'pool',
        store: 'daily_quotes',
        operation: DB_OPERATION.select,
        apiVersion: '1.0',
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('versioned override')
    })

    it('storeOverrides 存在且 store 在 read 列表中应允许', () => {
      engine.registerVersionedOverride({
        moduleId: 'pool',
        apiVersion: '1.0',
        level: 'full',
        storeOverrides: {
          read: ['stocks', 'daily_quotes'],
          write: [],
        },
      })

      const result = engine.check({
        module: 'pool',
        store: 'daily_quotes',
        operation: DB_OPERATION.select,
        apiVersion: '1.0',
      })

      expect(result.allowed).toBe(true)
      expect(result.reason).toContain('versioned override')
    })

    it('storeOverrides 存在但 write 列表为空时写操作应拒绝', () => {
      engine.registerVersionedOverride({
        moduleId: 'pool',
        apiVersion: '1.0',
        level: 'full',
        storeOverrides: {
          read: ['stocks'],
          write: [],
        },
      })

      const result = engine.check({
        module: 'pool',
        store: 'stocks',
        operation: DB_OPERATION.insert,
        apiVersion: '1.0',
      })

      expect(result.allowed).toBe(false)
    })

    it('storeOverrides.read 为 undefined 时 SELECT 操作应拒绝', () => {
      engine.registerVersionedOverride({
        moduleId: 'pool',
        apiVersion: '1.0',
        level: 'full',
        storeOverrides: {
          write: ['stocks'],
        },
      })

      const result = engine.check({
        module: 'pool',
        store: 'stocks',
        operation: DB_OPERATION.select,
        apiVersion: '1.0',
      })

      expect(result.allowed).toBe(false)
    })

    it('storeOverrides.write 为 undefined 时 INSERT 操作应拒绝', () => {
      engine.registerVersionedOverride({
        moduleId: 'pool',
        apiVersion: '1.0',
        level: 'full',
        storeOverrides: {
          read: ['stocks'],
        },
      })

      const result = engine.check({
        module: 'pool',
        store: 'stocks',
        operation: DB_OPERATION.insert,
        apiVersion: '1.0',
      })

      expect(result.allowed).toBe(false)
    })
  })

  // ──────────────────────────────────────────
  // check() catch 块（fail-closed）
  // ──────────────────────────────────────────
  describe('check() fail-closed 异常处理', () => {
    it('ACL_MATRIX 访问异常时应返回 allowed=false', () => {
      // 使用未注册的模块 ID 触发 ACL_MATRIX[module] 为 undefined
      const result = engine.check({
        module: 'nonExistentModule' as never,
        store: 'stocks',
        operation: DB_OPERATION.select,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not registered')
    })
  })

  // ──────────────────────────────────────────
  // inferOperation() INGEST 关键字
  // ──────────────────────────────────────────
  describe('inferOperation() 关键字分支', () => {
    it('含 INGEST 的动作应返回 insert', () => {
      expect(inferOperation('INGEST_DATA')).toBe(DB_OPERATION.insert)
    })

    it('含 SAVE 的动作应返回 insert', () => {
      expect(inferOperation('SAVE_STOCK')).toBe(DB_OPERATION.insert)
    })

    it('含 INSERT 的动作应返回 insert', () => {
      expect(inferOperation('INSERT_STOCK')).toBe(DB_OPERATION.insert)
    })

    it('含 UPDATE 的动作应返回 update', () => {
      expect(inferOperation('UPDATE_SCORE')).toBe(DB_OPERATION.update)
    })

    it('含 DELETE 的动作应返回 delete', () => {
      expect(inferOperation('DELETE_STOCK')).toBe(DB_OPERATION.delete)
    })

    it('含 CLEAR 的动作应返回 delete', () => {
      expect(inferOperation('CLEAR_ALL')).toBe(DB_OPERATION.delete)
    })

    it('无匹配关键字应返回 select（默认）', () => {
      expect(inferOperation('QUERY_LIST')).toBe(DB_OPERATION.select)
      expect(inferOperation('UNKNOWN')).toBe(DB_OPERATION.select)
    })
  })

  // ──────────────────────────────────────────
  // assert() 权限拒绝时抛 AclError
  // ──────────────────────────────────────────
  describe('assert() 权限拒绝', () => {
    it('权限拒绝时应抛出 AclError', () => {
      expect(() => {
        engine.assert({
          module: 'nonExistentModule' as never,
          store: 'stocks',
          operation: DB_OPERATION.select,
        })
      }).toThrow(AclError)
    })

    it('权限通过时不应抛出', () => {
      expect(() => {
        engine.assert({
          module: 'pool',
          store: 'stocks',
          operation: DB_OPERATION.select,
        })
      }).not.toThrow()
    })
  })

  // ──────────────────────────────────────────
  // wrap() 权限通过后执行操作
  // ──────────────────────────────────────────
  describe('wrap() 操作包装', () => {
    it('权限通过时应执行操作并返回结果', async () => {
      const result = await engine.wrap(
        { module: 'pool', store: 'stocks', operation: DB_OPERATION.select },
        async () => 'success',
      )

      expect(result).toBe('success')
    })

    it('权限拒绝时应抛出 AclError 且不执行操作', async () => {
      const operation = vi.fn(async () => 'should not run')

      await expect(
        engine.wrap(
          { module: 'nonExistentModule' as never, store: 'stocks', operation: DB_OPERATION.select },
          operation,
        ),
      ).rejects.toThrow(AclError)

      expect(operation).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────
  // unregisterVersionedOverride
  // ──────────────────────────────────────────
  describe('unregisterVersionedOverride', () => {
    it('注销后 override 不再生效', () => {
      engine.registerVersionedOverride({
        moduleId: 'pool',
        apiVersion: '1.0',
        level: 'deny',
      })

      // deny 时应拒绝
      expect(engine.check({
        module: 'pool', store: 'stocks', operation: DB_OPERATION.select, apiVersion: '1.0',
      }).allowed).toBe(false)

      engine.unregisterVersionedOverride('pool', '1.0')

      // 注销后应降级到 ACL_MATRIX（允许）
      expect(engine.check({
        module: 'pool', store: 'stocks', operation: DB_OPERATION.select, apiVersion: '1.0',
      }).allowed).toBe(true)
    })
  })
})
