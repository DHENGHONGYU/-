/**
 * @test_id V9-TEST-ST-036
 * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-023, V9-DOC-AI-021]
 */
import { describe, it, expect } from 'vitest'
import { DataCollectorServer } from '@/mcp/servers/data-collector/dataCollectorServer'

describe('DataCollectorServer', () => {
  const server = new DataCollectorServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('data-collector')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
  })

  it('应该register 3 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(3)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 fetch_market_data tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'fetch_market_data')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
    expect(tool!.inputSchema.properties).toHaveProperty('days')
  })

  it('应该有 build_collection_report tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'build_collection_report')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toHaveProperty('traceSpans')
    expect(tool!.inputSchema.properties).toHaveProperty('taskStatuses')
  })

  it('应该有 detect_missing_reports tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'detect_missing_reports')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toHaveProperty('symbol')
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
