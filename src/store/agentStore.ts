import { create } from 'zustand'
import { agentRuntime } from '@/agents/agentRuntime'
import { eventBus } from '@/lib/eventBus'
import type { AgentTask } from '@/agents/agentRuntime'

interface AgentState {
  registeredAgents: string[]
  tasks: Map<string, AgentTask>
  stats: ReturnType<typeof agentRuntime.getStats>
  registerAgent: (agentId: string) => void
  updateTask: (task: AgentTask) => void
  refreshStats: () => void
}

export const useAgentStore = create<AgentState>((set) => ({
  registeredAgents: [],
  tasks: new Map(),
  stats: agentRuntime.getStats(),
  registerAgent: (agentId) => set((state) => ({
    registeredAgents: state.registeredAgents.includes(agentId) ? state.registeredAgents : [...state.registeredAgents, agentId],
  })),
  updateTask: (task) => set((state) => {
    const tasks = new Map(state.tasks)
    tasks.set(task.id, task)
    return { tasks }
  }),
  refreshStats: () => set({ stats: agentRuntime.getStats() }),
}))

const agentSubscriptions: Array<() => void> = []

export function initAgentSubscriptions(): () => void {
  destroyAgentSubscriptions()
  agentSubscriptions.push(
    eventBus.on('AGENT_REGISTERED', (payload) => {
      const { agentId } = payload as { agentId: string }
      useAgentStore.getState().registerAgent(agentId)
      useAgentStore.getState().refreshStats()
    }),
    eventBus.on('AGENT_TASK_STARTED', (payload) => {
      const { taskId } = payload as { taskId: string }
      const task = agentRuntime.getTask(taskId)
      if (task) {
        useAgentStore.getState().updateTask(task)
      }
      useAgentStore.getState().refreshStats()
    }),
    eventBus.on('AGENT_TASK_COMPLETED', (payload) => {
      const { taskId } = payload as { taskId: string }
      const task = agentRuntime.getTask(taskId)
      if (task) {
        useAgentStore.getState().updateTask(task)
      }
      useAgentStore.getState().refreshStats()
    }),
    eventBus.on('AGENT_TASK_FAILED', (payload) => {
      const { taskId } = payload as { taskId: string }
      const task = agentRuntime.getTask(taskId)
      if (task) {
        useAgentStore.getState().updateTask(task)
      }
      useAgentStore.getState().refreshStats()
    }),
    eventBus.on('AGENT_TASK_TIMEOUT', (payload) => {
      const { taskId } = payload as { taskId: string }
      const task = agentRuntime.getTask(taskId)
      if (task) {
        useAgentStore.getState().updateTask(task)
      }
      useAgentStore.getState().refreshStats()
    }),
    eventBus.on('AGENT_TASK_CANCELLED', (payload) => {
      const { taskId } = payload as { taskId: string }
      const task = agentRuntime.getTask(taskId)
      if (task) {
        useAgentStore.getState().updateTask(task)
      }
      useAgentStore.getState().refreshStats()
    }),
  )
  return () => destroyAgentSubscriptions()
}

export function destroyAgentSubscriptions(): void {
  agentSubscriptions.forEach((unsubscribe) => unsubscribe())
  agentSubscriptions.length = 0
}

initAgentSubscriptions()