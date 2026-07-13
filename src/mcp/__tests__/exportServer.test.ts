import { describe, it, expect } from 'vitest'
import { ExportServer } from '@/mcp/servers/export/exportServer'

describe('ExportServer', () => {
  const server = new ExportServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('export')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('backtest')
  })

  it('应该register 1 tool', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(1)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 export_backtest_report tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'export_backtest_report')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('resultId')
    expect(tool!.inputSchema.required).toContain('format')
    expect(tool!.inputSchema.properties!.format!.enum).toEqual(['pdf', 'excel'])
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
