/**
 * @test_id V9-TEST-ST-084
 * @covers_docs [V9-DOC-PROJ-092]
 */
/* eslint-disable no-console */
/**
 * 行情数据契约校验测试（补充校验层）
 *
 * 目标：
 * 1. 强制 Mock 数据走与真实数据相同的契约校验（不变量一致）
 * 2. 证明校验器能捕获植入的脏数据（校验有效，而非形同虚设）
 * 3. 用「回放真实解析形态」的 fixture 证明契约与真实数据期望一致
 *
 * 运行：
 *   npm test -- --run src/services/fetcher/__market-data-contract.test.ts
 */
import { describe, test, expect } from 'vitest'
import { mockQuote, mockKline, mockFinancial } from './mockProvider'
import {
  validateStockQuote,
  validateKline,
  validateFinancial,
  checkMarketDataContract,
} from './contractValidation'
import type { StockQuote, KlineItem } from './directDataAPI'

// ============================================================
// 1. Mock 数据必须通过同一契约（多次抽样覆盖随机性）
// ============================================================

describe('Mock 数据契约一致性', () => {
  test('mockQuote 多次抽样均满足行情不变量', () => {
    for (let i = 0; i < 50; i++) {
      const q = mockQuote(`600${i % 10}19`)
      const r = validateStockQuote(q)
      expect(r.ok, `mockQuote 违反契约: ${JSON.stringify(r.issues)}`).toBe(true)
      // 额外硬保证 OHLC 自洽
      expect(q.high).toBeGreaterThanOrEqual(q.low)
      expect(q.high).toBeGreaterThanOrEqual(q.open)
      expect(q.high).toBeGreaterThanOrEqual(q.price)
      expect(q.low).toBeLessThanOrEqual(q.open)
      expect(q.low).toBeLessThanOrEqual(q.price)
    }
  })

  test('mockKline 满足 K 线不变量与日期单调', () => {
    for (let i = 0; i < 20; i++) {
      const items = mockKline(`300${i % 10}50`, 30)
      const r = validateKline(items)
      expect(r.ok, `mockKline 违反契约: ${JSON.stringify(r.issues)}`).toBe(true)
    }
  })

  test('mockFinancial 满足财务不变量', () => {
    for (const code of ['600519', '300750', '600036', '002594', '00700', '688981', '601012', '999999']) {
      const f = mockFinancial(code)
      const r = validateFinancial(f)
      expect(r.ok, `mockFinancial(${code}) 违反契约: ${JSON.stringify(r.issues)}`).toBe(true)
    }
  })
})

// ============================================================
// 2. 校验器必须捕获植入的脏数据（否则校验无意义）
// ============================================================

describe('脏数据必须被校验器捕获', () => {
  const goodQuote: StockQuote = {
    code: '600519',
    name: '贵州茅台',
    price: 1680.5,
    change: 10.2,
    changePercent: 0.61,
    open: 1675.0,
    high: 1688.0,
    low: 1670.0,
    prevClose: 1670.3,
    volume: 3_000_000,
    amount: 5_040_000_000,
    timestamp: Date.now(),
    source: 'tencent',
  }

  test('high < low 应失败', () => {
    const r = validateStockQuote({ ...goodQuote, high: 1660, low: 1680 })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'high>=low')).toBe(true)
  })

  test('price <= 0 应失败', () => {
    const r = validateStockQuote({ ...goodQuote, price: 0 })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'positive')).toBe(true)
  })

  test('负成交量应失败', () => {
    const r = validateStockQuote({ ...goodQuote, volume: -5 })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.field === 'volume')).toBe(true)
  })

  test('未来时间戳应失败', () => {
    const r = validateStockQuote({ ...goodQuote, timestamp: Date.now() + 60 * 60 * 1000 })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'future')).toBe(true)
  })

  test('非法 source 应失败', () => {
    const r = validateStockQuote({ ...goodQuote, source: 'mars' as StockQuote['source'] })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.field === 'source')).toBe(true)
  })

  test('K 线日期非单调应失败', () => {
    const items: KlineItem[] = [
      { date: '2024-01-03', open: 10, high: 11, low: 9, close: 10.5, volume: 100, amount: 1000 },
      { date: '2024-01-01', open: 10, high: 11, low: 9, close: 10.2, volume: 100, amount: 1000 },
    ]
    const r = validateKline(items)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.rule === 'monotonic')).toBe(true)
  })

  test('财务 report_date 非法应失败', () => {
    const r = validateFinancial({ ...mockFinancial('600519'), report_date: '2024/12/31' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.field === 'report_date')).toBe(true)
  })

  test('财务营收非正应失败', () => {
    const r = validateFinancial({ ...mockFinancial('600519'), revenue: -1 })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.field === 'revenue')).toBe(true)
  })
})

// ============================================================
// 3. 回放真实解析形态（tencent / sina 解析后结构）必须通过契约
// ============================================================

describe('回放真实源解析形态（契约与真实一致）', () => {
  test('腾讯解析后行情形态通过校验', () => {
    // 形态对齐 directDataAPI.parseTencentQuote 输出（source: 'tencent'）
    const tencentShaped: StockQuote = {
      code: '600519',
      name: '贵州茅台',
      price: 1680.5,
      change: 10.2,
      changePercent: 0.61,
      open: 1675.0,
      high: 1688.0,
      low: 1670.0,
      prevClose: 1670.3,
      volume: 3_012_345,
      amount: 5_041_234_567,
      timestamp: Date.now(),
      source: 'tencent',
    }
    expect(validateStockQuote(tencentShaped).ok).toBe(true)
  })

  test('新浪解析后行情形态通过校验', () => {
    const sinaShaped: StockQuote = {
      code: '000001',
      name: '平安银行',
      price: 11.23,
      change: -0.15,
      changePercent: -1.32,
      open: 11.4,
      high: 11.5,
      low: 11.1,
      prevClose: 11.38,
      volume: 88_000_000,
      amount: 990_000_000,
      timestamp: Date.now(),
      source: 'sina',
    }
    expect(validateStockQuote(sinaShaped).ok).toBe(true)
  })

  test('聚合入口 checkMarketDataContract 与分步校验一致', () => {
    const q = mockQuote('600519')
    expect(checkMarketDataContract({ kind: 'quote', data: q }).ok).toBe(true)
    const items = mockKline('600519', 10)
    expect(checkMarketDataContract({ kind: 'kline', data: items }).ok).toBe(true)
    const f = mockFinancial('600519')
    expect(checkMarketDataContract({ kind: 'financial', data: f }).ok).toBe(true)
  })
})

// 便于本地调试时查看样例结果
console.log('[contract test] mockQuote 样例:', JSON.stringify(mockQuote('600519')))
