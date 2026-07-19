/**
 * @test_id V9-TEST-ST-054
 * @covers_docs [V9-DOC-BACK-013, V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-ARCH-008, V9-DOC-BACK-005]
 */
import { describe, it, expect } from 'vitest'
import { TradingServer } from '@/mcp/servers/trading/tradingServer'

describe('TradingServer', () => {
  const server = new TradingServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('trading')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
    expect(server.info.dependencies).toContain('scoring:v6')
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

  it('应该有 scan_signals tool', () => {
    const tool = server.listTools().find((t) => t.name === 'scan_signals')
    expect(tool).toBeDefined()
  })

  it('应该有 calculate_position tool（依赖 direction/price/portfolioValue）', () => {
    const tool = server.listTools().find((t) => t.name === 'calculate_position')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('direction')
    expect(tool!.inputSchema.required).toContain('price')
    expect(tool!.inputSchema.required).toContain('portfolioValue')
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
