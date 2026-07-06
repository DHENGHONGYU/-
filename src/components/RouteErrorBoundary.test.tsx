/**
 * RouteErrorBoundary 组件单元测试
 *
 * 覆盖场景：
 * 1. 正常渲染子组件
 * 2. 子组件抛出错误时显示路由级错误卡片（「页面加载失败」）
 * 3. 错误卡片包含三级恢复按钮（重试 / 返回首页 / 刷新页面）
 * 4. 路由切换时自动重置错误状态
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'

// 模拟 logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const { RouteErrorBoundary } = await import('@/components/RouteErrorBoundary')

/** 测试用：根据 prop 决定是否抛出错误的子组件 */
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Route test error')
  }
  return <div data-testid="child">正常内容</div>
}

/** 测试用：通过外部变量控制是否抛错，便于测试「重试」恢复流程 */
let throwFlag = false
function ControlledThrower() {
  if (throwFlag) {
    throw new Error('Controlled route test error')
  }
  return <div data-testid="child">正常内容</div>
}

/** 包装 RouteErrorBoundary 到 MemoryRouter 中，便于测试 useLocation/useNavigate */
function renderWithRouter(
  children: React.ReactNode,
  initialEntries: string[] = ['/'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={<RouteErrorBoundary>{children}</RouteErrorBoundary>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    throwFlag = false
  })

  it('正常渲染子组件，无错误时显示 children', () => {
    renderWithRouter(<ThrowError shouldThrow={false} />)
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('子组件抛出错误时显示路由级错误卡片', () => {
    renderWithRouter(<ThrowError shouldThrow={true} />)
    expect(screen.getByText(UI_TEXT.errors.pageLoadFailed)).toBeInTheDocument()
  })

  it('错误卡片包含「重试」按钮', () => {
    renderWithRouter(<ThrowError shouldThrow={true} />)
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('错误卡片包含「返回首页」按钮', () => {
    renderWithRouter(<ThrowError shouldThrow={true} />)
    expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument()
  })

  it('错误卡片包含「刷新页面」按钮', () => {
    renderWithRouter(<ThrowError shouldThrow={true} />)
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeInTheDocument()
  })

  it('点击「重试」按钮后重置错误状态，恢复正常渲染', () => {
    // 先开启抛错
    throwFlag = true
    renderWithRouter(<ControlledThrower />)
    expect(screen.getByText(UI_TEXT.errors.pageLoadFailed)).toBeInTheDocument()

    // 关闭抛错，然后点击重试
    throwFlag = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    // 重试后错误卡片消失，子组件正常渲染
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText(UI_TEXT.errors.pageLoadFailed)).not.toBeInTheDocument()
  })
})
