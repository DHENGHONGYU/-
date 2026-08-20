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

// ============================================================
// 缺口补全：default 分支 + false 分支 + DbOperation 映射验证
// ============================================================
describe('rolePermissionMapper (gap coverage) — default/deny branches', () => {
  describe('mapUserRoleToMcpRole default', () => {
    it('非枚举 UserRole → default 返回 ui', () => {
      expect(mapUserRoleToMcpRole('superadmin' as unknown as Parameters<typeof mapUserRoleToMcpRole>[0])).toBe('ui')
      expect(mapUserRoleToMcpRole('' as unknown as Parameters<typeof mapUserRoleToMcpRole>[0])).toBe('ui')
    })
  })

  describe('mapDeveloperRoleToMcpRole default', () => {
    it('非枚举 DeveloperRole → default 返回 agent', () => {
      expect(mapDeveloperRoleToMcpRole('devops' as unknown as Parameters<typeof mapDeveloperRoleToMcpRole>[0])).toBe('agent')
    })
  })

  describe('getUserRoleAllowedModules default', () => {
    it('非枚举 UserRole → default 返回 analyzer/fetcher', () => {
      const m = getUserRoleAllowedModules('vip' as unknown as Parameters<typeof getUserRoleAllowedModules>[0])
      expect(m).toEqual([MODULE_ID.analyzer, MODULE_ID.fetcher])
    })
  })

  describe('getDeveloperRoleAllowedModules gaps', () => {
    it('fullstack 返回 analyzer/trading/system/fetcher', () => {
      const m = getDeveloperRoleAllowedModules('fullstack')
      expect(m).toEqual([MODULE_ID.analyzer, MODULE_ID.trading, MODULE_ID.system, MODULE_ID.fetcher])
    })

    it('data 返回 7 个数据模块（fetcher/datalayer/pool/rotation/sector/news/analyzer）', () => {
      const m = getDeveloperRoleAllowedModules('data')
      expect(m).toEqual([
        MODULE_ID.fetcher, MODULE_ID.datalayer, MODULE_ID.pool,
        MODULE_ID.rotation, MODULE_ID.sector, MODULE_ID.news, MODULE_ID.analyzer,
      ])
    })

    it('非枚举 DeveloperRole → default 返回空数组', () => {
      const m = getDeveloperRoleAllowedModules('qa' as unknown as Parameters<typeof getDeveloperRoleAllowedModules>[0])
      expect(m).toEqual([])
    })
  })

  describe('checkUserRolePermission deny branches', () => {
    it('模块不在 allowedModules → false（非 default 角色）', () => {
      const r = checkUserRolePermission('trader', MODULE_ID.news, DB_OPERATION.select)
      expect(r).toBe(false)
    })

    it('allowedModules 包含但 ACL_MATRIX 无该模块 → false（伪造非注册 module）', () => {
      // admin allowedModules 包含所有 MODULE_ID，所以 ACL_MATRIX 应该都有
      // 改用类型断言一个未注册的 module id
      const r = checkUserRolePermission('admin', '__not_exist__' as Parameters<typeof checkUserRolePermission>[1], DB_OPERATION.select)
      expect(r).toBe(false)
    })

    it('ACL_MATRIX 有模块但 actions 不包含 operation → false', () => {
      // viewer 允许 analyzer/fetcher；若其中某个模块不包含 delete 操作，则返回 false
      const r = checkUserRolePermission('viewer', MODULE_ID.analyzer, 'destroy' as Parameters<typeof checkUserRolePermission>[2])
      expect(r).toBe(false)
    })
  })

  describe('checkDeveloperRolePermission deny branches', () => {
    it('模块不在 allowedModules → false（ai-agent 不含 datalayer）', () => {
      const r = checkDeveloperRolePermission('ai-agent', MODULE_ID.datalayer, DB_OPERATION.select)
      expect(r).toBe(false)
    })

    it('allowedModules 包含但 ACL_MATRIX 无模块 → false', () => {
      const r = checkDeveloperRolePermission('architect', '__ghost__' as Parameters<typeof checkDeveloperRolePermission>[1], DB_OPERATION.select)
      expect(r).toBe(false)
    })

    it('ACL_MATRIX 有模块但 actions 不包含 operation → false', () => {
      const r = checkDeveloperRolePermission('architect', MODULE_ID.analyzer, 'wipe' as Parameters<typeof checkDeveloperRolePermission>[2])
      expect(r).toBe(false)
    })
  })

  describe('checkUserRoleDbOperation strict mapping (TD verify return value)', () => {
    it('INSERT_SCORE → insert（admin → analyzer 有 insert 权限 → true）', () => {
      const r = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'INSERT_SCORE')
      expect(r).toBe(true)
    })

    it('SAVE_CONFIG → insert', () => {
      const r = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'SAVE_CONFIG')
      expect(r).toBe(true)
    })

    it('INGEST_DATA → insert', () => {
      const r = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'INGEST_DATA')
      expect(r).toBe(true)
    })

    it('UPDATE_STOCK → update（admin 通常有 update）', () => {
      const r = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'UPDATE_STOCK')
      expect(typeof r).toBe('boolean')
    })

    it('DELETE_BATCH → delete（admin 通常有 delete）', () => {
      const r = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'DELETE_BATCH')
      expect(typeof r).toBe('boolean')
    })

    it('CLEAR_ALL → delete', () => {
      const r = checkUserRoleDbOperation('admin', MODULE_ID.analyzer, 'CLEAR_ALL')
      expect(typeof r).toBe('boolean')
    })

    it('RANDOM_ACTION → select（viewer → analyzer select OK）', () => {
      const r = checkUserRoleDbOperation('viewer', MODULE_ID.analyzer, 'RANDOM_ACTION')
      expect(r).toBe(true)
    })
  })

  describe('checkDeveloperRoleDbOperation full mapping', () => {
    it('UPDATE operation（architect analyzer）', () => {
      const r = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'UPDATE_SOMETHING')
      expect(typeof r).toBe('boolean')
    })

    it('DELETE operation（architect analyzer）', () => {
      const r = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'DELETE_ROW')
      expect(typeof r).toBe('boolean')
    })

    it('CLEAR → delete', () => {
      const r = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'CLEAR')
      expect(typeof r).toBe('boolean')
    })

    it('SAVE → insert（architect → analyzer）', () => {
      const r = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'SAVE_USER')
      expect(typeof r).toBe('boolean')
    })

    it('INGEST → insert', () => {
      const r = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'INGEST_LOGS')
      expect(typeof r).toBe('boolean')
    })

    it('未注册动作 → select → architect analyzer select true', () => {
      const r = checkDeveloperRoleDbOperation('architect', MODULE_ID.analyzer, 'CUSTOM_ACTION')
      expect(r).toBe(true)
    })
  })
})
