/**
 * PageSkeleton 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染骨架屏
 * 2. 渲染多个 Card 骨架（6 个）
 * 3. 骨架元素包含 animate-pulse 动画类
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PageSkeleton } from '@/components/PageSkeleton'

describe('PageSkeleton', () => {
  it('默认渲染骨架屏容器', () => {
    render(<PageSkeleton />)
    const container = document.querySelector('.space-y-4')
    expect(container).toBeInTheDocument()
  })

  it('渲染页面标题骨架', () => {
    render(<PageSkeleton />)
    const title = document.querySelector('.h-8.w-48')
    expect(title).toBeInTheDocument()
  })

  it('渲染 6 个 Card 骨架', () => {
    render(<PageSkeleton />)
    const cards = document.querySelectorAll('.grid > div')
    expect(cards.length).toBe(6)
  })

  it('骨架元素包含 animate-pulse 类', () => {
    render(<PageSkeleton />)
    const animatedElements = document.querySelectorAll('.animate-pulse')
    expect(animatedElements.length).toBeGreaterThan(0)
  })
})
