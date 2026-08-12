/**
 * InputFlowErrorBoundary 单元测试
 *
 * 覆盖场景：
 *   1. 正常渲染子组件
 *   2. 子组件抛错时显示紧凑型错误 UI
 *   3. 点击"重试"调用 onReset 并清空错误态
 *   4. 自定义 fallback 渲染
 *   5. 错误经 captureError 上报
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputFlowErrorBoundary } from './InputFlowErrorBoundary'

// ─── Mock 依赖 ──────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

const { mockCaptureError } = vi.hoisted(() => ({
  mockCaptureError: vi.fn(),
}))
vi.mock('@/services/errorBus', () => ({
  captureError: mockCaptureError,
}))

vi.mock('@/components/atoms/Button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}))

// ─── 测试辅助组件 ───────────────────────────────────────────

function ThrowOnRender({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('模拟子组件渲染崩溃')
  }
  return <div data-testid="normal-content">正常渲染</div>
}

// ─── 测试 ───────────────────────────────────────────────────

describe('InputFlowErrorBoundary', () => {
  beforeEach(() => {
    mockCaptureError.mockReset()
    // 抑制 React 的 console.error 日志（错误边界测试会触发）
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('正常渲染子组件', () => {
    render(
      <InputFlowErrorBoundary>
        <ThrowOnRender shouldThrow={false} />
      </InputFlowErrorBoundary>,
    )

    expect(screen.queryByTestId('normal-content')).toBeTruthy()
    expect(screen.queryByTestId('input-flow-error')).toBeNull()
  })

  it('子组件抛错时显示紧凑型错误 UI', () => {
    render(
      <InputFlowErrorBoundary label="TestInput">
        <ThrowOnRender shouldThrow={true} />
      </InputFlowErrorBoundary>,
    )

    // 应显示错误容器
    expect(screen.queryByTestId('input-flow-error')).toBeTruthy()
    // 应显示错误消息
    expect(screen.queryByText(/模拟子组件渲染崩溃/)).toBeTruthy()
    // 应显示"单只股票添加失败不影响其他功能"提示
    expect(screen.queryByText(/单只股票添加失败不影响其他功能/)).toBeTruthy()
    // 应显示重试按钮
    expect(screen.queryByRole('button', { name: '重试' })).toBeTruthy()
  })

  it('错误经 captureError 上报到错误总线', () => {
    render(
      <InputFlowErrorBoundary label="StockTable">
        <ThrowOnRender shouldThrow={true} />
      </InputFlowErrorBoundary>,
    )

    expect(mockCaptureError).toHaveBeenCalledTimes(1)
    const [err, context] = mockCaptureError.mock.calls[0]!
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('模拟子组件渲染崩溃')
    expect(context.source).toBe('StockTable')
    expect(context.operation).toBe('render')
    expect(context.meta).toHaveProperty('componentStack')
  })

  it('点击"重试"调用 onReset 并清空错误态', () => {
    const onReset = vi.fn()
    // 通过 key 变化强制 ErrorBoundary 重建实例，模拟父组件 resetKey 重置
    let boundaryKey = 0
    let shouldThrow = true

    const { rerender } = render(
      <InputFlowErrorBoundary
        key={boundaryKey}
        onReset={() => {
          onReset()
          shouldThrow = false
          boundaryKey++
        }}
      >
        <ThrowOnRender shouldThrow={shouldThrow} />
      </InputFlowErrorBoundary>,
    )

    // 错误态：显示错误 UI
    expect(screen.queryByTestId('input-flow-error')).toBeTruthy()

    // 点击重试，onReset 翻转 shouldThrow 并增加 key
    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    // 用新 key 重新渲染（模拟父组件 onReset 后 key++ 触发重建）
    rerender(
      <InputFlowErrorBoundary
        key={boundaryKey}
        onReset={() => {
          onReset()
          shouldThrow = false
          boundaryKey++
        }}
      >
        <ThrowOnRender shouldThrow={shouldThrow} />
      </InputFlowErrorBoundary>,
    )

    // onReset 应被调用
    expect(onReset).toHaveBeenCalledTimes(1)
    // key 变化后 ErrorBoundary 是新实例，state 重置，正常内容出现
    expect(screen.queryByTestId('input-flow-error')).toBeNull()
    expect(screen.queryByTestId('normal-content')).toBeTruthy()
  })

  it('支持自定义 fallback', () => {
    const fallbackRender = vi.fn((error: Error, reset: () => void) => (
      <div data-testid="custom-fallback">
        自定义错误: {error.message}
        <button onClick={reset}>自定义重试</button>
      </div>
    ))

    render(
      <InputFlowErrorBoundary fallback={fallbackRender}>
        <ThrowOnRender shouldThrow={true} />
      </InputFlowErrorBoundary>,
    )

    // 应渲染自定义 fallback
    expect(screen.queryByTestId('custom-fallback')).toBeTruthy()
    expect(screen.queryByText(/自定义错误: 模拟子组件渲染崩溃/)).toBeTruthy()
    // 默认错误 UI 不应出现
    expect(screen.queryByTestId('input-flow-error')).toBeNull()

    // 点击自定义重试
    fireEvent.click(screen.getByRole('button', { name: '自定义重试' }))
    // fallback 应被调用过（包含初始渲染）
    expect(fallbackRender).toHaveBeenCalled()
  })

  it('未提供 label 时使用默认 "InputFlow" 作为 source', () => {
    render(
      <InputFlowErrorBoundary>
        <ThrowOnRender shouldThrow={true} />
      </InputFlowErrorBoundary>,
    )

    expect(mockCaptureError).toHaveBeenCalledTimes(1)
    const context = mockCaptureError.mock.calls[0]![1]
    expect(context.source).toBe('InputFlow')
  })
})
