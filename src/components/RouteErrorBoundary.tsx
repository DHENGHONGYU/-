import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSkeleton } from '@/components/PageSkeleton'
import { getLogger } from '@/lib/logger'
import { captureError } from '@/services/errorBus'

const logger = getLogger()

interface RouteErrorBoundaryInnerProps {
  children: ReactNode
  onGoHome: () => void
}

interface RouteErrorBoundaryInnerState {
  hasError: boolean
  error?: Error
  errorId?: string
}

/**
 * 路由级错误边界内部实现（Class Component）
 *
 * 与全局 ErrorBoundary 的区别：
 * - 每个 <Route> 独立持有一个实例，单路由崩溃不会污染其他路由
 * - 通过外层 key={location.pathname} 在路由切换时自动 remount，重置错误状态
 * - 提供「重试」「返回首页」「刷新页面」三级恢复策略
 */
class RouteErrorBoundaryInner extends Component<RouteErrorBoundaryInnerProps, RouteErrorBoundaryInnerState> {
  constructor(props: RouteErrorBoundaryInnerProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryInnerState {
    const RADIX_BASE36 = 36
    const RANDOM_SLICE_START = 2
    const RANDOM_SLICE_LENGTH = 8
    const errorId = `route_err_${Date.now().toString(RADIX_BASE36)}_${Math.random().toString(RADIX_BASE36).slice(RANDOM_SLICE_START, RANDOM_SLICE_LENGTH)}`
    return { hasError: true, error, errorId }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('[RouteErrorBoundary] 路由级渲染异常', {
      message: error.message,
      name: error.name,
      errorId: this.state.errorId,
      stack: import.meta.env.DEV ? error.stack : undefined,
      componentStack: import.meta.env.DEV ? info.componentStack : undefined,
    })
    captureError(error, {
      source: 'RouteErrorBoundary',
      operation: 'render',
      meta: {
        errorId: this.state.errorId,
        componentStack: import.meta.env.DEV ? info.componentStack : undefined,
      },
    })
  }

  handleRetry = (): void => {
    logger.info('[RouteErrorBoundary] 用户点击重试，重置错误状态')
    this.setState({ hasError: false, error: undefined, errorId: undefined })
  }

  handleGoHome = (): void => {
    logger.info('[RouteErrorBoundary] 用户点击返回首页')
    this.setState({ hasError: false, error: undefined, errorId: undefined })
    this.props.onGoHome()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>页面加载失败</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {import.meta.env.DEV ? (
                <p className="break-all text-sm text-muted-foreground">
                  {this.state.error?.message ?? '未知错误'}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  页面渲染异常，请重试或返回首页。错误编号：
                  <span className="ml-1 font-mono text-xs">{this.state.errorId}</span>
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={this.handleRetry}>
                  重试
                </Button>
                <Button variant="secondary" onClick={this.handleGoHome}>
                  返回首页
                </Button>
                <Button onClick={() => window.location.reload()}>
                  刷新页面
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * 路由级错误边界 + Suspense 包装器
 *
 * 使用方式：
 * ```tsx
 * <Route
 *   path="/analysis"
 *   element={
 *     <RouteErrorBoundary>
 *       <AnalysisPage />
 *     </RouteErrorBoundary>
 *   }
 * />
 * ```
 *
 * 特性：
 * 1. 路由切换时自动重置错误状态（key 绑定 location.pathname）
 * 2. 独立的 Suspense fallback，单路由懒加载不影响其他路由
 * 3. 三级恢复策略：重试 / 返回首页 / 刷新页面
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  const handleGoHome = (): void => {
    void navigate('/')
  }

  return (
    <RouteErrorBoundaryInner key={location.pathname} onGoHome={handleGoHome}>
      <Suspense fallback={<PageSkeleton />}>
        {children}
      </Suspense>
    </RouteErrorBoundaryInner>
  )
}
