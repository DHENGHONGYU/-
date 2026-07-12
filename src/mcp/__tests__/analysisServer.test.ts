import { describe, it, expect } from 'vitest'
import { AnalysisServer } from '@/mcp/servers/analysis/analysisServer'

describe('AnalysisServer', () => {
  const server = new AnalysisServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('analysis')
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

  it('应该有 analyze_stock tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'analyze_stock')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
  })

  it('应该有 analyze_sector tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'analyze_sector')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toBeDefined()
  })

  it('应该有 screen_stocks tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'screen_stocks')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toBeDefined()
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