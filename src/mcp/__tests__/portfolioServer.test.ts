import { describe, it, expect } from 'vitest'
import { PortfolioServer } from '@/mcp/servers/portfolio/portfolioServer'

describe('PortfolioServer', () => {
  const server = new PortfolioServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('portfolio')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('scoring:v6')
  })

  it('应该register at least 3 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBeGreaterThanOrEqual(3)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 add_holding tool', () => {
    const tool = server.listTools().find((t) => t.name === 'add_holding')
    expect(tool).toBeDefined()
  })

  it('应该有 remove_holding tool', () => {
    const tool = server.listTools().find((t) => t.name === 'remove_holding')
    expect(tool).toBeDefined()
  })

  it('应该有 list_by_theme tool', () => {
    const tool = server.listTools().find((t) => t.name === 'list_by_theme')
    expect(tool).toBeDefined()
  })

  it('应该register at least 1 resource', () => {
    const resources = server.listResources()
    expect(resources.length).toBeGreaterThanOrEqual(1)
    for (const resource of resources) {
      expect(resource.uriTemplate).toBeTruthy()
      expect(resource.name).toBeTruthy()
    }
  })

  it('应该register at least 1 prompt', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBeGreaterThanOrEqual(1)
  })
})