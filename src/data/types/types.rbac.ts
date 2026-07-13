/**
 * @fileoverview RBAC 6 表持久化实体类型
 *
 * 类型真相源位于 src/types/modules/rbac.types.ts，
 * 本文件为 validator 与 dataLayer 提供完整字段的 interface 定义。
 */

// ── 审计动作类型 ──
export type AuditAction = 'grant' | 'revoke' | 'modify' | 'archive' | 'delete'

// ── 回收原因类型 ──
export type RevocationReason = 'expired' | 'inactive_user' | 'policy_violation' | 'manual_revoke'

// ── 审计日志目标类型 ──
export type AuditTargetType = 'user_role' | 'role_permission' | 'user' | 'role' | 'permission'

// ── 实体状态类型 ──
export type EntityStatus = 'active' | 'inactive' | 'suspended' | 'deleted'
export type MappingStatus = 'active' | 'expired' | 'revoked' | 'pending'

/** RBAC 用户实体（rbac_users store） */
export interface RbacUser {
  readonly id: string
  readonly username: string
  readonly email: string
  readonly status: EntityStatus
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastActiveAt: number
  readonly department?: string
  readonly displayName?: string
}

/** RBAC 角色实体（rbac_roles store） */
export interface RbacRole {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly status: EntityStatus
  readonly isBuiltIn: boolean
  readonly parentRoleId?: string
  readonly createdAt: number
  readonly updatedAt: number
}

/** RBAC 权限实体（rbac_permissions store） */
export interface RbacPermission {
  readonly id: string
  readonly name: string
  readonly resource: string
  readonly action: string
  readonly description: string
  readonly status: EntityStatus
  readonly createdAt: number
  readonly updatedAt: number
}

/** RBAC 用户-角色映射（rbac_user_roles store） */
export interface RbacUserRole {
  readonly id: string
  readonly userId: string
  readonly roleId: string
  readonly status: MappingStatus
  readonly effectiveStart: number
  readonly effectiveEnd: number
  readonly grantedAt: number
  readonly grantedBy: string
  readonly grantReason: string
  readonly revocationReason?: RevocationReason
  readonly revokedAt?: number
  readonly revokedBy?: string
}

/** RBAC 角色-权限映射（rbac_role_permissions store） */
export interface RbacRolePermission {
  readonly id: string
  readonly roleId: string
  readonly permissionId: string
  readonly status: MappingStatus
  readonly grantedAt: number
  readonly grantedBy: string
  readonly grantReason: string
  readonly revocationReason?: RevocationReason
  readonly revokedAt?: number
  readonly revokedBy?: string
}

/** RBAC 权限审计日志（rbac_permission_audit_logs store） */
export interface RbacPermissionAuditLog {
  readonly id: string
  readonly action: AuditAction
  readonly targetType: AuditTargetType
  readonly targetId: string
  readonly operatorId: string
  readonly affectedUserId?: string
  readonly beforeState?: Record<string, unknown>
  readonly afterState?: Record<string, unknown>
  readonly reason: string
  readonly timestamp: number
  readonly traceId: string
}
