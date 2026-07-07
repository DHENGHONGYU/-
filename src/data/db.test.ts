import { describe, it, expect, vi } from 'vitest'
import { DB_VERSION } from '@/config/dbConfig'
import {
  runMigrations,
  MIGRATIONS,
  type Migration,
} from '@/data/db'

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

describe('runMigrations (D-01)', () => {
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
    const migrations: Migration[] = [{ version: 2, name: 'm2', up }]
    runMigrations(
      db as unknown as IDBDatabase,
      2,
      3,
      migrations,
      log,
      tx as unknown as IDBTransaction,
    )
    expect(up).not.toHaveBeenCalled()
  })

  it('无待应用迁移时直接返回且不写日志', () => {
    const log = makeLogger()
    const tx = { objectStore: vi.fn() }
    const db = makeMockDb()
    runMigrations(
      db as unknown as IDBDatabase,
      5,
      5,
      [{ version: 1, name: 'm1', up: vi.fn() }],
      log,
      tx as unknown as IDBTransaction,
    )
    expect(log.info).not.toHaveBeenCalled()
  })

  it('迁移失败时对已成功的迁移逆序回滚并向上抛出', () => {
    const log = makeLogger()
    const tx = { objectStore: vi.fn() }
    const db = makeMockDb()
    const down1 = vi.fn()
    const down2 = vi.fn()
    const err = new Error('boom')
    const migrations: Migration[] = [
      { version: 1, name: 'm1', up: () => {}, down: down1 },
      { version: 2, name: 'm2', up: () => { throw err }, down: down2 },
    ]
    expect(() =>
      runMigrations(
        db as unknown as IDBDatabase,
        0,
        2,
        migrations,
        log,
        tx as unknown as IDBTransaction,
      ),
    ).toThrow('boom')
    expect(down1).toHaveBeenCalledTimes(1)
    expect(down2).not.toHaveBeenCalled()
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('rolling back'),
      expect.objectContaining({ error: 'boom' }),
    )
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('rollback ↓ v1'),
    )
  })

  it('向 up/down 透传 MigrationContext（db, tx）', () => {
    const log = makeLogger()
    const tx = { objectStore: vi.fn() }
    const db = makeMockDb()
    let capturedDb: unknown = null
    let capturedTx: unknown = null
    const migrations: Migration[] = [
      {
        version: 1,
        name: 'm1',
        up: (ctx) => {
          capturedDb = ctx.db
          capturedTx = ctx.tx
        },
      },
    ]
    runMigrations(
      db as unknown as IDBDatabase,
      0,
      1,
      migrations,
      log,
      tx as unknown as IDBTransaction,
    )
    expect(capturedDb).toBe(db)
    expect(capturedTx).toBe(tx)
  })

  it('MIGRATIONS 注册表包含 schema 追踪迁移且版本等于 DB_VERSION', () => {
    const first = MIGRATIONS[0]
    expect(first).toBeDefined()
    expect(first?.version).toBe(DB_VERSION)
    expect(first?.name).toBe('seed_schema_migrations_tracker')
  })
})
