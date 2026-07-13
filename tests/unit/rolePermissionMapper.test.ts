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
    it('should map admin to system', () => {
      expect(mapUserRoleToMcpRole('admin')).toBe('system')
    })

    it('should map trader to agent', () => {
      expect(mapUserRoleToMcpRole('trader')).toBe('agent')
    })

    it('should map analyst to ui', () => {
      expect(mapUserRoleToMcpRole('analyst')).toBe('ui')
    })

    it('should map viewer to ui', () => {
      expect(mapUserRoleToMcpRole('viewer')).toBe('ui')
    })
  })

  describe('mapDeveloperRoleToMcpRole', () => {
    it('should map architect to system', () => {
      expect(mapDeveloperRoleToMcpRole('architect')).toBe('system')
    })

    it('should map fullstack to system', () => {
      expect(mapDeveloperRoleToMcpRole('fullstack')).toBe('system')
    })

    it('should map data to system', () => {
      expect(mapDeveloperRoleToMcpRole('data')).toBe('system')
    })

    it('should map trading to system', () => {
      expect(mapDeveloperRoleToMcpRole('trading')).toBe('system')
    })

    it('should map ai-agent to agent', () => {
      expect(mapDeveloperRoleToMcpRole('ai-agent')).toBe('agent')
    })

    it('should map frontend to ui', () => {
      expect(mapDeveloperRoleToMcpRole('frontend')).toBe('ui')
    })
  })

  describe('getUserRoleAllowedModules', () => {
    it('should return all modules for admin', () => {
      const modules = getUserRoleAllowedModules('admin')
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.system)
    })

    it('should return trading-related modules for trader', () => {
      const modules = getUserRoleAllowedModules('trader')
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.strategy)
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
    })

    it('should return analysis modules for analyst', () => {
      const modules = getUserRoleAllowedModules('analyst')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.news)
    })

    it('should return limited modules for viewer', () => {
      const modules = getUserRoleAllowedModules('viewer')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
    })
  })

  describe('getDeveloperRoleAllowedModules', () => {
    it('should return all modules for architect', () => {
      const modules = getDeveloperRoleAllowedModules('architect')
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.trading)
    })

    it('should return analysis, trading, system and fetcher modules for fullstack', () => {
      const modules = getDeveloperRoleAllowedModules('fullstack')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.system)
      expect(modules).toContain(MODULE_ID.fetcher)
    })

    it('should return data-related modules for data engineer', () => {
      const modules = getDeveloperRoleAllowedModules('data')
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.datalayer)
      expect(modules).toContain(MODULE_ID.stockpool)
      expect(modules).toContain(MODULE_ID.rotation)
      expect(modules).toContain(MODULE_ID.sector)
      expect(modules).toContain(MODULE_ID.news)
      expect(modules).toContain(MODULE_ID.analyzer)
    })

    it('should return AI-related modules for ai-agent engineer', () => {
      const modules = getDeveloperRoleAllowedModules('ai-agent')
      expect(modules).toContain(MODULE_ID.news)
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.system)
    })

    it('should return trading-related modules for trading engineer', () => {
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

    it('should return empty modules for frontend', () => {
      const modules = getDeveloperRoleAllowedModules('frontend')
      expect(modules).toEqual([])
    })
  })

  describe('checkUserRolePermission', () => {
    it('should allow admin full access', () => {
      expect(checkUserRolePermission('admin', MODULE_ID.fetcher, DB_OPERATION.select)).toBe(true)
      expect(checkUserRolePermission('admin', MODULE_ID.trading, DB_OPERATION.insert)).toBe(true)
      expect(checkUserRolePermission('admin', MODULE_ID.system, DB_OPERATION.delete)).toBe(true)
    })

    it('should deny viewer access to trading module', () => {
      expect(checkUserRolePermission('viewer', MODULE_ID.trading, DB_OPERATION.select)).toBe(false)
    })
  })

  describe('checkDeveloperRolePermission', () => {
    it('should allow architect full access', () => {
      expect(checkDeveloperRolePermission('architect', MODULE_ID.fetcher, DB_OPERATION.select)).toBe(true)
      expect(checkDeveloperRolePermission('architect', MODULE_ID.trading, DB_OPERATION.insert)).toBe(true)
    })

    it('should deny frontend access to any module', () => {
      expect(checkDeveloperRolePermission('frontend', MODULE_ID.fetcher, DB_OPERATION.select)).toBe(false)
    })

    it('should allow data engineer access to stockpool module', () => {
      expect(checkDeveloperRolePermission('data', MODULE_ID.stockpool, DB_OPERATION.select)).toBe(true)
    })

    it('should allow ai-agent engineer access to analyzer module', () => {
      expect(checkDeveloperRolePermission('ai-agent', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(true)
    })

    it('should allow trading engineer access to orderstore module', () => {
      expect(checkDeveloperRolePermission('trading', MODULE_ID.orderstore, DB_OPERATION.select)).toBe(true)
    })
  })

  describe('checkUserRoleDbOperation', () => {
    it('should map INSERT action to insert operation', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'INSERT_DATA')).toBeDefined()
    })

    it('should map UPDATE action to update operation', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'UPDATE_CONFIG')).toBeDefined()
    })

    it('should map DELETE action to delete operation', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'DELETE_RECORD')).toBeDefined()
    })

    it('should default to select for unknown actions', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.fetcher, 'UNKNOWN_ACTION')).toBeDefined()
    })
  })

  describe('checkDeveloperRoleDbOperation', () => {
    it('should map SAVE action to insert operation', () => {
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.fetcher, 'SAVE_DATA')).toBeDefined()
    })

    it('should map CLEAR action to delete operation', () => {
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.fetcher, 'CLEAR_CACHE')).toBeDefined()
    })
  })
})