import { describe, it, expect } from 'vitest'
import {
  getAgentComponent,
  getAllAgentComponents,
  getAgentDetailComponent,
  hasAgentComponent,
} from '../agentComponentRegistry'

describe('agentComponentRegistry', () => {
  describe('getAllAgentComponents', () => {
    it('返回所有已注册的 Agent 组件（共 8 个）', () => {
      const all = getAllAgentComponents()
      expect(all.length).toBe(8)
    })

    it('按 priority 降序排列', () => {
      const all = getAllAgentComponents()
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1]!.priority).toBeGreaterThanOrEqual(all[i]!.priority)
      }
    })

    it('包含 7 个预定义 Agent', () => {
      const all = getAllAgentComponents()
      const ids = all.map((a) => a.agentId)
      expect(ids).toContain('v6-scoring-agent')
      expect(ids).toContain('v4-industrial-agent')
      expect(ids).toContain('llm-intelligent-agent')
      expect(ids).toContain('fetcher-agent')
      expect(ids).toContain('news-analyzer-agent')
      expect(ids).toContain('screening-agent')
      expect(ids).toContain('pool-agent')
    })
  })

  describe('hasAgentComponent', () => {
    it('已注册的 Agent 返回 true', () => {
      expect(hasAgentComponent('v6-scoring-agent')).toBe(true)
      expect(hasAgentComponent('fetcher-agent')).toBe(true)
    })

    it('未注册的 Agent 返回 false', () => {
      expect(hasAgentComponent('non-existent-agent')).toBe(false)
      expect(hasAgentComponent('')).toBe(false)
    })
  })

  describe('getAgentComponent', () => {
    it('返回正确的 Agent 配置', () => {
      const entry = getAgentComponent('v6-scoring-agent')
      expect(entry).toBeDefined()
      expect(entry?.agentId).toBe('v6-scoring-agent')
      expect(entry?.displayName).toBe('V6 评分智能体')
      expect(entry?.tags).toContain('system')
    })

    it('未注册的 Agent 返回 undefined', () => {
      expect(getAgentComponent('unknown')).toBeUndefined()
    })
  })

  describe('getAgentDetailComponent', () => {
    it('已注册的专用 Agent 返回对应组件', () => {
      const component = getAgentDetailComponent('v6-scoring-agent')
      expect(component).toBeDefined()
      expect(component).toBeTypeOf('function')
    })

    it('未注册的 Agent 返回通用组件', () => {
      const component = getAgentDetailComponent('some-unknown-agent')
      expect(component).toBeDefined()
    })
  })

  describe('键一致性契约（UI key ⊆ 运行时 Agent id）', () => {
    // 硬编码已知运行时 Agent id，避免导入 @/agents 触发 initAgentSystem 副作用。
    // 若未来 UI 注册表出现无法对应运行时 Agent 的 key（如曾经的 pool-inspector 错 key），
    // 本测试会立即失败，防止两系统连接契约被破坏。
    const RUNTIME_AGENT_IDS = [
      'v6-scoring-agent',
      'v4-industrial-agent',
      'llm-intelligent-agent',
      'fetcher-agent',
      'news-analyzer-agent',
      'screening-agent',
      'pool-agent',
      'backtest-agent',
    ]

    it('每个 UI 注册表 agentId 都能对应到运行时 Agent', () => {
      const uiIds = getAllAgentComponents().map((a) => a.agentId)
      for (const id of uiIds) {
        expect(RUNTIME_AGENT_IDS, `UI key "${id}" 未匹配任何运行时 Agent`).toContain(id)
      }
    })
  })
})
