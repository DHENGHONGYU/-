import { describe, it, expect } from 'vitest'
import {
  getAgentComponent,
  getAllAgentComponents,
  getAgentDetailComponent,
  hasAgentComponent,
} from './agentComponentRegistry'

describe('agentComponentRegistry', () => {
  describe('getAllAgentComponents', () => {
    it('返回所有已注册的 Agent 组件（共 5 个）', () => {
      const all = getAllAgentComponents()
      expect(all.length).toBe(5)
    })

    it('按 priority 降序排列', () => {
      const all = getAllAgentComponents()
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1]!.priority).toBeGreaterThanOrEqual(all[i]!.priority)
      }
    })

    it('包含 5 个预定义 Agent', () => {
      const all = getAllAgentComponents()
      const ids = all.map((a) => a.agentId)
      expect(ids).toContain('v6-scoring-agent')
      expect(ids).toContain('v4-industrial-agent')
      expect(ids).toContain('llm-intelligent-agent')
      expect(ids).toContain('fetcher-agent')
      expect(ids).toContain('news-analyzer-agent')
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
})
