/**
 * Tabs 组件族单元测试
 *
 * 覆盖场景：
 * 1. TabsContext 不存在时使用 TabsTrigger 抛错
 * 2. defaultValue 设置初始 active
 * 3. 点击 TabsTrigger 切换 active value
 * 4. TabsContent 仅在 active value 匹配时渲染
 * 5. 受控模式（value + onValueChange）
 * 6. TabsTrigger 应用 active 样式
 * 7. TabsTrigger disabled 不可点击
 * 8. TabsList 渲染容器
 * 9. ref 转发
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/molecules/Tabs'

describe('Tabs 组件族', () => {
  it('TabsTrigger 在 TabsContext 缺失时抛出错误', () => {
    // 抑制 React 错误边界日志
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(<TabsTrigger value="tab1">Trigger</TabsTrigger>)
    }).toThrow('Tabs components must be used within <Tabs>')
    consoleErrorSpy.mockRestore()
  })

  it('defaultValue 设置初始 active', () => {
    render(
      <Tabs defaultValue="tab2">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    expect(screen.getByText('Content 2')).toBeInTheDocument()
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
  })

  it('点击 TabsTrigger 切换 active content', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    expect(screen.getByText('Content 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }))
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('受控模式：onValueChange 触发回调', () => {
    const handleChange = vi.fn()
    render(
      <Tabs value="tab1" onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }))
    expect(handleChange).toHaveBeenCalledWith('tab2')
  })

  it('受控模式：value 改变时 active content 同步', () => {
    const { rerender } = render(
      <Tabs value="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    expect(screen.getByText('Content 1')).toBeInTheDocument()
    rerender(
      <Tabs value="tab2">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('active TabsTrigger 应用 active 样式', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    const activeTab = screen.getByRole('tab', { name: 'Tab 1' })
    const inactiveTab = screen.getByRole('tab', { name: 'Tab 2' })
    expect(activeTab).toHaveAttribute('aria-selected', 'true')
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false')
    expect(activeTab).toHaveClass('bg-background')
  })

  it('TabsTrigger disabled 不可点击', () => {
    const handleChange = vi.fn()
    render(
      <Tabs defaultValue="tab1" onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="tab1" disabled>Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    const disabledTab = screen.getByRole('tab', { name: 'Tab 1' })
    expect(disabledTab).toBeDisabled()
    fireEvent.click(disabledTab)
    // disabled button 不会触发 onClick
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('TabsList 渲染为内联 flex 容器', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList data-testid="list">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    const list = screen.getByTestId('list')
    expect(list).toHaveClass('inline-flex')
    expect(list).toHaveClass('bg-muted')
  })

  it('TabsContent role=tabpanel', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>,
    )
    const panel = screen.getByRole('tabpanel')
    expect(panel).toBeInTheDocument()
  })

  it('Tabs ref 转发到外层 div', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Tabs ref={ref} defaultValue="tab1">
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
      </Tabs>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('TabsTrigger ref 转发到 button 元素', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Tabs defaultValue="tab1">
        <TabsTrigger ref={ref} value="tab1">ref 测试</TabsTrigger>
      </Tabs>,
    )
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('TabsContent 在不匹配时返回 null', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    )
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
  })
})
