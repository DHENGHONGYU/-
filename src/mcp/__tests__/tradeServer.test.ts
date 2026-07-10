import { describe, it, expect } from 'vitest'
import { TradeServer } from '@/mcp/servers/trade/tradeServer'

describe('TradeServer', () => {
  const server = new TradeServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('trade')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('trading')
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

  it('应该有 fetch_holdings tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'fetch_holdings')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties!).toHaveProperty('page')
    expect(tool!.inputSchema.properties!).toHaveProperty('pageSize')
    expect(tool!.inputSchema.properties!).toHaveProperty('keyword')
  })

  it('应该有 execute_trade_action tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'execute_trade_action')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('symbol')
    expect(tool!.inputSchema.required).toContain('action')
    expect(tool!.inputSchema.required).toContain('quantity')
    expect(tool!.inputSchema.required).toContain('price')
    expect(tool!.inputSchema.properties!.action!.enum).toEqual(['buy', 'sell'])
  })

  it('应该有 export_holdings_csv tool', () => {
    const tools = server.listTools()
    const tool = tools.find((t) => t.name === 'export_holdings_csv')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.properties).toHaveProperty('page')
    expect(tool!.inputSchema.properties).toHaveProperty('pageSize')
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
