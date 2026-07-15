import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Popover } from './Popover'

describe('Popover', () => {
  it('默认不展示浮层', () => {
    render(
      <Popover content={<div>Popover content</div>}>
        <button type="button">Trigger</button>
      </Popover>,
    )

    expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument()
  })

  it('点击触发器展开浮层', () => {
    render(
      <Popover content={<div>Popover content</div>}>
        <button type="button">Trigger</button>
      </Popover>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByText('Popover content')).toBeInTheDocument()
  })

  it('再次点击触发器收起浮层', () => {
    render(
      <Popover content={<div>Popover content</div>}>
        <button type="button">Trigger</button>
      </Popover>,
    )

    const trigger = screen.getByRole('button', { name: 'Trigger' })
    fireEvent.click(trigger)
    expect(screen.getByText('Popover content')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
  })

  it('点击外部收起浮层', () => {
    render(
      <div>
        <Popover content={<div>Popover content</div>}>
          <button type="button">Trigger</button>
        </Popover>
        <button type="button">Outside</button>
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByText('Popover content')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
  })

  it('hover 触发模式下鼠标进入展开、离开收起', () => {
    render(
      <Popover trigger="hover" content={<div>Hover content</div>}>
        <button type="button">Trigger</button>
      </Popover>,
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByText('Hover content')).toBeInTheDocument()

    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.queryByText('Hover content')).not.toBeInTheDocument()
  })

  it('defaultOpen 默认展开浮层', () => {
    render(
      <Popover defaultOpen content={<div>Default open</div>}>
        <button type="button">Trigger</button>
      </Popover>,
    )

    expect(screen.getByText('Default open')).toBeInTheDocument()
  })
})
