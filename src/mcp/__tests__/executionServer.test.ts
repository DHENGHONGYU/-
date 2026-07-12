import { describe, it, expect } from 'vitest'
import { ExecutionServer } from '@/mcp/servers/execution/executionServer'

describe('ExecutionServer', () => {
  const server = new ExecutionServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('execution')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('trading')
  })

  it('应该register 5 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(5)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 create_execution_plan tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'create_execution_plan')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
    expect(tool!.inputSchema.required).toContain('direction')
    expect(tool!.inputSchema.required).toContain('quantity')
    expect(tool!.inputSchema.required).toContain('price')
    // confidence 是可选参数，用于传递信号置信度
    expect(tool!.inputSchema.properties).toHaveProperty('confidence')
  })

  it('应该有 list_execution_plans tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'list_execution_plans')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toHaveProperty('symbol')
  })

  it('应该有 update_execution_phase tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'update_execution_phase')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('planId')
    expect(tool!.inputSchema.required).toContain('phase')
  })

  it('应该有 cancel_execution_plan tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'cancel_execution_plan')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('planId')
  })

  it('应该有 get_orphan_plans tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'get_orphan_plans')
    expect(tool).toBeDefined()
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
