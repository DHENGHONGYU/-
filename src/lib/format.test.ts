import { describe, it, expect } from 'vitest'
import { formatFieldValue } from './format'

describe('formatFieldValue()', () => {
  it('undefined/null 返回 —', () => {
    expect(formatFieldValue(undefined)).toBe('—')
    expect(formatFieldValue(null)).toBe('—')
  })

  it('数字转为字符串', () => {
    expect(formatFieldValue(42)).toBe('42')
    expect(formatFieldValue(0)).toBe('0')
    expect(formatFieldValue(-3.14)).toBe('-3.14')
  })

  it('字符串原值返回', () => {
    expect(formatFieldValue('hello')).toBe('hello')
    expect(formatFieldValue('')).toBe('')
  })

  it('布尔值转为字符串', () => {
    expect(formatFieldValue(true)).toBe('true')
    expect(formatFieldValue(false)).toBe('false')
  })

  it('bigint 转为字符串', () => {
    expect(formatFieldValue(BigInt(123))).toBe('123')
  })

  it('symbol 转为字符串', () => {
    expect(formatFieldValue(Symbol('test'))).toBe('Symbol(test)')
  })

  it('对象调用 String()', () => {
    expect(formatFieldValue({})).toBe('[object Object]')
    expect(formatFieldValue([1, 2, 3])).toBe('1,2,3')
  })
})
