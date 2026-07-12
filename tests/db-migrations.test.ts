import { describe, it, expect, vi } from 'vitest'
import { DB_VERSION } from '@/config/dbConfig'
import {
  runMigrations,
  MIGRATIONS,
  type Migration,
} from '@/data/db-migrations'

/**
 * db-migrations 迁移框架模块测试
 *
 * 验证目标（PR-6 步骤 1.2）：
 * 1. runMigrations 行为契约：版本顺序执行、区间过滤、回滚逻辑
 * 2. MIGRATIONS 常量完整性：包含 seed_schema_migrations_tracker
 * 3. 与原 db.ts 实现的行为一致性（拆分前后兼容）
 */
interface MockLogger {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  debug: ReturnType<typeof vi.fn>
}

function makeLogger(): MockLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

function makeMockDb(): { objectStoreNames: { contains: ReturnType<typeof vi.fn> } } {
  return { objectStoreNames: { contains: vi.fn(() => true) } }
}

describe('db-migrations 迁移框架模块', () => {
  describe('runMigrations - 迁移执行器', () => {
    it('按版本顺序执行 (oldVersion, newVersion] 区间内的迁移', () => {
      const log = makeLogger()
      const tx = { objectStore: vi.fn() }
      const db = makeMockDb()
      const order: string[] = []
      const migrations: Migration[] = [
        { version: 1, name: 'm1', up: () => { order.push('m1') } },
        { version: 3, name: 'm3', up: () => { order.push('m3') } },
        { version: 2, name: 'm2', up: () => { order.push('m2') } },
        { version: 5, name: 'm5', up: () => { order.push('m5') } },
      ]
      runMigrations(
        db as unknown as IDBDatabase,
        0,
        3,
        migrations,
        log,
        tx as unknown as IDBTransaction,
      )
      expect(order).toEqual(['m1', 'm2', 'm3'])
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('v1: m1'))
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('v2: m2'))
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('v3: m3'))
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('[v1, v2, v3]'))
    })

    it('跳过 version <= oldVersion 的迁移（已应用）', () => {
      const log = makeLogger()
      const tx = { objectStore: vi.fn() }
      const db = makeMockDb()
      const up = vi.fn()
      const migrations: Migration[] = [
        { version: 1, name: 'm1', up },
        { version: 2, name: 'm2', up },
        { version: 3, name: 'm3', up },
      ]
      runMigrations(db as unknown as IDBDatabase, 2, 3, migrations, log, tx as unknown as IDBTransaction)
      expect(up).toHaveBeenCalledTimes(1)
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('v3: m3'))
    })

    it('跳过 version > newVersion 的迁移（未到达）', () => {
      const log = makeLogger()
      const tx = { objectStore: vi.fn() }
      const db = makeMockDb()
      const up = vi.fn()
      const migrations: Migration[] = [
        { version: 1, name: 'm1', up },
        { version: 2, name: 'm2', up },
        { version: 5, name: 'm5', up },
      ]
      runMigrations(db as unknown as IDBDatabase, 0, 2, migrations, log, tx as unknown as IDBTransaction)
      expect(up).toHaveBeenCalledTimes(2)
    })

    it('无待执行迁移时直接返回（空区间）', () => {
      const log = makeLogger()
      const tx = { objectStore: vi.fn() }
      const db = makeMockDb()
      const up = vi.fn()
      const migrations: Migration[] = [
        { version: 1, name: 'm1', up },
      ]
      runMigrations(db as unknown as IDBDatabase, 1, 1, migrations, log, tx as unknown as IDBTransaction)
      expect(up).not.toHaveBeenCalled()
      expect(log.info).not.toHaveBeenCalled()
    })

    it('迁移失败时按逆序执行 down() 回滚并向上抛出', () => {
      const log = makeLogger()
      const tx = { objectStore: vi.fn() }
      const db = makeMockDb()
      const order: string[] = []
      const migrations: Migration[] = [
        { version: 1, name: 'm1', up: () => { order.push('m1-up') }, down: () => { order.push('m1-down') } },
        { version: 2, name: 'm2', up: () => { order.push('m2-up') }, down: () => { order.push('m2-down') } },
        { version: 3, name: 'm3-fail', up: () => { throw new Error('boom') } },
      ]
      expect(() =>
        runMigrations(db as unknown as IDBDatabase, 0, 3, migrations, log, tx as unknown as IDBTransaction),
      ).toThrow('boom')
      // m1, m2 成功执行 up，失败后按逆序执行 down
      expect(order).toEqual(['m1-up', 'm2-up', 'm2-down', 'm1-down'])
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Migration failed'), expect.anything())
      // log.warn 只传 1 个参数（message），不带 context
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('rollback ↓ v2'))
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('rollback ↓ v1'))
    })

    it('回滚失败时记录错误但继续回滚其他迁移', () => {
      const log = makeLogger()
      const tx = { objectStore: vi.fn() }
      const db = makeMockDb()
      const migrations: Migration[] = [
        {
          version: 1,
          name: 'm1',
          up: () => {},
          down: () => { throw new Error('rollback-fail') },
        },
        {
          version: 2,
          name: 'm2-fail',
          up: () => { throw new Error('up-fail') },
        },
      ]
      expect(() =>
        runMigrations(db as unknown as IDBDatabase, 0, 2, migrations, log, tx as unknown as IDBTransaction),
      ).toThrow('up-fail')
      // m1 回滚失败应被记录但不阻止抛出
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Rollback failed at v1'), expect.anything())
    })
  })

  describe('MIGRATIONS - 已注册迁移表', () => {
    it('包含 seed_schema_migrations_tracker 迁移', () => {
      const seed = MIGRATIONS.find((m) => m.name === 'seed_schema_migrations_tracker')
      expect(seed).toBeDefined()
      expect(seed?.version).toBe(DB_VERSION)
    })

    it('MIGRATIONS 是 readonly 数组', () => {
      // readonly 类型保证，运行时仍是数组但类型层面禁止 push
      expect(Array.isArray(MIGRATIONS)).toBe(true)
      expect(MIGRATIONS.length).toBeGreaterThan(0)
    })

    it('与原 db.ts 实现兼容（通过 re-export 导出同一实例）', async () => {
      // 动态导入验证 re-export 透传的是同一实例
      const { MIGRATIONS: reExported } = await import('@/data/db')
      expect(reExported).toBe(MIGRATIONS)
    })
  })
})
