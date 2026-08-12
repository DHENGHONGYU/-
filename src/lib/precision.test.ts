import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatChangeRate,
  formatChange,
  formatVolume,
  formatAmount,
  formatPercent,
  formatLargeNumber,
  getChangeColor,
  formatMarketCap,
  formatShares,
  safeArrayGet,
  safeFirst,
  safeLast,
  safeGet,
  PRECISION,
} from './precision'

describe('金融数值格式化', () => {
  describe('formatPrice()', () => {
    it('正常数值应返回指定小数位', () => {
      expect(formatPrice(100.123)).toBe('100.12')
    })

    it('undefined/null/NaN 返回 --', () => {
      expect(formatPrice(undefined)).toBe('--')
      expect(formatPrice(null)).toBe('--')
      expect(formatPrice(NaN)).toBe('--')
    })

    it('支持自定义小数位', () => {
      expect(formatPrice(100.123, 3)).toBe('100.123')
      expect(formatPrice(100.123, 0)).toBe('100')
    })

    it('整数应补零', () => {
      expect(formatPrice(100)).toBe('100.00')
    })
  })

  describe('formatChangeRate()', () => {
    it('正值带+号和%', () => {
      expect(formatChangeRate(5.23)).toBe('+5.23%')
    })

    it('负值带-号和%', () => {
      expect(formatChangeRate(-3.14)).toBe('-3.14%')
    })

    it('0值带+号', () => {
      expect(formatChangeRate(0)).toBe('+0.00%')
    })

    it('无效值返回 --', () => {
      expect(formatChangeRate(null)).toBe('--')
      expect(formatChangeRate(undefined)).toBe('--')
      expect(formatChangeRate(NaN)).toBe('--')
    })
  })

  describe('formatChange()', () => {
    it('正值带+号', () => {
      expect(formatChange(2.5)).toBe('+2.50')
    })

    it('负值带-号', () => {
      expect(formatChange(-1.5)).toBe('-1.50')
    })

    it('0值带+号', () => {
      expect(formatChange(0)).toBe('+0.00')
    })

    it('无效值返回 --', () => {
      expect(formatChange(null)).toBe('--')
    })
  })

  describe('formatVolume()', () => {
    it('小于1亿自动用万单位', () => {
      expect(formatVolume(50000)).toBe('5万')
    })

    it('大于等于1亿用亿单位', () => {
      expect(formatVolume(150000000)).toBe('1.50亿')
    })

    it('支持强制 wan 单位', () => {
      expect(formatVolume(200000000, 'wan')).toBe('20000万')
    })

    it('支持强制 yi 单位', () => {
      expect(formatVolume(5000, 'yi')).toBe('0.00亿')
    })

    it('无效值返回 --', () => {
      expect(formatVolume(null)).toBe('--')
    })
  })

  describe('formatAmount()', () => {
    it('小于1亿用万单位', () => {
      expect(formatAmount(50000)).toBe('5.00万')
    })

    it('大于等于1亿用亿单位', () => {
      expect(formatAmount(200000000)).toBe('2.00亿')
    })

    it('无效值返回 --', () => {
      expect(formatAmount(undefined)).toBe('--')
    })
  })

  describe('formatPercent()', () => {
    it('小于1的值乘以100', () => {
      expect(formatPercent(0.5)).toBe('50.0%')
    })

    it('大于1的值直接使用', () => {
      expect(formatPercent(50)).toBe('50.0%')
    })

    it('支持自定义小数位', () => {
      expect(formatPercent(0.1234, 2)).toBe('12.34%')
    })

    it('无效值返回 --', () => {
      expect(formatPercent(null)).toBe('--')
    })
  })

  describe('formatLargeNumber()', () => {
    it('>=1亿转亿单位', () => {
      expect(formatLargeNumber(123400000)).toBe('1.23亿')
    })

    it('>=1万且<1亿转万单位', () => {
      expect(formatLargeNumber(12345)).toBe('1.23万')
    })

    it('<1万保留2位小数', () => {
      expect(formatLargeNumber(123.456)).toBe('123.46')
    })

    it('支持负数', () => {
      expect(formatLargeNumber(-12345)).toBe('-1.23万')
    })

    it('无效值返回 --', () => {
      expect(formatLargeNumber(null)).toBe('--')
    })
  })

  describe('getChangeColor()', () => {
    it('正值返回 up', () => {
      expect(getChangeColor(1)).toBe('up')
      expect(getChangeColor(0.01)).toBe('up')
    })

    it('负值返回 down', () => {
      expect(getChangeColor(-1)).toBe('down')
      expect(getChangeColor(-0.01)).toBe('down')
    })

    it('0返回 neutral', () => {
      expect(getChangeColor(0)).toBe('neutral')
    })
  })

  describe('formatMarketCap()', () => {
    it('调用 formatLargeNumber', () => {
      expect(formatMarketCap(100000000)).toBe('1.00亿')
    })

    it('无效值返回 --', () => {
      expect(formatMarketCap(null)).toBe('--')
    })
  })

  describe('formatShares()', () => {
    it('格式化成交量', () => {
      expect(formatShares(10000)).toBe('1.00万')
    })

    it('无效值返回 --', () => {
      expect(formatShares(undefined)).toBe('--')
    })
  })
})

describe('安全数组访问', () => {
  describe('safeArrayGet()', () => {
    it('正常索引返回元素', () => {
      expect(safeArrayGet([1, 2, 3], 1)).toBe(2)
    })

    it('越界返回 undefined（无fallback）', () => {
      expect(safeArrayGet([1, 2, 3], 10)).toBeUndefined()
    })

    it('越界返回 fallback', () => {
      expect(safeArrayGet([1, 2, 3], 10, 0)).toBe(0)
    })

    it('负索引返回 undefined', () => {
      expect(safeArrayGet([1, 2, 3], -1)).toBeUndefined()
    })
  })

  describe('safeFirst()', () => {
    it('非空数组返回第一个元素', () => {
      expect(safeFirst([1, 2, 3])).toBe(1)
    })

    it('空数组返回 undefined', () => {
      expect(safeFirst([])).toBeUndefined()
    })
  })

  describe('safeLast()', () => {
    it('非空数组返回最后一个元素', () => {
      expect(safeLast([1, 2, 3])).toBe(3)
    })

    it('空数组返回 undefined', () => {
      expect(safeLast([])).toBeUndefined()
    })
  })
})

describe('safeGet()', () => {
  const obj = { a: { b: { c: 42 } } }

  it('正常路径返回值', () => {
    expect(safeGet(obj, 'a.b.c', 0)).toBe(42)
  })

  it('路径不存在返回 fallback', () => {
    expect(safeGet(obj, 'a.x.c', 0)).toBe(0)
  })

  it('null/undefined 对象返回 fallback', () => {
    expect(safeGet(null, 'a.b', 0)).toBe(0)
    expect(safeGet(undefined, 'a.b', 0)).toBe(0)
  })

  it('单级路径正常工作', () => {
    expect(safeGet({ x: 1 }, 'x', 0)).toBe(1)
  })

  it('值为null时返回 fallback', () => {
    expect(safeGet({ a: null }, 'a', 'default')).toBe('default')
  })
})

describe('PRECISION 常量', () => {
  it('定义正确的精度常量', () => {
    expect(PRECISION.PRICE).toBe(2)
    expect(PRECISION.CHANGE).toBe(2)
    expect(PRECISION.CHANGE_RATE).toBe(2)
    expect(PRECISION.PERCENT).toBe(1)
    expect(PRECISION.VOLUME).toBe(0)
    expect(PRECISION.AMOUNT).toBe(2)
  })
})
