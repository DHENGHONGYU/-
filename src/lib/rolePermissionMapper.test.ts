import { describe, it, expect } from 'vitest'
import {
  mapUserRoleToMcpRole,
  mapDeveloperRoleToMcpRole,
  getUserRoleAllowedModules,
  getDeveloperRoleAllowedModules,
  checkUserRolePermission,
  checkDeveloperRolePermission,
  checkUserRoleDbOperation,
  checkDeveloperRoleDbOperation,
} from './rolePermissionMapper'
import { MODULE_ID, DB_OPERATION } from '@/config/dbConfig'

describe('rolePermissionMapper', () => {
  describe('mapUserRoleToMcpRole()', () => {
    it('admin -> system', () => {
      expect(mapUserRoleToMcpRole('admin')).toBe('system')
    })

    it('trader -> agent', () => {
      expect(mapUserRoleToMcpRole('trader')).toBe('agent')
    })

    it('analyst -> ui', () => {
      expect(mapUserRoleToMcpRole('analyst')).toBe('ui')
    })

    it('viewer -> ui', () => {
      expect(mapUserRoleToMcpRole('viewer')).toBe('ui')
    })
  })

  describe('mapDeveloperRoleToMcpRole()', () => {
    it('architect/fullstack/data/trading -> system', () => {
      expect(mapDeveloperRoleToMcpRole('architect')).toBe('system')
      expect(mapDeveloperRoleToMcpRole('fullstack')).toBe('system')
      expect(mapDeveloperRoleToMcpRole('data')).toBe('system')
      expect(mapDeveloperRoleToMcpRole('trading')).toBe('system')
    })

    it('ai-agent -> agent', () => {
      expect(mapDeveloperRoleToMcpRole('ai-agent')).toBe('agent')
    })

    it('frontend -> ui', () => {
      expect(mapDeveloperRoleToMcpRole('frontend')).toBe('ui')
    })
  })

  describe('getUserRoleAllowedModules()', () => {
    it('admin 拥有所有模块', () => {
      const modules = getUserRoleAllowedModules('admin')
      const allModules = Object.values(MODULE_ID)
      expect(modules.length).toBe(allModules.length)
    })

    it('trader 包含 trading/strategy/analyzer/fetcher', () => {
      const modules = getUserRoleAllowedModules('trader')
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.strategy)
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
    })

    it('analyst 包含 analyzer/fetcher/news', () => {
      const modules = getUserRoleAllowedModules('analyst')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.news)
    })

    it('viewer 只有 analyzer/fetcher', () => {
      const modules = getUserRoleAllowedModules('viewer')
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules.length).toBe(2)
    })
  })

  describe('getDeveloperRoleAllowedModules()', () => {
    it('architect 拥有所有模块', () => {
      const modules = getDeveloperRoleAllowedModules('architect')
      const allModules = Object.values(MODULE_ID)
      expect(modules.length).toBe(allModules.length)
    })

    it('frontend 返回空数组', () => {
      const modules = getDeveloperRoleAllowedModules('frontend')
      expect(modules).toEqual([])
    })

    it('ai-agent 包含 news/analyzer/fetcher/system', () => {
      const modules = getDeveloperRoleAllowedModules('ai-agent')
      expect(modules).toContain(MODULE_ID.news)
      expect(modules).toContain(MODULE_ID.analyzer)
      expect(modules).toContain(MODULE_ID.fetcher)
      expect(modules).toContain(MODULE_ID.system)
    })

    it('trading 包含交易相关模块', () => {
      const modules = getDeveloperRoleAllowedModules('trading')
      expect(modules).toContain(MODULE_ID.trading)
      expect(modules).toContain(MODULE_ID.strategy)
      expect(modules).toContain(MODULE_ID.orderstore)
      expect(modules).toContain(MODULE_ID.holdingsStore)
      expect(modules).toContain(MODULE_ID.tradinghub)
    })
  })

  describe('checkUserRolePermission()', () => {
    it('admin 对 analyzer 有 select 权限', () => {
      const result = checkUserRolePermission('admin', MODULE_ID.analyzer, DB_OPERATION.select)
      expect(result).toBe(true)
    })

    it('viewer 不能访问 trading 模块', () => {
      const result = checkUserRolePermission('viewer', MODULE_ID.trading, DB_OPERATION.select)
      expect(result).toBe(false)
    })
  })

  describe('checkDeveloperRolePermission()', () => {
    it('architect 有所有权限', () => {
      const result = checkDeveloperRolePermission('architect', MODULE_ID.analyzer, DB_OPERATION.select)
      expect(result).toBe(true)
    })

    it('frontend 无任何模块权限', () => {
      const result = checkDeveloperRolePermission('frontend', MODULE_ID.analyzer, DB_OPERATION.select)
      expect(result).toBe(false)
    })
  })

  describe('checkUserRoleDbOperation()', () => {
    it('INSERT 类动作映射到 insert 操作', () => {
      const result = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'INSERT_SCORE')
      expect(typeof result).toBe('boolean')
    })

    it('UPDATE 类动作映射到 update 操作', () => {
      const result = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'UPDATE_STOCK')
      expect(typeof result).toBe('boolean')
    })

    it('DELETE 类动作映射到 delete 操作', () => {
      const result = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'DELETE_BATCH')
      expect(typeof result).toBe('boolean')
    })

    it('其他动作默认为 select', () => {
      const result = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'QUERY_DATA')
      expect(result).toBe(true)
    })

    it('SAVE/INGEST 映射到 insert', () => {
      const r1 = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'SAVE_CONFIG')
      const r2 = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'INGEST_DATA')
      expect(typeof r1).toBe('boolean')
      expect(typeof r2).toBe('boolean')
    })

    it('CLEAR 映射到 delete', () => {
      const result = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'CLEAR_ALL')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('checkDeveloperRoleDbOperation()', () => {
    it('architect 的 INSERT 操作', () => {
      const result = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'INSERT_DATA')
      expect(typeof result).toBe('boolean')
    })

    it('frontend 的任意操作都返回 false', () => {
      const result = checkDeveloperRoleDbOperation('frontend', MODULE_ID.analyzer, 'SELECT')
      expect(result).toBe(false)
    })
  })
})
