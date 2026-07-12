import { describe, it, expect } from 'vitest'
import { NewsServer } from '@/mcp/servers/news/newsServer'

describe('NewsServer', () => {
  const server = new NewsServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('news')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
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

  it('应该有 fetch_news tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'fetch_news')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
  })

  it('应该有 analyze_sentiment tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'analyze_sentiment')
    expect(tool).toBeDefined()
  })

  it('应该有 get_sentiment_trend tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'get_sentiment_trend')
    expect(tool).toBeDefined()
  })

  it('应该register at least 2 resources', () => {
    const resources = server.listResources()
    expect(resources.length).toBeGreaterThanOrEqual(2)
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