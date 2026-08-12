/**
 * contractValidation.test.ts
 * 行情数据契约校验单元测试
 *
 * 覆盖：
 * - validateStockQuote: 实时行情校验
 *   - 正常数据通过
 *   - null/undefined → 失败
 *   - 必填字段缺失
 *   - 价格字段正负性
 *   - OHLC 一致性（high≥low, high≥open, high≥price, low≤open, low≤price）
 *   - 成交量/成交额非负
 *   - 涨跌幅范围
 *   - 时间戳合法性
 *   - source 枚举
 * - validateKlineItem: 单根 K 线校验
 *   - 正常数据通过
 *   - 日期格式（YYYY-MM-DD / YYYYMMDD）
 *   - OHLC 有限性与一致性
 *   - 成交量/成交额非负
 * - validateKline: K 线序列校验
 *   - 正常序列通过
 *   - 空数组/非数组
 *   - 单根错误透传
 *   - 日期单调递增
 * - validateFinancial: 财务数据校验
 *   - 正常数据通过
 *   - 报告期格式
 *   - 百分比字段范围
 *   - 存货周转天数范围
 *   - 营收正性
 *   - 净利润有限性
 * - checkMarketDataContract: 聚合入口
 *   - 各 kind 分发正确
 *   - 未知 kind → 失败
 */
import { describe, it, expect } from 'vitest'
import {
  validateStockQuote,
  validateKlineItem,
  validateKline,
  validateFinancial,
  checkMarketDataContract,
} from './contractValidation'
import type { StockQuote, KlineItem } from './directDataAPI'
import type { CollectFinancialData } from './fetcherTypes'

// ============================================================
// 辅助函数：构造基准数据
// ============================================================
function baseQuote(overrides: Partial<StockQuote> = {}): StockQuote {
  return {
    code: '600519',
    name: '贵州茅台',
    price: 1680.5,
    change: 25.3,
    changePercent: 1.53,
    open: 1660.0,
    high: 1690.0,
    low: 1655.0,
    prevClose: 1655.2,
    volume: 2300000,
    amount: 3850000000,
    timestamp: Date.now(),
    source: 'tencent',
    ...overrides,
  }
}

function baseKline(overrides: Partial<KlineItem> = {}): KlineItem {
  return {
    date: '2026-07-22',
    open: 100,
    high: 105,
    low: 98,
    close: 103,
    volume: 1000000,
    amount: 102000000,
    ...overrides,
  }
}

function baseFinancial(overrides: Partial<CollectFinancialData> = {}): CollectFinancialData {
  return {
    report_date: '2026-03-31',
    report_type: 'quarterly',
    revenue: 1000000000,
    revenue_yoy: 12.5,
    net_profit: 250000000,
    net_profit_yoy: 15.3,
    gross_margin: 45.2,
    net_margin: 25.0,
    rd_ratio: 8.5,
    inventory_turnover_days: 60,
    ...overrides,
  }
}

// ============================================================
// validateStockQuote
// ============================================================
describe('contractValidation — validateStockQuote', () => {
  describe('正常数据', () => {
    it('合法行情数据 → ok = true, issues 为空', () => {
      const r = validateStockQuote(baseQuote())
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    it('price = 0.01（极小正数）→ 通过', () => {
      const r = validateStockQuote(baseQuote({ price: 0.01, high: 0.02, low: 0.01, open: 0.01 }))
      expect(r.ok).toBe(true)
    })

    it('changePercent = -10（跌停范围内）→ 通过', () => {
      const r = validateStockQuote(baseQuote({ changePercent: -10 }))
      expect(r.ok).toBe(true)
    })
  })

  describe('空值 / 非法形状', () => {
    it('null → ok = false', () => {
      const r = validateStockQuote(null)
      expect(r.ok).toBe(false)
      expect(r.issues[0]?.rule).toBe('shape')
    })

    it('undefined → ok = false', () => {
      const r = validateStockQuote(undefined)
      expect(r.ok).toBe(false)
    })
  })

  describe('必填字段', () => {
    it('code 缺失 → 报错', () => {
      const r = validateStockQuote(baseQuote({ code: '' as string }))
      expect(r.issues.some((i) => i.field === 'code' && i.rule === 'required')).toBe(true)
    })

    it('name 为空字符串 → 报错', () => {
      const r = validateStockQuote(baseQuote({ name: '   ' }))
      expect(r.issues.some((i) => i.field === 'name' && i.rule === 'required')).toBe(true)
    })
  })

  describe('价格字段正负性', () => {
    it('price = 0 → 报错（必须为正数）', () => {
      const r = validateStockQuote(baseQuote({ price: 0 }))
      expect(r.issues.some((i) => i.field === 'price' && i.rule === 'positive')).toBe(true)
    })

    it('price = -1 → 报错', () => {
      const r = validateStockQuote(baseQuote({ price: -1 }))
      expect(r.issues.some((i) => i.field === 'price' && i.rule === 'positive')).toBe(true)
    })

    it('price = NaN → 报错', () => {
      const r = validateStockQuote(baseQuote({ price: NaN }))
      expect(r.issues.some((i) => i.field === 'price' && i.rule === 'positive')).toBe(true)
    })

    it('open = -1 → 报错（nonnegative）', () => {
      const r = validateStockQuote(baseQuote({ open: -1 }))
      expect(r.issues.some((i) => i.field === 'open' && i.rule === 'nonnegative')).toBe(true)
    })

    it('volume = -1 → 报错', () => {
      const r = validateStockQuote(baseQuote({ volume: -1 }))
      expect(r.issues.some((i) => i.field === 'volume' && i.rule === 'nonnegative')).toBe(true)
    })

    it('amount = -1 → 报错', () => {
      const r = validateStockQuote(baseQuote({ amount: -1 }))
      expect(r.issues.some((i) => i.field === 'amount' && i.rule === 'nonnegative')).toBe(true)
    })
  })

  describe('OHLC 一致性', () => {
    it('high < low → 报错', () => {
      const r = validateStockQuote(baseQuote({ high: 90, low: 100 }))
      expect(r.issues.some((i) => i.rule === 'high>=low')).toBe(true)
    })

    it('high < open → 报错', () => {
      const r = validateStockQuote(baseQuote({ high: 90, open: 100, low: 80 }))
      expect(r.issues.some((i) => i.rule === 'high>=open')).toBe(true)
    })

    it('high < price → 报错', () => {
      const r = validateStockQuote(baseQuote({ high: 90, price: 100, low: 80 }))
      expect(r.issues.some((i) => i.rule === 'high>=price')).toBe(true)
    })

    it('low > open → 报错', () => {
      const r = validateStockQuote(baseQuote({ low: 110, open: 100, high: 120 }))
      expect(r.issues.some((i) => i.rule === 'low<=open')).toBe(true)
    })

    it('low > price → 报错', () => {
      const r = validateStockQuote(baseQuote({ low: 110, price: 100, high: 120 }))
      expect(r.issues.some((i) => i.rule === 'low<=price')).toBe(true)
    })

    it('high = low → 通过（一字板）', () => {
      const r = validateStockQuote(baseQuote({ high: 100, low: 100, open: 100, price: 100 }))
      expect(r.issues.some((i) => i.field === 'ohlc')).toBe(false)
    })
  })

  describe('涨跌幅范围', () => {
    it('changePercent = 200 → 超出范围 → 报错', () => {
      const r = validateStockQuote(baseQuote({ changePercent: 200 }))
      expect(r.issues.some((i) => i.field === 'changePercent' && i.rule === 'range')).toBe(true)
    })

    it('changePercent = -150 → 超出范围 → 报错', () => {
      const r = validateStockQuote(baseQuote({ changePercent: -150 }))
      expect(r.issues.some((i) => i.field === 'changePercent' && i.rule === 'range')).toBe(true)
    })

    it('changePercent = 50 → 正常范围内 → 不报错', () => {
      const r = validateStockQuote(baseQuote({ changePercent: 50 }))
      expect(r.issues.some((i) => i.field === 'changePercent')).toBe(false)
    })
  })

  describe('时间戳', () => {
    it('时间戳为 1980 年 → 太老 → 报错', () => {
      const r = validateStockQuote(baseQuote({ timestamp: new Date('1980-01-01').getTime() }))
      expect(r.issues.some((i) => i.rule === 'too-old')).toBe(true)
    })

    it('时间戳为 1 天后 → 来自未来 → 报错', () => {
      const r = validateStockQuote(baseQuote({ timestamp: Date.now() + 24 * 3600 * 1000 }))
      expect(r.issues.some((i) => i.rule === 'future')).toBe(true)
    })

    it('时间戳为 NaN → 报错', () => {
      const r = validateStockQuote(baseQuote({ timestamp: NaN }))
      expect(r.issues.some((i) => i.field === 'timestamp' && i.rule === 'finite')).toBe(true)
    })
  })

  describe('source 枚举', () => {
    it('source = "tencent" → 通过', () => {
      const r = validateStockQuote(baseQuote({ source: 'tencent' }))
      expect(r.issues.some((i) => i.field === 'source')).toBe(false)
    })

    it('source = "mock" → 通过', () => {
      const r = validateStockQuote(baseQuote({ source: 'mock' as StockQuote['source'] }))
      expect(r.issues.some((i) => i.field === 'source')).toBe(false)
    })

    it('source = "invalid" → 报错', () => {
      const r = validateStockQuote(baseQuote({ source: 'invalid' as StockQuote['source'] }))
      expect(r.issues.some((i) => i.field === 'source' && i.rule === 'enum')).toBe(true)
    })
  })
})

// ============================================================
// validateKlineItem
// ============================================================
describe('contractValidation — validateKlineItem', () => {
  describe('正常数据', () => {
    it('合法 K 线 → ok = true', () => {
      const r = validateKlineItem(baseKline())
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    it('日期格式 YYYYMMDD → 通过', () => {
      const r = validateKlineItem(baseKline({ date: '20260722' }))
      expect(r.ok).toBe(true)
    })
  })

  describe('空值 / 非法形状', () => {
    it('null → ok = false', () => {
      const r = validateKlineItem(null)
      expect(r.ok).toBe(false)
    })

    it('undefined → ok = false', () => {
      const r = validateKlineItem(undefined)
      expect(r.ok).toBe(false)
    })
  })

  describe('日期格式', () => {
    it('日期为空 → 报错', () => {
      const r = validateKlineItem(baseKline({ date: '' }))
      expect(r.issues.some((i) => i.field === 'date' && i.rule === 'format')).toBe(true)
    })

    it('日期格式错误 → 报错', () => {
      const r = validateKlineItem(baseKline({ date: '2026/07/22' }))
      expect(r.issues.some((i) => i.field === 'date' && i.rule === 'format')).toBe(true)
    })

    it('日期为数字类型 → 报错', () => {
      const r = validateKlineItem(baseKline({ date: 20260722 as unknown as string }))
      expect(r.issues.some((i) => i.field === 'date' && i.rule === 'format')).toBe(true)
    })
  })

  describe('OHLC 有限性与一致性', () => {
    it('close = NaN → 报错（finite）', () => {
      const r = validateKlineItem(baseKline({ close: NaN }))
      expect(r.issues.some((i) => i.field === 'ohlc' && i.rule === 'finite')).toBe(true)
    })

    it('high < low → 报错', () => {
      const r = validateKlineItem(baseKline({ high: 90, low: 100 }))
      expect(r.issues.some((i) => i.rule === 'high>=low')).toBe(true)
    })

    it('high < close → 报错', () => {
      const r = validateKlineItem(baseKline({ high: 90, close: 100, low: 80 }))
      expect(r.issues.some((i) => i.rule === 'high>=close')).toBe(true)
    })

    it('low > open → 报错', () => {
      const r = validateKlineItem(baseKline({ low: 110, open: 100, high: 120 }))
      expect(r.issues.some((i) => i.rule === 'low<=open')).toBe(true)
    })

    it('low > close → 报错', () => {
      const r = validateKlineItem(baseKline({ low: 110, close: 100, high: 120 }))
      expect(r.issues.some((i) => i.rule === 'low<=close')).toBe(true)
    })
  })

  describe('成交量/成交额', () => {
    it('volume = -1 → 报错', () => {
      const r = validateKlineItem(baseKline({ volume: -1 }))
      expect(r.issues.some((i) => i.field === 'volume' && i.rule === 'nonnegative')).toBe(true)
    })

    it('amount = -1 → 报错', () => {
      const r = validateKlineItem(baseKline({ amount: -1 }))
      expect(r.issues.some((i) => i.field === 'amount' && i.rule === 'nonnegative')).toBe(true)
    })
  })
})

// ============================================================
// validateKline
// ============================================================
describe('contractValidation — validateKline', () => {
  describe('正常序列', () => {
    it('合法 K 线序列 → ok = true', () => {
      const items = [
        baseKline({ date: '2026-07-20' }),
        baseKline({ date: '2026-07-21' }),
        baseKline({ date: '2026-07-22' }),
      ]
      const r = validateKline(items)
      expect(r.ok).toBe(true)
    })

    it('单根 K 线 → 通过', () => {
      const r = validateKline([baseKline()])
      expect(r.ok).toBe(true)
    })
  })

  describe('空值 / 非数组', () => {
    it('null → ok = false', () => {
      const r = validateKline(null)
      expect(r.ok).toBe(false)
    })

    it('undefined → ok = false', () => {
      const r = validateKline(undefined)
      expect(r.ok).toBe(false)
    })

    it('空数组 → ok = false', () => {
      const r = validateKline([])
      expect(r.ok).toBe(false)
      expect(r.issues[0]?.rule).toBe('empty')
    })
  })

  describe('单根错误透传', () => {
    it('中间一根 high<low → 报错且带索引', () => {
      const items = [
        baseKline({ date: '2026-07-20' }),
        baseKline({ date: '2026-07-21', high: 90, low: 100 }),
        baseKline({ date: '2026-07-22' }),
      ]
      const r = validateKline(items)
      expect(r.ok).toBe(false)
      expect(r.issues.some((i) => i.field.includes('kline[1]'))).toBe(true)
    })
  })

  describe('日期单调递增', () => {
    it('日期递减 → 报错（monotonic）', () => {
      const items = [
        baseKline({ date: '2026-07-22' }),
        baseKline({ date: '2026-07-21' }),
        baseKline({ date: '2026-07-20' }),
      ]
      const r = validateKline(items)
      expect(r.issues.some((i) => i.rule === 'monotonic')).toBe(true)
    })

    it('日期相等 → 不报错（非递减）', () => {
      const items = [
        baseKline({ date: '2026-07-22' }),
        baseKline({ date: '2026-07-22' }),
      ]
      const r = validateKline(items)
      expect(r.issues.some((i) => i.rule === 'monotonic')).toBe(false)
    })

    it('YYYYMMDD 格式递减 → 也能检测', () => {
      const items = [
        baseKline({ date: '20260722' }),
        baseKline({ date: '20260721' }),
      ]
      const r = validateKline(items)
      expect(r.issues.some((i) => i.rule === 'monotonic')).toBe(true)
    })
  })
})

// ============================================================
// validateFinancial
// ============================================================
describe('contractValidation — validateFinancial', () => {
  describe('正常数据', () => {
    it('合法财务数据 → ok = true', () => {
      const r = validateFinancial(baseFinancial())
      expect(r.ok).toBe(true)
      expect(r.issues).toHaveLength(0)
    })

    it('部分可选字段缺失 → 通过', () => {
      const r = validateFinancial({ report_date: '2026-03-31' })
      expect(r.ok).toBe(true)
    })
  })

  describe('空值 / 非法形状', () => {
    it('null → ok = false', () => {
      const r = validateFinancial(null)
      expect(r.ok).toBe(false)
    })

    it('undefined → ok = false', () => {
      const r = validateFinancial(undefined)
      expect(r.ok).toBe(false)
    })
  })

  describe('报告期格式', () => {
    it('report_date 缺失 → 报错', () => {
      const r = validateFinancial({})
      expect(r.issues.some((i) => i.field === 'report_date' && i.rule === 'format')).toBe(true)
    })

    it('report_date 格式错误 → 报错', () => {
      const r = validateFinancial({ report_date: '2026/03/31' })
      expect(r.issues.some((i) => i.field === 'report_date' && i.rule === 'format')).toBe(true)
    })
  })

  describe('百分比字段范围', () => {
    it('gross_margin = 300 → 超出范围 → 报错', () => {
      const r = validateFinancial(baseFinancial({ gross_margin: 300 }))
      expect(r.issues.some((i) => i.field === 'gross_margin' && i.rule === 'range')).toBe(true)
    })

    it('gross_margin = -300 → 超出范围 → 报错', () => {
      const r = validateFinancial(baseFinancial({ gross_margin: -300 }))
      expect(r.issues.some((i) => i.field === 'gross_margin' && i.rule === 'range')).toBe(true)
    })

    it('net_margin = NaN → 报错（finite）', () => {
      const r = validateFinancial(baseFinancial({ net_margin: NaN }))
      expect(r.issues.some((i) => i.field === 'net_margin' && i.rule === 'finite')).toBe(true)
    })

    it('rd_ratio = 100 → 正常范围内 → 通过', () => {
      const r = validateFinancial(baseFinancial({ rd_ratio: 100 }))
      expect(r.issues.some((i) => i.field === 'rd_ratio')).toBe(false)
    })
  })

  describe('存货周转天数', () => {
    it('inventory_turnover_days = -1 → 报错', () => {
      const r = validateFinancial(baseFinancial({ inventory_turnover_days: -1 }))
      expect(r.issues.some((i) => i.field === 'inventory_turnover_days' && i.rule === 'range')).toBe(true)
    })

    it('inventory_turnover_days = 5000 → 超出上限 → 报错', () => {
      const r = validateFinancial(baseFinancial({ inventory_turnover_days: 5000 }))
      expect(r.issues.some((i) => i.field === 'inventory_turnover_days' && i.rule === 'range')).toBe(true)
    })

    it('inventory_turnover_days = 100 → 正常 → 通过', () => {
      const r = validateFinancial(baseFinancial({ inventory_turnover_days: 100 }))
      expect(r.issues.some((i) => i.field === 'inventory_turnover_days')).toBe(false)
    })
  })

  describe('营收 / 净利润', () => {
    it('revenue = 0 → 报错（必须为正数）', () => {
      const r = validateFinancial(baseFinancial({ revenue: 0 }))
      expect(r.issues.some((i) => i.field === 'revenue' && i.rule === 'positive')).toBe(true)
    })

    it('revenue = -100 → 报错', () => {
      const r = validateFinancial(baseFinancial({ revenue: -100 }))
      expect(r.issues.some((i) => i.field === 'revenue' && i.rule === 'positive')).toBe(true)
    })

    it('net_profit = NaN → 报错', () => {
      const r = validateFinancial(baseFinancial({ net_profit: NaN }))
      expect(r.issues.some((i) => i.field === 'net_profit' && i.rule === 'finite')).toBe(true)
    })

    it('net_profit = -1000000 → 负数净利润（亏损）→ 通过（有限即可）', () => {
      const r = validateFinancial(baseFinancial({ net_profit: -1000000 }))
      expect(r.issues.some((i) => i.field === 'net_profit')).toBe(false)
    })
  })
})

// ============================================================
// checkMarketDataContract
// ============================================================
describe('contractValidation — checkMarketDataContract', () => {
  it('kind = quote → 分发到 validateStockQuote', () => {
    const r = checkMarketDataContract({ kind: 'quote', data: baseQuote() })
    expect(r.ok).toBe(true)
  })

  it('kind = kline → 分发到 validateKline', () => {
    const r = checkMarketDataContract({ kind: 'kline', data: [baseKline()] })
    expect(r.ok).toBe(true)
  })

  it('kind = financial → 分发到 validateFinancial', () => {
    const r = checkMarketDataContract({ kind: 'financial', data: baseFinancial() })
    expect(r.ok).toBe(true)
  })

  it('未知 kind → 报错', () => {
    const r = checkMarketDataContract({ kind: 'unknown' as 'quote', data: null })
    expect(r.ok).toBe(false)
    expect(r.issues[0]?.rule).toBe('unknown')
  })
})
