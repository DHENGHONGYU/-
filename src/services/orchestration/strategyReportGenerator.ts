/**
 * @fileoverview 策略报告生成器 — 监听策略分层完成事件，聚合校对结果和策略数据，生成标准报告
 *
 * 报告包含 6 个 section：
 *   1. summary       — 整体概要
 *   2. buy_signals   — 买入信号（评分 >= 3.5）
 *   3. sell_signals  — 卖出信号（评分 < 3.0）
 *   4. event_drivers — 催化事件汇总
 *   5. volatility_alerts — 波动预警（预留接口）
 *   6. score_changes — 评分变动记录
 *
 * @module services/orchestration/strategyReportGenerator
 * @created 2026-07-25 - P1 编排器扩展
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'
import { getCatalystTracker } from './catalystTracker'
import type { CatalystEvent } from './catalystTracker'
import type { CalibrationResult } from './scoreCalibrator'

const logger = getLogger()

// ---- 类型定义 ----

export interface StrategyReportSection {
  id: string
  title: string
  type: 'summary' | 'buy_signals' | 'sell_signals' | 'event_drivers' | 'volatility_alerts' | 'score_changes'
  content: string
  data?: Record<string, unknown>
  timestamp: number
}

export interface StrategyReport {
  id: string
  generatedAt: number
  title: string
  sections: StrategyReportSection[]
  metadata: {
    totalStocks: number
    coreScarceCount: number
    valueBargainCount: number
    hotMomentumCount: number
    watchCount: number
    manualReviewCount: number
    catalystCount: number
  }
}

export interface StrategyReportGeneratorConfig {
  /** 是否自动生成报告（默认 true） */
  autoGenerate?: boolean
  /** 是否包含买入信号 section（默认 true） */
  includeBuySignals?: boolean
  /** 是否包含卖出信号 section（默认 true） */
  includeSellSignals?: boolean
  /** 是否包含事件驱动 section（默认 true） */
  includeEventDrivers?: boolean
  /** 是否包含波动预警 section（默认 true） */
  includeVolatilityAlerts?: boolean
  /** 是否包含评分变动 section（默认 true） */
  includeScoreChanges?: boolean
}

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<StrategyReportGeneratorConfig> = {
  autoGenerate: true,
  includeBuySignals: true,
  includeSellSignals: true,
  includeEventDrivers: true,
  includeVolatilityAlerts: true,
  includeScoreChanges: true,
}

// ---- 策略报告生成器 ----

export class StrategyReportGenerator {
  private config: Required<StrategyReportGeneratorConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 上一次校对结果（用于评分变动对比） */
  private previousCalibrations: Map<string, number> = new Map()
  /** 历史报告列表 */
  private reports: StrategyReport[] = []

  constructor(config?: StrategyReportGeneratorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 启动报告生成器 — 订阅策略分层完成事件 */
  start(): void {
    if (this._active) return
    this._active = true

    const unsub = eventBus.on(EVENT_NAMES.STRATEGY_CLASSIFICATION_DONE, (payload: unknown) => {
      if (!this.config.autoGenerate) return
      this.handleClassificationDone(payload)
    })

    this.unsubscribers.push(unsub)
    logger.info('[StrategyReportGenerator] 已启动，监听策略分层完成事件')
  }

  /** 停止报告生成器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[StrategyReportGenerator] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  // ---- 事件处理 ----

  /** 处理策略分层完成事件 */
  private handleClassificationDone(payload: unknown): void {
    const p = payload as {
      calibrations?: CalibrationResult[]
      strategy?: unknown
      timestamp?: number
    }

    const calibrations = p.calibrations ?? []
    const strategyData = p.strategy

    try {
      const report = this.generateReport(calibrations, strategyData)
      this.reports.push(report)

      logger.info('[StrategyReportGenerator] 报告已生成', {
        reportId: report.id,
        totalStocks: report.metadata.totalStocks,
      })

      eventBus.emit(EVENT_NAMES.STRATEGY_REPORT_GENERATED, report)
    } catch (e) {
      logger.error('[StrategyReportGenerator] 报告生成失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  // ---- 报告生成 ----

  /** 生成标准策略报告 */
  generateReport(calibrations: CalibrationResult[], _strategyData: unknown): StrategyReport {
    const sections: StrategyReportSection[] = []
    const now = Date.now()

    // 统计各 tier 数量
    const coreScarceCount = calibrations.filter((c) => c.strategyTier === 'core-scarce').length
    const valueBargainCount = calibrations.filter((c) => c.strategyTier === 'value-bargain').length
    const hotMomentumCount = calibrations.filter((c) => c.strategyTier === 'hot-momentum').length
    const watchCount = calibrations.filter((c) => c.strategyTier === 'watch').length
    const manualReviewCount = calibrations.filter((c) => c.needsManualReview).length

    // 获取催化事件
    let catalystCount = 0
    try {
      const tracker = getCatalystTracker()
      catalystCount = tracker.getAllCatalysts().length
    } catch {
      // CatalystTracker 可能未启动
    }

    // 1. summary — 整体概要
    sections.push(this.buildSummarySection(calibrations, {
      coreScarceCount,
      valueBargainCount,
      hotMomentumCount,
      watchCount,
      manualReviewCount,
    }, now))

    // 2. buy_signals — 买入信号
    if (this.config.includeBuySignals) {
      sections.push(this.buildBuySignalsSection(calibrations, now))
    }

    // 3. sell_signals — 卖出信号
    if (this.config.includeSellSignals) {
      sections.push(this.buildSellSignalsSection(calibrations, now))
    }

    // 4. event_drivers — 催化事件汇总
    if (this.config.includeEventDrivers) {
      sections.push(this.buildEventDriversSection(now))
    }

    // 5. volatility_alerts — 波动预警（预留）
    if (this.config.includeVolatilityAlerts) {
      sections.push(this.buildVolatilityAlertsSection(now))
    }

    // 6. score_changes — 评分变动
    if (this.config.includeScoreChanges) {
      sections.push(this.buildScoreChangesSection(calibrations, now))
    }

    // 保存本次校对结果用于下次对比
    for (const cal of calibrations) {
      this.previousCalibrations.set(cal.symbol, cal.finalScore)
    }

    const report: StrategyReport = {
      id: nanoid(12),
      generatedAt: now,
      title: `策略分析报告 — ${new Date(now).toLocaleDateString('zh-CN')}`,
      sections,
      metadata: {
        totalStocks: calibrations.length,
        coreScarceCount,
        valueBargainCount,
        hotMomentumCount,
        watchCount,
        manualReviewCount,
        catalystCount,
      },
    }

    return report
  }

  /** 构建 summary section */
  private buildSummarySection(
    calibrations: CalibrationResult[],
    tierCounts: {
      coreScarceCount: number
      valueBargainCount: number
      hotMomentumCount: number
      watchCount: number
      manualReviewCount: number
    },
    now: number,
  ): StrategyReportSection {
    const avgScore = calibrations.length > 0
      ? calibrations.reduce((sum, c) => sum + c.finalScore, 0) / calibrations.length
      : 0

    const content = [
      `本次分析共涵盖 ${calibrations.length} 只股票，平均评分 ${(avgScore).toFixed(2)}。`,
      `核心稀缺 ${tierCounts.coreScarceCount} 只，价值洼地 ${tierCounts.valueBargainCount} 只，`,
      `热门动量 ${tierCounts.hotMomentumCount} 只，观察舱 ${tierCounts.watchCount} 只。`,
      tierCounts.manualReviewCount > 0 ? `其中 ${tierCounts.manualReviewCount} 只需要人工复核。` : '',
    ].filter(Boolean).join('')

    return {
      id: nanoid(12),
      title: '整体概要',
      type: 'summary',
      content,
      data: {
        totalStocks: calibrations.length,
        averageScore: Number(avgScore.toFixed(2)),
        ...tierCounts,
      },
      timestamp: now,
    }
  }

  /** 构建 buy_signals section */
  private buildBuySignalsSection(calibrations: CalibrationResult[], now: number): StrategyReportSection {
    const buyCandidates = calibrations
      .filter((c) => c.finalScore >= 3.5)
      .sort((a, b) => b.finalScore - a.finalScore)

    const content = buyCandidates.length > 0
      ? buyCandidates.map((c) =>
          `${c.symbol}: 评分 ${c.finalScore.toFixed(2)}，评级 ${c.rating}，分层 ${c.strategyTier}`,
        ).join('\n')
      : '当前无买入信号。'

    return {
      id: nanoid(12),
      title: '买入信号',
      type: 'buy_signals',
      content,
      data: {
        count: buyCandidates.length,
        stocks: buyCandidates.map((c) => ({
          symbol: c.symbol,
          score: c.finalScore,
          rating: c.rating,
          tier: c.strategyTier,
        })),
      },
      timestamp: now,
    }
  }

  /** 构建 sell_signals section */
  private buildSellSignalsSection(calibrations: CalibrationResult[], now: number): StrategyReportSection {
    const sellCandidates = calibrations
      .filter((c) => c.finalScore < 3.0)
      .sort((a, b) => a.finalScore - b.finalScore)

    const content = sellCandidates.length > 0
      ? sellCandidates.map((c) =>
          `${c.symbol}: 评分 ${c.finalScore.toFixed(2)}，评级 ${c.rating}，风险提示：评分低于 3.0 阈值`,
        ).join('\n')
      : '当前无卖出信号。'

    return {
      id: nanoid(12),
      title: '卖出信号',
      type: 'sell_signals',
      content,
      data: {
        count: sellCandidates.length,
        stocks: sellCandidates.map((c) => ({
          symbol: c.symbol,
          score: c.finalScore,
          rating: c.rating,
        })),
      },
      timestamp: now,
    }
  }

  /** 构建 event_drivers section */
  private buildEventDriversSection(now: number): StrategyReportSection {
    let catalysts: CatalystEvent[] = []

    try {
      const tracker = getCatalystTracker()
      catalysts = tracker.getHighImpactCatalysts(3)
    } catch {
      // CatalystTracker 可能未启动
    }

    const content = catalysts.length > 0
      ? catalysts.slice(0, 20).map((c) =>
          `[${c.type}] ${c.symbol}: ${c.title}（影响 ${c.impact}，分数 ${c.impactScore}）`,
        ).join('\n')
      : '当前无高影响催化事件。'

    return {
      id: nanoid(12),
      title: '催化事件汇总',
      type: 'event_drivers',
      content,
      data: {
        count: catalysts.length,
        catalysts: catalysts.slice(0, 20).map((c) => ({
          id: c.id,
          symbol: c.symbol,
          type: c.type,
          impact: c.impact,
          score: c.impactScore,
          title: c.title,
        })),
      },
      timestamp: now,
    }
  }

  /** 构建 volatility_alerts section（预留接口） */
  private buildVolatilityAlertsSection(now: number): StrategyReportSection {
    return {
      id: nanoid(12),
      title: '波动预警',
      type: 'volatility_alerts',
      content: '波动预警模块尚未接入，后续将基于日间波动率、成交量异常等指标提供预警信息。',
      data: { count: 0, alerts: [] },
      timestamp: now,
    }
  }

  /** 构建 score_changes section */
  private buildScoreChangesSection(calibrations: CalibrationResult[], now: number): StrategyReportSection {
    const changes: Array<{
      symbol: string
      previousScore: number
      newScore: number
      delta: number
    }> = []

    for (const cal of calibrations) {
      const prev = this.previousCalibrations.get(cal.symbol)
      if (prev !== undefined && Math.abs(cal.finalScore - prev) > 0.01) {
        changes.push({
          symbol: cal.symbol,
          previousScore: prev,
          newScore: cal.finalScore,
          delta: cal.finalScore - prev,
        })
      }
    }

    // 按变动幅度排序
    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const content = changes.length > 0
      ? changes.map((c) => {
          const direction = c.delta > 0 ? '+' : ''
          return `${c.symbol}: ${c.previousScore.toFixed(2)} → ${c.newScore.toFixed(2)}（${direction}${c.delta.toFixed(2)}）`
        }).join('\n')
      : '本次无评分变动记录（首次生成报告）。'

    return {
      id: nanoid(12),
      title: '评分变动',
      type: 'score_changes',
      content,
      data: {
        count: changes.length,
        changes,
      },
      timestamp: now,
    }
  }

  // ---- 查询接口 ----

  /** 获取最新报告 */
  getLatestReport(): StrategyReport | null {
    return this.reports.length > 0 ? (this.reports[this.reports.length - 1] ?? null) : null
  }

  /** 获取全部报告 */
  getReports(): StrategyReport[] {
    return [...this.reports]
  }

  /** 清空所有数据 */
  clear(): void {
    this.previousCalibrations.clear()
    this.reports = []
    logger.info('[StrategyReportGenerator] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: StrategyReportGenerator | null = null

export function getStrategyReportGenerator(config?: StrategyReportGeneratorConfig): StrategyReportGenerator {
  _instance ??= new StrategyReportGenerator(config)
  return _instance
}

export function startStrategyReportGenerator(config?: StrategyReportGeneratorConfig): StrategyReportGenerator {
  const generator = getStrategyReportGenerator(config)
  generator.start()
  return generator
}
