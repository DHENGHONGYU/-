/**
 * @module RbacManagementService
 * @lifecycle @Global
 * @description
 * RBAC 管理服务 — 用户/角色/权限实体的 CRUD + 角色授予/撤销 + 权限分配/移除 + 查询。
 *
 * 5 表模式（rbac.types）：
 * - rbacUsers / rbacRoles / rbacPermissions
 * - rbacUserRoles / rbacRolePermissions
 * - rbacPermissionAuditLogs（审计日志，由 permissionRevocationService 与 grant/revoke 共用）
 */

import { nanoid } from 'nanoid'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, STORE_NAME, type EnvelopeAction } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type {
  UserEntity,
  RoleEntity,
  PermissionEntity,
  UserRoleMapping,
  RolePermissionMapping,
  PermissionAuditLog,
} from '@/types/modules/rbac.types'

const logger = getLogger()

// ── 输入 DTO ──

export interface CreateUserInput {
  username: string
  email: string
  department?: string
  displayName?: string
}

export interface UpdateUserInput {
  id: string
  username?: string
  email?: string
  displayName?: string
  department?: string
}

export interface CreateRoleInput {
  name: string
  description: string
  parentRoleId?: string
  isBuiltIn?: boolean
}

export interface CreatePermissionInput {
  name: string
  resource: string
  action: string
  description: string
}

export interface GrantUserRoleInput {
  userId: string
  roleId: string
  grantedBy: string
  grantReason: string
  /** 有效期（ms），默认 90 天 */
  ttlMs?: number
}

export interface GrantRolePermissionInput {
  roleId: string
  permissionId: string
  grantedBy: string
  grantReason: string
}

// ── 结果类型 ──

export interface CrudResult {
  success: boolean
  id?: string
  error?: string
}

export interface QueryResult<T> {
  success: boolean
  data: T
  error?: string
}

// ── 辅助 ──

function trace(operation: string, traceId: string): void {
  logger.debug(`[RbacManagementService] ${operation}`, { traceId })
}

function id(): string {
  return `rbac-${nanoid(12)}`
}

function now(): number {
  return Date.now()
}

/** 构建带 traceId 的信封 */
function envelope<T>(payload: T, action: EnvelopeAction, traceId: string) {
  return EnvelopeFactory.create(
    { source: 'system', target: ENVELOPE_TARGET.db, action, traceId },
    payload,
  )
}

/** 标准数据桥转发 + 错误包装 */
async function forward<T>(payload: T, action: EnvelopeAction, traceId: string, label: string): Promise<CrudResult> {
  try {
    await dataBridge.forward(envelope(payload, action, traceId))
    trace(`${label}:ok`, traceId)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[RbacManagementService] ${label} failed`, { traceId, error: msg })
    return { success: false, error: msg }
  }
}

// ── 审计日志记录 ──

async function writeAudit(
  params: Omit<PermissionAuditLog, 'id' | 'timestamp' | 'traceId'>,
  parentTraceId: string,
): Promise<void> {
  const auditId = id()
  const auditTraceId = `${parentTraceId}-audit`
  const record: PermissionAuditLog = {
    id: auditId,
    ...params,
    timestamp: now(),
    traceId: auditTraceId,
  }
  await dataBridge.forward(envelope(record, ENVELOPE_ACTION.saveRbacAuditLog, auditTraceId))
}

// ═══════════════════════════════════════════
// 用户管理
// ═══════════════════════════════════════════

/**
 * createUser
 */
export async function createUser(
  input: CreateUserInput,
  operatorId: string,
  parentTraceId?: string,
): Promise<CrudResult> {
  const tId = parentTraceId ?? id()
  const ts = now()
  const user: UserEntity = {
    id: id(),
    username: input.username,
    email: input.email,
    status: 'active',
    department: input.department,
    displayName: input.displayName,
    createdAt: ts,
    updatedAt: ts,
    lastActiveAt: ts,
  }
  const result = await forward(user, ENVELOPE_ACTION.saveRbacUser, tId, 'createUser')
  if (result.success) {
    result.id = user.id
    await writeAudit(
      { action: 'grant', targetType: 'user', targetId: user.id, operatorId,
        affectedUserId: user.id, afterState: { ...user }, reason: `Created user ${user.username}` },
      tId,
    )
    eventBus.emit('rbac:user-created', { userId: user.id, username: user.username })
  }
  return result
}

/**
 * updateUser
 */
export async function updateUser(
  input: UpdateUserInput,
  operatorId: string,
): Promise<CrudResult> {
  const tId = id()
  const existing = await getUser(input.id)
  if (!existing.success || !existing.data) {
    return { success: false, error: 'User not found' }
  }
  const prev = { ...existing.data }
  const updated: UserEntity = {
    ...existing.data,
    username: input.username ?? existing.data.username,
    email: input.email ?? existing.data.email,
    displayName: input.displayName ?? existing.data.displayName,
    department: input.department ?? existing.data.department,
    updatedAt: now(),
  }
  const result = await forward(updated, ENVELOPE_ACTION.saveRbacUser, tId, 'updateUser')
  if (result.success) {
    await writeAudit(
      { action: 'modify', targetType: 'user', targetId: input.id, operatorId,
        affectedUserId: input.id, beforeState: { ...prev }, afterState: { ...updated },
        reason: `Updated user ${updated.username}` },
      tId,
    )
    eventBus.emit('rbac:user-updated', { userId: input.id })
  }
  return result
}

/**
 * deleteUser
 */
export async function deleteUser(
  userId: string,
  operatorId: string,
): Promise<CrudResult> {
  const tId = id()
  const existing = await getUser(userId)
  if (!existing.success || !existing.data) {
    return { success: false, error: 'User not found' }
  }
  // 软删除：设置 status='deleted'
  const deleted: UserEntity = {
    ...existing.data,
    status: 'deleted',
    updatedAt: now(),
  }
  const result = await forward(deleted, ENVELOPE_ACTION.saveRbacUser, tId, 'deleteUser')
  if (result.success) {
    await writeAudit(
      { action: 'delete', targetType: 'user', targetId: userId, operatorId,
        affectedUserId: userId, beforeState: { ...existing.data }, afterState: { ...deleted },
        reason: 'Soft-deleted user' },
      tId,
    )
    eventBus.emit('rbac:user-deleted', { userId })
  }
  return result
}

/**
 * getUser
 * @param userId
 * @returns Promise<QueryResult<UserEntity | null>>
 */
export async function getUser(userId: string): Promise<QueryResult<UserEntity | null>> {
  try {
    const res = await dataBridge.query<UserEntity>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacUsers,
      indexName: 'id',
      indexValue: userId,
      source: 'system',
    })
    return { success: true, data: res.data ?? null }
  } catch (err) {
    return { success: false, data: null, error: (err as Error).message }
  }
}

/**
 * listUsers
 * @param onlyActive
 * @returns Promise<QueryResult<UserEntity[]>>
 */
export async function listUsers(onlyActive = true): Promise<QueryResult<UserEntity[]>> {
  try {
    const res = await dataBridge.query<UserEntity[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacUsers,
      indexName: 'by-status',
      indexValue: onlyActive ? 'active' : undefined,
      source: 'system',
    })
    return { success: true, data: res.data ?? [] }
  } catch (err) {
    return { success: false, data: [], error: (err as Error).message }
  }
}

// ═══════════════════════════════════════════
// 角色管理
// ═══════════════════════════════════════════

/**
 * createRole
 */
export async function createRole(
  input: CreateRoleInput,
  operatorId: string,
): Promise<CrudResult> {
  const tId = id()
  const ts = now()
  const role: RoleEntity = {
    id: id(),
    name: input.name,
    description: input.description,
    status: 'active',
    isBuiltIn: input.isBuiltIn ?? false,
    parentRoleId: input.parentRoleId,
    createdAt: ts,
    updatedAt: ts,
  }
  const result = await forward(role, ENVELOPE_ACTION.saveRbacRole, tId, 'createRole')
  if (result.success) {
    result.id = role.id
    await writeAudit(
      { action: 'grant', targetType: 'role', targetId: role.id, operatorId,
        afterState: { ...role }, reason: `Created role ${role.name}` },
      tId,
    )
  }
  return result
}

/**
 * updateRole
 */
export async function updateRole(
  role: RoleEntity,
): Promise<CrudResult> {
  const tId = id()
  const updated = { ...role, updatedAt: now() }
  return forward(updated, ENVELOPE_ACTION.saveRbacRole, tId, 'updateRole')
}

/**
 * deleteRole
 */
export async function deleteRole(
  roleId: string,
): Promise<CrudResult> {
  const tId = id()
  const existing = await getRole(roleId)
  if (!existing.success || !existing.data) {
    return { success: false, error: 'Role not found' }
  }
  const deleted: RoleEntity = { ...existing.data, status: 'deleted', updatedAt: now() }
  return forward(deleted, ENVELOPE_ACTION.saveRbacRole, tId, 'deleteRole')
}

/**
 * getRole
 * @param roleId
 * @returns Promise<QueryResult<RoleEntity | null>>
 */
export async function getRole(roleId: string): Promise<QueryResult<RoleEntity | null>> {
  try {
    const res = await dataBridge.query<RoleEntity>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacRoles,
      indexName: 'id',
      indexValue: roleId,
      source: 'system',
    })
    return { success: true, data: res.data ?? null }
  } catch (err) {
    return { success: false, data: null, error: (err as Error).message }
  }
}

/**
 * listRoles
 * @param onlyActive
 * @returns Promise<QueryResult<RoleEntity[]>>
 */
export async function listRoles(onlyActive = true): Promise<QueryResult<RoleEntity[]>> {
  try {
    const res = await dataBridge.query<RoleEntity[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacRoles,
      indexName: 'by-status',
      indexValue: onlyActive ? 'active' : undefined,
      source: 'system',
    })
    return { success: true, data: res.data ?? [] }
  } catch (err) {
    return { success: false, data: [], error: (err as Error).message }
  }
}

// ═══════════════════════════════════════════
// 权限管理
// ═══════════════════════════════════════════

/**
 * createPermission
 */
export async function createPermission(
  input: CreatePermissionInput,
): Promise<CrudResult> {
  const tId = id()
  const ts = now()
  const perm: PermissionEntity = {
    id: id(),
    name: input.name,
    resource: input.resource,
    action: input.action,
    description: input.description,
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  }
  return forward(perm, ENVELOPE_ACTION.saveRbacPermission, tId, 'createPermission')
}

/**
 * updatePermission
 */
export async function updatePermission(
  perm: PermissionEntity,
): Promise<CrudResult> {
  const tId = id()
  const updated = { ...perm, updatedAt: now() }
  return forward(updated, ENVELOPE_ACTION.saveRbacPermission, tId, 'updatePermission')
}

/**
 * listPermissions
 * @param onlyActive
 * @returns Promise<QueryResult<PermissionEntity[]>>
 */
export async function listPermissions(onlyActive = true): Promise<QueryResult<PermissionEntity[]>> {
  try {
    const res = await dataBridge.query<PermissionEntity[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacPermissions,
      indexName: 'by-status',
      indexValue: onlyActive ? 'active' : undefined,
      source: 'system',
    })
    return { success: true, data: res.data ?? [] }
  } catch (err) {
    return { success: false, data: [], error: (err as Error).message }
  }
}

// ═══════════════════════════════════════════
// 角色授予 / 撤销
// ═══════════════════════════════════════════

/**
 * grantUserRole
 */
export async function grantUserRole(
  input: GrantUserRoleInput,
  parentTraceId?: string,
): Promise<CrudResult> {
  const tId = parentTraceId ?? id()
  const ts = now()
  const ttlMs = input.ttlMs ?? 90 * 24 * 60 * 60 * 1000 // 默认 90 天
  const effectiveEnd = ts + ttlMs

  const mapping: UserRoleMapping = {
    id: id(),
    userId: input.userId,
    roleId: input.roleId,
    status: 'active',
    effectiveStart: ts,
    effectiveEnd,
    grantedAt: ts,
    grantedBy: input.grantedBy,
    grantReason: input.grantReason,
  }

  const result = await forward(mapping, ENVELOPE_ACTION.saveRbacUserRole, tId, 'grantUserRole')
  if (result.success) {
    result.id = mapping.id
    await writeAudit(
      { action: 'grant', targetType: 'user_role', targetId: mapping.id, operatorId: input.grantedBy,
        affectedUserId: input.userId, afterState: { ...mapping },
        reason: `Granted role ${input.roleId} to user ${input.userId} (reason: ${input.grantReason})` },
      tId,
    )
    eventBus.emit('rbac:role-granted', { userId: input.userId, roleId: input.roleId, mappingId: mapping.id })
  }
  return result
}

/**
 * revokeUserRole
 */
export async function revokeUserRole(
  mappingId: string,
  operatorId: string,
  reason: string,
): Promise<CrudResult> {
  const tId = id()
  // 查询当前映射
  const res = await dataBridge.query<UserRoleMapping>({
    action: ENVELOPE_ACTION.queryByIndex,
    store: STORE_NAME.rbacUserRoles,
    indexName: 'id',
    indexValue: mappingId,
    source: 'system',
  })
  if (!res.success || !res.data) {
    return { success: false, error: 'User role mapping not found' }
  }
  const before = { ...res.data }
  const revoked: UserRoleMapping = {
    ...res.data,
    status: 'revoked',
    revocationReason: 'manual_revoke',
    revokedAt: now(),
    revokedBy: operatorId,
  }
  const result = await forward(revoked, ENVELOPE_ACTION.saveRbacUserRole, tId, 'revokeUserRole')
  if (result.success) {
    await writeAudit(
      { action: 'revoke', targetType: 'user_role', targetId: mappingId, operatorId,
        affectedUserId: revoked.userId, beforeState: { ...before }, afterState: { ...revoked },
        reason },
      tId,
    )
    eventBus.emit('rbac:role-revoked', { userId: revoked.userId, roleId: revoked.roleId, mappingId })
  }
  return result
}

/**
 * getUserRoles
 * @param userId
 * @returns Promise<QueryResult<UserRoleMapping[]>>
 */
export async function getUserRoles(userId: string): Promise<QueryResult<UserRoleMapping[]>> {
  try {
    const res = await dataBridge.query<UserRoleMapping[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacUserRoles,
      indexName: 'by-user-id',
      indexValue: userId,
      source: 'system',
    })
    return { success: true, data: res.data ?? [] }
  } catch (err) {
    return { success: false, data: [], error: (err as Error).message }
  }
}

// ═══════════════════════════════════════════
// 权限分配 / 移除
// ═══════════════════════════════════════════

/**
 * grantRolePermission
 */
export async function grantRolePermission(
  input: GrantRolePermissionInput,
): Promise<CrudResult> {
  const tId = id()
  const ts = now()

  const mapping: RolePermissionMapping = {
    id: id(),
    roleId: input.roleId,
    permissionId: input.permissionId,
    status: 'active',
    grantedAt: ts,
    grantedBy: input.grantedBy,
    grantReason: input.grantReason,
  }

  const result = await forward(mapping, ENVELOPE_ACTION.saveRbacRolePermission, tId, 'grantRolePermission')
  if (result.success) {
    result.id = mapping.id
    await writeAudit(
      { action: 'grant', targetType: 'role_permission', targetId: mapping.id,
        operatorId: input.grantedBy, afterState: { ...mapping },
        reason: `Granted permission ${input.permissionId} to role ${input.roleId}` },
      tId,
    )
  }
  return result
}

/**
 * revokeRolePermission
 */
export async function revokeRolePermission(
  mappingId: string,
  operatorId: string,
): Promise<CrudResult> {
  const tId = id()
  const res = await dataBridge.query<RolePermissionMapping>({
    action: ENVELOPE_ACTION.queryByIndex,
    store: STORE_NAME.rbacRolePermissions,
    indexName: 'id',
    indexValue: mappingId,
    source: 'system',
  })
  if (!res.success || !res.data) {
    return { success: false, error: 'Role permission mapping not found' }
  }
  const revoked: RolePermissionMapping = {
    ...res.data,
    status: 'revoked',
    revocationReason: 'manual_revoke',
    revokedAt: now(),
    revokedBy: operatorId,
  }
  return forward(revoked, ENVELOPE_ACTION.saveRbacRolePermission, tId, 'revokeRolePermission')
}

/**
 * getRolePermissions
 * @param roleId
 * @returns Promise<QueryResult<RolePermissionMapping[]>>
 */
export async function getRolePermissions(roleId: string): Promise<QueryResult<RolePermissionMapping[]>> {
  try {
    const res = await dataBridge.query<RolePermissionMapping[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacRolePermissions,
      indexName: 'by-role-id',
      indexValue: roleId,
      source: 'system',
    })
    return { success: true, data: res.data ?? [] }
  } catch (err) {
    return { success: false, data: [], error: (err as Error).message }
  }
}

// ═══════════════════════════════════════════
// 组合查询：用户有效权限（所有活跃角色的权限并集）
// ═══════════════════════════════════════════

/**
 * getUserEffectivePermissions
 */
export async function getUserEffectivePermissions(
  userId: string,
): Promise<QueryResult<PermissionEntity[]>> {
  const tId = id()
  try {
    // 1. 查用户 → 角色映射（仅 active）
    const rolesRes = await getUserRoles(userId)
    if (!rolesRes.success) throw new Error(rolesRes.error)
    const activeRoles = rolesRes.data.filter((r) => r.status === 'active')
    if (activeRoles.length === 0) return { success: true, data: [] }

    // 2. 查角色 → 权限映射（仅 active），去重
    const permIds = new Set<string>()
    for (const ur of activeRoles) {
      const rpRes = await getRolePermissions(ur.roleId)
      if (!rpRes.success) continue
      rpRes.data.filter((rp) => rp.status === 'active').forEach((rp) => permIds.add(rp.permissionId))
    }

    // 3. 按 permissionId 查 PermissionEntity
    const perms: PermissionEntity[] = []
    for (const pid of permIds) {
      const permRes = await dataBridge.query<PermissionEntity>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.rbacPermissions,
        indexName: 'id',
        indexValue: pid,
        source: 'system',
      })
      if (!permRes.success || !permRes.data) continue
      perms.push(permRes.data)
    }

    trace(`getUserEffectivePermissions(${userId}): found ${perms.length}`, tId)
    return { success: true, data: perms }
  } catch (err) {
    return { success: false, data: [], error: (err as Error).message }
  }
}
