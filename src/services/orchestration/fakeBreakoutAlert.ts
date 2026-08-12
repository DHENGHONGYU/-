/**
 * @fileoverview 假突破实时预警器 — 监控自选列表中的假突破信号
 *
 * 监听行情数据更新，当股票满足假突破技术条件（换手率≥8% & 量比<1.5）
 * 时发出预警。结合 v4.7 资金流向二次确认，主力净流入时降级不预警。
 *
 * 预警级别：
 * - critical: L5 能量级别假突破（能量≥0.15）+ 主力净流出
 * - warning: L4 能量级别假突破（能量≥0.08）+ 主力净流出
 * - info: 假突破技术条件满足但资金流向数据不足
 *
 * @module services/orchestration/fakeBreakoutAlert
 * @created 2026-08-10 - v4.7 假突破监控
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'
import {
  classifyBreakoutStyle,
  computeTurnoverVolumeEnergy,
} from '@/services/scoring/v6-engine/calculators/l7_l8'
import type { FundFlowContext } from '@/services/scoring/v6-engine/types'

const logger = getLogger()

// ---- 类型定义 ----

export interface FakeBreakoutAlert {
  id: string
  symbol: string
  name: string
  /** 换手率（小数，如 0.16 = 16%） */
  turnover: number
  /** 量比 */
  volumeRatio: number
  /** 能量等级 (1-5) */
  energyLevel: number
  /** 能量标签 */
  energyLabel: string
  /** 断线风格 */
  breakoutStyle: string
  /** 主力资金净流入（亿元，可选） */
  mainForceNet?: number
  /** 预警级别 */
  level: 'info' | 'warning' | 'critical'
  /** 预警原因 */
  reason: string
  /** 检测时间 */
  detectedAt: number
}

export interface FakeBreakoutAlertConfig {
  /** 关注的股票列表（symbol 数组），空=全部 */
  watchSymbols: string[]
  /** 股票名称映射 */
  symbolNames?: Map<string, string>
  /** 是否自动预警，默认 true */
  autoAlert?: boolean
  /** 假突破换手率阈值（百分比），默认 8 */
  turnoverThreshold?: number
  /** 假突破量比阈值，默认 1.5 */
  volumeRatioThreshold?: number
  /** ★ v1.2 行情延迟降级阈值（毫秒），超过此时间无行情更新进入降级模式，默认 5000 */
  quoteStaleThresholdMs?: number
  /** ★ v1.2 降级模式下的健康检查间隔（毫秒），默认 10000 */
  healthCheckIntervalMs?: number
}

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<Omit<FakeBreakoutAlertConfig, 'symbolNames'>> = {
  watchSymbols: [],
  autoAlert: true,
  turnoverThreshold: 8,
  volumeRatioThreshold: 1.5,
  quoteStaleThresholdMs: 5000,
  healthCheckIntervalMs: 10000,
}

// ---- 行情更新数据接口 ----

interface BreakoutQuoteUpdate {
  symbol: string
  name?: string
  turnover?: number
  volumeRatio?: number
  mainForceNet?: number
  northboundNet?: number
  marginChange?: number
  timestamp?: number
}

// ---- 假突破预警器 ----

export class FakeBreakoutAlertPush {
  private config: Required<Omit<FakeBreakoutAlertConfig, 'symbolNames'>> & Pick<FakeBreakoutAlertConfig, 'symbolNames'>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 按 symbol 索引的预警列表 */
  private alerts: Map<string, FakeBreakoutAlert[]> = new Map()
  /** 全量预警列表 */
  private allAlertsList: FakeBreakoutAlert[] = []

  // ★ v1.2 断线/延迟降级处理状态
  /** 最近一次行情更新时间戳 */
  private _lastQuoteTime: number = 0
  /** 当前是否处于降级模式 */
  private _degraded: boolean = false
  /** 降级模式开始时间 */
  private _degradedSince: number = 0
  /** 健康检查定时器 */
  private _healthCheckTimer: ReturnType<typeof setInterval> | null = null
  /** 降级模式下的预警计数 */
  private _degradedAlertCount: number = 0

  constructor(config?: FakeBreakoutAlertConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      symbolNames: config?.symbolNames ?? new Map(),
    }
  }

  /** 启动预警器 — 订阅行情数据更新事件 */
  start(): void {
    if (this._active) return
    this._active = true
    this._lastQuoteTime = Date.now()

    const unsub = eventBus.on(EVENT_NAMES.MARKET_QUOTE_UPDATE, (payload: unknown) => {
      if (!this.config.autoAlert) return
      // ★ v1.2 更新最近行情时间，如果处于降级模式则恢复
      this._lastQuoteTime = Date.now()
      if (this._degraded) {
        this.exitDegradedMode()
      }
      this.handleQuoteUpdate(payload)
    })
    this.unsubscribers.push(unsub)

    // 监听筹码异动作为辅助信号
    const unsubChip = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      if (!this.config.autoAlert) return
      this.handleChipAnomaly(payload)
    })
    this.unsubscribers.push(unsubChip)

    // ★ v1.2 启动健康检查定时器 — 检测行情延迟
    this._healthCheckTimer = setInterval(
      () => this.checkQuoteHealth(),
      this.config.healthCheckIntervalMs,
    )

    logger.info('[FakeBreakoutAlertPush] 已启动', {
      watchSymbols: this.config.watchSymbols,
      turnoverThreshold: this.config.turnoverThreshold,
      volumeRatioThreshold: this.config.volumeRatioThreshold,
      quoteStaleThresholdMs: this.config.quoteStaleThresholdMs,
    })
  }

  /** 停止预警器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer)
      this._healthCheckTimer = null
    }
    this._active = false
    this._degraded = false
    logger.info('[FakeBreakoutAlertPush] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  /** 动态添加监控股票 */
  addWatchSymbol(symbol: string, name?: string): void {
    if (!this.config.watchSymbols.includes(symbol)) {
      this.config.watchSymbols.push(symbol)
    }
    if (name !== undefined && name !== '' && this.config.symbolNames) {
      this.config.symbolNames.set(symbol, name)
    }
    logger.info('[FakeBreakoutAlertPush] 添加监控股票', { symbol, name })
  }

  /** 批量添加监控股票 */
  addWatchSymbols(stocks: Array<{ symbol: string; name?: string }>): void {
    for (const { symbol, name } of stocks) {
      this.addWatchSymbol(symbol, name)
    }
    logger.info('[FakeBreakoutAlertPush] 批量添加监控股票完成', { count: stocks.length, total: this.config.watchSymbols.length })
  }

  /** 移除监控股票 */
  removeWatchSymbol(symbol: string): void {
    this.config.watchSymbols = this.config.watchSymbols.filter((s) => s !== symbol)
    logger.info('[FakeBreakoutAlertPush] 移除监控股票', { symbol })
  }

  // ---- 事件处理 ----

  /** 处理行情数据更新 */
  private handleQuoteUpdate(payload: unknown): void {
    const quotes = this.parseQuoteUpdate(payload)
    for (const quote of quotes) {
      this.processQuote(quote)
    }
  }

  /** 处理筹码异动事件 */
  private handleChipAnomaly(payload: unknown): void {
    const p = payload as { symbol?: string; type?: string }
    if ((p?.symbol ?? '') === '') return
    // 筹码异动作为辅助信号，记录但不直接触发假突破预警
    logger.debug('[FakeBreakoutAlertPush] 筹码异动辅助信号', { symbol: p.symbol, type: p.type })
  }

  /** 解析行情更新数据 */
  private parseQuoteUpdate(payload: unknown): BreakoutQuoteUpdate[] {
    const p = payload as {
      symbol?: string
      name?: string
      turnover?: number
      volumeRatio?: number
      mainForceNet?: number
      quotes?: Array<{
        symbol?: string
        name?: string
        turnover?: number
        volumeRatio?: number
        mainForceNet?: number
        northboundNet?: number
        marginChange?: number
        timestamp?: number
      }>
    }

    if (p.quotes !== undefined && p.quotes.length > 0) {
      return p.quotes
        .filter((q) => (q.symbol ?? '') !== '' && (q.turnover ?? 0) !== 0 && (q.volumeRatio ?? 0) !== 0)
        .map((q) => ({
          symbol: q.symbol!,
          name: q.name,
          turnover: q.turnover!,
          volumeRatio: q.volumeRatio!,
          mainForceNet: q.mainForceNet,
          northboundNet: q.northboundNet,
          marginChange: q.marginChange,
          timestamp: q.timestamp,
        }))
    }

    if (p.symbol !== undefined && p.symbol !== '' && (p.turnover ?? 0) !== 0 && (p.volumeRatio ?? 0) !== 0) {
      return [{
        symbol: p.symbol,
        name: p.name,
        turnover: p.turnover,
        volumeRatio: p.volumeRatio,
        mainForceNet: p.mainForceNet,
        timestamp: Date.now(),
      }]
    }

    return []
  }

  /** 处理单条行情 — 核心假突破检测逻辑 */
  private processQuote(quote: BreakoutQuoteUpdate): void {
    const { symbol, turnover = 0, volumeRatio = 0 } = quote

    // 检查关注列表
    if (this.config.watchSymbols.length > 0 && !this.config.watchSymbols.includes(symbol)) {
      return
    }

    const tpct = turnover * 100
    if (tpct < this.config.turnoverThreshold || volumeRatio >= this.config.volumeRatioThreshold) {
      return // 不满足假突破技术条件
    }

    // 计算能量
    const energy = computeTurnoverVolumeEnergy(turnover, volumeRatio)

    // 构建资金流向上下文
    const fundFlow: FundFlowContext = {
      mainForceNet: quote.mainForceNet,
      northboundNet: quote.northboundNet,
      marginChange: quote.marginChange,
    }

    // 调用 v4.7 分类器（含资金流向二次确认）
    const style = classifyBreakoutStyle(turnover, volumeRatio, energy, fundFlow)

    // 只对 fake_breakout 发出预警
    if (style !== 'fake_breakout') {
      // v4.7 降级：主力净流入导致假突破被否决，记录但不预警
      logger.debug('[FakeBreakoutAlertPush] 假突破被资金流向否决', {
        symbol, tpct, volumeRatio, mainForceNet: quote.mainForceNet,
      })
      return
    }

    // 确定预警级别
    let level: 'info' | 'warning' | 'critical'
    let reason: string

    if (energy.level >= 5 && (quote.mainForceNet === undefined || quote.mainForceNet < 0)) {
      level = 'critical'
      reason = `L5爆炸能量假突破：换手${tpct.toFixed(1)}% + 量比${volumeRatio.toFixed(2)}，能量${energy.raw.toFixed(4)}`
      if (quote.mainForceNet !== undefined && quote.mainForceNet < 0) {
        reason += `，主力净流出${Math.abs(quote.mainForceNet).toFixed(2)}亿`
      }
    } else if (energy.level >= 4) {
      level = 'warning'
      reason = `L4激进能量假突破：换手${tpct.toFixed(1)}% + 量比${volumeRatio.toFixed(2)}`
    } else {
      level = 'info'
      reason = `假突破技术条件满足：换手${tpct.toFixed(1)}% + 量比${volumeRatio.toFixed(2)}`
    }

    // ★ v1.2 降级模式下标记预警来源（行情可能已延迟）
    if (this._degraded) {
      this._degradedAlertCount++
      reason += ` [⚠️降级模式:行情可能延迟]`
    }

    this.emitAlert(symbol, quote.name, turnover, volumeRatio, energy, style, quote.mainForceNet, level, reason)
  }

  /** 发射预警 */
  private emitAlert(
    symbol: string,
    name: string | undefined,
    turnover: number,
    volumeRatio: number,
    energy: { level: number; label: string; raw: number },
    breakoutStyle: string,
    mainForceNet: number | undefined,
    level: 'info' | 'warning' | 'critical',
    reason: string,
  ): void {
    const stockName = name ?? this.config.symbolNames?.get(symbol) ?? symbol

    const alert: FakeBreakoutAlert = {
      id: nanoid(12),
      symbol,
      name: stockName,
      turnover,
      volumeRatio,
      energyLevel: energy.level,
      energyLabel: energy.label,
      breakoutStyle,
      mainForceNet,
      level,
      reason,
      detectedAt: Date.now(),
    }

    if (!this.alerts.has(symbol)) {
      this.alerts.set(symbol, [])
    }
    this.alerts.get(symbol)!.push(alert)
    this.allAlertsList.push(alert)

    const levelTag = level === 'critical' ? '🔴 严重' : level === 'warning' ? '🟠 警告' : 'ℹ️ 提示'
    logger.info(`[FakeBreakoutAlertPush] ${levelTag} 假突破预警`, {
      symbol, name: stockName, energyLevel: energy.level, reason,
    })

    // 广播预警事件
    eventBus.emit(EVENT_NAMES.CHIP_ANOMALY_DETECTED, alert)
  }

  // ---- 查询接口 ----

  /** 获取指定股票的预警列表 */
  getAlerts(symbol: string): FakeBreakoutAlert[] {
    return this.alerts.get(symbol) ?? []
  }

  /** 获取全部活跃预警（最近24小时内） */
  getActiveAlerts(): FakeBreakoutAlert[] {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    return this.allAlertsList.filter((a) => a.detectedAt >= oneDayAgo)
  }

  /** 获取严重预警列表 */
  getCriticalAlerts(): FakeBreakoutAlert[] {
    return this.allAlertsList.filter((a) => a.level === 'critical')
  }

  /** 获取预警总数 */
  getAlertCount(): number {
    return this.allAlertsList.length
  }

  /** 获取当前监控股票列表 */
  getWatchSymbols(): string[] {
    return [...this.config.watchSymbols]
  }

  // ---- ★ v1.2 断线/行情延迟降级处理 ----

  /** 获取当前是否处于降级模式 */
  get degraded(): boolean {
    return this._degraded
  }

  /** 获取最近行情时间 */
  get lastQuoteTime(): number {
    return this._lastQuoteTime
  }

  /** 获取行情延迟（毫秒），若从未收到行情返回 -1 */
  get quoteDelayMs(): number {
    if (this._lastQuoteTime === 0) return -1
    return Date.now() - this._lastQuoteTime
  }

  /** 健康检查 — 检测行情延迟是否超过阈值 */
  private checkQuoteHealth(): void {
    if (!this._active || this._degraded) return

    const delay = this.quoteDelayMs
    if (delay < 0) return // 尚未收到任何行情

    if (delay > this.config.quoteStaleThresholdMs) {
      this.enterDegradedMode(delay)
    }
  }

  /** 进入降级模式 */
  private enterDegradedMode(delayMs: number): void {
    this._degraded = true
    this._degradedSince = Date.now()
    this._degradedAlertCount = 0

    logger.warn('[FakeBreakoutAlertPush] ⚠️ 行情延迟超过阈值，进入降级模式', {
      delayMs,
      thresholdMs: this.config.quoteStaleThresholdMs,
      watchSymbols: this.config.watchSymbols.length,
    })

    // 广播降级事件，通知 UI 层显示状态
    eventBus.emit(EVENT_NAMES.CHIP_ANOMALY_DETECTED, {
      type: 'degradation_entered',
      delayMs,
      thresholdMs: this.config.quoteStaleThresholdMs,
      timestamp: Date.now(),
      message: `行情延迟 ${Math.round(delayMs / 1000)}s 超过阈值 ${this.config.quoteStaleThresholdMs / 1000}s，预警系统进入降级模式`,
    })
  }

  /** 退出降级模式 — 行情恢复时调用 */
  private exitDegradedMode(): void {
    const degradedDuration = Date.now() - this._degradedSince

    logger.info('[FakeBreakoutAlertPush] ✅ 行情恢复，退出降级模式', {
      degradedDurationMs: degradedDuration,
      degradedAlertCount: this._degradedAlertCount,
    })

    // 广播恢复事件
    eventBus.emit(EVENT_NAMES.CHIP_ANOMALY_DETECTED, {
      type: 'degradation_recovered',
      degradedDurationMs: degradedDuration,
      degradedAlertCount: this._degradedAlertCount,
      timestamp: Date.now(),
      message: `行情恢复，降级模式持续 ${Math.round(degradedDuration / 1000)}s，期间产生 ${this._degradedAlertCount} 条降级预警`,
    })

    this._degraded = false
    this._degradedSince = 0
    this._degradedAlertCount = 0
  }

  /** 清空所有预警数据 */
  clear(): void {
    this.alerts.clear()
    this.allAlertsList = []
    logger.info('[FakeBreakoutAlertPush] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: FakeBreakoutAlertPush | null = null

export function getFakeBreakoutAlertPush(config?: FakeBreakoutAlertConfig): FakeBreakoutAlertPush {
  if (!_instance) _instance = new FakeBreakoutAlertPush(config)
  return _instance
}

export function startFakeBreakoutAlertPush(config?: FakeBreakoutAlertConfig): FakeBreakoutAlertPush {
  const pusher = getFakeBreakoutAlertPush(config)
  pusher.start()
  return pusher
}
