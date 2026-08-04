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
import { ACL_MATRIX, MODULE_ID, DB_OPERATION } from '@/config/dbConfig'
import type { UserRole, DeveloperRole } from '@/types/role.types'

describe('rolePermissionMapper', () => {
  describe('mapUserRoleToMcpRole()', () => {
    it('admin -> system', () => expect(mapUserRoleToMcpRole('admin')).toBe('system'))
    it('trader -> agent', () => expect(mapUserRoleToMcpRole('trader')).toBe('agent'))
    it('analyst -> ui', () => expect(mapUserRoleToMcpRole('analyst')).toBe('ui'))
    it('viewer -> ui', () => expect(mapUserRoleToMcpRole('viewer')).toBe('ui'))
    it('default: 未知 -> ui', () => expect(mapUserRoleToMcpRole('unknown' as UserRole)).toBe('ui'))
  })

  describe('mapDeveloperRoleToMcpRole()', () => {
    it('architect/fullstack/data/trading -> system', () => {
      expect(mapDeveloperRoleToMcpRole('architect')).toBe('system')
      expect(mapDeveloperRoleToMcpRole('fullstack')).toBe('system')
      expect(mapDeveloperRoleToMcpRole('data')).toBe('system')
      expect(mapDeveloperRoleToMcpRole('trading')).toBe('system')
    })
    it('ai-agent -> agent', () => expect(mapDeveloperRoleToMcpRole('ai-agent')).toBe('agent'))
    it('frontend -> ui', () => expect(mapDeveloperRoleToMcpRole('frontend')).toBe('ui'))
    it('default: 未知 -> agent', () => expect(mapDeveloperRoleToMcpRole('unknown' as DeveloperRole)).toBe('agent'))
  })

  describe('getUserRoleAllowedModules()', () => {
    it('admin 拥有所有模块', () => {
      expect(getUserRoleAllowedModules('admin').length).toBe(Object.values(MODULE_ID).length)
    })
    it('trader 包含 trading/strategy/analyzer/fetcher', () => {
      const m = getUserRoleAllowedModules('trader')
      expect(m).toContain(MODULE_ID.trading)
      expect(m).toContain(MODULE_ID.strategy)
      expect(m).toContain(MODULE_ID.analyzer)
      expect(m).toContain(MODULE_ID.fetcher)
    })
    it('analyst 包含 analyzer/fetcher/news', () => {
      const m = getUserRoleAllowedModules('analyst')
      expect(m).toContain(MODULE_ID.analyzer)
      expect(m).toContain(MODULE_ID.fetcher)
      expect(m).toContain(MODULE_ID.news)
    })
    it('viewer 只有 analyzer/fetcher', () => {
      expect(getUserRoleAllowedModules('viewer').length).toBe(2)
    })
    it('default: 未知 -> [analyzer, fetcher]', () => {
      expect(getUserRoleAllowedModules('unknown' as UserRole)).toEqual([MODULE_ID.analyzer, MODULE_ID.fetcher])
    })
  })

  describe('getDeveloperRoleAllowedModules()', () => {
    it('architect 拥有所有模块', () => {
      expect(getDeveloperRoleAllowedModules('architect').length).toBe(Object.values(MODULE_ID).length)
    })
    it('frontend 返回空数组', () => expect(getDeveloperRoleAllowedModules('frontend')).toEqual([]))
    it('ai-agent 包含 news/analyzer/fetcher/system', () => {
      const m = getDeveloperRoleAllowedModules('ai-agent')
      expect(m).toContain(MODULE_ID.news)
      expect(m).toContain(MODULE_ID.analyzer)
      expect(m).toContain(MODULE_ID.fetcher)
      expect(m).toContain(MODULE_ID.system)
    })
    it('trading 包含交易相关', () => {
      const m = getDeveloperRoleAllowedModules('trading')
      expect(m).toContain(MODULE_ID.trading)
      expect(m).toContain(MODULE_ID.strategy)
      expect(m).toContain(MODULE_ID.orderstore)
      expect(m).toContain(MODULE_ID.holdingsStore)
      expect(m).toContain(MODULE_ID.tradinghub)
    })
    it('fullstack 明确返回值', () => {
      expect(getDeveloperRoleAllowedModules('fullstack')).toEqual([
        MODULE_ID.analyzer, MODULE_ID.trading, MODULE_ID.system, MODULE_ID.fetcher,
      ])
    })
    it('data 明确返回值', () => {
      expect(getDeveloperRoleAllowedModules('data')).toEqual([
        MODULE_ID.fetcher, MODULE_ID.datalayer, MODULE_ID.pool,
        MODULE_ID.rotation, MODULE_ID.sector, MODULE_ID.news, MODULE_ID.analyzer,
      ])
    })
    it('default: 未知 -> []', () => expect(getDeveloperRoleAllowedModules('unknown' as DeveloperRole)).toEqual([]))
  })

  describe('checkUserRolePermission()', () => {
    it('admin 对 analyzer 有 select', () => {
      expect(checkUserRolePermission('admin', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(true)
    })
    it('viewer 不能访问 trading', () => {
      expect(checkUserRolePermission('viewer', MODULE_ID.trading, DB_OPERATION.select)).toBe(false)
    })
    it('!modulePermission: 模块不在 ACL_MATRIX → false', () => {
      const orig = (ACL_MATRIX as Record<string, unknown>)[MODULE_ID.analyzer]
      try {
        delete (ACL_MATRIX as Record<string, unknown>)[MODULE_ID.analyzer]
        expect(checkUserRolePermission('admin', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(false)
      } finally {
        ;(ACL_MATRIX as Record<string, unknown>)[MODULE_ID.analyzer] = orig
      }
    })
  })

  describe('checkDeveloperRolePermission()', () => {
    it('architect 有权限', () => {
      expect(checkDeveloperRolePermission('architect', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(true)
    })
    it('frontend 无权限', () => {
      expect(checkDeveloperRolePermission('frontend', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(false)
    })
    it('!modulePermission: 模块不在 ACL_MATRIX → false', () => {
      const orig = (ACL_MATRIX as Record<string, unknown>)[MODULE_ID.analyzer]
      try {
        delete (ACL_MATRIX as Record<string, unknown>)[MODULE_ID.analyzer]
        expect(checkDeveloperRolePermission('architect', MODULE_ID.analyzer, DB_OPERATION.select)).toBe(false)
      } finally {
        ;(ACL_MATRIX as Record<string, unknown>)[MODULE_ID.analyzer] = orig
      }
    })
    it('!actions.includes: trading 对 tradinghub select 被拒', () => {
      expect(checkDeveloperRolePermission('trading', MODULE_ID.tradinghub, DB_OPERATION.select)).toBe(false)
    })
  })

  describe('checkUserRoleDbOperation()', () => {
    it('INSERT → insert', () => {
      expect(typeof checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'INSERT_SCORE')).toBe('boolean')
    })
    it('UPDATE → update', () => {
      expect(typeof checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'UPDATE_STOCK')).toBe('boolean')
    })
    it('DELETE → delete', () => {
      expect(typeof checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'DELETE_BATCH')).toBe('boolean')
    })
    it('其他 → select', () => {
      expect(checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'QUERY_DATA')).toBe(true)
    })
    it('SAVE/INGEST → insert', () => {
      expect(typeof checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'SAVE_CONFIG')).toBe('boolean')
      expect(typeof checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'INGEST_DATA')).toBe('boolean')
    })
    it('CLEAR → delete', () => {
      expect(typeof checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'CLEAR_ALL')).toBe('boolean')
    })
  })

  describe('checkDeveloperRoleDbOperation()', () => {
    it('architect INSERT', () => {
      expect(typeof checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'INSERT_DATA')).toBe('boolean')
    })
    it('frontend 任意 → false', () => {
      expect(checkDeveloperRoleDbOperation('frontend', MODULE_ID.analyzer, 'SELECT')).toBe(false)
    })
    it('UPDATE → update（architect 对 analyzer 有 update → true）', () => {
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'UPDATE_STOCK')).toBe(true)
    })
    it('DELETE/CLEAR → delete（analyzer 无 delete → false）', () => {
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'DELETE_BATCH')).toBe(false)
      expect(checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'CLEAR_ALL')).toBe(false)
    })
  })
})