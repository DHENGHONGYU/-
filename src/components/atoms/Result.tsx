import { type HTMLAttributes, type ReactNode, forwardRef, memo } from 'react'
import { cn } from '@/lib/utils'

export type ResultStatus = 'success' | 'error' | '403' | '404' | '500' | 'info'

export interface ResultProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 结果状态 */
  status: ResultStatus
  /** 标题 */
  title?: string | ReactNode
  /** 副标题 */
  subTitle?: ReactNode
  /** 底部操作区域 */
  extra?: ReactNode
}

const statusConfig: Record<ResultStatus, { icon: string; title: string; subTitle: string }> = {
  success: {
    icon: '✅',
    title: '操作成功',
    subTitle: '您的操作已成功完成',
  },
  error: {
    icon: '❌',
    title: '操作失败',
    subTitle: '抱歉，操作未能完成，请稍后重试',
  },
  403: {
    icon: '🚫',
    title: '权限不足',
    subTitle: '您没有访问此资源的权限',
  },
  404: {
    icon: '🔍',
    title: '页面不存在',
    subTitle: '抱歉，您访问的页面不存在',
  },
  500: {
    icon: '💥',
    title: '服务器错误',
    subTitle: '抱歉，服务器出了点问题，请稍后重试',
  },
  info: {
    icon: 'ℹ️',
    title: '提示',
    subTitle: '这是一条提示信息',
  },
}

export const Result = memo(forwardRef<HTMLDivElement, ResultProps>(
  ({ className, status, title, subTitle, extra, ...props }, ref) => {
    const config = statusConfig[status]

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center p-8 text-center',
          className,
        )}
        {...props}
      >
        <div className="text-6xl mb-4">{config.icon}</div>
        <div className="text-xl font-semibold mb-2">{title ?? config.title}</div>
        <div className="text-muted-foreground mb-6">{subTitle ?? config.subTitle}</div>
        {extra && <div className="flex gap-2">{extra}</div>}
      </div>
    )
  },
))

Result.displayName = 'Result'
