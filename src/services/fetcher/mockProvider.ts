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

/**
 * MockProvider
 */
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

// ============================================================
// 财务数据 Mock 常量（与Python端MOCK_FINANCIAL_DATA对齐）
// ============================================================

const MOCK_FINANCIAL_DATA: Record<string, import('./fetcherTypes').CollectFinancialData> = {
  // 贵州茅台 - 白酒龙头，高毛利、高净利率、低负债
  '600519': {
    report_date: '2024-12-31',
    revenue: 1505.6,
    revenue_yoy: 16.3,
    net_profit: 862.3,
    net_profit_yoy: 19.2,
    gross_margin: 91.5,
    net_margin: 57.3,
    operating_cf: 920.5,
    rd_ratio: 2.1,
    receivables: 12.8,
    inventory_turnover_days: 480,
    interest_bearing_debt: 0,
    goodwill: 0,
    net_assets: 1520.3,
    shareholder_pledge: 0,
  },
  // 宁德时代 - 新能源龙头，高增长、中等毛利
  '300750': {
    report_date: '2024-12-31',
    revenue: 4009.2,
    revenue_yoy: 22.8,
    net_profit: 467.5,
    net_profit_yoy: 28.5,
    gross_margin: 22.8,
    net_margin: 11.7,
    operating_cf: 580.3,
    rd_ratio: 6.5,
    receivables: 450.2,
    inventory_turnover_days: 95,
    interest_bearing_debt: 320.5,
    goodwill: 45.8,
    net_assets: 1850.6,
    shareholder_pledge: 8.5,
  },
  // 招商银行 - 银行龙头，稳定分红、高ROE
  '600036': {
    report_date: '2024-12-31',
    revenue: 3391.5,
    revenue_yoy: 5.2,
    net_profit: 1466.8,
    net_profit_yoy: 6.8,
    gross_margin: undefined, // 银行无毛利率概念
    net_margin: 43.2,
    operating_cf: 1250.3,
    rd_ratio: 3.8,
    receivables: undefined, // 银行应收类科目不同
    inventory_turnover_days: undefined,
    interest_bearing_debt: 8500.0,
    goodwill: 0,
    net_assets: 9200.5,
    shareholder_pledge: 0,
  },
  // 比亚迪 - 新能源车龙头，高增长、低净利率
  '002594': {
    report_date: '2024-12-31',
    revenue: 6023.2,
    revenue_yoy: 42.0,
    net_profit: 300.4,
    net_profit_yoy: 80.7,
    gross_margin: 20.2,
    net_margin: 5.0,
    operating_cf: 450.8,
    rd_ratio: 7.2,
    receivables: 380.5,
    inventory_turnover_days: 65,
    interest_bearing_debt: 520.3,
    goodwill: 12.5,
    net_assets: 2150.8,
    shareholder_pledge: 3.2,
  },
  // 海康威视 - 安防龙头，稳定增长、中等毛利
  '002415': {
    report_date: '2024-12-31',
    revenue: 893.5,
    revenue_yoy: 8.5,
    net_profit: 141.2,
    net_profit_yoy: 10.3,
    gross_margin: 44.5,
    net_margin: 15.8,
    operating_cf: 180.5,
    rd_ratio: 10.2,
    receivables: 280.3,
    inventory_turnover_days: 120,
    interest_bearing_debt: 85.0,
    goodwill: 28.5,
    net_assets: 520.8,
    shareholder_pledge: 5.8,
  },
  // 腾讯控股 - 互联网龙头（港股，用于测试非A股场景）
  '00700': {
    report_date: '2024-12-31',
    revenue: 6190.5,
    revenue_yoy: 9.8,
    net_profit: 1940.2,
    net_profit_yoy: 15.5,
    gross_margin: 52.3,
    net_margin: 31.3,
    operating_cf: 2150.8,
    rd_ratio: 12.5,
    receivables: 450.2,
    inventory_turnover_days: undefined,
    interest_bearing_debt: 2800.0,
    goodwill: 1850.5,
    net_assets: 6500.3,
    shareholder_pledge: 0,
  },
  // 中芯国际 - 半导体龙头，高研发、周期性
  '688981': {
    report_date: '2024-12-31',
    revenue: 527.3,
    revenue_yoy: 18.5,
    net_profit: 48.5,
    net_profit_yoy: -35.2,
    gross_margin: 19.8,
    net_margin: 9.2,
    operating_cf: 185.3,
    rd_ratio: 15.8,
    receivables: 85.2,
    inventory_turnover_days: 145,
    interest_bearing_debt: 420.5,
    goodwill: 0,
    net_assets: 1680.5,
    shareholder_pledge: 0,
  },
  // 隆基绿能 - 光伏龙头，周期下行、利润下滑
  '601012': {
    report_date: '2024-12-31',
    revenue: 856.2,
    revenue_yoy: -38.5,
    net_profit: -85.3,
    net_profit_yoy: -180.5,
    gross_margin: 12.5,
    net_margin: -9.9,
    operating_cf: 45.8,
    rd_ratio: 5.8,
    receivables: 180.5,
    inventory_turnover_days: 110,
    interest_bearing_debt: 280.3,
    goodwill: 15.2,
    net_assets: 680.5,
    shareholder_pledge: 12.5,
  },
}

/**
 * 生成模拟财务数据。
 * 优先返回预置的行业龙头数据，否则返回默认模拟数据。
 */
export function mockFinancial(code: string): import('./fetcherTypes').CollectFinancialData {
  const cleanCode = code.split('.')[0]?.toUpperCase() ?? code.toUpperCase()
  logger.info('[MockProvider] mockFinancial generated', { code: cleanCode })

  const preset = MOCK_FINANCIAL_DATA[cleanCode]
  if (preset) {
    return preset
  }

  // 默认模拟数据（用于未预置的股票）
  return {
    report_date: '2024-12-31',
    revenue: 100.0,
    revenue_yoy: 10.0,
    net_profit: 15.0,
    net_profit_yoy: 12.0,
    gross_margin: 30.0,
    net_margin: 15.0,
    operating_cf: 20.0,
    rd_ratio: 5.0,
    receivables: 25.0,
    inventory_turnover_days: 60.0,
    interest_bearing_debt: 50.0,
    goodwill: 5.0,
    net_assets: 120.0,
    shareholder_pledge: 8.0,
  }
}
