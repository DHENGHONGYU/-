import { describe, it, expect } from 'vitest'
import { StockPoolServer } from '@/mcp/servers/stockpool/stockPoolServer'

describe('StockPoolServer', () => {
  const server = new StockPoolServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('stockpool')
    expect(server.info.version).toBe('1.0.0')
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

  it('应该有 list_pool_stocks tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'list_pool_stocks')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties!).toHaveProperty('status')
  })

  it('应该有 transition_stock tool（symbol/toStatus 必填）', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'transition_stock')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
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
    expect(uris).toContain('stockpool://stocks')
    expect(uris).toContain('stockpool://groups')
  })

  it('应该有 no prompts', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBe(0)
  })
})
