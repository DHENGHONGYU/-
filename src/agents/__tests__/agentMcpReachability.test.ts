/**
 * @test_id V9-TEST-ST-002
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-007, V9-DOC-AI-002, V9-DOC-AI-005]
 */
import { describe, it, expect } from 'vitest'
import { mcpRegistry } from '@/mcp/core/registry'
// 副作用导入：registerAllServers() 经由 Vite import.meta.glob 同步注册所有 enabled Server。
// 在 Vitest(jsdom) 环境下 import.meta.glob 可用，因此此处能拿到真实注册表。
import '@/mcp/register'

/**
 * Agent → MCP Server 运行时可达性冒烟测试
 *
 * 设计意图：每个运行时 Agent（DEFAULT_AGENTS）的 `mcpServerName` 必须精确解析到
 * MCPRegistry 中已注册的 Server（registry key = server.info.name，无模糊匹配）。
 * 若存在失配，agentRuntime.execute() 会在运行时返回 `Server not found`。
 *
 * 注意：为避免触发 `src/agents/index.ts` 模块底部的 `initAgentSystem()` 副作用
 * （自动初始化 + Store 订阅），此处 8 条绑定关系镜像自 DEFAULT_AGENTS，
 * 不作为单一事实源——单一事实源由 `scripts/audit-mcp.ts` 的静态 dangling-agent
 * 检测（checkAgentServerBindings）保证。本测试提供运行时可达性的实证。
 */
const AGENT_SERVER_BINDINGS: ReadonlyArray<{ id: string; mcpServerName: string }> = [
  { id: 'v6-scoring-agent', mcpServerName: 'scoring:v6' },
  { id: 'v4-industrial-agent', mcpServerName: 'scoring:v6' },
  { id: 'llm-intelligent-agent', mcpServerName: 'llm' },
  { id: 'fetcher-agent', mcpServerName: 'fetcher' },
  { id: 'news-analyzer-agent', mcpServerName: 'news' },
  { id: 'screening-agent', mcpServerName: 'screening' },
  { id: 'pool-agent', mcpServerName: 'pool' },
  { id: 'backtest-agent', mcpServerName: 'backtest' },
]

describe('Agent → MCP Server 运行时可达性', () => {
  it('应已注册全部 Agent 引用的 MCP Server（无悬空 Agent）', () => {
    const registered = mcpRegistry.listServers().map((rs) => rs.server.info.name)
    expect(registered.length).toBeGreaterThan(0)

    for (const { id, mcpServerName } of AGENT_SERVER_BINDINGS) {
      const entry = mcpRegistry.getServer(mcpServerName)
      expect(
        entry,
        `Agent "${id}" 引用的 MCP Server "${mcpServerName}" 未注册（悬空 Agent）→ 运行时将 Server not found`,
      ).toBeDefined()
      // 注册键必须等于 server.info.name（与 agentRuntime.ts:130 路由一致）
      expect(entry?.server.info.name).toBe(mcpServerName)
    }
  })

  it('已注册的 Server 必须启用且暴露工具', () => {
    for (const { id, mcpServerName } of AGENT_SERVER_BINDINGS) {
      const entry = mcpRegistry.getServer(mcpServerName)
      expect(entry?.options.enabled, `Agent "${id}" 的 Server "${mcpServerName}" 未启用`).not.toBe(false)
      expect(
        entry?.server.listTools().length ?? 0,
        `Agent "${id}" 的 Server "${mcpServerName}" 未暴露任何 Tool`,
      ).toBeGreaterThan(0)
    }
  })
})
