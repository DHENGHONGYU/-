import { describe, it, expect } from 'vitest'
import { KnowledgeServer } from '@/mcp/servers/knowledge/knowledgeServer'

describe('KnowledgeServer', () => {
  const server = new KnowledgeServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('knowledge')
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

  it('应该有 query_knowledge tool', () => {
    const tool = server.listTools().find((t) => t.name === 'query_knowledge')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('query')
  })

  it('应该不注册 resource（仅 tool 模式）', () => {
    expect(server.listResources()).toEqual([])
  })
})
