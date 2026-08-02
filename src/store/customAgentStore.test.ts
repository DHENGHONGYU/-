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
    type: 'custom',
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

  // ============================================================
  // 补充：异常路径与默认错误消息（覆盖行 73-76, 94-97 及分支 52, 62, 84, 94）
  // ============================================================

  /** @test_id V9-TEST-ST-CA-01 */
  it('saveAgent: service 抛出 Error 异常时返回 false 并设置 error', async () => {
    mockSaveCustomAgent.mockRejectedValue(new Error('网络超时'))

    const result = await useCustomAgentStore.getState().saveAgent(createMockAgent())

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('网络超时')
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[useCustomAgentStore] saveAgent 异常',
      { error: '网络超时' },
    )
  })

  /** @test_id V9-TEST-ST-CA-02 */
  it('saveAgent: service 抛出非 Error 异常时转为字符串', async () => {
    mockSaveCustomAgent.mockRejectedValue('字符串异常')

    const result = await useCustomAgentStore.getState().saveAgent(createMockAgent())

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('字符串异常')
  })

  /** @test_id V9-TEST-ST-CA-03 */
  it('saveAgent: result.success=false 且无 error 字段时使用默认错误消息', async () => {
    mockSaveCustomAgent.mockResolvedValue({ success: false })

    const result = await useCustomAgentStore.getState().saveAgent(createMockAgent())

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('保存自定义智能体失败')
  })

  /** @test_id V9-TEST-ST-CA-04 */
  it('deleteAgent: service 抛出 Error 异常时返回 false 并设置 error', async () => {
    mockDeleteCustomAgent.mockRejectedValue(new Error('权限不足'))

    const result = await useCustomAgentStore.getState().deleteAgent('agent-001')

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('权限不足')
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[useCustomAgentStore] deleteAgent 异常',
      { id: 'agent-001', error: '权限不足' },
    )
  })

  /** @test_id V9-TEST-ST-CA-05 */
  it('deleteAgent: service 抛出非 Error 异常时转为字符串', async () => {
    mockDeleteCustomAgent.mockRejectedValue(42)

    const result = await useCustomAgentStore.getState().deleteAgent('agent-001')

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('42')
  })

  /** @test_id V9-TEST-ST-CA-06 */
  it('deleteAgent: result.success=false 且无 error 字段时使用默认错误消息', async () => {
    mockDeleteCustomAgent.mockResolvedValue({ success: false })

    const result = await useCustomAgentStore.getState().deleteAgent('agent-001')

    expect(result).toBe(false)
    expect(useCustomAgentStore.getState().error).toBe('删除自定义智能体失败')
  })

  /** @test_id V9-TEST-ST-CA-07 */
  it('loadAll: 非 Error 异常时转为字符串设置 error', async () => {
    mockLoadCustomAgents.mockRejectedValue('连接失败')

    await useCustomAgentStore.getState().loadAll()

    expect(useCustomAgentStore.getState().error).toBe('连接失败')
    expect(useCustomAgentStore.getState().loading).toBe(false)
  })
})
