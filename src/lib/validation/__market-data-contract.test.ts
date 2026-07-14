/**
 * 行情数据契约校验测试。
 *
 * 验证目标：
 * 1. 合法 Mock/真实行情必须过校验（强制 Mock 走同一契约）；
 * 2. 植入脏数据（high<low、价格为负）必被捕获（证明校验有效）；
 * 3. 回放真实解析形态 fixture（茅台/宁德）必过校验；
 * 4. K 线日期必须单调递增；财务字段区间合理。
 *
 * @module lib/validation/__market-data-contract.test
 */

import { describe, it, expect } from 'vitest'
import {
  validateQuote,
  validateKline,
  validateFinancial,
  checkMarketDataContract,
  type QuoteLike,
  type KlineBarLike,
  type FinancialLike,
} from './marketDataContract'

describe('validateQuote', () => {
  it('合法行情通过校验', () => {
    const q: QuoteLike = {
      price: 100,
      open: 99,
      high: 102,
      low: 98,
      volume: 10000,
      amount: 1000000,
      timestamp: Date.now(),
      changePercent: 1.5,
      source: 'tencent',
    }
    const r = validateQuote(q)
    expect(r.ok).toBe(true)
    expect(r.issues).toHaveLength(0)
  })

  it('捕获 high < low 的脏数据', () => {
    const q: QuoteLike = { price: 100, open: 100, high: 90, low: 110, volume: 1, timestamp: Date.now() }
    const r = validateQuote(q)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'high>=low')).toBe(true)
  })

  it('捕获价格为负', () => {
    const q: QuoteLike = { price: -5, open: -5, high: -4, low: -6, volume: 1, timestamp: Date.now() }
    const r = validateQuote(q)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'positive')).toBe(true)
  })

  it('捕获涨跌幅越界', () => {
    const q: QuoteLike = { price: 100, open: 100, high: 101, low: 99, volume: 1, timestamp: Date.now(), changePercent: 35 }
    const r = validateQuote(q)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'range')).toBe(true)
  })
})

describe('validateKline', () => {
  it('合法 K 线通过', () => {
    const k: KlineBarLike = { date: '2024-01-02', open: 10, high: 11, low: 9, close: 10.5, volume: 100 }
    expect(validateKline(k).ok).toBe(true)
  })

  it('捕获 K 线 high < low', () => {
    const k: KlineBarLike = { date: '2024-01-02', open: 10, high: 8, low: 12, close: 9, volume: 100 }
    const r = validateKline(k)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'high>=low')).toBe(true)
  })
})

describe('validateFinancial', () => {
  it('茅台形态财务通过（含 480 天存货周转）', () => {
    const f: FinancialLike = {
      report_date: '2024-12-31',
      revenue: 1505.6,
      net_profit: 862.3,
      gross_margin: 91.5,
      net_margin: 57.3,
      revenue_yoy: 16.3,
      net_profit_yoy: 19.2,
      rd_ratio: 2.1,
      inventory_turnover_days: 480,
      shareholder_pledge: 0,
    }
    expect(validateFinancial(f).ok).toBe(true)
  })

  it('捕获营收为负', () => {
    const f: FinancialLike = { report_date: '2024-12-31', revenue: -10, net_profit: 1 }
    const r = validateFinancial(f)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'positive')).toBe(true)
  })

  it('捕获报告期格式非法', () => {
    const f: FinancialLike = { report_date: '2024/12/31' }
    const r = validateFinancial(f)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'format')).toBe(true)
  })
})

describe('checkMarketDataContract', () => {
  it('Mock 行情 + K 线（旧 OHLC 缺陷修复后）通过', () => {
    // 模拟修复后的 mockQuote：high>=max(price,open), low<=min(price,open)
    const price = 50
    const open = 49
    const quote: QuoteLike = {
      price,
      open,
      high: Math.max(price, open) + 0.5,
      low: Math.min(price, open) - 0.5,
      volume: 1000,
      timestamp: Date.now(),
      source: 'mock',
    }
    const klines: KlineBarLike[] = [
      { date: '2024-01-01', open: 48, high: 49, low: 47, close: 48.5, volume: 100 },
      { date: '2024-01-02', open: 48.5, high: 51, low: 48, close: 50, volume: 120 },
    ]
    const r = checkMarketDataContract({ quote, klines })
    expect(r.ok).toBe(true)
  })

  it('K 线日期非单调必失败', () => {
    const klines: KlineBarLike[] = [
      { date: '2024-01-02', open: 10, high: 11, low: 9, close: 10, volume: 1 },
      { date: '2024-01-01', open: 10, high: 11, low: 9, close: 10, volume: 1 },
    ]
    const r = checkMarketDataContract({ klines })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'monotonic')).toBe(true)
  })

  it('组合：真实形态（宁德时代）回放通过', () => {
    const quote: QuoteLike = {
      price: 180,
      open: 178,
      high: 185,
      low: 176,
      volume: 500000,
      amount: 90000000,
      timestamp: Date.now(),
      changePercent: 2.1,
      source: 'sina',
    }
    const financial: FinancialLike = {
      report_date: '2024-12-31',
      revenue: 4009.2,
      net_profit: 467.5,
      gross_margin: 22.8,
      net_margin: 11.7,
      revenue_yoy: 22.8,
      net_profit_yoy: 28.5,
      rd_ratio: 6.5,
      inventory_turnover_days: 95,
      shareholder_pledge: 8.5,
    }
    const r = checkMarketDataContract({ quote, financial })
    expect(r.ok).toBe(true)
  })
})
