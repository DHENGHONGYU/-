/**
 * marketDataContract.test.ts — 100% 覆盖
 *
 * 覆盖 validateQuote / validateKline / validateFinancial / checkMarketDataContract
 * 所有 if 分支（含 17 处 OHLC 一致性 / 区间 / 时间戳 / source / 日期格式 等校验）
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

// ── 辅助：查找 issue ──
function findIssue(issues: { field: string; rule: string }[], field: string, rule: string) {
  return issues.find(i => i.field === field && i.rule === rule)
}

describe('marketDataContract', () => {
  // ══════════════════════════════════════════════════════════════
  // 1. validateQuote — 行情校验
  // ══════════════════════════════════════════════════════════════
  describe('validateQuote()', () => {
    it('合法行情 → ok=true', () => {
      const q: QuoteLike = {
        price: 10, open: 9.5, high: 10.5, low: 9.4, close: 10,
        volume: 1000, amount: 10000, changePercent: 5,
        timestamp: Date.now() - 1000, source: 'tencent',
      }
      const r = validateQuote(q)
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    // — price 分支 —
    it('price 非有限数（字符串）→ error positive', () => {
      const r = validateQuote({ price: 'abc' as unknown as number })
      expect(findIssue(r.issues, 'price', 'positive')).toBeDefined()
      expect(r.ok).toBe(false)
    })

    it('price = 0 → error positive', () => {
      const r = validateQuote({ price: 0 })
      expect(findIssue(r.issues, 'price', 'positive')).toBeDefined()
    })

    it('price = -5 → error positive', () => {
      const r = validateQuote({ price: -5 })
      expect(findIssue(r.issues, 'price', 'positive')).toBeDefined()
    })

    it('price = NaN → error positive', () => {
      const r = validateQuote({ price: NaN })
      expect(findIssue(r.issues, 'price', 'positive')).toBeDefined()
    })

    it('price = Infinity → error positive', () => {
      const r = validateQuote({ price: Infinity })
      expect(findIssue(r.issues, 'price', 'positive')).toBeDefined()
    })

    // — volume 分支 —
    it('volume = -1 → error nonnegative', () => {
      const r = validateQuote({ price: 10, volume: -1 })
      expect(findIssue(r.issues, 'volume', 'nonnegative')).toBeDefined()
    })

    it('volume = NaN → error nonnegative', () => {
      const r = validateQuote({ price: 10, volume: NaN })
      expect(findIssue(r.issues, 'volume', 'nonnegative')).toBeDefined()
    })

    it('volume = Infinity → error nonnegative', () => {
      const r = validateQuote({ price: 10, volume: Infinity })
      expect(findIssue(r.issues, 'volume', 'nonnegative')).toBeDefined()
    })

    it('volume undefined → 不校验', () => {
      const r = validateQuote({ price: 10 })
      expect(findIssue(r.issues, 'volume', 'nonnegative')).toBeUndefined()
    })

    // — amount 分支 —
    it('amount = -100 → error nonnegative', () => {
      const r = validateQuote({ price: 10, amount: -100 })
      expect(findIssue(r.issues, 'amount', 'nonnegative')).toBeDefined()
    })

    it('amount = NaN → error nonnegative', () => {
      const r = validateQuote({ price: 10, amount: NaN })
      expect(findIssue(r.issues, 'amount', 'nonnegative')).toBeDefined()
    })

    // — OHLC finite 分支 —
    it('OHLC 含非有限数 → error finite', () => {
      const r = validateQuote({ price: 10, open: NaN, high: 11, low: 9 })
      expect(findIssue(r.issues, 'ohlc', 'finite')).toBeDefined()
    })

    it('OHLC high=Infinity → error finite', () => {
      const r = validateQuote({ price: 10, open: 9, high: Infinity, low: 9 })
      expect(findIssue(r.issues, 'ohlc', 'finite')).toBeDefined()
    })

    // — OHLC 一致性 5 个子分支（仅触发 high<low / high<open / high<close / low>open / low>close）—
    it('high < low → error high>=low', () => {
      const r = validateQuote({ price: 10, open: 10, high: 9, low: 11, close: 10 })
      expect(findIssue(r.issues, 'ohlc', 'high>=low')).toBeDefined()
    })

    it('high < open → error high>=open', () => {
      const r = validateQuote({ price: 10, open: 12, high: 11, low: 9, close: 10 })
      expect(findIssue(r.issues, 'ohlc', 'high>=open')).toBeDefined()
    })

    it('high < close → error high>=close', () => {
      const r = validateQuote({ price: 10, open: 9, high: 9.5, low: 9, close: 11 })
      expect(findIssue(r.issues, 'ohlc', 'high>=close')).toBeDefined()
    })

    it('low > open → error low<=open', () => {
      const r = validateQuote({ price: 10, open: 8, high: 12, low: 9, close: 10 })
      expect(findIssue(r.issues, 'ohlc', 'low<=open')).toBeDefined()
    })

    it('low > close → error low<=close', () => {
      const r = validateQuote({ price: 10, open: 10, high: 12, low: 11, close: 9 })
      expect(findIssue(r.issues, 'ohlc', 'low<=close')).toBeDefined()
    })

    it('OHLC 全部相等（边界：PRICE_EPSILON 容差）→ ok', () => {
      const r = validateQuote({ price: 10, open: 10, high: 10, low: 10, close: 10 })
      expect(r.ok).toBe(true)
    })

    it('close 缺省时使用 price 作为 close', () => {
      // price=10, close 缺省 → c=10, high=11, low=9, open=9.5
      const r = validateQuote({ price: 10, open: 9.5, high: 11, low: 9 })
      expect(findIssue(r.issues, 'ohlc', 'high>=low')).toBeUndefined()
      expect(r.ok).toBe(true)
    })

    // — changePercent 分支 —
    it('changePercent > 20 → error range', () => {
      const r = validateQuote({ price: 10, changePercent: 25 })
      expect(findIssue(r.issues, 'changePercent', 'range')).toBeDefined()
    })

    it('changePercent < -20 → error range', () => {
      const r = validateQuote({ price: 10, changePercent: -25 })
      expect(findIssue(r.issues, 'changePercent', 'range')).toBeDefined()
    })

    it('changePercent = 20 → 边界不报错', () => {
      const r = validateQuote({ price: 10, changePercent: 20 })
      expect(findIssue(r.issues, 'changePercent', 'range')).toBeUndefined()
    })

    it('changePercent = -20 → 边界不报错', () => {
      const r = validateQuote({ price: 10, changePercent: -20 })
      expect(findIssue(r.issues, 'changePercent', 'range')).toBeUndefined()
    })

    it('changePercent = NaN → 不校验（isFiniteNumber=false）', () => {
      const r = validateQuote({ price: 10, changePercent: NaN })
      expect(findIssue(r.issues, 'changePercent', 'range')).toBeUndefined()
    })

    it('changePercent undefined → 不校验', () => {
      const r = validateQuote({ price: 10 })
      expect(findIssue(r.issues, 'changePercent', 'range')).toBeUndefined()
    })

    // — timestamp 分支 —
    it('timestamp 在未来超过 7 天 → error future', () => {
      const r = validateQuote({ price: 10, timestamp: Date.now() + 8 * 24 * 60 * 60 * 1000 })
      expect(findIssue(r.issues, 'timestamp', 'future')).toBeDefined()
    })

    it('timestamp 超过 1 年前 → error too_old', () => {
      const r = validateQuote({ price: 10, timestamp: Date.now() - 400 * 24 * 60 * 60 * 1000 })
      expect(findIssue(r.issues, 'timestamp', 'too_old')).toBeDefined()
    })

    it('timestamp 合法（最近）→ 不报错', () => {
      const r = validateQuote({ price: 10, timestamp: Date.now() - 1000 })
      expect(findIssue(r.issues, 'timestamp', 'future')).toBeUndefined()
      expect(findIssue(r.issues, 'timestamp', 'too_old')).toBeUndefined()
    })

    it('timestamp = NaN → 不校验', () => {
      const r = validateQuote({ price: 10, timestamp: NaN })
      expect(findIssue(r.issues, 'timestamp', 'future')).toBeUndefined()
    })

    // — source 分支 —
    it('source 不在 VALID_SOURCES 中 → warn valid', () => {
      const r = validateQuote({ price: 10, open: 9, high: 11, low: 9, close: 10, source: 'unknownSource' })
      const issue = findIssue(r.issues, 'source', 'valid')
      expect(issue).toBeDefined()
      expect(issue!.severity).toBe('warn')
      expect(r.ok).toBe(true) // warn 不影响 ok
    })

    it('source = tencent → 不报错', () => {
      const r = validateQuote({ price: 10, source: 'tencent' })
      expect(findIssue(r.issues, 'source', 'valid')).toBeUndefined()
    })

    it('source = mock → 不报错', () => {
      const r = validateQuote({ price: 10, source: 'mock' })
      expect(findIssue(r.issues, 'source', 'valid')).toBeUndefined()
    })

    it('source undefined → 不校验', () => {
      const r = validateQuote({ price: 10 })
      expect(findIssue(r.issues, 'source', 'valid')).toBeUndefined()
    })

    it('ok=true 仅当所有 issue.severity !== error', () => {
      // source warn 不影响 ok
      const r = validateQuote({ price: 10, open: 9, high: 11, low: 9, close: 10, source: 'unknownSource' })
      expect(r.ok).toBe(true)
    })

    it('ok=false 当存在 error severity', () => {
      const r = validateQuote({ price: 0 })
      expect(r.ok).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 2. validateKline — K 线校验
  // ══════════════════════════════════════════════════════════════
  describe('validateKline()', () => {
    it('合法 K 线 → ok=true', () => {
      const k: KlineBarLike = {
        date: '2025-01-01', open: 10, high: 11, low: 9, close: 10.5, volume: 1000,
      }
      const r = validateKline(k)
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    // — OHLC finite 分支（提前 return）—
    it('OHLC 含非有限数 → error finite + 提前 return（无后续 issue）', () => {
      const r = validateKline({ date: '2025-01-01', open: NaN, high: 11, low: 9, close: 10, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'finite')).toBeDefined()
      expect(r.issues).toHaveLength(1) // 提前 return
      expect(r.ok).toBe(false)
    })

    it('high = Infinity → error finite', () => {
      const r = validateKline({ open: 10, high: Infinity, low: 9, close: 10, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'finite')).toBeDefined()
    })

    // — OHLC 一致性 5 个子分支 —
    it('high < low → error high>=low', () => {
      const r = validateKline({ open: 10, high: 9, low: 11, close: 10, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'high>=low')).toBeDefined()
    })

    it('high < open → error high>=open', () => {
      const r = validateKline({ open: 12, high: 11, low: 9, close: 10, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'high>=open')).toBeDefined()
    })

    it('high < close → error high>=close', () => {
      const r = validateKline({ open: 9, high: 9.5, low: 9, close: 11, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'high>=close')).toBeDefined()
    })

    it('low > open → error low<=open', () => {
      const r = validateKline({ open: 8, high: 12, low: 9, close: 10, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'low<=open')).toBeDefined()
    })

    it('low > close → error low<=close', () => {
      const r = validateKline({ open: 10, high: 12, low: 11, close: 9, volume: 100 })
      expect(findIssue(r.issues, 'ohlc', 'low<=close')).toBeDefined()
    })

    it('OHLC 全部相等（PRICE_EPSILON 容差）→ ok', () => {
      const r = validateKline({ open: 10, high: 10, low: 10, close: 10, volume: 100 })
      expect(r.ok).toBe(true)
    })

    // — volume 分支 —
    it('volume = -1 → error nonnegative', () => {
      const r = validateKline({ open: 10, high: 11, low: 9, close: 10, volume: -1 })
      expect(findIssue(r.issues, 'volume', 'nonnegative')).toBeDefined()
    })

    it('volume = NaN → error nonnegative', () => {
      const r = validateKline({ open: 10, high: 11, low: 9, close: 10, volume: NaN })
      expect(findIssue(r.issues, 'volume', 'nonnegative')).toBeDefined()
    })

    // — date 分支 —
    it('date 格式非法 → warn format', () => {
      const r = validateKline({ open: 10, high: 11, low: 9, close: 10, volume: 100, date: '2025/01/01' })
      const issue = findIssue(r.issues, 'date', 'format')
      expect(issue).toBeDefined()
      expect(issue!.severity).toBe('warn')
      expect(r.ok).toBe(true)
    })

    it('date undefined → 不校验', () => {
      const r = validateKline({ open: 10, high: 11, low: 9, close: 10, volume: 100 })
      expect(findIssue(r.issues, 'date', 'format')).toBeUndefined()
    })

    it('date = 2025-1-1 → warn format（非零填充）', () => {
      const r = validateKline({ open: 10, high: 11, low: 9, close: 10, volume: 100, date: '2025-1-1' })
      expect(findIssue(r.issues, 'date', 'format')).toBeDefined()
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 3. validateFinancial — 财务校验
  // ══════════════════════════════════════════════════════════════
  describe('validateFinancial()', () => {
    it('合法财务 → ok=true', () => {
      const f: FinancialLike = {
        report_date: '2025-03-31', revenue: 1e8, net_profit: 1e7,
        gross_margin: 50, net_margin: 10, revenue_yoy: 20, net_profit_yoy: 15,
        rd_ratio: 5, inventory_turnover_days: 60, shareholder_pledge: 10,
      }
      const r = validateFinancial(f)
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    // — 百分比字段 finite 分支 —
    it('gross_margin = NaN → error finite', () => {
      const r = validateFinancial({ gross_margin: NaN })
      expect(findIssue(r.issues, 'gross_margin', 'finite')).toBeDefined()
    })

    it('net_margin = Infinity → error finite', () => {
      const r = validateFinancial({ net_margin: Infinity })
      expect(findIssue(r.issues, 'net_margin', 'finite')).toBeDefined()
    })

    it('revenue_yoy = "abc" → error finite', () => {
      const r = validateFinancial({ revenue_yoy: 'abc' as unknown as number })
      expect(findIssue(r.issues, 'revenue_yoy', 'finite')).toBeDefined()
    })

    it('net_profit_yoy = null → error finite', () => {
      const r = validateFinancial({ net_profit_yoy: null as unknown as number })
      expect(findIssue(r.issues, 'net_profit_yoy', 'finite')).toBeDefined()
    })

    it('rd_ratio = NaN → error finite', () => {
      const r = validateFinancial({ rd_ratio: NaN })
      expect(findIssue(r.issues, 'rd_ratio', 'finite')).toBeDefined()
    })

    it('shareholder_pledge = Infinity → error finite', () => {
      const r = validateFinancial({ shareholder_pledge: Infinity })
      expect(findIssue(r.issues, 'shareholder_pledge', 'finite')).toBeDefined()
    })

    // — 百分比字段 range 分支 —
    it('gross_margin = 250 → error range', () => {
      const r = validateFinancial({ gross_margin: 250 })
      expect(findIssue(r.issues, 'gross_margin', 'range')).toBeDefined()
    })

    it('net_margin = -250 → error range', () => {
      const r = validateFinancial({ net_margin: -250 })
      expect(findIssue(r.issues, 'net_margin', 'range')).toBeDefined()
    })

    it('gross_margin = 200 → 边界不报错', () => {
      const r = validateFinancial({ gross_margin: 200 })
      expect(findIssue(r.issues, 'gross_margin', 'range')).toBeUndefined()
    })

    it('net_margin = -200 → 边界不报错', () => {
      const r = validateFinancial({ net_margin: -200 })
      expect(findIssue(r.issues, 'net_margin', 'range')).toBeUndefined()
    })

    it('revenue_yoy undefined → 不校验', () => {
      const r = validateFinancial({})
      expect(findIssue(r.issues, 'revenue_yoy', 'finite')).toBeUndefined()
      expect(findIssue(r.issues, 'revenue_yoy', 'range')).toBeUndefined()
    })

    // — inventory_turnover_days 分支 —
    it('inventory_turnover_days = NaN → error finite', () => {
      const r = validateFinancial({ inventory_turnover_days: NaN })
      expect(findIssue(r.issues, 'inventory_turnover_days', 'finite')).toBeDefined()
    })

    it('inventory_turnover_days = -10 → error range', () => {
      const r = validateFinancial({ inventory_turnover_days: -10 })
      expect(findIssue(r.issues, 'inventory_turnover_days', 'range')).toBeDefined()
    })

    it('inventory_turnover_days = 2500 → error range', () => {
      const r = validateFinancial({ inventory_turnover_days: 2500 })
      expect(findIssue(r.issues, 'inventory_turnover_days', 'range')).toBeDefined()
    })

    it('inventory_turnover_days = 0 → 边界不报错', () => {
      const r = validateFinancial({ inventory_turnover_days: 0 })
      expect(findIssue(r.issues, 'inventory_turnover_days', 'range')).toBeUndefined()
    })

    it('inventory_turnover_days = 2000 → 边界不报错', () => {
      const r = validateFinancial({ inventory_turnover_days: 2000 })
      expect(findIssue(r.issues, 'inventory_turnover_days', 'range')).toBeUndefined()
    })

    // — revenue 分支 —
    it('revenue = 0 → error positive', () => {
      const r = validateFinancial({ revenue: 0 })
      expect(findIssue(r.issues, 'revenue', 'positive')).toBeDefined()
    })

    it('revenue = -100 → error positive', () => {
      const r = validateFinancial({ revenue: -100 })
      expect(findIssue(r.issues, 'revenue', 'positive')).toBeDefined()
    })

    it('revenue = NaN → error positive', () => {
      const r = validateFinancial({ revenue: NaN })
      expect(findIssue(r.issues, 'revenue', 'positive')).toBeDefined()
    })

    it('revenue undefined → 不校验', () => {
      const r = validateFinancial({})
      expect(findIssue(r.issues, 'revenue', 'positive')).toBeUndefined()
    })

    // — net_profit 分支 —
    it('net_profit = NaN → error finite', () => {
      const r = validateFinancial({ net_profit: NaN })
      expect(findIssue(r.issues, 'net_profit', 'finite')).toBeDefined()
    })

    it('net_profit = Infinity → error finite', () => {
      const r = validateFinancial({ net_profit: Infinity })
      expect(findIssue(r.issues, 'net_profit', 'finite')).toBeDefined()
    })

    it('net_profit = -100 → ok（允许负数）', () => {
      const r = validateFinancial({ net_profit: -100 })
      expect(findIssue(r.issues, 'net_profit', 'finite')).toBeUndefined()
      expect(r.ok).toBe(true)
    })

    it('net_profit undefined → 不校验', () => {
      const r = validateFinancial({})
      expect(findIssue(r.issues, 'net_profit', 'finite')).toBeUndefined()
    })

    // — report_date 分支 —
    it('report_date 格式非法 → error format', () => {
      const r = validateFinancial({ report_date: '2025/03/31' })
      expect(findIssue(r.issues, 'report_date', 'format')).toBeDefined()
    })

    it('report_date 年份 < 1990 → error range', () => {
      const r = validateFinancial({ report_date: '1989-12-31' })
      expect(findIssue(r.issues, 'report_date', 'range')).toBeDefined()
    })

    it('report_date 年份 > 当前年+1 → error range', () => {
      const futureYear = new Date().getFullYear() + 2
      const r = validateFinancial({ report_date: `${futureYear}-01-01` })
      expect(findIssue(r.issues, 'report_date', 'range')).toBeDefined()
    })

    it('report_date 年份 = 1990 → 边界不报错', () => {
      const r = validateFinancial({ report_date: '1990-01-01' })
      expect(findIssue(r.issues, 'report_date', 'range')).toBeUndefined()
    })

    it('report_date 年份 = 当前年+1 → 边界不报错', () => {
      const futureYear = new Date().getFullYear() + 1
      const r = validateFinancial({ report_date: `${futureYear}-12-31` })
      expect(findIssue(r.issues, 'report_date', 'range')).toBeUndefined()
    })

    it('report_date undefined → 不校验', () => {
      const r = validateFinancial({})
      expect(findIssue(r.issues, 'report_date', 'format')).toBeUndefined()
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 4. checkMarketDataContract — 组合校验
  // ══════════════════════════════════════════════════════════════
  describe('checkMarketDataContract()', () => {
    it('空入参 → ok=true, issues=[]', () => {
      const r = checkMarketDataContract({})
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    it('仅 quote → 聚合 validateQuote 结果', () => {
      const r = checkMarketDataContract({ quote: { price: 0 } })
      expect(findIssue(r.issues, 'price', 'positive')).toBeDefined()
      expect(r.ok).toBe(false)
    })

    it('仅 financial → 聚合 validateFinancial 结果', () => {
      const r = checkMarketDataContract({ financial: { revenue: 0 } })
      expect(findIssue(r.issues, 'revenue', 'positive')).toBeDefined()
      expect(r.ok).toBe(false)
    })

    it('仅 klines（单条非法）→ 聚合 validateKline + field 加前缀', () => {
      const r = checkMarketDataContract({
        klines: [{ open: 10, high: 9, low: 11, close: 10, volume: 100 }],
      })
      expect(findIssue(r.issues, 'klines[0].ohlc', 'high>=low')).toBeDefined()
      expect(r.ok).toBe(false)
    })

    it('klines 多条 → 每条独立校验', () => {
      const r = checkMarketDataContract({
        klines: [
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { date: '2025-01-02', open: 10, high: 9, low: 11, close: 10, volume: 100 }, // 非法
        ],
      })
      expect(findIssue(r.issues, 'klines[1].ohlc', 'high>=low')).toBeDefined()
      expect(r.ok).toBe(false)
    })

    it('klines 日期非单调递增 → error monotonic', () => {
      const r = checkMarketDataContract({
        klines: [
          { date: '2025-01-02', open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(findIssue(r.issues, 'klines[1].date', 'monotonic')).toBeDefined()
      expect(r.ok).toBe(false)
    })

    it('klines 日期单调递增（相等也算）→ 不报 monotonic', () => {
      const r = checkMarketDataContract({
        klines: [
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(findIssue(r.issues, 'klines[1].date', 'monotonic')).toBeUndefined()
    })

    it('klines 中 prev.date undefined → 跳过单调校验', () => {
      const r = checkMarketDataContract({
        klines: [
          { open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(findIssue(r.issues, 'klines[1].date', 'monotonic')).toBeUndefined()
    })

    it('klines 中 cur.date undefined → 跳过单调校验', () => {
      const r = checkMarketDataContract({
        klines: [
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(findIssue(r.issues, 'klines[1].date', 'monotonic')).toBeUndefined()
    })

    it('klines 空数组 → 跳过校验', () => {
      const r = checkMarketDataContract({ klines: [] })
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    it('三部分同时存在 → 全部聚合', () => {
      const r = checkMarketDataContract({
        quote: { price: 0 },
        financial: { revenue: 0 },
        klines: [{ open: 10, high: 9, low: 11, close: 10, volume: 100 }],
      })
      expect(r.issues.length).toBeGreaterThanOrEqual(3)
      expect(r.ok).toBe(false)
    })

    it('三部分同时合法 → ok=true', () => {
      const r = checkMarketDataContract({
        quote: { price: 10, open: 9, high: 11, low: 9, close: 10, volume: 100, source: 'tencent' },
        financial: { report_date: '2025-03-31', revenue: 1e8 },
        klines: [
          { date: '2025-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
          { date: '2025-01-02', open: 10, high: 11, low: 9, close: 10, volume: 100 },
        ],
      })
      expect(r.ok).toBe(true)
    })

    it('warn severity 不影响 ok', () => {
      const r = checkMarketDataContract({
        quote: { price: 10, open: 9, high: 11, low: 9, close: 10, source: 'unknownSource' }, // source warn
      })
      expect(r.ok).toBe(true)
    })
  })
})