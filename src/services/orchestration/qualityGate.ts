/**
 * @fileoverview 质量门禁 — 监听采集完成事件，校验采集质量后触发分析引擎
 *
 * @module services/orchestration/qualityGate
 * @created 2026-07-25 - P0 数据链路打通
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getQualityMetrics } from '@/services/data-collector/qualityMetricsCollector'
import { runBatchTrace, createDefaultCollectionConfig } from '@/services/data-collector/collectionPipeline'
import { dataBridge, ENVELOPE_ACTION, STORE_NAME } from '@/core/databridge'
import { runFullIndustryAnalysis } from '@/services/analysis/industryAnalysisService'
import { runV6ScoreBatch } from '@/services/scoring/v6ScoreService'
import { getLogger } from '@/lib/logger'
import type { QualityMetrics } from '@/services/data-collector/qualityMetricsCollector'

const logger = getLogger()

/** 质量门禁阈值配置 */
export interface QualityGateThresholds {
  requiredSuccessRate: number
  requiredCompleteness: number
  requiredWriteRate: number
  dimensionCompletenessMap: Record<string, number>
}

/** 质量检查结果 */
export interface QualityGateResult {
  passed: boolean
  metrics: Readonly<QualityMetrics>
  missingDimensions: string[]
  missingReports: number
  timestamp: number
  reason?: string
}

const DEFAULT_THRESHOLDS: QualityGateThresholds = {
  requiredSuccessRate: 0.95,
  requiredCompleteness: 0.90,
  requiredWriteRate: 0.95,
  dimensionCompletenessMap: {
    quote: 1.0,
    kline: 1.0,
    news: 0.8,
    research: 0.8,
    competitor: 0.6,
    index: 0.6,
    chip: 0.6,
    'research-detail': 0.6,
  },
}

export class QualityGate {
  private thresholds: QualityGateThresholds
  private unsubscribers: (() => void)[] = []
  private _active = false
  private dimensionTracker: Map<string, Set<string>> = new Map()
  private retryCount = 0
  private readonly maxRetries = 2

  constructor(thresholds?: Partial<QualityGateThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
  }

  start(): void {
    if (this._active) return
    this._active = true

    const unsub1 = eventBus.on('collect:complete', (payload: unknown) => {
      const p = payload as { symbol: string; dimensionCode: string; success: boolean }
      this.trackDimensionComplete(p)
    })

    const unsub2 = eventBus.on(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, (payload: unknown) => {
      const p = payload as { symbols: string[] }
      void this.evaluateAndProceed(p)
    })

    this.unsubscribers.push(unsub1, unsub2)
    logger.info('[QualityGate] 已启动')
  }

  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    this.dimensionTracker.clear()
    this.retryCount = 0
    logger.info('[QualityGate] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  private trackDimensionComplete(payload: { symbol: string; dimensionCode: string; success: boolean }): void {
    const { symbol, dimensionCode, success } = payload
    if (!success) return
    if (!this.dimensionTracker.has(symbol)) {
      this.dimensionTracker.set(symbol, new Set())
    }
    this.dimensionTracker.get(symbol)!.add(dimensionCode)
  }

  private async evaluateAndProceed(payload: { symbols: string[] }): Promise<void> {
    const symbols = payload.symbols ?? []
    const metrics = getQualityMetrics().snapshot()
    const qualityResult = this.checkQuality(metrics)

    eventBus.emit(EVENT_NAMES.QUALITY_GATE_CHECKED, qualityResult)

    if (!qualityResult.passed) {
      eventBus.emit(EVENT_NAMES.QUALITY_GATE_FAILED, qualityResult)
      logger.warn('[QualityGate] 质量未达标', { reason: qualityResult.reason })

      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        logger.info(`[QualityGate] 第 ${this.retryCount} 次补采`)
        await this.retryMissingDimensions(symbols, qualityResult.missingDimensions)
        setTimeout(() => void this.evaluateAndProceed(payload), 3000)
      } else {
        logger.error('[QualityGate] 补采次数耗尽，放行已有数据')
        this.retryCount = 0
        await this.triggerAnalysis(symbols)
      }
      return
    }

    eventBus.emit(EVENT_NAMES.QUALITY_GATE_PASSED, qualityResult)
    logger.info('[QualityGate] 质量达标，触发分析引擎')
    this.retryCount = 0
    await this.triggerAnalysis(symbols)
  }

  checkQuality(metrics: Readonly<QualityMetrics>): QualityGateResult {
    const missingDimensions: string[] = []

    if (metrics.successRate < this.thresholds.requiredSuccessRate) {
      return {
        passed: false, metrics, missingDimensions, missingReports: 0,
        timestamp: Date.now(),
        reason: `采集成功率 ${(metrics.successRate * 100).toFixed(1)}% < ${(this.thresholds.requiredSuccessRate * 100).toFixed(1)}%`,
      }
    }

    if (metrics.completeness < this.thresholds.requiredCompleteness) {
      return {
        passed: false, metrics, missingDimensions, missingReports: 0,
        timestamp: Date.now(),
        reason: `字段完整率 ${(metrics.completeness * 100).toFixed(1)}% < ${(this.thresholds.requiredCompleteness * 100).toFixed(1)}%`,
      }
    }

    const allDimensions = Object.keys(this.thresholds.dimensionCompletenessMap)
    for (const _symbol of this.dimensionTracker.keys()) {
      const completed = this.dimensionTracker.get(_symbol)!
      for (const dim of allDimensions) {
        if (!completed.has(dim) && !missingDimensions.includes(dim)) {
          missingDimensions.push(dim)
        }
      }
    }

    const requiredMissing = missingDimensions.filter(
      (d) => (this.thresholds.dimensionCompletenessMap[d] ?? 0) >= 1.0,
    )
    if (requiredMissing.length > 0) {
      return {
        passed: false, metrics, missingDimensions: requiredMissing, missingReports: 0,
        timestamp: Date.now(),
        reason: `必须维度缺失: ${requiredMissing.join(', ')}`,
      }
    }

    return { passed: true, metrics, missingDimensions: [], missingReports: 0, timestamp: Date.now() }
  }

  private async retryMissingDimensions(symbols: string[], dimensions: string[]): Promise<void> {
    if (dimensions.length === 0) return
    const config = createDefaultCollectionConfig()
    await Promise.allSettled(
      dimensions.map((dim) => runBatchTrace({ symbols, dimensionCode: dim, config })),
    )
  }

  private async triggerAnalysis(symbols: string[]): Promise<void> {
    const stockData = await this.loadStocksWithData(symbols)
    if (stockData.length === 0) {
      logger.warn('[QualityGate] 无可分析的股票数据')
      return
    }

    try {
      const analysisResult = await runFullIndustryAnalysis(
        stockData as Parameters<typeof runFullIndustryAnalysis>[0],
      )
      eventBus.emit(EVENT_NAMES.ANALYSIS_INDUSTRY_COMPLETED, analysisResult)
      logger.info('[QualityGate] 行业分析完成')

      // P0-2: 行业分析完成后触发 V6 批量评分
      try {
        const batchResult = await runV6ScoreBatch(symbols)
        eventBus.emit(EVENT_NAMES.V6_BATCH_SCORE_COMPLETED, batchResult)
        logger.info('[QualityGate] V6 批量评分完成', {
          total: batchResult.data?.stats?.total ?? 0,
          completed: batchResult.data?.stats?.completed ?? 0,
        })
      } catch (e) {
        logger.error('[QualityGate] V6 批量评分失败', { error: e instanceof Error ? e.message : String(e) })
      }
    } catch (e) {
      logger.error('[QualityGate] 行业分析失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  /**
   * 加载股票基础数据 + 行情数据 + 财务数据
   * P0-3 修复：不再传空 financials/quotes，而是从 DB 查询真实数据
   * 每只股票的三个数据源查询均记录耗时，用于性能监控和瓶颈定位
   */
  private async loadStocksWithData(
    symbols: string[],
  ): Promise<Array<{ stock: unknown; financials: Record<string, unknown>; quotes: Record<string, unknown> }>> {
    const results: Array<{ stock: unknown; financials: Record<string, unknown>; quotes: Record<string, unknown> }> = []
    const batchStart = performance.now()

    for (const symbol of symbols) {
      const symbolStart = performance.now()
      try {
        // 1. 查询股票基础数据
        const t0 = performance.now()
        const stockRes = await dataBridge.query({
          action: ENVELOPE_ACTION.queryGet,
          store: STORE_NAME.stocks,
          key: symbol,
        })
        const stockMs = performance.now() - t0
        if ((stockRes.success ?? false) !== true || stockRes.data == null) {
          logger.warn(`[QualityGate] 股票 ${symbol} 不存在于DB，跳过`, { stockMs: Math.round(stockMs) })
          continue
        }
        const stock = stockRes.data

        // 2. 查询行情数据（可缺失，不阻断流程）
        let quotes: Record<string, unknown> = {}
        const t1 = performance.now()
        try {
          const quotesRes = await dataBridge.query({
            action: ENVELOPE_ACTION.queryGet,
            store: STORE_NAME.dailyQuotes,
            key: symbol,
          })
          if (quotesRes.success === true && quotesRes.data != null) {
            quotes = quotesRes.data as Record<string, unknown>
          }
        } catch {
          /* quotes 可缺失 */
        }
        const quotesMs = performance.now() - t1

        // 3. 查询财务数据（可缺失，不阻断流程）
        let financials: Record<string, unknown> = { dataStatus: 'missing' }
        const t2 = performance.now()
        try {
          const finRes = await dataBridge.query({
            action: ENVELOPE_ACTION.queryGet,
            store: STORE_NAME.financialReports,
            key: symbol,
          })
          if (finRes.success === true && finRes.data != null) {
            financials = { ...(finRes.data as Record<string, unknown>), dataStatus: 'complete' }
          }
        } catch {
          /* financials 可缺失 */
        }
        const financialsMs = performance.now() - t2

        const totalMs = performance.now() - symbolStart
        logger.info(`[QualityGate] 数据加载完成 ${symbol}`, {
          stockMs: Math.round(stockMs),
          quotesMs: Math.round(quotesMs),
          financialsMs: Math.round(financialsMs),
          totalMs: Math.round(totalMs),
          finStatus: financials.dataStatus,
          quotesLoaded: Object.keys(quotes).length > 0,
        })

        results.push({ stock, financials, quotes })
      } catch {
        const totalMs = performance.now() - symbolStart
        logger.error(`[QualityGate] 股票 ${symbol} 数据加载异常`, { totalMs: Math.round(totalMs) })
      }
    }

    const batchMs = performance.now() - batchStart
    logger.info('[QualityGate] 批量数据加载完成', {
      symbolCount: symbols.length,
      loadedCount: results.length,
      batchMs: Math.round(batchMs),
    })

    return results
  }
}

let _instance: QualityGate | null = null

export function getQualityGate(thresholds?: Partial<QualityGateThresholds>): QualityGate {
  if (!_instance) _instance = new QualityGate(thresholds)
  return _instance
}

export function startQualityGate(thresholds?: Partial<QualityGateThresholds>): QualityGate {
  const gate = getQualityGate(thresholds)
  gate.start()
  return gate
}
