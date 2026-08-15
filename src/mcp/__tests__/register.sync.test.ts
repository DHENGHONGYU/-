/**
 * @test_id V9-TEST-ST-048
 * syncWithConfig 专项测试（F2/F3 整改验证）
 *
 * 验证：热更新按 modulePath（配置稳定身份）比对，而非 Server.info.name，
 * 避免配置 name（如 llm:main）与实例 info.name（如 llm）不一致导致误注销全部 Server。
  * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-023, V9-DOC-AI-021]
*/
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mcpRegistry } from '@/mcp/core/registry'
import { MCP_SERVER_REGISTRY } from '@/config/mcpServerRegistry'
import { ensureMCPRegistered, mcpReadyPromise, mcpFullyReadyPromise, syncWithConfig } from '@/mcp/register'
import type { MCPServer } from '@/types/modules/mcp.types'

const enabledConfigCount = MCP_SERVER_REGISTRY.filter((e) => e.enabled).length

describe('syncWithConfig (F2/F3): modulePath-based reconciliation', () => {
  beforeAll(async () => {
    // lazy 注册模式下需先异步加载模块缓存：core 与 lazy 两路注册并行，需同时等待
    ensureMCPRegistered()
    await Promise.all([mcpReadyPromise, mcpFullyReadyPromise])
  })

  afterAll(() => {
    for (const rs of mcpRegistry.listServers()) {
      mcpRegistry.unregister(rs.server.info.name)
    }
  })

  it('不误注销已注册的启用 Server（F2 根因复测）', () => {
    expect(mcpRegistry.listServers().length).toBe(enabledConfigCount)

    const result = syncWithConfig()

    // 关键：热更新后不应移除任何已启用 Server
    expect(result.removed).toEqual([])
    expect(result.mismatched).toEqual([])
    expect(mcpRegistry.listServers().length).toBe(enabledConfigCount)
  })

  it('对禁用 Server 的注册实例执行注销（modulePath 匹配）', () => {
    // 构造一个与禁用配置项（analysis, enabled:false）同 modulePath 的 Server 实例
    const analysisEntry = MCP_SERVER_REGISTRY.find((e) => e.modulePath.includes('/analysis/'))!
    expect(analysisEntry.enabled).toBe(false)

    const fakeServer: MCPServer = {
      info: { name: 'analysis', version: '0.0.0', description: 'fake for F2 test' },
      listTools: () => [],
      callTool: async () => ({ content: [], isError: false }),
      listResources: () => [],
      readResource: async () => ({ uri: '', mimeType: '', text: '' }),
      listPrompts: () => [],
      getPrompt: async () => [],
    }
    mcpRegistry.register(fakeServer, { priority: 'medium', modulePath: analysisEntry.modulePath })
    expect(mcpRegistry.getServer('analysis')).toBeDefined()

    const result = syncWithConfig()

    // analysis 在配置中为 disabled → 应被注销
    expect(mcpRegistry.getServer('analysis')).toBeUndefined()
    expect(result.removed).toContain(analysisEntry.modulePath)
    // 其余启用 Server 不受影响
    expect(mcpRegistry.listServers().length).toBe(enabledConfigCount)
  })
})
