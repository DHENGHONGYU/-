/**
 * @test_id V9-TEST-ST-013
 * @fileoverview AclEngine.check 防御性逻辑测试
 *
 * 覆盖修复后的防御性逻辑：
 *   1. try-catch 异常路径 → fail-closed（返回 allowed=false）
 *   2. permission.actions 为 undefined → ?? [] 防御
 *   3. allowedStores (read/write) 为 undefined → ?? [] 防御
 *
 * 注意：需 mock ACL_MATRIX 注入异常数据，故独立文件（不污染 acl.test.ts 的真实矩阵测试）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger 以验证 catch 块的 error 调用
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// Mock dbConfig：注入异常 ACL_MATRIX 测试防御性逻辑
// - test-actions-undefined: actions=undefined，测试 ?? [] 防御
// - test-stores-undefined: read/write=undefined，测试 allowedStores ?? [] 防御
// - throw-module: Proxy 访问时抛出，测试 try-catch fail-closed
// - test-normal: 正常模块，对照测试确保 mock 后正常路径仍工作
vi.mock('@/config/dbConfig', () => {
  const realMatrix = {
    'test-actions-undefined': {
      actions: undefined,
      read: ['test-store'],
      write: ['test-store'],
    },
    'test-stores-undefined': {
      actions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      read: undefined,
      write: undefined,
    },
    'test-normal': {
      actions: ['SELECT'],
      read: ['test-store'],
      write: ['test-store'],
    },
  }
  return {
    DB_OPERATION: { select: 'SELECT', insert: 'INSERT', update: 'UPDATE', delete: 'DELETE' },
    ACL_MATRIX: new Proxy(realMatrix, {
      get(target, prop, receiver) {
        if (prop === 'throw-module') {
          throw new Error('Proxy ACL_MATRIX boom')
        }
        return Reflect.get(target, prop, receiver)
      },
    }),
  }
})

const { AclEngine } = await import('./acl')

describe('AclEngine.check - 防御性逻辑（mocked ACL_MATRIX）', () => {
  let engine: InstanceType<typeof AclEngine>

  beforeEach(() => {
    engine = new AclEngine()
    mockLogger.error.mockClear()
  })

  it('permission.actions 为 undefined 时仍返回 allowed=false（?? [] 防御）', () => {
    const result = engine.check({
      module: 'test-actions-undefined' as any,
      store: 'test-store' as any,
      operation: 'SELECT' as any,
    })
    // actions=undefined → ?? [] → !includes(SELECT) → allowed=false
    expect(result.allowed).toBe(false)
    expect(typeof result.reason).toBe('string')
    expect(result.reason).toContain('test-actions-undefined')
  })

  it('allowedStores (read) 为 undefined 时仍返回 allowed=false（?? [] 防御）', () => {
    const result = engine.check({
      module: 'test-stores-undefined' as any,
      store: 'test-store' as any,
      operation: 'SELECT' as any,
    })
    // read=undefined → (undefined ?? []) → !includes → allowed=false
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('test-stores-undefined')
  })

  it('ACL_MATRIX 访问异常时返回 allowed=false（try-catch fail-closed）', () => {
    const result = engine.check({
      module: 'throw-module' as any,
      store: 'test-store' as any,
      operation: 'SELECT' as any,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('ACL check error')
    expect(result.reason).toContain('Proxy ACL_MATRIX boom')
    // 验证 catch 块中 logger.error 被调用
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('正常模块对照测试：mock 后正常路径仍工作', () => {
    const result = engine.check({
      module: 'test-normal' as any,
      store: 'test-store' as any,
      operation: 'SELECT' as any,
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('Permission granted')
  })

  it('未注册模块仍返回 allowed=false', () => {
    const result = engine.check({
      module: 'not-in-matrix' as any,
      store: 'test-store' as any,
      operation: 'SELECT' as any,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not-in-matrix')
  })

  it('异常路径的 allowed 字段为严格 boolean（非 undefined）', () => {
    const throwResult = engine.check({
      module: 'throw-module' as any,
      store: 'test-store' as any,
      operation: 'SELECT' as any,
    })
    expect(typeof throwResult.allowed).toBe('boolean')
    expect(throwResult.allowed).toBe(false)
  })
})
