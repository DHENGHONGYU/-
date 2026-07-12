import { create } from 'zustand'
import { agentRuntime } from '@/agents/agentRuntime'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import type { AgentTask } from '@/agents/agentRuntime'
import type { AgentTriggerPayload, AgentTaskFilter, MCPCallRecord } from '@/types/modules/agent.types'
import { MCP_CALL_HISTORY_MAX_SIZE } from '@/config/mathConstants'

const logger = getLogger()

interface AgentState {
  registeredAgents: string[]
  tasks: Map<string, AgentTask>
  stats: ReturnType<typeof agentRuntime.getStats>
  /** Agent 任务触发参数 */
  triggerPayload: AgentTriggerPayload | null
  /** 任务筛选器 */
  taskFilter: AgentTaskFilter
  /** MCP 调用历史记录 */
  mcpCallHistory: MCPCallRecord[]

  registerAgent: (agentId: string) => void
  updateTask: (task: AgentTask) => void
  refreshStats: () => void
  setTriggerPayload: (payload: AgentTriggerPayload | null) => void
  setTaskFilter: (filter: AgentTaskFilter) => void
  addMCPCallRecord: (record: MCPCallRecord) => void
  clearMCPCallHistory: () => void
}

/**
 * useAgentStore
 */
export const useAgentStore = create<AgentState>((set) => ({
  registeredAgents: [],
  tasks: new Map(),
  stats: agentRuntime.getStats(),
  triggerPayload: null,
  taskFilter: {},
  mcpCallHistory: [],

  registerAgent: (agentId) => set((state) => ({
    registeredAgents: state.registeredAgents.includes(agentId)
      ? state.registeredAgents
      : [...state.registeredAgents, agentId],
  })),

  updateTask: (task) => set((state) => {
    const tasks = new Map(state.tasks)
    tasks.set(task.id, task)
    return { tasks }
  }),

  refreshStats: () => set({ stats: agentRuntime.getStats() }),

  setTriggerPayload: (payload) => {
    logger.info('[AgentStore] Trigger payload updated', { agentId: payload?.agentId })
    set({ triggerPayload: payload })
  },

  setTaskFilter: (filter) => {
    logger.info('[AgentStore] Task filter updated', { filter })
    set({ taskFilter: filter })
  },

  addMCPCallRecord: (record) => {
    logger.info('[AgentStore] MCP call record added', {
      taskId: record.taskId,
      serverName: record.serverName,
      toolName: record.toolName,
    })
    set((state) => ({
      mcpCallHistory: [...state.mcpCallHistory, record].slice(-MCP_CALL_HISTORY_MAX_SIZE),
    }))
  },

  clearMCPCallHistory: () => {
    logger.info('[AgentStore] MCP call history cleared')
    set({ mcpCallHistory: [] })
  },
}))

const agentSubscriptions: Array<() => void> = []

/**
 * initAgentSubscriptions
 */
export function initAgentSubscriptions(): () => void {
  destroyAgentSubscriptions()
  const syncTask = (taskId: string): void => {
    const task = agentRuntime.getTask(taskId)
    if (task) {
      useAgentStore.getState().updateTask(task)
    }
    useAgentStore.getState().refreshStats()
  }
  agentSubscriptions.push(
    eventBus.on('AGENT_REGISTERED', (payload) => {
      const { agentId } = payload as { agentId: string }
      useAgentStore.getState().registerAgent(agentId)
      useAgentStore.getState().refreshStats()
    }),
    eventBus.on('AGENT_TASK_STARTED', (payload) => {
      const { taskId } = payload as { taskId: string }
      syncTask(taskId)
    }),
    eventBus.on('AGENT_TASK_COMPLETED', (payload) => {
      const { taskId } = payload as { taskId: string }
      syncTask(taskId)
    }),
    eventBus.on('AGENT_TASK_FAILED', (payload) => {
      const { taskId } = payload as { taskId: string }
      syncTask(taskId)
    }),
    eventBus.on('AGENT_TASK_TIMEOUT', (payload) => {
      const { taskId } = payload as { taskId: string }
      syncTask(taskId)
    }),
    eventBus.on('AGENT_TASK_CANCELLED', (payload) => {
      const { taskId } = payload as { taskId: string }
      syncTask(taskId)
    }),
  )
  return () => destroyAgentSubscriptions()
}

/**
 * destroyAgentSubscriptions
 * @returns void
 */
export function destroyAgentSubscriptions(): void {
  agentSubscriptions.forEach((unsubscribe) => unsubscribe())
  agentSubscriptions.length = 0
}

initAgentSubscriptions()