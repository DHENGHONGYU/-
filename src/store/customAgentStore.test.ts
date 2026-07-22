/**
 * @test_id V9-TEST-ST-???
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { CustomAgent } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
const mockLoadCustomAgents = vi.hoisted(() => vi.fn())
const mockSaveCustomAgent = vi.hoisted(() => vi.fn())
const mockDeleteCustomAgent = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/services/system/customAgentService', () => ({
  loadCustomAgents: (...args: unknown[]) => mockLoadCustomAgents(...args),
  saveCustomAgent: (...args: unknown[]) => mockSaveCustomAgent(...args),
  deleteCustomAgent: (...args: unknown[]) => mockDeleteCustomAgent(...args),
}))

// ============================================================
// Imports
// ============================================================

import { useCustomAgentStore } from './customAgentStore'

// ============================================================
// Helpers
// ============================================================

function createMockAgent(overrides: Partial<CustomAgent> = {}): CustomAgent {
  return {
    id: 'agent-001',
    name: '测试智能体',
    description: '测试用途',
    type: 'general',
    model: 'gpt-4',
    systemPrompt: '你是测试助手',
    temperature: 0.7,
    maxTokens: 2048,
    capabilities: ['chat'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  }
}

describe('useCustomAgentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCustomAgentStore.getState().reset()
  })

  it('初始状态验证', () => {
    const state = useCustomAgentStore.getState()
    expect(state.agents).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadAll: 成功加载智能体列表', async () => {
    const agents = [createMockAgent({ id: '1' }), createMockAgent({ id: '2' })]
    mockLoadCustomAgents.mockResolvedValue(agents)

    await useCustomAgentStore.getState().loadAll()

    expect(mockLoadCustomAgents).toHaveBeenCalledTimes(1)
    expect(useCustomAgentStore.getState().agents).toHaveLength(2)
    expect(useCustomAgentStore.getState().loading).toBe(false)
    expect(useCustomAgentStore.getState().error).toBeNull()
  })

  it('loadAll: 加载失败时设置 error', async () => {
    mockLoadCustomAgents.mockRejectedValue(new Error('加载失败'))

    await useCustomAgentStore.getState().loadAll()

    expect(useCustomAgentStore.getState().loading).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('加载失败')
  })

  it('saveAgent: 保存成功后刷新列表', async () => {
    const agent = createMockAgent({ id: 'new-1' })
    mockSaveCustomAgent.mockResolvedValue({ success: true })
    mockLoadCustomAgents.mockResolvedValue([agent])

    const result = await useCustomAgentStore.getState().saveAgent(agent)

    expect(result).toBe(true)
    expect(mockSaveCustomAgent).toHaveBeenCalledWith(agent)
    expect(mockLoadCustomAgents).toHaveBeenCalled()
    expect(useCustomAgentStore.getState().agents).toHaveLength(1)
    expect(useCustomAgentStore.getState().error).toBeNull()
  })

  it('saveAgent: 保存失败时返回 false 并设置 error', async () => {
    const agent = createMockAgent()
    mockSaveCustomAgent.mockResolvedValue({ success: false, error: '名称重复' })

    const result = await useCustomAgentStore.getState().saveAgent(agent)

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('名称重复')
  })

  it('deleteAgent: 删除成功后刷新列表', async () => {
    mockDeleteCustomAgent.mockResolvedValue({ success: true })
    mockLoadCustomAgents.mockResolvedValue([])

    const result = await useCustomAgentStore.getState().deleteAgent('agent-001')

    expect(result).toBe(true)
    expect(mockDeleteCustomAgent).toHaveBeenCalledWith('agent-001')
    expect(useCustomAgentStore.getState().agents).toEqual([])
  })

  it('deleteAgent: 删除失败时返回 false', async () => {
    mockDeleteCustomAgent.mockResolvedValue({ success: false, error: '不存在' })

    const result = await useCustomAgentStore.getState().deleteAgent('non-existent')

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('不存在')
  })

  it('reset: 重置到初始状态', () => {
    useCustomAgentStore.setState({
      loading: true,
      error: 'some error',
      agents: [createMockAgent()],
    })

    useCustomAgentStore.getState().reset()

    const state = useCustomAgentStore.getState()
    expect(state.agents).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })
})
