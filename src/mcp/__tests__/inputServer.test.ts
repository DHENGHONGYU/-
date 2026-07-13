import { describe, it, expect } from 'vitest'
import { InputServer } from '@/mcp/servers/input/inputServer'

describe('InputServer', () => {
  const server = new InputServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('input')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
  })

  it('应该register 6 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(6)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 add_stock tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'add_stock')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
    expect(tool!.inputSchema.required).toContain('name')
  })

  it('应该有 search_stocks tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'search_stocks')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('query')
  })

  it('应该有 add_stock_from_search tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'add_stock_from_search')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
  })

  it('应该有 list_input_stocks tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'list_input_stocks')
    expect(tool).toBeDefined()
  })

  it('应该有 export_stock_pool tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'export_stock_pool')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toHaveProperty('status')
  })

  it('应该有 import_stock_pool tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'import_stock_pool')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('payload')
  })

  it('应该有 no resources', () => {
    const resources = server.listResources()
    expect(resources.length).toBe(0)
  })

  it('应该有 no prompts', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBe(0)
  })
})
