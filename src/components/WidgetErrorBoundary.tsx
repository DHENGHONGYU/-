/**
 * Widget 专用错误边界组件
 *
 * 为 Widget 提供轻量级错误边界，显示错误状态并提供重试机制。
 * 区别于全局 ErrorBoundary，不会刷新整个页面，仅影响单个 Widget。
 *
 * 变更记录：
 * - v1.0.0 (2026-06-27): 初始版本
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { captureError } from '@/services/errorBus'

const logger = getLogger()

interface WidgetErrorBoundaryProps {
  /** Widget ID */
  widgetId: string
  /** Widget 实例 ID */
  instanceId: string
  /** 子组件 */
  children: ReactNode
  /** 自定义错误标题 */
  errorTitle?: string
  /** 最大重试次数 */
  maxRetries?: number
  /** 重试回调 */
  onRetry?: () => void
  /** 错误回调 */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface WidgetErrorBoundaryState {
  hasError: boolean
  error?: Error
  retryCount: number
}

/**
 * WidgetErrorBoundary
 */
export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error, retryCount: 0 }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const { widgetId, instanceId, onError } = this.props

    logger.error(`[WidgetErrorBoundary] Widget ${widgetId} 捕获错误`, {
      instanceId,
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })

    captureError(error, {
      source: 'WidgetErrorBoundary',
      operation: 'render',
      meta: { widgetId, instanceId, componentStack: info.componentStack },
    })

    onError?.(error, info)
  }

  handleRetry = (): void => {
    const { maxRetries = 3, onRetry } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      logger.warn(`[WidgetErrorBoundary] 重试次数已达上限 ${maxRetries}`)
      return
    }

    this.setState({ hasError: false, retryCount: retryCount + 1 })
    onRetry?.()

    logger.info('[WidgetErrorBoundary] 用户触发重试', {
      retryCount: retryCount + 1,
      maxRetries,
    })
  }

  render(): ReactNode {
    const { widgetId, errorTitle, children } = this.props
    const { hasError, error, retryCount } = this.state

    if (!hasError) {
      return children
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {errorTitle ?? 'Widget 加载失败'}
            </CardTitle>
            <Badge variant="destructive" className="text-xs">
              错误
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Widget ID: {widgetId}</p>
            <p className={COLOR_TOKENS.danger.tailwind}>{error?.message ?? '未知错误'}</p>
          </div>

          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground">
              已重试 {retryCount} 次
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              重试
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logger.info('[WidgetErrorBoundary] 用户点击查看详情')
                console.error('Widget Error Details:', {
                  widgetId,
                  error,
                  retryCount,
                })
              }}
            >
              查看详情
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
}