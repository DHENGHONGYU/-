/**
 * @fileoverview 实时波动预警器 — 日波动率超过2标准差时发出预警
 *
 * 监听行情数据更新，维护滚动窗口的日收益率标准差，
 * 当日波动超过 alertThreshold 倍标准差时发出预警，
 * 超过 criticalThreshold 时发出严重预警。
 *
 * @module services/orchestration/volatilityAlert
 * @created 2026-07-25 - P2 高级功能模块
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ---- 类型定义 ----

export interface VolatilityAlert {
  id: string
  symbol: string
  currentPrice: number
  previousClose: number
  dailyChangePct: number
  /** 波动率（日收益率标准差的倍数） */
  sigmaLevel: number
  direction: 'up' | 'down'
  detectedAt: number
  /** 预警级别 */
  level: 'info' | 'warning' | 'critical'
}

export interface VolatilityConfig {
  /** 预警阈值（sigma 倍数），默认 2.0 */
  alertThreshold?: number
  /** critical 阈值，默认 3.0 */
  criticalThreshold?: number
  /** 计算波动率的历史天数，默认 20 */
  lookbackDays?: number
  /** 是否自动预警，默认 true */
  autoAlert?: boolean
  /** 关注的股票列表，空=全部 */
  watchSymbols?: string[]
}

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<VolatilityConfig> = {
  alertThreshold: 2.0,
  criticalThreshold: 3.0,
  lookbackDays: 20,
  autoAlert: true,
  watchSymbols: [],
}

// ---- 行情更新数据接口 ----

interface QuoteUpdate {
  symbol: string
  price: number
  previousClose?: number
  open?: number
  high?: number
  low?: number
  timestamp?: number
}

// ---- 实时波动预警器 ----

export class VolatilityAlertPush {
  private config: Required<VolatilityConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 按 symbol 索引的预警列表 */
  private alerts: Map<string, VolatilityAlert[]> = new Map()
  /** 全量预警列表 */
  private allAlertsList: VolatilityAlert[] = []
  /** 按 symbol 索引的历史收盘价序列（用于计算收益率） */
  private priceHistory: Map<string, number[]> = new Map()
  /** 按 symbol 索引的前一收盘价 */
  private previousClose: Map<string, number> = new Map()

  constructor(config?: VolatilityConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 启动预警器 — 订阅行情数据更新事件 */
  start(): void {
    if (this._active) return
    this._active = true

    // 监听行情数据更新
    let unsub = eventBus.on(EVENT_NAMES.MARKET_QUOTE_UPDATE, (payload: unknown) => {
      if (!this.config.autoAlert) return
      this.handleQuoteUpdate(payload)
    })
    this.unsubscribers.push(unsub)

    // 监听市场数据变更作为备用
    unsub = eventBus.on(EVENT_NAMES.MARKET_DATA_CHANGED, (payload: unknown) => {
      if (!this.config.autoAlert) return
      this.handleMarketDataChanged(payload)
    })
    this.unsubscribers.push(unsub)

    logger.info('[VolatilityAlertPush] 已启动', {
      alertThreshold: this.config.alertThreshold,
      criticalThreshold: this.config.criticalThreshold,
      lookbackDays: this.config.lookbackDays,
    })
  }

  /** 停止预警器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[VolatilityAlertPush] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  // ---- 事件处理 ----

  /** 处理行情数据更新 */
  private handleQuoteUpdate(payload: unknown): void {
    const quotes = this.parseQuoteUpdate(payload)
    for (const quote of quotes) {
      this.processQuote(quote)
    }
  }

  /** 处理市场数据变更（备用） */
  private handleMarketDataChanged(payload: unknown): void {
    const p = payload as {
      symbol?: string
      quotes?: Array<{ close?: number; date?: string | number }>
      quote?: { close?: number; date?: string | number }
    }

    if (!p?.symbol) return

    const quotes = p.quotes ?? (p.quote ? [p.quote] : [])
    if (quotes.length === 0) return

    const lastQuote = quotes[quotes.length - 1]
    if (lastQuote?.close) {
      this.processQuote({
        symbol: p.symbol,
        price: lastQuote.close,
        timestamp: typeof lastQuote.date === 'number' ? lastQuote.date : Date.now(),
      })
    }
  }

  /** 解析行情更新数据 */
  private parseQuoteUpdate(payload: unknown): QuoteUpdate[] {
    const p = payload as {
      symbol?: string
      price?: number
      previousClose?: number
      timestamp?: number
      quotes?: Array<{
        symbol?: string
        price?: number
        previousClose?: number
        timestamp?: number
      }>
    }

    if (p.quotes && p.quotes.length > 0) {
      return p.quotes
        .filter((q) => q.symbol && q.price)
        .map((q) => ({
          symbol: q.symbol!,
          price: q.price!,
          previousClose: q.previousClose,
          timestamp: q.timestamp,
        }))
    }

    if (p.symbol && p.price) {
      return [{
        symbol: p.symbol,
        price: p.price,
        previousClose: p.previousClose,
        timestamp: p.timestamp,
      }]
    }

    return []
  }

  /** 处理单条行情 */
  private processQuote(quote: QuoteUpdate): void {
    // 检查关注列表
    if (this.config.watchSymbols.length > 0 && !this.config.watchSymbols.includes(quote.symbol)) {
      return
    }

    // 更新价格历史
    this.updatePriceHistory(quote.symbol, quote.price)

    // 计算波动率
    const sigmaLevel = this.calculateSigmaLevel(quote.symbol, quote.price)

    if (sigmaLevel === null) {
      // 数据不足，仅更新 previousClose
      return
    }

    // 记录 previousClose
    if (quote.previousClose) {
      this.previousClose.set(quote.symbol, quote.previousClose)
    }

    // 判断是否需要预警
    if (Math.abs(sigmaLevel) >= this.config.criticalThreshold) {
      this.emitAlert(quote.symbol, quote.price, sigmaLevel, 'critical')
    } else if (Math.abs(sigmaLevel) >= this.config.alertThreshold) {
      this.emitAlert(quote.symbol, quote.price, sigmaLevel, 'warning')
    }
  }

  /** 更新价格历史 */
  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, [])
    }

    const history = this.priceHistory.get(symbol)!
    history.push(price)

    // 保持最大长度
    const maxLen = this.config.lookbackDays + 5
    if (history.length > maxLen) {
      this.priceHistory.set(symbol, history.slice(-maxLen))
    }
  }

  /** 计算当前价格的 sigma 级别 */
  private calculateSigmaLevel(symbol: string, currentPrice: number): number | null {
    const history = this.priceHistory.get(symbol)
    if (!history || history.length < 2) return null

    // 取最近 lookbackDays 个收盘价（不包括当前价格）
    const lookback = history.slice(-(this.config.lookbackDays + 1))
    if (lookback.length < 2) return null

    // 计算日收益率序列
    const returns: number[] = []
    for (let i = 1; i < lookback.length; i++) {
      const prev = lookback[i - 1]!
      const curr = lookback[i]!
      if (prev !== 0) {
        returns.push((curr - prev) / prev)
      }
    }

    if (returns.length < 2) return null

    // 计算收益率均值
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length

    // 计算收益率标准差
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) return null

    // 计算当前日收益率
    const prevPrice = lookback[lookback.length - 1]!
    if (prevPrice === 0) return null

    const currentReturn = (currentPrice - prevPrice) / prevPrice
    const sigmaLevel = currentReturn / stdDev

    return Math.round(sigmaLevel * 100) / 100
  }

  /** 发射预警 */
  private emitAlert(
    symbol: string,
    currentPrice: number,
    sigmaLevel: number,
    level: 'warning' | 'critical',
  ): void {
    const prevClose = this.previousClose.get(symbol) ?? 0
    const dailyChangePct = prevClose !== 0
      ? Math.round(((currentPrice - prevClose) / prevClose) * 10000) / 100
      : 0

    const alert: VolatilityAlert = {
      id: nanoid(12),
      symbol,
      currentPrice,
      previousClose: prevClose,
      dailyChangePct,
      sigmaLevel: Math.abs(sigmaLevel),
      direction: sigmaLevel >= 0 ? 'up' : 'down',
      detectedAt: Date.now(),
      level,
    }

    // 存入 symbol 索引
    if (!this.alerts.has(symbol)) {
      this.alerts.set(symbol, [])
    }
    this.alerts.get(symbol)!.push(alert)

    // 存入全量列表
    this.allAlertsList.push(alert)

    logger.info(`[VolatilityAlertPush] ${level === 'critical' ? '严重预警' : '波动预警'}`, {
      symbol,
      sigmaLevel: alert.sigmaLevel,
      direction: alert.direction,
      dailyChange: `${dailyChangePct}%`,
    })

    // 广播预警事件
    if (level === 'critical') {
      eventBus.emit(EVENT_NAMES.VOLATILITY_CRITICAL, alert)
    } else {
      eventBus.emit(EVENT_NAMES.VOLATILITY_ALERT, alert)
    }
  }

  // ---- 查询接口 ----

  /** 获取指定股票的预警列表 */
  getAlerts(symbol: string): VolatilityAlert[] {
    return this.alerts.get(symbol) ?? []
  }

  /** 获取全部活跃预警（最近24小时内的） */
  getActiveAlerts(): VolatilityAlert[] {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    return this.allAlertsList.filter((a) => a.detectedAt >= oneDayAgo)
  }

  /** 获取预警总数 */
  getAlertCount(): number {
    return this.allAlertsList.length
  }

  /** 获取严重预警列表 */
  getCriticalAlerts(): VolatilityAlert[] {
    return this.allAlertsList.filter((a) => a.level === 'critical')
  }

  /** 清空所有预警数据 */
  clear(): void {
    this.alerts.clear()
    this.allAlertsList = []
    this.priceHistory.clear()
    this.previousClose.clear()
    logger.info('[VolatilityAlertPush] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: VolatilityAlertPush | null = null

export function getVolatilityAlertPush(config?: VolatilityConfig): VolatilityAlertPush {
  if (!_instance) _instance = new VolatilityAlertPush(config)
  return _instance
}

export function startVolatilityAlertPush(config?: VolatilityConfig): VolatilityAlertPush {
  const pusher = getVolatilityAlertPush(config)
  pusher.start()
  return pusher
}
