/**
 * @module InputFlowErrorBoundary
 * @description 输入流程专用错误边界组件。
 *
 * 用于包裹"股票添加/录入"相关的 UI 区域，捕获以下场景的渲染异常：
 *   - addStock 调用过程中子组件抛出的同步错误
 *   - 表格渲染时因数据格式异常导致的崩溃
 *   - 子组件（StockSearch / GaugeRing 等）的渲染错误
 *
 * 特点：
 *   - 紧凑型 inline 错误展示（不像全屏 ErrorBoundary 那样占满屏幕）
 *   - 支持 onReset 回调，让父组件重置错误态后重新渲染
 *   - 支持 fallback 自定义兜底 UI
 *   - 错误捕获后通过 captureError 上报错误总线
 *
 * 使用方式：
 *   <InputFlowErrorBoundary onReset={() => setKey(k => k + 1)}>
 *     <InputDashboard />
 *   </InputFlowErrorBoundary>
 *
 *   // 或包裹更小的区域
 *   <InputFlowErrorBoundary>
 *     <StockTable items={items} />
 *   </InputFlowErrorBoundary>
 *
 * @see src/components/organisms/shared/ErrorBoundary.tsx -- 全屏通用错误边界
 * @see src/services/errorBus.ts -- 错误上报总线
  * @doc [V9-DOC-PROJ-108, V9-DOC-PROJ-239]
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'
import { captureError } from '@/services/errorBus'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface InputFlowErrorBoundaryProps {
  children: ReactNode
  /** 自定义兜底 UI */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** 错误恢复回调（用户点击"重试"时触发，父组件可借此重置 key 强制重渲染） */
  onReset?: () => void
  /** 错误来源标签（用于日志区分） */
  label?: string
}

interface InputFlowErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class InputFlowErrorBoundary extends Component<
  InputFlowErrorBoundaryProps,
  InputFlowErrorBoundaryState
> {
  constructor(props: InputFlowErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): InputFlowErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.label ?? 'InputFlow'
    logger.error(`[${label}] 输入流程组件渲染异常`, {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })

    captureError(error, {
      source: label,
      operation: 'render',
      meta: { componentStack: info.componentStack },
    })
  }

  handleReset = (): void => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 自定义兜底 UI 优先
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      // 默认紧凑型兜底 UI（inline，不占满屏幕）
      return (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-4"
          data-testid="input-flow-error"
        >
          <div className="flex items-start gap-3">
            <span className="text-lg" aria-hidden>
              ⚠️
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-destructive">该区域渲染出错</p>
              <p className="text-xs text-muted-foreground">
                {this.state.error.message || '未知错误'}
              </p>
              <p className="text-xs text-muted-foreground">
                单只股票添加失败不影响其他功能，可点击下方按钮重试。
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={this.handleReset}>
              重试
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
