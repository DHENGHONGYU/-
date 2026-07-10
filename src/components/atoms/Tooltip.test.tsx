/**
 * Tooltip 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染 children 和 tooltip
 * 2. side=top 时 tooltip 在上方
 * 3. side=bottom 时 tooltip 在下方
 * 4. side=left 时 tooltip 在左侧
 * 5. side=right 时 tooltip 在右侧
 * 6. 自定义 className 合并
 * 7. content 正确显示
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from '@/components/ui/Tooltip'

describe('Tooltip', () => {
  it('默认渲染 children', () => {
    render(
      <Tooltip content="提示文字">
        <button>hover me</button>
      </Tooltip>,
    )
    expect(screen.getByText('hover me')).toBeInTheDocument()
  })

  it('渲染 tooltip content', () => {
    render(
      <Tooltip content="提示文字">
        <button>hover me</button>
      </Tooltip>,
    )
    expect(screen.getByText('提示文字')).toBeInTheDocument()
  })

  it('默认 side=top 使用 bottom-full 类', () => {
    const { container } = render(
      <Tooltip content="提示">
        <button>hover</button>
      </Tooltip>,
    )
    const tooltip = container.querySelector('.bottom-full')
    expect(tooltip).toBeInTheDocument()
  })

  it('side=bottom 时使用 top-full 类', () => {
    const { container } = render(
      <Tooltip content="提示" side="bottom">
        <button>hover</button>
      </Tooltip>,
    )
    const tooltip = container.querySelector('.top-full')
    expect(tooltip).toBeInTheDocument()
  })

  it('side=left 时使用 right-full 类', () => {
    const { container } = render(
      <Tooltip content="提示" side="left">
        <button>hover</button>
      </Tooltip>,
    )
    const tooltip = container.querySelector('.right-full')
    expect(tooltip).toBeInTheDocument()
  })

  it('side=right 时使用 left-full 类', () => {
    const { container } = render(
      <Tooltip content="提示" side="right">
        <button>hover</button>
      </Tooltip>,
    )
    const tooltip = container.querySelector('.left-full')
    expect(tooltip).toBeInTheDocument()
  })

  it('外层有 group 类用于 hover 触发', () => {
    const { container } = render(
      <Tooltip content="提示">
        <button>hover</button>
      </Tooltip>,
    )
    const wrapper = container.querySelector('.group')
    expect(wrapper).toBeInTheDocument()
  })

  it('tooltip 有 opacity-0 初始状态', () => {
    const { container } = render(
      <Tooltip content="提示">
        <button>hover</button>
      </Tooltip>,
    )
    const tooltip = container.querySelector('.opacity-0')
    expect(tooltip).toBeInTheDocument()
  })

  it('group-hover 时显示 tooltip（opacity-100）', () => {
    const { container } = render(
      <Tooltip content="提示">
        <button>hover</button>
      </Tooltip>,
    )
    const tooltip = container.querySelector('.group-hover\\:opacity-100')
    expect(tooltip).toBeInTheDocument()
  })

  it('自定义 className 合并到外层', () => {
    const { container } = render(
      <Tooltip content="提示" className="my-tooltip">
        <button>hover</button>
      </Tooltip>,
    )
    const wrapper = container.querySelector('.my-tooltip')
    expect(wrapper).toBeInTheDocument()
  })
})
