/**
 * ErrorState 组件 - 全局错误状态展示
 *
 * 支持三种展示模式：
 * - inline: 内联模式，适合表单内错误展示
 * - card: 卡片模式，适合区块内错误展示
 * - fullscreen: 全屏模式，适合页面级错误展示
 *
 * 支持错误类型区分：
 * - 网络错误：显示"网络连接失败，请检查网络"
 * - 业务错误：显示具体错误信息
 * - 超时错误：显示"请求超时，请稍后重试"
 *
 * @module components/ui/ErrorState
 */

import { memo, useCallback } from 'react'
import { AlertCircle, RotateCcw, WifiOff, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { twText, twBg, twBorder, DARK, HOVER } from '@/constants/theme.tokens'

// ============================================================
// Props 定义
// ============================================================

export interface ErrorStateProps {
  /** 错误对象或错误信息字符串 */
  error: Error | string
  /** 重试回调 */
  onRetry?: () => void
  /** 展示模式 */
  variant?: 'inline' | 'card' | 'fullscreen'
  /** 错误标题 */
  title?: string
  /** 是否显示详细错误信息 */
  showErrorDetail?: boolean
  /** 错误码：network | business | timeout */
  errorCode?: 'network' | 'business' | 'timeout'
  /** 额外 className */
  className?: string
}

// ============================================================
// 错误类型判断
// ============================================================

interface ErrorInfo {
  code: 'network' | 'business' | 'timeout'
  title: string
  defaultMessage: string
}

function getErrorInfo(error: Error | string, errorCode?: ErrorStateProps['errorCode']): ErrorInfo {
  // 优先使用传入的 errorCode
  if (errorCode === 'network') {
    return {
      code: 'network',
      title: '网络错误',
      defaultMessage: '网络连接失败，请检查您的网络设置',
    }
  }
  if (errorCode === 'timeout') {
    return {
      code: 'timeout',
      title: '请求超时',
      defaultMessage: '请求超时，请稍后重试',
    }
  }
  if (errorCode === 'business') {
    return {
      code: 'business',
      title: '操作失败',
      defaultMessage: typeof error === 'string' ? error : error.message,
    }
  }

  // 从 error 对象推断错误类型
  const errorMessage = typeof error === 'string' ? error : error.message || ''

  // 网络错误常见关键词
  const networkKeywords = [
    'network', 'Network', 'fetch', 'connection', 'internet',
    '断网', '网络', '无法连接', '连接失败', '网络异常',
    'ERR_', 'Failed to fetch', 'NetworkError'
  ]
  if (networkKeywords.some(kw => errorMessage.includes(kw))) {
    return {
      code: 'network',
      title: '网络错误',
      defaultMessage: '网络连接失败，请检查您的网络设置',
    }
  }

  // 超时错误常见关键词
  const timeoutKeywords = [
    'timeout', 'Timeout', 'timed out', '超时', '请求超时'
  ]
  if (timeoutKeywords.some(kw => errorMessage.includes(kw))) {
    return {
      code: 'timeout',
      title: '请求超时',
      defaultMessage: '请求超时，请稍后重试',
    }
  }

  // 默认为业务错误
  return {
    code: 'business',
    title: '操作失败',
    defaultMessage: errorMessage || '发生了未知错误',
  }
}

// ============================================================
// 错误图标
// ============================================================

function getErrorIcon(code: ErrorInfo['code']) {
  switch (code) {
    case 'network':
      return <WifiOff className={`h-5 w-5 ${twText('red', 600)}`} />
    case 'timeout':
      return <Clock className={`h-5 w-5 ${twText('red', 600)}`} />
    default:
      return <AlertCircle className={`h-5 w-5 ${twText('red', 600)}`} />
  }
}

// ============================================================
// Inline 模式
// ============================================================

interface ErrorInlineProps {
  error: Error | string
  errorInfo: ErrorInfo
  onRetry?: () => void
  showErrorDetail?: boolean
  className?: string
}

function ErrorInline({ error, errorInfo, onRetry, showErrorDetail, className }: ErrorInlineProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {getErrorIcon(errorInfo.code)}
      <span className={`${twText('red', 600)} flex-1`}>
        {showErrorDetail ? errorMessage : errorInfo.defaultMessage}
      </span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="h-auto p-0 text-xs">
          <RotateCcw className="h-3 w-3 mr-1" />
          重试
        </Button>
      )}
    </div>
  )
}

// ============================================================
// Card 模式
// ============================================================

interface ErrorCardProps {
  error: Error | string
  errorInfo: ErrorInfo
  title?: string
  onRetry?: () => void
  showErrorDetail?: boolean
  className?: string
}

function ErrorCard({
  error,
  errorInfo,
  title,
  onRetry,
  showErrorDetail,
  className
}: ErrorCardProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div
      className={cn(
        `rounded-lg border ${twBorder('red', 200)} ${twBg('red', 50)} p-4`,
        `${DARK.bgRed950_30} ${DARK.borderRed900}`,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{getErrorIcon(errorInfo.code)}</div>
        <div className="flex-1 space-y-2">
          <p className={`text-sm font-medium ${twText('red', 800)} ${DARK.textRed200}`}>
            {title ?? errorInfo.title}
          </p>
          <p className={`text-sm ${twText('red', 700)} ${DARK.textRed300}`}>
            {showErrorDetail ? errorMessage : errorInfo.defaultMessage}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className={`mt-1 ${twBorder('red', 300)} ${twText('red', 700)} ${twBg('red', 100)} ${HOVER.bgRed100} ${DARK.borderRed800} ${DARK.textRed300}`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              重试
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Fullscreen 模式
// ============================================================

interface ErrorFullscreenProps {
  error: Error | string
  errorInfo: ErrorInfo
  title?: string
  onRetry?: () => void
  showErrorDetail?: boolean
  className?: string
}

function ErrorFullscreen({
  error,
  errorInfo,
  title,
  onRetry,
  showErrorDetail,
  className
}: ErrorFullscreenProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-8',
        'bg-background/80 backdrop-blur-sm',
        className
      )}
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto">
          {getErrorIcon(errorInfo.code)}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {title ?? errorInfo.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {showErrorDetail ? errorMessage : errorInfo.defaultMessage}
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重试
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

export const ErrorState = memo(function ErrorState({
  error,
  onRetry,
  variant = 'card',
  title,
  showErrorDetail = false,
  errorCode,
  className,
}: ErrorStateProps) {
  const errorInfo = getErrorInfo(error, errorCode)

  // 使用 useCallback 包装 onRetry，避免不必要的重渲染
  const handleRetry = useCallback(() => {
    onRetry?.()
  }, [onRetry])

  return (
    <div className={cn('w-full', className)}>
      {variant === 'inline' && (
        <ErrorInline
          error={error}
          errorInfo={errorInfo}
          onRetry={onRetry ? handleRetry : undefined}
          showErrorDetail={showErrorDetail}
        />
      )}
      {variant === 'card' && (
        <ErrorCard
          error={error}
          errorInfo={errorInfo}
          title={title}
          onRetry={onRetry ? handleRetry : undefined}
          showErrorDetail={showErrorDetail}
        />
      )}
      {variant === 'fullscreen' && (
        <ErrorFullscreen
          error={error}
          errorInfo={errorInfo}
          title={title}
          onRetry={onRetry ? handleRetry : undefined}
          showErrorDetail={showErrorDetail}
        />
      )}
    </div>
  )
})

export default ErrorState
