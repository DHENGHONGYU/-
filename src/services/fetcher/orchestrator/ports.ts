/**
 * 编排器端口接口定义（防腐层 / Anti-Corruption Layer）
 *
 * 定义编排核心与外部基础设施之间的契约边界。
 * 编排核心只依赖这些接口，不依赖具体实现（依赖倒置原则）。
 *
 * 设计原则：
 *   - 编排核心 (phaseOrchestrator.ts) 只 import 本文件，绝不直接 import 基础设施
 *   - 降级链 (resilienceChain.ts) 以装饰器包裹 IMarketDataFetcher，对编排透明
 *   - 日志 (loggingAspect.ts) 以高阶函数包裹 IWorkflowStep，对编排透明
 *   - Mock 仅存在于 mockProvider.ts，生产代码通过 DI 注入真实实现
 */

import type { StockQuote, KlineItem } from '../directDataAPI'

// ============================================================
// 采集结果类型（从 dataSourceOrchestrator.ts 迁移，保持向后兼容）
// ============================================================

export interface CollectResult {
  dimension: string
  success: string[]
  failed: string[]
  latency: number
  source: string
  /** 是否存在部分失败 */
  partial: boolean
  /** 是否降级到 Mock（标记 stale） */
  stale: boolean
  /** 占位实现的维度列表（Phase 2/3 中仅触发后端但前端不写入的维度） */
  stubDimensions?: string[]
}

// ============================================================
// Phase 摘要类型（从 dataSourceOrchestrator.ts 迁移）
// ============================================================

export interface PhaseSummary {
  phase: string
  startTime: number
  endTime: number
  durationMs: number
  totalSymbols: number
  successCount: number
  failedCount: number
  dimensions: string[]
  sources: string[]
  stale: boolean
  partial: boolean
}

// ============================================================
// 采集会话类型（collectAllDimensions 返回值）
// ============================================================

export interface CollectSession {
  sessionId: string
  phases: PhaseSummary[]
  totalLatency: number
}

// ============================================================
// 行情采集端口（Infrastructure Port）
// ============================================================

/**
 * 行情/K线采集端口。
 * 编排核心通过此接口获取数据，不关心数据来源（腾讯/新浪/网易/AKShare/Mock）。
 * 降级链由 ResilienceChain 装饰器在实现层处理。
 */
export interface IMarketDataFetcher {
  /** 获取个股实时行情（实现层内部含降级链） */
  fetchQuote(code: string): Promise<StockQuote>
  /** 获取个股 K 线（实现层内部含降级链） */
  fetchKline(code: string, days: number): Promise<KlineItem[]>
}

// ============================================================
// DataBridge 写入端口（Infrastructure Port）
// ============================================================

/**
 * 数据写入端口。
 * 编排核心通过此接口持久化数据，不关心写入目标（IndexedDB/localStorage/内存）。
 * 重试/限流策略由实现层处理。
 */
export interface IDataBridgeWriter {
  /** 将行情写入存储 */
  writeQuote(quote: StockQuote): Promise<void>
  /** 将 K 线写入存储 */
  writeKline(code: string, items: KlineItem[]): Promise<void>
}

// ============================================================
// 编排步骤接口（Application Port）
// ============================================================

/**
 * 单个编排步骤接口。
 * 编排核心 (PhaseOrchestrator) 只负责按顺序执行 IWorkflowStep 数组，
 * 绝不包含 try-catch、日志、降级等横切逻辑。
 */
export interface IWorkflowStep<T> {
  readonly name: string
  execute(ctx: T): Promise<T>
}

// ============================================================
// 编排上下文
// ============================================================

/**
 * 编排上下文：贯穿 Phase 1-4 的共享状态。
 * 通过上下文传递 fetcher/writer（依赖注入）和累积的采集结果。
 */
export interface OrchestratorContext {
  sessionId: string
  symbols: string[]
  /** 依赖注入：行情采集器（已被降级链装饰器包裹） */
  fetcher: IMarketDataFetcher
  /** 依赖注入：数据写入器 */
  writer: IDataBridgeWriter
  /** 依赖注入：基础维度采集函数（Phase 2/3 维度，AKShare 路由） */
  collectBasic: (code: string) => Promise<boolean>
  /** 累积的 Phase 摘要 */
  phaseSummaries: PhaseSummary[]
  /** 累积的所有维度采集结果 */
  allResults: CollectResult[]
  /** 会话开始时间戳 */
  sessionStart: number
}

// ============================================================
// 降级链配置常量（从 dataSourceOrchestrator.ts 迁移）
// ============================================================

/**
 * QUOTE_FALLBACK_CHAIN
 */
export const QUOTE_FALLBACK_CHAIN = ['tencent', 'sina', 'akshare', 'mock'] as const
/**
 * KLINE_FALLBACK_CHAIN
 */
export const KLINE_FALLBACK_CHAIN = ['netease', 'tencent', 'akshare', 'mock'] as const

export type QuoteSource = (typeof QUOTE_FALLBACK_CHAIN)[number]
export type KlineSource = (typeof KLINE_FALLBACK_CHAIN)[number]

/** 维度 → Phase 映射（从 dataSourceOrchestrator.ts 迁移） */
export const PHASE_1_DIMENSIONS = ['01_basic', '02_kline', '07_index'] as const
/**
 * PHASE_2_DIMENSIONS
 */
export const PHASE_2_DIMENSIONS = ['03_chip', '06_industry', '08_research'] as const
/**
 * PHASE_3_DIMENSIONS
 */
export const PHASE_3_DIMENSIONS = ['04_events', '05_news'] as const

/** 默认 K 线采集天数 */
export const DEFAULT_KLINE_DAYS = 30
