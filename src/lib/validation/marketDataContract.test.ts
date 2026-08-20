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

describe('lib/validation/marketDataContract', () => {
  describe('validateQuote', () => {
    it('合法行情数据 → ok=true，无 issues', () => {
      const q: QuoteLike = {
        price: 10.5,
        open: 10.2,
        high: 10.8,
        low: 10.0,
        volume: 1000,
        amount: 10500,
        changePercent: 2.94,
        timestamp: Date.now(),
        source: 'tencent',
      }
      const r = validateQuote(q)
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    it('price 缺失 / 零 / 负 → error', () => {
      expect(validateQuote({}).ok).toBe(false)
      expect(validateQuote({ price: 0 }).ok).toBe(false)
      expect(validateQuote({ price: -1 }).ok).toBe(false)
      expect(validateQuote({ price: NaN }).ok).toBe(false)
      expect(validateQuote({ price: Infinity }).ok).toBe(false)
      const issue = validateQuote({ price: -1 }).issues.find((i) => i.field === 'price')!
      expect(issue.rule).toBe('positive')
    })

    it('volume / amount 负数 → error', () => {
      const r = validateQuote({ price: 10, volume: -1, amount: -5 })
      expect(r.ok).toBe(false)
      expect(r.issues.some((i) => i.field === 'volume' && i.rule === 'nonnegative')).toBe(true)
      expect(r.issues.some((i) => i.field === 'amount' && i.rule === 'nonnegative')).toBe(true)
    })

    it('volume / amount 非有限数 → error', () => {
      const r = validateQuote({ price: 10, volume: NaN, amount: Infinity })
      expect(r.ok).toBe(false)
      expect(r.issues.filter((i) => i.field === 'volume')).toHaveLength(1)
      expect(r.issues.filter((i) => i.field === 'amount')).toHaveLength(1)
    })

    it('OHLC 非有限 → error', () => {
      const r = validateQuote({
        price: 10,
        open: 10,
        high: NaN,
        low: 9,
      })
      expect(r.issues.some((i) => i.field === 'ohlc' && i.rule === 'finite')).toBe(true)
    })

    it('OHLC 一致性：high < low → error', () => {
      const r = validateQuote({ price: 10, open: 10, high: 9, low: 11, close: 10 })
      expect(r.issues.some((i) => i.rule === 'high>=low')).toBe(true)
    })

    it('OHLC 一致性：high < open 或 high < close → error', () => {
      const r1 = validateQuote({ price: 12, open: 12, high: 10, low: 9, close: 11 })
      expect(r1.issues.some((i) => i.rule === 'high>=open')).toBe(true)
      const r2 = validateQuote({ price: 12, open: 10, high: 11, low: 9, close: 12 })
      expect(r2.issues.some((i) => i.rule === 'high>=close')).toBe(true)
    })

    it('OHLC 一致性：low > open 或 low > close → error', () => {
      const r1 = validateQuote({ price: 10, open: 10, high: 15, low: 12, close: 13 })
      expect(r1.issues.some((i) => i.rule === 'low<=open')).toBe(true)
      const r2 = validateQuote({ price: 10, open: 11, high: 15, low: 12, close: 10 })
      expect(r2.issues.some((i) => i.rule === 'low<=close')).toBe(true)
    })

    it('无 close 时以 price 作为收盘等价', () => {
      // 一致性应该通过（high=11 ≥ close=10, low=9 ≤ close=10）
      const r = validateQuote({ price: 10, open: 9.5, high: 11, low: 9 })
      expect(r.issues.filter((i) => i.field === 'ohlc' && (i.rule.startsWith('high>=') || i.rule.startsWith('low<=')))).toHaveLength(0)
      expect(r.ok).toBe(true)
    })

    it('涨跌幅超出 [-20, 20] → error', () => {
      const base = { price: 10, open: 10, high: 11, low: 9 }
      const r1 = validateQuote({ ...base, changePercent: 21 })
      expect(r1.issues.some((i) => i.field === 'changePercent' && i.rule === 'range')).toBe(true)
      const r2 = validateQuote({ ...base, changePercent: -21 })
      expect(r2.issues.some((i) => i.field === 'changePercent' && i.rule === 'range')).toBe(true)
      // 合法边界
      expect(validateQuote({ ...base, changePercent: 20 }).ok).toBe(true)
      expect(validateQuote({ ...base, changePercent: -20 }).ok).toBe(true)
    })

    it('时间戳未来 7 天以上 → error', () => {
      const farFuture = Date.now() + 8 * 24 * 60 * 60 * 1000
      const r = validateQuote({ price: 10, open: 10, high: 11, low: 9, timestamp: farFuture })
      expect(r.issues.some((i) => i.field === 'timestamp' && i.rule === 'future')).toBe(true)
    })

    it('时间戳超过 1 年 → error', () => {
      const tooOld = Date.now() - 366 * 24 * 60 * 60 * 1000
      const r = validateQuote({ price: 10, open: 10, high: 11, low: 9, timestamp: tooOld })
      expect(r.issues.some((i) => i.field === 'timestamp' && i.rule === 'too_old')).toBe(true)
    })

    it('未知 source → warn（不影响 ok）', () => {
      const r = validateQuote({ price: 10, open: 10, high: 11, low: 9, source: 'weird-source' })
      expect(r.ok).toBe(true) // warn 不计入 error
      const srcIssue = r.issues.find((i) => i.field === 'source')!
      expect(srcIssue.severity).toBe('warn')
      expect(srcIssue.rule).toBe('valid')
    })

    it('合法 source → 无 issues', () => {
      const base = { price: 10, open: 10, high: 11, low: 9 }
      for (const src of ['tencent', 'sina', 'netease', 'akshare', 'mock', 'unknown']) {
        const r = validateQuote({ ...base, source: src })
        expect(r.issues.filter((i) => i.field === 'source')).toHaveLength(0)
        expect(r.ok).toBe(true)
      }
    })
  })

  describe('validateKline', () => {
    const validKline: KlineBarLike = {
      date: '2026-01-15',
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 1000,
      amount: 11000,
    }

    it('合法 K 线 → ok=true', () => {
      expect(validateKline(validKline).ok).toBe(true)
    })

    it('OHLC 非有限 → ok=false，early return', () => {
      const r = validateKline({ ...validKline, high: NaN })
      expect(r.ok).toBe(false)
      // early return 后不应再执行 volume 等其他校验
      expect(r.issues.length).toBe(1)
      expect(r.issues[0]!.rule).toBe('finite')
    })

    it('OHLC 一致性 5 条规则均覆盖', () => {
      const scenarios: Array<[Partial<KlineBarLike>, string]> = [
        [{ high: 8, low: 10 }, 'high>=low'],
        [{ high: 9, open: 10 }, 'high>=open'],
        [{ high: 10, close: 11 }, 'high>=close'],
        [{ low: 11, open: 10 }, 'low<=open'],
        [{ low: 12, close: 11 }, 'low<=close'],
      ]
      for (const [patch, rule] of scenarios) {
        const r = validateKline({ ...validKline, ...patch })
        expect(r.issues.some((i) => i.rule === rule)).toBe(true)
      }
    })

    it('volume 负数或非有限 → error', () => {
      expect(validateKline({ ...validKline, volume: -1 }).issues.some((i) => i.rule === 'nonnegative')).toBe(true)
      expect(validateKline({ ...validKline, volume: NaN }).issues.some((i) => i.rule === 'nonnegative')).toBe(true)
    })

    it('date 非法格式 → warn（不影响 ok）', () => {
      const r1 = validateKline({ ...validKline, date: '2026/01/15' })
      expect(r1.ok).toBe(true)
      expect(r1.issues.some((i) => i.field === 'date' && i.rule === 'format')).toBe(true)
      const r2 = validateKline({ ...validKline, date: undefined })
      expect(r2.issues.filter((i) => i.field === 'date')).toHaveLength(0)
    })
  })

  describe('validateFinancial', () => {
    const valid: FinancialLike = {
      report_date: '2025-09-30',
      revenue: 1_000_000,
      net_profit: 120_000,
      gross_margin: 35,
      net_margin: 12,
      revenue_yoy: 8.5,
      net_profit_yoy: 15.2,
      rd_ratio: 7.3,
      inventory_turnover_days: 90,
      shareholder_pledge: 10,
    }

    it('合法财务数据 → ok=true', () => {
      expect(validateFinancial(valid).ok).toBe(true)
    })

    it('百分比字段（6 个）超出 [-200,200] → error', () => {
      const pctFields = ['gross_margin', 'net_margin', 'revenue_yoy', 'net_profit_yoy', 'rd_ratio', 'shareholder_pledge'] as const
      for (const f of pctFields) {
        const tooBig = validateFinancial({ [f]: 300 })
        expect(tooBig.issues.some((i) => i.field === f && i.rule === 'range')).toBe(true)
        const tooSmall = validateFinancial({ [f]: -300 })
        expect(tooSmall.issues.some((i) => i.field === f && i.rule === 'range')).toBe(true)
        const notFinite = validateFinancial({ [f]: NaN })
        expect(notFinite.issues.some((i) => i.field === f && i.rule === 'finite')).toBe(true)
      }
    })

    it('百分比字段边界值 [-200, 200] 通过', () => {
      expect(validateFinancial({ gross_margin: 200 }).ok).toBe(true)
      expect(validateFinancial({ gross_margin: -200 }).ok).toBe(true)
    })

    it('inventory_turnover_days 超出 [0,2000] → error', () => {
      const r1 = validateFinancial({ inventory_turnover_days: -1 })
      expect(r1.issues.some((i) => i.field === 'inventory_turnover_days' && i.rule === 'range')).toBe(true)
      const r2 = validateFinancial({ inventory_turnover_days: 2001 })
      expect(r2.issues.some((i) => i.field === 'inventory_turnover_days' && i.rule === 'range')).toBe(true)
      const r3 = validateFinancial({ inventory_turnover_days: NaN })
      expect(r3.issues.some((i) => i.field === 'inventory_turnover_days' && i.rule === 'finite')).toBe(true)
      // 合法边界
      expect(validateFinancial({ inventory_turnover_days: 0 }).ok).toBe(true)
      expect(validateFinancial({ inventory_turnover_days: 2000 }).ok).toBe(true)
    })

    it('revenue 非正 / 非有限 → error', () => {
      expect(validateFinancial({ revenue: 0 }).issues.some((i) => i.field === 'revenue')).toBe(true)
      expect(validateFinancial({ revenue: -1 }).issues.some((i) => i.field === 'revenue')).toBe(true)
      expect(validateFinancial({ revenue: NaN }).issues.some((i) => i.field === 'revenue')).toBe(true)
    })

    it('net_profit 非有限 → error', () => {
      expect(validateFinancial({ net_profit: NaN }).issues.some((i) => i.field === 'net_profit' && i.rule === 'finite')).toBe(true)
      // net_profit 允许负（亏损），但必须有限
      expect(validateFinancial({ net_profit: -500 }).ok).toBe(true)
    })

    it('report_date 格式非法 → error', () => {
      const r = validateFinancial({ report_date: '2025/09/30' })
      expect(r.issues.some((i) => i.field === 'report_date' && i.rule === 'format')).toBe(true)
    })

    it('report_date 年份异常（<1990 或 >明年+1） → error', () => {
      const r1 = validateFinancial({ report_date: '1989-12-31' })
      expect(r1.issues.some((i) => i.field === 'report_date' && i.rule === 'range')).toBe(true)
      const futureYear = new Date().getFullYear() + 2
      const r2 = validateFinancial({ report_date: `${futureYear}-01-01` })
      expect(r2.issues.some((i) => i.field === 'report_date' && i.rule === 'range')).toBe(true)
    })

    it('report_date 合法年份（1990 及未来 1 年内） → ok', () => {
      expect(validateFinancial({ report_date: '2000-01-01' }).ok).toBe(true)
    })

    it('report_date undefined → 跳过校验', () => {
      expect(validateFinancial({}).issues.filter((i) => i.field === 'report_date')).toHaveLength(0)
    })
  })

  describe('checkMarketDataContract', () => {
    it('quote + klines + financial 组合校验', () => {
      const r = checkMarketDataContract({
        quote: { price: 10, open: 10, high: 11, low: 9, timestamp: Date.now(), source: 'akshare' },
        financial: { report_date: '2025-09-30', revenue: 1_000_000, net_profit: 100_000, gross_margin: 30 },
        klines: [
          { date: '2026-01-01', open: 10, high: 11, low: 9, close: 10.5, volume: 100 },
          { date: '2026-01-02', open: 10.5, high: 12, low: 10, close: 11.5, volume: 200 },
        ],
      })
      expect(r.ok).toBe(true)
    })

    it('K 线日期非单调递增 → error', () => {
      const r = checkMarketDataContract({
        klines: [
          { date: '2026-01-05', open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { date: '2026-01-03', open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(r.ok).toBe(false)
      expect(r.issues.some((i) => i.rule === 'monotonic')).toBe(true)
    })

    it('K 线子问题加上 klines[i]. 前缀', () => {
      const r = checkMarketDataContract({
        klines: [
          { date: 'bad-date', open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(r.issues.some((i) => i.field.startsWith('klines[0].'))).toBe(true)
    })

    it('空 klines → 跳过 K 线校验', () => {
      const r = checkMarketDataContract({
        quote: { price: 10, open: 10, high: 11, low: 9 },
        klines: [],
      })
      expect(r.ok).toBe(true)
    })

    it('组合校验任一子项失败 → 整体失败', () => {
      const r = checkMarketDataContract({
        quote: { price: -1 },
        klines: [{ open: 10, high: 11, low: 9, close: 10, volume: 100 }],
      })
      expect(r.ok).toBe(false)
      expect(r.issues.some((i) => i.field === 'price')).toBe(true)
    })
  })
})
