import { describe, it, expect, beforeEach } from 'vitest'
import { AgentConfigManager, getAgentConfigManager } from '@/agents/agentConfigManager'
import type { AgentConfig } from '@/agents/agentRuntime'

function makeValidConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    description: 'desc',
    defaultTimeout: 10000,
    maxConcurrent: 1,
    ...overrides,
  }
}

describe('AgentConfigManager.validateConfig', () => {
  let mgr: AgentConfigManager

  beforeEach(() => {
    mgr = new AgentConfigManager()
  })

  it('接受合法配置（含可选 mcp 字段省略）', () => {
    const { valid, errors } = mgr.validateConfig(makeValidConfig())
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('拒绝空 id / name', () => {
    expect(mgr.validateConfig(makeValidConfig({ id: '   ' })).valid).toBe(false)
    expect(mgr.validateConfig(makeValidConfig({ name: '' })).valid).toBe(false)
  })

  it('拒绝非正 timeout / maxConcurrent', () => {
    expect(mgr.validateConfig(makeValidConfig({ defaultTimeout: 0 })).valid).toBe(false)
    expect(mgr.validateConfig(makeValidConfig({ maxConcurrent: -1 })).valid).toBe(false)
  })

  it('mcpServerName 省略时通过（依赖 runAgent ?? agentId 回退）', () => {
    const { valid } = mgr.validateConfig(makeValidConfig({ mcpServerName: undefined }))
    expect(valid).toBe(true)
  })

  it('mcpServerName 提供空串时报错（防空串绕过 ?? 回退）', () => {
    const { valid, errors } = mgr.validateConfig(makeValidConfig({ mcpServerName: '' }))
    expect(valid).toBe(false)
    expect(errors).toContain('mcpServerName must not be empty if provided')
  })

  it('mcpServerName 提供纯空白时报错', () => {
    const { valid, errors } = mgr.validateConfig(makeValidConfig({ mcpServerName: '   ' }))
    expect(valid).toBe(false)
    expect(errors).toContain('mcpServerName must not be empty if provided')
  })

  it('defaultToolName 提供空串时报错', () => {
    const { valid, errors } = mgr.validateConfig(makeValidConfig({ defaultToolName: '' }))
    expect(valid).toBe(false)
    expect(errors).toContain('defaultToolName must not be empty if provided')
  })

  it('mcpServerName / defaultToolName 提供非空值时通过', () => {
    const { valid, errors } = mgr.validateConfig(
      makeValidConfig({ mcpServerName: 'fetcher', defaultToolName: 'fetchData' })
    )
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
  })
})

describe('AgentConfigManager 配置管理', () => {
  it('setDefault / getMergedConfig 合并正确', () => {
    const mgr = new AgentConfigManager()
    const cfg = makeValidConfig()
    mgr.setDefault('agent-1', cfg)
    const snapshot = mgr.getMergedConfig('agent-1')
    expect(snapshot).not.toBeNull()
    expect(snapshot!.merged.id).toBe('agent-1')
    expect(snapshot!.merged.enabled).toBe(true)
  })

  it('getMergedConfig 对未知 agent 返回 null', () => {
    const mgr = new AgentConfigManager()
    expect(mgr.getMergedConfig('nope')).toBeNull()
  })
})

describe('getAgentConfigManager 单例', () => {
  it('返回同一实例', () => {
    expect(getAgentConfigManager()).toBe(getAgentConfigManager())
  })
})
