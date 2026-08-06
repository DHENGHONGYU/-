/**
 * Alert 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染：role="alert"、默认 variant
 * 2. 5 种 variant 样式映射 (default/destructive/success/warning/info)
 * 3. closable + onClose 交互
 * 4. AlertTitle & AlertDescription 子组件渲染
 * 5. 自定义 icon、memo、className、HTMLAttributes
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription, type AlertVariant } from './Alert'

describe('Alert', () => {
  describe('基础渲染', () => {
    it('渲染 role="alert" 用于无障碍', () => {
      render(<Alert>提示内容</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('默认 variant=default 渲染正确内容', () => {
      render(<Alert>内容文本</Alert>)
      expect(screen.getByRole('alert')).toHaveTextContent('内容文本')
    })

    it('包含 flex 布局类 & border & w-full', () => {
      render(<Alert data-testid="a">提示</Alert>)
      const alert = screen.getByTestId('a')
      expect(alert.className).toContain('flex')
      expect(alert.className).toContain('w-full')
      expect(alert.className).toContain('border')
    })
  })

  describe('variant 样式映射', () => {
    const variants: AlertVariant[] = ['default', 'destructive', 'success', 'warning', 'info']
    variants.forEach((v) => {
      it(`variant="${v}" 不抛异常并生成内容`, () => {
        render(
          <Alert variant={v} data-testid={`a-${v}`}>
            {v} variant
          </Alert>
        )
        expect(screen.getByTestId(`a-${v}`)).toHaveTextContent(`${v} variant`)
      })
    })

    it('destructive 包含 SVG 默认图标 (stroke="currentColor")', () => {
      const { container } = render(<Alert variant="destructive">危险</Alert>)
      const svgs = container.querySelectorAll('svg[stroke="currentColor"]')
      expect(svgs.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('closable + onClose', () => {
    it('closable=false 不渲染关闭按钮', () => {
      render(<Alert closable={false}>内容</Alert>)
      expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument()
    })

    it('不设置 closable（默认 false）不渲染关闭按钮', () => {
      render(<Alert>内容</Alert>)
      expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument()
    })

    it('closable=true 渲染关闭按钮', () => {
      render(<Alert closable>内容</Alert>)
      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    })

    it('点击关闭按钮调用 onClose', () => {
      const onClose = vi.fn()
      render(
        <Alert closable onClose={onClose}>
          内容
        </Alert>
      )
      fireEvent.click(screen.getByRole('button', { name: '关闭' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('未提供 onClose 时点击关闭按钮不抛异常', () => {
      render(<Alert closable>内容</Alert>)
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: '关闭' }))
      ).not.toThrow()
    })
  })

  describe('自定义 icon', () => {
    it('使用自定义 icon 替换默认图标', () => {
      render(
        <Alert icon={<span data-testid="custom-icon">✨</span>}>
          内容
        </Alert>
      )
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })

    it('自定义 icon 时仍显示 children', () => {
      render(
        <Alert icon={<span data-testid="ic">I</span>}>
          <span data-testid="ch">CH</span>
        </Alert>
      )
      expect(screen.getByTestId('ic')).toBeInTheDocument()
      expect(screen.getByTestId('ch')).toBeInTheDocument()
    })
  })

  describe('AlertTitle', () => {
    it('渲染为 H5 标签', () => {
      render(<AlertTitle>标题</AlertTitle>)
      const title = screen.getByText('标题')
      expect(title.tagName).toBe('H5')
    })

    it('传入 className 可合并', () => {
      render(<AlertTitle className="extra">T</AlertTitle>)
      expect(screen.getByText('T').className).toContain('extra')
    })

    it('与 Alert 组合使用时语义正确（内容都出现在 alert 中）', () => {
      render(
        <Alert>
          <AlertTitle>警告标题</AlertTitle>
          <AlertDescription>描述文字</AlertDescription>
        </Alert>
      )
      expect(screen.getByRole('alert')).toHaveTextContent('警告标题')
      expect(screen.getByRole('alert')).toHaveTextContent('描述文字')
    })
  })

  describe('AlertDescription', () => {
    it('渲染为 DIV 标签（AlertDescriptionProps 实际类型为 HTMLParagraphElement 但实现使用 div）', () => {
      render(<AlertDescription>详情文本</AlertDescription>)
      const desc = screen.getByText('详情文本')
      expect(desc.tagName).toBe('DIV')
    })

    it('className 正确合并', () => {
      render(<AlertDescription className="my-class">D</AlertDescription>)
      expect(screen.getByText('D').className).toContain('my-class')
    })
  })

  describe('className & HTMLAttributes', () => {
    it('自定义 className 与默认类合并', () => {
      render(<Alert className="my-alert" data-testid="a">内容</Alert>)
      const alert = screen.getByTestId('a')
      expect(alert.className).toContain('my-alert')
      expect(alert.className).toContain('w-full')
    })

    it('透传 id 属性', () => {
      render(<Alert id="alert-001">内容</Alert>)
      expect(screen.getByRole('alert').id).toBe('alert-001')
    })
  })

  describe('memo', () => {
    it('相同 props 二次渲染不产生异常', () => {
      const { rerender } = render(<Alert variant="info">信息</Alert>)
      expect(() => rerender(<Alert variant="info">信息</Alert>)).not.toThrow()
      expect(screen.getByRole('alert')).toHaveTextContent('信息')
    })
  })
})
