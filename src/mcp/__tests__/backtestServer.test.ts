import { describe, it, expect } from 'vitest'
import { BacktestServer } from '@/mcp/servers/backtest/backtestServer'

describe('BacktestServer', () => {
  const server = new BacktestServer()

  it('应该有 correct server info', () => {
    expect(server.info.name).toBe('backtest')
    expect(server.info.version).toBe('1.0.0')
    expect(server.info.description).toBeTruthy()
    expect(server.info.dependencies).toContain('fetcher')
  })

  it('应该register at least 1 tool', () => {
    const tools = server.listTools()
    expect(tools.length).toBeGreaterThanOrEqual(1)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('应该有 run_backtest tool', () => {
    const tool = server.listTools().find((t) => t.name === 'run_backtest')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toBeTruthy()
  })

  it('应该register at least 1 resource', () => {
    const resources = server.listResources()
    expect(resources.length).toBeGreaterThanOrEqual(1)
    for (const resource of resources) {
      expect(resource.uriTemplate).toBeTruthy()
      expect(resource.name).toBeTruthy()
    }
  })
})