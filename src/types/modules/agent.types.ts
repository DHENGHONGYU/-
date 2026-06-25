/**
 * @module AgentRuntime
 * @lifecycle @Global
 * @description Agent 运行时模块，提供任务调度、超时控制、状态监控能力
 */

export interface AgentModuleInput {
  agentId: string
  type: string
  payload: Record<string, unknown>
  options?: {
    timeout?: number
    priority?: number
  }
}

export interface AgentModuleOutput {
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
  result?: Record<string, unknown>
  error?: string
  executionTimeMs: number
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  type: string
  version: string
  capabilities: Array<{ id: string; name: string; description: string }>
  metadata: { tags: string[]; config: Record<string, unknown> }
}

export interface AgentInstance {
  instanceId: string
  agentId: string
  name: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
  startTime: number
  lastHeartbeat: number
  stats: { totalTasks: number; successTasks: number; failedTasks: number; avgExecutionTime: number }
}

export interface IOModule {
  input: AgentModuleInput
  output: AgentModuleOutput
}