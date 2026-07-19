/**
 * @test_id V9-TEST-ST-041
 * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-021, V9-DOC-AI-022]
 */
import { describe, it, expect } from 'vitest'
import { LLMServer } from '@/mcp/servers/llm/llmServer'

describe('LLMServer', () => {
  const server = new LLMServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('llm')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
  })

  it('应该register at least 4 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBeGreaterThanOrEqual(4)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 chat_completion tool', () => {
    const tool = server.listTools().find((t) => t.name === 'chat_completion')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('prompt')
  })

  it('应该有 analyze_with_context tool', () => {
    const tool = server.listTools().find((t) => t.name === 'analyze_with_context')
    expect(tool).toBeDefined()
  })

  it('应该有 list_models tool', () => {
    const tool = server.listTools().find((t) => t.name === 'list_models')
    expect(tool).toBeDefined()
  })

  it('应该有 get_model_config tool', () => {
    const tool = server.listTools().find((t) => t.name === 'get_model_config')
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

  it('应该register at least 2 prompts', () => {
    const prompts = server.listPrompts()
    expect(prompts.length).toBeGreaterThanOrEqual(2)
  })
})