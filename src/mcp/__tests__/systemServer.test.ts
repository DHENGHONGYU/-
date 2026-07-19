import { describe, it, expect } from 'vitest'
import { SystemServer } from '@/mcp/servers/system/systemServer'

describe('SystemServer', () => {
  const server = new SystemServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('system')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
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

  it('应该有 get_stats tool', () => {
    const tool = server.listTools().find((t) => t.name === 'get_stats')
    expect(tool).toBeDefined()
  })

  it('应该有 run_v6_migration tool（依赖 required json）', () => {
    const tool = server.listTools().find((t) => t.name === 'run_v6_migration')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('json')
  })

  it('应该 register at least 1 resource', () => {
    const resources = server.listResources()
    expect(resources.length).toBeGreaterThanOrEqual(1)
    for (const resource of resources) {
      expect(resource.uriTemplate).toBeTruthy()
      expect(resource.name).toBeTruthy()
    }
  })
})
