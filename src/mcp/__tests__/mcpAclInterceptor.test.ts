/**
 * MCP ACL 拦截器单元测试
 *
 * @description
 * 验证 McpAclInterceptor 的权限校验逻辑：
 *   - 4 种调用方角色（agent/ui/ci/system）的权限矩阵
 *   - 通配符匹配规则（`'*'`、`'prefix_*'`）
 *   - assert() 抛出 McpAclError
 *   - resolveCaller() 默认值回退
 *
 * @module mcp/__tests__/mcpAclInterceptor.test.ts
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

import { describe, it, expect } from 'vitest'
import {
  mcpAclInterceptor,
  resolveCaller,
  McpAclError,
} from '../core/mcpAclInterceptor'
import { MCP_ACL_MATRIX, DEFAULT_MCP_CALLER } from '@/config/mcpAclMatrix'

// ============================================================
// 套件 1: 权限矩阵配置完整性
// ============================================================

describe('MCP ACL 权限矩阵配置', () => {
  it('应包含 4 种调用方角色', () => {
    expect(MCP_ACL_MATRIX.agent).toBeDefined()
    expect(MCP_ACL_MATRIX.ui).toBeDefined()
    expect(MCP_ACL_MATRIX.ci).toBeDefined()
    expect(MCP_ACL_MATRIX.system).toBeDefined()
  })

  it('默认调用方角色应为 agent', () => {
    expect(DEFAULT_MCP_CALLER).toBe('agent')
  })

  it('agent 和 system 角色应拥有全权限（*）', () => {
    expect(MCP_ACL_MATRIX.agent.allowedServers).toContain('*')
    expect(MCP_ACL_MATRIX.agent.allowedTools).toContain('*')
    expect(MCP_ACL_MATRIX.system.allowedServers).toContain('*')
    expect(MCP_ACL_MATRIX.system.allowedTools).toContain('*')
  })

  it('ui 角色应限制交易类 Server 访问', () => {
    const uiServers = MCP_ACL_MATRIX.ui.allowedServers
    expect(uiServers).not.toContain('trading')
    expect(uiServers).not.toContain('execution')
    expect(uiServers).not.toContain('trade')
    expect(uiServers).toContain('fetcher')
    expect(uiServers).toContain('stockpool')
  })
})

// ============================================================
// 套件 2: agent 角色（全权限）
// ============================================================

describe('McpAclInterceptor - agent 角色', () => {
  it('应允许访问所有 Server 的所有 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'agent',
      serverName: 'trading',
      resourceName: 'create_buy_order',
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('Permission granted')
  })

  it('应允许访问任意未知 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'agent',
      serverName: 'fetcher',
      resourceName: 'any_unknown_tool',
    })
    expect(result.allowed).toBe(true)
  })

  it('应允许访问任意未知 Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'agent',
      serverName: 'unknown_server',
      resourceName: 'any_tool',
    })
    expect(result.allowed).toBe(true)
  })
})

// ============================================================
// 套件 3: ui 角色（受限权限）
// ============================================================

describe('McpAclInterceptor - ui 角色', () => {
  it('应拒绝访问 trading Server（不在 allowedServers 中）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'trading',
      resourceName: 'get_orders',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
    expect(result.reason).toContain('trading')
  })

  it('应拒绝调用交易类写 Tool（即使在允许的 Server 上）', () => {
    // 假设有 stockpool Server 暴露了 create_order Tool
    // ui 角色虽可访问 stockpool Server，但 allowedTools 不包含 create_order
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'stockpool',
      resourceName: 'create_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
    expect(result.reason).toContain('create_order')
  })

  it('应允许调用查询类 Tool（list_* 通配符匹配）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'stockpool',
      resourceName: 'list_pool_stocks',
    })
    expect(result.allowed).toBe(true)
  })

  it('应允许调用 get_* 通配符匹配的 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'scoring:v6',
      resourceName: 'get_engine_config',
    })
    expect(result.allowed).toBe(true)
  })

  it('应允许调用 fetch_* 通配符匹配的 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'fetcher',
      resourceName: 'fetch_news',
    })
    expect(result.allowed).toBe(true)
  })

  it('应允许调用显式列出的 Tool（health_check）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'fetcher',
      resourceName: 'health_check',
    })
    expect(result.allowed).toBe(true)
  })
})

// ============================================================
// 套件 4: ci 角色（最小权限）
// ============================================================

describe('McpAclInterceptor - ci 角色', () => {
  it('应拒绝访问非 system Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci',
      serverName: 'fetcher',
      resourceName: 'health_check',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('应允许访问 system Server 的 get_* Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci',
      serverName: 'system',
      resourceName: 'get_stats',
    })
    expect(result.allowed).toBe(true)
  })

  it('应允许调用 generate_migration_report Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci',
      serverName: 'system',
      resourceName: 'generate_migration_report',
    })
    expect(result.allowed).toBe(true)
  })

  it('应拒绝调用 system Server 上未授权的 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci',
      serverName: 'system',
      resourceName: 'reset_database',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
  })
})

// ============================================================
// 套件 5: system 角色（超级权限）
// ============================================================

describe('McpAclInterceptor - system 角色', () => {
  it('应允许访问所有 Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'system',
      serverName: 'any_server',
      resourceName: 'any_tool',
    })
    expect(result.allowed).toBe(true)
  })
})

// ============================================================
// 套件 6: assert() 抛出异常
// ============================================================

describe('McpAclInterceptor.assert()', () => {
  it('权限通过时不抛出异常', () => {
    expect(() => {
      mcpAclInterceptor.assert({
        caller: 'agent',
        serverName: 'fetcher',
        resourceName: 'health_check',
      })
    }).not.toThrow()
  })

  it('权限拒绝时应抛出 McpAclError', () => {
    expect(() => {
      mcpAclInterceptor.assert({
        caller: 'ui',
        serverName: 'trading',
        resourceName: 'create_buy_order',
      })
    }).toThrow(McpAclError)
  })

  it('McpAclError 应包含 detail 字段（含拒绝原因）', () => {
    try {
      mcpAclInterceptor.assert({
        caller: 'ui',
        serverName: 'trading',
        resourceName: 'create_buy_order',
      })
      expect.fail('应抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(McpAclError)
      const aclErr = err as McpAclError
      expect(aclErr.detail.allowed).toBe(false)
      expect(aclErr.detail.caller).toBe('ui')
      expect(aclErr.detail.serverName).toBe('trading')
      expect(aclErr.detail.resourceName).toBe('create_buy_order')
      expect(aclErr.message).toContain('not allowed to access server')
    }
  })
})

// ============================================================
// 套件 7: resolveCaller() 默认值回退
// ============================================================

describe('resolveCaller()', () => {
  it('未传入时应返回默认值 agent', () => {
    expect(resolveCaller(undefined)).toBe('agent')
  })

  it('传入显式值时应返回该值', () => {
    expect(resolveCaller('ui')).toBe('ui')
    expect(resolveCaller('ci')).toBe('ci')
    expect(resolveCaller('system')).toBe('system')
  })
})

// ============================================================
// 套件 8: 通配符匹配边界场景
// ============================================================

describe('通配符匹配边界场景', () => {
  it('list_* 应匹配 list_pool_stocks 但不匹配 listpoolstocks', () => {
    expect(
      mcpAclInterceptor.check({
        caller: 'ui',
        serverName: 'stockpool',
        resourceName: 'list_pool_stocks',
      }).allowed,
    ).toBe(true)

    // listpoolstocks 不以 list_ 开头，不匹配 list_*
    expect(
      mcpAclInterceptor.check({
        caller: 'ui',
        serverName: 'stockpool',
        resourceName: 'listpoolstocks',
      }).allowed,
    ).toBe(false)
  })

  it('get_* 应匹配 get_engine_config', () => {
    expect(
      mcpAclInterceptor.check({
        caller: 'ui',
        serverName: 'scoring:v6',
        resourceName: 'get_engine_config',
      }).allowed,
    ).toBe(true)
  })

  it('完全相同的 Tool 名应直接匹配', () => {
    expect(
      mcpAclInterceptor.check({
        caller: 'ui',
        serverName: 'fetcher',
        resourceName: 'health_check',
      }).allowed,
    ).toBe(true)
  })
})
