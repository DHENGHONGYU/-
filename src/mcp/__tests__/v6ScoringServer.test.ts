import { describe, it, expect } from 'vitest'
import { V6ScoringServer } from '@/mcp/servers/scoring/v6ScoringServer'

describe('V6ScoringServer', () => {
  const server = new V6ScoringServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('scoring:v6')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
  })

  it('应该 register at least 1 tool', () => {
    const tools = server.listTools()
    expect(tools.length).toBeGreaterThanOrEqual(1)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 score_stock tool（依赖 symbol）', () => {
    const tool = server.listTools().find((t) => t.name === 'score_stock')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
  })

  it('应该 register at least 1 resource', () => {
    const resources = server.listResources()
    expect(resources.length).toBeGreaterThanOrEqual(1)
    for (const resource of resources) {
      expect(resource.uriTemplate).toBeTruthy()
      expect(resource.name).toBeTruthy()
    }
  })

  it('应该 register at least 1 prompt', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBeGreaterThanOrEqual(1)
    for (const prompt of prompts) {
      expect(prompt.name).toBeTruthy()
      expect(prompt.description).toBeTruthy()
    }
  })
})
