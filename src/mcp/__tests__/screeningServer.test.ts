import { describe, it, expect } from 'vitest'
import { ScreeningServer } from '@/mcp/servers/screening/screeningServer'

describe('ScreeningServer', () => {
  const server = new ScreeningServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('screening')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
  })

  it('应该 register 2 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(2)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 run_screening tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'run_screening')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties!).toHaveProperty('limit')
  })

  it('应该有 screen_single tool（symbol 必填）', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'screen_single')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
  })

  it('应该有 2 resources', () => {
    const resources = server.listResources()
    expect(resources.length).toBe(2)
    const uris = resources.map((r) => r.uriTemplate)
    expect(uris).toContain('screening://stock/{symbol}')
    expect(uris).toContain('screening://all')
  })

  it('应该有 no prompts', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBe(0)
  })
})
