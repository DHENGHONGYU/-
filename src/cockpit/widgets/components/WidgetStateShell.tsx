/**
 * @module cockpit/widgets/components/WidgetStateShell
 * @description Widget 数据状态统一外壳：封装 Card 标题与
 * Loading / Empty / ErrorState 四态渲染，减少各 Widget 重复样板。
 *
 * @compliance
 * - 颜色/图标全部引用 theme.tokens，无硬编码
 * - 仅做状态呈现，数据获取仍由消费方通过 store/hook 提供
 */

import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Loading, Empty, ErrorState } from '@/components/ui/states'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

export type WidgetVisualState = 'ready' | 'loading' | 'empty' | 'error'

export interface WidgetStateShellProps {
  /** Widget 标题 */
  title: string
  /** 标题左侧图标 */
  titleIcon?: ReactNode
  /** 标题右侧额外操作 */
  titleAction?: ReactNode
  /** 当前视觉状态 */
  visualState: WidgetVisualState
  /** 错误信息（error 状态必填） */
  error?: string | null
  /** 重试回调（error 状态显示重试按钮） */
  onRetry?: () => void
  /** 加载提示文案 */
  loadingLabel?: string
  /** 空状态标题 */
  emptyTitle?: string
  /** 空状态描述 */
  emptyDescription?: string
  /** 空状态操作区 */
  emptyAction?: ReactNode
  /** 自定义骨架屏（loading 状态使用；未提供则使用 Loading 组件） */
  skeleton?: ReactNode
  /** 正常内容 */
  children: ReactNode
  /** 外层 Card 额外类名 */
  className?: string
}

export function WidgetStateShell({
  title,
  titleIcon,
  titleAction,
  visualState,
  error,
  onRetry,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeleton,
  children,
  className,
}: WidgetStateShellProps): React.JSX.Element {
  const renderState = (): ReactNode => {
    if (visualState === 'loading') {
      return skeleton ?? <Loading label={loadingLabel ?? '加载中…'} />
    }

    if (visualState === 'empty') {
      return (
        <Empty
          title={emptyTitle ?? '暂无数据'}
          description={emptyDescription}
          action={emptyAction}
        />
      )
    }

    if (visualState === 'error') {
      return (
        <ErrorState
          className={COLOR_TOKENS.danger.tailwind}
          title="加载失败"
          description={error ?? '请求异常，请稍后重试'}
          onRetry={onRetry}
          retryLabel="重试"
        />
      )
    }

    return children
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {titleIcon}
            {title}
          </CardTitle>
          {titleAction}
        </div>
      </CardHeader>
      <CardContent>{renderState()}</CardContent>
    </Card>
  )
}
