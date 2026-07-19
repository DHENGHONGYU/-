/**
 * @test_id V9-TEST-ST-165
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014]
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentFeedbackStore } from '@/store/agentFeedbackStore'
import type { AgentFeedback } from '@/types/modules/agent.types'

describe('useAgentFeedbackStore', () => {
  beforeEach(() => {
    useAgentFeedbackStore.setState({
      feedbacks: [],
      summaries: new Map(),
      isLoading: false,
    })
  })

  const createFeedback = (overrides: Partial<AgentFeedback> = {}): AgentFeedback => ({
    id: 'fb-1',
    taskId: 'task-1',
    agentId: 'test-agent',
    rating: 4,
    comment: 'Good job',
    category: 'accuracy',
    createdAt: Date.now(),
    resolved: false,
    ...overrides,
  })

  it('应该add feedback', () => {
    const fb = createFeedback()
    useAgentFeedbackStore.getState().addFeedback(fb)

    const { feedbacks } = useAgentFeedbackStore.getState()
    expect(feedbacks).toHaveLength(1)
    expect(feedbacks[0]!.id).toBe('fb-1')
  })

  it('应该resolve feedback', () => {
    const fb = createFeedback()
    useAgentFeedbackStore.getState().addFeedback(fb)
    useAgentFeedbackStore.getState().resolveFeedback('fb-1')

    const { feedbacks } = useAgentFeedbackStore.getState()
    expect(feedbacks[0]!.resolved).toBe(true)
  })

  it('应该resolve only matching feedback', () => {
    useAgentFeedbackStore.getState().addFeedback(createFeedback({ id: 'fb-1' }))
    useAgentFeedbackStore.getState().addFeedback(createFeedback({ id: 'fb-2' }))
    useAgentFeedbackStore.getState().resolveFeedback('fb-1')

    const { feedbacks } = useAgentFeedbackStore.getState()
    expect(feedbacks[0]!.resolved).toBe(true)
    expect(feedbacks[1]!.resolved).toBe(false)
  })

  it('应该get summary for agent', () => {
    useAgentFeedbackStore.getState().addFeedback(
      createFeedback({ agentId: 'agent-a', rating: 5, category: 'accuracy' }),
    )
    useAgentFeedbackStore.getState().addFeedback(
      createFeedback({ id: 'fb-2', agentId: 'agent-a', rating: 3, category: 'speed' }),
    )

    const summary = useAgentFeedbackStore.getState().getSummary('agent-a')
    expect(summary.agentId).toBe('agent-a')
    expect(summary.averageRating).toBe(4)
    expect(summary.totalFeedback).toBe(2)
    expect(summary.categoryBreakdown).toEqual({ accuracy: 1, speed: 1 })
  })

  it('应该返回 empty summary for unknown agent', () => {
    const summary = useAgentFeedbackStore.getState().getSummary('unknown')
    expect(summary.agentId).toBe('unknown')
    expect(summary.averageRating).toBe(0)
    expect(summary.totalFeedback).toBe(0)
  })

  it('应该refresh summaries', () => {
    useAgentFeedbackStore.getState().addFeedback(createFeedback({ agentId: 'agent-a', rating: 5 }))
    useAgentFeedbackStore.getState().addFeedback(
      createFeedback({ id: 'fb-2', agentId: 'agent-b', rating: 3 }),
    )

    useAgentFeedbackStore.getState().refreshSummaries()

    const { summaries } = useAgentFeedbackStore.getState()
    expect(summaries.size).toBe(2)
    expect(summaries.get('agent-a')?.averageRating).toBe(5)
    expect(summaries.get('agent-b')?.averageRating).toBe(3)
  })

  it('应该calculate average rating correctly', () => {
    useAgentFeedbackStore.getState().addFeedback(
      createFeedback({ id: 'fb-1', agentId: 'agent-a', rating: 5 }),
    )
    useAgentFeedbackStore.getState().addFeedback(
      createFeedback({ id: 'fb-2', agentId: 'agent-a', rating: 2 }),
    )
    useAgentFeedbackStore.getState().addFeedback(
      createFeedback({ id: 'fb-3', agentId: 'agent-a', rating: 3 }),
    )

    const summary = useAgentFeedbackStore.getState().getSummary('agent-a')
    expect(summary.averageRating).toBe(3.3)
  })
})