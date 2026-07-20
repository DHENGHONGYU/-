import { describe, it, expect } from 'vitest'
import {
  toSafeNumber,
  toSafeNumberInRange,
  toSafeOptionalNumber,
  toSafeEnum,
  toSafeBoolean,
  toSafeArray,
  toSafeString,
  getSafeString,
  getSafeNumber,
  getSafeArray,
  fallback,
} from './safeCoerce'

describe('toSafeNumber()', () => {
  it('数字原值返回', () => {
    expect(toSafeNumber(42)).toBe(42)
    expect(toSafeNumber(0)).toBe(0)
    expect(toSafeNumber(-1.5)).toBe(-1.5)
  })

  it('数字字符串解析', () => {
    expect(toSafeNumber('42')).toBe(42)
    expect(toSafeNumber('3.14')).toBe(3.14)
    expect(toSafeNumber('-10')).toBe(-10)
  })

  it('null/undefined/空串返回默认值', () => {
    expect(toSafeNumber(null)).toBe(0)
    expect(toSafeNumber(undefined)).toBe(0)
    expect(toSafeNumber('')).toBe(0)
  })

  it('NaN/Infinity 返回默认值', () => {
    expect(toSafeNumber(NaN)).toBe(0)
    expect(toSafeNumber(Infinity)).toBe(0)
    expect(toSafeNumber(-Infinity)).toBe(0)
  })

  it('非数字字符串返回默认值', () => {
    expect(toSafeNumber('abc')).toBe(0)
  })

  it('支持自定义默认值', () => {
    expect(toSafeNumber(null, 50)).toBe(50)
    expect(toSafeNumber('abc', -1)).toBe(-1)
  })
})

describe('toSafeNumberInRange()', () => {
  it('范围内的值正常返回', () => {
    expect(toSafeNumberInRange(50, 0, 100, 0)).toBe(50)
    expect(toSafeNumberInRange(0, 0, 100, -1)).toBe(0)
    expect(toSafeNumberInRange(100, 0, 100, -1)).toBe(100)
  })

  it('越界返回默认值', () => {
    expect(toSafeNumberInRange(-1, 0, 100, 0)).toBe(0)
    expect(toSafeNumberInRange(101, 0, 100, 0)).toBe(0)
  })

  it('非数字返回默认值', () => {
    expect(toSafeNumberInRange('abc', 0, 100, 0)).toBe(0)
    expect(toSafeNumberInRange(null, 0, 100, 0)).toBe(0)
    expect(toSafeNumberInRange(Infinity, 0, 100, 0)).toBe(0)
  })

  it('字符串数字可解析且在范围内返回', () => {
    expect(toSafeNumberInRange('50', 0, 100, 0)).toBe(50)
  })
})

describe('toSafeOptionalNumber()', () => {
  it('数字原值返回', () => {
    expect(toSafeOptionalNumber(42)).toBe(42)
  })

  it('数字字符串解析返回', () => {
    expect(toSafeOptionalNumber('3.14')).toBe(3.14)
  })

  it('null/undefined/空串返回 undefined', () => {
    expect(toSafeOptionalNumber(null)).toBeUndefined()
    expect(toSafeOptionalNumber(undefined)).toBeUndefined()
    expect(toSafeOptionalNumber('')).toBeUndefined()
  })

  it('NaN/Infinity/非法字符串返回 undefined', () => {
    expect(toSafeOptionalNumber(NaN)).toBeUndefined()
    expect(toSafeOptionalNumber(Infinity)).toBeUndefined()
    expect(toSafeOptionalNumber('abc')).toBeUndefined()
  })
})

describe('toSafeEnum()', () => {
  const allowed = ['bullish', 'bearish', 'neutral'] as const

  it('合法枚举值返回', () => {
    expect(toSafeEnum('bullish', allowed, 'neutral')).toBe('bullish')
  })

  it('非法值返回默认值', () => {
    expect(toSafeEnum('invalid', allowed, 'neutral')).toBe('neutral')
  })

  it('null/undefined 返回默认值', () => {
    expect(toSafeEnum(null, allowed, 'neutral')).toBe('neutral')
    expect(toSafeEnum(undefined, allowed, 'neutral')).toBe('neutral')
  })

  it('大小写敏感', () => {
    expect(toSafeEnum('Bullish', allowed, 'neutral')).toBe('neutral')
  })
})

describe('toSafeBoolean()', () => {
  it('布尔原值返回', () => {
    expect(toSafeBoolean(true)).toBe(true)
    expect(toSafeBoolean(false)).toBe(false)
  })

  it('数字 1/0 转为 true/false', () => {
    expect(toSafeBoolean(1)).toBe(true)
    expect(toSafeBoolean(0)).toBe(false)
  })

  it('字符串 true/false 转为布尔', () => {
    expect(toSafeBoolean('true')).toBe(true)
    expect(toSafeBoolean('false')).toBe(false)
  })

  it('其他值返回默认值', () => {
    expect(toSafeBoolean('yes')).toBe(false)
    expect(toSafeBoolean(null)).toBe(false)
    expect(toSafeBoolean(undefined)).toBe(false)
  })

  it('支持自定义默认值', () => {
    expect(toSafeBoolean(null, true)).toBe(true)
    expect(toSafeBoolean('invalid', true)).toBe(true)
  })
})

describe('toSafeArray()', () => {
  it('数组原值返回', () => {
    const arr = [1, 2, 3]
    expect(toSafeArray(arr)).toBe(arr)
    expect(toSafeArray(arr)).toEqual([1, 2, 3])
  })

  it('非数组返回空数组', () => {
    expect(toSafeArray(null)).toEqual([])
    expect(toSafeArray(undefined)).toEqual([])
    expect(toSafeArray('abc')).toEqual([])
    expect(toSafeArray(42)).toEqual([])
    expect(toSafeArray({})).toEqual([])
  })
})

describe('toSafeString()', () => {
  it('字符串原值返回', () => {
    expect(toSafeString('hello')).toBe('hello')
  })

  it('数字转为字符串', () => {
    expect(toSafeString(42)).toBe('42')
  })

  it('布尔转为字符串', () => {
    expect(toSafeString(true)).toBe('true')
  })

  it('null/undefined 返回默认值', () => {
    expect(toSafeString(null)).toBe('')
    expect(toSafeString(undefined)).toBe('')
    expect(toSafeString(null, 'unknown')).toBe('unknown')
  })

  it('默认值为空串', () => {
    expect(toSafeString(null)).toBe('')
  })
})

describe('别名函数', () => {
  it('getSafeString === toSafeString', () => {
    expect(getSafeString).toBe(toSafeString)
  })

  it('getSafeNumber === toSafeNumber', () => {
    expect(getSafeNumber).toBe(toSafeNumber)
  })

  it('getSafeArray === toSafeArray', () => {
    expect(getSafeArray).toBe(toSafeArray)
  })
})

describe('fallback 常量', () => {
  it('定义正确的回退文案', () => {
    expect(fallback.loading).toBe('加载中…')
    expect(fallback.empty).toBe('暂无数据')
    expect(fallback.error).toBe('请求异常，请稍后重试')
    expect(fallback.unknown).toBe('未知')
    expect(fallback.noContent).toBe('无内容摘要')
  })
})
