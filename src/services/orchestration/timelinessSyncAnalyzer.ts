/**
 * @fileoverview 择时协同度量化器 — 量化买卖点与股价极值的偏差天数，计算择时准确率
 *
 * 监听交易执行事件，结合历史行情数据查找回溯窗口内的最高/最低价日期，
 * 计算买卖时点与极值的偏差天数，汇总为择时准确率与协同度指标。
 *
 * @module services/orchestration/timelinessSyncAnalyzer
 * @created 2026-07-25 - P2 高级功能模块
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ---- 类型定义 ----

export interface TradeRecord {
  symbol: string
  action: 'buy' | 'sell'
  price: number
  quantity: number
  timestamp: number
  /** 标注：manual=手动标记, signal=信号触发, strategy=策略驱动 */
  source: 'manual' | 'signal' | 'strategy'
}

export interface TimelinessMetrics {
  id: string
  symbol: string
  totalTrades: number
  /** 买点距近期最低点的偏差天数（负=在最低点前，正=在最低点后） */
  buyTimingDeviationDays: number[]
  /** 卖点距近期最高点的偏差天数 */
  sellTimingDeviationDays: number[]
  /** 平均择时偏差（天数绝对值的平均） */
  avgDeviationDays: number
  /** 择时准确率（偏差<=accuracyThresholdDays视为准确） */
  timingAccuracyRate: number
  /** 择时收益率 vs 持有收益率 */
  timingReturnVsHold: number
  /** 周线复盘协同度（0-1，买卖时点与周线趋势的协同程度） */
  weeklyCorrelation: number
}

export interface TimelinessSyncConfig {
  /** 准确率阈值（偏差天数<=此值视为准确），默认3 */
  accuracyThresholdDays?: number
  /** 回溯天数（查找极值的范围），默认30 */
  lookbackDays?: number
  /** 是否自动分析，默认 true */
  autoAnalyze?: boolean
}

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<TimelinessSyncConfig> = {
  accuracyThresholdDays: 3,
  lookbackDays: 30,
  autoAnalyze: true,
}

// ---- 辅助：行情数据接口 ----

/** 行情数据点（由外部数据源提供） */
interface QuotePoint {
  date: string | number
  close: number
  high: number
  low: number
}

// ---- 择时协同度量化器 ----

export class TimelinessSyncAnalyzer {
  private config: Required<TimelinessSyncConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 按 symbol 索引的交易记录 */
  private trades: Map<string, TradeRecord[]> = new Map()
  /** 按 symbol 索引的择时指标 */
  private metrics: Map<string, TimelinessMetrics> = new Map()
  /** 按 symbol 索引的历史行情（用于查找极值） */
  private quoteHistory: Map<string, QuotePoint[]> = new Map()

  constructor(config?: TimelinessSyncConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 启动量化器 — 订阅交易执行事件 */
  start(): void {
    if (this._active) return
    this._active = true

    // 监听交易执行事件（优先 trade:action:executed）
    let unsub = eventBus.on(EVENT_NAMES.TRADE_ACTION_EXECUTED, (payload: unknown) => {
      if (!this.config.autoAnalyze) return
      this.handleTradeExecuted(payload)
    })
    this.unsubscribers.push(unsub)

    // 同时监听订单变更作为备用
    unsub = eventBus.on(EVENT_NAMES.ORDERS_CHANGED, (payload: unknown) => {
      if (!this.config.autoAnalyze) return
      this.handleOrdersChanged(payload)
    })
    this.unsubscribers.push(unsub)

    // 监听行情数据变更，更新历史行情
    unsub = eventBus.on(EVENT_NAMES.MARKET_DATA_CHANGED, (payload: unknown) => {
      this.handleMarketDataChanged(payload)
    })
    this.unsubscribers.push(unsub)

    logger.info('[TimelinessSyncAnalyzer] 已启动，监听交易执行事件')
  }

  /** 停止量化器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[TimelinessSyncAnalyzer] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  // ---- 事件处理 ----

  /** 处理交易执行事件 */
  private handleTradeExecuted(payload: unknown): void {
    const record = this.parseTradeRecord(payload)
    if (!record) return

    this.addTradeRecord(record)
    this.analyzeSymbol(record.symbol)
  }

  /** 处理订单变更事件（备用） */
  private handleOrdersChanged(payload: unknown): void {
    const p = payload as {
      orders?: Array<{
        symbol?: string
        side?: string
        price?: number
        quantity?: number
        timestamp?: number
      }>
    }

    if (!p?.orders) return

    for (const order of p.orders) {
      const action = order.side === 'buy' ? 'buy' as const : 'sell' as const
      if (order.symbol && order.price) {
        const record: TradeRecord = {
          symbol: order.symbol,
          action,
          price: order.price,
          quantity: order.quantity ?? 0,
          timestamp: order.timestamp ?? Date.now(),
          source: 'strategy',
        }
        this.addTradeRecord(record)
        this.analyzeSymbol(record.symbol)
      }
    }
  }

  /** 处理行情数据变更 */
  private handleMarketDataChanged(payload: unknown): void {
    const p = payload as {
      symbol?: string
      quotes?: QuotePoint[]
      quote?: QuotePoint
    }

    if (!p?.symbol) return

    const quotes = p.quotes ?? (p.quote ? [p.quote] : [])
    if (quotes.length === 0) return

    if (!this.quoteHistory.has(p.symbol)) {
      this.quoteHistory.set(p.symbol, [])
    }
    const history = this.quoteHistory.get(p.symbol)!

    // 追加新行情点（去重）
    for (const q of quotes) {
      const exists = history.some((h) => String(h.date) === String(q.date))
      if (!exists) {
        history.push(q)
      }
    }

    // 按日期排序
    history.sort((a, b) => Number(a.date) - Number(b.date))

    // 仅保留 lookbackDays * 1.5 的数据量
    const maxLen = Math.ceil(this.config.lookbackDays * 1.5)
    if (history.length > maxLen) {
      this.quoteHistory.set(p.symbol, history.slice(-maxLen))
    }
  }

  /** 解析交易记录 */
  private parseTradeRecord(payload: unknown): TradeRecord | null {
    const p = payload as Partial<TradeRecord>
    if (!p.symbol || !p.price) return null
    if (p.action !== 'buy' && p.action !== 'sell') return null

    return {
      symbol: p.symbol,
      action: p.action,
      price: p.price,
      quantity: p.quantity ?? 0,
      timestamp: p.timestamp ?? Date.now(),
      source: p.source ?? 'strategy',
    }
  }

  /** 添加交易记录 */
  private addTradeRecord(record: TradeRecord): void {
    if (!this.trades.has(record.symbol)) {
      this.trades.set(record.symbol, [])
    }
    this.trades.get(record.symbol)!.push(record)
    logger.info('[TimelinessSyncAnalyzer] 记录交易', {
      symbol: record.symbol,
      action: record.action,
      price: record.price,
    })
  }

  /** 分析单只股票的择时指标 */
  private analyzeSymbol(symbol: string): void {
    const symbolTrades = this.trades.get(symbol)
    const quotes = this.quoteHistory.get(symbol)

    if (!symbolTrades || symbolTrades.length === 0) return

    const buyDeviations: number[] = []
    const sellDeviations: number[] = []

    for (const trade of symbolTrades) {
      const deviation = this.calculateDeviation(trade, quotes)
      if (deviation === null) continue

      if (trade.action === 'buy') {
        buyDeviations.push(deviation)
      } else {
        sellDeviations.push(deviation)
      }
    }

    // 合并所有偏差
    const allDeviations = [...buyDeviations, ...sellDeviations]
    const avgDeviation = allDeviations.length > 0
      ? allDeviations.reduce((sum, d) => sum + Math.abs(d), 0) / allDeviations.length
      : 0

    // 择时准确率
    const accurateCount = allDeviations.filter((d) => Math.abs(d) <= this.config.accuracyThresholdDays).length
    const timingAccuracyRate = allDeviations.length > 0 ? accurateCount / allDeviations.length : 0

    // 择时收益率 vs 持有收益率
    const timingReturnVsHold = this.calculateTimingReturnVsHold(symbolTrades)

    // 周线协同度
    const weeklyCorrelation = this.calculateWeeklyCorrelation(symbolTrades, quotes)

    const metrics: TimelinessMetrics = {
      id: nanoid(12),
      symbol,
      totalTrades: symbolTrades.length,
      buyTimingDeviationDays: buyDeviations,
      sellTimingDeviationDays: sellDeviations,
      avgDeviationDays: Math.round(avgDeviation * 100) / 100,
      timingAccuracyRate: Math.round(timingAccuracyRate * 10000) / 10000,
      timingReturnVsHold: Math.round(timingReturnVsHold * 100) / 100,
      weeklyCorrelation: Math.round(weeklyCorrelation * 10000) / 10000,
    }

    this.metrics.set(symbol, metrics)

    logger.info('[TimelinessSyncAnalyzer] 择时分析完成', {
      symbol,
      totalTrades: metrics.totalTrades,
      avgDeviation: metrics.avgDeviationDays,
      accuracy: `${(metrics.timingAccuracyRate * 100).toFixed(1)}%`,
    })

    eventBus.emit(EVENT_NAMES.TIMELINESS_ANALYSIS_COMPLETED, metrics)
  }

  /** 计算单笔交易的偏差天数 */
  private calculateDeviation(trade: TradeRecord, quotes?: QuotePoint[]): number | null {
    if (!quotes || quotes.length === 0) return null

    const tradeDate = Number(trade.timestamp)
    const lookbackMs = this.config.lookbackDays * 24 * 60 * 60 * 1000
    const windowStart = tradeDate - lookbackMs

    // 筛选回溯窗口内的行情
    const windowQuotes = quotes.filter((q) => {
      const qDate = Number(q.date)
      return qDate >= windowStart && qDate <= tradeDate
    })

    if (windowQuotes.length === 0) return null

    const MS_PER_DAY = 24 * 60 * 60 * 1000

    if (trade.action === 'buy') {
      // 找窗口内最低点
      const lowestQuote = windowQuotes.reduce((min, q) => (q.low < (min?.low ?? Infinity) ? q : min ?? q), windowQuotes[0])
      if (!lowestQuote) return null
      const lowestDate = Number(lowestQuote.date)
      return Math.round((tradeDate - lowestDate) / MS_PER_DAY)
    } else {
      // 找窗口内最高点
      const highestQuote = windowQuotes.reduce((max, q) => (q.high > (max?.high ?? -Infinity) ? q : max ?? q), windowQuotes[0])
      if (!highestQuote) return null
      const highestDate = Number(highestQuote.date)
      return Math.round((tradeDate - highestDate) / MS_PER_DAY)
    }
  }

  /** 计算择时收益率 vs 持有收益率 */
  private calculateTimingReturnVsHold(trades: TradeRecord[]): number {
    if (trades.length < 2) return 0

    // 配对买卖
    const buys = trades.filter((t) => t.action === 'buy').sort((a, b) => a.timestamp - b.timestamp)
    const sells = trades.filter((t) => t.action === 'sell').sort((a, b) => a.timestamp - b.timestamp)

    let timingReturn = 0
    let holdReturn = 0
    let pairCount = 0

    const pairLen = Math.min(buys.length, sells.length)
    for (let i = 0; i < pairLen; i++) {
      const buy = buys[i]!
      const sell = sells[i]!
      if (sell.timestamp <= buy.timestamp) continue

      const tradeReturn = (sell.price - buy.price) / buy.price

      // 持有收益率：买入价到卖出期间的简单假设（首尾价差）
      const holdReturnEstimate = tradeReturn * 0.8 // 近似假设
      timingReturn += tradeReturn
      holdReturn += holdReturnEstimate
      pairCount++
    }

    if (pairCount === 0) return 0

    const avgTiming = timingReturn / pairCount
    const avgHold = holdReturn / pairCount

    return avgHold !== 0 ? ((avgTiming - avgHold) / Math.abs(avgHold)) * 100 : avgTiming * 100
  }

  /** 计算周线协同度 */
  private calculateWeeklyCorrelation(trades: TradeRecord[], quotes?: QuotePoint[]): number {
    if (!quotes || quotes.length < 5) return 0

    const MS_PER_DAY = 24 * 60 * 60 * 1000
    const MS_PER_WEEK = 5 * MS_PER_DAY // 5个交易日为一周

    let correlationSum = 0
    let tradeCount = 0

    for (const trade of trades) {
      const tradeWeek = Math.floor(trade.timestamp / MS_PER_WEEK)

      // 找该周的行情
      const weekQuotes = quotes.filter((q) => {
        const qWeek = Math.floor(Number(q.date) / MS_PER_WEEK)
        return qWeek === tradeWeek
      })

      if (weekQuotes.length < 2) continue

      const weekStart = weekQuotes[0]!.close
      const weekEnd = weekQuotes[weekQuotes.length - 1]!.close
      const weekTrend = weekEnd - weekStart

      // 买入与上升趋势协同，卖出与下降趋势协同
      const tradeDirection = trade.action === 'buy' ? 1 : -1
      const trendDirection = weekTrend >= 0 ? 1 : -1

      // 协同度 = 方向一致为1，不一致为0，按趋势幅度加权
      const magnitude = Math.min(Math.abs(weekTrend) / weekStart, 1)
      const synergy = tradeDirection === trendDirection ? magnitude : -magnitude * 0.5

      correlationSum += synergy
      tradeCount++
    }

    return tradeCount > 0
      ? Math.max(0, Math.min(1, (correlationSum / tradeCount + 1) / 2))
      : 0
  }

  // ---- 公开查询接口 ----

  /** 获取指定股票的择时指标 */
  getMetrics(symbol: string): TimelinessMetrics | null {
    return this.metrics.get(symbol) ?? null
  }

  /** 获取全部择时指标 */
  getAllMetrics(): Map<string, TimelinessMetrics> {
    return new Map(this.metrics)
  }

  /** 获取综合择时报告 */
  getCorrelationReport(): {
    avgAccuracy: number
    avgDeviation: number
    bestTimers: string[]
    worstTimers: string[]
  } {
    const allMetrics = Array.from(this.metrics.values())
    if (allMetrics.length === 0) {
      return { avgAccuracy: 0, avgDeviation: 0, bestTimers: [], worstTimers: [] }
    }

    const avgAccuracy = allMetrics.reduce((s, m) => s + m.timingAccuracyRate, 0) / allMetrics.length
    const avgDeviation = allMetrics.reduce((s, m) => s + m.avgDeviationDays, 0) / allMetrics.length

    // 按准确率排序
    const sorted = [...allMetrics].sort((a, b) => b.timingAccuracyRate - a.timingAccuracyRate)

    const bestTimers = sorted.slice(0, Math.min(5, sorted.length)).map((m) => m.symbol)
    const worstTimers = sorted.slice(-Math.min(5, sorted.length)).reverse().map((m) => m.symbol)

    return {
      avgAccuracy: Math.round(avgAccuracy * 10000) / 10000,
      avgDeviation: Math.round(avgDeviation * 100) / 100,
      bestTimers,
      worstTimers,
    }
  }

  /** 手动注入行情数据 */
  injectQuoteHistory(symbol: string, quotes: QuotePoint[]): void {
    if (!this.quoteHistory.has(symbol)) {
      this.quoteHistory.set(symbol, [])
    }
    const existing = this.quoteHistory.get(symbol)!
    for (const q of quotes) {
      const exists = existing.some((h) => String(h.date) === String(q.date))
      if (!exists) {
        existing.push(q)
      }
    }
    existing.sort((a, b) => Number(a.date) - Number(b.date))
  }

  /** 清空所有数据 */
  clear(): void {
    this.trades.clear()
    this.metrics.clear()
    this.quoteHistory.clear()
    logger.info('[TimelinessSyncAnalyzer] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: TimelinessSyncAnalyzer | null = null

export function getTimelinessSyncAnalyzer(config?: TimelinessSyncConfig): TimelinessSyncAnalyzer {
  _instance ??= new TimelinessSyncAnalyzer(config)
  return _instance
}

export function startTimelinessSyncAnalyzer(config?: TimelinessSyncConfig): TimelinessSyncAnalyzer {
  const analyzer = getTimelinessSyncAnalyzer(config)
  analyzer.start()
  return analyzer
}
