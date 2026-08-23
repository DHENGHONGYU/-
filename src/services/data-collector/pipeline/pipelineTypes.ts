/**
 * @fileoverview pipelineTypes
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 单次/批量采集链路的共享类型与模式常量。对外 API 由
 * `collectionPipeline.ts`（facade）统一 re-export，保持零破坏。
 *
 * @module services/data-collector/pipeline/pipelineTypes
 */

import type {
  CollectionConfig,
  DimensionPipelineConfig,
  QuoteDataSourceId,
  CollectionTraceSpan,
  CollectionStageRecord,
} from '@/types/modules/collection.types'

/** 采集模式（维度 → 处理分支） */
export type CollectionMode = 'quote' | 'kline' | 'news' | 'research' | 'competitor' | 'index' | 'chip' | 'financial' | 'dividend' | 'consensus' | 'sector' | 'technical' | 'fund_flow' | 'institutional' | 'valuation' | 'unsupported'

/** 非行情维度的受限 mode 子集（handleNonQuoteMode 专用）
 * 2026-08-21 接线修复：补 sector/technical/fund_flow/institutional/valuation 5 个 mode，
 * 原 dispatch 缺失导致维度 10-14 恒报「未知采集模式」（已注册未接线 P0）。 */
export type NonQuoteMode = 'news' | 'research' | 'competitor' | 'index' | 'chip' | 'dividend' | 'consensus' | 'sector' | 'technical' | 'fund_flow' | 'institutional' | 'valuation'

/** 走 handleNonQuoteMode 的非行情 mode 全集（替代超长 || 链，防遗漏）
 * 导出供 dispatch 完整性回归测试断言：DIMENSION_TO_MODE 与 dispatch 不得再漂移。 */
export const NON_QUOTE_MODES: ReadonlySet<CollectionMode> = new Set([
  'news', 'research', 'competitor', 'index', 'chip', 'dividend', 'consensus',
  'sector', 'technical', 'fund_flow', 'institutional', 'valuation',
])

/** 维度 → 采集模式映射 */
export const DIMENSION_TO_MODE: Readonly<Record<string, CollectionMode>> = {
  '01': 'quote',
  '02': 'kline',
  '03': 'chip',
  '04': 'news',
  '05': 'news',
  '06': 'competitor',
  '07': 'index',
  '08': 'research',
  '09': 'financial',
  // P1 新增维度 (2026-08-17): MCP/iFinD 优先采集
  '10': 'sector',            // 热门板块 → MCP sector_data
  '11': 'technical',         // 技术指标 → MCP stock_highfreq_quotes
  '12': 'fund_flow',         // 资金流向 → MCP get_stock_performance
  '13': 'institutional',     // 机构持仓 → MCP get_stock_shareholders
  '14': 'valuation',         // 估值分析 → MCP get_stock_financials
  // P0 新增维度 (2026-08-17): 分红股本 + 一致预期
  '15': 'dividend',          // 分红股本 → Tushare 三 API + 东财爬虫
  '16': 'consensus',         // 一致预期 → 东财爬虫
}

export interface RunSingleTraceOptions {
  symbol: string
  dimensionCode: string
  config: CollectionConfig
  parentTaskId?: string
}

export interface RunBatchTraceOptions {
  symbols: string[]
  dimensionCode: string
  config: CollectionConfig
  parentTaskId?: string
}

export interface TraceResult {
  success: boolean
  symbol: string
  dimensionCode: string
  source?: QuoteDataSourceId
  latency: number
  fallbackCount: number
  error?: string
}

/**
 * 单次链路上下文——在 runSingleTraceImpl 中构造一次，下放给各分模式处理器，
 * 避免处理器之间通过超长函数共享大量局部变量（P2 复杂度还款：抽取降嵌套）。
 */
export interface SingleTraceContext {
  symbol: string
  dimensionCode: string
  dimension: DimensionPipelineConfig
  config: CollectionConfig
  traceId: string
  taskId: string
  startedAt: number
  span: CollectionTraceSpan
  addStage: (stage: CollectionStageRecord['stage'], message: string, sourceId?: QuoteDataSourceId, error?: string) => void
}
