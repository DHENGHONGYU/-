/**
 * @test_id V9-TEST-UT-CASCADE-001
 * @covers_docs [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-ARCH-008]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cascadeExecutor } from '@/core/cascadeExecutor'
import { CASCADE_CONFIG } from '@/config/cascadeConfig'
import { CascadeError } from '@/types/modules/cascade.types'

// ─── Mock 依赖 ───────────────────────────────────────────────

let mockGetAllByIndex = vi.fn()
let mockDeleteByIndex = vi.fn()
let mockPut = vi.fn()

vi.mock('@/data/db', () => ({
  db: {
    getAllByIndex: (...args: unknown[]) => mockGetAllByIndex(...args),
    deleteByIndex: (...args: unknown[]) => mockDeleteByIndex(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ─── 辅助函数 ────────────────────────────────────────────────

/**
 * 设置 mock 数据：按 store → 记录数 映射
 * 使用 mockImplementation 确保顺序无关
 */
function setupMockData(storeRecords: Record<string, unknown[]>) {
  mockGetAllByIndex.mockImplementation(async (store: string) => {
    return storeRecords[store] ?? []
  })
  mockDeleteByIndex.mockImplementation(async (store: string) => {
    return storeRecords[store]?.length ?? 0
  })
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('cascadeExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础功能', () => {
    it('无级联依赖的 store 返回空 targets', async () => {
      setupMockData({})
      const result = await cascadeExecutor.execute('watchlists' as never, 'wl-1')
      expect(result.targets).toEqual([])
    })

    it('无子记录时返回空 targets', async () => {
      setupMockData({ execution_logs: [] })
      const result = await cascadeExecutor.execute('execution_plans', 'plan-1')
      expect(result.targets).toEqual([])
    })
  })

  describe('CASCADE 策略', () => {
    it('executionPlans 删除时级联删除 executionLogs', async () => {
      const mockLogs = [
        { id: 'log-1', planId: 'plan-1', message: 'test1' },
        { id: 'log-2', planId: 'plan-1', message: 'test2' },
        { id: 'log-3', planId: 'plan-1', message: 'test3' },
      ]
      setupMockData({ execution_logs: mockLogs })

      const result = await cascadeExecutor.execute('execution_plans', 'plan-1')

      expect(result.targets.length).toBe(1)
      expect(result.targets[0].store).toBe('execution_logs')
      expect(result.targets[0].strategy).toBe('CASCADE')
      expect(result.targets[0].affectedCount).toBe(3)
      expect(mockDeleteByIndex).toHaveBeenCalledWith(
        'execution_logs',
        'by-plan',
        'plan-1',
      )
    })

    it('profileItems 删除时级联删除 scoreEvidence', async () => {
      const mockEvidence = [
        { id: 'ev-1', profileItemId: 'item-1', layerId: 'L1' },
        { id: 'ev-2', profileItemId: 'item-1', layerId: 'L2' },
      ]
      setupMockData({ score_evidence: mockEvidence })

      const result = await cascadeExecutor.execute('profile_items', 'item-1')

      expect(result.targets.length).toBe(1)
      expect(result.targets[0].store).toBe('score_evidence')
      expect(result.targets[0].strategy).toBe('CASCADE')
      expect(result.targets[0].affectedCount).toBe(2)
    })

    it('news 删除时级联删除 newsStockMap', async () => {
      const mockMaps = [
        { id: 'map-1', newsId: 'news-1', symbol: 'AAPL' },
        { id: 'map-2', newsId: 'news-1', symbol: 'GOOGL' },
      ]
      setupMockData({ news_stock_map: mockMaps })

      const result = await cascadeExecutor.execute('news', 'news-1')

      expect(result.targets.length).toBe(1)
      expect(result.targets[0].store).toBe('news_stock_map')
      expect(result.targets[0].strategy).toBe('CASCADE')
    })
  })

  describe('RESTRICT 策略', () => {
    it('workflowDefs 存在运行实例时阻止删除', async () => {
      const mockRuns = [
        { id: 'run-1', workflowId: 'wf-1', status: 'completed' },
        { id: 'run-2', workflowId: 'wf-1', status: 'running' },
      ]
      setupMockData({
        workflow_schedules: [],
        workflow_triggers: [],
        workflow_runs: mockRuns,
      })

      await expect(cascadeExecutor.execute('workflow_defs', 'wf-1')).rejects.toThrow(CascadeError)
      await expect(cascadeExecutor.execute('workflow_defs', 'wf-1')).rejects.toThrow(
        /存在 2 条关联记录/,
      )
    })

    it('workflowDefs 无运行实例时允许删除', async () => {
      setupMockData({
        workflow_schedules: [],
        workflow_triggers: [],
        workflow_runs: [],
      })

      const result = await cascadeExecutor.execute('workflow_defs', 'wf-1')
      expect(result.targets).toEqual([])
    })
  })

  describe('RBAC 级联', () => {
    it('删除用户时级联清理角色分配', async () => {
      const mockUserRoles = [
        { id: 'ur-1', userId: 'user-1', roleId: 'role-1' },
        { id: 'ur-2', userId: 'user-1', roleId: 'role-2' },
      ]
      setupMockData({ rbac_user_roles: mockUserRoles })

      const result = await cascadeExecutor.execute('rbac_users', 'user-1')

      expect(result.targets.length).toBe(1)
      expect(result.targets[0].store).toBe('rbac_user_roles')
      expect(result.targets[0].strategy).toBe('CASCADE')
      expect(result.targets[0].affectedCount).toBe(2)
    })

    it('删除角色时级联清理用户分配和权限分配', async () => {
      const mockUserRoles = [
        { id: 'ur-1', userId: 'user-1', roleId: 'role-1' },
      ]
      const mockRolePerms = [
        { id: 'rp-1', roleId: 'role-1', permissionId: 'perm-1' },
        { id: 'rp-2', roleId: 'role-1', permissionId: 'perm-2' },
      ]
      setupMockData({
        rbac_user_roles: mockUserRoles,
        rbac_role_permissions: mockRolePerms,
      })

      const result = await cascadeExecutor.execute('rbac_roles', 'role-1')

      expect(result.targets.length).toBe(2)
      expect(result.targets[0].store).toBe('rbac_user_roles')
      expect(result.targets[0].affectedCount).toBe(1)
      expect(result.targets[1].store).toBe('rbac_role_permissions')
      expect(result.targets[1].affectedCount).toBe(2)
    })
  })

  describe('错误处理', () => {
    it('索引查询失败时容错跳过', async () => {
      mockGetAllByIndex.mockRejectedValue(new Error('Index not found'))

      const result = await cascadeExecutor.execute('execution_plans', 'plan-1')
      // 应该跳过失败的依赖，不抛出错误
      expect(result.targets).toEqual([])
    })
  })

  describe('CASCADE_CONFIG 完整性', () => {
    it('所有配置项都包含必要字段', () => {
      for (const [parentStore, deps] of Object.entries(CASCADE_CONFIG)) {
        expect(parentStore).toBeTruthy()
        expect(Array.isArray(deps)).toBe(true)
        for (const dep of deps!) {
          expect(dep.childStore).toBeTruthy()
          expect(dep.indexName).toBeTruthy()
          expect(dep.foreignKey).toBeTruthy()
          expect(['CASCADE', 'RESTRICT', 'SET_NULL', 'SOFT_DELETE', 'NONE']).toContain(
            dep.strategy,
          )
        }
      }
    })

    it('至少包含核心业务关系', () => {
      const configJson = JSON.stringify(CASCADE_CONFIG)
      expect(configJson).toContain('execution_plans')
      expect(configJson).toContain('profile_items')
      expect(configJson).toContain('workflow_defs')
      expect(configJson).toContain('rbac_roles')
    })
  })
})
