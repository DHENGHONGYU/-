/**
 * Alert 组件单元测试
 *
 * 覆盖场景：
 * 1. 基础渲染：5 种变体样式
 * 2. 子组件：AlertTitle、AlertDescription
 * 3. 交互：关闭按钮、onClose 回调
 * 4. 主题适配：深色/浅色模式下的 Token 应用
 * 5. 可访问性：role="alert"、aria-label
 * 6. 自定义图标：icon prop
 * 7. 样式合并：className 合并
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Alert 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // 基础渲染测试
  // ============================================================

  describe('基础渲染', () => {
    it('渲染默认变体（default）', () => {
      render(<Alert>默认提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent('默认提示')
    })

    it('渲染 destructive 变体', () => {
      render(<Alert variant="destructive">错误提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent('错误提示')
    })

    it('渲染 success 变体', () => {
      render(<Alert variant="success">成功提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
    })

    it('渲染 warning 变体', () => {
      render(<Alert variant="warning">警告提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
    })

    it('渲染 info 变体', () => {
      render(<Alert variant="info">信息提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
    })
  })

  // ============================================================
  // 子组件测试
  // ============================================================

  describe('子组件', () => {
    it('渲染 AlertTitle', () => {
      render(
        <Alert>
          <AlertTitle>标题</AlertTitle>
          <AlertDescription>描述内容</AlertDescription>
        </Alert>
      )
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('描述内容')).toBeInTheDocument()
    })

    it('AlertTitle 应用正确的排版 Token', () => {
      render(<AlertTitle>标题</AlertTitle>)
      const title = screen.getByText('标题')
      // AlertTitle 使用 fontWeight/lineHeight/letterSpacing Token
      expect(title.className).toContain(THEME_TOKENS.typography.fontWeight.semibold)
      expect(title.className).toContain(THEME_TOKENS.typography.lineHeight.none)
      expect(title.className).toContain(THEME_TOKENS.typography.letterSpacing.tight)
    })

    it('AlertDescription 应用正确的排版 Token', () => {
      render(<AlertDescription>描述</AlertDescription>)
      const desc = screen.getByText('描述')
      expect(desc.className).toContain(THEME_TOKENS.typography.fontSize.sm)
      expect(desc.className).toContain(THEME_TOKENS.typography.lineHeight.relaxed)
    })
  })

  // ============================================================
  // 交互测试
  // ============================================================

  describe('交互', () => {
    it('不显示关闭按钮（closable=false）', () => {
      render(<Alert>提示</Alert>)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('显示关闭按钮（closable=true）', () => {
      render(<Alert closable>提示</Alert>)
      const closeButton = screen.getByRole('button', { name: /关闭/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('点击关闭按钮触发 onClose 回调', () => {
      const onClose = vi.fn()
      render(
        <Alert closable onClose={onClose}>
          提示
        </Alert>
      )
      const closeButton = screen.getByRole('button', { name: /关闭/i })
      fireEvent.click(closeButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('关闭按钮使用正确的 Token', () => {
      render(
        <Alert closable>
          提示
        </Alert>
      )
      const closeButton = screen.getByRole('button', { name: /关闭/i })
      expect(closeButton.className).toContain(THEME_TOKENS.radius.sm)
      expect(closeButton.className).toContain(THEME_TOKENS.spacing.xs)
    })
  })

  // ============================================================
  // Token 应用测试
  // ============================================================

  describe('Token 应用', () => {
    it('应用基础布局 Token', () => {
      render(<Alert>提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(THEME_TOKENS.radius.lg)
      expect(alert.className).toContain(THEME_TOKENS.spacing.md)
      expect(alert.className).toContain(THEME_TOKENS.gap.md)
      expect(alert.className).toContain('border')
    })

    it('应用变体样式 Token（default）', () => {
      render(<Alert variant="default">提示</Alert>)
      const alert = screen.getByRole('alert')
      // 检查背景色和图标色（图标色在子元素上）
      expect(alert.className).toContain(COLOR_TOKENS.bgMuted.tailwind)
      const iconDiv = alert.querySelector('div.shrink-0')
      expect(iconDiv?.className).toContain(COLOR_TOKENS.textMuted.tailwind)
    })

    it('应用变体样式 Token（destructive）', () => {
      render(<Alert variant="destructive">错误</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(COLOR_TOKENS.danger.bgClass)
      const iconDiv = alert.querySelector('div.shrink-0')
      expect(iconDiv?.className).toContain(COLOR_TOKENS.danger.tailwind)
    })

    it('应用变体样式 Token（success）', () => {
      render(<Alert variant="success">成功</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(COLOR_TOKENS.success.bgClass)
      const iconDiv = alert.querySelector('div.shrink-0')
      expect(iconDiv?.className).toContain(COLOR_TOKENS.success.tailwind)
    })

    it('应用变体样式 Token（warning）', () => {
      render(<Alert variant="warning">警告</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(COLOR_TOKENS.warning.bgClass)
      const iconDiv = alert.querySelector('div.shrink-0')
      expect(iconDiv?.className).toContain(COLOR_TOKENS.warning.tailwind)
    })

    it('应用变体样式 Token（info）', () => {
      render(<Alert variant="info">信息</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(COLOR_TOKENS.info.bgClass)
      const iconDiv = alert.querySelector('div.shrink-0')
      expect(iconDiv?.className).toContain(COLOR_TOKENS.info.tailwind)
    })

    it('默认图标使用 iconSizes.md Token', () => {
      render(<Alert>提示</Alert>)
      const alert = screen.getByRole('alert')
      const svg = alert.querySelector('svg')
      expect(svg?.getAttribute('class')).toContain(THEME_TOKENS.iconSizes.md)
    })

    it('关闭按钮图标使用 iconSizes.sm Token', () => {
      render(<Alert closable>提示</Alert>)
      const closeButton = screen.getByRole('button', { name: /关闭/i })
      const svg = closeButton.querySelector('svg')
      expect(svg?.getAttribute('class')).toContain(THEME_TOKENS.iconSizes.sm)
    })
  })

  // ============================================================
  // 自定义图标测试
  // ============================================================

  describe('自定义图标', () => {
    it('使用自定义图标替代默认图标', () => {
      const customIcon = <span data-testid="custom-icon">★</span>
      render(<Alert icon={customIcon}>提示</Alert>)
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 样式合并测试
  // ============================================================

  describe('样式合并', () => {
    it('合并自定义 className', () => {
      render(<Alert className="custom-class">提示</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain('custom-class')
    })
  })

  // ============================================================
  // 可访问性测试
  // ============================================================

  describe('可访问性', () => {
    it('具有 role="alert" 属性', () => {
      render(<Alert>提示</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('关闭按钮具有 aria-label 属性', () => {
      render(<Alert closable>提示</Alert>)
      const closeButton = screen.getByRole('button', { name: /关闭/i })
      expect(closeButton).toHaveAttribute('aria-label', '关闭')
    })
  })

  // ============================================================
  // 主题切换测试
  // ============================================================

  describe('主题切换', () => {
    it('浅色主题下应用正确的背景 Token', () => {
      document.documentElement.classList.remove('dark')
      render(<Alert variant="info">信息</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(COLOR_TOKENS.info.bgClass)
    })

    it('深色主题下应用正确的背景 Token', () => {
      document.documentElement.classList.add('dark')
      render(<Alert variant="info">信息</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain(COLOR_TOKENS.info.bgClass)
    })

    it('主题切换时 Token 类名保持一致', () => {
      document.documentElement.classList.remove('dark')
      const { rerender } = render(<Alert variant="success">成功</Alert>)
      const alert1 = screen.getByRole('alert')
      const classList1 = alert1.className

      document.documentElement.classList.add('dark')
      rerender(<Alert variant="success">成功</Alert>)
      const alert2 = screen.getByRole('alert')
      const classList2 = alert2.className

      expect(classList1).toBe(classList2)
    })
  })
})
