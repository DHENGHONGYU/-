/**
 * 编排器门面入口（Facade + DI Container）
 *
 * 对外只暴露统一 API（collectAllDimensions / collectDimension / getQuote 等），
 * 内部组装所有组件：
 *   MarketDataFetcher → ResilienceChain(降级链) → PhaseOrchestrator(编排)
 *   DataBridgeWriter(写入)  → withLogging(AOP日志)
 *
 * 工厂模式：
 *   - 生产环境：getOrchestratorFacade() → 注入真实实现
 *   - 开发/测试：createMockFacade() → 注入 Mock 实现（不触发网络请求）
 *
 * 向后兼容：原 dataSourceOrchestrator.ts 的所有导出均通过此门面代理。
 */

import { getLogger } from '@/lib/logger'
import { collectBasic } from '../fetcherClient'
import type { KlineItem, StockQuote } from '../directDataAPI'
import { DataBridgeWriter } from './adapters/dataBridgeWriter'
import { MarketDataFetcher } from './adapters/marketDataFetcher'
import { withLogging } from './loggingAspect'
import {
  PhaseOrchestrator,
  collectDimension,
  createDefaultSteps,
} from './phaseOrchestrator'
import { ResilienceChain } from './resilienceChain'
import { nanoid } from 'nanoid'
import type {
  CollectResult,
  CollectSession,
  IMarketDataFetcher,
  IDataBridgeWriter,
  OrchestratorContext,
} from './ports'

const logger = getLogger()

/** 全局采集会话 ID 计数器（与原 dataSourceOrchestrator.ts 一致） */
let globalCollectSessionId = 0

export class OrchestratorFacade {
  private readonly fetcher: IMarketDataFetcher
  private readonly writer: IDataBridgeWriter
  private readonly orchestrator: PhaseOrchestrator
  private readonly basicCollector: (code: string) => Promise<boolean>

  /**
   * @param fetcher  可选：自定义行情采集器（测试时注入 Mock）
   * @param writer   可选：自定义写入器（测试时注入 Mock）
   */
  constructor(
    fetcher?: IMarketDataFetcher,
    writer?: IDataBridgeWriter,
  ) {
    // 依赖注入：未提供时使用默认真实实现
    const marketDataFetcher = new MarketDataFetcher()
    this.fetcher = fetcher ?? new ResilienceChain(marketDataFetcher)
    this.writer = writer ?? new DataBridgeWriter()

    // Phase 2/3 维度采集函数（委托给 fetcherClient）
    this.basicCollector = async (code: string): Promise<boolean> => {
      try {
        const resp = await collectBasic(code)
        return resp.success
      } catch (err) {
        logger.warn('[OrchestratorFacade] collectBasic 失败', {
          code,
          error: err instanceof Error ? err.message : String(err),
        })
        return false
      }
    }

    // 创建带 AOP 日志的编排步骤
    const rawSteps = createDefaultSteps()
    const loggedSteps = rawSteps.map((step) => withLogging(step))
    this.orchestrator = new PhaseOrchestrator(loggedSteps)
  }

  // ============================================================
  // 核心 API
  // ============================================================

  /**
   * 全量采集编排：按 F-1 时序规范执行 Phase 1→2→3→4。
   * 对外保持与原 collectAllDimensions 完全相同的签名和返回值。
   */
  async collectAllDimensions(symbols: string[]): Promise<CollectSession> {
    const sessionId = `collect-${nanoid(8)}-${++globalCollectSessionId}`
    const sessionStart = Date.now()

    logger.info('[OrchestratorFacade] ====== 采集会话启动 ======', {
      sessionId,
      symbolCount: symbols.length,
      symbols: symbols.slice(0, 10),
    })

    const ctx: OrchestratorContext = {
      sessionId,
      symbols,
      fetcher: this.fetcher,
      writer: this.writer,
      collectBasic: this.basicCollector,
      phaseSummaries: [],
      allResults: [],
      sessionStart,
    }

    const result = await this.orchestrator.run(ctx)
    const totalLatency = Date.now() - sessionStart

    const dataQuality = result.phaseSummaries.some((p) => p.stale)
      ? 'stale'
      : result.phaseSummaries.some((p) => p.partial)
        ? 'partial'
        : 'fresh'

    logger.info('[OrchestratorFacade] ====== 采集会话完成 ======', {
      sessionId: result.sessionId,
      totalLatencyMs: totalLatency,
      totalLatencySec: Math.round((totalLatency / 1000) * 100) / 100,
      phases: result.phaseSummaries.map((p) => ({
        phase: p.phase,
        durationMs: p.durationMs,
        success: p.successCount,
        failed: p.failedCount,
      })),
      dataQuality,
    })

    return {
      sessionId: result.sessionId,
      phases: result.phaseSummaries,
      totalLatency,
    }
  }

  /**
   * 单维度采集：对外保持与原 collectDimension 完全相同的签名。
   */
  async collectDimension(
    dimension: string,
    symbols: string[],
  ): Promise<CollectResult> {
    return collectDimension(dimension, symbols, {
      fetcher: this.fetcher,
      writer: this.writer,
      collectBasic: this.basicCollector,
    })
  }

  // ============================================================
  // 向后兼容 API（原 dataSourceOrchestrator.ts 导出的函数）
  // ============================================================

  /** 获取个股实时行情（含降级链） */
  async getQuote(code: string): Promise<StockQuote> {
    return this.fetcher.fetchQuote(code)
  }

  /** 获取个股 K 线（含降级链） */
  async getKline(code: string, days: number): Promise<KlineItem[]> {
    return this.fetcher.fetchKline(code, days)
  }

  /** 将行情写入存储（含重试） */
  async writeToStorage(quote: StockQuote): Promise<void> {
    return this.writer.writeQuote(quote)
  }
}

// ============================================================
// 单例工厂
// ============================================================

let facadeInstance: OrchestratorFacade | null = null

/**
 * 获取编排器门面单例（生产环境）。
 * 首次调用时自动组装所有真实实现。
 */
export function getOrchestratorFacade(): OrchestratorFacade {
  facadeInstance ??= new OrchestratorFacade()
  return facadeInstance
}

/**
 * 重置门面单例（仅用于测试）。
 */
export function resetOrchestratorFacade(): void {
  facadeInstance = null
}
