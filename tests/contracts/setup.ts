/**
 * @fileoverview 契约验证全局 setup 文件
 * @description 在所有测试文件执行前自动加载，注册所有契约并配置报告机制
 *
 * 职责：
 * 1. 注册所有契约到全局验证器
 * 2. 测试套件开始前清空违反记录
 * 3. 测试套件结束后输出契约验证报告
 *
 * 配置方式：vite.config.ts → test.setupFiles
 */

import { beforeAll, afterAll } from 'vitest'
import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import {
  registerContract,
  clearViolations,
  getViolations,
  getStats,
  resetStats,
  generateReport,
  getRegisteredContracts,
} from './contractValidator'

const logger = getLogger()

// ============================================================
// 导入所有契约
// ============================================================

logger.info('[ContractValidator] setup.ts 开始加载，导入契约定义...')

import {
  BridgeQueryResultSchema,
  BridgeQueryOptionsSchema,
  DataBridgeAdapterConfigSchema,
  DataBridgeAdapterStatsSchema,
  DataActionSchema,
} from './databridge.contract'

import {
  EnvelopeMetaSchema,
  StandardEnvelopeSchema,
} from './envelope.contract'

import {
  CollectResponseSchema,
  HealthCheckResponseSchema,
  CollectBasicDataSchema,
  CollectKlineDataSchema,
} from './fetcher.contract'

import {
  LayerIdSchema,
  ChipLevelSchema,
  V6ScoreWeightsConfigSchema,
  V6ScoreThresholdsConfigSchema,
  ConfidenceConfigSchema,
  IndustryBenchmarkSchema,
  RiskWarningConfigSchema,
  IPCConfigSchema,
  V6ScoreEngineConfigSchema,
  AuditEntrySchema,
  FactorContributionSchema,
  ScoreAuditTrailSchema,
  EngineConfigSchema,
  DataflowStatsSchema,
  AgentRuntimeStatsSchema,
  EngineStatsSchema,
  EngineLifecycleEventSchema,
  EngineHealthAlertEventSchema,
  EngineMonitorSnapshotSchema,
} from './engine.contract'

import {
  HotSectorDimensionsSchema,
  HotSectorScoreSchema,
  ValuePitDimensionsSchema,
  ValuePitScoreSchema,
  RotationConditionsSchema,
  RotationSignalSchema,
  StrategySignalSchema,
  WatchlistCandidateSchema,
  StrategySummarySchema,
  DualStrategyResultSchema,
  DualStrategyRuleConfigSchema,
  StrategyGroupItemSchema,
} from './strategy.contract'

import {
  SignalStateSchema,
  PoolStateSchema,
  MarketDataStateSchema,
} from './store.contract'

logger.info('[ContractValidator] 所有契约定义导入完成')

// ============================================================
// 注册所有契约
// ============================================================

logger.info('[ContractValidator] 开始注册 DataBridge 契约（5 个）...')

// DataBridge 契约
registerContract(
  'BridgeQueryResult',
  BridgeQueryResultSchema,
  'DataBridge.query() 返回结果',
)

registerContract(
  'BridgeQueryOptions',
  BridgeQueryOptionsSchema,
  'DataBridge 查询选项',
)

registerContract(
  'DataBridgeAdapterConfig',
  DataBridgeAdapterConfigSchema,
  'DataBridgeAdapter 配置',
)

registerContract(
  'DataBridgeAdapterStats',
  DataBridgeAdapterStatsSchema,
  'DataBridgeAdapter 统计快照',
)

registerContract(
  'DataAction',
  DataActionSchema,
  'DataBridge 数据操作动作枚举',
)

logger.info('[ContractValidator] DataBridge 契约注册完成，开始注册 Envelope 契约（2 个）...')

// Envelope 契约
registerContract(
  'EnvelopeMeta',
  EnvelopeMetaSchema,
  'Envelope 元数据',
)

registerContract(
  'StandardEnvelope',
  StandardEnvelopeSchema,
  'DataBridge 标准信封',
)

logger.info('[ContractValidator] Envelope 契约注册完成，开始注册 Fetcher 契约（6 个）...')

// Fetcher 契约
registerContract(
  'CollectResponse<CollectBasicData>',
  CollectResponseSchema(CollectBasicDataSchema),
  '数据采集 API 响应（基础数据）',
)

registerContract(
  'CollectResponse<CollectKlineData>',
  CollectResponseSchema(CollectKlineDataSchema),
  '数据采集 API 响应（K线数据）',
)

registerContract(
  'HealthCheckResponse',
  HealthCheckResponseSchema,
  '健康检查响应',
)

registerContract(
  'CollectBasicData',
  CollectBasicDataSchema,
  '基础数据采集',
)

registerContract(
  'CollectKlineData',
  CollectKlineDataSchema,
  'K线数据采集',
)

logger.info('[ContractValidator] Fetcher 契约注册完成，开始注册 Engine 契约（15 个）...')

// Engine 契约
registerContract(
  'LayerId',
  LayerIdSchema,
  'V6 评分引擎层 ID',
)

registerContract(
  'ChipLevel',
  ChipLevelSchema,
  '筹码等级',
)

registerContract(
  'V6ScoreWeightsConfig',
  V6ScoreWeightsConfigSchema,
  'V6 评分引擎权重配置',
)

registerContract(
  'V6ScoreThresholdsConfig',
  V6ScoreThresholdsConfigSchema,
  'V6 评分引擎阈值配置',
)

registerContract(
  'ConfidenceConfig',
  ConfidenceConfigSchema,
  '置信度配置',
)

registerContract(
  'IndustryBenchmark',
  IndustryBenchmarkSchema,
  '行业基准配置',
)

registerContract(
  'RiskWarningConfig',
  RiskWarningConfigSchema,
  '风险预警配置',
)

registerContract(
  'IPCConfig',
  IPCConfigSchema,
  'IPC 配置',
)

registerContract(
  'V6ScoreEngineConfig',
  V6ScoreEngineConfigSchema,
  'V6 评分引擎配置',
)

registerContract(
  'AuditEntry',
  AuditEntrySchema,
  '审计条目',
)

registerContract(
  'FactorContribution',
  FactorContributionSchema,
  '单因子贡献明细',
)

registerContract(
  'ScoreAuditTrail',
  ScoreAuditTrailSchema,
  '审计追踪集合',
)

registerContract(
  'EngineConfig',
  EngineConfigSchema,
  'Engine 启动配置',
)

registerContract(
  'DataflowStats',
  DataflowStatsSchema,
  'DataFlow 引擎统计快照',
)

registerContract(
  'AgentRuntimeStats',
  AgentRuntimeStatsSchema,
  'Agent 运行时统计快照',
)

registerContract(
  'EngineStats',
  EngineStatsSchema,
  'Engine 综合统计',
)

registerContract(
  'EngineLifecycleEvent',
  EngineLifecycleEventSchema,
  '引擎生命周期事件载荷',
)

registerContract(
  'EngineHealthAlertEvent',
  EngineHealthAlertEventSchema,
  '引擎健康告警事件载荷',
)

registerContract(
  'EngineMonitorSnapshot',
  EngineMonitorSnapshotSchema,
  '引擎监控快照',
)

logger.info('[ContractValidator] Engine 契约注册完成，开始注册 Strategy 契约（12 个）...')

// Strategy 契约
registerContract(
  'HotSectorDimensions',
  HotSectorDimensionsSchema,
  '热门板块五维评分维度',
)

registerContract(
  'HotSectorScore',
  HotSectorScoreSchema,
  '热门板块策略评分输出',
)

registerContract(
  'ValuePitDimensions',
  ValuePitDimensionsSchema,
  '价值洼地五维评分维度',
)

registerContract(
  'ValuePitScore',
  ValuePitScoreSchema,
  '价值洼地策略评分输出',
)

registerContract(
  'RotationConditions',
  RotationConditionsSchema,
  '轮动信号触发条件检测结果',
)

registerContract(
  'RotationSignal',
  RotationSignalSchema,
  '轮动信号输出',
)

registerContract(
  'StrategySignal',
  StrategySignalSchema,
  '策略交易信号',
)

registerContract(
  'WatchlistCandidate',
  WatchlistCandidateSchema,
  '观察池候选',
)

registerContract(
  'StrategySummary',
  StrategySummarySchema,
  '双策略汇总统计',
)

registerContract(
  'DualStrategyResult',
  DualStrategyResultSchema,
  '双策略编排引擎输出汇总',
)

registerContract(
  'DualStrategyRuleConfig',
  DualStrategyRuleConfigSchema,
  '双策略规则配置',
)

registerContract(
  'StrategyGroupItem',
  StrategyGroupItemSchema,
  '策略分组项',
)

logger.info('[ContractValidator] Store 契约注册完成，开始注册 Store 契约（3 个）...')

// Store 契约
registerContract(
  'SignalState',
  SignalStateSchema,
  '信号 Store 状态',
)

registerContract(
  'PoolState',
  PoolStateSchema,
  '股票池 Store 状态',
)

registerContract(
  'MarketDataState',
  MarketDataStateSchema,
  '市场数据 Store 状态',
)

logger.info('[ContractValidator] Store 契约注册完成')

const registeredNames = getRegisteredContracts()
logger.info(
  `[ContractValidator] 所有契约注册完成，共 ${registeredNames.length} 个契约: ` +
  registeredNames.join(', ')
)

// ============================================================
// 测试生命周期钩子
// ============================================================

/**
 * 测试套件开始前：清空违反记录和统计
 */
beforeAll(() => {
  logger.info('[ContractValidator] beforeAll: 清空违反记录和统计')
  clearViolations()
  resetStats()
  logger.info('[ContractValidator] beforeAll: 重置完成，准备开始测试')
})

/**
 * 测试套件结束后：输出契约验证报告
 */
afterAll(() => {
  const stats = getStats()
  const violations = getViolations()

  logger.info(
    `[ContractValidator] afterAll: 测试套件结束，` +
    `总验证=${stats.totalValidations}, 通过=${stats.passedValidations}, ` +
    `失败=${stats.failedValidations}, 违反记录=${violations.length}`
  )

  // 如果有违反记录，输出详细报告
  if (violations.length > 0) {
    logger.error(`[ContractValidator] afterAll: 发现 ${violations.length} 条契约违反，输出详细报告`)
    console.log('\n' + generateReport())
  } else if (stats.totalValidations > 0) {
    // 有验证但无违反，输出简要统计
    logger.info(
      `[ContractValidator] afterAll: 契约验证全部通过 ` +
      `(${stats.passedValidations}/${stats.totalValidations} 次验证, ` +
      `${stats.registeredContracts} 个已注册契约)`
    )
  } else {
    logger.info('[ContractValidator] afterAll: 本次测试套件未触发任何契约验证')
  }
})
