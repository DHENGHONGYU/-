/**
 * @fileoverview HotSectorAnalyzer — 热门板块五维评分引擎（barrel re-export）
 *
 * 基于双策略体系，对热门板块标的进行五维评分：
 * - 动量强度 (momentum):        35%
 * - 情绪热度 (sentiment):       25%
 * - 技术突破 (breakout):         20%
 * - 估值风险 (valuationRisk):    15%
 * - 大盘环境 (marketEnv):        5%
 *
 * 输出：HotSectorScore { overallScore: 0-5, signal: 'buy'|'hold'|'avoid' }
 *
 * 模块拆分（2026-07-07）：
 * - hotSectorDimensions.ts: 五维评分维度函数 + 输入类型 + analyze 综合评分
 * - hotSectorIndicators.ts: 技术指标（MA/RSI）计算
 * - hotSectorPersistence.ts: 持久化与查询（analyzeHotSectors/getLatestHotSectorScore）
 * - hotSectorOrchestrator.ts: 数据获取与编排（analyzeBySymbol/analyzeBatch）
 * - hotSectorAnalyzer.ts（本文件）: barrel re-export，保持原导入路径 API 兼容
 *
 * 循环依赖修复（b6）：
 * - 编排逻辑（analyzeBySymbol/analyzeBatch）已迁移至 hotSectorOrchestrator.ts
 * - 本文件仅作 barrel re-export，不包含任何业务实现
 * - 依赖链单向：persistence → orchestrator → dimensions/indicators（无循环）
 *
 * @module services/scoring/hotSectorAnalyzer
 * @created 2026-06-27 - 基于双策略体系修正
 * @updated 2026-07-07 - 拆分为多模块，编排逻辑迁移至 orchestrator，保持原 API 兼容
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

// ============================================================
// Barrel re-export：保持原导入路径 API 兼容
// ============================================================

// 维度评分函数 + 输入类型
export type {
  MomentumInput,
  SentimentInput,
  BreakoutInput,
  ValuationRiskInput,
  MarketEnvInput,
  HotSectorAnalyzerInput,
  HotSectorScore,
} from './hotSectorDimensions'

export {
  calculateMomentum,
  calculateSentiment,
  calculateBreakout,
  calculateValuationRisk,
  calculateMarketEnv,
  analyze,
} from './hotSectorDimensions'

// 技术指标
export { computeMA, computeRSI } from './hotSectorIndicators'

// 持久化与查询
export {
  analyzeHotSectors,
  getLatestHotSectorScore,
  type HotSectorAnalyzerOptions,
} from './hotSectorPersistence'

// 数据获取与编排
export { analyzeBySymbol, analyzeBatch } from './hotSectorOrchestrator'
