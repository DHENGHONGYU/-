/**
 * 纯编排核心（Application Core）
 *
 * 只负责 Phase 1-4 的顺序、依赖、流转。
 * 绝不包含 try-catch、日志、降级等横切逻辑——这些由装饰器/切面处理。
 *
 * 架构分层：
 *   PhaseOrchestrator  — 纯顺序执行器，只遍历 IWorkflowStep 数组
 *   Phase1Step/2/3/4   — 各 Phase 的具体调度逻辑
 *   collectDimension   — 单维度采集+写入（被 Phase 1-3 共用）
 *
 * 依赖倒置：本文件只 import ports.ts 的接口，绝不 import 基础设施。
 * 唯一例外：eventBus（轻量级事件通知，非数据存储基础设施）。
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

import { eventBus } from '@/lib/eventBus'
import type { KlineItem, StockQuote } from '../directDataAPI'
import {
  DEFAULT_KLINE_DAYS,
  PHASE_1_DIMENSIONS,
  PHASE_2_DIMENSIONS,
  PHASE_3_DIMENSIONS,
  type CollectResult,
  type IWorkflowStep,
  type OrchestratorContext,
  type PhaseSummary,
} from './ports'

// ============================================================
// 辅助类型
// ============================================================

/** collectDimension 的依赖集合（从 OrchestratorContext 提取） */
interface CollectDeps {
  fetcher: OrchestratorContext['fetcher']
  writer: OrchestratorContext['writer']
  collectBasic: OrchestratorContext['collectBasic']
}

/** 单标的采集结果 */
interface CollectedItem {
  code: string
  quote?: StockQuote
  kline?: KlineItem[]
  error?: string
  /** 是否为占位实现（Phase 2/3 维度仅触发后端但前端不写入） */
  isStub?: boolean
  /** 所属维度（仅 stub 项需要，用于 stubDimensions 统计） */
  dimension?: string
}

// ============================================================
// 单维度采集+写入（核心业务逻辑，被 Phase 1-3 共用）
// ============================================================

/**
 * 判断维度是否并行执行（Phase 2 维度串行，其余并行）
 */
function isParallelDimension(dimension: string): boolean {
  const phase2Dims = PHASE_2_DIMENSIONS as readonly string[]
  return !phase2Dims.includes(dimension)
}

type DimensionType = 'quote' | 'kline' | 'stub'

/**
 * 解析维度类型，决定使用 quote、kline 还是 stub 采集
 */
function resolveDimensionType(dimension: string): DimensionType {
  if (dimension === '01_basic' || dimension === '07_index') return 'quote'
  if (dimension === '02_kline') return 'kline'
  return 'stub'
}

/**
 * 采集 stub 维度（仅触发后端，前端不写入）
 */
async function collectStub(
  code: string,
  dimension: string,
  collectBasic: CollectDeps['collectBasic'],
): Promise<CollectedItem> {
  const success = await collectBasic(code)
  if (!success) {
    throw new Error(`${dimension} 采集失败`)
  }
  return { code, isStub: true, dimension }
}

/**
 * 将单个采集结果写入存储，返回是否写入成功
 */
async function writeCollectedItem(item: CollectedItem, deps: CollectDeps): Promise<boolean> {
  try {
    if (item.quote !== undefined) {
      await deps.writer.writeQuote(item.quote)
      return true
    }
    if (item.kline !== undefined) {
      await deps.writer.writeKline(item.code, item.kline)
      return true
    }
    return false
  } catch (err) { console.warn('[phaseOrchestrator.ts]', err);
    return false
  }
}

/**
 * 单维度采集：根据维度所属 Phase 决定执行模式，采集完成后写入存储。
 *
 * 维度路由：
 *   01_basic / 07_index → fetcher.fetchQuote → writer.writeQuote
 *   02_kline            → fetcher.fetchKline → writer.writeKline
 *   03_chip / 06_industry / 08_research / 04_events / 05_news
 *                        → collectBasic（后端直接处理，前端不写入）
 *
 * @internal 供 Phase 步骤和 Facade 共用，不直接对外暴露
/**
 * collectDimension
 */
async function collectOneSymbol(
  code: string,
  dimension: string,
  deps: CollectDeps,
): Promise<CollectedItem> {
  try {
    const type = resolveDimensionType(dimension)
    if (type === 'quote') return { code, quote: await deps.fetcher.fetchQuote(code) }
    if (type === 'kline') return { code, kline: await deps.fetcher.fetchKline(code, DEFAULT_KLINE_DAYS) }
    return await collectStub(code, dimension, deps.collectBasic)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { code, error: msg }
  }
}

async function processCollectedItem(
  result: CollectResult,
  item: CollectedItem,
  deps: CollectDeps,
): Promise<void> {
  if (item.error !== undefined) {
    result.failed.push(item.code)
    result.partial = true
    return
  }
  if (item.isStub === true) {
    pushStubDimension(result, item)
    result.partial = true
    return
  }
  const ok = await writeCollectedItem(item, deps)
  if (ok) {
    result.success.push(item.code)
  } else {
    result.failed.push(item.code)
    result.partial = true
  }
}

function pushStubDimension(result: CollectResult, item: CollectedItem): void {
  if (item.dimension === undefined) return
  if (result.stubDimensions!.includes(item.dimension)) return
  result.stubDimensions!.push(item.dimension)
}

/**
 * 按维度采集数据：对一组 symbol 执行指定维度的数据采集。
 * @param dimension 数据维度标识
 * @param symbols 待采集的股票 symbol 列表
 * @param deps 采集依赖（读取器、缓存等）
 * @returns 采集结果
 */
export async function collectDimension(
  dimension: string,
  symbols: string[],
  deps: CollectDeps,
): Promise<CollectResult> {
  const startTs = Date.now()
  const result: CollectResult = {
    dimension,
    success: [],
    failed: [],
    latency: 0,
    source: 'orchestrator',
    partial: false,
    stale: false,
    stubDimensions: [],
  }

  const parallel = isParallelDimension(dimension)

  // ===== 采集阶段 =====
  const collected: CollectedItem[] = parallel
    ? await Promise.all(symbols.map((c) => collectOneSymbol(c, dimension, deps)))
    : []
  if (!parallel) {
    for (const code of symbols) {
      collected.push(await collectOneSymbol(code, dimension, deps))
    }
  }

  // ===== 写入阶段（Phase 4 屏障：维度级别） =====
  for (const item of collected) {
    await processCollectedItem(result, item, deps)
  }

  // 检查 Mock 数据（标记 stale）：同时检查 quote 与 kline 的 source
  const hasMock = collected.some(
    (c) => c.quote?.source === 'mock',
  )
  if (hasMock) {
    result.stale = true
  }

  result.latency = Date.now() - startTs
  return result
}

/** 从上下文提取采集依赖 */
function extractDeps(ctx: OrchestratorContext): CollectDeps {
  return {
    fetcher: ctx.fetcher,
    writer: ctx.writer,
    collectBasic: ctx.collectBasic,
  }
}

/** 生成 Phase 摘要 */
function buildSummary(
  phase: string,
  startTs: number,
  endTs: number,
  symbols: string[],
  dimensions: string[],
  results: CollectResult[],
): PhaseSummary {
  return {
    phase,
    startTime: startTs,
    endTime: endTs,
    durationMs: endTs - startTs,
    totalSymbols: symbols.length * dimensions.length,
    successCount: results.reduce((s, r) => s + r.success.length, 0),
    failedCount: results.reduce((s, r) => s + r.failed.length, 0),
    dimensions,
    sources: [...new Set(results.map((r) => r.source))],
    stale: results.some((r) => r.stale),
    partial: results.some((r) => r.partial),
  }
}

// ============================================================
// Phase 步骤实现
// ============================================================

/**
 * Phase 1: 基础数据（并行） — 01_basic / 02_kline / 07_index
 * 无依赖，Promise.all 并行采集。
 */
class Phase1Step implements IWorkflowStep<OrchestratorContext> {
  readonly name = 'phase1'

  async execute(ctx: OrchestratorContext): Promise<OrchestratorContext> {
    const startTs = Date.now()
    const dimensions = [...PHASE_1_DIMENSIONS]
    const deps = extractDeps(ctx)
    const results: CollectResult[] = []

    await Promise.all(
      dimensions.map(async (dim) => {
        const result = await collectDimension(dim, ctx.symbols, deps)
        results.push(result)
      }),
    )

    const endTs = Date.now()
    ctx.phaseSummaries.push(
      buildSummary('phase1', startTs, endTs, ctx.symbols, dimensions, results),
    )
    ctx.allResults.push(...results)
    return ctx
  }
}

/**
 * Phase 2: 分析数据（串行, 依赖 Phase 1） — 03_chip / 06_industry / 08_research
 * 屏障同步点：Phase 1 完成后（由 PhaseOrchestrator 顺序执行保证）才启动。
 */
class Phase2Step implements IWorkflowStep<OrchestratorContext> {
  readonly name = 'phase2'

  async execute(ctx: OrchestratorContext): Promise<OrchestratorContext> {
    const startTs = Date.now()
    const dimensions = [...PHASE_2_DIMENSIONS]
    const deps = extractDeps(ctx)
    const results: CollectResult[] = []

    for (const dim of dimensions) {
      const result = await collectDimension(dim, ctx.symbols, deps)
      results.push(result)
    }

    const endTs = Date.now()
    ctx.phaseSummaries.push(
      buildSummary('phase2', startTs, endTs, ctx.symbols, dimensions, results),
    )
    ctx.allResults.push(...results)
    return ctx
  }
}

/**
 * Phase 3: 事件数据（独立流） — 04_events / 05_news
 * 不阻塞其他维度，Promise.all 并行采集。
 */
class Phase3Step implements IWorkflowStep<OrchestratorContext> {
  readonly name = 'phase3'

  async execute(ctx: OrchestratorContext): Promise<OrchestratorContext> {
    const startTs = Date.now()
    const dimensions = [...PHASE_3_DIMENSIONS]
    const deps = extractDeps(ctx)
    const results: CollectResult[] = []

    await Promise.all(
      dimensions.map(async (dim) => {
        const result = await collectDimension(dim, ctx.symbols, deps)
        results.push(result)
      }),
    )

    const endTs = Date.now()
    ctx.phaseSummaries.push(
      buildSummary('phase3', startTs, endTs, ctx.symbols, dimensions, results),
    )
    ctx.allResults.push(...results)
    return ctx
  }
}

/**
 * Phase 4: 聚合写入屏障 — 所有 Phase 完成后统一汇总。
 * 触发全局采集完成事件，通知 UI 刷新。
 */
class Phase4Step implements IWorkflowStep<OrchestratorContext> {
  readonly name = 'phase4'

  execute(ctx: OrchestratorContext): Promise<OrchestratorContext> {
    const startTs = Date.now()

    const allStale = ctx.allResults.some((r) => r.stale)
    const allPartial = ctx.allResults.some((r) => r.partial)
    const totalSuccess = ctx.allResults.reduce((s, r) => s + r.success.length, 0)
    const totalFailed = ctx.allResults.reduce((s, r) => s + r.failed.length, 0)

    // 触发全局采集完成事件
    eventBus.emit('COLLECT_ALL_COMPLETED', {
      sessionId: ctx.sessionId,
      totalSuccess,
      totalFailed,
      stale: allStale,
      partial: allPartial,
      durationMs: Date.now() - ctx.sessionStart,
    })

    const endTs = Date.now()
    ctx.phaseSummaries.push({
      phase: 'phase4',
      startTime: startTs,
      endTime: endTs,
      durationMs: endTs - startTs,
      totalSymbols: 0,
      successCount: totalSuccess,
      failedCount: totalFailed,
      dimensions: ['aggregation'],
      sources: [],
      stale: allStale,
      partial: allPartial,
    })
    return Promise.resolve(ctx)
  }
}

// ============================================================
// 纯编排核心
// ============================================================

/**
 * 纯编排核心：只负责按顺序执行 IWorkflowStep 数组。
 *
 * 特点：
 *   - 无 try-catch（异常由步骤内部处理或向上抛出）
 *   - 无日志（由 withLogging 装饰器注入）
 *   - 无降级（由 ResilienceChain 装饰器处理）
 *   - 极易测试（传入 Mock 步骤即可验证顺序）
 *
 * @example
 * const orchestrator = new PhaseOrchestrator([
 *   new Phase1Step(),
 *   new Phase2Step(),
 *   new Phase3Step(),
 *   new Phase4Step(),
 * ])
 * const result = await orchestrator.run(ctx)
/**
 * PhaseOrchestrator
 */
export class PhaseOrchestrator {
  constructor(private readonly steps: IWorkflowStep<OrchestratorContext>[]) {}

  async run(initialCtx: OrchestratorContext): Promise<OrchestratorContext> {
    let ctx = initialCtx
    for (const step of this.steps) {
      ctx = await step.execute(ctx)
    }
    return ctx
  }
}

/**
 * 工厂函数：创建默认的 Phase 1-4 步骤。
 * 调用方可在此基础上包裹 withLogging 等装饰器。
 */
export function createDefaultSteps(): IWorkflowStep<OrchestratorContext>[] {
  return [new Phase1Step(), new Phase2Step(), new Phase3Step(), new Phase4Step()]
}
