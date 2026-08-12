/**
 * @test_id V9-TEST-ST-052
 * MCP Server 集成测试
 *
 * 测试范围：
 * 1. V6ScoringServer — Tool/Resource/Prompt 通过 MCPServerBase 接口
 * 2. DataFetcherServer — Tool/Resource 通过 MCPServerBase 接口
 * 3. TradingServer — Tool/Resource/Prompt 通过 MCPServerBase 接口
 * 4. MCPBridge — 便捷调用方法
 * 5. 注册入口 — registerAllServers
 *
 * @module mcp/__tests__/servers.test.ts
 * @created 2026-07-04 - Phase 1 MCP Server 集成测试
  * @covers_docs [V9-DOC-PROJ-113, V9-DOC-BACK-005, V9-DOC-BACK-008, V9-DOC-PROJ-066]
*/

import { describe, it, expect, beforeEach } from 'vitest'
import { V6ScoringServer } from '../servers/scoring/v6ScoringServer'
import { DataFetcherServer } from '../servers/fetcher/dataFetcherServer'
import { TradingServer } from '../servers/trading/tradingServer'
import { MCPBridge } from '../bridge/mcpBridge'

// 触发全局注册（确保 register.ts 中的 Server 已注册到全局单例）
import '../register'

// ============================================================
// V6ScoringServer 测试
// ============================================================

describe('V6ScoringServer', () => {
  let server: V6ScoringServer

  beforeEach(() => {
    server = new V6ScoringServer()
  })

  describe('info', () => {
    it('应返回正确的 Server 信息', () => {
      expect(server.info.name).toBe('scoring:v6')
      expect(server.info.version).toBe('1.0.0')
      expect(server.info.dependencies).toContain('fetcher')
    })
  })

  describe('listTools', () => {
    it('应返回 6 个 Tool', () => {
      const tools = server.listTools()
      expect(tools).toHaveLength(6)
      const names = tools.map((t) => t.name)
      expect(names).toContain('score_stock')
      expect(names).toContain('get_all_scores')
      expect(names).toContain('get_engine_config')
      expect(names).toContain('analyze_hot_sector')
      expect(names).toContain('detect_rotation')
      expect(names).toContain('analyze_value_pit')
    })

    it('每个 Tool 应有 description 和 inputSchema', () => {
      const tools = server.listTools()
      for (const tool of tools) {
        expect(tool.description).toBeTruthy()
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
      }
    })
  })

  describe('listResources', () => {
    it('应返回 3 个 Resource', () => {
      const resources = server.listResources()
      expect(resources).toHaveLength(3)
      const names = resources.map((r) => r.name)
      expect(names).toContain('v6_score')
      expect(names).toContain('all_v6_scores')
      expect(names).toContain('engine_config')
    })
  })

  describe('listPrompts', () => {
    it('应返回 2 个 Prompt', () => {
      const prompts = server.listPrompts()
      expect(prompts).toHaveLength(2)
      const names = prompts.map((p) => p.name)
      expect(names).toContain('stock_analysis')
      expect(names).toContain('hot_sector_analysis')
    })
  })
})

// ============================================================
// DataFetcherServer 测试
// ============================================================

describe('DataFetcherServer', () => {
  let server: DataFetcherServer

  beforeEach(() => {
    server = new DataFetcherServer()
  })

  describe('info', () => {
    it('应返回正确的 Server 信息', () => {
      expect(server.info.name).toBe('fetcher')
      expect(server.info.dependencies).toEqual([])
    })
  })

  describe('listTools', () => {
    it('应返回 5 个 Tool', () => {
      const tools = server.listTools()
      expect(tools).toHaveLength(5)
      const names = tools.map((t) => t.name)
      expect(names).toContain('fetch_stock_basic')
      expect(names).toContain('fetch_stocks_basic')
      expect(names).toContain('fetch_kline')
      expect(names).toContain('refresh_symbol')
      expect(names).toContain('test_source_connectivity')
    })
  })

  describe('listResources', () => {
    it('应返回 3 个 Resource', () => {
      const resources = server.listResources()
      expect(resources).toHaveLength(3)
      const names = resources.map((r) => r.name)
      expect(names).toContain('stock_basic')
      expect(names).toContain('stock_kline')
      expect(names).toContain('health_status')
    })
  })
})

// ============================================================
// TradingServer 测试
// ============================================================

describe('TradingServer', () => {
  let server: TradingServer

  beforeEach(() => {
    server = new TradingServer()
  })

  describe('info', () => {
    it('应返回正确的 Server 信息', () => {
      expect(server.info.name).toBe('trading')
      expect(server.info.dependencies).toContain('scoring:v6')
      expect(server.info.dependencies).toContain('fetcher')
    })
  })

  describe('listTools', () => {
    it('应返回 10 个 Tool', () => {
      const tools = server.listTools()
      expect(tools).toHaveLength(10)
      const names = tools.map((t) => t.name)
      expect(names).toContain('scan_signals')
      expect(names).toContain('advise_stock')
      expect(names).toContain('get_orders')
      expect(names).toContain('create_buy_order')
      expect(names).toContain('create_sell_order')
      expect(names).toContain('check_order_risk')
      expect(names).toContain('calculate_position')
      expect(names).toContain('get_strategy_snapshot')
      expect(names).toContain('generate_trade_review')
      expect(names).toContain('generate_mock_trading_data')
    })

    it('check_order_risk 应有 5 个必填参数', () => {
      const tools = server.listTools()
      const riskTool = tools.find((t) => t.name === 'check_order_risk')
      expect(riskTool?.inputSchema.required).toHaveLength(5)
    })
  })

  describe('listResources', () => {
    it('应返回 3 个 Resource', () => {
      const resources = server.listResources()
      expect(resources).toHaveLength(3)
      const names = resources.map((r) => r.name)
      expect(names).toContain('orders')
      expect(names).toContain('latest_snapshot')
      expect(names).toContain('watchlist_signals')
    })
  })

  describe('listPrompts', () => {
    it('应返回 2 个 Prompt', () => {
      const prompts = server.listPrompts()
      expect(prompts).toHaveLength(2)
      const names = prompts.map((p) => p.name)
      expect(names).toContain('trade_review')
      expect(names).toContain('trade_advice')
    })
  })
})

// ============================================================
// MCPBridge 集成测试
// ============================================================

describe('MCPBridge', () => {
  let bridge: MCPBridge

  beforeEach(() => {
    bridge = MCPBridge.getInstance()
  })

  describe('getClient', () => {
    it('应返回 MCPClient 实例', () => {
      const client = bridge.getClient()
      expect(client).toBeDefined()
      expect(typeof client.listAllTools).toBe('function')
      expect(typeof client.callTool).toBe('function')
      expect(typeof client.readResource).toBe('function')
    })
  })

  describe('getStats', () => {
    it('应返回注册统计信息', () => {
      const stats = bridge.getStats()
      // 全局单例 registry 在 register.ts 中已注册 3 个 Server
      expect(stats.totalServers).toBeGreaterThanOrEqual(3)
      expect(stats.totalTools).toBeGreaterThanOrEqual(20)
      expect(stats.enabledServers).toBe(stats.totalServers)
    })
  })
})