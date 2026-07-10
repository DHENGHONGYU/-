import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  createAgentConfigManager,
  getAgentConfigManager,
  destroyAgentConfigManager,
} from '@/agents/agentConfigManager'
import type { AgentConfig } from '@/agents/agentRuntime'

const mockConfig: AgentConfig = {
  id: 'test-agent',
  name: '测试Agent',
  description: '用于测试',
  defaultTimeout: 5000,
  maxConcurrent: 3,
}

describe('AgentConfigManager', () => {
  beforeEach(() => {
    destroyAgentConfigManager()
  })

  afterEach(() => {
    destroyAgentConfigManager()
  })

  it('应该设置 and get default config', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)

    const result = manager.getDefault('test-agent')
    expect(result).toBeDefined()
    expect(result!.id).toBe('test-agent')
    expect(result!.defaultTimeout).toBe(5000)
  })

  it('应该返回 undefined for unset default', () => {
    const manager = createAgentConfigManager()
    expect(manager.getDefault('unknown')).toBeUndefined()
  })

  it('应该合并 base and override', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)
    manager.setOverride('test-agent', { defaultTimeout: 10000, maxConcurrent: 5 })

    const merged = manager.getMergedConfig('test-agent')
    expect(merged).toBeDefined()
    expect(merged!.merged.defaultTimeout).toBe(10000)
    expect(merged!.merged.maxConcurrent).toBe(5)
    expect(merged!.merged.name).toBe('测试Agent')
  })

  it('应该use base values when no override provided', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)

    const merged = manager.getMergedConfig('test-agent')
    expect(merged!.merged.defaultTimeout).toBe(5000)
    expect(merged!.merged.maxConcurrent).toBe(3)
    expect(merged!.merged.enabled).toBe(true)
  })

  it('应该返回 null when getting merged config without default', () => {
    const manager = createAgentConfigManager()
    expect(manager.getMergedConfig('unknown')).toBeNull()
  })

  it('应该更新 override incrementally', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)
    manager.setOverride('test-agent', { defaultTimeout: 8000 })
    manager.setOverride('test-agent', { maxConcurrent: 1 })

    const merged = manager.getMergedConfig('test-agent')
    expect(merged!.merged.defaultTimeout).toBe(8000)
    expect(merged!.merged.maxConcurrent).toBe(1)
  })

  it('应该合并 customMeta incrementally', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)
    manager.setOverride('test-agent', { customMeta: { key1: 'a' } })
    manager.setOverride('test-agent', { customMeta: { key2: 'b' } })

    const merged = manager.getMergedConfig('test-agent')
    expect(merged!.merged.customMeta).toEqual({ key1: 'a', key2: 'b' })
  })

  it('应该remove override', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)
    manager.setOverride('test-agent', { defaultTimeout: 9999 })
    expect(manager.removeOverride('test-agent')).toBe(true)

    const merged = manager.getMergedConfig('test-agent')
    expect(merged!.merged.defaultTimeout).toBe(5000)
  })

  it('应该返回 false when removing non-existent override', () => {
    const manager = createAgentConfigManager()
    expect(manager.removeOverride('unknown')).toBe(false)
  })

  it('应该验证 correct config', () => {
    const manager = createAgentConfigManager()
    const result = manager.validateConfig(mockConfig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('应该reject config with empty id', () => {
    const manager = createAgentConfigManager()
    const result = manager.validateConfig({ ...mockConfig, id: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('agentId is required')
  })

  it('应该reject config with zero timeout', () => {
    const manager = createAgentConfigManager()
    const result = manager.validateConfig({ ...mockConfig, defaultTimeout: 0 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('defaultTimeout must be greater than 0')
  })

  it('应该reject config with negative maxConcurrent', () => {
    const manager = createAgentConfigManager()
    const result = manager.validateConfig({ ...mockConfig, maxConcurrent: -1 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('maxConcurrent must be greater than 0')
  })

  it('应该返回 all snapshots', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('agent-a', mockConfig)
    manager.setDefault('agent-b', { ...mockConfig, id: 'agent-b', name: 'Agent B' })

    const snapshots = manager.getAllSnapshot()
    expect(snapshots).toHaveLength(2)
    expect(snapshots.map((s) => s.agentId)).toContain('agent-a')
    expect(snapshots.map((s) => s.agentId)).toContain('agent-b')
  })

  it('应该返回 stats', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('agent-a', mockConfig)
    manager.setOverride('agent-a', { enabled: false })

    const stats = manager.getStats()
    expect(stats.defaults).toBe(1)
    expect(stats.overrides).toBe(1)
  })

  it('应该是 singleton via getAgentConfigManager', () => {
    const m1 = getAgentConfigManager()
    const m2 = getAgentConfigManager()
    expect(m1).toBe(m2)
  })

  it('应该允许 disable via override', () => {
    const manager = createAgentConfigManager()
    manager.setDefault('test-agent', mockConfig)
    manager.setOverride('test-agent', { enabled: false })

    const merged = manager.getMergedConfig('test-agent')
    expect(merged!.merged.enabled).toBe(false)
  })
})
