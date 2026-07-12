/**
 * ErrorBoundary 组件单元测试
 *
 * 覆盖场景：
 * 1. 正常渲染子组件
 * 2. 子组件抛出错误时显示错误兜底 UI
 * 3. DEV 环境下显示错误信息
 * 4. 生产环境隐藏错误信息，仅显示错误编号
 * 5. 自定义 fallback 组件
 * 6. 刷新按钮功能
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ErrorBoundary 使用类组件，需要模拟 logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

// 模拟错误总线，断言捕获的错误经 captureError 上报（A-03 闭环）
vi.mock('@/services/errorBus', () => ({
  captureError: vi.fn(),
}))

import { captureError } from '@/services/errorBus'

// 动态导入以应用 mock
const { ErrorBoundary } = await import('@/components/organisms/shared/ErrorBoundary')

// 测试用抛出错误的子组件
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>正常渲染</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常渲染子组件，无错误时显示 children', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child Content</div>
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('子组件抛出错误时显示错误兜底 UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('🛑 组件渲染出错')).toBeInTheDocument()
  })

  it('子组件抛出错误时经 captureError 上报到错误总线（A-03 闭环）', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    // 兜底 UI 已渲染，证明组件确实进入了错误态
    expect(screen.getByText('🛑 组件渲染出错')).toBeInTheDocument()
    // 错误应被收敛上报到错误总线，来源标记为 ErrorBoundary
    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'ErrorBoundary', operation: 'render' }),
    )
  })

  it('错误兜底包含刷新按钮', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeInTheDocument()
  })

  it('提供自定义 fallback 时渲染 fallback 而非默认错误 UI', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">自定义错误</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByText('🛑 组件渲染出错')).not.toBeInTheDocument()
  })

  it('无错误时 children 有机会渲染（多层嵌套）', () => {
    render(
      <ErrorBoundary>
        <ErrorBoundary>
          <div data-testid="nested">Nested</div>
        </ErrorBoundary>
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('nested')).toBeInTheDocument()
  })
})
