/**
 * @test_id V9-TEST-ST-039
 * @covers_docs [V9-DOC-PROJ-092, V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-022]
 */
import { describe, it, expect } from 'vitest'
import { DataFetcherServer } from '@/mcp/servers/fetcher/dataFetcherServer'

describe('DataFetcherServer', () => {
  const server = new DataFetcherServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('fetcher')
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

  it('应该有 fetch_stock_basic tool', () => {
    const tool = server.listTools().find((t) => t.name === 'fetch_stock_basic')
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
})
