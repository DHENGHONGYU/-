/**
 * @module agentFeedbackStore
 * @description Agent 反馈 Store — 反馈收集、评分汇总、状态管理
 * @created 2026-07-04
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { AgentFeedback, AgentFeedbackSummary } from '@/types/modules/agent.types'

const logger = getLogger()

interface AgentFeedbackState {
  feedbacks: AgentFeedback[]
  summaries: Map<string, AgentFeedbackSummary>
  isLoading: boolean

  addFeedback: (feedback: AgentFeedback) => void
  resolveFeedback: (id: string) => void
  getSummary: (agentId: string) => AgentFeedbackSummary
  refreshSummaries: () => void
}

export const useAgentFeedbackStore = create<AgentFeedbackState>((set, get) => ({
  feedbacks: [],
  summaries: new Map(),
  isLoading: false,

  addFeedback: (feedback) => {
    set((s) => ({
      feedbacks: [...s.feedbacks, feedback],
    }))
    logger.info('[AgentFeedbackStore] Feedback added', {
      taskId: feedback.taskId,
      rating: feedback.rating,
    })
  },

  resolveFeedback: (id) => {
    set((s) => ({
      feedbacks: s.feedbacks.map((f) => (f.id === id ? { ...f, resolved: true } : f)),
    }))
    logger.info('[AgentFeedbackStore] Feedback resolved', { id })
  },

  getSummary: (agentId) => {
    const feedbacks = get().feedbacks.filter((f) => f.agentId === agentId)
    if (feedbacks.length === 0) {
      return { agentId, averageRating: 0, totalFeedback: 0, categoryBreakdown: {} }
    }
    const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
    const breakdown: Record<string, number> = {}
    for (const f of feedbacks) {
      if (f.category == null) {
        logger.warn('[agentFeedbackStore] 字段缺失，使用默认值', { field: 'category', context: `agentId=${f.agentId}` })
        continue // 跳过无分类的反馈，避免污染 breakdown 数据
      }
      const prev = breakdown[f.category]
      const count = prev ?? 0
      breakdown[f.category] = count + 1
    }
    return {
      agentId,
      averageRating: Math.round(avgRating * 10) / 10,
      totalFeedback: feedbacks.length,
      categoryBreakdown: breakdown,
    }
  },

  refreshSummaries: () => {
    const agents = [...new Set(get().feedbacks.map((f) => f.agentId))]
    const map = new Map<string, AgentFeedbackSummary>()
    for (const agentId of agents) {
      map.set(agentId, get().getSummary(agentId))
    }
    set({ summaries: map })
    logger.info('[AgentFeedbackStore] Summaries refreshed', { count: map.size })
  },
}))