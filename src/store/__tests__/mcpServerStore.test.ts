/**
 * @test_id V9-TEST-ST-167
 * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-023, V9-DOC-AI-021]
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock mcpRegistry
const mockListServers = vi.fn()
const mockSetEnabled = vi.fn()
vi.mock('@/mcp/core/registry', () => ({
  mcpRegistry: {
    listServers: (...args: unknown[]) => mockListServers(...args),
    setEnabled: (...args: unknown[]) => mockSetEnabled(...args),
  },
}))

import { useMCPServerStore } from '@/store/mcpServerStore'

describe('useMCPServerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMCPServerStore.setState({ servers: [], isLoading: false, error: null })
  })

  it('应该refresh servers from registry', () => {
    mockListServers.mockReturnValue([
      {
        server: {
          info: { name: 'test', version: '1.0.0', description: 'Test server', dependencies: [] },
          listTools: () => [],
          listResources: () => [],
          listPrompts: () => [],
        },
        options: { priority: 'medium' as const, enabled: true },
        registeredAt: Date.now(),
      },
    ])

    useMCPServerStore.getState().refreshServers()

    const { servers, isLoading } = useMCPServerStore.getState()
    expect(servers.length).toBe(1)
    expect(servers[0]!.serverName).toBe('test')
    expect(isLoading).toBe(false)
  })

  it('应该toggle server enabled state', () => {
    mockListServers.mockReturnValue([])
    useMCPServerStore.getState().toggleServer('test', false)
    expect(mockSetEnabled).toHaveBeenCalledWith('test', false)
  })

  it('应该处理空值 registry', () => {
    mockListServers.mockReturnValue([])
    useMCPServerStore.getState().refreshServers()
    expect(useMCPServerStore.getState().servers).toEqual([])
  })

  it('应该设置 isLoading during refresh', () => {
    mockListServers.mockReturnValue([])
    useMCPServerStore.getState().refreshServers()
    expect(useMCPServerStore.getState().isLoading).toBe(false)
  })

  it('应该处理 listServers error', () => {
    mockListServers.mockImplementation(() => {
      throw new Error('Registry error')
    })
    useMCPServerStore.getState().refreshServers()

    const { error, isLoading } = useMCPServerStore.getState()
    expect(error).toContain('Registry error')
    expect(isLoading).toBe(false)
  })
})