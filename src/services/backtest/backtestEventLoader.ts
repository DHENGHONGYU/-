/**
 * @module backtestEventLoader
 * @description 策略回测事件加载域。
 *
 * 从 BacktestEngine.ts 温和拆分（PR-6 阶段 3.2），负责：
 * - 从 dataLayer 加载 signals/orders 事件
 * - 事件合并去重与按日期分组
 * - 预加载行情数据并提供按日期查询价格的辅助函数
 * - 生成回测日期序列（跳过周末）
 *
 * 行为等价性：本模块所有函数均为原 BacktestEngine 私有方法的 1:1 迁移，
 * 不改任何算法、不调整签名、不重命名。拆分前 28 个测试基线全绿，
 * 拆分后必须保持全绿。
 *
 * @see BacktestEngine.ts — 主编排器，调用本模块函数
 * @see src/data/dataLayer.ts — 数据源
 */

import { dataLayer } from '@/data/dataLayer'
import type { DailyQuotes, Signal, Order } from '@/data/types'
import { getLogger } from '@/lib/logger'
import type { BacktestEngineConfig } from './BacktestEngine'

const logger = getLogger()

/** 毫秒精度：一天结束时刻的毫秒部分 */
const MS_END_OF_DAY = 999

/** 信号事件不足此数量时，用订单事件补充合并 */
const MIN_SIGNAL_EVENTS_FOR_COMBINE = 5

// ============================================================
// 类型定义（从 BacktestEngine.ts 迁出，供主文件 + metrics 共享）
// ============================================================

export interface BacktestEvent {
  symbol: string
  direction: 'buy' | 'sell'
  date: string
  price: number
  confidence: number
  source: 'signal' | 'order'
  strategy?: string
}

// ============================================================
// 事件加载
// ============================================================

/**
 * 加载信号/订单事件，必要时合并去重。
 * 行为契约：信号事件 < MIN_SIGNAL_EVENTS_FOR_COMBINE 时合并订单事件。
 */
export async function loadBacktestEvents(config: BacktestEngineConfig): Promise<BacktestEvent[]> {
  const startTs = new Date(config.startDate).getTime()
  const endTsEod = new Date(config.endDate)
  endTsEod.setHours(23, 59, 59, MS_END_OF_DAY)
  const endTs = endTsEod.getTime()

  // 1. 从 signals 获取策略信号
  const signalEvents = await loadSignalEvents(config, startTs, endTs)

  // 2. 若信号不足，用 orders 补充
  if (signalEvents.length < MIN_SIGNAL_EVENTS_FOR_COMBINE) {
    const orderEvents = await loadOrderEvents(config, startTs, endTs)
    const combined = mergeBacktestEvents(signalEvents, orderEvents)
    return combined.sort((a, b) => a.date.localeCompare(b.date))
  }

  return signalEvents.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 从 dataLayer.signals 加载信号事件并按策略过滤。
 * 行为契约：读取失败时返回空数组（优雅降级）。
 */
export async function loadSignalEvents(
  config: BacktestEngineConfig,
  startTs: number,
  endTs: number,
): Promise<BacktestEvent[]> {
  let signals: Signal[] = []
  try {
    signals = await dataLayer.signals.list()
  } catch {
    logger.warn('[BacktestEngine] 读取 signals 失败')
    return []
  }

  const filtered = signals.filter((s) => {
    const ts = s.createdAt ?? 0
    if (ts < startTs || ts > endTs) return false
    if (s.direction !== 'buy' && s.direction !== 'sell') return false
    if (config.strategy === 'hot_sector') return s.strategy === 'hot-sector'
    if (config.strategy === 'value_pit') return s.strategy === 'value-pit'
    return true // composite 或 strategy 未匹配时全保留
  })

  // 预加载行情用于定价
  const quotesCache = new Map<string, DailyQuotes>()
  for (const s of filtered) {
    if (!quotesCache.has(s.symbol)) {
      const q = await dataLayer.dailyQuotes.get(s.symbol)
      if (q) quotesCache.set(s.symbol, q)
    }
  }

  return filtered
    .map((s) => {
      const date = new Date(s.createdAt ?? Date.now()).toISOString().slice(0, 10)
      const quotes = quotesCache.get(s.symbol)
      const price = getPriceForDate(s.symbol, date, quotesCache) ?? quotes?.latest.close ?? 0
      return {
        symbol: s.symbol,
        direction: s.direction as 'buy' | 'sell',
        date,
        price,
        confidence: s.confidence,
        source: 'signal' as const,
        strategy: s.strategy,
      }
    })
    .filter((e) => e.price > 0)
}

/**
 * 从 dataLayer.orders 加载订单事件作为信号补充。
 * 行为契约：读取失败时返回空数组（优雅降级）。
 */
export async function loadOrderEvents(
  _config: BacktestEngineConfig,
  startTs: number,
  endTs: number,
): Promise<BacktestEvent[]> {
  let orders: Order[] = []
  try {
    orders = await dataLayer.orders.list()
  } catch {
    logger.warn('[BacktestEngine] 读取 orders 失败')
    return []
  }

  const filtered = orders.filter((o) => {
    const ts = o.createdAt ?? 0
    return ts >= startTs && ts <= endTs && (o.direction === 'buy' || o.direction === 'sell')
  })

  return filtered.map((o) => ({
    symbol: o.symbol,
    direction: o.direction,
    date: new Date(o.createdAt ?? Date.now()).toISOString().slice(0, 10),
    price: o.price,
    confidence: 0.5,
    source: 'order' as const,
    strategy: undefined,
  }))
}

/**
 * 合并信号与订单事件，按 `${date}-${symbol}-${direction}` 去重。
 */
export function mergeBacktestEvents(
  signals: BacktestEvent[],
  orders: BacktestEvent[],
): BacktestEvent[] {
  const seen = new Set<string>()
  const merged: BacktestEvent[] = []

  for (const e of [...signals, ...orders]) {
    const key = `${e.date}-${e.symbol}-${e.direction}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(e)
    }
  }

  return merged
}

/**
 * 按日期分组事件。
 */
export function groupEventsByDate(events: BacktestEvent[]): Map<string, BacktestEvent[]> {
  const map = new Map<string, BacktestEvent[]>()
  for (const e of events) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  return map
}

// ============================================================
// 行情数据
// ============================================================

/**
 * 预加载事件涉及的所有 symbol 行情。
 */
export async function preloadQuotes(events: BacktestEvent[]): Promise<Map<string, DailyQuotes>> {
  const cache = new Map<string, DailyQuotes>()
  const symbols = new Set(events.map((e) => e.symbol))
  for (const sym of symbols) {
    const q = await dataLayer.dailyQuotes.get(sym)
    if (q) cache.set(sym, q)
  }
  return cache
}

/**
 * 按日期查询 symbol 收盘价。
 * 行为契约：找不到对应日期时回退到 latest.close。
 */
export function getPriceForDate(
  symbol: string,
  date: string,
  cache: Map<string, DailyQuotes>,
): number | undefined {
  const quotes = cache.get(symbol)
  if (!quotes) return undefined
  const bar = quotes.history.find((b) => b.date === date)
  if (bar) return bar.close
  // 若历史无该日，回退到最新价（适用于信号日期在最新价附近）
  return quotes.latest.close
}

// ============================================================
// 日期工具
// ============================================================

/**
 * 生成日期序列（跳过周末）。
 * 行为契约：包含起止日期，跳过周六日，严格升序。
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const curr = new Date(start)

  while (curr <= end) {
    // 跳过周末（简化：仅周六日）
    const day = curr.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(curr.toISOString().slice(0, 10))
    }
    curr.setDate(curr.getDate() + 1)
  }

  return dates
}
