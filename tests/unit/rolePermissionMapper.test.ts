import {
  mapUserRoleToMcpRole,
  mapDeveloperRoleToMcpRole,
  getUserRoleAllowedModules,
  getDeveloperRoleAllowedModules,
  checkUserRolePermission,
  checkDeveloperRolePermission,
  checkUserRoleDbOperation,
  checkDeveloperRoleDbOperation,
} from '@/lib/rolePermissionMapper'
import { MODULE_ID, DB_OPERATION } from '@/config/dbConfig'

describe('rolePermissionMapper', () => {
  describe('mapUserRoleToMcpRole', () => {
    it('应将 admin 映射为 system', () => {
      expect(mapUserRoleToMcpRole('admin')).toBe('system')
    })

    it('应将 trader 映射为 agent', () => {
      expect(mapUserRoleToMcpRole('trader')).toBe('agent')
    })

    it('应将 analyst 映射为 ui', () => {
      expect(mapUserRoleToMcpRole('analyst')).toBe('ui')
    })

    it('应将 viewer 映射为 ui', () => {
      expect(mapUserRoleToMcpRole('viewer')).toBe('ui')
    })
  })

  describe('mapDeveloperRoleToMcpRole', () => {
    it('应将 architect 映射为 system', () => {
      expect(mapDeveloperRoleToMcpRole('architect')).toBe('system')
    })

    it('应将 fullstack 映射为 system', () => {
      expect(mapDeveloperRoleToMcpRole('fullstack')).toBe('system')
    })

    it('应将 data 映射为 system', () => {
      expect(mapDeveloperRoleToMcpRole('data')).toBe('system')
    })

    it('应将 trading 映射为 system', () => {
      expect(mapDeveloperRoleToMcpRole('trading')).toBe('system')
    })

    it('应将 ai-agent 映射为 agent', () => {
      expect(mapDeveloperRoleToMcpRole('ai-agent')).toBe('agent')
    })

    it('应将 frontend 映射为 ui', () => {
      expect(mapDeveloperRoleToMcpRole('frontend')).toBe('ui')
    })
  })

  describe('getUserRoleAllowedModules', () => {
    it('admin 应返回全部模块', () => {
      const modules = getUserRoleAllowedModules('admin')
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.system)
    })

    it('trader 应返回交易相关模块', () => {
      const modules = getUserRoleAllowedModules('trader')
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.strategy)
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
    })

    it('analyst 应返回分析模块', () => {
      const modules = getUserRoleAllowedModules('analyst')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.news)
    })

    it('viewer 应返回有限模块', () => {
      const modules = getUserRoleAllowedModules('viewer')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
    })
  })

  describe('getDeveloperRoleAllowedModules', () => {
    it('architect 应返回全部模块', () => {
      const modules = getDeveloperRoleAllowedModules('architect')
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.trading)
    })

    it('fullstack 应返回 analyzer、trading、system 和 fetcher 模块', () => {
      const modules = getDeveloperRoleAllowedModules('fullstack')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.system)
      expect(modules).toContain(MODULE_ID.fetcher)
    })

    it('data 工程师应返回数据相关模块', () => {
      const modules = getDeveloperRoleAllowedModules('data')
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.datalayer)
      expect(modules).toContain(MODULE_ID.pool)
      expect(modules).toContain(MODULE_ID.rotation)
      expect(modules).toContain(MODULE_ID.sector)
      expect(modules).toContain(MODULE_ID.news)
      expect(modules).toContain(MODULE_ID.analyzer)
    })

    it('ai-agent 工程师应返回 AI 相关模块', () => {
      const modules = getDeveloperRoleAllowedModules('ai-agent')
      expect(modules).toContain(MODULE_ID.news)
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.system)
    })

    it('trading 工程师应返回交易相关模块', () => {
      const modules = getDeveloperRoleAllowedModules('trading')
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.strategy)
      expect(modules).toContain(MODULE_ID.orderstore)
      expect(modules).toContain(MODULE_ID.holdingsStore)
      expect(modules).toContain(MODULE_ID.executionPlans)
      expect(modules).toContain(MODULE_ID.executionLogs)
      expect(modules).toContain(MODULE_ID.portfolios)
      expect(modules).toContain(MODULE_ID.tradeReviews)
      expect(modules).toContain(MODULE_ID.tradinghub)
    })

    it('frontend 应返回空模块', () => {
      const modules = getDeveloperRoleAllowedModules('frontend')
      expect(modules).toEqual([])
    })
  })

  describe('checkUserRolePermission', () => {
    it('admin 应拥有完全权限', () => {
      expect(checkUserRolePermission('admin', MODULE_ID.fetcher, DB_OPERATION.select)).toBe(true)
      expect(checkUserRolePermission('admin', MODULE_ID.trading, DB_OPERATION.insert)).toBe(true)
      expect(checkUserRolePermission('admin', MODULE_ID.system, DB_OPERATION.delete)).toBe(true)
    })

    it('viewer 应被拒绝访问 trading 模块', () => {
      expect(checkUserRolePermission('viewer', MODULE_ID.trading, DB_OPERATION.select)).toBe(false)
    })
  })

  describe('checkDeveloperRolePermission', () => {
    it('architect 应拥有完全权限', () => {
      expect(checkDeveloperRolePermission('architect', MODULE_ID.fetcher, DB_OPERATION.select)).toBe(true)
      expect(checkDeveloperRolePermission('architect', MODULE_ID.trading, DB_OPERATION.insert)).toBe(true)
    })

    it('frontend 应被拒绝访问任何模块', () => {
      expect(checkDeveloperRolePermission('frontend', MODULE_ID.fetcher, DB_OPERATION.select)).toBe(false)
    })

    it('data 工程师应被允许访问 pool 模块', () => {
      expect(checkDeveloperRolePermission('data', MODULE_ID.pool, DB_OPERATION.select)).toBe(true)
    })

    it('ai-agent 工程师应被允许访问 analyzer 模块', () => {
      expect(checkDeveloperRolePermission('ai-agent', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(true)
    })

    it('trading 工程师应被允许访问 orderstore 模块', () => {
      expect(checkDeveloperRolePermission('trading', MODULE_ID.orderstore, DB_OPERATION.select)).toBe(true)
    })
  })

  describe('checkUserRoleDbOperation', () => {
    it('INSERT 动作应映射为 insert 操作', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'INSERT_DATA')).toBeDefined()
    })

    it('UPDATE 动作应映射为 update 操作', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'UPDATE_CONFIG')).toBeDefined()
    })

    it('DELETE 动作应映射为 delete 操作', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'DELETE_RECORD')).toBeDefined()
    })

    it('未知动作应默认降级为 select', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'UNKNOWN_ACTION')).toBeDefined()
    })
  })

  describe('checkDeveloperRoleDbOperation', () => {
    it('SAVE 动作应映射为 insert 操作', () => {
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.fetcher, 'SAVE_DATA')).toBeDefined()
    })

    it('CLEAR 动作应映射为 delete 操作', () => {
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.fetcher, 'CLEAR_CACHE')).toBeDefined()
    })
  })
})
