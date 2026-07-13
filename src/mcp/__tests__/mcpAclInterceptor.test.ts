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

  it('ui 角色应授权 trading 查询访问、但禁止 execution', () => {
    const uiServers = MCP_ACL_MATRIX.ui.allowedServers
    // 2026-07-13 变更：UI 显式授权 trading（仅放行查询类工具）。
    // trade/input/export 已在 Phase E 合并入 trading:main / fetcher:data / backtestExportService，
    // Server 已删除，故 UI 矩阵不再含这三者（授权由存活的 trading 承接）。
    expect(uiServers).toContain('trading')
    expect(uiServers).not.toContain('trade')
    expect(uiServers).not.toContain('input')
    expect(uiServers).not.toContain('export')
    // execution 仍禁止（写操作 Server）
    expect(uiServers).not.toContain('execution')
    expect(uiServers).toContain('fetcher')
    expect(uiServers).toContain('pool')
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
  it('应允许访问 trading Server 的查询类 Tool（get_orders 匹配 get_*）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'trading',
      resourceName: 'get_orders',
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('Permission granted')
  })

  it('应拒绝调用交易类写 Tool（即使在允许的 Server 上）', () => {
    // 假设有 pool Server 暴露了 create_order Tool
    // ui 角色虽可访问 pool Server，但 allowedTools 不包含 create_order
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'pool',
      resourceName: 'create_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
    expect(result.reason).toContain('create_order')
  })

  it('应允许调用查询类 Tool（list_* 通配符匹配）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui',
      serverName: 'pool',
      resourceName: 'list_pool_items',
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
    // 2026-07-13 变更：trading 已加入 ui.allowedServers，改用仍为禁止的 execution
    try {
      mcpAclInterceptor.assert({
        caller: 'ui',
        serverName: 'execution',
        resourceName: 'create_buy_order',
      })
      expect.fail('应抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(McpAclError)
      const aclErr = err as McpAclError
      expect(aclErr.detail.allowed).toBe(false)
      expect(aclErr.detail.caller).toBe('ui')
      expect(aclErr.detail.serverName).toBe('execution')
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
  it('list_* 应匹配 list_pool_items 但不匹配 listpoolstocks', () => {
    expect(
      mcpAclInterceptor.check({
        caller: 'ui',
        serverName: 'pool',
        resourceName: 'list_pool_items',
      }).allowed,
    ).toBe(true)

    // listpoolstocks 不以 list_ 开头，不匹配 list_*
    expect(
      mcpAclInterceptor.check({
        caller: 'ui',
        serverName: 'pool',
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

// ============================================================
// 套件 9: 权限拒绝场景全覆盖（P0 补充）
// ============================================================

describe('权限拒绝场景全覆盖', () => {
  // ── 9.1 未知角色拒绝 ──

  it('未知角色应被拒绝（角色未注册）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'guest' as never, // 故意传入未注册的角色
      serverName: 'fetcher',
      resourceName: 'health_check',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not registered')
  })

  it('未知角色应被拒绝（admin 角色不存在）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'admin' as never,
      serverName: 'system',
      resourceName: 'get_stats',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not registered')
  })

  // ── 9.2 ui 角色对所有禁止 Server 的拒绝 ──

  it('ui 角色应允许访问 trading Server 的查询类 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trading', resourceName: 'get_orders',
    })
    expect(result.allowed).toBe(true)
  })

  it('ui 角色应拒绝访问 execution Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'execution', resourceName: 'list_execution_plans',
    })
    expect(result.allowed).toBe(false)
  })

  // Phase E 合并后：trade/input/export Server 已删除（功能并入 trading:main /
  // fetcher:data / backtestExportService），不在 ui.allowedServers 中，
  // 故 UI 访问这三者应在 Server 级被拒绝。存活的查询能力由 trading 承接（见下方用例）。
  it('ui 角色访问已合并的 trade Server 应被 Server 级拒绝', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trade', resourceName: 'get_trades',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('ui 角色访问已合并的 input Server 应被 Server 级拒绝', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'input', resourceName: 'get_inputs',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('ui 角色访问已合并的 export Server 应被 Server 级拒绝', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'export', resourceName: 'export_backtest_report',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('ui 角色应允许访问存活的 trading Server 的查询类 Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trading', resourceName: 'get_orders',
    })
    expect(result.allowed).toBe(true)
  })

  // ── 9.2b 写操作仍必须拒绝（授权模型核心边界） ──

  it('ui 角色应拒绝调用 trading 写工具（create_buy_order）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trading', resourceName: 'create_buy_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
  })

  it('ui 角色调用已合并 trade 的写工具（execute_trade_action）应被 Server 级拒绝', () => {
    // trade Server 已合并入 trading:main 并删除；写工具的拒绝现由 Server 级承接
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trade', resourceName: 'execute_trade_action',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('ui 角色调用已合并 input 的写工具（import_pool）应被 Server 级拒绝', () => {
    // input Server 已合并入 fetcher:data 并删除；写工具的拒绝现由 Server 级承接
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'input', resourceName: 'import_pool',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('ui 角色应拒绝访问 system Server 的非查询类工具（reset_database）', () => {
    // 2026-07-12 修正：UI 按矩阵允许 system 的 get_* 工具（如 get_stats，权威单测 line 128 已锁定）。
    // 原用 get_stats 期望拒绝与矩阵冲突；改用 reset_database（不在 ui.allowedTools）作为真实拒绝场景。
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'system', resourceName: 'reset_database',
    })
    expect(result.allowed).toBe(false)
  })

  it('ui 角色应拒绝访问 data-collector Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'data-collector', resourceName: 'detect_missing_reports',
    })
    expect(result.allowed).toBe(false)
  })

  // ── 9.3 ci 角色对所有非 system Server 的拒绝 ──

  it('ci 角色应拒绝访问 fetcher Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'fetcher', resourceName: 'health_check',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  it('ci 角色应拒绝访问 trading Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'trading', resourceName: 'get_orders',
    })
    expect(result.allowed).toBe(false)
  })

  it('ci 角色应拒绝访问 pool Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'pool', resourceName: 'list_pool_items',
    })
    expect(result.allowed).toBe(false)
  })

  it('ci 角色应拒绝访问 scoring:v6 Server', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'scoring:v6', resourceName: 'get_engine_config',
    })
    expect(result.allowed).toBe(false)
  })

  // ── 9.4 ui 角色对禁止 Tool 模式的拒绝（即使在允许的 Server 上） ──

  it('ui 角色应拒绝调用 create_order Tool（即使在 pool Server 上）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'pool', resourceName: 'create_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
    expect(result.reason).toContain('create_order')
  })

  it('ui 角色应拒绝调用 update_stock Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'pool', resourceName: 'update_stock',
    })
    expect(result.allowed).toBe(false)
  })

  it('ui 角色应拒绝调用 delete_stock Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'pool', resourceName: 'delete_stock',
    })
    expect(result.allowed).toBe(false)
  })

  it('ui 角色应拒绝调用 insert_stock Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'pool', resourceName: 'insert_stock',
    })
    expect(result.allowed).toBe(false)
  })

  it('ui 角色应拒绝调用 reset_database Tool（即使在允许的 Server 上）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'fetcher', resourceName: 'reset_cache',
    })
    expect(result.allowed).toBe(false)
  })

  it('ui 角色应拒绝调用 export_data Tool（即使在允许的 Server 上）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'fetcher', resourceName: 'export_data',
    })
    expect(result.allowed).toBe(false)
  })

  // ── 9.5 ci 角色对禁止 Tool 的拒绝（即使在 system Server 上） ──

  it('ci 角色应拒绝调用 system Server 上的 reset_database Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'system', resourceName: 'reset_database',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
  })

  it('ci 角色应拒绝调用 system Server 上的 clear_cache Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'system', resourceName: 'clear_cache',
    })
    expect(result.allowed).toBe(false)
  })

  it('ci 角色应拒绝调用 system Server 上的 export_data Tool', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ci', serverName: 'system', resourceName: 'export_data',
    })
    expect(result.allowed).toBe(false)
  })

  // ── 9.6 通配符不匹配的拒绝 ──

  it('list_* 不应匹配 listpoolstocks（缺少下划线）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'pool', resourceName: 'listpoolstocks',
    })
    expect(result.allowed).toBe(false)
  })

  it('get_* 不应匹配 getstats（缺少下划线）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'scoring:v6', resourceName: 'getstats',
    })
    expect(result.allowed).toBe(false)
  })

  it('fetch_* 不应匹配 fetchnews（缺少下划线）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'fetcher', resourceName: 'fetchnews',
    })
    expect(result.allowed).toBe(false)
  })

  // ── 9.7 Server 级别 vs Tool 级别拒绝原因区分 ──

  it('Server 级别拒绝原因应包含 "not allowed to access server"', () => {
    // 2026-07-13 变更：trading 已加入 ui.allowedServers，改用仍为禁止的 execution Server
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'execution', resourceName: 'any_tool',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
    expect(result.reason).not.toContain('not allowed to call tool')
  })

  it('Tool 级别拒绝原因应包含 "not allowed to call tool"', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'pool', resourceName: 'create_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to call tool')
    expect(result.reason).not.toContain('not allowed to access server')
  })

  it('Server 级别拒绝应优先于 Tool 级别检查', () => {
    // 2026-07-13 变更：trading 已加入 ui.allowedServers，改用仍为禁止的 execution Server
    // ui 角色访问 execution Server 的 create_order Tool 应在 Server 级别被拒绝
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'execution', resourceName: 'create_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not allowed to access server')
  })

  // ── 9.8 边界场景 ──

  it('空字符串 resourceName 应被拒绝（不匹配任何模式）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'fetcher', resourceName: '',
    })
    expect(result.allowed).toBe(false)
  })

  it('空字符串 serverName 应被拒绝（ui 角色不允许）', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: '', resourceName: 'health_check',
    })
    expect(result.allowed).toBe(false)
  })

  it('超长 resourceName 应正常处理（不崩溃）', () => {
    const longName = 'tool_' + 'a'.repeat(1000)
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'fetcher', resourceName: longName,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  // ── 9.9 拒绝结果结构化字段验证 ──

  it('拒绝结果应包含完整的结构化字段', () => {
    const result = mcpAclInterceptor.check({
      caller: 'ui', serverName: 'trading', resourceName: 'create_order',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeTruthy()
    expect(result.caller).toBe('ui')
    expect(result.serverName).toBe('trading')
    expect(result.resourceName).toBe('create_order')
  })

  it('放行结果也应包含完整的结构化字段', () => {
    const result = mcpAclInterceptor.check({
      caller: 'agent', serverName: 'fetcher', resourceName: 'health_check',
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('Permission granted')
    expect(result.caller).toBe('agent')
    expect(result.serverName).toBe('fetcher')
    expect(result.resourceName).toBe('health_check')
  })
})

// ============================================================
// 套件 10: 四角色权限对比矩阵
// ============================================================

describe('四角色权限对比矩阵', () => {
  const testCases: Array<{
    desc: string
    server: string
    tool: string
    expected: { agent: boolean; ui: boolean; ci: boolean; system: boolean }
  }> = [
    {
      desc: 'fetcher.health_check（查询类）',
      server: 'fetcher', tool: 'health_check',
      expected: { agent: true, ui: true, ci: false, system: true },
    },
    {
      desc: 'pool.list_pool_items（列表查询）',
      server: 'pool', tool: 'list_pool_items',
      expected: { agent: true, ui: true, ci: false, system: true },
    },
    {
      desc: 'trading.create_buy_order（交易写操作）',
      server: 'trading', tool: 'create_buy_order',
      expected: { agent: true, ui: false, ci: false, system: true },
    },
    {
      desc: 'system.reset_database（系统级危险操作）',
      server: 'system', tool: 'reset_database',
      expected: { agent: true, ui: false, ci: false, system: true },
    },
    {
      desc: 'system.generate_migration_report（迁移报告）',
      server: 'system', tool: 'generate_migration_report',
      expected: { agent: true, ui: false, ci: true, system: true },
    },
    {
      // 2026-07-12 修正：get_stats 匹配 ui.allowedTools 的 get_* 通配符，UI 应放行
      desc: 'system.get_stats（系统统计）',
      server: 'system', tool: 'get_stats',
      expected: { agent: true, ui: true, ci: true, system: true },
    },
    {
      desc: 'execution.list_execution_plans（执行计划查询）',
      server: 'execution', tool: 'list_execution_plans',
      expected: { agent: true, ui: false, ci: false, system: true },
    },
    {
      desc: 'scoring:v6.score_stock（评分写操作）',
      server: 'scoring:v6', tool: 'score_stock',
      expected: { agent: true, ui: true, ci: false, system: true },
    },
  ]

  for (const tc of testCases) {
    it(`${tc.desc} → agent=${tc.expected.agent}, ui=${tc.expected.ui}, ci=${tc.expected.ci}, system=${tc.expected.system}`, () => {
      expect(
        mcpAclInterceptor.check({ caller: 'agent', serverName: tc.server, resourceName: tc.tool }).allowed,
      ).toBe(tc.expected.agent)
      expect(
        mcpAclInterceptor.check({ caller: 'ui', serverName: tc.server, resourceName: tc.tool }).allowed,
      ).toBe(tc.expected.ui)
      expect(
        mcpAclInterceptor.check({ caller: 'ci', serverName: tc.server, resourceName: tc.tool }).allowed,
      ).toBe(tc.expected.ci)
      expect(
        mcpAclInterceptor.check({ caller: 'system', serverName: tc.server, resourceName: tc.tool }).allowed,
      ).toBe(tc.expected.system)
    })
  }
})

// ============================================================
// 套件 11: assert() 拒绝场景全覆盖
// ============================================================

describe('assert() 拒绝场景全覆盖', () => {
  it('未知角色拒绝时应抛出 McpAclError 且 detail.caller 为传入值', () => {
    try {
      mcpAclInterceptor.assert({
        caller: 'guest' as never, serverName: 'fetcher', resourceName: 'health_check',
      })
      expect.fail('应抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(McpAclError)
      expect((err as McpAclError).detail.caller).toBe('guest' as never)
      expect((err as McpAclError).detail.reason).toContain('not registered')
    }
  })

  it('Server 级别拒绝时抛出的 McpAclError 应包含正确的 serverName', () => {
    try {
      // 2026-07-13 变更：trading 已加入 ui.allowedServers，改用仍为禁止的 execution
      mcpAclInterceptor.assert({
        caller: 'ui', serverName: 'execution', resourceName: 'get_orders',
      })
      expect.fail('应抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(McpAclError)
      const aclErr = err as McpAclError
      expect(aclErr.detail.serverName).toBe('execution')
      expect(aclErr.detail.resourceName).toBe('get_orders')
      expect(aclErr.detail.reason).toContain('execution')
    }
  })

  it('Tool 级别拒绝时抛出的 McpAclError 应包含正确的 resourceName', () => {
    try {
      mcpAclInterceptor.assert({
        caller: 'ui', serverName: 'pool', resourceName: 'delete_stock',
      })
      expect.fail('应抛出异常')
    } catch (err) {
      expect(err).toBeInstanceOf(McpAclError)
      const aclErr = err as McpAclError
      expect(aclErr.detail.resourceName).toBe('delete_stock')
      expect(aclErr.detail.reason).toContain('delete_stock')
    }
  })

  it('ci 角色拒绝时应抛出 McpAclError', () => {
    expect(() => {
      mcpAclInterceptor.assert({
        caller: 'ci', serverName: 'fetcher', resourceName: 'health_check',
      })
    }).toThrow(McpAclError)
  })

  it('ci 角色调用禁止 Tool 时应抛出 McpAclError', () => {
    expect(() => {
      mcpAclInterceptor.assert({
        caller: 'ci', serverName: 'system', resourceName: 'reset_database',
      })
    }).toThrow(McpAclError)
  })
})
