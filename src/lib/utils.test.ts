/**
 * @test_id V9-TEST-ST-025
 * @covers_docs []
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, generateId, now, createTraceId, hexToRgba } from './utils'

// ──────────────────────────────────────────────
// cn — clsx + twMerge
// ──────────────────────────────────────────────
describe('cn', () => {
  it('合并多个类名字符串', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('合并条件类名', () => {
    const isActive = true
    const isHidden = false
    expect(cn('base', isActive && 'active', isHidden && 'hidden')).toBe('base active')
  })

  it('处理 Tailwind 冲突：后者覆盖前者', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('处理 undefined / null / 空字符串', () => {
    expect(cn('px-4', undefined, null, '', 'py-2')).toBe('px-4 py-2')
  })

  it('处理对象语法', () => {
    expect(cn({ 'bg-red-500': true, 'bg-blue-500': false })).toBe('bg-red-500')
  })

  it('混合对象和字符串语法', () => {
    expect(cn('text-sm', { 'font-bold': true, 'italic': false }, 'text-gray-700'))
      .toBe('text-sm font-bold text-gray-700')
  })

  it('处理 Tailwind 同类冲突：颜色后覆盖前', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('处理 Tailwind 不同属性不冲突', () => {
    const result = cn('text-red-500', 'bg-blue-500')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('无参数返回空字符串', () => {
    expect(cn()).toBe('')
  })

  it('数字被忽略（clsx 默认行为）', () => {
    expect(cn('base', 0, 'extra')).toBe('base extra')
  })
})

describe('generateId', () => {
  it('应返回长度 16 的字符串', () => {
    expect(generateId()).toHaveLength(16)
    expect(typeof generateId()).toBe('string')
  })
  it('多次调用应唯一', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) ids.add(generateId())
    expect(ids.size).toBe(100)
  })
  it('应只含 URL 安全字符', () => {
    expect(generateId()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('now', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  it('应返回当前时间戳', () => {
    vi.setSystemTime(new Date(1700000000000))
    expect(now()).toBe(1700000000000)
    expect(now()).toBe(Date.now())
  })
  it('应随时间推进增大', () => {
    vi.setSystemTime(new Date(1700000000000))
    const r1 = now()
    vi.setSystemTime(new Date(1700000005000))
    expect(now()).toBeGreaterThan(r1)
  })
})

describe('createTraceId', () => {
  it('应以指定前缀开头', () => {
    expect(createTraceId('trace').startsWith('trace-')).toBe(true)
  })
  it('随机部分长度为 8', () => {
    expect(createTraceId('p').slice(2)).toHaveLength(8)
  })
  it('多次调用应唯一', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) ids.add(createTraceId('t'))
    expect(ids.size).toBe(50)
  })
  it('空前缀/长前缀/特殊字符', () => {
    expect(createTraceId('')).toHaveLength(9)
    expect(createTraceId('very-long').startsWith('very-long-')).toBe(true)
    expect(createTraceId('user_123').startsWith('user_123-')).toBe(true)
  })
})

describe('hexToRgba', () => {
  it('6位HEX含/不含#', () => {
    expect(hexToRgba('#ef4444')).toBe('rgba(239, 68, 68, 1)')
    expect(hexToRgba('ef4444')).toBe('rgba(239, 68, 68, 1)')
  })
  it('3位HEX展开', () => {
    expect(hexToRgba('#f00')).toBe('rgba(255, 0, 0, 1)')
    expect(hexToRgba('#abc')).toBe('rgba(170, 187, 204, 1)')
  })
  it('自定义alpha', () => {
    expect(hexToRgba('#ef4444', 0.5)).toBe('rgba(239, 68, 68, 0.5)')
    expect(hexToRgba('#000', 0)).toBe('rgba(0, 0, 0, 0)')
  })
  it('黑白/大小写', () => {
    expect(hexToRgba('#000000')).toBe('rgba(0, 0, 0, 1)')
    expect(hexToRgba('#FFFFFF')).toBe('rgba(255, 255, 255, 1)')
    expect(hexToRgba('#aB3CdE')).toBe('rgba(171, 60, 222, 1)')
  })
  it('小数alpha', () => {
    expect(hexToRgba('#3b82f6', 0.25)).toBe('rgba(59, 130, 246, 0.25)')
  })
})
