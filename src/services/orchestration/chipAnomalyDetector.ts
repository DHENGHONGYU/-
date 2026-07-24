/**
 * @fileoverview 筹码异动检测器 — 股东人数和筹码集中度异常变化检测
 *
 * 监听 chip 维度数据采集完成事件，对比前一次 chip 数据，
 * 检测股东人数变化、筹码集中度变化和机构持仓变化，
 * 当变化超过阈值时广播异动事件。
 *
 * @module services/orchestration/chipAnomalyDetector
 * @created 2026-07-25 - P2 高级功能模块
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ---- 类型定义 ----

export interface ChipAnomalyEvent {
  id: string
  symbol: string
  /** 异常类型 */
  type: 'holder_count_change' | 'concentration_change' | 'institutional_change'
  /** 变化方向 */
  direction: 'increase' | 'decrease'
  /** 变化幅度（百分比） */
  changePct: number
  /** 变化前的值 */
  previousValue: number
  /** 变化后的值 */
  newValue: number
  /** 异常级别 */
  severity: 'info' | 'warning' | 'critical'
  detectedAt: number
  description: string
}

export interface ChipAnomalyConfig {
  /** 股东人数变化阈值（百分比），默认 10% */
  holderCountThreshold?: number
  /** 筹码集中度变化阈值（百分比），默认 15% */
  concentrationThreshold?: number
  /** 是否自动检测，默认 true */
  autoDetect?: boolean
  /** 关注的股票列表，空=全部 */
  watchSymbols?: string[]
}

// ---- chip 数据快照接口 ----

interface ChipDataSnapshot {
  symbol: string
  /** 股东人数 */
  holderCount?: number
  /** 筹码集中度（0-100） */
  concentration?: number
  /** 机构持仓比例（0-1） */
  institutionalRatio?: number
  /** 数据采集时间 */
  collectedAt?: number
}

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<ChipAnomalyConfig> = {
  holderCountThreshold: 10,
  concentrationThreshold: 15,
  autoDetect: true,
  watchSymbols: [],
}

// ---- 筹码异动检测器 ----

export class ChipAnomalyDetector {
  private config: Required<ChipAnomalyConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 按 symbol 索引的异动事件 */
  private anomalies: Map<string, ChipAnomalyEvent[]> = new Map()
  /** 全量异动事件列表 */
  private allAnomaliesList: ChipAnomalyEvent[] = []
  /** 按 symbol 索引的上一次 chip 数据快照 */
  private previousSnapshots: Map<string, ChipDataSnapshot> = new Map()

  constructor(config?: ChipAnomalyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 启动检测器 — 订阅 chip 采集完成事件 */
  start(): void {
    if (this._active) return
    this._active = true

    // 监听采集完成事件（当 dimensionCode === 'chip'）
    let unsub = eventBus.on(EVENT_NAMES.REGISTRATION_COLLECT_COMPLETE, (payload: unknown) => {
      if (!this.config.autoDetect) return
      this.handleCollectComplete(payload)
    })
    this.unsubscribers.push(unsub)

    // 监听股票数据变更（备用，可能包含 chip 数据更新）
    unsub = eventBus.on(EVENT_NAMES.STOCKS_CHANGED, (payload: unknown) => {
      if (!this.config.autoDetect) return
      this.handleStocksChanged(payload)
    })
    this.unsubscribers.push(unsub)

    logger.info('[ChipAnomalyDetector] 已启动', {
      holderCountThreshold: `${this.config.holderCountThreshold}%`,
      concentrationThreshold: `${this.config.concentrationThreshold}%`,
    })
  }

  /** 停止检测器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[ChipAnomalyDetector] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  // ---- 事件处理 ----

  /** 处理采集完成事件 */
  private handleCollectComplete(payload: unknown): void {
    const p = payload as {
      dimensionCode?: string
      results?: Array<{
        symbol?: string
        data?: Record<string, unknown>
      }>
    }

    // 仅处理 chip 维度的采集
    if (p.dimensionCode && p.dimensionCode !== 'chip') return

    if (!p?.results) return

    for (const result of p.results) {
      if (!result.symbol) continue

      // 检查关注列表
      if (this.config.watchSymbols.length > 0 && !this.config.watchSymbols.includes(result.symbol)) {
        continue
      }

      const chipData = this.extractChipData(result.symbol, result.data ?? {})
      if (chipData) {
        this.detectAnomalies(chipData)
      }
    }
  }

  /** 处理股票数据变更（备用） */
  private handleStocksChanged(payload: unknown): void {
    const p = payload as {
      stocks?: Array<{
        symbol?: string
        holderCount?: number
        concentration?: number
        institutionalRatio?: number
      }>
      symbol?: string
      holderCount?: number
      concentration?: number
      institutionalRatio?: number
    }

    if (p.stocks) {
      for (const stock of p.stocks) {
        if (stock.symbol) {
          const chipData: ChipDataSnapshot = {
            symbol: stock.symbol,
            holderCount: stock.holderCount,
            concentration: stock.concentration,
            institutionalRatio: stock.institutionalRatio,
            collectedAt: Date.now(),
          }
          this.detectAnomalies(chipData)
        }
      }
    } else if (p.symbol && (p.holderCount !== undefined || p.concentration !== undefined)) {
      const chipData: ChipDataSnapshot = {
        symbol: p.symbol,
        holderCount: p.holderCount,
        concentration: p.concentration,
        institutionalRatio: p.institutionalRatio,
        collectedAt: Date.now(),
      }
      this.detectAnomalies(chipData)
    }
  }

  /** 从原始数据中提取 chip 维度字段 */
  private extractChipData(symbol: string, data: Record<string, unknown>): ChipDataSnapshot | null {
    // 尝试多种字段命名
    const holderCount = this.extractNumber(data, [
      'holderCount', 'holder_count', 'shareholderCount', 'shareholder_count',
    ])
    const concentration = this.extractNumber(data, [
      'concentration', 'chipConcentration', 'chip_concentration',
    ])
    const institutionalRatio = this.extractNumber(data, [
      'institutionalRatio', 'institutional_ratio', 'instRatio', 'inst_ratio',
    ])

    // 至少有一个 chip 维度的数据才有效
    if (holderCount === null && concentration === null && institutionalRatio === null) {
      return null
    }

    return {
      symbol,
      holderCount: holderCount ?? undefined,
      concentration: concentration ?? undefined,
      institutionalRatio: institutionalRatio ?? undefined,
      collectedAt: Date.now(),
    }
  }

  /** 从对象中按候选字段名提取数字 */
  private extractNumber(data: Record<string, unknown>, candidates: string[]): number | null {
    for (const key of candidates) {
      if (key in data && typeof data[key] === 'number') {
        return data[key] as number
      }
    }
    return null
  }

  // ---- 异动检测 ----

  /** 检测异动 */
  private detectAnomalies(current: ChipDataSnapshot): void {
    const previous = this.previousSnapshots.get(current.symbol)

    if (!previous) {
      // 首次记录快照，不做异动检测
      this.previousSnapshots.set(current.symbol, { ...current })
      return
    }

    // 检测股东人数变化
    if (current.holderCount !== undefined && previous.holderCount !== undefined && previous.holderCount > 0) {
      const changePct = ((current.holderCount - previous.holderCount) / previous.holderCount) * 100
      if (Math.abs(changePct) >= this.config.holderCountThreshold) {
        const severity = this.computeSeverity(Math.abs(changePct), this.config.holderCountThreshold)
        const direction: 'increase' | 'decrease' = changePct > 0 ? 'increase' : 'decrease'

        this.recordAnomaly({
          type: 'holder_count_change',
          direction,
          changePct: Math.round(Math.abs(changePct) * 100) / 100,
          previousValue: previous.holderCount,
          newValue: current.holderCount,
          severity,
          symbol: current.symbol,
          description: `股东人数${direction === 'increase' ? '增加' : '减少'} ${Math.abs(changePct).toFixed(1)}%` +
            `（${previous.holderCount.toLocaleString()} → ${current.holderCount.toLocaleString()}）`,
        })
      }
    }

    // 检测筹码集中度变化
    if (current.concentration !== undefined && previous.concentration !== undefined && previous.concentration > 0) {
      const changePct = ((current.concentration - previous.concentration) / previous.concentration) * 100
      if (Math.abs(changePct) >= this.config.concentrationThreshold) {
        const severity = this.computeSeverity(Math.abs(changePct), this.config.concentrationThreshold)
        const direction: 'increase' | 'decrease' = changePct > 0 ? 'increase' : 'decrease'

        this.recordAnomaly({
          type: 'concentration_change',
          direction,
          changePct: Math.round(Math.abs(changePct) * 100) / 100,
          previousValue: previous.concentration,
          newValue: current.concentration,
          severity,
          symbol: current.symbol,
          description: `筹码集中度${direction === 'increase' ? '提升' : '下降'} ${Math.abs(changePct).toFixed(1)}%` +
            `（${previous.concentration.toFixed(1)} → ${current.concentration.toFixed(1)}）`,
        })
      }
    }

    // 检测机构持仓变化（使用集中度阈值的1.5倍）
    if (
      current.institutionalRatio !== undefined &&
      previous.institutionalRatio !== undefined &&
      previous.institutionalRatio > 0
    ) {
      const instThreshold = this.config.concentrationThreshold * 1.5
      const changePct = ((current.institutionalRatio - previous.institutionalRatio) / previous.institutionalRatio) * 100
      if (Math.abs(changePct) >= instThreshold) {
        const severity = this.computeSeverity(Math.abs(changePct), instThreshold)
        const direction: 'increase' | 'decrease' = changePct > 0 ? 'increase' : 'decrease'

        this.recordAnomaly({
          type: 'institutional_change',
          direction,
          changePct: Math.round(Math.abs(changePct) * 100) / 100,
          previousValue: previous.institutionalRatio,
          newValue: current.institutionalRatio,
          severity,
          symbol: current.symbol,
          description: `机构持仓${direction === 'increase' ? '增持' : '减持'} ${Math.abs(changePct).toFixed(1)}%` +
            `（${(previous.institutionalRatio * 100).toFixed(1)}% → ${(current.institutionalRatio * 100).toFixed(1)}%）`,
        })
      }
    }

    // 更新快照
    this.previousSnapshots.set(current.symbol, { ...current })
  }

  /** 计算异动严重级别 */
  private computeSeverity(changePct: number, threshold: number): 'info' | 'warning' | 'critical' {
    if (changePct >= threshold * 3) {
      return 'critical'
    } else if (changePct >= threshold * 2) {
      return 'warning'
    }
    return 'info'
  }

  /** 记录异动事件并广播 */
  private recordAnomaly(params: {
    type: ChipAnomalyEvent['type']
    direction: ChipAnomalyEvent['direction']
    changePct: number
    previousValue: number
    newValue: number
    severity: ChipAnomalyEvent['severity']
    symbol: string
    description: string
  }): void {
    const event: ChipAnomalyEvent = {
      id: nanoid(12),
      symbol: params.symbol,
      type: params.type,
      direction: params.direction,
      changePct: params.changePct,
      previousValue: params.previousValue,
      newValue: params.newValue,
      severity: params.severity,
      detectedAt: Date.now(),
      description: params.description,
    }

    // 存入 symbol 索引
    if (!this.anomalies.has(params.symbol)) {
      this.anomalies.set(params.symbol, [])
    }
    this.anomalies.get(params.symbol)!.push(event)

    // 存入全量列表
    this.allAnomaliesList.push(event)

    logger.info('[ChipAnomalyDetector] 检测到筹码异动', {
      symbol: params.symbol,
      type: params.type,
      direction: params.direction,
      changePct: `${params.changePct}%`,
      severity: params.severity,
    })

    // 广播异动事件
    eventBus.emit(EVENT_NAMES.CHIP_ANOMALY_DETECTED, event)
  }

  // ---- 查询接口 ----

  /** 获取指定股票的异动事件列表 */
  getAnomalies(symbol: string): ChipAnomalyEvent[] {
    return this.anomalies.get(symbol) ?? []
  }

  /** 获取全部异动事件列表 */
  getAllAnomalies(): ChipAnomalyEvent[] {
    return [...this.allAnomaliesList]
  }

  /** 获取严重级别异动列表 */
  getCriticalAnomalies(): ChipAnomalyEvent[] {
    return this.allAnomaliesList.filter((a) => a.severity === 'critical')
  }

  /** 清空所有数据 */
  clear(): void {
    this.anomalies.clear()
    this.allAnomaliesList = []
    this.previousSnapshots.clear()
    logger.info('[ChipAnomalyDetector] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: ChipAnomalyDetector | null = null

export function getChipAnomalyDetector(config?: ChipAnomalyConfig): ChipAnomalyDetector {
  if (!_instance) _instance = new ChipAnomalyDetector(config)
  return _instance
}

export function startChipAnomalyDetector(config?: ChipAnomalyConfig): ChipAnomalyDetector {
  const detector = getChipAnomalyDetector(config)
  detector.start()
  return detector
}
