import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock mcpBridge
const mockCallTool = vi.fn()
vi.mock('@/mcp/bridge', () => ({
  mcpBridge: {
    callTool: (...args: unknown[]) => mockCallTool(...args),
  },
}))

import { AgentRuntime } from '@/agents/agentRuntime'
import type { AgentConfig } from '@/agents/agentRuntime'

describe('AgentRuntime MCP Integration', () => {
  let runtime: AgentRuntime
  const mockConfig: AgentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'Test agent for MCP integration',
    defaultTimeout: 5000,
    maxConcurrent: 1,
    mcpServerName: 'test-server',
    defaultToolName: 'test_tool',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    runtime = new AgentRuntime()
    runtime.register(mockConfig)
  })

  it('should call mcpBridge.callTool with correct params', async () => {
    const mockResult = {
      content: [{ type: 'text' as const, text: 'success' }],
      isError: false,
    }
    mockCallTool.mockResolvedValue(mockResult)

    const task = await runtime.execute('test-agent', 'test_tool', { symbol: '000001' })

    expect(mockCallTool).toHaveBeenCalledWith('test-server', 'test_tool', { symbol: '000001' })
    expect(task.status).toBe('completed')
    expect(task.result).toBeDefined()
  })

  it('should handle MCP call errors', async () => {
    const mockResult = {
      content: [{ type: 'text' as const, text: 'Tool error' }],
      isError: true,
    }
    mockCallTool.mockResolvedValue(mockResult)

    const task = await runtime.execute('test-agent', 'test_tool', { symbol: 'invalid' })

    expect(task.status).toBe('failed')
    expect(task.error).toBeTruthy()
    expect(task.error).toContain('Tool error')
  })

  it('should handle timeout', async () => {
    mockCallTool.mockImplementation(() => new Promise((r) => setTimeout(r, 10000)))

    const task = await runtime.execute('test-agent', 'test_tool', {}, 100)

    expect(task.status).toBe('timeout')
    expect(task.error).toContain('timeout')
  }, 5000)

  it('should throw when agent not found', async () => {
    await expect(
      runtime.execute('unknown-agent', 'test_tool', {}),
    ).rejects.toThrow('Agent not found')
  })

  it('should use defaultToolName from config', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'ok' }],
      isError: false,
    })

    await runtime.execute('test-agent', 'different_type', {})

    expect(mockCallTool).toHaveBeenCalledWith('test-server', 'test_tool', {})
  })

  it('should use mcpServerName from config', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'ok' }],
      isError: false,
    })

    await runtime.execute('test-agent', 'test_tool', {})

    expect(mockCallTool).toHaveBeenCalledWith('test-server', 'test_tool', {})
  })
})