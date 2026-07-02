/**
 * Mock 数据提供器（Test Double）
 *
 * 物理隔离原则：Mock 数据生成逻辑只能存在于此文件，
 * 绝不允许出现在 src/ 业务主代码中。
 * 生产环境通过 DI 注入真实实现，开发/测试环境注入 Mock 实现。
 *
 * 包含两类职责：
 *   1. DataSourceProvider 实现（健康检查，供 DataSourceRegistry 使用）
 *   2. Mock 数据生成器（mockQuote / mockKline，供降级链末端和测试使用）
 */

import { getLogger } from '@/lib/logger'
import { DEFAULT_KLINE_DAYS } from './orchestrator/ports'
import type { DataSourceProvider, HealthStatus } from './types'
import type { StockQuote, KlineItem } from './directDataAPI'

const logger = getLogger()

// ============================================================
// Mock 数据常量（禁止 magic numbers）
// ============================================================

const MOCK_BASE_PRICE_MIN = 10
const MOCK_BASE_PRICE_RANGE = 90
const MOCK_VOLATILITY = 0.5
const MOCK_VOLUME_MAX = 1000000
const MOCK_AMOUNT_MAX = 100000000
const HOURS_PER_DAY = 24
const SECONDS_PER_HOUR = 3600
const MS_PER_SECOND = 1000
const VOLUME_MULTIPLIER = 100

// ============================================================
// DataSourceProvider 实现
// ============================================================

export class MockProvider implements DataSourceProvider {
  readonly name = 'mock'

  healthCheck(): Promise<HealthStatus> {
    return Promise.resolve({ status: 'healthy', latency: 0 })
  }
}

// ============================================================
// Mock 数据生成器（从 dataSourceOrchestrator.ts 迁移）
// ============================================================

/** 字符串哈希（用于生成稳定的 Mock 基准价格） */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** 保留两位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 生成合理的模拟行情。
 * 基于股票代码哈希生成稳定基准价，叠加随机波动。
 */
export function mockQuote(code: string): StockQuote {
  logger.info('[MockProvider] mockQuote generated', { code })
  const basePrice = MOCK_BASE_PRICE_MIN + (hashString(code) % MOCK_BASE_PRICE_RANGE)
  const price = basePrice + (Math.random() - MOCK_VOLATILITY) * 2
  const prevClose = basePrice
  const change = price - prevClose
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0
  return {
    code,
    name: `MOCK_${code}`,
    price: round2(price),
    change: round2(change),
    changePercent: round2(changePercent),
    open: round2(prevClose + (Math.random() - MOCK_VOLATILITY)),
    high: round2(price + Math.random()),
    low: round2(price - Math.random()),
    prevClose: round2(prevClose),
    volume: Math.floor(Math.random() * MOCK_VOLUME_MAX) * VOLUME_MULTIPLIER,
    amount: Math.floor(Math.random() * MOCK_AMOUNT_MAX),
    timestamp: Date.now(),
    source: 'mock',
  }
}

/**
 * 生成模拟 K 线（可指定天数）。
 * 基于股票代码哈希生成稳定起始价，逐日随机游走。
 */
export function mockKline(code: string, days: number): KlineItem[] {
  const safeDays = days > 0 ? days : DEFAULT_KLINE_DAYS
  logger.info('[MockProvider] mockKline generated', { code, days: safeDays })
  const items: KlineItem[] = []
  let prevClose = MOCK_BASE_PRICE_MIN + (hashString(code) % MOCK_BASE_PRICE_RANGE)
  const today = new Date()
  const dayMs = HOURS_PER_DAY * SECONDS_PER_HOUR * MS_PER_SECOND
  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * dayMs)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const open = prevClose
    const close = round2(open + (Math.random() - MOCK_VOLATILITY) * 4)
    const high = round2(Math.max(open, close) + Math.random() * 2)
    const low = round2(Math.min(open, close) - Math.random() * 2)
    const volume = Math.floor(Math.random() * MOCK_VOLUME_MAX) * VOLUME_MULTIPLIER
    const amount = Math.floor(volume * close)
    items.push({
      date: dateStr,
      open: round2(open),
      high,
      low,
      close,
      volume,
      amount,
    })
    prevClose = close
  }
  return items
}
