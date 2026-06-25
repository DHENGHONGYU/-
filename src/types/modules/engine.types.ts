/**
 * @module EngineTypes
 * @lifecycle @Global
 * @description Engine 核心类型契约，定义配置、统计与生命周期事件载荷
 */

/** Engine 启动配置 */
export interface EngineConfig {
  /** 是否启用 SSE 实时推送 */
  enableSSE?: boolean
  /** SSE 服务端点地址 */
  sseUrl?: string
  /** 是否启用 Agent 健康检查 */
  enableAgentHealthCheck?: boolean
  /** 健康检查间隔（毫秒） */
  agentHealthCheckInterval?: number
}

/** DataFlow 引擎统计快照 */
export interface DataflowStats {
  /** 活跃通道数量 */
  channels: number
  /** 订阅者总数 */
  subscriberChannels: number
  /** 连接状态 */
  connected: boolean
}

/** Agent 运行时统计快照 */
export interface AgentRuntimeStats {
  /** 注册 Agent 总数 */
  totalAgents: number
  /** 正在运行的任务数 */
  runningTasks: number
  /** 已完成的任务数 */
  completedTasks: number
  /** 失败的任务数 */
  failedTasks: number
}

/** Engine 综合统计 */
export interface EngineStats {
  dataflow: DataflowStats
  agents: AgentRuntimeStats
}

/** 引擎生命周期事件载荷 */
export interface EngineLifecycleEvent {
  timestamp: number
}

/** 引擎健康告警事件载荷 */
export interface EngineHealthAlertEvent {
  stats: AgentRuntimeStats
}
