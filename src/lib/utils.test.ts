/**
 * @test_id V9-TEST-ST-025
 * @covers_docs []
 */
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

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
