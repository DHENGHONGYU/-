/**
 * @test_id V9-TEST-UT-090
 * @fileoverview MCP Server 全链路集成测试
 *
 * @description
 * 验证当前启用 MCP Server 的注册完整性、工具调用冒烟、ACL 权限、
 * 关键链路端到端、工具调用幂等性。
 *
 * 注册契约（对齐 src/config/mcpServerRegistry.ts，2026-08-23 同步）：
 *   Registry 17 条目 = 13 enabled + 4 disabled（portfolio/knowledge/execution/workflow）；
 *   analysis:main 已于 2026-08-20 恢复启用；新增 marketdata:westock /
 *   marketdata:tencentnews 两个腾讯数据源 Server。
 *   注册走异步链路：ensureMCPRegistered() + await [mcpReadyPromise, mcpFullyReadyPromise]
 *   （核心链路与 lazy 链路并行，mcpFullyReadyPromise 单独等待会在核心 Server
 *   注册完成前过早 resolve，必须双 Promise 并等；同步版 registerAllServers()
 *   依赖模块缓存，测试冷启动下恒为空，禁用）。
 *
 * 测试结构（5 个套件，共 34 个用例）：
 *   套件1: 注册完整性验证（6 用例）
 *   套件2: 工具调用冒烟测试（18 用例）
 *   套件3: ACL 权限验证（4 用例）
 *   套件4: 关键链路端到端测试（4 用例）
 *   套件5: 工具调用幂等性（2 用例）
 *
 * @module tests/__tests__/integration/mcp-servers.integration.test
  * @covers_docs [V9-DOC-DATA-024, V9-DOC-BACK-011, V9-DOC-PROJ-108, V9-DOC-DATA-013]
*/

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { db, close } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { dataLayer } from '@/data/dataLayer'
import {
  STORE_NAME,
  MODULE_ID,
  DATA_SOURCE,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  ACL_MATRIX,
  DB_OPERATION,
} from '@/config/dbConfig'
import { RESEARCH_STATUS } from '@/constants/pool.constants'
import { mcpRegistry } from '@/mcp/core/registry'
import { ensureMCPRegistered, mcpReadyPromise, mcpFullyReadyPromise } from '@/mcp/register'

/**
 * 等待核心 + lazy 两条注册链路全部完成。
 *
 * 2026-08-23 语义修正后，mcpFullyReadyPromise 由 ensureMCPRegistered() 统一编排：
 * 仅当核心与非核心两条链路均完成才 resolve，单独 await 即可；此处保留 Promise.all
 * 双等待作为防御性写法（对两个信号均幂等）。
 */
async function waitForAllMcpServers(): Promise<void> {
  ensureMCPRegistered()
  await Promise.all([mcpReadyPromise, mcpFullyReadyPromise])
}

// ============================================================
// 期望的启用 MCP Server 名称（使用 info.name，非 MCP_SERVER_REGISTRY 的 name）
// 对齐 mcpServerRegistry.ts：13 enabled，含 analysis（2026-08-20 恢复）
// 与 marketdata:westock / marketdata:tencentnews（腾讯数据源）
// ============================================================

const EXPECTED_SERVER_NAMES: string[] = [
  'fetcher', 'scoring:v6', 'trading', 'analysis', 'news', 'llm',
  'screening', 'backtest', 'pool', 'system', 'data-collector',
  'marketdata:westock', 'marketdata:tencentnews',
]

// ============================================================
// 辅助函数
// ============================================================

/** 测试用标准 A 股 symbol（对齐 isValidSymbolWithExchange 契约：6位数字+.SH/.SZ/.BJ） */
const TEST_SYMBOL = '600519.SH'

/**
 * 添加测试股票到 stocks store（默认贵州茅台 600519.SH）
 */
async function addTestStock(symbol = TEST_SYMBOL, name = '测试股票'): Promise<void> {
  await dataLayer.stocks.add({
    symbol,
    name,
    researchStatus: RESEARCH_STATUS.candidate,
    source: DATA_SOURCE.manual,
  })
}

/**
 * 调用 MCP 工具并解析返回的 JSON
 *
 * @param serverName - Server 的 info.name
 * @param toolName - 工具名称
 * @param args - 工具参数
 * @returns 解析后的 JSON 结果
 */
async function callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const server = mcpRegistry.listServers().find(s => s.server.info.name === serverName)?.server
  if (!server) throw new Error(`Server ${serverName} not found`)
  const tools = server.listTools()
  const tool = tools.find(t => t.name === toolName)
  if (!tool) throw new Error(`Tool ${toolName} not found on server ${serverName}`)
  const result = await tool.handler(args)
  const text = result.content?.[0]?.text
  return text ? JSON.parse(text) : result
}

// ============================================================
// 文件最外层 afterAll：关闭 db 连接并重置单例
//
// close() 关闭底层 IDBDatabase 连接 + 重置 _isReady + resetDbInstance()，
// 确保在同一进程中串行运行多个测试文件时 db 状态完全隔离。
// ============================================================

afterAll(() => {
  close()
})

// ============================================================
// 套件 1: 注册完整性验证（6 用例）
// ============================================================

describe('套件1: MCP Server 注册完整性验证', () => {
  beforeAll(async () => {
    // 异步注册链路：核心 + lazy Server 全量就绪后再断言（幂等守卫，可重复调用）
    await waitForAllMcpServers()
  })

  it('应注册所有启用的 MCP Server（13 个）', () => {
    const servers = mcpRegistry.listServers()
    const registeredNames = servers.map(s => s.server.info.name)
    for (const name of EXPECTED_SERVER_NAMES) {
      expect(registeredNames).toContain(name)
    }
    expect(registeredNames.length).toBeGreaterThanOrEqual(EXPECTED_SERVER_NAMES.length)
  }, { timeout: 60000 })

  it('所有 Server 应实现 MCPServer 接口（有 info 和 listTools）', () => {
    const servers = mcpRegistry.listServers()
    expect(servers.length).toBeGreaterThan(0)
    for (const rs of servers) {
      expect(rs.server.info).toBeDefined()
      expect(typeof rs.server.listTools).toBe('function')
    }
  }, { timeout: 60000 })

  it('所有 Server 应暴露 listTools() 方法', () => {
    const servers = mcpRegistry.listServers()
    for (const rs of servers) {
      const tools = rs.server.listTools()
      expect(Array.isArray(tools)).toBe(true)
    }
  }, { timeout: 60000 })

  it('所有 Server 的 info 应包含 name/version', () => {
    const servers = mcpRegistry.listServers()
    for (const rs of servers) {
      expect(rs.server.info.name).toBeTruthy()
      expect(rs.server.info.version).toBeTruthy()
    }
  }, { timeout: 60000 })

  it('所有 Server 的 tools 应为非空数组', () => {
    const servers = mcpRegistry.listServers()
    for (const rs of servers) {
      const tools = rs.server.listTools()
      expect(tools.length).toBeGreaterThan(0)
    }
  }, { timeout: 60000 })

  it('Server 注册顺序应符合配置优先级', () => {
    const servers = mcpRegistry.listServers()
    const priorities = servers.map(s => s.options.priority)
    // high (权重 0) 应排在 medium (权重 1) 之前
    const firstMediumIdx = priorities.findIndex(p => p === 'medium')
    const lastHighIdx = priorities.lastIndexOf('high')
    if (firstMediumIdx !== -1 && lastHighIdx !== -1) {
      expect(lastHighIdx).toBeLessThan(firstMediumIdx)
    }
  }, { timeout: 60000 })
})

// ============================================================
// 套件 2: 工具调用冒烟测试（17 用例）
// ============================================================

describe('套件2: MCP 工具调用冒烟测试', () => {
  beforeAll(async () => {
    await waitForAllMcpServers()
    await db.init()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
  })

  it('fetcher: test_source_connectivity 应返回连通性结果', async () => {
    const result = await callTool('fetcher', 'test_source_connectivity', { source: 'mock' })
    expect(result).toHaveProperty('ok')
  }, { timeout: 60000 })

  it('scoring:v6: get_engine_config 应返回引擎配置', async () => {
    const result = await callTool('scoring:v6', 'get_engine_config')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('scoring:v6: get_all_scores 应返回评分列表', async () => {
    const result = await callTool('scoring:v6', 'get_all_scores')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('trading: get_orders 应返回订单列表', async () => {
    const result = await callTool('trading', 'get_orders')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  // analysis Server 已于 2026-08-20 恢复启用（IndustryDashboardPage / IndustryScorePage 依赖）
  it('analysis: list_tools 应返回分析工具清单', async () => {
    const server = mcpRegistry.listServers().find(s => s.server.info.name === 'analysis')?.server
    expect(server).toBeDefined()
    const tools = server!.listTools()
    expect(tools.length).toBeGreaterThan(0)
  }, { timeout: 60000 })

  it('news: fetch_news 应返回新闻数据', async () => {
    const result = await callTool('news', 'fetch_news', { symbol: TEST_SYMBOL })
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('llm: list_models 应返回模型配置', async () => {
    const result = await callTool('llm', 'list_models')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  // @status known-failing - portfolio Server 已禁用（零业务调用）
  it.skip('portfolio: list_by_theme 应返回组合列表', async () => {
    const result = await callTool('portfolio', 'list_by_theme', { theme: '科技' })
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('screening: run_screening 应返回筛选结果', async () => {
    const result = await callTool('screening', 'run_screening')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('backtest: run_backtest 应返回回测结果', async () => {
    const result = await callTool('backtest', 'run_backtest', {
      symbol: TEST_SYMBOL,
      startDate: '2024-01-01',
      endDate: '2024-06-30',
    })
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('marketdata:westock: check_health 应返回健康状态', async () => {
    const result = await callTool('marketdata:westock', 'check_health')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('marketdata:tencentnews: check_health 应返回健康状态', async () => {
    const result = await callTool('marketdata:tencentnews', 'check_health')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('pool: list_pool_items 应返回股票列表', async () => {
    const result = await callTool('pool', 'list_pool_items')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('pool: list_groups 应返回分组列表', async () => {
    const result = await callTool('pool', 'list_groups')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('pool: transition_pool_item 应返回状态变更结果', async () => {
    const result = await callTool('pool', 'transition_pool_item', {
      symbol: TEST_SYMBOL,
      toPool: 'research',
      toStatus: 'screened',
    })
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('system: get_stats 应返回系统统计', async () => {
    const result = await callTool('system', 'get_stats')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('data-collector: detect_missing_reports 应返回缺失报告列表', async () => {
    const result = await callTool('data-collector', 'detect_missing_reports')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  // @status known-failing - execution Server 已禁用（零业务调用）
  it.skip('execution: list_execution_plans 应返回执行计划列表', async () => {
    const result = await callTool('execution', 'list_execution_plans')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  // @status known-failing - export Server 已移除，功能降级为纯 Service
  it.skip('export: export_backtest_report 应返回导出结果', async () => {
    const result = await callTool('export', 'export_backtest_report', {
      resultId: 'test-result-001',
      format: 'pdf',
    })
    expect(result).toBeDefined()
  }, { timeout: 60000 })
})

// ============================================================
// 套件 3: ACL 权限验证（4 用例）
// ============================================================

describe('套件3: ACL 权限验证', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    await addTestStock()
  })

  it('ACL_MATRIX 中 pool 的 actions 应包含 SELECT/INSERT/UPDATE/DELETE', () => {
    const poolAcl = ACL_MATRIX[MODULE_ID.pool]
    expect(poolAcl.actions).toContain(DB_OPERATION.select)
    expect(poolAcl.actions).toContain(DB_OPERATION.insert)
    expect(poolAcl.actions).toContain(DB_OPERATION.update)
    expect(poolAcl.actions).toContain(DB_OPERATION.delete)
  }, { timeout: 60000 })

  it('pool 应能通过 DataBridge.query 查询 stocks store', async () => {
    const result = await dataBridge.query({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.pool,
    })
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
  }, { timeout: 60000 })

  it('pool 应能通过 DataBridge.query 按 key 查询 stocks store', async () => {
    const result = await dataBridge.query({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_SYMBOL,
      source: MODULE_ID.pool,
    })
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  }, { timeout: 60000 })

  it('pool 应能通过 DataBridge.forward 更新 stocks store', async () => {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.pool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: 'test-acl-update-stock',
        timestamp: Date.now(),
      },
      payload: {
        symbol: TEST_SYMBOL,
        researchStatus: RESEARCH_STATUS.screened,
        updatedAt: Date.now(),
      },
    })
    // 验证更新结果
    dataBridge.invalidateCache(STORE_NAME.stocks)
    const result = await dataBridge.query({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_SYMBOL,
      source: MODULE_ID.pool,
    })
    expect(result.success).toBe(true)
  }, { timeout: 60000 })
})

// ============================================================
// 套件 4: 关键链路端到端测试（4 用例）
// ============================================================

describe('套件4: 关键链路端到端测试', () => {
  beforeAll(async () => {
    await db.init()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
  })

  it('fetcher MCP 工具 test_source_connectivity → 返回 ok 字段', async () => {
    const result = await callTool('fetcher', 'test_source_connectivity', { source: 'mock' })
    expect(result).toHaveProperty('ok')
  }, { timeout: 60000 })

  it('pool MCP 工具 list_pool_items → 应返回股票列表', async () => {
    const result = await callTool('pool', 'list_pool_items')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('scoring:v6 MCP 工具 get_all_scores → 应返回评分列表', async () => {
    const result = await callTool('scoring:v6', 'get_all_scores')
    expect(result).toBeDefined()
  }, { timeout: 60000 })

  it('DataBridge 完整写入链路：forward(INSERT_STOCK) → query(QUERY_LIST) → 数据一致', async () => {
    // 标准 A 股格式（对齐 isValidSymbolWithExchange 契约）
    const symbol = '000001.SZ'
    // 写入
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.pool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.insertStock,
        traceId: 'test-e2e-insert-stock',
        timestamp: Date.now(),
      },
      payload: {
        symbol,
        name: '端到端测试股票',
        researchStatus: RESEARCH_STATUS.candidate,
        source: DATA_SOURCE.manual,
        group: '默认分组',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
    // 清除缓存后查询
    dataBridge.invalidateCache(STORE_NAME.stocks)
    const result = await dataBridge.query({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.pool,
    })
    expect(result.success).toBe(true)
    const stocks = result.data as Array<{ symbol: string; name: string }>
    const found = stocks.find(s => s.symbol === symbol)
    expect(found).toBeDefined()
    expect(found?.name).toBe('端到端测试股票')
  }, { timeout: 60000 })
})

// ============================================================
// 套件 5: 工具调用幂等性（2 用例）
// ============================================================

describe('套件5: 工具调用幂等性', () => {
  beforeAll(async () => {
    await db.init()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
  })

  it('连续两次调用同一工具应返回一致结果', async () => {
    const result1 = await callTool('llm', 'list_models')
    const result2 = await callTool('llm', 'list_models')
    expect(result1).toEqual(result2)
  }, { timeout: 60000 })

  it('工具调用不应产生副作用累积', async () => {
    const before = await callTool('pool', 'list_pool_items') as unknown[]
    const beforeCount = Array.isArray(before) ? before.length : 0
    // 连续调用多次读操作
    await callTool('pool', 'list_pool_items')
    await callTool('pool', 'list_pool_items')
    const after = await callTool('pool', 'list_pool_items') as unknown[]
    const afterCount = Array.isArray(after) ? after.length : 0
    expect(afterCount).toBe(beforeCount)
  }, { timeout: 60000 })
})
