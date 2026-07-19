/**
 * @test_id V9-TEST-ST-045
 * @covers_docs [V9-DOC-DATA-024, V9-DOC-PROJ-108, V9-DOC-AI-005]
 */
import { describe, it, expect } from 'vitest'
import { PoolServer } from '@/mcp/servers/pool/poolServer'

describe('PoolServer', () => {
  const server = new PoolServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('pool')
    expect(server.info.version).toBe('2.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
  })

  it('应该 register 3 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(3)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 list_pool_items tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'list_pool_items')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties!).toHaveProperty('pool')
  })

  it('应该有 transition_pool_item tool（symbol/toPool/toStatus 必填）', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'transition_pool_item')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
    expect(tool!.inputSchema.required).toContain('toPool')
    expect(tool!.inputSchema.required).toContain('toStatus')
  })

  it('应该有 list_groups tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'list_groups')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toBeDefined()
  })

  it('应该有 2 resources', () => {
    const resources = server.listResources()
    expect(resources.length).toBe(2)
    const uris = resources.map((r) => r.uriTemplate)
    expect(uris).toContain('pool://items')
    expect(uris).toContain('pool://groups')
  })

  it('应该有 no prompts', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBe(0)
  })
})
