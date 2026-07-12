/**
 * @fileoverview IndexedDB Schema 迁移框架
 *
 * 从 db.ts 拆分而来（PR-6 步骤 1.2），职责：
 * - MigrationContext / Migration 接口定义
 * - runMigrations 函数：按版本顺序执行迁移，支持回滚
 * - MIGRATIONS 常量：已注册迁移表
 *
 * 设计原则：纯迁移逻辑，不持有数据库连接状态。
 * 通过 db.ts 的 re-export 保持 '@/data/db' 路径向后兼容。
 */
import { DB_VERSION, STORE_NAME } from '@/config/dbConfig'
import type { LogContext } from '@/lib/logger'
import { rbacMigrationV24 } from './migrations/rbacMigrationV24'

// ── 迁移框架（D-01：IndexedDB Schema 版本化与迁移） ─────────────

export interface MigrationContext {
  /** 当前数据库实例，可在 onupgradeneeded 中 createObjectStore / createIndex */
  db: IDBDatabase
  /** 升级事务；仅 onupgradeneeded 期间可用，用于数据回填；非升级场景为 undefined */
  tx?: IDBTransaction
}

export interface Migration {
  /** 触发该迁移的目标版本号（严格递增） */
  version: number
  /** 迁移名称，用于日志与审计 */
  name: string
  /** 正向迁移逻辑；必须同步执行（在 onupgradeneeded 中调用，禁止 await） */
  up(ctx: MigrationContext): void
  /** 反向回滚逻辑；迁移失败时被逆序调用 */
  down?(ctx: MigrationContext): void
}

interface LoggerLike {
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  debug(message: string, context?: LogContext): void
}

/**
 * 按版本顺序执行待应用的迁移。
 * - 仅执行 oldVersion < m.version <= newVersion 的迁移
 * - 任一迁移抛错时，已成功的迁移按逆序执行 down() 回滚，并向上抛出
 * - 全程结构化日志，便于排障
 */
export function runMigrations(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  migrations: readonly Migration[],
  log: LoggerLike,
  tx?: IDBTransaction,
): void {
  const pending = migrations
    .filter((m) => m.version > oldVersion && m.version <= newVersion)
    .sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    return
  }

  const applied: Migration[] = []
  try {
    for (const m of pending) {
      log.info(`[DB] Migration up → v${m.version}: ${m.name}`)
      m.up({ db, tx })
      applied.push(m)
    }
    const tags = applied.map((m) => `v${m.version}`).join(', ')
    log.info(`[DB] Migrations applied: [${tags}]`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const last = applied.at(-1)?.version
    log.error(`[DB] Migration failed at v${last}; rolling back`, { error: message })
    rollbackMigrations(db, tx, applied, log)
    throw err
  }
}

function rollbackMigrations(
  db: IDBDatabase,
  tx: IDBTransaction | undefined,
  applied: Migration[],
  log: LoggerLike,
): void {
  for (let i = applied.length - 1; i >= 0; i--) {
    const m = applied[i]
    if (!m?.down) continue
    try {
      log.warn(`[DB] Migration rollback ↓ v${m.version}: ${m.name}`)
      m.down({ db, tx })
    } catch (downErr) {
      log.error(`[DB] Rollback failed at v${m.version}`, {
        error: downErr instanceof Error ? downErr.message : String(downErr),
      })
    }
  }
}

/**
 * 已注册迁移表（按 version 升序）。
 * 新增 Schema 变更时：在 dbConfig 中将 DB_VERSION +1，并在此处追加一条 Migration。
 */
export const MIGRATIONS: readonly Migration[] = [
  // RBAC 6 表创建必须在 seed 之前执行（seed 依赖 schema 就绪）
  rbacMigrationV24,
  // ── 阶段 B-1：v26 custom_agents 表种子数据 ──
  // 注意：store 本身由 createSchema（db-schema.ts）创建，此处仅写入版本标记（DRY 原则）
  {
    version: 26,
    name: 'seed_custom_agents_tracker',
    up({ tx }) {
      if (!tx) return
      // customAgents store 由 createSchema 创建；此处仅记录版本标记
      if (tx.db.objectStoreNames.contains(STORE_NAME.schemaMigrations)) {
        const tracker = tx.objectStore(STORE_NAME.schemaMigrations)
        tracker.put({
          id: 'custom_agents_initialized',
          version: 26,
          appliedAt: Date.now(),
          note: 'custom_agents store created by createSchema (baseline)',
        })
      }
    },
  },
  // ── v28 workflow 4 表版本标记（WorkflowServer 数据冗余） ──
  // store 本身由 createSchema 创建；此处仅记录版本标记
  {
    version: 28,
    name: 'seed_workflow_stores_tracker',
    up({ tx }) {
      if (!tx) return
      if (tx.db.objectStoreNames.contains(STORE_NAME.schemaMigrations)) {
        const tracker = tx.objectStore(STORE_NAME.schemaMigrations)
        tracker.put({
          id: 'workflow_stores_initialized',
          version: 28,
          appliedAt: Date.now(),
          note: 'workflow_defs/schedules/triggers/runs stores created by createSchema (baseline)',
        })
      }
    },
  },
  // ── v27 trace_records 表版本标记 ──
  // store 本身由 createSchema 创建；此处仅记录版本标记
  {
    version: 27,
    name: 'seed_trace_records_tracker',
    up({ tx }) {
      if (!tx) return
      if (tx.db.objectStoreNames.contains(STORE_NAME.schemaMigrations)) {
        const tracker = tx.objectStore(STORE_NAME.schemaMigrations)
        tracker.put({
          id: 'trace_records_initialized',
          version: 27,
          appliedAt: Date.now(),
          note: 'trace_records store created by createSchema (baseline)',
        })
      }
    },
  },
  {
    version: DB_VERSION,
    name: 'seed_schema_migrations_tracker',
    up({ tx }) {
      if (!tx) return
      const store = tx.objectStore(STORE_NAME.schemaMigrations)
      store.put({
        id: 'framework_initialized',
        version: DB_VERSION,
        appliedAt: Date.now(),
        note: 'schema migration framework initialized',
      })
    },
  },
]
