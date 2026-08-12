/**
 * DataState 组件族单元测试
 *
 * 覆盖场景：
 * 1. isLoading=true 时优先渲染 LoadingState
 * 2. isError=true 时（loading=false）渲染 ErrorState
 * 3. isEmpty=true 时（loading=false, error=false）渲染 EmptyState
 * 4. 数组 data 为空时自动触发 empty
 * 5. 有 data 时渲染 children
 * 6. 优先级：loading > error > empty > children
 * 7. loadingProps 覆盖默认配置
 * 8. errorProps 覆盖默认配置
 * 9. emptyProps 覆盖默认配置
 * 10. LoadingErrorState：仅 loading + error
 * 11. LoadingEmptyState：仅 loading + empty
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UI_TEXT } from '@/constants/uiText'
import {
  DataState,
  LoadingErrorState,
  LoadingEmptyState,
} from '@/components/molecules/DataState'

describe('DataState', () => {
  it('isLoading=true 时渲染 LoadingState', () => {
    render(
      <DataState
        isLoading={true}
        isError={false}
        isEmpty={false}
        data={undefined}
      >
        <div>实际内容</div>
      </DataState>,
    )
    // LoadingState 渲染骨架屏
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('实际内容')).not.toBeInTheDocument()
  })

  it('isError=true 时（loading=false）渲染 ErrorState', () => {
    render(
      <DataState
        isLoading={false}
        isError={true}
        isEmpty={false}
        data={undefined}
        errorProps={{ error: '测试错误' }}
      >
        <div>实际内容</div>
      </DataState>,
    )
    expect(screen.getByText('测试错误')).toBeInTheDocument()
    expect(screen.queryByText('实际内容')).not.toBeInTheDocument()
  })

  it('isEmpty=true 时（loading=false, error=false）渲染 EmptyState', () => {
    render(
      <DataState
        isLoading={false}
        isError={false}
        isEmpty={true}
        data={undefined}
        emptyProps={{ title: '空空如也' }}
      >
        <div>实际内容</div>
      </DataState>,
    )
    expect(screen.getByText('空空如也')).toBeInTheDocument()
    expect(screen.queryByText('实际内容')).not.toBeInTheDocument()
  })

  it('data 为空数组时自动触发 empty', () => {
    render(
      <DataState
        isLoading={false}
        isError={false}
        isEmpty={false}
        data={[]}
      >
        <div>实际内容</div>
      </DataState>,
    )
    // EmptyState 默认 title="暂无数据"
    expect(screen.getByText(UI_TEXT.common.empty)).toBeInTheDocument()
    expect(screen.queryByText('实际内容')).not.toBeInTheDocument()
  })

  it('有 data 时渲染 children', () => {
    render(
      <DataState
        isLoading={false}
        isError={false}
        isEmpty={false}
        data={[{ id: 1 }]}
      >
        <div>实际内容</div>
      </DataState>,
    )
    expect(screen.getByText('实际内容')).toBeInTheDocument()
  })

  it('优先级：loading > error', () => {
    render(
      <DataState
        isLoading={true}
        isError={true}
        isEmpty={false}
        data={undefined}
        errorProps={{ error: '测试错误' }}
      >
        <div>实际内容</div>
      </DataState>,
    )
    // 应当渲染 LoadingState（优先级更高）
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('测试错误')).not.toBeInTheDocument()
  })

  it('优先级：error > empty', () => {
    render(
      <DataState
        isLoading={false}
        isError={true}
        isEmpty={true}
        data={undefined}
        errorProps={{ error: '测试错误' }}
        emptyProps={{ title: '空空如也' }}
      >
        <div>实际内容</div>
      </DataState>,
    )
    expect(screen.getByText('测试错误')).toBeInTheDocument()
    expect(screen.queryByText('空空如也')).not.toBeInTheDocument()
  })

  it('loadingProps 覆盖默认 message', () => {
    render(
      <DataState
        isLoading={true}
        isError={false}
        isEmpty={false}
        data={undefined}
        loadingProps={{ message: '数据加载中，请稍候' }}
      >
        <div>实际内容</div>
      </DataState>,
    )
    expect(screen.getByText('数据加载中，请稍候')).toBeInTheDocument()
  })

  it('errorProps.onRetry 点击重试按钮触发回调', () => {
    const handleRetry = vi.fn()
    render(
      <DataState
        isLoading={false}
        isError={true}
        isEmpty={false}
        data={undefined}
        errorProps={{ error: '失败', onRetry: handleRetry }}
      >
        <div>实际内容</div>
      </DataState>,
    )
    const retryBtn = screen.getByRole('button', { name: /重试/ })
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('自定义 className 透传', () => {
    const { container } = render(
      <DataState
        isLoading={true}
        isError={false}
        isEmpty={false}
        data={undefined}
        className="my-data-state"
      >
        <div>实际内容</div>
      </DataState>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('my-data-state')
  })
})

describe('LoadingErrorState', () => {
  it('isLoading=true 时渲染 spinner', () => {
    const { container } = render(<LoadingErrorState isLoading={true} isError={false} />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('isError=true 时（loading=false）渲染 ErrorState', () => {
    render(
      <LoadingErrorState
        isLoading={false}
        isError={true}
        error="加载失败测试"
      />,
    )
    expect(screen.getByText('加载失败测试')).toBeInTheDocument()
  })

  it('loading 和 error 都为 false 时返回 null', () => {
    const { container } = render(<LoadingErrorState isLoading={false} isError={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('loadingMessage 自定义加载文案', () => {
    render(
      <LoadingErrorState
        isLoading={true}
        isError={false}
        loadingMessage="正在拉取数据"
      />,
    )
    expect(screen.getByText('正在拉取数据')).toBeInTheDocument()
  })

  it('onRetry 点击重试按钮触发回调', () => {
    const handleRetry = vi.fn()
    render(
      <LoadingErrorState
        isLoading={false}
        isError={true}
        error="网络错误"
        onRetry={handleRetry}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })
})

describe('LoadingEmptyState', () => {
  it('isLoading=true 时渲染 spinner', () => {
    const { container } = render(<LoadingEmptyState isLoading={true} isEmpty={false} />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('isEmpty=true 时渲染 EmptyState', () => {
    render(
      <LoadingEmptyState
        isLoading={false}
        isEmpty={true}
        emptyProps={{ title: '数据为空' }}
      />,
    )
    expect(screen.getByText('数据为空')).toBeInTheDocument()
  })

  it('data 为空数组时自动触发 empty', () => {
    render(
      <LoadingEmptyState
        isLoading={false}
        isEmpty={false}
        data={[]}
        emptyProps={{ title: '数组也为空' }}
      />,
    )
    expect(screen.getByText('数组也为空')).toBeInTheDocument()
  })

  it('loading 和 empty 都为 false 时返回 null', () => {
    const { container } = render(
      <LoadingEmptyState
        isLoading={false}
        isEmpty={false}
        data={[{ id: 1 }]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
