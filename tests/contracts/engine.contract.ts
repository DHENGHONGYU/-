/**
 * @fileoverview Engine 模块契约验证器
 * @description 定义 Engine 核心类型的运行时契约
 *
 * 契约来源：src/types/modules/engine.types.ts
 */

import { z } from 'zod'

// ============================================================
// LayerId 契约定义
// ============================================================

/**
 * LayerId 契约
 * 对应类型：src/types/modules/engine.types.ts::LayerId
 *
 * V6 评分引擎层 ID
 */
export const LayerIdSchema = z.enum([
  'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v',
  'l4', 'l5', 'l6', 'l7', 'l8',
])

// ============================================================
// ChipLevel 契约定义
// ============================================================

/**
 * ChipLevel 契约
 * 对应类型：src/types/modules/engine.types.ts::ChipLevel
 *
 * 筹码等级
 */
export const ChipLevelSchema = z.enum([
  'SCD', 'PCH', 'AII', 'MATRIX', 'RSI', 'CCS', 'DIV', 'CSR',
])

// ============================================================
// V6ScoreWeightsConfig 契约定义
// ============================================================

/**
 * V6ScoreWeightsConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::V6ScoreWeightsConfig
 *
 * V6 评分引擎权重配置
 */
export const V6ScoreWeightsConfigSchema = z.object({
  lMinus1: z.number().min(0).max(1),
  l0: z.number().min(0).max(1),
  l1: z.number().min(0).max(1),
  l2: z.number().min(0).max(1),
  l3f: z.number().min(0).max(1),
  l3v: z.number().min(0).max(1),
  l4: z.number().min(0).max(1),
  l5: z.number().min(0).max(1),
  l6: z.number().min(0).max(1),
  l7: z.number().min(0).max(1),
  l8: z.number().min(0).max(1),
})

// ============================================================
// V6ScoreThresholdsConfig 契约定义
// ============================================================

/**
 * V6ScoreThresholdsConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::V6ScoreThresholdsConfig
 *
 * V6 评分引擎阈值配置
 */
export const V6ScoreThresholdsConfigSchema = z.object({
  rating: z.object({
    strongBuy: z.number(),
    buy: z.number(),
    hold: z.number(),
    sell: z.number(),
  }),
  layerScore: z.object({
    min: z.number(),
    max: z.number(),
  }),
  composite: z.object({
    min: z.number(),
    max: z.number(),
  }),
})

// ============================================================
// ConfidenceConfig 契约定义
// ============================================================

/**
 * ConfidenceConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::ConfidenceConfig
 *
 * 置信度配置
 */
export const ConfidenceConfigSchema = z.object({
  sourceGrades: z.record(
    z.string(),
    z.object({
      grade: z.string(),
      score: z.number(),
      description: z.string(),
    })
  ),
  ess: z.object({
    minEvidence: z.number(),
    sufficientThreshold: z.number(),
  }),
})

// ============================================================
// IndustryBenchmark 契约定义
// ============================================================

/**
 * IndustryBenchmark 契约
 * 对应类型：src/types/modules/engine.types.ts::IndustryBenchmark
 *
 * 行业基准配置
 */
export const IndustryBenchmarkSchema = z.object({
  sector: z.string(),
  keywords: z.array(z.string()),
  peLow: z.number(),
  peHigh: z.number(),
  peglow: z.number(),
  pegHigh: z.number(),
  pbLow: z.number(),
  pbHigh: z.number(),
})

// ============================================================
// RiskWarningConfig 契约定义
// ============================================================

/**
 * RiskWarningConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::RiskWarningConfig
 *
 * 风险预警配置
 */
export const RiskWarningConfigSchema = z.object({
  red: z.array(z.string()),
  yellow: z.array(z.string()),
})

// ============================================================
// IPCConfig 契约定义
// ============================================================

/**
 * IPCConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::IPCConfig
 *
 * IPC 配置
 */
export const IPCConfigSchema = z.object({
  ocr: z.object({
    superStrong: z.number(),
    strong: z.number(),
    medium: z.number(),
    weak: z.number(),
    ocrAccelSignal: z.number(),
  }),
  mce: z.object({
    trackLevel: z.number(),
    categoryLevel: z.number(),
    segmentLevel: z.number(),
    decay3m: z.number(),
    decay6m: z.number(),
    decay12m: z.number(),
  }),
  tims: z.object({
    disruptive: z.number(),
    significant: z.number(),
    differentiated: z.number(),
    follower: z.number(),
    laggard: z.number(),
  }),
  ipcWeights: z.object({
    ocr: z.number(),
    mce: z.number(),
    tims: z.number(),
  }),
  ipcStages: z.object({
    broken: z.number(),
    near: z.number(),
    before: z.number(),
    far: z.number(),
  }),
})

// ============================================================
// V6ScoreEngineConfig 契约定义
// ============================================================

/**
 * V6ScoreEngineConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::V6ScoreEngineConfig
 *
 * V6 评分引擎配置
 */
export const V6ScoreEngineConfigSchema = z.object({
  weights: V6ScoreWeightsConfigSchema,
  thresholds: V6ScoreThresholdsConfigSchema,
  ipc: IPCConfigSchema,
  confidence: ConfidenceConfigSchema,
  industries: z.array(IndustryBenchmarkSchema),
  riskWarnings: RiskWarningConfigSchema,
  offlineMode: z.boolean(),
  auditEnabled: z.boolean(),
  llmEnabled: z.boolean(),
})

// ============================================================
// AuditEntry 契约定义
// ============================================================

/**
 * AuditEntry 契约
 * 对应类型：src/types/modules/engine.types.ts::AuditEntry
 *
 * 审计条目
 */
export const AuditEntrySchema = z.object({
  timestamp: z.number(),
  layerId: LayerIdSchema,
  step: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  formula: z.string().optional(),
  dataSource: z.string().optional(),
})

// ============================================================
// FactorContribution 契约定义
// ============================================================

/**
 * FactorContribution 契约
 * 对应类型：src/types/modules/engine.types.ts::FactorContribution
 *
 * 单因子贡献明细
 */
export const FactorContributionSchema = z.object({
  factorId: LayerIdSchema,
  label: z.string(),
  weight: z.number(),
  normalizedWeight: z.number(),
  score: z.number(),
  baseline: z.number(),
  contribution: z.number(),
  signedContribution: z.number(),
  contributionRate: z.number(),
})

// ============================================================
// ScoreAuditTrail 契约定义
// ============================================================

/**
 * ScoreAuditTrail 契约
 * 对应类型：src/types/modules/engine.types.ts::ScoreAuditTrail
 *
 * 审计追踪集合
 */
export const ScoreAuditTrailSchema = z.object({
  symbol: z.string(),
  timestamp: z.number(),
  config: V6ScoreEngineConfigSchema,
  layers: z.record(LayerIdSchema, z.array(AuditEntrySchema)),
  composite: z.object({
    weightedSum: z.number(),
    layers: z.record(LayerIdSchema, z.number()),
    rating: z.string(),
  }),
  factorContributions: z.array(FactorContributionSchema),
})

// ============================================================
// EngineConfig 契约定义
// ============================================================

/**
 * EngineConfig 契约
 * 对应类型：src/types/modules/engine.types.ts::EngineConfig
 *
 * Engine 启动配置
 */
export const EngineConfigSchema = z.object({
  enableSSE: z.boolean().optional(),
  sseUrl: z.string().optional(),
  enableAgentHealthCheck: z.boolean().optional(),
  agentHealthCheckInterval: z.number().int().positive().optional(),
})

// ============================================================
// DataflowStats 契约定义
// ============================================================

/**
 * DataflowStats 契约
 * 对应类型：src/types/modules/engine.types.ts::DataflowStats
 *
 * DataFlow 引擎统计快照
 */
export const DataflowStatsSchema = z.object({
  channels: z.number().int().nonnegative(),
  subscriberChannels: z.number().int().nonnegative(),
  connected: z.boolean(),
})

// ============================================================
// AgentRuntimeStats 契约定义
// ============================================================

/**
 * AgentRuntimeStats 契约
 * 对应类型：src/types/modules/engine.types.ts::AgentRuntimeStats
 *
 * Agent 运行时统计快照
 */
export const AgentRuntimeStatsSchema = z.object({
  totalAgents: z.number().int().nonnegative(),
  runningTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
  failedTasks: z.number().int().nonnegative(),
})

// ============================================================
// EngineStats 契约定义
// ============================================================

/**
 * EngineStats 契约
 * 对应类型：src/types/modules/engine.types.ts::EngineStats
 *
 * Engine 综合统计
 */
export const EngineStatsSchema = z.object({
  dataflow: DataflowStatsSchema,
  agents: AgentRuntimeStatsSchema,
})

// ============================================================
// EngineLifecycleEvent 契约定义
// ============================================================

/**
 * EngineLifecycleEvent 契约
 * 对应类型：src/types/modules/engine.types.ts::EngineLifecycleEvent
 *
 * 引擎生命周期事件载荷
 */
export const EngineLifecycleEventSchema = z.object({
  timestamp: z.number(),
})

// ============================================================
// EngineHealthAlertEvent 契约定义
// ============================================================

/**
 * EngineHealthAlertEvent 契约
 * 对应类型：src/types/modules/engine.types.ts::EngineHealthAlertEvent
 *
 * 引擎健康告警事件载荷
 */
export const EngineHealthAlertEventSchema = z.object({
  stats: AgentRuntimeStatsSchema,
})

// ============================================================
// EngineMonitorSnapshot 契约定义
// ============================================================

/**
 * EngineMonitorSnapshot 契约
 * 对应类型：src/types/modules/engine.types.ts::EngineMonitorSnapshot
 *
 * 引擎监控快照
 */
export const EngineMonitorSnapshotSchema = z.object({
  timestamp: z.number(),
  health: z.object({
    overallStatus: z.string(),
    uptimeSeconds: z.number(),
    dataflowConnected: z.boolean(),
    activeChannels: z.number(),
    layerStatuses: z.array(
      z.object({
        layerId: z.string(),
        status: z.string(),
      })
    ),
  }),
})

// ============================================================
// 工厂函数
// ============================================================

/**
 * 创建符合 LayerId 契约的测试数据
 */
export function createMockLayerId(): z.infer<typeof LayerIdSchema> {
  const layers: Array<z.infer<typeof LayerIdSchema>> = [
    'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v',
    'l4', 'l5', 'l6', 'l7', 'l8',
  ]
  return layers[Math.floor(Math.random() * layers.length)]!
}

/**
 * 创建符合 EngineStats 契约的测试数据
 */
export function createMockEngineStats(
  overrides: Partial<z.infer<typeof EngineStatsSchema>> = {},
): z.infer<typeof EngineStatsSchema> {
  return {
    dataflow: {
      channels: 5,
      subscriberChannels: 10,
      connected: true,
    },
    agents: {
      totalAgents: 3,
      runningTasks: 2,
      completedTasks: 10,
      failedTasks: 0,
    },
    ...overrides,
  }
}

/**
 * 创建符合 EngineConfig 契约的测试数据
 */
export function createMockEngineConfig(
  overrides: Partial<z.infer<typeof EngineConfigSchema>> = {},
): z.infer<typeof EngineConfigSchema> {
  return {
    enableSSE: false,
    sseUrl: 'http://localhost:3000/sse',
    enableAgentHealthCheck: true,
    agentHealthCheckInterval: 30000,
    ...overrides,
  }
}

// ============================================================
// 导出类型
// ============================================================

export type LayerIdContract = z.infer<typeof LayerIdSchema>
export type EngineStatsContract = z.infer<typeof EngineStatsSchema>
export type EngineConfigContract = z.infer<typeof EngineConfigSchema>
export type V6ScoreEngineConfigContract = z.infer<typeof V6ScoreEngineConfigSchema>
export type ScoreAuditTrailContract = z.infer<typeof ScoreAuditTrailSchema>
