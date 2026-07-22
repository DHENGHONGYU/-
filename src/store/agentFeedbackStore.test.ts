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
})
