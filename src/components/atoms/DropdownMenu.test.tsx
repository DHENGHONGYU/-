/**
 * DropdownMenu 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认关闭：触发器显示，菜单内容不渲染
 * 2. 点击触发器打开菜单：菜单面板出现，包含菜单项
 * 3. 点击菜单项触发 onClick 并关闭菜单
 * 4. 点击外部关闭菜单
 * 5. 按 Escape 关闭菜单
 * 6. disabled 菜单项不可点击
 * 7. CheckboxItem 切换 checked 状态
 * 8. RadioGroup/RadioItem 选择
 * 9. 分组标题与分割线渲染
 * 10. 快捷键 Shortcut 右对齐显示
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
} from '@/components/atoms/DropdownMenu'

const renderDropdown = (ui: React.ReactElement) => render(ui)

describe('DropdownMenu', () => {
  it('默认关闭：触发器显示，菜单内容不渲染', () => {
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目一</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    expect(screen.getByRole('button', { name: '打开菜单' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByText('项目一')).not.toBeInTheDocument()
  })

  it('点击触发器打开菜单：菜单面板出现，包含菜单项', () => {
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目一</DropdownMenuItem>
          <DropdownMenuItem>项目二</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '项目一' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '项目二' })).toBeInTheDocument()
  })

  it('点击菜单项触发 onClick 并关闭菜单', () => {
    const handleClick = vi.fn()
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleClick}>点击项</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '点击项' }))

    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('点击 trigger 和 content 以外的区域关闭菜单', async () => {
    renderDropdown(
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>项目一</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button">外部按钮</button>
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // 等待 DropdownMenu 中 setTimeout 注册的 document 事件监听器生效
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    fireEvent.mouseDown(screen.getByRole('button', { name: '外部按钮' }))

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('按 Escape 键关闭菜单', async () => {
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目一</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // 等待 DropdownMenu 中 setTimeout 注册的 document 事件监听器生效
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('disabled 菜单项不可点击且菜单不关闭', () => {
    const handleClick = vi.fn()
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onClick={handleClick}>
            禁用项
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '禁用项' }))

    expect(handleClick).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('CheckboxItem 切换 checked 状态并触发 onCheckedChange', () => {
    const handleCheckedChange = vi.fn()
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={handleCheckedChange}>
            多选项
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    const checkbox = screen.getByRole('menuitemcheckbox', { name: '多选项' })
    expect(checkbox).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(checkbox)
    expect(handleCheckedChange).toHaveBeenCalledTimes(1)
    expect(handleCheckedChange).toHaveBeenCalledWith(true)
  })

  it('RadioGroup/RadioItem 选择并触发 onValueChange', () => {
    const handleValueChange = vi.fn()
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup value="a" onValueChange={handleValueChange}>
            <DropdownMenuRadioItem value="a">选项 A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">选项 B</DropdownMenuRadioItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '选项 B' }))

    expect(handleValueChange).toHaveBeenCalledTimes(1)
    expect(handleValueChange).toHaveBeenCalledWith('b')
  })

  it('Label 和 Separator 正确渲染', () => {
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>分组标题</DropdownMenuLabel>
          <DropdownMenuItem>项目一</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>项目二</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))

    expect(screen.getByText('分组标题')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '项目一' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '项目二' })).toBeInTheDocument()
  })

  it('Shortcut 快捷键文字右对齐显示', () => {
    renderDropdown(
      <DropdownMenu>
        <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            复制
            <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开菜单' }))
    const shortcut = screen.getByText('Ctrl+C')

    expect(shortcut).toBeInTheDocument()
    expect(shortcut.tagName).toBe('SPAN')
    expect(shortcut).toHaveClass('ml-auto')
  })
})
