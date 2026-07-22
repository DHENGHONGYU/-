/**
 * @test_id V9-TEST-ST-203
 * agentFeedbackStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. addFeedback 后 reset() 回到初始值
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

// ============================================================
// Imports
// ============================================================

import { useAgentFeedbackStore } from './agentFeedbackStore'
import type { AgentFeedback } from '@/types/modules/agent.types'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useAgentFeedbackStore.getState().reset()
})

// ============================================================
// useAgentFeedbackStore
// ============================================================

describe('useAgentFeedbackStore', () => {
  // ---------- 初始状态 ----------

  it('初始状态验证', () => {
    const state = useAgentFeedbackStore.getState()
    expect(state.feedbacks).toEqual([])
    expect(state.summaries.size).toBe(0)
    expect(state.isLoading).toBe(false)
  })

  // ---------- reset ----------

  it('addFeedback 后 reset() 回到初始值', () => {
    const feedback: AgentFeedback = {
      id: 'fb-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      rating: 5,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }

    useAgentFeedbackStore.getState().addFeedback(feedback)
    useAgentFeedbackStore.getState().refreshSummaries()

    expect(useAgentFeedbackStore.getState().feedbacks).toHaveLength(1)
    expect(useAgentFeedbackStore.getState().summaries.size).toBe(1)

    useAgentFeedbackStore.getState().reset()

    const state = useAgentFeedbackStore.getState()
    expect(state.feedbacks).toEqual([])
    expect(state.summaries.size).toBe(0)
    expect(state.isLoading).toBe(false)
  })

  // ---------- addFeedback ----------

  it('addFeedback: 添加一条反馈后 feedbacks.length 增加', () => {
    const feedback: AgentFeedback = {
      id: 'fb-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      rating: 5,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }

    useAgentFeedbackStore.getState().addFeedback(feedback)

    const state = useAgentFeedbackStore.getState()
    expect(state.feedbacks).toHaveLength(1)
    expect(state.feedbacks[0].id).toBe('fb-1')
    expect(state.feedbacks[0].agentId).toBe('agent-1')
    expect(state.feedbacks[0].rating).toBe(5)
  })

  it('addFeedback: 连续添加多条反馈后 refreshSummaries 更新 summaries', () => {
    const feedback1: AgentFeedback = {
      id: 'fb-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      rating: 4,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }
    const feedback2: AgentFeedback = {
      id: 'fb-2',
      agentId: 'agent-1',
      taskId: 'task-2',
      rating: 5,
      category: 'speed',
      resolved: false,
      timestamp: Date.now(),
    }
    const feedback3: AgentFeedback = {
      id: 'fb-3',
      agentId: 'agent-2',
      taskId: 'task-3',
      rating: 3,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }

    useAgentFeedbackStore.getState().addFeedback(feedback1)
    useAgentFeedbackStore.getState().addFeedback(feedback2)
    useAgentFeedbackStore.getState().addFeedback(feedback3)

    expect(useAgentFeedbackStore.getState().feedbacks).toHaveLength(3)

    useAgentFeedbackStore.getState().refreshSummaries()

    const summaries = useAgentFeedbackStore.getState().summaries
    expect(summaries.size).toBe(2)
    expect(summaries.has('agent-1')).toBe(true)
    expect(summaries.has('agent-2')).toBe(true)
  })

  // ---------- resolveFeedback ----------

  it('resolveFeedback: 标记已解决后 resolved=true', () => {
    const feedback: AgentFeedback = {
      id: 'fb-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      rating: 5,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }

    useAgentFeedbackStore.getState().addFeedback(feedback)
    expect(useAgentFeedbackStore.getState().feedbacks[0].resolved).toBe(false)

    useAgentFeedbackStore.getState().resolveFeedback('fb-1')
    expect(useAgentFeedbackStore.getState().feedbacks[0].resolved).toBe(true)
  })

  it('resolveFeedback: 不存在的 id 不影响其他反馈', () => {
    const feedback: AgentFeedback = {
      id: 'fb-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      rating: 5,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }

    useAgentFeedbackStore.getState().addFeedback(feedback)
    useAgentFeedbackStore.getState().resolveFeedback('non-existent-id')

    expect(useAgentFeedbackStore.getState().feedbacks).toHaveLength(1)
    expect(useAgentFeedbackStore.getState().feedbacks[0].resolved).toBe(false)
  })

  // ---------- getSummary ----------

  it('getSummary: 添加多条反馈后获取汇总', () => {
    const feedback1: AgentFeedback = {
      id: 'fb-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      rating: 4,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }
    const feedback2: AgentFeedback = {
      id: 'fb-2',
      agentId: 'agent-1',
      taskId: 'task-2',
      rating: 5,
      category: 'speed',
      resolved: false,
      timestamp: Date.now(),
    }
    const feedback3: AgentFeedback = {
      id: 'fb-3',
      agentId: 'agent-1',
      taskId: 'task-3',
      rating: 3,
      category: 'accuracy',
      resolved: false,
      timestamp: Date.now(),
    }

    useAgentFeedbackStore.getState().addFeedback(feedback1)
    useAgentFeedbackStore.getState().addFeedback(feedback2)
    useAgentFeedbackStore.getState().addFeedback(feedback3)

    const summary = useAgentFeedbackStore.getState().getSummary('agent-1')

    expect(summary.agentId).toBe('agent-1')
    expect(summary.totalFeedback).toBe(3)
    expect(summary.averageRating).toBe(4) // (4+5+3)/3 = 4
    expect(summary.categoryBreakdown).toEqual({ accuracy: 2, speed: 1 })
  })

  it('getSummary: 无反馈时返回空汇总', () => {
    const summary = useAgentFeedbackStore.getState().getSummary('agent-99')

    expect(summary.agentId).toBe('agent-99')
    expect(summary.averageRating).toBe(0)
    expect(summary.totalFeedback).toBe(0)
    expect(summary.categoryBreakdown).toEqual({})
  })
})
