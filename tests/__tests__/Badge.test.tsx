/**
 * Badge 组件单元测试
 *
 * 覆盖场景：
 * 1. 基础渲染：6 种变体样式
 * 2. Token 应用：基础 Token + 变体 Token
 * 3. 主题适配：深色/浅色模式下的 Token 应用
 * 4. 样式合并：className 合并
 * 5. 可访问性：语义化标签
 * 6. ref 转发
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/atoms/Badge'
import { THEME_TOKENS } from '@/constants/theme.tokens'

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Badge 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // 基础渲染测试
  // ============================================================

  describe('基础渲染', () => {
    it('渲染默认变体（default）', () => {
      render(<Badge>默认</Badge>)
      const badge = screen.getByText('默认')
      expect(badge).toBeInTheDocument()
      expect(badge.tagName).toBe('SPAN')
    })

    it('渲染 secondary 变体', () => {
      render(<Badge variant="secondary">次要</Badge>)
      const badge = screen.getByText('次要')
      expect(badge).toBeInTheDocument()
    })

    it('渲染 outline 变体', () => {
      render(<Badge variant="outline">轮廓</Badge>)
      const badge = screen.getByText('轮廓')
      expect(badge).toBeInTheDocument()
    })

    it('渲染 destructive 变体', () => {
      render(<Badge variant="destructive">危险</Badge>)
      const badge = screen.getByText('危险')
      expect(badge).toBeInTheDocument()
    })

    it('渲染 success 变体', () => {
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      expect(badge).toBeInTheDocument()
    })

    it('渲染 warning 变体', () => {
      render(<Badge variant="warning">警告</Badge>)
      const badge = screen.getByText('警告')
      expect(badge).toBeInTheDocument()
    })
  })

  // ============================================================
  // Token 应用测试
  // ============================================================

  describe('Token 应用', () => {
    it('应用基础布局 Token', () => {
      render(<Badge>测试</Badge>)
      const badge = screen.getByText('测试')
      expect(badge.className).toContain(THEME_TOKENS.radius.full)
      // border token 被 variant 的 border-transparent 覆盖，所以不检查 baseTokens.border
      expect(badge.className).toContain(THEME_TOKENS.typography.fontSize.xs)
      expect(badge.className).toContain(THEME_TOKENS.typography.fontWeight.semibold)
      expect(badge.className).toContain('transition-colors')
      expect(badge.className).toContain('inline-flex')
      expect(badge.className).toContain('items-center')
    })

    it('应用 padding Token', () => {
      render(<Badge>测试</Badge>)
      const badge = screen.getByText('测试')
      expect(badge.className).toContain('px-2.5')
      expect(badge.className).toContain('py-0.5')
    })

    it('default 变体应用正确的 Token', () => {
      render(<Badge variant="default">默认</Badge>)
      const badge = screen.getByText('默认')
      // 2026-08-23 Token Plan 处理事项修复：对齐生产软性风格规范（低浓度背景 + 同色边框 + 100% 文字）
      expect(badge.className).toContain('bg-primary/10')
      expect(badge.className).toContain('text-primary')
      expect(badge.className).toContain('border-primary/30')
    })

    it('secondary 变体应用正确的 Token', () => {
      render(<Badge variant="secondary">次要</Badge>)
      const badge = screen.getByText('次要')
      expect(badge.className).toContain('bg-secondary')
      expect(badge.className).toContain('text-secondary-foreground')
      expect(badge.className).toContain('border-secondary-foreground/20')
    })

    it('outline 变体应用正确的 Token', () => {
      render(<Badge variant="outline">轮廓</Badge>)
      const badge = screen.getByText('轮廓')
      // 语义令牌化后 outline 使用 border-border + text-foreground（主题感知）
      expect(badge.className).toContain('text-foreground')
    })

    it('destructive 变体应用正确的 Token', () => {
      render(<Badge variant="destructive">危险</Badge>)
      const badge = screen.getByText('危险')
      // 2026-08-23 对齐生产软性风格规范：低浓度背景 + 同色边框 + 100% 文字（原实心样式已废弃）
      expect(badge.className).toContain('bg-destructive/10')
      expect(badge.className).toContain('text-destructive')
      expect(badge.className).toContain('border-destructive/30')
    })

    it('success 变体应用正确的 Token', () => {
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      // 2026-08-23 对齐生产软性风格规范（与 #21C45D 规范成功色对齐）
      expect(badge.className).toContain('bg-success/10')
      expect(badge.className).toContain('text-success')
      expect(badge.className).toContain('border-success/30')
    })

    it('warning 变体应用正确的 Token', () => {
      render(<Badge variant="warning">警告</Badge>)
      const badge = screen.getByText('警告')
      // 2026-08-23 对齐生产软性风格规范（原实心样式已废弃）
      expect(badge.className).toContain('bg-warning/10')
      expect(badge.className).toContain('text-warning')
      expect(badge.className).toContain('border-warning/30')
    })
  })

  // ============================================================
  // 样式合并测试
  // ============================================================

  describe('样式合并', () => {
    it('合并自定义 className', () => {
      render(<Badge className="custom-class">测试</Badge>)
      const badge = screen.getByText('测试')
      expect(badge.className).toContain('custom-class')
    })

    it('自定义 className 优先级高于默认 Token', () => {
      render(<Badge className="text-red-500">测试</Badge>)
      const badge = screen.getByText('测试')
      expect(badge.className).toContain('text-red-500')
    })
  })

  // ============================================================
  // 可访问性测试
  // ============================================================

  describe('可访问性', () => {
    it('使用 span 标签渲染', () => {
      render(<Badge>测试</Badge>)
      const badge = screen.getByText('测试')
      expect(badge.tagName).toBe('SPAN')
    })

    it('支持 HTML 属性透传', () => {
      render(<Badge data-testid="test-badge">测试</Badge>)
      expect(screen.getByTestId('test-badge')).toBeInTheDocument()
    })
  })

  // ============================================================
  // ref 转发测试
  // ============================================================

  describe('ref 转发', () => {
    it('正确转发 ref 到 span 元素', () => {
      const ref = vi.fn()
      render(<Badge ref={ref}>测试</Badge>)
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0]![0].tagName).toBe('SPAN')
    })
  })

  // ============================================================
  // 主题切换测试
  // ============================================================

  describe('主题切换', () => {
    it('浅色主题下应用正确的 Token', () => {
      document.documentElement.classList.remove('dark')
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      expect(badge.className).toContain('bg-success')
    })

    it('深色主题下应用正确的 Token', () => {
      document.documentElement.classList.add('dark')
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      expect(badge.className).toContain('bg-success')
    })

    it('主题切换时 Token 类名保持一致', () => {
      document.documentElement.classList.remove('dark')
      const { rerender } = render(<Badge variant="warning">警告</Badge>)
      const badge1 = screen.getByText('警告')
      const classList1 = badge1.className

      document.documentElement.classList.add('dark')
      rerender(<Badge variant="warning">警告</Badge>)
      const badge2 = screen.getByText('警告')
      const classList2 = badge2.className

      expect(classList1).toBe(classList2)
    })

    it('outline 变体在主题切换时使用主题感知前景色', () => {
      document.documentElement.classList.remove('dark')
      const { rerender } = render(<Badge variant="outline">轮廓</Badge>)
      const badge1 = screen.getByText('轮廓')
      expect(badge1.className).toContain('text-foreground')

      document.documentElement.classList.add('dark')
      rerender(<Badge variant="outline">轮廓</Badge>)
      const badge2 = screen.getByText('轮廓')
      expect(badge2.className).toContain('text-foreground')
    })
  })

  // ============================================================
  // hover 状态测试
  // ============================================================

  describe('hover 状态', () => {
    // 2026-08-23 Token Plan 处理事项修复：对齐生产软性风格规范（hover 浓度 /15 而非实心 /80）
    it('default 变体包含 hover 样式', () => {
      render(<Badge variant="default">默认</Badge>)
      const badge = screen.getByText('默认')
      expect(badge.className).toContain('hover:bg-primary/15')
    })

    it('destructive 变体包含 hover 样式', () => {
      render(<Badge variant="destructive">危险</Badge>)
      const badge = screen.getByText('危险')
      expect(badge.className).toContain('hover:bg-destructive/15')
    })

    it('success 变体包含 hover 样式', () => {
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      expect(badge.className).toContain('hover:bg-success/15')
    })

    it('warning 变体包含 hover 样式', () => {
      render(<Badge variant="warning">警告</Badge>)
      const badge = screen.getByText('警告')
      expect(badge.className).toContain('hover:bg-warning/15')
    })
  })
})
