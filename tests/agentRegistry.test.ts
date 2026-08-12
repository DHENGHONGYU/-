/**
 * @test_id V9-TEST-UT-003
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014]
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  createAgentRegistry,
  getAgentRegistry,
  destroyAgentRegistry,
} from '@/agents/agentRegistry'
import type { AgentConfig } from '@/agents/agentRuntime'

const mockAgent: AgentConfig = {
  id: 'test-agent',
  name: '测试Agent',
  description: '用于测试的Agent',
  defaultTimeout: 5000,
  maxConcurrent: 3,
}

const mockAgent2: AgentConfig = {
  id: 'test-agent-2',
  name: '测试Agent2',
  description: '第二个测试Agent',
  defaultTimeout: 3000,
  maxConcurrent: 1,
}

describe('AgentRegistry', () => {
  beforeEach(() => {
    destroyAgentRegistry()
  })

  afterEach(() => {
    destroyAgentRegistry()
  })

  it('应该register an agent', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent)
    expect(registry.has('test-agent')).toBe(true)
  })

  it('应该检索 registered agent', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent)
    const entry = registry.get('test-agent')
    expect(entry).toBeDefined()
    expect(entry?.config.id).toBe('test-agent')
    expect(entry?.config.name).toBe('测试Agent')
  })

  it('应该返回 undefined for unregistered agent', () => {
    const registry = createAgentRegistry()
    expect(registry.get('non-existent')).toBeUndefined()
  })

  it('应该unregister an agent', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent)
    expect(registry.unregister('test-agent')).toBe(true)
    expect(registry.has('test-agent')).toBe(false)
  })

  it('应该返回 false when unregistering non-existent agent', () => {
    const registry = createAgentRegistry()
    expect(registry.unregister('non-existent')).toBe(false)
  })

  it('应该list all registered agents', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent)
    registry.register(mockAgent2)
    const all = registry.getAll()
    expect(all).toHaveLength(2)
    expect(all.map((e) => e.config.id)).toContain('test-agent')
    expect(all.map((e) => e.config.id)).toContain('test-agent-2')
  })

  it('应该过滤 agents by tag', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent, ['analysis', 'news'])
    registry.register(mockAgent2, ['trading'])

    const analysisAgents = registry.getByTag('analysis')
    expect(analysisAgents).toHaveLength(1)
    expect(analysisAgents[0]!.config.id).toBe('test-agent')

    const tradingAgents = registry.getByTag('trading')
    expect(tradingAgents).toHaveLength(1)
    expect(tradingAgents[0]!.config.id).toBe('test-agent-2')

    const emptyAgents = registry.getByTag('non-existent-tag')
    expect(emptyAgents).toHaveLength(0)
  })

  it('应该返回 correct stats', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent, ['tag1'])
    registry.register(mockAgent2, ['tag2', 'tag3'])

    const stats = registry.getStats()
    expect(stats.total).toBe(2)
    expect(stats.tags).toBe(3)
    expect(stats.agentIds).toContain('test-agent')
    expect(stats.agentIds).toContain('test-agent-2')
  })

  it('应该更新 config when registering existing agent', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent)
    const updated: AgentConfig = { ...mockAgent, name: '更新后的名称' }
    registry.register(updated)

    const entry = registry.get('test-agent')
    expect(entry?.config.name).toBe('更新后的名称')
  })

  it('应该track instance count', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent)

    registry.incrementInstance('test-agent')
    registry.incrementInstance('test-agent')
    expect(registry.get('test-agent')!.instanceCount).toBe(2)

    registry.decrementInstance('test-agent')
    expect(registry.get('test-agent')!.instanceCount).toBe(1)

    registry.decrementInstance('test-agent')
    expect(registry.get('test-agent')!.instanceCount).toBe(0)

    // 不应低于 0
    registry.decrementInstance('test-agent')
    expect(registry.get('test-agent')!.instanceCount).toBe(0)
  })

  it('应该返回 existing instance from getAgentRegistry', () => {
    const registry1 = getAgentRegistry()
    const registry2 = getAgentRegistry()
    expect(registry1).toBe(registry2)
  })

  it('应该清除 tags when unregistering', () => {
    const registry = createAgentRegistry()
    registry.register(mockAgent, ['temp-tag'])
    registry.unregister('test-agent')
    expect(registry.getByTag('temp-tag')).toHaveLength(0)
  })
})
