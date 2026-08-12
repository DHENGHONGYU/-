/**
 * @test_id V9-TEST-ST-034
 * MCPClient 禁用守卫专项测试（F5 整改验证）
 *
 * 验证：对已注册但 disabled（enabled:false）的 Server 调用返回结构化错误，
 * 防止禁用 Server 被误调用。
  * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-023, V9-DOC-AI-021]
*/
import { describe, it, expect } from 'vitest'
import { MCPRegistry } from '@/mcp/core/registry'
import { MCPClientImpl } from '@/mcp/core/client'
import type { MCPServer } from '@/types/modules/mcp.types'

function makeServer(name: string): MCPServer {
  return {
    info: { name, version: '0.0.0', description: 'x' },
    listTools: () => [],
    callTool: async () => ({ content: [], isError: false }),
    listResources: () => [],
    readResource: async () => ({ uri: '', mimeType: '', text: '' }),
    listPrompts: () => [],
    getPrompt: async () => [],
  }
}

describe('MCPClient disabled-guard (F5)', () => {
  it('对已注册但 disabled 的 Server 返回 isError (Server disabled)', async () => {
    const registry = new MCPRegistry()
    registry.register(makeServer('svc'), { priority: 'high', enabled: false })
    const client = new MCPClientImpl(registry)

    const res = await client.callTool('svc', 'some_tool', {})
    expect(res.isError).toBe(true)
    expect(res.content[0]?.text).toContain('Server disabled')
  })

  it('对未注册 Server 返回 isError (Server not found)', async () => {
    const registry = new MCPRegistry()
    const client = new MCPClientImpl(registry)

    const res = await client.callTool('nope', 't', {})
    expect(res.isError).toBe(true)
    expect(res.content[0]?.text).toContain('Server not found')
  })

  it('对启用 Server 正常放行', async () => {
    const registry = new MCPRegistry()
    registry.register(makeServer('ok'), { priority: 'high' })
    const client = new MCPClientImpl(registry)

    const res = await client.callTool('ok', 't', {})
    expect(res.isError).toBe(false)
  })
})
