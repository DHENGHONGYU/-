/**
 * @fileoverview RBAC 权限管理系统类型定义
 *
 * 5 表模式：users / roles / permissions / user_roles / role_permissions + permission_audit_logs
 * 参考：OWASP Broken Access Control、WorkOS RBAC 最佳实践
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

// ── 用户实体 ──
export interface UserEntity {
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

// ── 角色实体 ──
export interface RoleEntity {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly status: EntityStatus
  readonly isBuiltIn: boolean
  readonly parentRoleId?: string
  readonly createdAt: number
  readonly updatedAt: number
}

// ── 权限实体 ──
export interface PermissionEntity {
  readonly id: string
  readonly name: string
  readonly resource: string
  readonly action: string
  readonly description: string
  readonly status: EntityStatus
  readonly createdAt: number
  readonly updatedAt: number
}

// ── 用户-角色映射 ──
export interface UserRoleMapping {
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

// ── 角色-权限映射 ──
export interface RolePermissionMapping {
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

// ── 审计日志 ──
export interface PermissionAuditLog {
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

// ── 权限回收任务执行结果 ──
export interface RevocationTaskResult {
  readonly executedAt: number
  readonly totalChecked: number
  readonly expiredRevoked: number
  readonly inactiveUserRevoked: number
  readonly policyViolationRevoked: number
  readonly details: ReadonlyArray<{
    mappingId: string
    userId: string
    roleId: string
    reason: RevocationReason
    revokedAt: number
  }>
  readonly durationMs: number
  readonly error?: string
}

// ── 僵尸账号检测结果 ──
export interface ZombieAccountDetectionResult {
  readonly detectedAt: number
  readonly zombieUserIds: readonly string[]
  readonly totalScanned: number
  readonly inactivityThresholdDays: number
  readonly details: ReadonlyArray<{
    userId: string
    username: string
    lastActiveAt: number
    inactiveDays: number
    activePermissionCount: number
  }>
}
