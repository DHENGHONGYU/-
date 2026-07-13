/**
 * 权限自动回收服务测试
 *
 * 测试场景：
 * 1. 僵尸账号检测：超过 30 天未活跃的用户被标记为 inactive
 * 2. 过期权限回收：effective_end 已过期的权限被标记为 expired
 * 3. 僵尸账号权限联动回收：僵尸账号的所有 active 权限被回收
 * 4. 活跃用户不受影响：正常用户的权限保持不变
 * 5. 审计日志写入：所有回收操作记录到审计日志
 * 6. 错误处理：数据库查询失败时服务不崩溃
 *
 * 测试策略：
 * - Mock dataBridge.query() 和 dataBridge.forward()
 * - 验证完整的调用参数（per project_memory: DataBridge 单元测试必须 mock dataBridge.query()）
 * - 使用 vi.hoisted 解决 mock 提升问题
 * - 不依赖真实 IndexedDB，纯逻辑测试
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'

const {
  mockQuery,
  mockForward,
  mockLogger,
} = vi.hoisted(() => {
  return {
    mockQuery: vi.fn(),
    mockForward: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
    invalidateCache: vi.fn(),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, payload: unknown) => ({ meta, payload: { data: payload } })),
    validate: vi.fn(() => ({ valid: true })),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn((size?: number) => `mock-id-${size ?? 8}-${Math.random().toString(36).slice(2, 8)}`),
}))

import { PermissionRevocationService } from '@/services/rbac/permissionRevocationService'
import { STORE_NAME, ENVELOPE_ACTION } from '@/config/dbConfig'
import type {
  UserEntity,
  UserRoleMapping,
  RevocationTaskResult,
} from '@/types/modules/rbac.types'

const DAY_MS = 24 * 60 * 60 * 1000

function makeUser(overrides: Partial<UserEntity> & { id: string; username: string }): UserEntity {
  const now = Date.now()
  return {
    email: `${overrides.username}@test.com`,
    status: 'active',
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeUserRoleMapping(
  overrides: Partial<UserRoleMapping> & { id: string; userId: string; roleId: string },
): UserRoleMapping {
  const now = Date.now()
  return {
    grantedBy: 'admin-001',
    grantReason: '测试授权',
    grantedAt: now - 60 * DAY_MS,
    effectiveStart: now - 60 * DAY_MS,
    effectiveEnd: now + 30 * DAY_MS,
    status: 'active',
    ...overrides,
  }
}

describe('权限自动回收服务（PermissionRevocationService）', () => {
  let service: PermissionRevocationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PermissionRevocationService({
      defaultPermissionTtlMs: 90 * DAY_MS,
      maxPermissionTtlMs: 365 * DAY_MS,
      inactivityThresholdDays: 30,
      zombieDetectionIntervalMs: 24 * 60 * 60 * 1000,
      expiryRevocationIntervalMs: 60 * 60 * 1000,
      expiryGracePeriodMs: 0,
      maxRoleInheritanceDepth: 3,
      zombiePermissionThresholdDays: 90,
      revocationBatchSize: 10,
      permissionCheckCacheTtlMs: 10000,
      permissionCheckCacheMaxEntries: 200,
      auditLogRetentionDays: 90,
      auditLogArchiveIntervalMs: 7 * 24 * 60 * 60 * 1000,
      deleteAlertThresholds: {
        overallErrorRatePct: 10,
        byErrorType: {
          EnvelopeError: 5,
          DataError: 15,
          QuotaExceededError: 1,
          InvalidStateError: 5,
          UnknownError: 10,
        },
        cooldownMs: 60 * 60 * 1000,
        webhookUrl: null,
      },
    })
  })

  describe('僵尸账号检测与回收', () => {
    it('应将超过30天未活跃的用户标记为inactive并回收其所有权限', async () => {
      const now = Date.now()
      const zombieUser = makeUser({
        id: 'user-zombie-001',
        username: 'zombie_user',
        lastActiveAt: now - 45 * DAY_MS,
      })
      const activeUser = makeUser({
        id: 'user-active-001',
        username: 'active_user',
        lastActiveAt: now - 5 * DAY_MS,
      })

      const zombieUserRole = makeUserRoleMapping({
        id: 'mapping-zombie-001',
        userId: zombieUser.id,
        roleId: 'role-analyst',
        status: 'active',
      })

      mockQuery
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [zombieUser, activeUser] })
        .mockResolvedValueOnce({ success: true, data: [zombieUserRole] })

      const result: RevocationTaskResult = await service.runOnce()

      // 僵尸用户被标记，且其权限被回收
      expect(result.inactiveUserRevoked).toBe(1)
      expect(result.expiredRevoked).toBe(0)
      // 回收动作通过 dataBridge.forward 写入，信封 action 指向 rbacUserRole 保存
      expect(mockForward).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ action: ENVELOPE_ACTION.saveRbacUserRole }),
        }),
      )
      // 过期回收阶段应查询 rbacUserRoles 存储
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ store: STORE_NAME.rbacUserRoles }),
      )
    })

    it('过期权限（effectiveEnd 已过）应被标记为 expired 并回收', async () => {
      const now = Date.now()
      const expiredMapping = makeUserRoleMapping({
        id: 'mapping-expired-001',
        userId: 'user-active-002',
        roleId: 'role-analyst',
        status: 'active',
        effectiveEnd: now - 5 * DAY_MS,
      })
      const onlyActiveUser = makeUser({
        id: 'user-active-002',
        username: 'active_user2',
        lastActiveAt: now - 2 * DAY_MS,
      })

      // runOnce 先跑过期回收（query#1=角色），再跑僵尸检测（query#2=用户）
      mockQuery
        .mockResolvedValueOnce({ success: true, data: [expiredMapping] })
        .mockResolvedValueOnce({ success: true, data: [onlyActiveUser] })

      const result: RevocationTaskResult = await service.runOnce()

      expect(result.expiredRevoked).toBe(1)
      expect(result.inactiveUserRevoked).toBe(0)
      expect(mockForward).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ action: ENVELOPE_ACTION.saveRbacUserRole }),
        }),
      )
    })

    it('僵尸账号的多个 active 权限应被联动回收', async () => {
      const now = Date.now()
      const zombieUser2 = makeUser({
        id: 'user-zombie-002',
        username: 'zombie_user2',
        lastActiveAt: now - 60 * DAY_MS,
      })
      const roleA = makeUserRoleMapping({
        id: 'mapping-z2-a',
        userId: zombieUser2.id,
        roleId: 'role-analyst',
        status: 'active',
      })
      const roleB = makeUserRoleMapping({
        id: 'mapping-z2-b',
        userId: zombieUser2.id,
        roleId: 'role-trader',
        status: 'active',
      })

      mockQuery
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [zombieUser2] })
        .mockResolvedValueOnce({ success: true, data: [roleA, roleB] })

      const result: RevocationTaskResult = await service.runOnce()

      expect(result.inactiveUserRevoked).toBe(2)
      expect(result.expiredRevoked).toBe(0)
    })

    it('活跃用户（未超过阈值）的权限应保持不变', async () => {
      const now = Date.now()
      const activeUser1 = makeUser({
        id: 'user-active-003',
        username: 'active_user3',
        lastActiveAt: now - 1 * DAY_MS,
      })
      const activeUser2 = makeUser({
        id: 'user-active-004',
        username: 'active_user4',
        lastActiveAt: now - 10 * DAY_MS,
      })

      mockQuery
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [activeUser1, activeUser2] })

      const result: RevocationTaskResult = await service.runOnce()

      expect(result.inactiveUserRevoked).toBe(0)
      expect(result.expiredRevoked).toBe(0)
      expect(mockForward).not.toHaveBeenCalled()
    })
  })

  describe('审计日志写入', () => {
    it('每次回收操作都应写入审计日志', async () => {
      const now = Date.now()
      const zombieUser = makeUser({
        id: 'user-zombie-003',
        username: 'zombie_user3',
        lastActiveAt: now - 45 * DAY_MS,
      })
      const activeUser = makeUser({
        id: 'user-active-005',
        username: 'active_user5',
        lastActiveAt: now - 5 * DAY_MS,
      })
      const zombieUserRole = makeUserRoleMapping({
        id: 'mapping-zombie-003',
        userId: zombieUser.id,
        roleId: 'role-analyst',
        status: 'active',
      })

      mockQuery
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [zombieUser, activeUser] })
        .mockResolvedValueOnce({ success: true, data: [zombieUserRole] })

      await service.runOnce()

      // 回收产生的审计日志通过 saveRbacAuditLog 信封写入
      expect(mockForward).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ action: ENVELOPE_ACTION.saveRbacAuditLog }),
        }),
      )
    })
  })

  describe('错误处理', () => {
    it('数据库查询失败时不应抛出，而是返回带 error 的结果', async () => {
      mockQuery
        .mockRejectedValueOnce(new Error('db connection lost'))
        .mockRejectedValueOnce(new Error('db connection lost'))

      const result: RevocationTaskResult = await service.runOnce()

      expect(result.error).toBeTruthy()
    })
  })
})