/**
 * @module PermissionRevocationService
 * @lifecycle @Global
 * @description
 * 权限自动回收定时任务服务，解决"僵尸账号"与"权限膨胀"两大风险。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { nanoid } from 'nanoid'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, STORE_NAME } from '@/config/dbConfig'
import {
  DEFAULT_RBAC_THRESHOLDS,
  getRbacThresholds,
  type RbacThresholds,
} from '@/config/rbacThresholds'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type {
  PermissionAuditLog,
  RevocationTaskResult,
  UserEntity,
  UserRoleMapping,
  ZombieAccountDetectionResult,
  AuditAction,
  RevocationReason,
} from '@/types/modules/rbac.types'

const logger = getLogger()

class PermissionRevocationService {
  private expiryTimer: ReturnType<typeof setInterval> | null = null
  private zombieTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private lastExpiryResult: RevocationTaskResult | null = null
  private lastZombieResult: ZombieAccountDetectionResult | null = null
  private thresholds: RbacThresholds

  constructor(thresholds: RbacThresholds = DEFAULT_RBAC_THRESHOLDS) {
    this.thresholds = thresholds
    logger.info('[PermissionRevocationService] Initialized', {
      expiryIntervalMs: thresholds.expiryRevocationIntervalMs,
      zombieIntervalMs: thresholds.zombieDetectionIntervalMs,
      inactivityThresholdDays: thresholds.inactivityThresholdDays,
    })
  }

  private _trace(
    traceId: string,
    phase: string,
    message: string,
    context: Record<string, unknown> = {},
  ): void {
    logger.info(`[PermissionRevocationService] ${message}`, { traceId, ...context })
    logger.debug(`[PermissionRevocationService] [TRACE] ${message}`, {
      traceId,
      phase,
      timestamp: new Date().toISOString(),
      ...context,
    })
  }

  start(
    expiryIntervalMs: number = this.thresholds.expiryRevocationIntervalMs,
    zombieIntervalMs: number = this.thresholds.zombieDetectionIntervalMs,
  ): void {
    if (this.running) {
      logger.debug('[PermissionRevocationService] Already running, start() ignored')
      return
    }

    this.running = true
    logger.info('[PermissionRevocationService] Starting scheduled tasks', {
      expiryIntervalMs,
      zombieIntervalMs,
    })

    this.expiryTimer = setInterval(() => {
      this.runExpiryRevocation().catch((err) => {
        logger.error('[PermissionRevocationService] Expiry revocation task failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }, expiryIntervalMs)

    this.zombieTimer = setInterval(() => {
      this.runZombieDetection().catch((err) => {
        logger.error('[PermissionRevocationService] Zombie detection task failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }, zombieIntervalMs)

    logger.info('[PermissionRevocationService] Started successfully')
  }

  stop(): void {
    if (!this.running) return

    if (this.expiryTimer) {
      clearInterval(this.expiryTimer)
      this.expiryTimer = null
    }
    if (this.zombieTimer) {
      clearInterval(this.zombieTimer)
      this.zombieTimer = null
    }
    this.running = false
    logger.info('[PermissionRevocationService] Stopped')
  }

  async runOnce(): Promise<RevocationTaskResult> {
    const runOnceTraceId = `rbac-runOnce-${nanoid(12)}`
    const startedAt = Date.now()
    this._trace(runOnceTraceId, 'runOnce:start', 'Manual runOnce() triggered', {
      startedAt: new Date(startedAt).toISOString(),
      startedAtMs: startedAt,
    })

    const expiryResult = await this.runExpiryRevocation(runOnceTraceId)
    const zombieResult = await this.runZombieDetection(runOnceTraceId)

    const completedAt = Date.now()
    const merged: RevocationTaskResult = {
      executedAt: expiryResult.executedAt,
      totalChecked: expiryResult.totalChecked + zombieResult.totalChecked,
      expiredRevoked: expiryResult.expiredRevoked,
      inactiveUserRevoked: zombieResult.inactiveUserRevoked,
      policyViolationRevoked: expiryResult.policyViolationRevoked,
      details: [...expiryResult.details, ...zombieResult.details],
      durationMs: expiryResult.durationMs + zombieResult.durationMs,
      error: expiryResult.error ?? zombieResult.error,
    }
    this._trace(runOnceTraceId, 'runOnce:completed', 'Manual runOnce() completed', {
      totalRevoked: merged.expiredRevoked + merged.inactiveUserRevoked,
      durationMs: merged.durationMs,
      completedAt: new Date(completedAt).toISOString(),
      affectedUserIds: merged.details.map((d) => d.userId),
      revokedAt: merged.details.map((d) => ({
        userId: d.userId,
        mappingId: d.mappingId,
        roleId: d.roleId,
        reason: d.reason,
        revokedAt: new Date(d.revokedAt).toISOString(),
      })),
    })
    return merged
  }

  private async _queryActiveUserRoles(traceId: string): Promise<UserRoleMapping[]> {
    const queryStartTs = Date.now()
    const queryResult = await dataBridge.query<UserRoleMapping[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacUserRoles,
      indexName: 'by-status',
      indexValue: 'active',
      source: 'system',
    })
    const queryDurationMs = Date.now() - queryStartTs

    if (!queryResult.success || !queryResult.data) {
      throw new Error(`Failed to query active user_roles: ${queryResult.error ?? 'unknown'}`)
    }

    const allMappings = queryResult.data
    this._trace(traceId, 'expiry:query-completed', 'Active user_roles queried', {
      totalActive: allMappings.length,
      queryDurationMs,
      sampleIds: allMappings.slice(0, 5).map((m) => m.id),
      userIds: allMappings.slice(0, 20).map((m) => m.userId),
    })

    return allMappings
  }

  private _filterExpiredMappings(allMappings: UserRoleMapping[], now: number): UserRoleMapping[] {
    return allMappings.filter((m) => m.effectiveEnd > 0 && m.effectiveEnd <= now)
  }

  private async _processExpiryMapping(
    mapping: UserRoleMapping,
    traceId: string,
    now: number,
  ): Promise<RevocationTaskResult['details'][number] | null> {
    const revokeStartTs = Date.now()
    try {
      this._trace(traceId, 'expiry:revoke-start', 'Revoking expired mapping', {
        mappingId: mapping.id,
        userId: mapping.userId,
        roleId: mapping.roleId,
        effectiveEnd: new Date(mapping.effectiveEnd).toISOString(),
        grantedBy: mapping.grantedBy,
        grantReason: mapping.grantReason,
        beforeState: {
          status: mapping.status,
          effectiveEnd: new Date(mapping.effectiveEnd).toISOString(),
          grantedAt: new Date(mapping.grantedAt).toISOString(),
          grantedBy: mapping.grantedBy,
        },
      })

      await this.revokeUserRoleMapping(
        mapping,
        'expired',
        'system',
        `Permission expired (effectiveEnd=${new Date(mapping.effectiveEnd).toISOString()})`,
        traceId,
      )

      const revokeDurationMs = Date.now() - revokeStartTs
      const detail: RevocationTaskResult['details'][number] = {
        mappingId: mapping.id,
        userId: mapping.userId,
        roleId: mapping.roleId,
        reason: 'expired',
        revokedAt: now,
      }

      this._trace(traceId, 'expiry:revoke-completed', 'Mapping revoked successfully', {
        mappingId: mapping.id,
        userId: mapping.userId,
        roleId: mapping.roleId,
        revokeDurationMs,
        revokedAt: new Date(now).toISOString(),
        afterState: {
          status: 'expired',
          revokedAt: new Date(now).toISOString(),
          revocationReason: 'expired',
        },
      })

      return detail
    } catch (err) {
      const revokeDurationMs = Date.now() - revokeStartTs
      logger.error('[PermissionRevocationService] Failed to revoke expired mapping', {
        traceId,
        mappingId: mapping.id,
        userId: mapping.userId,
        roleId: mapping.roleId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        revokeDurationMs,
        failedAt: new Date().toISOString(),
      })
      return null
    }
  }

  private _buildExpiryResult(
    allMappings: UserRoleMapping[],
    details: RevocationTaskResult['details'],
    now: number,
    startTs: number,
  ): RevocationTaskResult {
    return {
      executedAt: now,
      totalChecked: allMappings.length,
      expiredRevoked: details.length,
      inactiveUserRevoked: 0,
      policyViolationRevoked: 0,
      details,
      durationMs: Date.now() - startTs,
    }
  }

  private async runExpiryRevocation(parentTraceId?: string): Promise<RevocationTaskResult> {
    const startTs = Date.now()
    const thresholds = getRbacThresholds()
    const now = Date.now()
    const batchLimit = thresholds.revocationBatchSize
    const traceId = parentTraceId ?? `rbac-expiry-${nanoid(12)}`

    this._trace(traceId, 'expiry:start', 'Expiry revocation task started', {
      now: new Date(now).toISOString(),
      nowMs: now,
      batchLimit,
    })

    try {
      const allMappings = await this._queryActiveUserRoles(traceId)
      const expiredMappings = this._filterExpiredMappings(allMappings, now)

      this._trace(traceId, 'expiry:filter-completed', 'Expiry scan completed', {
        totalActive: allMappings.length,
        expiredFound: expiredMappings.length,
        expiredSample: expiredMappings.slice(0, 3).map((m) => ({
          id: m.id,
          userId: m.userId,
          roleId: m.roleId,
          effectiveEnd: new Date(m.effectiveEnd).toISOString(),
          expiredDaysAgo: Math.floor((now - m.effectiveEnd) / (24 * 60 * 60 * 1000)),
        })),
        expiredDetails: expiredMappings.map((m) => ({
          mappingId: m.id,
          userId: m.userId,
          roleId: m.roleId,
          effectiveEnd: new Date(m.effectiveEnd).toISOString(),
          expiredDaysAgo: Math.floor((now - m.effectiveEnd) / (24 * 60 * 60 * 1000)),
          grantedBy: m.grantedBy,
        })),
      })

      const details: Array<RevocationTaskResult['details'][number]> = []
      const batches = Math.ceil(expiredMappings.length / batchLimit)
      this._trace(traceId, 'expiry:batch-start', 'Starting batch revocation', {
        totalExpired: expiredMappings.length,
        batchCount: batches,
        batchSize: batchLimit,
      })

      for (let i = 0; i < batches; i++) {
        const batch = expiredMappings.slice(i * batchLimit, (i + 1) * batchLimit)
        const batchStartTs = Date.now()
        this._trace(traceId, 'expiry:batch-start', 'Processing batch', {
          batchIndex: i + 1,
          totalBatches: batches,
          batchSize: batch.length,
          batchUserIds: batch.map((m) => m.userId),
        })

        const batchResults = await Promise.all(
          batch.map((mapping) => this._processExpiryMapping(mapping, traceId, now)),
        )
        details.push(...batchResults.filter((r): r is RevocationTaskResult['details'][number] => r !== null))

        const batchDurationMs = Date.now() - batchStartTs
        this._trace(traceId, 'expiry:batch-completed', 'Batch completed', {
          batchIndex: i + 1,
          totalBatches: batches,
          cumulativeRevoked: details.length,
          batchDurationMs,
          batchRevokedCount: details.length,
        })
      }

      const result = this._buildExpiryResult(allMappings, details, now, startTs)
      this.lastExpiryResult = result

      this._trace(traceId, 'expiry:completed', 'Expiry revocation task completed', {
        revoked: result.expiredRevoked,
        durationMs: result.durationMs,
        revokedUserIds: details.map((d) => ({ userId: d.userId, mappingId: d.mappingId })),
      })
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error('[PermissionRevocationService] Expiry revocation task failed', {
        traceId,
        error: errorMsg,
        failedAt: new Date().toISOString(),
        stack: err instanceof Error ? err.stack : undefined,
      })
      logger.debug('[PermissionRevocationService] [TRACE] Expiry phase failed', {
        traceId,
        phase: 'expiry:failed',
        timestamp: new Date().toISOString(),
        error: errorMsg,
      })

      const result: RevocationTaskResult = {
        executedAt: now,
        totalChecked: 0,
        expiredRevoked: 0,
        inactiveUserRevoked: 0,
        policyViolationRevoked: 0,
        details: [],
        durationMs: Date.now() - startTs,
        error: errorMsg,
      }
      this.lastExpiryResult = result
      return result
    }
  }

  private async _queryActiveUsers(traceId: string): Promise<UserEntity[]> {
    const queryStartTs = Date.now()
    const usersResult = await dataBridge.query<UserEntity[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacUsers,
      indexName: 'by-status',
      indexValue: 'active',
      source: 'system',
    })
    const queryDurationMs = Date.now() - queryStartTs

    if (!usersResult.success || !usersResult.data) {
      throw new Error(`Failed to query active users: ${usersResult.error ?? 'unknown'}`)
    }

    const allUsers = usersResult.data
    this._trace(traceId, 'zombie:query-completed', 'Active users queried', {
      totalActiveUsers: allUsers.length,
      queryDurationMs,
      sampleUsernames: allUsers.slice(0, 5).map((u) => u.username),
      userIds: allUsers.slice(0, 20).map((u) => u.id),
    })

    return allUsers
  }

  private _filterZombieUsers(allUsers: UserEntity[], inactiveBefore: number): UserEntity[] {
    return allUsers.filter((u) => u.lastActiveAt > 0 && u.lastActiveAt < inactiveBefore)
  }

  private async _processZombieUserRole(
    user: UserEntity,
    roleMapping: UserRoleMapping,
    inactiveDays: number,
    traceId: string,
    now: number,
  ): Promise<RevocationTaskResult['details'][number] | null> {
    const roleRevokeStartTs = Date.now()
    try {
      this._trace(traceId, 'zombie:revoke-start', 'Revoking zombie user permission', {
        userId: user.id,
        username: user.username,
        mappingId: roleMapping.id,
        roleId: roleMapping.roleId,
        grantedBy: roleMapping.grantedBy,
        grantedAt: new Date(roleMapping.grantedAt).toISOString(),
        beforeState: {
          status: roleMapping.status,
          grantedAt: new Date(roleMapping.grantedAt).toISOString(),
          grantedBy: roleMapping.grantedBy,
        },
      })

      await this.revokeUserRoleMapping(
        roleMapping,
        'inactive_user',
        'system',
        `User inactive for ${inactiveDays} days (lastActiveAt=${new Date(user.lastActiveAt).toISOString()})`,
        traceId,
      )

      const roleRevokeDurationMs = Date.now() - roleRevokeStartTs
      const detail: RevocationTaskResult['details'][number] = {
        mappingId: roleMapping.id,
        userId: user.id,
        roleId: roleMapping.roleId,
        reason: 'inactive_user',
        revokedAt: now,
      }

      this._trace(traceId, 'zombie:revoke-completed', 'Zombie user permission revoked', {
        userId: user.id,
        username: user.username,
        mappingId: roleMapping.id,
        roleId: roleMapping.roleId,
        revokeDurationMs: roleRevokeDurationMs,
        revokedAt: new Date(now).toISOString(),
        afterState: {
          status: 'revoked',
          revokedAt: new Date(now).toISOString(),
          revocationReason: 'inactive_user',
        },
      })

      return detail
    } catch (err) {
      const roleRevokeDurationMs = Date.now() - roleRevokeStartTs
      logger.error('[PermissionRevocationService] Failed to revoke zombie user permission', {
        traceId,
        userId: user.id,
        username: user.username,
        mappingId: roleMapping.id,
        roleId: roleMapping.roleId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        revokeDurationMs: roleRevokeDurationMs,
        failedAt: new Date().toISOString(),
      })
      return null
    }
  }

  private async _processZombieUser(
    user: UserEntity,
    traceId: string,
    now: number,
  ): Promise<Array<RevocationTaskResult['details'][number]>> {
    const userProcessStartTs = Date.now()
    const inactiveDays = Math.floor((now - user.lastActiveAt) / (24 * 60 * 60 * 1000))
    const details: Array<RevocationTaskResult['details'][number]> = []

    try {
      this._trace(traceId, 'zombie:user-start', 'Processing zombie user', {
        userId: user.id,
        username: user.username,
        email: user.email,
        lastActiveAt: new Date(user.lastActiveAt).toISOString(),
        inactiveDays,
        beforeState: {
          status: user.status,
          lastActiveAt: new Date(user.lastActiveAt).toISOString(),
          inactiveDays,
        },
      })

      await this.updateUserStatus(user, 'inactive', traceId)

      const userRoles = await this.queryUserRolesByUserId(user.id)
      const activeRoles = userRoles.filter((r) => r.status === 'active')

      this._trace(traceId, 'zombie:user-roles-queried', 'User roles queried for zombie user', {
        userId: user.id,
        username: user.username,
        totalRoles: userRoles.length,
        activeRoles: activeRoles.length,
        roleIds: activeRoles.map((r) => r.roleId),
        activeRolesCount: activeRoles.length,
        activeRoleIds: activeRoles.map((r) => r.roleId),
      })

      for (const roleMapping of activeRoles) {
        const result = await this._processZombieUserRole(user, roleMapping, inactiveDays, traceId, now)
        if (result) details.push(result)
      }

      const userProcessDurationMs = Date.now() - userProcessStartTs
      this._trace(traceId, 'zombie:user-completed', 'Zombie user processing completed', {
        userId: user.id,
        username: user.username,
        permissionsRevoked: activeRoles.length,
        userProcessDurationMs,
        afterState: {
          userStatus: 'inactive',
          activePermissionsRemaining: 0,
        },
      })
    } catch (err) {
      const userProcessDurationMs = Date.now() - userProcessStartTs
      logger.error('[PermissionRevocationService] Failed to process zombie user', {
        traceId,
        userId: user.id,
        username: user.username,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        userProcessDurationMs,
        failedAt: new Date().toISOString(),
      })
      logger.debug('[PermissionRevocationService] [TRACE] Zombie user processing failed', {
        traceId,
        phase: 'zombie:user-failed',
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return details
  }

  private _buildZombieResult(
    allUsers: UserEntity[],
    details: RevocationTaskResult['details'],
    now: number,
    startTs: number,
  ): RevocationTaskResult {
    return {
      executedAt: now,
      totalChecked: allUsers.length,
      expiredRevoked: 0,
      inactiveUserRevoked: details.length,
      policyViolationRevoked: 0,
      details,
      durationMs: Date.now() - startTs,
    }
  }

  private async runZombieDetection(parentTraceId?: string): Promise<RevocationTaskResult> {
    const startTs = Date.now()
    const thresholds = getRbacThresholds()
    const now = Date.now()
    const inactiveThresholdMs = thresholds.inactivityThresholdDays * 24 * 60 * 60 * 1000
    const inactiveBefore = now - inactiveThresholdMs
    const traceId = parentTraceId ?? `rbac-zombie-${nanoid(12)}`

    this._trace(traceId, 'zombie:start', 'Zombie detection task started', {
      now: new Date(now).toISOString(),
      nowMs: now,
      inactiveThresholdDays: thresholds.inactivityThresholdDays,
      inactiveBefore: new Date(inactiveBefore).toISOString(),
      inactiveBeforeMs: inactiveBefore,
    })

    try {
      const allUsers = await this._queryActiveUsers(traceId)
      const zombieUsers = this._filterZombieUsers(allUsers, inactiveBefore)

      this._trace(traceId, 'zombie:filter-completed', 'Zombie scan completed', {
        totalActiveUsers: allUsers.length,
        zombieFound: zombieUsers.length,
        inactivityThresholdDays: thresholds.inactivityThresholdDays,
        inactiveBeforeDate: new Date(inactiveBefore).toISOString(),
        zombieSample: zombieUsers.slice(0, 3).map((u) => ({
          userId: u.id,
          username: u.username,
          email: u.email,
          lastActiveAt: new Date(u.lastActiveAt).toISOString(),
          inactiveDays: Math.floor((now - u.lastActiveAt) / (24 * 60 * 60 * 1000)),
        })),
        zombieDetails: zombieUsers.map((u) => ({
          userId: u.id,
          username: u.username,
          email: u.email,
          lastActiveAt: new Date(u.lastActiveAt).toISOString(),
          inactiveDays: Math.floor((now - u.lastActiveAt) / (24 * 60 * 60 * 1000)),
        })),
      })

      const zombieResult: ZombieAccountDetectionResult = {
        detectedAt: now,
        zombieUserIds: zombieUsers.map((u) => u.id),
        totalScanned: allUsers.length,
        inactivityThresholdDays: thresholds.inactivityThresholdDays,
        details: zombieUsers.map((u) => ({
          userId: u.id,
          username: u.username,
          lastActiveAt: u.lastActiveAt,
          inactiveDays: Math.floor((now - u.lastActiveAt) / (24 * 60 * 60 * 1000)),
          activePermissionCount: 0,
        })),
      }
      this.lastZombieResult = zombieResult

      const details: Array<RevocationTaskResult['details'][number]> = []
      this._trace(traceId, 'zombie:user-start', 'Processing zombie users', {
        zombieUserCount: zombieUsers.length,
      })

      for (const user of zombieUsers) {
        const userDetails = await this._processZombieUser(user, traceId, now)
        details.push(...userDetails)
      }

      const result = this._buildZombieResult(allUsers, details, now, startTs)

      this._trace(traceId, 'zombie:completed', 'Zombie detection task completed', {
        zombieUsersFound: zombieUsers.length,
        permissionsRevoked: result.inactiveUserRevoked,
        durationMs: result.durationMs,
        affectedUserIds: details.map((d) => ({ userId: d.userId, mappingId: d.mappingId })),
      })
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error('[PermissionRevocationService] Zombie detection task failed', {
        traceId,
        error: errorMsg,
        failedAt: new Date().toISOString(),
        stack: err instanceof Error ? err.stack : undefined,
      })
      logger.debug('[PermissionRevocationService] [TRACE] Zombie phase failed', {
        traceId,
        phase: 'zombie:failed',
        timestamp: new Date().toISOString(),
        error: errorMsg,
      })

      const result: RevocationTaskResult = {
        executedAt: now,
        totalChecked: 0,
        expiredRevoked: 0,
        inactiveUserRevoked: 0,
        policyViolationRevoked: 0,
        details: [],
        durationMs: Date.now() - startTs,
        error: errorMsg,
      }
      return result
    }
  }

  private async revokeUserRoleMapping(
    mapping: UserRoleMapping,
    reason: RevocationReason,
    operatorId: string,
    auditReason: string,
    parentTraceId?: string,
  ): Promise<void> {
    const now = Date.now()
    const traceId = parentTraceId ?? `rbac-revoke-${nanoid(8)}`
    const revokeAtIso = new Date(now).toISOString()

    logger.debug('[PermissionRevocationService] [TRACE] revokeUserRoleMapping enter', {
      traceId,
      phase: 'revoke-mapping:enter',
      timestamp: revokeAtIso,
      mappingId: mapping.id,
      userId: mapping.userId,
      roleId: mapping.roleId,
      reason,
      operatorId,
    })

    const beforeState: Record<string, unknown> = { ...mapping }

    const updatedMapping: UserRoleMapping = {
      ...mapping,
      status: reason === 'expired' ? 'expired' : 'revoked',
      revocationReason: reason,
      revokedAt: now,
      revokedBy: operatorId,
    }

    logger.debug('[PermissionRevocationService] [TRACE] revokeUserRoleMapping before forward', {
      traceId,
      phase: 'revoke-mapping:before-forward',
      timestamp: revokeAtIso,
      mappingId: mapping.id,
      userId: mapping.userId,
      beforeStatus: mapping.status,
      afterStatus: updatedMapping.status,
      revocationReason: updatedMapping.revocationReason,
      revokedAt: revokeAtIso,
      revokedBy: operatorId,
    })

    const envelope = EnvelopeFactory.create(
      {
        source: 'system',
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveRbacUserRole,
        traceId,
      },
      updatedMapping,
    )
    await dataBridge.forward(envelope)

    logger.debug('[PermissionRevocationService] [TRACE] revokeUserRoleMapping after forward', {
      traceId,
      phase: 'revoke-mapping:after-forward',
      timestamp: new Date().toISOString(),
      mappingId: mapping.id,
      userId: mapping.userId,
      forwardCompleted: true,
    })

    await this.writeAuditLog({
      action: 'revoke',
      targetType: 'user_role',
      targetId: mapping.id,
      operatorId,
      affectedUserId: mapping.userId,
      beforeState,
      afterState: { ...updatedMapping },
      reason: auditReason,
    }, traceId)

    logger.info('[PermissionRevocationService] Mapping revoked', {
      traceId,
      mappingId: mapping.id,
      userId: mapping.userId,
      roleId: mapping.roleId,
      reason,
      revokedAt: revokeAtIso,
    })
    logger.debug('[PermissionRevocationService] [TRACE] revokeUserRoleMapping exit', {
      traceId,
      phase: 'revoke-mapping:exit',
      timestamp: new Date().toISOString(),
      mappingId: mapping.id,
      userId: mapping.userId,
      roleId: mapping.roleId,
      completed: true,
    })

    eventBus.emit('rbac:permission-revoked', {
      userId: mapping.userId,
      mappingId: mapping.id,
      roleId: mapping.roleId,
      reason,
      revokedAt: now,
      traceId,
    })
    logger.debug('[PermissionRevocationService] [TRACE] permission-revoked event emitted', {
      traceId,
      event: 'rbac:permission-revoked',
      userId: mapping.userId,
      mappingId: mapping.id,
    })
  }

  private async updateUserStatus(
    user: UserEntity,
    newStatus: UserEntity['status'],
    parentTraceId?: string,
  ): Promise<void> {
    const now = Date.now()
    const traceId = parentTraceId ?? `rbac-user-status-${nanoid(8)}`
    const updatedAtIso = new Date(now).toISOString()

    logger.debug('[PermissionRevocationService] [TRACE] updateUserStatus enter', {
      traceId,
      phase: 'update-user-status:enter',
      timestamp: updatedAtIso,
      userId: user.id,
      username: user.username,
      oldStatus: user.status,
      newStatus,
    })

    const updatedUser: UserEntity = {
      ...user,
      status: newStatus,
      updatedAt: now,
    }

    const envelope = EnvelopeFactory.create(
      {
        source: 'system',
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveRbacUser,
        traceId,
      },
      updatedUser,
    )
    await dataBridge.forward(envelope)

    logger.info('[PermissionRevocationService] User status updated', {
      traceId,
      userId: user.id,
      username: user.username,
      oldStatus: user.status,
      newStatus,
      updatedAt: updatedAtIso,
    })
    logger.debug('[PermissionRevocationService] [TRACE] updateUserStatus exit', {
      traceId,
      phase: 'update-user-status:exit',
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      newStatus,
      updatedAt: updatedAtIso,
      completed: true,
    })

    eventBus.emit('rbac:user-status-changed', {
      userId: user.id,
      username: user.username,
      oldStatus: user.status,
      newStatus,
      updatedAt: now,
      traceId,
    })
    logger.debug('[PermissionRevocationService] [TRACE] user-status-changed event emitted', {
      traceId,
      event: 'rbac:user-status-changed',
      userId: user.id,
      oldStatus: user.status,
      newStatus,
    })
  }

  private async queryUserRolesByUserId(userId: string): Promise<UserRoleMapping[]> {
    const result = await dataBridge.query<UserRoleMapping[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.rbacUserRoles,
      indexName: 'by-user-id',
      indexValue: userId,
      source: 'system',
    })

    if (!result.success || !result.data) {
      logger.warn('[PermissionRevocationService] Failed to query user roles, returning empty', {
        userId,
        error: result.error,
      })
      return []
    }
    return result.data
  }

  private async writeAuditLog(params: {
    action: AuditAction
    targetType: PermissionAuditLog['targetType']
    targetId: string
    operatorId: string
    affectedUserId?: string
    beforeState?: Record<string, unknown>
    afterState?: Record<string, unknown>
    reason: string
  }, parentTraceId?: string): Promise<void> {
    const now = Date.now()
    const auditLogTraceId = parentTraceId ? `${parentTraceId}-audit-${nanoid(4)}` : `rbac-audit-${nanoid(8)}`

    const auditLog: PermissionAuditLog = {
      id: nanoid(12),
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      operatorId: params.operatorId,
      affectedUserId: params.affectedUserId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      reason: params.reason,
      timestamp: now,
      traceId: auditLogTraceId,
    }

    logger.debug('[PermissionRevocationService] [TRACE] writeAuditLog enter', {
      traceId: parentTraceId,
      auditLogTraceId,
      phase: 'audit-log:enter',
      timestamp: new Date(now).toISOString(),
      auditLogId: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      operatorId: auditLog.operatorId,
      affectedUserId: auditLog.affectedUserId,
      reason: auditLog.reason,
    })

    logger.info('[PermissionRevocationService] Writing audit log', {
      parentTraceId,
      auditLogTraceId: auditLog.traceId,
      auditLogId: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      operatorId: auditLog.operatorId,
      affectedUserId: auditLog.affectedUserId,
      reason: auditLog.reason,
      timestamp: new Date(auditLog.timestamp).toISOString(),
    })

    const envelope = EnvelopeFactory.create(
      {
        source: 'system',
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveRbacAuditLog,
        traceId: auditLog.traceId,
      },
      auditLog,
    )
    await dataBridge.forward(envelope)

    logger.info('[PermissionRevocationService] Audit log written successfully', {
      parentTraceId,
      auditLogTraceId: auditLog.traceId,
      auditLogId: auditLog.id,
      writtenAt: new Date().toISOString(),
    })
    logger.debug('[PermissionRevocationService] [TRACE] writeAuditLog exit', {
      traceId: parentTraceId,
      auditLogTraceId,
      phase: 'audit-log:exit',
      timestamp: new Date().toISOString(),
      auditLogId: auditLog.id,
      affectedUserId: auditLog.affectedUserId,
      completed: true,
    })
  }

  getLastExpiryResult(): RevocationTaskResult | null {
    return this.lastExpiryResult
  }

  getLastZombieResult(): ZombieAccountDetectionResult | null {
    return this.lastZombieResult
  }

  isRunning(): boolean {
    return this.running
  }
}

/**
 * permissionRevocationService
 */
export const permissionRevocationService = new PermissionRevocationService()

export { PermissionRevocationService }
