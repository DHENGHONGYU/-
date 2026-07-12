/**
 * ErrorState 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认 variant=card 渲染卡片模式
 * 2. variant=inline 渲染内联模式
 * 3. variant=fullscreen 渲染全屏模式
 * 4. 错误码 network 显示网络错误信息
 * 5. 错误码 timeout 显示超时错误信息
 * 6. 错误码 business 显示业务错误信息
 * 7. errorCode 缺失时根据 error 关键词自动推断（network 关键词）
 * 8. errorCode 缺失时根据 error 关键词自动推断（timeout 关键词）
 * 9. error 为 string 类型时正确显示
 * 10. error 为 Error 对象时显示 message
 * 11. onRetry 点击重试按钮触发回调
 * 12. showErrorDetail=true 时显示原始错误
 * 13. 自定义 title 覆盖默认标题
 * 14. className 合并
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UI_TEXT } from '@/constants/uiText'
import { ErrorState } from '@/components/molecules/ErrorState'

describe('ErrorState', () => {
  it('默认 variant=card 渲染卡片模式（红框 + 重试按钮）', () => {
    render(<ErrorState error="测试卡片错误" onRetry={() => {}} />)
    // 错误信息在标题与消息中各出现一次
    expect(screen.getAllByText('测试卡片错误').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument()
  })

  it('variant=inline 渲染内联模式', () => {
    const { container } = render(
      <ErrorState error="字段校验失败" variant="inline" />,
    )
    // inline 模式没有红色背景卡片
    expect(container.querySelector('.bg-red-50')).toBeNull()
    expect(screen.getByText('字段校验失败')).toBeInTheDocument()
  })

  it('variant=fullscreen 渲染全屏模式（fixed inset-0）', () => {
    const { container } = render(
      <ErrorState error="系统异常" variant="fullscreen" />,
    )
    const wrapper = container.querySelector('.fixed') as HTMLElement
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('inset-0')
  })

  it('errorCode=network 显示网络错误信息', () => {
    render(
      <ErrorState
        error="some message"
        errorCode="network"
      />,
    )
    // errorCode=network 强制使用"网络错误"标题 + 默认消息
    expect(screen.getByText(UI_TEXT.errors.networkErrorShort)).toBeInTheDocument()
    expect(
      screen.getByText('网络连接失败，请检查您的网络设置'),
    ).toBeInTheDocument()
  })

  it('errorCode=timeout 显示超时错误信息', () => {
    render(<ErrorState error="some message" errorCode="timeout" />)
    expect(screen.getByText('请求超时')).toBeInTheDocument()
    expect(screen.getByText('请求超时，请稍后重试')).toBeInTheDocument()
  })

  it('errorCode=business 显示业务错误信息（使用 error 内容）', () => {
    render(<ErrorState error="数据格式错误" errorCode="business" />)
    expect(screen.getByText(UI_TEXT.errors.operationFailed)).toBeInTheDocument()
    expect(screen.getByText('数据格式错误')).toBeInTheDocument()
  })

  it('errorCode 缺失时根据 error 关键词自动推断为 network', () => {
    render(<ErrorState error="NetworkError: fetch failed" />)
    expect(screen.getByText(UI_TEXT.errors.networkErrorShort)).toBeInTheDocument()
  })

  it('errorCode 缺失时根据 error 关键词自动推断为 timeout', () => {
    render(<ErrorState error="请求超时，请稍后重试" />)
    expect(screen.getByText('请求超时')).toBeInTheDocument()
  })

  it('errorCode 缺失时根据 error 关键词自动推断为 network（断网关键词）', () => {
    render(<ErrorState error="断网了" />)
    expect(screen.getByText(UI_TEXT.errors.networkErrorShort)).toBeInTheDocument()
  })

  it('error 为 string 类型时正确显示', () => {
    render(<ErrorState error="字符串错误" />)
    expect(screen.getByText('字符串错误')).toBeInTheDocument()
  })

  it('error 为 Error 对象时显示 message', () => {
    render(<ErrorState error={new Error('对象错误消息')} />)
    expect(screen.getByText('对象错误消息')).toBeInTheDocument()
  })

  it('onRetry 点击重试按钮触发回调', () => {
    const handleRetry = vi.fn()
    render(<ErrorState error="失败" onRetry={handleRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('未传 onRetry 时不显示重试按钮', () => {
    render(<ErrorState error="失败提示" />)
    expect(screen.queryByRole('button', { name: /重试/ })).not.toBeInTheDocument()
  })

  it('showErrorDetail=true 时显示原始 error', () => {
    render(
      <ErrorState
        error="原始错误堆栈信息"
        errorCode="network"
        showErrorDetail={true}
      />,
    )
    expect(screen.getByText('原始错误堆栈信息')).toBeInTheDocument()
  })

  it('showErrorDetail=false（默认）时不显示原始 error', () => {
    render(
      <ErrorState
        error="原始错误堆栈信息"
        errorCode="network"
      />,
    )
    // errorCode=network 时默认消息覆盖了原始 error
    expect(screen.queryByText('原始错误堆栈信息')).not.toBeInTheDocument()
    expect(
      screen.getByText('网络连接失败，请检查您的网络设置'),
    ).toBeInTheDocument()
  })

  it('自定义 title 覆盖默认标题', () => {
    render(<ErrorState error="失败" title="自定义标题" />)
    expect(screen.getByText('自定义标题')).toBeInTheDocument()
    expect(screen.queryByText(UI_TEXT.errors.operationFailed)).not.toBeInTheDocument()
  })

  it('未知 error 类型显示默认消息', () => {
    render(<ErrorState error="" />)
    expect(screen.getByText(UI_TEXT.errors.operationFailed)).toBeInTheDocument()
  })

  it('className 合并到外层 wrapper', () => {
    const { container } = render(
      <ErrorState error="失败" className="my-error-state" />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('my-error-state')
    expect(wrapper).toHaveClass('w-full')
  })
})
