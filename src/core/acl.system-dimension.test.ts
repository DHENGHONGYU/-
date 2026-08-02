/**
 * ACL 维度双向验证测试（正向 + 逆向）
 *
 * 背景：健康体检报告中 audit:acl-consistency 报 1 个 ERROR（"system 未覆盖"），
 * 但 dbConfig.ts:493 的 ACL_MATRIX[system] 实际拥有 read/write/actions 全量权限，
 * 且 dbConfig.test.ts 5/5 通过。本测试从两个维度核实该结论：
 *
 * 正向（positive）：system 模块在「不传 apiVersion」时，读写均被 ACL_MATRIX 放行
 *   → 证明 audit 的 ERROR 属误报（配置层确有 system 条目）。
 *
 * 逆向（negative）：registerBuiltinVersionedOverrides() 注册了 system:1.0 → readonly，
 *   → 证明一旦调用方传入 apiVersion='1.0' 并请求写操作，会被静默拒绝（潜在陷阱）。
 *
 * 运行：npx vitest run src/core/acl.system-dimension.test.ts --no-coverage
 */
import { describe, expect, it, beforeEach } from 'vitest'
import {
  aclEngine,
  AclEngine,
  registerBuiltinVersionedOverrides,
} from '@/core/acl'
import { MODULE_ID, STORE_NAME, DB_OPERATION } from '@/config/dbConfig'

const SYSTEM = MODULE_ID.system as ModuleId
const STOCK_STORE = STORE_NAME.stocks as StoreName
const INSERT = DB_OPERATION.insert
const SELECT = DB_OPERATION.select

describe('ACL 维度双向验证 - system 模块', () => {
  beforeEach(() => {
    // 每次重置引擎，避免 versionedOverrides 跨用例污染
    // @ts-expect-error 访问私有 Map 以干净重置
    aclEngine.versionedOverrides = new Map()
  })

  // ──────────────────────────────────────────────
  // 正向：ACL_MATRIX 确实覆盖 system（audit ERROR 为误报）
  // ──────────────────────────────────────────────
  it('正向：system 无 apiVersion 时，写操作被 ACL_MATRIX 放行', () => {
    const r = aclEngine.check({ module: SYSTEM, store: STOCK_STORE, operation: INSERT })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('Permission granted')
  })

  it('正向：system 无 apiVersion 时，读操作被 ACL_MATRIX 放行', () => {
    const r = aclEngine.check({ module: SYSTEM, store: STOCK_STORE, operation: SELECT })
    expect(r.allowed).toBe(true)
  })

  it('正向：system 是 ACL_MATRIX 的已注册键（配置层确有条目）', () => {
    // 直接验证矩阵包含 system，且权限为全量
    // 通过 check 的 "not registered" 分支反向证明：未注册会返回 allowed:false
    const r = aclEngine.check({ module: SYSTEM, store: STOCK_STORE, operation: INSERT })
    expect(r.allowed).toBe(true)
  })

  // ──────────────────────────────────────────────
  // 逆向：system:1.0 readonly 覆盖存在即触发拒绝（潜在陷阱）
  // ──────────────────────────────────────────────
  it('逆向：注册内置覆盖后，system@1.0 写操作被 readonly 拒绝', () => {
    registerBuiltinVersionedOverrides()
    const r = aclEngine.check({
      module: SYSTEM,
      store: STOCK_STORE,
      operation: INSERT,
      apiVersion: '1.0',
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('read-only')
  })

  it('逆向：system@1.0 的读操作仍被允许（readonly 仅禁写）', () => {
    registerBuiltinVersionedOverrides()
    const r = aclEngine.check({
      module: SYSTEM,
      store: STOCK_STORE,
      operation: SELECT,
      apiVersion: '1.0',
    })
    expect(r.allowed).toBe(true)
  })

  it('逆向：独立引擎实例同样复现 readonly 拒绝（非单例副作用）', () => {
    const engine = new AclEngine()
    engine.registerVersionedOverride({ moduleId: SYSTEM, apiVersion: '1.0', level: 'readonly' })
    const r = engine.check({ module: SYSTEM, store: STOCK_STORE, operation: INSERT, apiVersion: '1.0' })
    expect(r.allowed).toBe(false)
  })
})
