import { describe, it, expect } from 'vitest'
import { safeRegex } from './safeRegex'

describe('safeRegex', () => {
  it('正常构造正则表达式', () => {
    const re = safeRegex('hello')
    expect(re).toBeInstanceOf(RegExp)
    expect(re.test('hello world')).toBe(true)
  })

  it('支持 flags 参数', () => {
    const re = safeRegex('abc', 'gi')
    expect(re.global).toBe(true)
    expect(re.ignoreCase).toBe(true)
    expect(re.multiline).toBe(false)
  })

  it('支持所有合法标志 igmsuy', () => {
    const re = safeRegex('test', 'igmsuy')
    expect(re.ignoreCase).toBe(true)
    expect(re.global).toBe(true)
    expect(re.multiline).toBe(true)
    expect(re.dotAll).toBe(true)
    expect(re.unicode).toBe(true)
    expect(re.sticky).toBe(true)
  })

  it('空模式抛出错误', () => {
    expect(() => safeRegex('')).toThrow('不能为空')
  })

  it('超长模式抛出错误', () => {
    const longPattern = 'a'.repeat(300)
    expect(() => safeRegex(longPattern)).toThrow('模式过长')
  })

  it('非法标志抛出错误', () => {
    expect(() => safeRegex('test', 'xyz')).toThrow('无效标志')
  })

  it('模式长度刚好等于 256 不报错', () => {
    const pattern = 'a'.repeat(256)
    expect(() => safeRegex(pattern)).not.toThrow()
  })

  it('模式长度 257 报错', () => {
    const pattern = 'a'.repeat(257)
    expect(() => safeRegex(pattern)).toThrow('模式过长')
  })

  it('返回的正则能正确匹配', () => {
    const re = safeRegex('\\d+', 'g')
    const matches = 'abc123def456'.match(re)
    expect(matches).toEqual(['123', '456'])
  })
})
