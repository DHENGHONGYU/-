/**
 * @module EngineTypes
 * @lifecycle @Global
 * @description Engine 核心类型契约，定义配置、统计与生命周期事件载荷
 */

// ============================================================
// V6 评分引擎类型
// ============================================================

/** V6 评分引擎层 ID */
export type LayerId =
  | 'lMinus1' | 'l0' | 'l1' | 'l2' | 'l3f' | 'l3v'
  | 'l4' | 'l5' | 'l6' | 'l7' | 'l8'

/** 筹码等级 */
export type ChipLevel = 'SCD' | 'PCH' | 'AII' | 'MATRIX' | 'RSI' | 'CCS' | 'DIV' | 'CSR'

/** V6 评分引擎权重配置 */
export interface V6ScoreWeightsConfig {
  lMinus1: number
  l0: number
  l1: number
  l2: number
  l3f: number
  l3v: number
  l4: number
  l5: number
  l6: number
  l7: number
  l8: number
}

/** V6 评分引擎阈值配置 */
export interface V6ScoreThresholdsConfig {
  rating: {
    strongBuy: number
    buy: number
    hold: number
    sell: number
  }
  layerScore: { min: number; max: number }
  composite: { min: number; max: number }
}

/** 置信度配置 */
export interface ConfidenceConfig {
  /** 数据来源可信度分级 */
  sourceGrades: Record<string, { grade: string; score: number; description: string }>
  /** ESS 证据充分度评分 */
  ess: { minEvidence: number; sufficientThreshold: number }
}

/** 行业基准配置 */
export interface IndustryBenchmark {
  sector: string
  keywords: string[]
  peLow: number
  peHigh: number
  peglow: number
  pegHigh: number
  pbLow: number
  pbHigh: number
}

/** 风险预警配置 */
export interface RiskWarningConfig {
  red: string[]
  yellow: string[]
}

/** IPC 配置 */
export interface IPCConfig {
  ocr: {
    superStrong: number
    strong: number
    medium: number
    weak: number
    ocrAccelSignal: number
  }
  mce: {
    trackLevel: number
    categoryLevel: number
    segmentLevel: number
    decay3m: number
    decay6m: number
    decay12m: number
  }
  tims: {
    disruptive: number
    significant: number
    differentiated: number
    follower: number
    laggard: number
  }
  ipcWeights: { ocr: number; mce: number; tims: number }
  ipcStages: {
    broken: number
    near: number
    before: number
    far: number
  }
}

/** V6 评分引擎配置 */
export interface V6ScoreEngineConfig {
  weights: V6ScoreWeightsConfig
  thresholds: V6ScoreThresholdsConfig
  ipc: IPCConfig
  confidence: ConfidenceConfig
  industries: IndustryBenchmark[]
  riskWarnings: RiskWarningConfig
  offlineMode: boolean
  auditEnabled: boolean
  llmEnabled: boolean
}

/** 审计条目 */
export interface AuditEntry {
  timestamp: number
  layerId: LayerId
  step: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  formula?: string
  dataSource?: string
}

/** 单因子贡献明细 */
export interface FactorContribution {
  factorId: LayerId
  label: string
  weight: number
  normalizedWeight: number
  score: number
  baseline: number
  contribution: number
  signedContribution: number
  contributionRate: number
}

/** 审计追踪集合 */
export interface ScoreAuditTrail {
  symbol: string
  timestamp: number
  config: V6ScoreEngineConfig
  layers: Record<LayerId, AuditEntry[]>
  composite: {
    weightedSum: number
    layers: Record<LayerId, number>
    rating: string
  }
  factorContributions: FactorContribution[]
}

// ============================================================
// Engine 启动配置
// ============================================================

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

/** 引擎监控快照 */
export interface EngineMonitorSnapshot {
  timestamp: number
  health: {
    overallStatus: string
    uptimeSeconds: number
    dataflowConnected: boolean
    activeChannels: number
    layerStatuses: Array<{
      layerId: string
      status: string
    }>
  }
}
