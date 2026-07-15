import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Menu, MenuItem, SubMenu } from './Menu'

describe('Menu', () => {
  it('应渲染垂直菜单项', () => {
    render(
      <Menu>
        <MenuItem itemKey="1">Item 1</MenuItem>
        <MenuItem itemKey="2">Item 2</MenuItem>
      </Menu>,
    )

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('点击菜单项触发 onSelect', () => {
    const handleSelect = vi.fn()
    render(
      <Menu onSelect={handleSelect}>
        <MenuItem itemKey="a">Item A</MenuItem>
      </Menu>,
    )

    fireEvent.click(screen.getByText('Item A'))
    expect(handleSelect).toHaveBeenCalledWith('a')
  })

  it('受控 selectedKeys 高亮对应项', () => {
    render(
      <Menu selectedKeys={['b']}>
        <MenuItem itemKey="a">Item A</MenuItem>
        <MenuItem itemKey="b">Item B</MenuItem>
      </Menu>,
    )

    const items = screen.getAllByRole('menuitem')
    expect(items[1]).toHaveClass('bg-accent')
    expect(items[0]).not.toHaveClass('bg-accent')
  })

  it('禁用菜单项不可点击', () => {
    const handleSelect = vi.fn()
    render(
      <Menu onSelect={handleSelect}>
        <MenuItem itemKey="a" disabled>
          Disabled
        </MenuItem>
      </Menu>,
    )

    fireEvent.click(screen.getByText('Disabled'))
    expect(handleSelect).not.toHaveBeenCalled()
    expect(screen.getByText('Disabled')).toHaveAttribute('aria-disabled', 'true')
  })

  it('支持图标渲染', () => {
    render(
      <Menu>
        <MenuItem itemKey="a" icon={<span data-testid="icon">★</span>}>
          With Icon
        </MenuItem>
      </Menu>,
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('水平模式下渲染为横向布局', () => {
    const { container } = render(
      <Menu mode="horizontal">
        <MenuItem itemKey="1">Item 1</MenuItem>
      </Menu>,
    )

    expect(container.querySelector('ul')).toHaveClass('flex-row')
  })

  it('SubMenu 点击展开/收起子菜单', () => {
    render(
      <Menu>
        <SubMenu title="Parent">
          <MenuItem itemKey="child">Child</MenuItem>
        </SubMenu>
      </Menu>,
    )

    expect(screen.queryByText('Child')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Parent'))
    expect(screen.getByText('Child')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Parent'))
    expect(screen.queryByText('Child')).not.toBeInTheDocument()
  })
})
