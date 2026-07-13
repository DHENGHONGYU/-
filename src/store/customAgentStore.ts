/**
 * @module useCustomAgentStore
 * @description 自定义智能体 Zustand Store（阶段 B-1）
 *
 * 数据流：CustomAgentPage ↔ useCustomAgentStore ↔ customAgentService ↔ dataLayer.customAgentStore ↔ DataBridge.forward ↔ IDB.custom_agents
 *
 * 设计原则：
 * - 内存态存放 agents 列表与 loading/error
 * - 所有 CRUD 经 customAgentService（services/ 层）转发，Store 不再直接依赖 data/ 层
 * - UI 状态由 action 同步更新
 * - 组件挂载时调 loadAll() 拉取；创建/更新/删除完成后调 loadAll() 刷新
 */
import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  loadCustomAgents,
  saveCustomAgent,
  deleteCustomAgent,
} from '@/services/system/customAgentService'
import type { CustomAgent } from '@/data/types'

const logger = getLogger()

interface CustomAgentState {
  agents: CustomAgent[]
  loading: boolean
  error: string | null

  // Actions
  loadAll: () => Promise<void>
  saveAgent: (agent: CustomAgent) => Promise<boolean>
  deleteAgent: (id: string) => Promise<boolean>
  reset: () => void
}

/**
 * useCustomAgentStore
 */
export const useCustomAgentStore = create<CustomAgentState>((set) => ({
  agents: [],
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const list = await loadCustomAgents()
      logger.info('[useCustomAgentStore] loadAll 成功', { count: list.length })
      set({ agents: list, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[useCustomAgentStore] loadAll 失败', { error: message })
      set({ loading: false, error: message })
    }
  },

  saveAgent: async (agent) => {
    try {
      const result = await saveCustomAgent(agent)
      if (!result.success) {
        const errMsg = result.error ?? '保存自定义智能体失败'
        logger.error('[useCustomAgentStore] saveAgent 失败', { error: errMsg })
        set({ error: errMsg })
        return false
      }
      logger.info('[useCustomAgentStore] saveAgent 成功', { id: agent.id })
      // 保存后立即刷新列表（避免乐观更新与 IDB 不一致）
      const list = await loadCustomAgents()
      set({ agents: list, error: null })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[useCustomAgentStore] saveAgent 异常', { error: message })
      set({ error: message })
      return false
    }
  },

  deleteAgent: async (id) => {
    try {
      const result = await deleteCustomAgent(id)
      if (!result.success) {
        const errMsg = result.error ?? '删除自定义智能体失败'
        logger.error('[useCustomAgentStore] deleteAgent 失败', { id, error: errMsg })
        set({ error: errMsg })
        return false
      }
      logger.info('[useCustomAgentStore] deleteAgent 成功', { id })
      const list = await loadCustomAgents()
      set({ agents: list, error: null })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[useCustomAgentStore] deleteAgent 异常', { id, error: message })
      set({ error: message })
      return false
    }
  },

  reset: () => set({ agents: [], loading: false, error: null }),
}))
