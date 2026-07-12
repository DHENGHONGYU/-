/**
 * @fileoverview MCP ACL 真实场景权限拦截集成测试
 *
 * @description
 * 模拟真实业务场景下的双端权限拦截流程，验证 4 种调用方角色
 * (agent/ui/ci/system) 在端到端调用链路 (mcpBridge → MCPClient → MCPServerBase)
 * 中的权限边界。
 *
 * **测试目标**：
 *   1. 验证 Client 主拦截点能正确放行/拒绝各角色调用
 *   2. 验证 Server 端深度防御能拦截绕过 Client 的直接调用
 *   3. 验证双端拦截行为一致性（同一调用，两端返回相同的拒绝原因）
 *   4. 验证 ACL_PERMISSION_DENIED 错误结构化格式
 *   5. 验证真实业务场景的端到端权限边界
 *
 * **测试结构（8 个套件，共 36 个用例）**：
 *   套件1: UI 场景 — 查询工具放行 + 写操作拦截（5 用例）
 *   套件2: CI 场景 — 迁移工具放行 + 业务数据拦截（4 用例）
 *   套件3: Agent 场景 — 全权限放行（3 用例）
 *   套件4: System 场景 — 系统内部调用全权限放行（3 用例）
 *   套件5: 绕过 Client 直接调用 Server 的拦截（4 用例）
 *   套件6: 未知角色与边界场景（5 用例）
 *   套件7: 双端校验一致性验证（6 用例）
 *   套件8: ACL_PERMISSION_DENIED 结构化格式验证（6 用例）
 *
 * @module tests/__tests__/integration/mcp-acl-scenarios.integration.test
 * @created 2026-07-08 - P0 MCP 权限控制修复
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db, close } from '@/data/db'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { mcpRegistry } from '@/mcp/core/registry'
import { registerAllServers } from '@/mcp/register'
import { mcpAclInterceptor, McpAclError } from '@/mcp/core/mcpAclInterceptor'
import { MCP_ACL_MATRIX } from '@/config/mcpAclMatrix'
import type {
  McpCallerContext,
  McpCallerRole,
  ToolResult,
} from '@/types/modules/mcp.types'

// ============================================================
// 常量：4 种调用方上下文（模拟真实业务场景）
// ============================================================

/** UI 组件调用上下文（StockPoolPanel 查询股票池） */
const UI_CALLER: McpCallerContext = {
  caller: 'ui',
  callerId: 'StockPoolPanel',
}

/** CI 流水线调用上下文（GitHub Actions 触发迁移报告） */
const CI_CALLER: McpCallerContext = {
  caller: 'ci',
  callerId: 'github-actions',
}

/** AI Agent 调用上下文（AgentRuntime 执行任务） */
const AGENT_CALLER: McpCallerContext = {
  caller: 'agent',
  callerId: 'agent-runtime-001',
}

/** 系统内部调用上下文（useMcpMigration 迁移组件） */
const SYSTEM_CALLER: McpCallerContext = {
  caller: 'system',
  callerId: 'useMcpMigration',
}

/** 未知调用方上下文（模拟越权场景） */
const UNKNOWN_CALLER = {
  caller: 'guest' as unknown as McpCallerRole,
  callerId: 'malicious-caller',
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 断言 ToolResult 是 ACL_PERMISSION_DENIED 错误
 */
function assertAclDenied(result: ToolResult, expectedKeyword?: string): void {
  expect(result.isError).toBe(true)
  expect(result.content).toHaveLength(1)
  expect(result.content[0].type).toBe('text')
  const text = result.content[0].text ?? ''
  expect(text).toContain('ACL_PERMISSION_DENIED')
  if (expectedKeyword) {
    expect(text).toContain(expectedKeyword)
  }
}

/**
 * 断言 ToolResult 不是 ACL 拒绝（即权限通过，可能是成功或业务错误）
 */
function assertAclAllowed(result: ToolResult): void {
  // 权限通过：要么成功，要么是业务错误（如 Tool not found），但不能是 ACL_PERMISSION_DENIED
  const text = result.content[0]?.text ?? ''
  expect(text).not.toContain('ACL_PERMISSION_DENIED')
}

// ============================================================
// 文件级初始化：注册所有 MCP Server + 初始化 db
//
// 权限放行的用例会触发真实 Tool 执行（如 list_pool_stocks 查询 stocks store），
// 因此需要初始化 IndexedDB。权限拒绝的用例在 ACL 层拦截，不会触及 db。
// ============================================================

beforeAll(async () => {
  registerAllServers()
  await db.init()
})

afterAll(() => {
  // 关闭 db 连接 + 重置单例，避免同一进程串行运行多个测试文件时状态污染
  close()
})

// ============================================================
// 套件 1: UI 场景 — 查询工具放行 + 写操作拦截（5 用例）
// ============================================================

describe('套件1: UI 场景权限拦截', () => {
  it('UI 调用 stockpool.list_pool_stocks（查询类）应放行', async () => {
    const result = await mcpBridge.callTool(
      'stockpool',
      'list_pool_stocks',
      {},
      UI_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('UI 调用 fetcher.health_check（健康检查）应放行', async () => {
    const result = await mcpBridge.callTool(
      'fetcher',
      'health_check',
      {},
      UI_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('UI 调用 trading.create_buy_order（交易写操作）应被 Server 级拦截', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'create_buy_order',
      { symbol: 'TEST001', price: 10.5, quantity: 100 },
      UI_CALLER,
    )
    assertAclDenied(result, 'server "trading"')
  }, { timeout: 60000 })

  it('UI 调用 execution 工具应被 Server 级拦截', async () => {
    const result = await mcpBridge.callTool(
      'execution',
      'list_execution_logs',
      {},
      UI_CALLER,
    )
    assertAclDenied(result, 'server "execution"')
  }, { timeout: 60000 })

  it('UI 调用 scoring:v6.get_engine_config（get_* 通配符）应放行', async () => {
    // 2026-07-12 修正：get_engine_config 实际注册在 scoring:v6 Server（见 v6ScoringServer），
    // 且 MCP_ACL_MATRIX 允许 ui 角色调用 scoring:v6 的 get_* 工具（权威单测 mcpAclInterceptor.test.ts:128 已锁定）。
    // 原用例误写为 system.get_engine_config 且期望 ACL_PERMISSION_DENIED，与矩阵冲突。
    const result = await mcpBridge.callTool(
      'scoring:v6',
      'get_engine_config',
      {},
      UI_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })
})

// ============================================================
// 套件 2: CI 场景 — 迁移工具放行 + 业务数据拦截（4 用例）
// ============================================================

describe('套件2: CI 场景权限拦截', () => {
  it('CI 调用 system.generate_migration_report 应放行', async () => {
    const result = await mcpBridge.callTool(
      'system',
      'generate_migration_report',
      { migrationReport: { version: '1.0.0', status: 'completed' } },
      CI_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('CI 调用 scoring:v6.get_engine_config（非 system Server）应被 Server 级拦截', async () => {
    // 2026-07-12 修正：get_engine_config 注册在 scoring:v6（非 system）。
    // ci 角色仅允许 system Server（MCP_ACL_MATRIX），故 CI 调用 scoring:v6 应被拒绝。
    const result = await mcpBridge.callTool(
      'scoring:v6',
      'get_engine_config',
      {},
      CI_CALLER,
    )
    assertAclDenied(result, 'server "scoring:v6"')
  }, { timeout: 60000 })

  it('CI 调用 stockpool.list_pool_stocks 应被 Server 级拦截', async () => {
    const result = await mcpBridge.callTool(
      'stockpool',
      'list_pool_stocks',
      {},
      CI_CALLER,
    )
    assertAclDenied(result, 'server "stockpool"')
  }, { timeout: 60000 })

  it('CI 调用 fetcher.health_check 应被 Server 级拦截（非 system Server）', async () => {
    const result = await mcpBridge.callTool(
      'fetcher',
      'health_check',
      {},
      CI_CALLER,
    )
    assertAclDenied(result, 'server "fetcher"')
  }, { timeout: 60000 })
})

// ============================================================
// 套件 3: Agent 场景 — 全权限放行（3 用例）
// ============================================================

describe('套件3: Agent 场景权限拦截', () => {
  it('Agent 调用 trading（写操作 Server）应放行', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'list_orders',
      {},
      AGENT_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('Agent 调用 fetcher.health_check 应放行', async () => {
    const result = await mcpBridge.callTool(
      'fetcher',
      'health_check',
      {},
      AGENT_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('Agent 调用 scoring:v6.get_engine_config 应放行', async () => {
    // 2026-07-12 修正：get_engine_config 注册在 scoring:v6；agent 角色拥有全权限，应放行。
    const result = await mcpBridge.callTool(
      'scoring:v6',
      'get_engine_config',
      {},
      AGENT_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })
})

// ============================================================
// 套件 4: System 场景 — 系统内部调用全权限放行（3 用例）
// ============================================================

describe('套件4: System 场景权限拦截', () => {
  it('System 调用 trading.create_buy_order 应放行', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'create_buy_order',
      { symbol: 'TEST001', price: 10.5, quantity: 100 },
      SYSTEM_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('System 调用 system.generate_migration_report 应放行', async () => {
    const result = await mcpBridge.callTool(
      'system',
      'generate_migration_report',
      { migrationReport: { version: '1.0.0', status: 'completed' } },
      SYSTEM_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('System 调用 fetcher.health_check 应放行', async () => {
    const result = await mcpBridge.callTool(
      'fetcher',
      'health_check',
      {},
      SYSTEM_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })
})

// ============================================================
// 套件 5: 绕过 Client 直接调用 Server 的拦截（4 用例）
//
// 这是"Server 防小人"的核心验证：即使调用方绕过 MCPClient 直接拿到
// Server 实例，Server 自身的 assertServerPermission 也会拦截。
// ============================================================

describe('套件5: 绕过 Client 直接调用 Server 的拦截', () => {
  it('UI 角色绕过 Client 调用 trading.callTool 应被 Server 端拦截', async () => {
    const entry = mcpRegistry.getServer('trading')
    expect(entry).toBeDefined()
    const result = await entry!.server.callTool(
      'create_buy_order',
      { symbol: 'TEST001', price: 10.5, quantity: 100 },
      UI_CALLER,
    )
    assertAclDenied(result, 'server "trading"')
  }, { timeout: 60000 })

  it('CI 角色绕过 Client 调用 stockpool.callTool 应被 Server 端拦截', async () => {
    const entry = mcpRegistry.getServer('stockpool')
    expect(entry).toBeDefined()
    const result = await entry!.server.callTool(
      'list_pool_stocks',
      {},
      CI_CALLER,
    )
    assertAclDenied(result, 'server "stockpool"')
  }, { timeout: 60000 })

  it('Agent 角色绕过 Client 直接调用 Server 应放行（全权限）', async () => {
    const entry = mcpRegistry.getServer('fetcher')
    expect(entry).toBeDefined()
    const result = await entry!.server.callTool(
      'health_check',
      {},
      AGENT_CALLER,
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('不传 context 直接调用 Server 应使用默认 agent 角色放行（向后兼容）', async () => {
    const entry = mcpRegistry.getServer('fetcher')
    expect(entry).toBeDefined()
    // 不传 context，触发 defaultCallerRole='agent' 回退
    const result = await entry!.server.callTool('health_check', {})
    assertAclAllowed(result)
  }, { timeout: 60000 })
})

// ============================================================
// 套件 6: 未知角色与边界场景（5 用例）
// ============================================================

describe('套件6: 未知角色与边界场景', () => {
  it('未知 caller 角色（guest）应被 Client 拦截', async () => {
    const result = await mcpBridge.callTool(
      'fetcher',
      'health_check',
      {},
      UNKNOWN_CALLER,
    )
    assertAclDenied(result, 'not registered')
  }, { timeout: 60000 })

  it('未知 caller 角色（guest）绕过 Client 应被 Server 端拦截', async () => {
    const entry = mcpRegistry.getServer('fetcher')
    expect(entry).toBeDefined()
    const result = await entry!.server.callTool(
      'health_check',
      {},
      UNKNOWN_CALLER,
    )
    assertAclDenied(result, 'not registered')
  }, { timeout: 60000 })

  it('未传入 context 应使用默认 agent 角色放行（向后兼容）', async () => {
    const result = await mcpBridge.callTool(
      'fetcher',
      'health_check',
      {},
      // 不传 context，触发 resolveCaller 默认 'agent'
    )
    assertAclAllowed(result)
  }, { timeout: 60000 })

  it('UI 调用不匹配通配符的 Tool 应被 Tool 级拦截', async () => {
    // list_pool_stocks 在 allowedTools 显式列出，但 delete_stock 不在
    const result = await mcpBridge.callTool(
      'stockpool',
      'delete_stock',
      { symbol: 'TEST001' },
      UI_CALLER,
    )
    assertAclDenied(result, 'tool "delete_stock"')
  }, { timeout: 60000 })

  it('CI 调用非 get_* / generate_migration_report 的 Tool 应被 Tool 级拦截', async () => {
    // ci 的 allowedTools 是 ['get_*', 'generate_migration_report']
    // system Server 上调用 reset_database 不匹配
    const result = await mcpBridge.callTool(
      'system',
      'reset_database',
      {},
      CI_CALLER,
    )
    assertAclDenied(result, 'tool "reset_database"')
  }, { timeout: 60000 })
})

// ============================================================
// 套件 7: 双端校验一致性验证（6 用例）
//
// 验证 Client 拦截和 Server 拦截对同一调用返回相同的拒绝原因，
// 确保权限逻辑在两端保持一致（避免"Client 拒绝但 Server 放行"的漏洞）。
// ============================================================

describe('套件7: 双端校验一致性验证', () => {
  const consistencyCases: Array<{
    desc: string
    server: string
    tool: string
    caller: McpCallerContext
    expectedKeyword: string
  }> = [
    {
      desc: 'UI 调用 trading（Server 级拒绝）',
      server: 'trading',
      tool: 'create_buy_order',
      caller: UI_CALLER,
      expectedKeyword: 'server "trading"',
    },
    {
      // 2026-07-12 修正：原用例误用 system.get_engine_config 作为 UI 拒绝场景，
      // 但 get_engine_config 实际注册于 scoring:v6，且 ui 角色按矩阵允许 get_*（权威单测已锁定），
      // 无法构成 UI 拒绝。改用 UI 不允许的 system.reset_database（Tool 级拒绝）作为真实拒绝场景。
      desc: 'UI 调用 system.reset_database（Tool 级拒绝）',
      server: 'system',
      tool: 'reset_database',
      caller: UI_CALLER,
      expectedKeyword: 'tool "reset_database"',
    },
    {
      desc: 'CI 调用 stockpool（Server 级拒绝）',
      server: 'stockpool',
      tool: 'list_pool_stocks',
      caller: CI_CALLER,
      expectedKeyword: 'server "stockpool"',
    },
    {
      desc: 'CI 调用 system.reset_database（Tool 级拒绝）',
      server: 'system',
      tool: 'reset_database',
      caller: CI_CALLER,
      expectedKeyword: 'tool "reset_database"',
    },
    {
      desc: 'UI 调用 stockpool.delete_stock（Tool 级拒绝）',
      server: 'stockpool',
      tool: 'delete_stock',
      caller: UI_CALLER,
      expectedKeyword: 'tool "delete_stock"',
    },
    {
      desc: '未知角色 guest 调用（角色级拒绝）',
      server: 'fetcher',
      tool: 'health_check',
      caller: UNKNOWN_CALLER,
      expectedKeyword: 'not registered',
    },
  ]

  for (const { desc, server, tool, caller, expectedKeyword } of consistencyCases) {
    it(`${desc} — Client 与 Server 拒绝原因一致`, async () => {
      // 1. 走 Client 拦截链路
      const clientResult = await mcpBridge.callTool(
        server,
        tool,
        {},
        caller,
      )
      assertAclDenied(clientResult, expectedKeyword)

      // 2. 绕过 Client 直接调用 Server
      const entry = mcpRegistry.getServer(server)
      expect(entry).toBeDefined()
      const serverResult = await entry!.server.callTool(tool, {}, caller)
      assertAclDenied(serverResult, expectedKeyword)

      // 3. 验证两端返回的拒绝文本都包含相同关键字
      const clientText = clientResult.content[0].text ?? ''
      const serverText = serverResult.content[0].text ?? ''
      expect(clientText).toContain(expectedKeyword)
      expect(serverText).toContain(expectedKeyword)
    }, { timeout: 60000 })
  }
})

// ============================================================
// 套件 8: ACL_PERMISSION_DENIED 结构化格式验证（6 用例）
// ============================================================

describe('套件8: ACL_PERMISSION_DENIED 结构化格式验证', () => {
  it('拒绝结果应包含 isError=true 标志', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'create_buy_order',
      {},
      UI_CALLER,
    )
    expect(result.isError).toBe(true)
  }, { timeout: 60000 })

  it('拒绝结果 content 应为单条 text 类型', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'create_buy_order',
      {},
      UI_CALLER,
    )
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
  }, { timeout: 60000 })

  it('拒绝文本应以 ACL_PERMISSION_DENIED: 前缀开头', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'create_buy_order',
      {},
      UI_CALLER,
    )
    expect(result.content[0].text).toMatch(/^ACL_PERMISSION_DENIED:/)
  }, { timeout: 60000 })

  it('Server 级拒绝文本应包含 caller 和 server 信息', async () => {
    const result = await mcpBridge.callTool(
      'trading',
      'create_buy_order',
      {},
      UI_CALLER,
    )
    const text = result.content[0].text ?? ''
    expect(text).toContain('Caller "ui"')
    expect(text).toContain('server "trading"')
  }, { timeout: 60000 })

  it('Tool 级拒绝文本应包含 caller、server、tool 信息', async () => {
    const result = await mcpBridge.callTool(
      'stockpool',
      'delete_stock',
      {},
      UI_CALLER,
    )
    const text = result.content[0].text ?? ''
    expect(text).toContain('Caller "ui"')
    expect(text).toContain('server "stockpool"')
    expect(text).toContain('tool "delete_stock"')
  }, { timeout: 60000 })

  it('McpAclError 应携带 detail 结构化字段（assert 接口）', () => {
    // 直接调用 assert() 验证错误结构
    expect(() => {
      mcpAclInterceptor.assert({
        caller: 'ui',
        serverName: 'trading',
        resourceName: 'create_buy_order',
      })
    }).toThrow(McpAclError)

    try {
      mcpAclInterceptor.assert({
        caller: 'ui',
        serverName: 'trading',
        resourceName: 'create_buy_order',
      })
      expect.unreachable('Should have thrown McpAclError')
    } catch (err) {
      expect(err).toBeInstanceOf(McpAclError)
      const aclError = err as McpAclError
      expect(aclError.detail.allowed).toBe(false)
      expect(aclError.detail.caller).toBe('ui')
      expect(aclError.detail.serverName).toBe('trading')
      expect(aclError.detail.resourceName).toBe('create_buy_order')
      expect(aclError.detail.reason).toContain('server "trading"')
    }
  })
})

// ============================================================
// 套件 9: 权限矩阵配置完整性验证（5 用例）
// ============================================================

describe('套件9: 权限矩阵配置完整性验证', () => {
  it('4 种角色应全部定义在 MCP_ACL_MATRIX 中', () => {
    expect(MCP_ACL_MATRIX.agent).toBeDefined()
    expect(MCP_ACL_MATRIX.ui).toBeDefined()
    expect(MCP_ACL_MATRIX.ci).toBeDefined()
    expect(MCP_ACL_MATRIX.system).toBeDefined()
  })

  it('agent 和 system 应为全权限（"*"）', () => {
    expect(MCP_ACL_MATRIX.agent.allowedServers).toContain('*')
    expect(MCP_ACL_MATRIX.agent.allowedTools).toContain('*')
    expect(MCP_ACL_MATRIX.system.allowedServers).toContain('*')
    expect(MCP_ACL_MATRIX.system.allowedTools).toContain('*')
  })

  it('ui 角色应禁止交易类 Server（trading/execution/trade）', () => {
    const uiServers = MCP_ACL_MATRIX.ui.allowedServers
    expect(uiServers).not.toContain('trading')
    expect(uiServers).not.toContain('execution')
    expect(uiServers).not.toContain('trade')
  })

  it('ci 角色应仅允许 system Server', () => {
    expect(MCP_ACL_MATRIX.ci.allowedServers).toEqual(['system'])
  })

  it('ci 角色 allowedTools 应仅包含 get_* 和 generate_migration_report', () => {
    const ciTools = MCP_ACL_MATRIX.ci.allowedTools
    expect(ciTools).toContain('get_*')
    expect(ciTools).toContain('generate_migration_report')
    expect(ciTools.length).toBe(2)
  })
})
