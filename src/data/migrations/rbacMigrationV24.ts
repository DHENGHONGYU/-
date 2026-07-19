/**
 * @fileoverview RBAC 5 表模式迁移（v23 → v24）
 *
 * 创建 6 个 ObjectStore，支撑权限自动回收与僵尸账号检测：
 * - rbac_users / rbac_roles / rbac_permissions
 * - rbac_user_roles / rbac_role_permissions
 * - rbac_permission_audit_logs（append-only 审计日志）
 *
 * 参考：OWASP Broken Access Control、WorkOS RBAC 最佳实践
 *
 * @compliance AGENTS.md §八：增量 store 在对应版本 Migration.up() 中创建
  * @doc []
*/
import type { Migration } from '@/data/db-migrations'
import { STORE_NAME } from '@/config/dbConfig'

export const rbacMigrationV24: Migration = {
  version: 24,
  name: 'create_rbac_tables',
  up({ db }) {
    // ── 1. rbac_users：用户实体表 ──
    if (!db.objectStoreNames.contains(STORE_NAME.rbacUsers)) {
      const store = db.createObjectStore(STORE_NAME.rbacUsers, { keyPath: 'id' })
      store.createIndex('by-status', 'status', { unique: false })
      store.createIndex('by-username', 'username', { unique: false })
      store.createIndex('by-email', 'email', { unique: false })
    }

    // ── 2. rbac_roles：角色实体表 ──
    if (!db.objectStoreNames.contains(STORE_NAME.rbacRoles)) {
      const store = db.createObjectStore(STORE_NAME.rbacRoles, { keyPath: 'id' })
      store.createIndex('by-status', 'status', { unique: false })
      store.createIndex('by-name', 'name', { unique: false })
    }

    // ── 3. rbac_permissions：权限实体表 ──
    if (!db.objectStoreNames.contains(STORE_NAME.rbacPermissions)) {
      const store = db.createObjectStore(STORE_NAME.rbacPermissions, { keyPath: 'id' })
      store.createIndex('by-status', 'status', { unique: false })
      store.createIndex('by-resource', 'resource', { unique: false })
    }

    // ── 4. rbac_user_roles：用户-角色映射表 ──
    if (!db.objectStoreNames.contains(STORE_NAME.rbacUserRoles)) {
      const store = db.createObjectStore(STORE_NAME.rbacUserRoles, { keyPath: 'id' })
      store.createIndex('by-user-id', 'userId', { unique: false })
      store.createIndex('by-role-id', 'roleId', { unique: false })
      store.createIndex('by-status', 'status', { unique: false })
      store.createIndex('by-effective-end', 'effectiveEnd', { unique: false })
    }

    // ── 5. rbac_role_permissions：角色-权限映射表 ──
    if (!db.objectStoreNames.contains(STORE_NAME.rbacRolePermissions)) {
      const store = db.createObjectStore(STORE_NAME.rbacRolePermissions, { keyPath: 'id' })
      store.createIndex('by-role-id', 'roleId', { unique: false })
      store.createIndex('by-permission-id', 'permissionId', { unique: false })
      store.createIndex('by-status', 'status', { unique: false })
    }

    // ── 6. rbac_permission_audit_logs：权限审计日志表（append-only） ──
    if (!db.objectStoreNames.contains(STORE_NAME.rbacPermissionAuditLogs)) {
      const store = db.createObjectStore(STORE_NAME.rbacPermissionAuditLogs, { keyPath: 'id' })
      store.createIndex('by-timestamp', 'timestamp', { unique: false })
      store.createIndex('by-action', 'action', { unique: false })
      store.createIndex('by-target', 'targetId', { unique: false })
      store.createIndex('by-affected-user', 'affectedUserId', { unique: false })
    }
  },
  down({ db }) {
    if (db.objectStoreNames.contains(STORE_NAME.rbacPermissionAuditLogs)) {
      db.deleteObjectStore(STORE_NAME.rbacPermissionAuditLogs)
    }
    if (db.objectStoreNames.contains(STORE_NAME.rbacRolePermissions)) {
      db.deleteObjectStore(STORE_NAME.rbacRolePermissions)
    }
    if (db.objectStoreNames.contains(STORE_NAME.rbacUserRoles)) {
      db.deleteObjectStore(STORE_NAME.rbacUserRoles)
    }
    if (db.objectStoreNames.contains(STORE_NAME.rbacPermissions)) {
      db.deleteObjectStore(STORE_NAME.rbacPermissions)
    }
    if (db.objectStoreNames.contains(STORE_NAME.rbacRoles)) {
      db.deleteObjectStore(STORE_NAME.rbacRoles)
    }
    if (db.objectStoreNames.contains(STORE_NAME.rbacUsers)) {
      db.deleteObjectStore(STORE_NAME.rbacUsers)
    }
  },
}
