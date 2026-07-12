/**
 * V6 评分引擎 — barrel export
 *
 * 统一导出所有计算器、引擎、类型、配置。
 * 外部模块只需 `import { V6ScoreEngine, ... } from '@/services/scoring/v6-engine'`
 */

// 配置
export {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  INDUSTRY_BENCHMARKS,
  RISK_WARNINGS,
  IPC_CONFIG,
  CHIP_LEVELS,
  CONFIDENCE_CONFIG,
  DEFAULT_ENGINE_CONFIG,
} from './config'
export type {
  V6ScoreWeightsConfig,
  V6ScoreThresholdsConfig,
  IndustryBenchmark,
  RiskWarningConfig,
  IPCConfig,
  ConfidenceConfig,
  V6ScoreEngineConfig,
  V6ScoreConfigOverride,
  ChipLevel,
} from './config'

// 类型
export {
  ALL_LAYER_IDS,
  LAYER_LABELS,
  stockToBasicData,
  quotesToQuoteData,
} from './types'
export type {
  LayerId,
  StockBasicData,
  FinancialData,
  QuoteData,
  IndustryScoreData,
  ZeroToOneEvent,
  LayerInput,
  LayerScore,
  CompositeScore,
  AuditEntry,
  ScoreAuditTrail,
  LayerCalculator,
  RiskWarningResult,
  IPCResult,
  ChipResult,
  V6ScoreInput,
  FactorContribution,
} from './types'

// 引擎
export { V6ScoreEngine } from './engine'
export { buildFactorContributions } from './factorContributions'

// 计算器
export { LMinus1Calculator } from './calculators/lMinus1'
export { L0MacroCalculator, L1MoatCalculator, L2PeerCalculator } from './calculators/l0_l1_l2'
export { L3aFinancialCalculator, L3vValuationCalculator } from './calculators/l3'
export { L4ScenarioCalculator, L5TMCalculator, L6HypeCalculator } from './calculators/l4_l5_l6'
export { L7SecondCurveCalculator, L8ChipCalculator } from './calculators/l7_l8'

// LLM 增强器
export { LLMScoreEnhancer, llmEnhancer } from './enhancer'

// 便捷函数：创建配置好的引擎实例
import { V6ScoreEngine } from './engine'
import { LMinus1Calculator } from './calculators/lMinus1'
import { L0MacroCalculator, L1MoatCalculator, L2PeerCalculator } from './calculators/l0_l1_l2'
import { L3aFinancialCalculator, L3vValuationCalculator } from './calculators/l3'
import { L4ScenarioCalculator, L5TMCalculator, L6HypeCalculator } from './calculators/l4_l5_l6'
import { L7SecondCurveCalculator, L8ChipCalculator } from './calculators/l7_l8'
import type { V6ScoreConfigOverride } from './config'
import type { V6Score } from '@/data/types'
import type { ScoreAuditTrail } from './types'

/** V6Score 携带可选审计追踪（只读消费，不修改共享数据结构） */
export type V6ScoreWithAudit = V6Score & { audit?: ScoreAuditTrail }

/** 创建预配置完整引擎（含所有 11 层计算器） */
export function createV6Engine(override?: V6ScoreConfigOverride): V6ScoreEngine {
  const engine = new V6ScoreEngine(override)
  engine.registerCalculators([
    LMinus1Calculator,
    L0MacroCalculator,
    L1MoatCalculator,
    L2PeerCalculator,
    L3aFinancialCalculator,
    L3vValuationCalculator,
    L4ScenarioCalculator,
    L5TMCalculator,
    L6HypeCalculator,
    L7SecondCurveCalculator,
    L8ChipCalculator,
  ])
  return engine
}