import { describe, it, expect } from 'vitest'
import { safeFormatNumber, safeFormatPercent, safeFormatCurrency, DEFAULT_FALLBACK } from './index'

describe('safeFormatNumber', () => {
  // ─── null / undefined / NaN / Infinity 守卫 ───────────────────────────
  it('null → fallback', () => {
    expect(safeFormatNumber(null, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('undefined → fallback', () => {
    expect(safeFormatNumber(undefined, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('NaN → fallback', () => {
    expect(safeFormatNumber(NaN, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('Infinity → fallback', () => {
    expect(safeFormatNumber(Infinity, 2)).toBe(DEFAULT_FALLBACK)
    expect(safeFormatNumber(-Infinity, 2)).toBe(DEFAULT_FALLBACK)
  })

  // ─── 正常数值格式化 ────────────────────────────────────────────────────
  it('正数', () => {
    expect(safeFormatNumber(3.14159, 2)).toBe('3.14')
    expect(safeFormatNumber(3.14159, 4)).toBe('3.1416')
  })
  it('零', () => {
    expect(safeFormatNumber(0, 2)).toBe('0.00')
  })
  it('负数', () => {
    expect(safeFormatNumber(-3.14, 2)).toBe('-3.14')
  })
  it('decimals=0', () => {
    expect(safeFormatNumber(3.99, 0)).toBe('4')
    expect(safeFormatNumber(3.14, 0)).toBe('3')
  })

  // ─── 自定义 fallback ──────────────────────────────────────────────────
  it('自定义 fallback', () => {
    expect(safeFormatNumber(null, 2, 'N/A')).toBe('N/A')
    expect(safeFormatNumber(undefined, 2, '0.00')).toBe('0.00')
  })

  // ─── decimals 参数钳制 ─────────────────────────────────────────────────
  it('decimals 为负数 → 钳制为 0', () => {
    expect(safeFormatNumber(3.14, -1)).toBe('3')
    expect(safeFormatNumber(3.99, -100)).toBe('4')
  })
  it('decimals 超大 → 钳制为 20', () => {
    expect(safeFormatNumber(3.14, 100)).toBe(safeFormatNumber(3.14, 20))
  })
  it('decimals 为 NaN → 钳制为 0', () => {
    expect(safeFormatNumber(3.99, NaN)).toBe('4')
  })
  it('decimals 为小数 → 截断为整数', () => {
    expect(safeFormatNumber(3.14159, 2.9)).toBe('3.14')
    expect(safeFormatNumber(3.14159, 2.1)).toBe('3.14')
  })
  it('decimals 为 Infinity → 钳制为 20', () => {
    expect(safeFormatNumber(3.14, Infinity)).toBe(safeFormatNumber(3.14, 20))
  })
})

describe('safeFormatPercent', () => {
  it('正数添加 + 前缀', () => {
    expect(safeFormatPercent(1.5, 2)).toBe('+1.50%')
    expect(safeFormatPercent(0.5, 1)).toBe('+0.5%')
  })
  it('负数不加前缀', () => {
    expect(safeFormatPercent(-1.5, 2)).toBe('-1.50%')
  })
  it('零不加前缀', () => {
    expect(safeFormatPercent(0, 2)).toBe('0.00%')
  })
  it('null → fallback', () => {
    expect(safeFormatPercent(null, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('undefined → fallback', () => {
    expect(safeFormatPercent(undefined, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('NaN → fallback', () => {
    expect(safeFormatPercent(NaN, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('Infinity → fallback', () => {
    expect(safeFormatPercent(Infinity, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('默认 decimals=2', () => {
    expect(safeFormatPercent(1.5)).toBe('+1.50%')
    expect(safeFormatPercent(null)).toBe(DEFAULT_FALLBACK)
  })
  it('decimals 为负数 → 钳制为 0', () => {
    expect(safeFormatPercent(3.14, -1)).toBe('+3%')
  })
  it('decimals 为 NaN → 钳制为 0', () => {
    expect(safeFormatPercent(3.99, NaN)).toBe('+4%')
  })
  it('decimals 超大 → 钳制为 20', () => {
    expect(safeFormatPercent(3.14, 100)).toBe(safeFormatPercent(3.14, 20))
  })
})

describe('safeFormatCurrency', () => {
  it('正常数值带千分位', () => {
    expect(safeFormatCurrency(1234567.89, 2)).toBe('1,234,567.89')
  })
  it('null → fallback', () => {
    expect(safeFormatCurrency(null, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('undefined → fallback', () => {
    expect(safeFormatCurrency(undefined, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('NaN → fallback', () => {
    expect(safeFormatCurrency(NaN, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('Infinity → fallback', () => {
    expect(safeFormatCurrency(Infinity, 2)).toBe(DEFAULT_FALLBACK)
  })
  it('默认 decimals=2', () => {
    expect(safeFormatCurrency(1000)).toBe('1,000.00')
  })
  it('decimals=0', () => {
    expect(safeFormatCurrency(1234.56, 0)).toBe('1,235')
  })
  it('自定义 fallback', () => {
    expect(safeFormatCurrency(null, 2, '$0.00')).toBe('$0.00')
  })
})
