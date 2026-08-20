/**
 * lib/safeCoerce — 单元测试
 * 只增不删策略（TD-022 覆盖率增量 Round 3+）。
 *
 * 覆盖目标：
 *  - toSafeNumber / toSafeNumberInRange / toSafeOptionalNumber
 *  - toSafeEnum / toSafeBoolean / toSafeArray / toSafeString
 *  - fallback 常量 + 3 个别名 (getSafeString / getSafeNumber / getSafeArray)
 */
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

describe('lib/safeCoerce', () => {
  describe('toSafeNumber(value, default=0)', () => {
    it('合法 number → 原值', () => {
      expect(toSafeNumber(42)).toBe(42)
      expect(toSafeNumber(0)).toBe(0)
      expect(toSafeNumber(-3.14)).toBe(-3.14)
    })
    it('合法 number string → Number() 解析', () => {
      expect(toSafeNumber('4.5')).toBe(4.5)
      expect(toSafeNumber('0')).toBe(0)
    })
    it('value = null → defaultValue', () => {
      expect(toSafeNumber(null)).toBe(0)
      expect(toSafeNumber(null, 50)).toBe(50)
    })
    it('value = undefined → defaultValue', () => {
      expect(toSafeNumber(undefined, 9)).toBe(9)
    })
    it('value = "" → defaultValue', () => {
      expect(toSafeNumber('', 7)).toBe(7)
    })
    it('value = NaN → defaultValue（Number.isFinite 假）', () => {
      expect(toSafeNumber(NaN)).toBe(0)
    })
    it('value = Infinity / -Infinity → defaultValue', () => {
      expect(toSafeNumber(Infinity)).toBe(0)
      expect(toSafeNumber(-Infinity, -1)).toBe(-1)
    })
    it('非法字符串 "abc" → NaN → defaultValue', () => {
      expect(toSafeNumber('abc')).toBe(0)
    })
  })

  describe('toSafeNumberInRange(value, min, max, defaultValue)', () => {
    it('合法且在范围内 → 原值', () => {
      expect(toSafeNumberInRange(50, 0, 100, 0)).toBe(50)
    })
    it('边界 min 命中 → 不越界', () => {
      expect(toSafeNumberInRange(0, 0, 100, -1)).toBe(0)
    })
    it('边界 max 命中 → 不越界', () => {
      expect(toSafeNumberInRange(100, 0, 100, -1)).toBe(100)
    })
    it('低于 min → defaultValue', () => {
      expect(toSafeNumberInRange(-1, 0, 100, 0)).toBe(0)
    })
    it('高于 max → defaultValue', () => {
      expect(toSafeNumberInRange(150, 0, 100, 0)).toBe(0)
    })
    it('非法 NaN → defaultValue（走 toSafeNumber → NaN，isFinite 假）', () => {
      expect(toSafeNumberInRange('abc', 0, 100, -1)).toBe(-1)
    })
    it('Infinity → defaultValue', () => {
      expect(toSafeNumberInRange(Infinity, 0, 100, 5)).toBe(5)
    })
    it('null → defaultValue', () => {
      expect(toSafeNumberInRange(null, 0, 100, 7)).toBe(7)
    })
    it('字符串数字且在范围 → 解析成功', () => {
      expect(toSafeNumberInRange('50', 0, 100, 0)).toBe(50)
    })
  })

  describe('toSafeOptionalNumber(value) → number | undefined', () => {
    it('合法 number → 原值', () => {
      expect(toSafeOptionalNumber(42)).toBe(42)
      expect(toSafeOptionalNumber('4.5')).toBe(4.5)
    })
    it('null / undefined / "" → undefined（而非 0）', () => {
      expect(toSafeOptionalNumber(null)).toBeUndefined()
      expect(toSafeOptionalNumber(undefined)).toBeUndefined()
      expect(toSafeOptionalNumber('')).toBeUndefined()
    })
    it('NaN / Infinity / 非法串 → undefined', () => {
      expect(toSafeOptionalNumber(NaN)).toBeUndefined()
      expect(toSafeOptionalNumber(Infinity)).toBeUndefined()
      expect(toSafeOptionalNumber('停牌')).toBeUndefined()
    })
  })

  describe('toSafeEnum<T>(value, allowed, default)', () => {
    const ALL = ['bullish', 'bearish', 'neutral'] as const
    type V = typeof ALL[number]
    it('命中 → 原值', () => {
      expect(toSafeEnum<V>('bullish', ALL, 'neutral')).toBe('bullish')
    })
    it('大小写不匹配 → defaultValue（大小写敏感）', () => {
      expect(toSafeEnum<V>('Bullish', ALL, 'neutral')).toBe('neutral')
    })
    it('非法字符串 → defaultValue', () => {
      expect(toSafeEnum<V>('invalid', ALL, 'neutral')).toBe('neutral')
    })
    it('value 非字符串（number/null）→ defaultValue', () => {
      expect(toSafeEnum<V>(null, ALL, 'neutral')).toBe('neutral')
      expect(toSafeEnum<V>(1 as unknown as string, ALL, 'neutral')).toBe('neutral')
    })
  })

  describe('toSafeBoolean(value, default=false)', () => {
    it('boolean 原样', () => {
      expect(toSafeBoolean(true)).toBe(true)
      expect(toSafeBoolean(false)).toBe(false)
    })
    it('数字 1 → true；数字 0 → false', () => {
      expect(toSafeBoolean(1)).toBe(true)
      expect(toSafeBoolean(0)).toBe(false)
    })
    it('字符串 "true"/"false"', () => {
      expect(toSafeBoolean('true')).toBe(true)
      expect(toSafeBoolean('false')).toBe(false)
    })
    it('其它值 → defaultValue（不识别）', () => {
      expect(toSafeBoolean('yes')).toBe(false) // default
      expect(toSafeBoolean('yes', true)).toBe(true)
      expect(toSafeBoolean(null, true)).toBe(true)
      expect(toSafeBoolean(2, false)).toBe(false)
    })
    it('defaultValue=true，value 不存在（undefined）→ true', () => {
      expect(toSafeBoolean(undefined, true)).toBe(true)
    })
  })

  describe('toSafeArray(value)', () => {
    it('真实数组 → 原样引用（类型断言不改变值）', () => {
      const a = [1, 2, 3]
      expect(toSafeArray<number>(a)).toBe(a)
    })
    it('非数组：null / string / object / undefined → []', () => {
      expect(toSafeArray(null)).toEqual([])
      expect(toSafeArray('abc')).toEqual([])
      expect(toSafeArray({})).toEqual([])
      expect(toSafeArray(undefined)).toEqual([])
    })
  })

  describe('toSafeString(value, default="")', () => {
    it('string 原样', () => {
      expect(toSafeString('hello')).toBe('hello')
      expect(toSafeString('')).toBe('')
    })
    it('null / undefined → defaultValue', () => {
      expect(toSafeString(null, 'unknown')).toBe('unknown')
      expect(toSafeString(undefined, 'x')).toBe('x')
      expect(toSafeString(null)).toBe('')
    })
    it('number / boolean / bigint → .toString()', () => {
      expect(toSafeString(42)).toBe('42')
      expect(toSafeString(true)).toBe('true')
      expect(toSafeString(false)).toBe('false')
      expect(toSafeString(BigInt(123))).toBe('123')
    })
    it('symbol → .toString()', () => {
      expect(toSafeString(Symbol.for('foo'))).toBe('Symbol(foo)')
    })
    it('object → String(value) 回退（自定义 toString）', () => {
      const o = { toString() { return 'objX' } }
      expect(toSafeString(o)).toBe('objX')
    })
  })

  describe('别名：getSafeString / getSafeNumber / getSafeArray', () => {
    it('getSafeString === toSafeString（引用一致）', () => {
      expect(getSafeString).toBe(toSafeString)
      expect(getSafeString(42)).toBe('42')
    })
    it('getSafeNumber === toSafeNumber', () => {
      expect(getSafeNumber).toBe(toSafeNumber)
      expect(getSafeNumber('abc')).toBe(0)
    })
    it('getSafeArray === toSafeArray', () => {
      expect(getSafeArray).toBe(toSafeArray)
      expect(getSafeArray(null)).toEqual([])
    })
  })

  describe('fallback 常量对象', () => {
    it('字段全部存在且为非空字符串', () => {
      expect(fallback.loading.length).toBeGreaterThan(0)
      expect(fallback.empty.length).toBeGreaterThan(0)
      expect(fallback.error.length).toBeGreaterThan(0)
      expect(fallback.unknown.length).toBeGreaterThan(0)
      expect(fallback.noContent.length).toBeGreaterThan(0)
    })
  })
})
