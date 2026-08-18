/**
 * @module AgentRuntime
 * @lifecycle @Global
 * @description Agent 运行时模块，提供任务调度、超时控制、状态监控能力
  * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-QA-066]
*/

// NOTE: 以下早期/并行抽象（AgentModuleInput / AgentModuleOutput / AgentDefinition /
// AgentInstance / IOModule）已于 2026-08-18 清理——经全工作区 grep 确认 src/ 零外部引用，
// 运行时真相源统一为 src/agents/agentRuntime.ts 的 AgentTask / AgentConfig。
// 相关类型文档（docs/reference/*）存在 doc-drift，属治理后续，不影响编译。

/** Agent 健康快照 */
export interface AgentHealthSnapshot {
  agentId: string
  agentName: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  lastHeartbeat: number
  taskCount: number
  totalTasks: number
  errorCount: number
  failureRate: number
  uptime: number
  avgExecutionTime: number
  consecutiveFailures: number
  maxConcurrent: number
  defaultTimeout: number
}

/** Agent 任务历史条目 */
export interface AgentTaskHistoryEntry {
  taskId: string
  agentId: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  createdAt: number
  startedAt?: number
  completedAt?: number
  durationMs?: number
  error?: string
}

/** Agent 指标汇总 */
export interface AgentMetricsSummary {
  totalAgents: number
  healthyCount: number
  warningCount: number
  criticalCount: number
  totalTasks: number
  successTasks: number
  failedTasks: number
  runningTasks: number
  pendingTasks: number
  avgFailureRate: number
  avgExecutionTime: number
}

/** 系统监控快照 */
export interface SystemMonitorSnapshot {
  timestamp: number
  agentSystemInitialized: boolean
  agentMetrics: AgentMetricsSummary
  agentHealthSnapshots: AgentHealthSnapshot[]
  recentTasks: AgentTaskHistoryEntry[]
  eventBusStats: {
    totalEvents: number
    totalListeners: number
  }
}

// ============================================================
// Agent 任务触发
// ============================================================

/** Agent 任务触发参数 */
export interface AgentTriggerPayload {
  agentId: string
  toolName: string
  serverName: string
  args: Record<string, unknown>
  timeout?: number
}

/** Agent 任务筛选 */
export interface AgentTaskFilter {
  agentId?: string
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  dateRange?: { start: number; end: number }
}

/** MCP 调用记录 */
export interface MCPCallRecord {
  id: string
  taskId: string
  serverName: string
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
  startedAt: number
  completedAt?: number
  durationMs?: number
}

// ============================================================
// Agent 反馈
// ============================================================

/** Agent 反馈 */
export interface AgentFeedback {
  id: string
  taskId: string
  agentId: string
  rating: 1 | 2 | 3 | 4 | 5
  comment: string
  category: 'accuracy' | 'speed' | 'usability' | 'feature'
  createdAt: number
  resolved: boolean
}

/** Agent 反馈汇总 */
export interface AgentFeedbackSummary {
  agentId: string
  averageRating: number
  totalFeedback: number
  categoryBreakdown: Record<string, number>
}